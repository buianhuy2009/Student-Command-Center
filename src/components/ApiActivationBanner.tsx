import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { ApiEnablementInfo } from '../types';
import { useT } from '../services/i18n';

interface ApiActivationBannerProps {
  info: ApiEnablementInfo;
  onRetry: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

function getFriendlyFeatureName(info: ApiEnablementInfo, fallback: string): string {
  const raw = `${info.serviceId || ''} ${info.serviceName || ''}`.toLowerCase();
  if (raw.includes('calendar')) return 'Google Calendar';
  if (raw.includes('gmail') || raw.includes('mail')) return 'Gmail';
  if (raw.includes('sheet')) return 'Google Sheets';
  if (raw.includes('doc')) return 'Google Docs';
  if (raw.includes('classroom')) return 'Google Classroom';
  if (raw.includes('drive')) return 'Google Drive';
  return fallback;
}

export const ApiActivationBanner: React.FC<ApiActivationBannerProps> = ({
  info,
  onRetry,
  isRetrying = false,
}) => {
  const { t } = useT();
  const featureName = getFriendlyFeatureName(info, t('api_feature_generic'));

  return (
    <div className="p-4 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-2xl shadow-xs space-y-2 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[var(--bg-surface)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--status-warn-text)]">
              {t('api_not_active_title', { feature: featureName })}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
              {t('api_banner_desc')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3.5 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
            <span>{t('common_retry')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
