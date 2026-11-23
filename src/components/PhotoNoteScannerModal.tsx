import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Crop,
  FilePlus2,
  Image as ImageIcon,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Square,
  Upload,
  X,
} from 'lucide-react';
import {
  getOcrMode,
  setOcrMode as persistOcrMode,
  type OcrMode,
} from '../services/localAiConfig';
import {
  scanImageToNoteMarkdown,
  type NormalizedCropRect,
  type OcrScanProgress,
} from '../services/noteOcr';
import { useT } from '../services/i18n';

interface PhotoNoteScannerModalProps {
  isOpen: boolean;
  initialFile?: File | Blob | null;
  onClose: () => void;
  onInsertIntoNote: (markdown: string) => void;
  onCreateNewNote: (markdown: string) => void;
}

export const PhotoNoteScannerModal: React.FC<PhotoNoteScannerModalProps> = ({
  isOpen,
  initialFile = null,
  onClose,
  onInsertIntoNote,
  onCreateNewNote,
}) => {
  const { t } = useT();
  const [ocrMode, setOcrMode] = useState<OcrMode>(getOcrMode);
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<NormalizedCropRect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<OcrScanProgress | null>(null);
  const [markdownResult, setMarkdownResult] = useState('');
  const [lineCount, setLineCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    persistOcrMode(ocrMode);
  }, [ocrMode]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialFile) {
      setImageFile(initialFile);
      setCropRect(null);
      setMarkdownResult('');
      setLineCount(null);
      setErrorMsg(null);
    }
  }, [isOpen, initialFile]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isScanning) {
        onClose();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleSelectImage(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [isOpen, isScanning, onClose]);

  if (!isOpen) return null;

  const handleSelectImage = (file: Blob) => {
    setImageFile(file);
    setCropRect(null);
    setCropMode(false);
    setMarkdownResult('');
    setLineCount(null);
    setErrorMsg(null);
  };

  const getRelativePos = (clientX: number, clientY: number) => {
    const el = previewContainerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width))),
      y: Math.min(1, Math.max(0, (clientY - r.top) / Math.max(1, r.height))),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropMode || isScanning) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getRelativePos(e.clientX, e.clientY);
    setDragStart(pos);
    setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropMode || !dragStart) return;
    const pos = getRelativePos(e.clientX, e.clientY);
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const width = Math.abs(pos.x - dragStart.x);
    const height = Math.abs(pos.y - dragStart.y);
    setCropRect({ x, y, width, height });
  };

  const handlePointerUp = () => {
    if (!dragStart) return;
    setDragStart(null);
    if (cropRect && (cropRect.width < 0.04 || cropRect.height < 0.04)) {
      setCropRect(null);
    }
  };

  const handleStartScan = async () => {
    if (!imageFile || isScanning) return;
    setIsScanning(true);
    setErrorMsg(null);
    setProgress({ stage: 'downloading', percent: 0 });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const validCrop =
        cropRect && cropRect.width >= 0.04 && cropRect.height >= 0.04 ? cropRect : undefined;
      const result = await scanImageToNoteMarkdown(imageFile, {
        mode: ocrMode,
        cropRect: validCrop,
        signal: ac.signal,
        onProgress: (p) => setProgress(p),
      });
      setMarkdownResult(result.markdown || t('ocr_empty_result'));
      setLineCount(result.lineCount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'ABORTED') {
        setErrorMsg(t('ocr_error_msg', { detail: msg }));
      }
    } finally {
      abortRef.current = null;
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleCancelScan = () => {
    abortRef.current?.abort();
  };

  const modeCards: { id: OcrMode; title: string; desc: string }[] = [
    {
      id: 'printed',
      title: t('ocr_mode_printed_t'),
      desc: t('ocr_mode_printed_d'),
    },
    {
      id: 'handwritten-vi',
      title: t('ocr_mode_vi_t'),
      desc: t('ocr_mode_vi_d'),
    },
    {
      id: 'handwritten-en',
      title: t('ocr_mode_en_t'),
      desc: t('ocr_mode_en_d'),
    },
  ];

  const progressText =
    progress?.stage === 'reading'
      ? t('ocr_progress_reading', {
          completed: progress.completed ?? 0,
          total: progress.lineTotal ?? 1,
        })
      : t('ocr_progress_downloading', { percent: progress?.percent ?? 0 });

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 isolate"
      role="dialog"
      aria-modal="true"
      aria-label={t('ocr_modal_title')}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isScanning) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-2xl">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
              <ScanText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold truncate">{t('ocr_modal_title')}</h2>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">{t('ocr_modal_sub')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            aria-label={t('common_close')}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Privacy & One-time Download Note */}
          <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--accent-soft)]/70 border border-[var(--accent-border)] text-xs text-[var(--accent-text)]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('ocr_privacy_note')}</span>
          </div>

          {/* 3 Student-Friendly Modes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label={t('ocr_mode_group_aria')}>
            {modeCards.map((card) => {
              const active = ocrMode === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={isScanning}
                  onClick={() => setOcrMode(card.id)}
                  role="radio"
                  aria-checked={active}
                  className={`text-left p-3 rounded-2xl border transition-colors cursor-pointer disabled:opacity-60 ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-fill)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{card.title}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug">{card.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Upload / Drop / Camera Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSelectImage(f);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSelectImage(f);
              e.target.value = '';
            }}
          />

          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.type.startsWith('image/')) handleSelectImage(f);
              }}
              className="rounded-2xl border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 text-center space-y-3"
            >
              <ImageIcon className="w-8 h-8 mx-auto text-[var(--text-muted)]" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-[var(--text-primary)]">{t('ocr_drop_title')}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">{t('ocr_drop_sub')}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('ocr_btn_upload')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t('ocr_btn_camera')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => setCropMode((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                      cropMode
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-fill)] text-[var(--accent-text)]'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>{cropMode ? t('ocr_crop_active') : t('ocr_btn_select_area')}</span>
                  </button>
                  {cropRect && (
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => setCropRect(null)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      {t('ocr_btn_reset_area')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    {t('ocr_btn_change_photo')}
                  </button>
                </div>

                {isScanning ? (
                  <button
                    type="button"
                    onClick={handleCancelScan}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>{t('common_cancel')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartScan}
                    className="px-4 py-1.5 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ScanText className="w-3.5 h-3.5" />
                    <span>{t('ocr_btn_scan_now')}</span>
                  </button>
                )}
              </div>

              {/* Image Preview + Optional Crop Overlay */}
              <div className="flex justify-center rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] p-2 overflow-hidden">
                <div
                  ref={previewContainerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`relative inline-block max-h-64 select-none ${cropMode ? 'cursor-crosshair touch-none' : ''}`}
                >
                  <img
                    src={previewUrl}
                    alt={t('ocr_preview_alt')}
                    draggable={false}
                    className="max-h-64 w-auto rounded-xl object-contain block"
                  />
                  {cropRect && cropRect.width > 0.01 && cropRect.height > 0.01 && (
                    <div
                      className="absolute border-2 border-[var(--accent-fill)] bg-[var(--accent-fill)]/15 pointer-events-none rounded-sm"
                      style={{
                        left: `${cropRect.x * 100}%`,
                        top: `${cropRect.y * 100}%`,
                        width: `${cropRect.width * 100}%`,
                        height: `${cropRect.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Progress Bar */}
          {isScanning && progress && (
            <div className="p-3 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                  <span>{progressText}</span>
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">{progress.percent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden border border-[var(--border-hairline)]">
                <div
                  className="h-full bg-[var(--accent-fill)] transition-all duration-200"
                  style={{ width: `${Math.max(4, progress.percent)}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-xs text-[var(--status-err-text)]">
              {errorMsg}
            </div>
          )}

          {/* Editable Markdown Result */}
          {(markdownResult || lineCount !== null) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {t('ocr_result_label', { count: lineCount ?? 0 })}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">{t('ocr_result_edit_hint')}</span>
              </div>
              <textarea
                value={markdownResult}
                onChange={(e) => setMarkdownResult(e.target.value)}
                rows={7}
                className="w-full p-3.5 text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)] leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            className="px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-xs font-semibold cursor-pointer disabled:opacity-40"
          >
            {t('common_close')}
          </button>
          {markdownResult.trim() && (
            <>
              <button
                type="button"
                onClick={() => {
                  onInsertIntoNote(markdownResult);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('ocr_btn_insert_note')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateNewNote(markdownResult);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>{t('ocr_btn_new_note')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
