import { create } from 'zustand';
import { extractTextFromNoteImage, type NoteScanMode } from '../services/gemini';
import {
  getOcrEngineMode,
  getOcrMode,
  getOcrQualityTier,
  setOcrEngineMode,
  setOcrMode,
  setOcrQualityTier,
  type OcrEngineMode,
  type OcrMode,
  type OcrQualityTier,
} from '../services/localAiConfig';
import { runLocalOcrScan, type LocalOcrProgress } from '../services/localMediaManager';
import { t } from '../services/i18n';
import { useAiJobsStore } from './aiJobsStore';

export interface ScannedImageItem {
  id: string;
  name: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
  status: 'ready' | 'scanning' | 'done' | 'error';
  error?: string;
}

export interface ScanProgressState {
  percent: number;
  label: string;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
}

const OCR_JOB_ID = 'note-scanner-ocr';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'image/jpeg' });
}

function formatOfflineProgressDetail(p: LocalOcrProgress): {
  label: string;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
} {
  if (p.stage === 'downloading') {
    const mbLoaded = p.loaded ? (p.loaded / (1024 * 1024)).toFixed(1) : '0.0';
    const mbTotal = p.total ? (p.total / (1024 * 1024)).toFixed(1) : null;
    return {
      label: t('scanner_prog_downloading'),
      detail: mbTotal ? `${mbLoaded} / ${mbTotal} MB` : `${mbLoaded} MB`,
    };
  }
  if (p.stage === 'detecting') {
    return {
      label: t('scanner_prog_detecting'),
      detail:
        typeof p.totalLines === 'number' && p.totalLines > 0
          ? t('scanner_prog_found_lines', { count: p.totalLines })
          : undefined,
    };
  }
  if (p.stage === 'formatting') {
    return {
      label: t('scanner_prog_formatting'),
    };
  }
  return {
    label:
      typeof p.completed === 'number' && typeof p.totalLines === 'number' && p.totalLines > 0
        ? t('scanner_prog_reading_line', {
            current: Math.min(p.totalLines, p.completed + 1),
            total: p.totalLines,
          })
        : t('scanner_scanning'),
    currentItem:
      typeof p.completed === 'number' && typeof p.totalLines === 'number'
        ? Math.min(p.totalLines, p.completed + 1)
        : undefined,
    totalItems: p.totalLines,
  };
}

let activeAbortController: AbortController | null = null;

interface NoteScannerState {
  images: ScannedImageItem[];
  selectedId: string | null;
  engineMode: OcrEngineMode;
  offlineSubMode: OcrMode;
  offlineTier: OcrQualityTier;
  formatMode: NoteScanMode;
  extractedTitle: string;
  extractedSubject: string;
  extractedText: string;
  keyTerms: string[];
  viewMode: 'preview' | 'raw';
  isScanning: boolean;
  scanProgress: ScanProgressState | null;
  scanError: string | null;
  savedNotice: boolean;

  setSelectedId: (id: string | null) => void;
  setEngineMode: (mode: OcrEngineMode) => void;
  setOfflineSubMode: (mode: OcrMode) => void;
  setOfflineTier: (tier: OcrQualityTier) => void;
  setFormatMode: (mode: NoteScanMode) => void;
  setExtractedTitle: (title: string) => void;
  setExtractedSubject: (subject: string) => void;
  setExtractedText: (text: string) => void;
  setViewMode: (mode: 'preview' | 'raw') => void;
  setSavedNotice: (saved: boolean) => void;
  addPreparedImages: (items: ScannedImageItem[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  cancelScan: () => void;
  scanSingleImage: (itemId: string, append?: boolean) => Promise<void>;
  scanAllPages: () => Promise<void>;
}

export const useNoteScannerStore = create<NoteScannerState>((set, get) => ({
  images: [],
  selectedId: null,
  engineMode: getOcrEngineMode(),
  offlineSubMode: getOcrMode(),
  offlineTier: getOcrQualityTier(),
  formatMode: 'markdown',
  extractedTitle: '',
  extractedSubject: '',
  extractedText: '',
  keyTerms: [],
  viewMode: 'preview',
  isScanning: false,
  scanProgress: null,
  scanError: null,
  savedNotice: false,

  setSelectedId: (id) => set({ selectedId: id }),

  setEngineMode: (mode) => {
    setOcrEngineMode(mode);
    set({ engineMode: mode });
  },

  setOfflineSubMode: (mode) => {
    setOcrMode(mode);
    set({ offlineSubMode: mode });
  },

  setOfflineTier: (tier) => {
    setOcrQualityTier(tier);
    set({ offlineTier: tier });
  },

  setFormatMode: (formatMode) => set({ formatMode }),
  setExtractedTitle: (extractedTitle) => set({ extractedTitle }),
  setExtractedSubject: (extractedSubject) => set({ extractedSubject }),
  setExtractedText: (extractedText) => set({ extractedText }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSavedNotice: (savedNotice) => set({ savedNotice }),

  addPreparedImages: (items) => {
    if (items.length === 0) return;
    set((state) => ({
      images: [...state.images, ...items],
      selectedId: state.selectedId || items[0].id,
      scanError: null,
    }));
  },

  removeImage: (id) => {
    set((state) => {
      const next = state.images.filter((img) => img.id !== id);
      const nextSelected = state.selectedId === id ? next[0]?.id || null : state.selectedId;
      return { images: next, selectedId: nextSelected };
    });
  },

  clearImages: () => {
    set({ images: [], selectedId: null, scanError: null });
  },

  cancelScan: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set((state) => ({
      isScanning: false,
      scanProgress: null,
      images: state.images.map((img) =>
        img.status === 'scanning' ? { ...img, status: 'ready' } : img
      ),
    }));
  },

  scanSingleImage: async (itemId, append = false) => {
    const state = get();
    const item = state.images.find((i) => i.id === itemId);
    if (!item || state.isScanning) return;

    const controller = new AbortController();
    activeAbortController = controller;

    const initialProg: ScanProgressState = {
      percent: 5,
      label:
        state.engineMode === 'offline'
          ? t('scanner_prog_preparing_offline')
          : t('scanner_prog_sending_online'),
    };

    set((s) => ({
      isScanning: true,
      scanError: null,
      savedNotice: false,
      scanProgress: initialProg,
      images: s.images.map((img) =>
        img.id === item.id ? { ...img, status: 'scanning', error: undefined } : img
      ),
    }));

    const jobs = useAiJobsStore.getState();
    jobs.startJob({
      id: OCR_JOB_ID,
      kind: 'ocr',
      title: t('scanner_title'),
      label: initialProg.label,
      percent: initialProg.percent,
      targetTab: 'note-scanner',
      cancel: () => get().cancelScan(),
    });

    try {
      let resultTitle = '';
      let resultSubject = '';
      let resultText = '';
      let resultTerms: string[] = [];

      if (state.engineMode === 'offline') {
        const blob = base64ToBlob(item.base64, item.mimeType);
        const res = await runLocalOcrScan({
          imageBlob: blob,
          mode: state.offlineSubMode,
          tier: state.offlineTier,
          signal: controller.signal,
          onProgress: (p) => {
            const info = formatOfflineProgressDetail(p);
            const prog: ScanProgressState = {
              percent: p.percent,
              label: info.label,
              detail: info.detail,
              currentItem: info.currentItem,
              totalItems: info.totalItems,
            };
            set({ scanProgress: prog });
            useAiJobsStore.getState().updateJob(OCR_JOB_ID, prog);
          },
        });
        resultTitle = item.name.replace(/\.[^.]+$/, '') || t('scanner_default_title');
        resultSubject = t('dochub_subject_general');
        resultText = res.markdown || '';
        if (!resultText.trim()) {
          throw new Error(t('scanner_err_empty'));
        }
      } else {
        set({
          scanProgress: {
            percent: 35,
            label: t('scanner_prog_sending_online'),
            detail: item.name,
          },
        });
        useAiJobsStore.getState().updateJob(OCR_JOB_ID, {
          percent: 35,
          label: t('scanner_prog_sending_online'),
          detail: item.name,
        });
        const res = await extractTextFromNoteImage({
          imageBase64: item.base64,
          mimeType: item.mimeType,
          formatMode: state.formatMode,
        });
        if (controller.signal.aborted) throw new Error('ABORTED');
        resultTitle = res.title;
        resultSubject = res.subject;
        resultText = res.text;
        resultTerms = res.keyTerms;
      }

      set((s) => ({
        images: s.images.map((img) => (img.id === item.id ? { ...img, status: 'done' } : img)),
        extractedText:
          append && s.extractedText.trim()
            ? `${s.extractedText.trim()}\n\n---\n\n${resultText}`
            : resultText,
        extractedTitle:
          append && s.extractedText.trim() ? s.extractedTitle : resultTitle,
        extractedSubject:
          append && s.extractedText.trim() ? s.extractedSubject : resultSubject,
        keyTerms:
          resultTerms.length > 0
            ? Array.from(new Set([...(append ? s.keyTerms : []), ...resultTerms])).slice(0, 12)
            : s.keyTerms,
        isScanning: false,
        scanProgress: null,
      }));
      useAiJobsStore.getState().completeJob(OCR_JOB_ID, {
        label: t('scanner_prog_done'),
        detail: resultTitle || t('scanner_default_title'),
      });
    } catch (err: any) {
      if (err?.message === 'ABORTED' || controller.signal.aborted) {
        set({ isScanning: false, scanProgress: null });
        return;
      }
      const msg = err?.message || t('scanner_err_failed');
      set((s) => ({
        isScanning: false,
        scanProgress: null,
        scanError: msg,
        images: s.images.map((img) =>
          img.id === item.id ? { ...img, status: 'error', error: msg } : img
        ),
      }));
      useAiJobsStore.getState().failJob(OCR_JOB_ID, msg);
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },

  scanAllPages: async () => {
    const state = get();
    if (state.images.length === 0 || state.isScanning) return;

    const controller = new AbortController();
    activeAbortController = controller;

    const total = state.images.length;
    set({
      isScanning: true,
      scanError: null,
      savedNotice: false,
      scanProgress: {
        percent: 2,
        label: t('scanner_prog_batch', { current: 1, total }),
        currentItem: 1,
        totalItems: total,
      },
    });

    useAiJobsStore.getState().startJob({
      id: OCR_JOB_ID,
      kind: 'ocr',
      title: t('scanner_title'),
      label: t('scanner_prog_batch', { current: 1, total }),
      percent: 2,
      currentItem: 1,
      totalItems: total,
      targetTab: 'note-scanner',
      cancel: () => get().cancelScan(),
    });

    let combinedText = '';
    let firstTitle = state.extractedTitle;
    let firstSubject = state.extractedSubject;
    const collectedTerms: string[] = [];

    try {
      for (let i = 0; i < total; i++) {
        if (controller.signal.aborted) throw new Error('ABORTED');
        const item = get().images[i];
        if (!item) continue;

        set((s) => ({
          selectedId: item.id,
          images: s.images.map((img) =>
            img.id === item.id ? { ...img, status: 'scanning', error: undefined } : img
          ),
        }));

        const basePct = (i / total) * 100;
        const sliceSpan = 100 / total;

        if (get().engineMode === 'offline') {
          const blob = base64ToBlob(item.base64, item.mimeType);
          const res = await runLocalOcrScan({
            imageBlob: blob,
            mode: get().offlineSubMode,
            tier: get().offlineTier,
            signal: controller.signal,
            onProgress: (p) => {
              const info = formatOfflineProgressDetail(p);
              const overall = Math.round(basePct + (p.percent / 100) * sliceSpan);
              const prog: ScanProgressState = {
                percent: overall,
                label: t('scanner_prog_batch', { current: i + 1, total }),
                detail: info.detail ? `${info.label} · ${info.detail}` : info.label,
                currentItem: i + 1,
                totalItems: total,
              };
              set({ scanProgress: prog });
              useAiJobsStore.getState().updateJob(OCR_JOB_ID, prog);
            },
          });
          if (!firstTitle) {
            firstTitle = item.name.replace(/\.[^.]+$/, '') || t('scanner_default_title');
          }
          if (!firstSubject) firstSubject = t('dochub_subject_general');
          if (res.markdown.trim()) {
            combinedText = combinedText ? `${combinedText}\n\n---\n\n${res.markdown}` : res.markdown;
          }
        } else {
          const onlinePct = Math.round(basePct + sliceSpan * 0.35);
          const prog: ScanProgressState = {
            percent: onlinePct,
            label: t('scanner_prog_batch', { current: i + 1, total }),
            detail: item.name,
            currentItem: i + 1,
            totalItems: total,
          };
          set({ scanProgress: prog });
          useAiJobsStore.getState().updateJob(OCR_JOB_ID, prog);

          const res = await extractTextFromNoteImage({
            imageBase64: item.base64,
            mimeType: item.mimeType,
            formatMode: get().formatMode,
          });
          if (controller.signal.aborted) throw new Error('ABORTED');
          if (!firstTitle) firstTitle = res.title;
          if (!firstSubject) firstSubject = res.subject;
          combinedText = combinedText ? `${combinedText}\n\n---\n\n${res.text}` : res.text;
          collectedTerms.push(...res.keyTerms);
        }

        const donePct = Math.round(((i + 1) / total) * 100);
        set((s) => ({
          images: s.images.map((img) => (img.id === item.id ? { ...img, status: 'done' } : img)),
          scanProgress: {
            percent: donePct,
            label: t('scanner_prog_batch', { current: i + 1, total }),
            currentItem: i + 1,
            totalItems: total,
          },
        }));
        useAiJobsStore.getState().updateJob(OCR_JOB_ID, { percent: donePct });
      }

      if (combinedText) {
        set({
          extractedTitle: firstTitle || t('scanner_default_title'),
          extractedSubject: firstSubject || t('dochub_subject_general'),
          extractedText: combinedText,
          keyTerms: Array.from(new Set(collectedTerms)).slice(0, 12),
        });
      }
      set({ isScanning: false, scanProgress: null });
      useAiJobsStore.getState().completeJob(OCR_JOB_ID, {
        label: t('scanner_prog_done'),
        detail: `${total} ${t('scanner_pages_done')}`,
      });
    } catch (err: any) {
      if (err?.message === 'ABORTED' || controller.signal.aborted) {
        set({ isScanning: false, scanProgress: null });
        return;
      }
      const msg = err?.message || t('scanner_err_failed');
      set({ isScanning: false, scanProgress: null, scanError: msg });
      useAiJobsStore.getState().failJob(OCR_JOB_ID, msg);
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },
}));
