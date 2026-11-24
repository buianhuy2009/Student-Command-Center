import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Bot,
  CheckCircle2,
  Mail,
  ScanText,
  X,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { useAiJobsStore, type AiJob, type AiJobKind } from '../../store/aiJobsStore';
import { AiProgressBar } from './AiProgressBar';
import { useT } from '../../services/i18n';

function getKindIcon(kind: AiJobKind) {
  switch (kind) {
    case 'lecture':
      return AudioLines;
    case 'ocr':
      return ScanText;
    case 'gmail':
      return Mail;
    case 'chat':
    default:
      return Bot;
  }
}

export function navigateToJobWorkspace(targetTab: string): void {
  if (typeof window === 'undefined') return;
  if (targetTab === 'coach') {
    window.dispatchEvent(new CustomEvent('scc-open-coach'));
  } else {
    window.dispatchEvent(new CustomEvent('scc-navigate', { detail: targetTab }));
  }
}

export const BackgroundAiIndicator: React.FC = () => {
  const { t } = useT();
  const jobsMap = useAiJobsStore((s) => s.jobs);
  const toasts = useAiJobsStore((s) => s.toasts);
  const cancelJob = useAiJobsStore((s) => s.cancelJob);
  const dismissJob = useAiJobsStore((s) => s.dismissJob);
  const dismissToast = useAiJobsStore((s) => s.dismissToast);
  const clearFinished = useAiJobsStore((s) => s.clearFinished);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const jobs = useMemo(
    () => Object.values(jobsMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [jobsMap]
  );
  const runningJobs = useMemo(
    () => jobs.filter((j) => j.status === 'running' || j.status === 'queued'),
    [jobs]
  );
  const finishedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'done' || j.status === 'error'),
    [jobs]
  );

  // Auto-dismiss completion toasts after 6 seconds.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 6000)
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [toasts, dismissToast]);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const primaryRunning = runningJobs[0];
  const avgPercent =
    runningJobs.length > 0
      ? Math.round(runningJobs.reduce((acc, j) => acc + j.percent, 0) / runningJobs.length)
      : 0;

  return (
    <>
      {jobs.length > 0 && (
        <div ref={containerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t('ai_jobs_pill_aria')}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              runningJobs.length > 0
                ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] hover:bg-[var(--accent-fill)] hover:text-white'
                : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {runningJobs.length > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                {runningJobs.length === 1 && primaryRunning ? (
                  <span className="truncate max-w-[140px]">
                    {primaryRunning.title}
                    {!primaryRunning.indeterminate ? ` · ${primaryRunning.percent}%` : ''}
                  </span>
                ) : (
                  <span>
                    {t('ai_jobs_multi_running', {
                      count: runningJobs.length,
                      percent: avgPercent,
                    })}
                  </span>
                )}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-ok-text)] shrink-0" />
                <span className="hidden sm:inline">{t('ai_jobs_recent')}</span>
              </>
            )}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label={t('ai_jobs_panel_title')}
              className="absolute right-0 mt-2 w-[320px] sm:w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-2xl p-3 z-50 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--border-hairline)]">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {t('ai_jobs_panel_title')}
                </span>
                {finishedJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFinished}
                    className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {t('ai_jobs_clear_done')}
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {jobs.map((job: AiJob) => {
                  const Icon = getKindIcon(job.kind);
                  const isActive = job.status === 'running' || job.status === 'queued';
                  return (
                    <div
                      key={job.id}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigateToJobWorkspace(job.targetTab);
                            setOpen(false);
                          }}
                          className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
                        >
                          <Icon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] truncate">
                            {job.title}
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => dismissJob(job.id)}
                            aria-label={t('close')}
                            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isActive ? (
                        <AiProgressBar
                          compact
                          percent={job.percent}
                          indeterminate={job.indeterminate}
                          label={job.label}
                          detail={job.detail}
                          currentItem={job.currentItem}
                          totalItems={job.totalItems}
                          etaText={job.etaText}
                          onCancel={job.cancel ? () => cancelJob(job.id) : undefined}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`flex items-center gap-1 truncate ${
                              job.status === 'error'
                                ? 'text-[var(--status-err-text)]'
                                : job.status === 'done'
                                  ? 'text-[var(--status-ok-text)]'
                                  : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {job.status === 'error' ? (
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                            )}
                            <span className="truncate">{job.detail || job.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigateToJobWorkspace(job.targetTab);
                              setOpen(false);
                            }}
                            className="shrink-0 font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                          >
                            {t('ai_jobs_open')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating completion toast for background jobs */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
          {toasts.slice(0, 2).map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-xl p-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              {toast.status === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-[var(--status-err-text)] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {toast.title}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5">
                  {toast.message}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigateToJobWorkspace(toast.targetTab);
                    dismissToast(toast.id);
                  }}
                  className="mt-1.5 text-[11px] font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  {t('ai_jobs_view_result')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label={t('close')}
                className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
