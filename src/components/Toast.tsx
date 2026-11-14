import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, ExternalLink, Undo2, RefreshCw, Bell } from 'lucide-react';
import { ToastNotification } from '../types';
import { useT } from '../services/i18n';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onUndo?: (id: string) => void;
  onRetry?: (id: string) => void;
}

/** Group identical toasts (same title+message) into one with a count badge. */
export function groupToasts(toasts: ToastNotification[]): (ToastNotification & { count?: number })[] {
  const map = new Map<string, ToastNotification & { count?: number }>();
  for (const t of toasts) {
    const key = `${t.type}|${t.title}|${t.message ?? ''}`;
    const existing = map.get(key);
    if (existing) existing.count = (existing.count ?? 1) + 1;
    else map.set(key, { ...t });
  }
  return [...map.values()];
}

export const ToastContainer: React.FC<ToastProps & { onUndo?: any; onRetry?: any }> = ({ toasts, onDismiss, onUndo, onRetry }) => {
  const { t } = useT();
  if (toasts.length === 0) return null;
  const grouped = groupToasts(toasts);

  return (
    <div className="toast-stack fixed bottom-5 right-5 z-[90] flex flex-col space-y-2 max-w-md w-full pointer-events-none px-4" role="status" aria-live="polite">
      {grouped.map((toast) => {
        const persistent = (toast as any).persistent === true && toast.type === 'error';
        const toneBorder =
          toast.type === 'success'
            ? 'border-[var(--status-ok-border)]'
            : toast.type === 'error'
            ? 'border-[var(--status-err-border)]'
            : toast.type === 'warning'
            ? 'border-[var(--status-warn-border)]'
            : 'border-[var(--border-strong)]';

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border bg-[var(--bg-raised)] text-[var(--text-primary)] transition-all duration-200 ${toneBorder}`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[var(--status-ok-text)]" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[var(--status-err-text)]" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-[var(--status-warn-text)]" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[var(--accent-text)]" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-[var(--text-primary)]">
                {toast.title}
                {(toast.count ?? 1) > 1 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] font-bold">
                    <Bell className="w-3 h-3" />×{toast.count}
                  </span>
                )}
                {persistent && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-[var(--status-err-text)] font-bold">
                    {t('toast_needs_attention')}
                  </span>
                )}
              </h4>
              {toast.message && (
                <p className="text-xs mt-0.5 text-[var(--text-secondary)] leading-relaxed break-words">{toast.message}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {toast.actionUrl && (
                  <a
                    href={toast.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] underline hover:opacity-80"
                  >
                    {toast.actionLabel || t('toast_open_link')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {(toast as any).undoLabel && onUndo && (
                  <button
                    type="button"
                    onClick={() => onUndo(toast.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg min-h-[32px] cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" /> {(toast as any).undoLabel} (5s)
                  </button>
                )}
                {((toast as any).onRetry || (toast as any).retryLabel) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onRetry) onRetry(toast.id);
                      else if ((toast as any).onRetry) (toast as any).onRetry();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg min-h-[32px] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> {(toast as any).retryLabel || t('retry')}
                  </button>
                )}
              </div>
              {!persistent && toast.duration && toast.duration > 0 && (
                <div className="mt-2 h-0.5 rounded bg-[var(--bg-subtle)] overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-[var(--accent-fill)] scc-toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              aria-label={t('toast_dismiss_aria')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`.scc-toast-progress{animation-name:scc-toast-shrink;animation-timing-function:linear;animation-fill-mode:forwards}@keyframes scc-toast-shrink{from{width:100%}to{width:0%}}`}</style>
    </div>
  );
};
