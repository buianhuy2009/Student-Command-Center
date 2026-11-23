import React, { useState, useRef, useEffect } from 'react';
import {
  ScanText,
  Upload,
  Camera,
  Copy,
  Check,
  Download,
  FilePlus2,
  Trash2,
  Sparkles,
  Eye,
  Code2,
  AlertTriangle,
  ArrowRight,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { MathMarkdown } from '../MathMarkdown';
import {
  extractTextFromNoteImage,
  NoteScanMode,
} from '../../services/gemini';
import { MarkdownNote } from '../../types';
import { useT } from '../../services/i18n';

const LOCAL_NOTES_KEY = 'scc_markdown_notes_v1';

interface ScannedImageItem {
  id: string;
  name: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
  status: 'ready' | 'scanning' | 'done' | 'error';
  error?: string;
}

interface NoteScannerWorkspaceProps {
  onOpenNotes?: () => void;
}

/** Resize oversized camera photos client-side so OCR uploads stay fast and within server payload caps. */
async function prepareImageForOcr(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  if (file.size <= 1_400_000) {
    const [, b64 = ''] = rawDataUrl.split(',');
    return {
      dataUrl: rawDataUrl,
      base64: b64,
      mimeType: file.type || 'image/jpeg',
    };
  }

  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const [, b64 = ''] = rawDataUrl.split(',');
        resolve({ dataUrl: rawDataUrl, base64: b64, mimeType: file.type || 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.86);
      const [, b64 = ''] = compressed.split(',');
      resolve({ dataUrl: compressed, base64: b64, mimeType: 'image/jpeg' });
    };
    img.onerror = () => {
      const [, b64 = ''] = rawDataUrl.split(',');
      resolve({ dataUrl: rawDataUrl, base64: b64, mimeType: file.type || 'image/jpeg' });
    };
    img.src = rawDataUrl;
  });
}

export const NoteScannerWorkspace: React.FC<NoteScannerWorkspaceProps> = ({ onOpenNotes }) => {
  const { t, formatDate } = useT();
  const [images, setImages] = useState<ScannedImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formatMode, setFormatMode] = useState<NoteScanMode>('markdown');
  const [extractedTitle, setExtractedTitle] = useState('');
  const [extractedSubject, setExtractedSubject] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [keyTerms, setKeyTerms] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeImage = images.find((img) => img.id === selectedId) || images[0] || null;

  const addFiles = async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setScanError(null);
    const prepared: ScannedImageItem[] = [];
    for (const file of validFiles.slice(0, 8)) {
      try {
        const res = await prepareImageForOcr(file);
        prepared.push({
          id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name || t('scanner_pasted_image'),
          dataUrl: res.dataUrl,
          base64: res.base64,
          mimeType: res.mimeType,
          status: 'ready',
        });
      } catch {}
    }
    if (prepared.length > 0) {
      setImages((prev) => [...prev, ...prepared]);
      setSelectedId((prev) => prev || prepared[0].id);
    }
  };

  // Support Ctrl+V / Cmd+V screenshot or photo pasting right inside Note Scanner.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length > 0) {
        addFiles(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleScanImage = async (item: ScannedImageItem, append = false) => {
    if (!item || isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setSavedNotice(false);
    setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'scanning', error: undefined } : img)));

    try {
      const res = await extractTextFromNoteImage({
        imageBase64: item.base64,
        mimeType: item.mimeType,
        formatMode,
      });
      setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'done' } : img)));
      if (append && extractedText.trim()) {
        setExtractedText((prev) => `${prev.trim()}\n\n---\n\n${res.text}`);
      } else {
        setExtractedTitle(res.title);
        setExtractedSubject(res.subject);
        setExtractedText(res.text);
      }
      if (res.keyTerms.length > 0) {
        setKeyTerms((prev) => Array.from(new Set([...(append ? prev : []), ...res.keyTerms])).slice(0, 12));
      }
    } catch (err: any) {
      const msg = err?.message || t('scanner_err_failed');
      setScanError(msg);
      setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'error', error: msg } : img)));
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanAllPages = async () => {
    if (images.length === 0 || isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setSavedNotice(false);
    let combinedText = '';
    let firstTitle = extractedTitle;
    let firstSubject = extractedSubject;
    const collectedTerms: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      setSelectedId(item.id);
      setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'scanning', error: undefined } : img)));
      try {
        const res = await extractTextFromNoteImage({
          imageBase64: item.base64,
          mimeType: item.mimeType,
          formatMode,
        });
        if (!firstTitle) firstTitle = res.title;
        if (!firstSubject) firstSubject = res.subject;
        combinedText = combinedText ? `${combinedText}\n\n---\n\n${res.text}` : res.text;
        collectedTerms.push(...res.keyTerms);
        setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'done' } : img)));
      } catch (err: any) {
        const msg = err?.message || t('scanner_err_failed');
        setScanError(msg);
        setImages((prev) => prev.map((img) => (img.id === item.id ? { ...img, status: 'error', error: msg } : img)));
        break;
      }
    }

    if (combinedText) {
      setExtractedTitle(firstTitle || t('scanner_default_title'));
      setExtractedSubject(firstSubject || t('dochub_subject_general'));
      setExtractedText(combinedText);
      setKeyTerms(Array.from(new Set(collectedTerms)).slice(0, 12));
    }
    setIsScanning(false);
  };

  const handleCopyText = async () => {
    if (!extractedText.trim()) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadMd = () => {
    if (!extractedText.trim()) return;
    const title = extractedTitle.trim() || t('scanner_default_title');
    const blob = new Blob([`# ${title}\n\n${extractedText}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToNotes = () => {
    if (!extractedText.trim()) return;
    try {
      const raw = localStorage.getItem(LOCAL_NOTES_KEY);
      const existing: MarkdownNote[] = raw ? JSON.parse(raw) : [];
      const newNote: MarkdownNote = {
        id: `note-${Date.now()}`,
        title: extractedTitle.trim() || t('scanner_default_title'),
        subject: extractedSubject.trim() || t('dochub_subject_general'),
        content: extractedText,
        updatedAt: formatDate(new Date()),
      };
      localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify([newNote, ...existing]));
      setSavedNotice(true);
    } catch {}
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id || null);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5 border border-[var(--border-default)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ScanText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {t('scanner_title')}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('scanner_sub')}
            </p>
          </div>
        </div>

        {/* Extraction Mode Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
            {(
              [
                { id: 'markdown', label: t('scanner_mode_md') },
                { id: 'verbatim', label: t('scanner_mode_verbatim') },
                { id: 'summary', label: t('scanner_mode_summary') },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFormatMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  formatMode === m.id
                    ? 'bg-[var(--accent-fill)] text-white shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{t('scanner_add_photos')}</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
        {/* Left: Upload & Image Preview */}
        <div className="xl:col-span-5 min-w-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          {images.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`flex-1 min-h-[380px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-colors ${
                isDragging
                  ? 'border-[var(--accent-fill)] bg-[var(--accent-soft)]/50'
                  : 'border-[var(--border-default)] bg-[var(--bg-subtle)]/50 hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center mb-4">
                <Camera className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {t('scanner_drop_title')}
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1.5 leading-relaxed">
                {t('scanner_drop_sub')}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('scanner_choose_btn')}</span>
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-4">
                {t('scanner_paste_hint')}
              </p>
            </div>
          ) : (
            <>
              {/* Page Thumbnails Strip */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedId(img.id)}
                    className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
                      activeImage?.id === img.id
                        ? 'border-[var(--accent-fill)] shadow-xs'
                        : 'border-[var(--border-default)] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/65 text-white text-[9px] font-bold">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(img.id);
                      }}
                      aria-label={t('scanner_remove_page')}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/65 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Active Image Preview */}
              {activeImage && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                  className="relative rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] overflow-hidden flex items-center justify-center min-h-[300px] max-h-[460px]"
                >
                  <img
                    src={activeImage.dataUrl}
                    alt={activeImage.name}
                    className="max-h-[450px] w-auto object-contain"
                  />
                </div>
              )}

              {/* Scan Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setImages([]);
                    setSelectedId(null);
                    setScanError(null);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-rose-600 rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                >
                  {t('scanner_clear_photos')}
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {images.length > 1 && (
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={handleScanAllPages}
                      className="px-3.5 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>{t('scanner_scan_all', { count: images.length })}</span>
                    </button>
                  )}

                  {activeImage && (
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => handleScanImage(activeImage, Boolean(extractedText.trim() && images.length > 1))}
                      className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      {isScanning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanText className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isScanning
                          ? t('scanner_scanning')
                          : extractedText.trim() && images.length > 1
                            ? t('scanner_append_page')
                            : t('scanner_extract_btn')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {scanError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-xs text-[var(--status-err-text)] flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}
        </div>

        {/* Right: Extracted Text Editor / Rendered Markdown */}
        <div className="xl:col-span-7 min-w-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b border-[var(--border-default)]">
            <input
              type="text"
              value={extractedTitle}
              onChange={(e) => setExtractedTitle(e.target.value)}
              placeholder={t('scanner_title_ph')}
              className="flex-1 text-sm font-bold bg-transparent border-b border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent-fill)] focus:outline-none text-[var(--text-primary)] px-1 py-0.5 min-w-0"
            />
            <input
              type="text"
              value={extractedSubject}
              onChange={(e) => setExtractedSubject(e.target.value)}
              placeholder={t('scanner_subject_ph')}
              className="w-full sm:w-36 shrink-0 px-2.5 py-1 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
            />
            <div className="inline-flex items-center p-0.5 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-default)] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'preview' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-muted)]'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{t('scanner_view_formatted')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'raw' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-muted)]'
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span>{t('scanner_view_edit')}</span>
              </button>
            </div>
          </div>

          {keyTerms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
                {t('scanner_key_terms')}
              </span>
              {keyTerms.map((term, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/50"
                >
                  {term}
                </span>
              ))}
            </div>
          )}

          {!extractedText.trim() ? (
            <div className="flex-1 min-h-[340px] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
              <ImageIcon className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-xs font-medium max-w-sm leading-relaxed">
                {t('scanner_output_empty')}
              </p>
            </div>
          ) : viewMode === 'preview' ? (
            <div className="flex-1 min-h-[340px] max-h-[540px] p-5 bg-[var(--bg-subtle)]/50 border border-[var(--border-default)] rounded-2xl overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
              <MathMarkdown>{extractedText}</MathMarkdown>
            </div>
          ) : (
            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              className="flex-1 min-h-[340px] max-h-[540px] w-full p-4 text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)] resize-none leading-relaxed"
            />
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center gap-2">
              {savedNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--status-ok-text)]">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('scanner_saved_notes')}</span>
                  {onOpenNotes && (
                    <button
                      type="button"
                      onClick={onOpenNotes}
                      className="underline font-bold inline-flex items-center gap-0.5 ml-1 cursor-pointer"
                    >
                      <span>{t('scanner_open_notes')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!extractedText.trim()}
                onClick={handleCopyText}
                className="px-3 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('scanner_copy_btn')}</span>
              </button>

              <button
                type="button"
                disabled={!extractedText.trim()}
                onClick={handleDownloadMd}
                className="px-3 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('dochub_export_md')}</span>
              </button>

              <button
                type="button"
                disabled={!extractedText.trim()}
                onClick={handleSaveToNotes}
                className="px-4 py-2 text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>{t('scanner_save_notes_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
