import React from 'react';
import { ExternalLink, AlertTriangle, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { ApiEnablementInfo } from '../types';

interface ApiActivationBannerProps {
  info: ApiEnablementInfo;
  onRetry: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

export const ApiActivationBanner: React.FC<ApiActivationBannerProps> = ({
  info,
  onRetry,
  isRetrying = false,
}) => {
  const projectId = info.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '614024702267';
  const serviceName = info.serviceName || 'Google Drive API';
  const url =
    info.activationUrl ||
    `https://console.developers.google.com/apis/api/${info.serviceId || 'drive.googleapis.com'}/overview?project=${projectId}`;

  return (
    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700/80 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
              <span>{serviceName} is not enabled in Google Cloud</span>
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
              Google Cloud Project <code className="font-mono font-bold bg-amber-200/60 dark:bg-amber-900/80 px-1 py-0.5 rounded text-[11px]">{projectId}</code> needs the {serviceName} turned on before files can be synced.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-[#D97757] hover:bg-[#C86646] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <span>Enable in Cloud Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3 py-2 bg-white dark:bg-[#252422] hover:bg-[#FAF9F5] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-[#D97757]' : ''}`} />
            <span>Retry Sync</span>
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300">
        <span>Quick fix: Click &quot;Enable in Cloud Console&quot; &rarr; Hit the blue &quot;ENABLE&quot; button &rarr; Click &quot;Retry Sync&quot;</span>
        <span className="font-mono text-[10px] opacity-75">1-click activation</span>
      </div>
    </div>
  );
};
