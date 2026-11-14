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
        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-5 ${
              toast.type === 'success'
                ? 'bg-[#30302E]/95 border-[#4F4A3E] text-[#F5F4ED]'
                : toast.type === 'error'
                ? 'bg-[#30302E]/95 border-[#C96442]/50 text-[#F5F4ED]'
                : toast.type === 'warning'
                ? 'bg-[#30302E]/95 border-[#E8E6DC]/30 text-[#F5F4ED]'
                : 'bg-[#141413]/95 border-[#4F4A3E] text-[#F5F4ED]'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#C96442]" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#C96442]" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                {toast.title}
                {(toast.count ?? 1) > 1 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/15 font-bold">
                    <Bell className="w-3 h-3" />×{toast.count}
                  </span>
                )}
                {persistent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 font-bold">{t('toast_needs_attention')}</span>}
              </h4>
              {toast.message && (
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{toast.message}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {toast.actionUrl && (
                  <a href={toast.actionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium underline hover:opacity-80">
                    {toast.actionLabel || t('toast_open_link')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {(toast as any).undoLabel && onUndo && (
                  <button onClick={() => onUndo(toast.id)} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg min-h-[32px]">
                    <Undo2 className="w-3 h-3" /> {(toast as any).undoLabel} (5s)
                  </button>
                )}
                {((toast as any).onRetry || (toast as any).retryLabel) && (
                  <button
                    onClick={() => { if (onRetry) onRetry(toast.id); else if ((toast as any).onRetry) (toast as any).onRetry(); }}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg min-h-[32px]"
                  >
                    <RefreshCw className="w-3 h-3" /> {(toast as any).retryLabel || t('retry')}
                  </button>
                )}
              </div>
              {!persistent && toast.duration && toast.duration > 0 && (
                <div className="mt-2 h-0.5 rounded bg-white/10 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-white/40 scc-toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />
                </div>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-2 rounded-md opacity-70 hover:opacity-100 hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
