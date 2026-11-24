import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Upload,
  Wifi,
  HardDrive,
  Sparkles,
  FilePlus2,
  Brain,
  Bot,
  Download,
  Trash2,
  Play,
  Clock,
  Check,
  AlertTriangle,
  Info,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { MathMarkdown } from '../MathMarkdown';
import { AiProgressBar } from '../ui/AiProgressBar';
import { db } from '../../services/db';
import { detectAudioFileDurationSec, type LectureSummaryPayload } from '../../services/lectureAudio';
import type { LectureTranscriptionMode } from '../../services/localAiConfig';
import { clearOfflineModels, getOfflineModelCacheStats } from '../../services/localMediaManager';
import { loadSRSDecks, saveSRSDecks, type SRSCard, type SRSDeck } from '../../services/srsEngine';
import { useCoachChatStore } from '../../store/coachChatStore';
import {
  buildLectureNotesMarkdown,
  useLectureStore,
  type LectureLanguage,
} from '../../store/lectureStore';
import { estimateLectureDuration, formatMmSs } from '../../utils/audioChunking';
import { useT } from '../../services/i18n';
import type { Assignment, CalendarEvent, EmailAlert, MarkdownNote } from '../../types';

const LOCAL_NOTES_KEY = 'scc_markdown_notes_v1';

interface LectureStudioWorkspaceProps {
  onOpenNotes?: () => void;
  onOpenFlashcards?: () => void;
  assignments?: Assignment[];
  events?: CalendarEvent[];
  alerts?: EmailAlert[];
}

export const LectureStudioWorkspace: React.FC<LectureStudioWorkspaceProps> = ({
  onOpenNotes,
  onOpenFlashcards,
  assignments = [],
  events = [],
  alerts = [],
}) => {
  const { t, formatDate } = useT();
  const {
    lectures,
    activeLectureId,
    segmentsByLecture,
    mode,
    language,
    isProcessing,
    progress,
    error,
    hydrateLectures,
    selectLecture,
    setMode,
    setLanguage,
    getAudioUrl,
    canResumeInSession,
    cancelActiveJob,
    startLectureFile,
    resumeLecture,
    summarizeLecture,
    deleteLecture,
  } = useLectureStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedDurationSec, setDetectedDurationSec] = useState<number | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transcript'>('summary');
  const [savedNotesNotice, setSavedNotesNotice] = useState(false);
  const [savedDeckNotice, setSavedDeckNotice] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ entryCount: number; approxMb: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    hydrateLectures();
  }, [hydrateLectures]);

  useEffect(() => {
    if (mode !== 'online') {
      getOfflineModelCacheStats()
        .then(setCacheStats)
        .catch(() => {});
    }
  }, [mode, isProcessing]);

  const activeLecture = useMemo(
    () => lectures.find((l) => l.id === activeLectureId) || null,
    [lectures, activeLectureId]
  );

  const activeSegments = useMemo(
    () => (activeLecture ? segmentsByLecture[activeLecture.id] || [] : []),
    [activeLecture, segmentsByLecture]
  );

  const parsedOutline = useMemo<LectureSummaryPayload['outline']>(() => {
    if (!activeLecture?.outlineJson) return [];
    try {
      const arr = JSON.parse(activeLecture.outlineJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [activeLecture?.outlineJson]);

  const parsedFlashcards = useMemo<LectureSummaryPayload['flashcards']>(() => {
    if (!activeLecture?.flashcardsJson) return [];
    try {
      const arr = JSON.parse(activeLecture.flashcardsJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [activeLecture?.flashcardsJson]);

  const sessionAudioUrl = activeLecture ? getAudioUrl(activeLecture.id) : null;

  const durationEstimate = useMemo(() => {
    const sampleSec = detectedDurationSec || 3600;
    return estimateLectureDuration({ audioDurationSec: sampleSec, mode });
  }, [detectedDurationSec, mode]);

  const handleFilePick = async (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setSavedNotesNotice(false);
    setSavedDeckNotice(false);
    if (!titleInput.trim()) {
      setTitleInput(file.name.replace(/\.[^.]+$/, ''));
    }
    const dur = await detectAudioFileDurationSec(file).catch(() => null);
    setDetectedDurationSec(dur);
  };

  const handleStart = async () => {
    if (!selectedFile || isProcessing) return;
    setSavedNotesNotice(false);
    setSavedDeckNotice(false);
    setActiveSubTab('transcript');
    await startLectureFile({
      file: selectedFile,
      title: titleInput,
      subject: subjectInput,
    });
  };

  const seekAudioTo = (sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.currentTime = Math.max(0, sec);
      el.play().catch(() => {});
    } catch {}
  };

  const handleSaveToNotes = async () => {
    if (!activeLecture) return;
    const content = buildLectureNotesMarkdown(activeLecture, activeSegments);
    const note: MarkdownNote = {
      id: `note-lec-${Date.now()}`,
      title: activeLecture.title,
      subject: activeLecture.subject || t('dochub_subject_general'),
      content,
      updatedAt: formatDate(new Date()),
    };
    try {
      const raw = localStorage.getItem(LOCAL_NOTES_KEY);
      const existing: MarkdownNote[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify([note, ...existing]));
    } catch {}
    await db.notes.put(note as any).catch(() => {});
    setSavedNotesNotice(true);
  };

  const handleGenerateFlashcards = async () => {
    if (!activeLecture) return;
    const rawCards =
      parsedFlashcards.length > 0
        ? parsedFlashcards
        : activeSegments
            .flatMap((s) => s.chunkBullets || [])
            .slice(0, 8)
            .map((b, idx) => ({
              front: `${activeLecture.title} — Key Point ${idx + 1}`,
              back: b,
            }));

    if (rawCards.length === 0) return;

    const todayIso = new Date().toISOString().split('T')[0];
    const nowStr = formatDate(new Date());
    const deckId = `deck-lec-${Date.now()}`;
    const cards: SRSCard[] = rawCards.map((c, idx) => ({
      id: `card-${deckId}-${idx}`,
      front: c.front,
      back: c.back,
      tags: activeLecture.subject ? [activeLecture.subject, 'lecture'] : ['lecture'],
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: todayIso,
    }));

    const newDeck: SRSDeck = {
      id: deckId,
      title: activeLecture.title,
      subject: activeLecture.subject || t('dochub_subject_general'),
      cards,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const existingDecks = loadSRSDecks();
    saveSRSDecks([newDeck, ...existingDecks]);
    await db.srsCards
      .bulkPut(cards.map((c) => ({ ...c, deckId })))
      .catch(() => {});
    setSavedDeckNotice(true);
  };

  const handleExportMd = () => {
    if (!activeLecture) return;
    const md = buildLectureNotesMarkdown(activeLecture, activeSegments);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeLecture.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAskCoach = () => {
    if (!activeLecture) return;
    const summaryContext = buildLectureNotesMarkdown(activeLecture, activeSegments).slice(0, 5000);
    window.dispatchEvent(new CustomEvent('scc-open-coach'));
    useCoachChatStore.getState().sendMessage({
      text: t('lecture_coach_prompt', { title: activeLecture.title }),
      assignments,
      events,
      alerts,
      extraContext: {
        lectureTitle: activeLecture.title,
        lectureNotes: summaryContext,
      },
    });
  };

  const silenceSavedPct =
    activeLecture && activeLecture.originalDurationSec > 0 && activeLecture.speechDurationSec > 0
      ? Math.max(
          0,
          Math.min(
            95,
            Math.round(
              ((activeLecture.originalDurationSec - activeLecture.speechDurationSec) /
                activeLecture.originalDurationSec) *
                100
            )
          )
        )
      : 0;

  const modeOptions: {
    id: LectureTranscriptionMode;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'online',
      label: t('lecture_mode_online'),
      hint: t('lecture_mode_online_hint'),
      icon: Wifi,
    },
    {
      id: 'offline-tiny',
      label: t('lecture_mode_offline_tiny'),
      hint: t('lecture_mode_offline_tiny_hint'),
      icon: HardDrive,
    },
    {
      id: 'offline-base',
      label: t('lecture_mode_offline_base'),
      hint: t('lecture_mode_offline_base_hint'),
      icon: HardDrive,
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header + Mode / Language Controls */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5 border border-[var(--border-default)] flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {t('lecture_title')}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t('lecture_sub')}
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
              {(
                [
                  { id: 'auto', label: t('lecture_lang_auto') },
                  { id: 'vi', label: t('lecture_lang_vi') },
                  { id: 'en', label: t('lecture_lang_en') },
                ] as { id: LectureLanguage; label: string }[]
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setLanguage(lang.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                    language === lang.id
                      ? 'bg-[var(--accent-fill)] text-white shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode Toggle Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
          {modeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isProcessing}
                onClick={() => setMode(opt.id)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-60 flex items-start gap-2.5 ${
                  active
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] hover:border-[var(--border-default)] text-[var(--text-secondary)]'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    active
                      ? 'bg-[var(--accent-fill)] text-white'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{opt.label}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    {opt.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Upfront Duration & Background Execution Notice */}
        <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)]/60 px-3.5 py-2.5 text-xs text-[var(--status-info-text)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {mode === 'online'
                ? t('lecture_notice_online', {
                    min: durationEstimate.minMinutes,
                    max: durationEstimate.maxMinutes,
                  })
                : t('lecture_notice_offline', {
                    min: durationEstimate.minMinutes,
                    max: durationEstimate.maxMinutes,
                  })}
            </span>
          </div>

          {mode !== 'online' && cacheStats && cacheStats.approxMb > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={async () => {
                await clearOfflineModels();
                const next = await getOfflineModelCacheStats().catch(() => null);
                if (next) setCacheStats(next);
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer shrink-0"
            >
              {t('scanner_clear_cache', { mb: cacheStats.approxMb })}
            </button>
          )}
        </div>
      </div>

      {/* Live Progress Bar */}
      {isProcessing && progress && (
        <AiProgressBar
          percent={progress.percent}
          label={progress.label}
          detail={progress.detail}
          currentItem={progress.currentItem}
          totalItems={progress.totalItems}
          etaText={t('ai_bg_switch_safe')}
          onCancel={cancelActiveJob}
        />
      )}

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-xs text-[var(--status-err-text)] flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Grid: Left Upload + Saved Lectures, Right Transcript + Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
        {/* Left Column */}
        <div className="xl:col-span-4 min-w-0 space-y-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-xs space-y-3.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
              className="hidden"
              onChange={(e) => {
                handleFilePick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilePick(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[var(--accent-fill)] bg-[var(--accent-soft)]/50'
                  : 'border-[var(--border-default)] bg-[var(--bg-subtle)]/50 hover:border-[var(--border-strong)]'
              }`}
            >
              <Upload className="w-7 h-7 mx-auto mb-2 text-[var(--accent-text)]" />
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {selectedFile ? selectedFile.name : t('lecture_drop_title')}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {selectedFile && detectedDurationSec !== null
                  ? t('lecture_detected_duration', {
                      duration: formatMmSs(detectedDurationSec),
                      mb: (selectedFile.size / (1024 * 1024)).toFixed(1),
                    })
                  : t('lecture_drop_sub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={t('lecture_title_ph')}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
              />
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder={t('scanner_subject_ph')}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
              />
            </div>

            <button
              type="button"
              disabled={!selectedFile || isProcessing}
              onClick={handleStart}
              className="w-full py-2.5 px-4 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-45 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('lecture_start_btn')}</span>
            </button>
          </div>

          {/* Saved Lectures List (Offline-capable via Dexie) */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('lecture_history_title')} ({lectures.length})
              </h3>
            </div>

            {lectures.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                {t('lecture_history_empty')}
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {lectures.map((lec) => {
                  const selected = lec.id === activeLecture?.id;
                  return (
                    <div
                      key={lec.id}
                      onClick={() => selectLecture(lec.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                        selected
                          ? 'bg-[var(--accent-soft)]/70 border-[var(--accent-border)]'
                          : 'bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] hover:border-[var(--border-default)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {lec.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-1">
                          {lec.originalDurationSec > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatMmSs(lec.originalDurationSec)}
                            </span>
                          )}
                          <span>·</span>
                          <span>
                            {lec.completedChunks}/{lec.totalChunks || '?'}
                          </span>
                          <span>·</span>
                          <span className="capitalize">{lec.status}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={t('common_delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLecture(lec.id);
                        }}
                        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Lecture Player, Outline/Summary & Clickable Transcript */}
        <div className="xl:col-span-8 min-w-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          {!activeLecture ? (
            <div className="flex-1 min-h-[420px] flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
              <AudioLines className="w-12 h-12 opacity-25 mb-3" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {t('lecture_empty_heading')}
              </h3>
              <p className="text-xs max-w-md mt-1.5 leading-relaxed">
                {t('lecture_empty_sub')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                    {activeLecture.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                    {activeLecture.originalDurationSec > 0 && (
                      <span>
                        {t('lecture_duration_stat', {
                          orig: formatMmSs(activeLecture.originalDurationSec),
                          speech: formatMmSs(activeLecture.speechDurationSec),
                        })}
                      </span>
                    )}
                    {silenceSavedPct > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)] font-semibold">
                        {t('lecture_silence_saved', { pct: silenceSavedPct })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {canResumeInSession(activeLecture.id) && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => resumeLecture(activeLecture.id)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent-fill)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('lecture_resume_btn')}</span>
                    </button>
                  )}

                  {activeSegments.length > 0 && !activeLecture.summaryMarkdown && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => summarizeLecture(activeLecture.id)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('lecture_summarize_btn')}</span>
                    </button>
                  )}
                </div>
              </div>

              {sessionAudioUrl && (
                <audio
                  ref={audioRef}
                  controls
                  src={sessionAudioUrl}
                  className="w-full h-10 rounded-xl"
                />
              )}

              {/* Tabs: Summary & Outline vs Transcript */}
              <div className="inline-flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] self-start">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('summary')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeSubTab === 'summary'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('lecture_tab_summary')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('transcript')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeSubTab === 'transcript'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('lecture_tab_transcript')} ({activeSegments.length})
                </button>
              </div>

              {activeSubTab === 'summary' ? (
                <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto space-y-4 pr-1">
                  {activeLecture.summaryMarkdown ? (
                    <div className="p-4 rounded-2xl bg-[var(--bg-subtle)]/60 border border-[var(--border-hairline)] prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
                      <MathMarkdown>{activeLecture.summaryMarkdown}</MathMarkdown>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 text-center text-xs text-[var(--text-muted)]">
                      {activeSegments.length > 0
                        ? t('lecture_summary_pending_offline')
                        : t('lecture_waiting_transcript')}
                    </div>
                  )}

                  {parsedOutline.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('lecture_outline_heading')}
                      </h4>
                      {parsedOutline.map((sec, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/60 border border-[var(--border-hairline)] space-y-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => seekAudioTo(sec.timestampSec)}
                              className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] font-mono text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-[var(--accent-fill)] hover:text-white transition-colors"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>{formatMmSs(sec.timestampSec)}</span>
                            </button>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {sec.heading}
                            </span>
                          </div>
                          {sec.bullets?.length > 0 && (
                            <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-1">
                              {sec.bullets.map((b, bi) => (
                                <li key={bi}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeLecture.keyTerms && activeLecture.keyTerms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
                        {t('scanner_key_terms')}
                      </span>
                      {activeLecture.keyTerms.map((term, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/50"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto space-y-2 pr-1">
                  {activeSegments.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                      {t('lecture_waiting_transcript')}
                    </div>
                  ) : (
                    activeSegments.map((seg) => (
                      <div
                        key={seg.id}
                        className="p-3 rounded-xl bg-[var(--bg-subtle)]/50 border border-[var(--border-hairline)] flex items-start gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => seekAudioTo(seg.startSec)}
                          className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--accent-text)] font-mono text-[11px] font-bold shrink-0 cursor-pointer hover:bg-[var(--accent-fill)] hover:text-white transition-colors"
                        >
                          {formatMmSs(seg.startSec)}
                        </button>
                        <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                          {seg.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-hairline)]">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {savedNotesNotice && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-ok-text)]">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('scanner_saved_notes')}</span>
                      {onOpenNotes && (
                        <button
                          type="button"
                          onClick={onOpenNotes}
                          className="underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{t('scanner_open_notes')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )}
                  {savedDeckNotice && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-ok-text)]">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('lecture_saved_deck')}</span>
                      {onOpenFlashcards && (
                        <button
                          type="button"
                          onClick={onOpenFlashcards}
                          className="underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{t('lecture_open_flashcards')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={activeSegments.length === 0}
                    onClick={handleAskCoach}
                    className="px-3 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Bot className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{t('lecture_ask_coach')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeSegments.length === 0}
                    onClick={handleExportMd}
                    className="px-3 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('dochub_export_md')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeSegments.length === 0}
                    onClick={handleGenerateFlashcards}
                    className="px-3 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Brain className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{t('lecture_flashcards_btn')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeSegments.length === 0}
                    onClick={handleSaveToNotes}
                    className="px-4 py-2 text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>{t('scanner_save_notes_btn')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
