import React, { useEffect } from 'react';
import {
  AlertTriangle,
  X,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { ApiEnablementInfo } from '../types';
import { useT } from '../services/i18n';

interface ApiActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: ApiEnablementInfo | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

function getFriendlyFeatureName(info: ApiEnablementInfo | null, fallback: string): string {
  const raw = `${info?.serviceId || ''} ${info?.serviceName || ''}`.toLowerCase();
  if (raw.includes('calendar')) return 'Google Calendar';
  if (raw.includes('gmail') || raw.includes('mail')) return 'Gmail';
  if (raw.includes('sheet')) return 'Google Sheets';
  if (raw.includes('doc')) return 'Google Docs';
  if (raw.includes('classroom')) return 'Google Classroom';
  if (raw.includes('drive')) return 'Google Drive';
  return fallback;
}

export const ApiActivationModal: React.FC<ApiActivationModalProps> = ({
  isOpen,
  onClose,
  info,
  onRetry,
  isRetrying = false,
}) => {
  const { t } = useT();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const featureName = getFriendlyFeatureName(info, t('api_feature_generic'));

  const steps = [
    t('api_modal_step1'),
    t('api_modal_step2'),
    t('api_modal_step3'),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-activation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="api-activation-modal"
        className="bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-default)] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="api-activation-modal-title"
                className="text-base font-bold text-[var(--text-primary)]"
              >
                {t('api_not_active_title', { feature: featureName })}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('api_modal_sub')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common_close')}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-secondary)] space-y-1.5">
            <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{t('api_modal_what_t')}</span>
            </div>
            <p className="leading-relaxed">
              {t('api_modal_what_d')}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-[var(--text-primary)]">
              {t('api_modal_do_heading')}
            </p>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-default)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded-xl transition-colors cursor-pointer min-h-[40px]"
          >
            {t('common_close')}
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{t('common_retry')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
