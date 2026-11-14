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
    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700/80 rounded-2xl shadow-xs space-y-2 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100">
              {t('api_not_active_title', { feature: featureName })}
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
              {t('api_banner_desc')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3.5 py-2 bg-white dark:bg-[#252422] hover:bg-[#FAF9F5] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-[#D97757]' : ''}`} />
            <span>{t('common_retry')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
