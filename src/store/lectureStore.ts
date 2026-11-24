import { create } from 'zustand';
import { db, type LectureRecord, type LectureSegment } from '../services/db';
import {
  getLectureMode,
  setLectureMode,
  type LectureTranscriptionMode,
} from '../services/localAiConfig';
import {
  loadAllLecturesFromDb,
  loadLectureSegmentsFromDb,
  postSummarizeLecture,
  postTranscribeAudioChunk,
  prepareLectureChunks,
  type LectureSummaryPayload,
} from '../services/lectureAudio';
import { formatMmSs, type OfflineAudioClip, type OnlineAudioChunk } from '../utils/audioChunking';
import { t } from '../services/i18n';
import { useAiJobsStore } from './aiJobsStore';

export type LectureLanguage = 'auto' | 'vi' | 'en';

export interface LectureProgressState {
  percent: number;
  label: string;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
}

export type OfflineAsrRunner = (params: {
  lectureId: string;
  mode: 'offline-tiny' | 'offline-base';
  language: LectureLanguage;
  clips: OfflineAudioClip[];
  signal: AbortSignal;
  onClipDone: (segment: LectureSegment, completed: number, total: number) => Promise<void>;
  onProgress: (p: { percent: number; label: string; detail?: string; currentItem?: number; totalItems?: number }) => void;
}) => Promise<void>;

let offlineAsrRunner: OfflineAsrRunner | null = null;

export function registerOfflineAsrRunner(runner: OfflineAsrRunner): void {
  offlineAsrRunner = runner;
}

const LECTURE_JOB_ID = 'lecture-studio-job';

// Ephemeral in-memory chunk cache for pause/resume within the same browser session.
const sessionOnlineChunks = new Map<string, OnlineAudioChunk[]>();
const sessionOfflineClips = new Map<string, OfflineAudioClip[]>();
const sessionAudioUrls = new Map<string, string>();
let activeLectureController: AbortController | null = null;

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('ABORTED'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('ABORTED'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function buildLectureNotesMarkdown(
  lecture: LectureRecord,
  segments: LectureSegment[]
): string {
  const parts: string[] = [`# ${lecture.title}`];
  if (lecture.summaryMarkdown?.trim()) {
    parts.push(lecture.summaryMarkdown.trim());
  }
  if (lecture.outlineJson) {
    try {
      const outline = JSON.parse(lecture.outlineJson) as LectureSummaryPayload['outline'];
      if (Array.isArray(outline) && outline.length > 0) {
        const outlineMd = outline
          .map(
            (sec) =>
              `### [${formatMmSs(sec.timestampSec)}] ${sec.heading}\n${(sec.bullets || [])
                .map((b) => `- ${b}`)
                .join('\n')}`
          )
          .join('\n\n');
        parts.push(`## Study Outline\n\n${outlineMd}`);
      }
    } catch {}
  }
  if (segments.length > 0) {
    const transcriptMd = segments
      .map((s) => `- **[${formatMmSs(s.startSec)}]** ${s.text}`)
      .join('\n');
    parts.push(`## Transcript\n\n${transcriptMd}`);
  }
  return parts.join('\n\n');
}

interface LectureStoreState {
  lectures: LectureRecord[];
  activeLectureId: string | null;
  segmentsByLecture: Record<string, LectureSegment[]>;
  mode: LectureTranscriptionMode;
  language: LectureLanguage;
  isProcessing: boolean;
  progress: LectureProgressState | null;
  error: string | null;

  hydrateLectures: () => Promise<void>;
  selectLecture: (id: string) => Promise<void>;
  setMode: (mode: LectureTranscriptionMode) => void;
  setLanguage: (lang: LectureLanguage) => void;
  getAudioUrl: (lectureId: string) => string | null;
  canResumeInSession: (lectureId: string) => boolean;
  cancelActiveJob: () => void;
  startLectureFile: (params: {
    file: File;
    title: string;
    subject?: string;
  }) => Promise<void>;
  resumeLecture: (lectureId: string) => Promise<void>;
  summarizeLecture: (lectureId: string) => Promise<void>;
  deleteLecture: (lectureId: string) => Promise<void>;
}

export const useLectureStore = create<LectureStoreState>((set, get) => ({
  lectures: [],
  activeLectureId: null,
  segmentsByLecture: {},
  mode: getLectureMode(),
  language: 'auto',
  isProcessing: false,
  progress: null,
  error: null,

  hydrateLectures: async () => {
    const list = await loadAllLecturesFromDb();
    const currentActive = get().activeLectureId;
    const nextActive = currentActive && list.some((l) => l.id === currentActive)
      ? currentActive
      : list[0]?.id || null;
    set({ lectures: list, activeLectureId: nextActive });
    if (nextActive) {
      const segs = await loadLectureSegmentsFromDb(nextActive);
      set((s) => ({
        segmentsByLecture: { ...s.segmentsByLecture, [nextActive]: segs },
      }));
    }
  },

  selectLecture: async (id) => {
    set({ activeLectureId: id, error: null });
    const segs = await loadLectureSegmentsFromDb(id);
    set((s) => ({
      segmentsByLecture: { ...s.segmentsByLecture, [id]: segs },
    }));
  },

  setMode: (mode) => {
    setLectureMode(mode);
    set({ mode });
  },

  setLanguage: (language) => set({ language }),

  getAudioUrl: (lectureId) => sessionAudioUrls.get(lectureId) || null,

  canResumeInSession: (lectureId) => {
    const lec = get().lectures.find((l) => l.id === lectureId);
    if (!lec) return false;
    if (lec.completedChunks >= lec.totalChunks && lec.totalChunks > 0) return false;
    return sessionOnlineChunks.has(lectureId) || sessionOfflineClips.has(lectureId);
  },

  cancelActiveJob: () => {
    if (activeLectureController) {
      activeLectureController.abort();
      activeLectureController = null;
    }
    const activeId = get().activeLectureId;
    if (activeId) {
      const now = new Date().toISOString();
      db.lectures.update(activeId, { status: 'paused', updatedAt: now }).catch(() => {});
      set((s) => ({
        isProcessing: false,
        progress: null,
        lectures: s.lectures.map((l) =>
          l.id === activeId && l.status !== 'done'
            ? { ...l, status: 'paused', updatedAt: now }
            : l
        ),
      }));
    } else {
      set({ isProcessing: false, progress: null });
    }
  },

  startLectureFile: async ({ file, title, subject }) => {
    if (get().isProcessing) return;
    const mode = get().mode;
    const language = get().language;

    if (mode !== 'online' && !offlineAsrRunner) {
      set({ error: t('lecture_err_offline_unavailable') });
      return;
    }

    const controller = new AbortController();
    activeLectureController = controller;

    const lectureId = `lec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const cleanTitle = title.trim() || file.name.replace(/\.[^.]+$/, '') || t('lecture_default_title');

    try {
      const audioUrl = URL.createObjectURL(file);
      sessionAudioUrls.set(lectureId, audioUrl);
    } catch {}

    const record: LectureRecord = {
      id: lectureId,
      title: cleanTitle,
      subject: subject?.trim() || undefined,
      language,
      mode,
      status: 'vad',
      originalDurationSec: 0,
      speechDurationSec: 0,
      totalChunks: 0,
      completedChunks: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.lectures.put(record).catch(() => {});
    set((s) => ({
      lectures: [record, ...s.lectures],
      activeLectureId: lectureId,
      segmentsByLecture: { ...s.segmentsByLecture, [lectureId]: [] },
      isProcessing: true,
      error: null,
      progress: {
        percent: 2,
        label: t('lecture_prog_decoding'),
        detail: cleanTitle,
      },
    }));

    useAiJobsStore.getState().startJob({
      id: LECTURE_JOB_ID,
      kind: 'lecture',
      title: cleanTitle,
      label: t('lecture_prog_decoding'),
      percent: 2,
      targetTab: 'lecture-studio',
      cancel: () => get().cancelActiveJob(),
    });

    try {
      const prepared = await prepareLectureChunks({
        file,
        mode,
        signal: controller.signal,
        onVadProgress: (pct, stage) => {
          const label =
            stage === 'downloading'
              ? t('lecture_prog_vad_download')
              : t('lecture_prog_vad_scan');
          const prog = { percent: pct, label, detail: cleanTitle };
          set({ progress: prog });
          useAiJobsStore.getState().updateJob(LECTURE_JOB_ID, prog);
        },
      });

      if (controller.signal.aborted) throw new Error('ABORTED');

      const totalChunks =
        mode === 'online' ? prepared.onlineChunks.length : prepared.offlineClips.length;

      if (mode === 'online') {
        sessionOnlineChunks.set(lectureId, prepared.onlineChunks);
      } else {
        sessionOfflineClips.set(lectureId, prepared.offlineClips);
      }

      const updatedAt = new Date().toISOString();
      await db.lectures
        .update(lectureId, {
          status: 'transcribing',
          originalDurationSec: prepared.originalDurationSec,
          speechDurationSec: prepared.speechDurationSec,
          totalChunks,
          updatedAt,
        })
        .catch(() => {});

      set((s) => ({
        lectures: s.lectures.map((l) =>
          l.id === lectureId
            ? {
                ...l,
                status: 'transcribing',
                originalDurationSec: prepared.originalDurationSec,
                speechDurationSec: prepared.speechDurationSec,
                totalChunks,
                updatedAt,
              }
            : l
        ),
      }));

      await runTranscriptionFromChunk(lectureId, 0, controller, set, get);
    } catch (err: any) {
      if (err?.message === 'ABORTED' || controller.signal.aborted) {
        return;
      }
      const msg = err?.message || t('lecture_err_generic');
      const errAt = new Date().toISOString();
      await db.lectures.update(lectureId, { status: 'error', error: msg, updatedAt: errAt }).catch(() => {});
      set((s) => ({
        isProcessing: false,
        progress: null,
        error: msg,
        lectures: s.lectures.map((l) =>
          l.id === lectureId ? { ...l, status: 'error', error: msg, updatedAt: errAt } : l
        ),
      }));
      useAiJobsStore.getState().failJob(LECTURE_JOB_ID, msg);
    } finally {
      if (activeLectureController === controller) {
        activeLectureController = null;
      }
    }
  },

  resumeLecture: async (lectureId) => {
    if (get().isProcessing) return;
    const lec = get().lectures.find((l) => l.id === lectureId);
    if (!lec) return;

    const controller = new AbortController();
    activeLectureController = controller;

    set({ isProcessing: true, error: null, activeLectureId: lectureId });
    useAiJobsStore.getState().startJob({
      id: LECTURE_JOB_ID,
      kind: 'lecture',
      title: lec.title,
      label: t('lecture_prog_resuming'),
      percent: Math.max(15, Math.round((lec.completedChunks / Math.max(1, lec.totalChunks)) * 85)),
      targetTab: 'lecture-studio',
      cancel: () => get().cancelActiveJob(),
    });

    try {
      await runTranscriptionFromChunk(lectureId, lec.completedChunks, controller, set, get);
    } catch (err: any) {
      if (err?.message === 'ABORTED' || controller.signal.aborted) return;
      const msg = err?.message || t('lecture_err_generic');
      const errAt = new Date().toISOString();
      await db.lectures.update(lectureId, { status: 'error', error: msg, updatedAt: errAt }).catch(() => {});
      set((s) => ({
        isProcessing: false,
        progress: null,
        error: msg,
        lectures: s.lectures.map((l) =>
          l.id === lectureId ? { ...l, status: 'error', error: msg, updatedAt: errAt } : l
        ),
      }));
      useAiJobsStore.getState().failJob(LECTURE_JOB_ID, msg);
    } finally {
      if (activeLectureController === controller) {
        activeLectureController = null;
      }
    }
  },

  summarizeLecture: async (lectureId) => {
    if (get().isProcessing) return;
    const lec = get().lectures.find((l) => l.id === lectureId);
    if (!lec) return;

    const segs =
      get().segmentsByLecture[lectureId] || (await loadLectureSegmentsFromDb(lectureId));
    if (segs.length === 0) {
      set({ error: t('lecture_err_no_transcript') });
      return;
    }

    const controller = new AbortController();
    activeLectureController = controller;

    set({
      isProcessing: true,
      error: null,
      progress: {
        percent: 88,
        label: t('lecture_prog_summarizing'),
        detail: lec.title,
      },
    });
    useAiJobsStore.getState().startJob({
      id: LECTURE_JOB_ID,
      kind: 'lecture',
      title: lec.title,
      label: t('lecture_prog_summarizing'),
      percent: 88,
      targetTab: 'lecture-studio',
      cancel: () => get().cancelActiveJob(),
    });

    try {
      await runSummaryStep(lectureId, lec, segs, controller.signal, set);
      useAiJobsStore.getState().completeJob(LECTURE_JOB_ID, {
        label: t('lecture_prog_done'),
        detail: lec.title,
      });
    } catch (err: any) {
      if (err?.message === 'ABORTED' || controller.signal.aborted) return;
      const msg = err?.message || t('lecture_err_generic');
      set({ isProcessing: false, progress: null, error: msg });
      useAiJobsStore.getState().failJob(LECTURE_JOB_ID, msg);
    } finally {
      if (activeLectureController === controller) {
        activeLectureController = null;
      }
    }
  },

  deleteLecture: async (lectureId) => {
    sessionOnlineChunks.delete(lectureId);
    sessionOfflineClips.delete(lectureId);
    const url = sessionAudioUrls.get(lectureId);
    if (url) {
      try { URL.revokeObjectURL(url); } catch {}
      sessionAudioUrls.delete(lectureId);
    }
    await db.lectureSegments.where('lectureId').equals(lectureId).delete().catch(() => {});
    await db.lectures.delete(lectureId).catch(() => {});
    set((s) => {
      const nextLectures = s.lectures.filter((l) => l.id !== lectureId);
      const nextSegs = { ...s.segmentsByLecture };
      delete nextSegs[lectureId];
      const nextActive =
        s.activeLectureId === lectureId ? nextLectures[0]?.id || null : s.activeLectureId;
      return {
        lectures: nextLectures,
        segmentsByLecture: nextSegs,
        activeLectureId: nextActive,
      };
    });
  },
}));

async function runSummaryStep(
  lectureId: string,
  lec: LectureRecord,
  segments: LectureSegment[],
  signal: AbortSignal,
  set: (fn: (s: LectureStoreState) => Partial<LectureStoreState>) => void
) {
  const bullets = segments.flatMap((s) => s.chunkBullets || []);
  const terms = Array.from(
    new Set([...(lec.keyTerms || []), ...segments.flatMap((s) => s.keyTerms || [])])
  );
  const transcriptExcerpt =
    bullets.length < 3
      ? segments.map((s) => `[${formatMmSs(s.startSec)}] ${s.text}`).join('\n')
      : segments
          .slice(0, 12)
          .map((s) => `[${formatMmSs(s.startSec)}] ${s.text}`)
          .join('\n');

  const summary = await postSummarizeLecture({
    title: lec.title,
    language: lec.language,
    totalDurationSec: lec.originalDurationSec || lec.speechDurationSec,
    chunkBullets: bullets,
    keyTerms: terms,
    transcriptExcerpt,
    signal,
  });

  const allTerms = Array.from(
    new Set([
      ...terms,
      ...summary.vocabulary.map((v) => v.term),
    ])
  ).slice(0, 24);

  const now = new Date().toISOString();
  const patch: Partial<LectureRecord> = {
    status: 'done',
    summaryMarkdown: summary.executiveSummary,
    outlineJson: JSON.stringify(summary.outline),
    keyTerms: allTerms,
    flashcardsJson: JSON.stringify(summary.flashcards),
    updatedAt: now,
  };
  await db.lectures.update(lectureId, patch).catch(() => {});

  set((s) => ({
    isProcessing: false,
    progress: null,
    lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, ...patch } : l)),
  }));
}

async function runTranscriptionFromChunk(
  lectureId: string,
  startChunkIndex: number,
  controller: AbortController,
  set: (fn: (s: LectureStoreState) => Partial<LectureStoreState>) => void,
  get: () => LectureStoreState
) {
  const lec = get().lectures.find((l) => l.id === lectureId);
  if (!lec) return;

  if (lec.mode !== 'online') {
    if (!offlineAsrRunner) throw new Error(t('lecture_err_offline_unavailable'));
    const clips = sessionOfflineClips.get(lectureId) || [];
    const remaining = clips.slice(startChunkIndex);
    if (remaining.length === 0) throw new Error(t('lecture_err_resume_expired'));

    await offlineAsrRunner({
      lectureId,
      mode: lec.mode,
      language: lec.language,
      clips: remaining,
      signal: controller.signal,
      onProgress: (p) => {
        set(() => ({ progress: p }));
        useAiJobsStore.getState().updateJob(LECTURE_JOB_ID, p);
      },
      onClipDone: async (seg, completedCount, totalCount) => {
        await db.lectureSegments.put(seg).catch(() => {});
        const overallCompleted = startChunkIndex + completedCount;
        const now = new Date().toISOString();
        await db.lectures
          .update(lectureId, { completedChunks: overallCompleted, updatedAt: now })
          .catch(() => {});
        set((s) => ({
          lectures: s.lectures.map((l) =>
            l.id === lectureId
              ? { ...l, completedChunks: overallCompleted, updatedAt: now }
              : l
          ),
          segmentsByLecture: {
            ...s.segmentsByLecture,
            [lectureId]: [...(s.segmentsByLecture[lectureId] || []), seg].sort(
              (a, b) => a.chunkIndex - b.chunkIndex || a.startSec - b.startSec
            ),
          },
        }));
      },
    });

    if (controller.signal.aborted) return;
    sessionOfflineClips.delete(lectureId);
    const doneAt = new Date().toISOString();
    await db.lectures
      .update(lectureId, { status: 'done', updatedAt: doneAt })
      .catch(() => {});
    set((s) => ({
      isProcessing: false,
      progress: null,
      lectures: s.lectures.map((l) =>
        l.id === lectureId ? { ...l, status: 'done', updatedAt: doneAt } : l
      ),
    }));
    useAiJobsStore.getState().completeJob(LECTURE_JOB_ID, {
      label: t('lecture_prog_done_offline'),
      detail: lec.title,
    });
    return;
  }

  // Online mode (Default: Gemini Audio Models)
  const chunks = sessionOnlineChunks.get(lectureId) || [];
  if (chunks.length === 0) throw new Error(t('lecture_err_resume_expired'));

  const total = chunks.length;
  for (let i = startChunkIndex; i < total; i++) {
    if (controller.signal.aborted) throw new Error('ABORTED');
    const chunk = chunks[i];
    const pct = Math.round(15 + (i / Math.max(1, total)) * 70);
    const prog: LectureProgressState = {
      percent: pct,
      label: t('lecture_prog_chunk', { current: i + 1, total }),
      detail: `${formatMmSs(chunk.startSec)} – ${formatMmSs(chunk.endSec)}`,
      currentItem: i + 1,
      totalItems: total,
    };
    set(() => ({ progress: prog }));
    useAiJobsStore.getState().updateJob(LECTURE_JOB_ID, prog);

    const res = await postTranscribeAudioChunk({
      chunk,
      language: lec.language,
      signal: controller.signal,
    });

    if (controller.signal.aborted) throw new Error('ABORTED');

    const newSegments: LectureSegment[] = res.segments.map((seg, idx) => ({
      id: `${lectureId}-c${chunk.chunkIndex}-s${idx}`,
      lectureId,
      chunkIndex: chunk.chunkIndex,
      startSec: seg.startSec,
      endSec: seg.endSec,
      text: seg.text,
      chunkBullets: idx === 0 ? res.chunkBullets : undefined,
      keyTerms: idx === 0 ? res.keyTerms : undefined,
    }));

    if (newSegments.length > 0) {
      await db.lectureSegments.bulkPut(newSegments).catch(() => {});
    }

    const now = new Date().toISOString();
    const completedChunks = i + 1;
    const mergedTerms = Array.from(
      new Set([...(get().lectures.find((l) => l.id === lectureId)?.keyTerms || []), ...res.keyTerms])
    ).slice(0, 24);

    await db.lectures
      .update(lectureId, {
        completedChunks,
        keyTerms: mergedTerms,
        updatedAt: now,
      })
      .catch(() => {});

    set((s) => ({
      lectures: s.lectures.map((l) =>
        l.id === lectureId
          ? { ...l, completedChunks, keyTerms: mergedTerms, updatedAt: now }
          : l
      ),
      segmentsByLecture: {
        ...s.segmentsByLecture,
        [lectureId]: [...(s.segmentsByLecture[lectureId] || []), ...newSegments].sort(
          (a, b) => a.chunkIndex - b.chunkIndex || a.startSec - b.startSec
        ),
      },
    }));

    // Sequential pacing between chunks to stay 5x under free-tier Gemini TPM/RPM caps.
    if (i + 1 < total) {
      await sleepWithAbort(2200, controller.signal);
    }
  }

  // Drop audio chunks from RAM as soon as transcription finishes.
  sessionOnlineChunks.delete(lectureId);

  const updatedLec = get().lectures.find((l) => l.id === lectureId) || lec;
  const allSegs = get().segmentsByLecture[lectureId] || [];

  const sumProg: LectureProgressState = {
    percent: 88,
    label: t('lecture_prog_summarizing'),
    detail: updatedLec.title,
  };
  await db.lectures
    .update(lectureId, { status: 'summarizing', updatedAt: new Date().toISOString() })
    .catch(() => {});
  set(() => ({ progress: sumProg }));
  useAiJobsStore.getState().updateJob(LECTURE_JOB_ID, sumProg);

  await runSummaryStep(lectureId, updatedLec, allSegs, controller.signal, set);
  useAiJobsStore.getState().completeJob(LECTURE_JOB_ID, {
    label: t('lecture_prog_done'),
    detail: updatedLec.title,
  });
}
