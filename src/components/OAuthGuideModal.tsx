import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Wrench,
  ArrowLeftRight,
  HelpCircle,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import type { SignInDiagnosis } from '../services/firebase';
import { useT } from '../services/i18n';

export interface OAuthGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryWorkspaceSignIn: () => void;
  onBasicSignIn: () => void;
  isLoggingIn?: boolean;
  /** @deprecated Legacy prop kept for backward compatibility; never displayed to students. */
  projectId?: string;
  /** @deprecated Legacy prop kept for backward compatibility; never displayed to students. */
  userEmail?: string;
  diagnosis?: SignInDiagnosis | null;
  onRunDiagnostics?: () => { label: string; ok: boolean; hint?: string }[];
  onRedirectSignIn?: () => void;
}

export const OAuthGuideModal: React.FC<OAuthGuideModalProps> = ({
  isOpen,
  onClose,
  onRetryWorkspaceSignIn,
  onBasicSignIn,
  isLoggingIn = false,
  diagnosis = null,
  onRunDiagnostics,
  onRedirectSignIn,
}) => {
  const { t } = useT();
  const [envChecks, setEnvChecks] = useState<{ label: string; ok: boolean; hint?: string }[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tips = [
    {
      icon: AlertTriangle,
      title: t('oauth_tip1_t'),
      body: t('oauth_tip1_d'),
    },
    {
      icon: Wifi,
      title: t('oauth_tip2_t'),
      body: t('oauth_tip2_d'),
    },
    {
      icon: ShieldCheck,
      title: t('oauth_tip3_t'),
      body: t('oauth_tip3_d'),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-default)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="oauth-guide-modal-title"
                className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight"
              >
                {t('oauth_title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('oauth_sub')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common_close')}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specific diagnosis when available */}
        {diagnosis && (
          <div className="mt-4 rounded-xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-3.5 space-y-1.5" role="alert">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--status-warn-text)]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{diagnosis.title}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{diagnosis.detail}</p>
            <p className="text-[11px] leading-relaxed text-[var(--status-warn-text)]">
              <strong>{t('oauth_next_step')}</strong>
              {diagnosis.fix}
            </p>
          </div>
        )}

        {/* Friendly student troubleshooting steps */}
        <div className="mt-4 space-y-2.5">
          {tips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <div
                key={index}
                className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{tip.title}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{tip.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 pt-4 border-t border-[var(--border-default)] flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetryWorkspaceSignIn}
            disabled={isLoggingIn}
            className="w-full py-2.5 px-4 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
            <span>
              {isLoggingIn ? t('oauth_connecting') : t('oauth_retry')}
            </span>
          </button>

          {onRedirectSignIn && (
            <button
              type="button"
              onClick={onRedirectSignIn}
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--accent-text)] text-xs font-bold rounded-xl border border-[var(--accent-border)] transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>
                {t('oauth_redirect_btn')}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onBasicSignIn}
            disabled={isLoggingIn}
            className="w-full py-2 px-4 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border-default)] transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <UserCheck className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>
              {t('oauth_basic_btn')}
            </span>
          </button>

          {onRunDiagnostics && (
            <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
              <button
                type="button"
                onClick={() => setEnvChecks(onRunDiagnostics())}
                className="w-full py-2 px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{t('oauth_check_browser')}</span>
              </button>
              {envChecks && (
                <ul className="px-4 pb-3 space-y-1.5">
                  {envChecks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]">
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className="font-semibold text-[var(--text-primary)]">{c.label}</span>
                        {c.hint && <span className="block text-[var(--text-secondary)]">{c.hint}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
