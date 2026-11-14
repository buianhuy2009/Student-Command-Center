import React, { useState, useEffect } from 'react';
import {
  Globe,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
  Key,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ isOpen, onClose }) => {
  const { t } = useT();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<{
    status?: string;
    platform?: string;
    hasGeminiKey?: boolean;
    timestamp?: string;
    error?: string;
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(t('deploy_http_err', { status: res.status }));
      const data = await res.json();
      setHealthStatus(data);
    } catch (err: any) {
      setHealthStatus({ error: err.message || t('deploy_api_unreachable') });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141413] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#141413] flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#141413] dark:text-[#FAF9F5]">
                {t('deploy_title')}
              </h3>
              <p className="text-xs text-[#6B6860]">
                {t('deploy_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('common_close')}
            className="text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] p-1.5 rounded-lg hover:bg-[#FAF9F5] dark:hover:bg-[#252422] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 text-xs sm:text-sm">
          {/* Health Status Bar */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  healthStatus?.status === 'ok'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <div>
                <span className="font-bold text-[#141413] dark:text-[#FAF9F5] text-xs">
                  {t('deploy_status_label')}
                </span>
                <span className="text-[#6B6860] font-mono text-xs">
                  {healthStatus?.status === 'ok'
                    ? t('deploy_status_healthy', { platform: healthStatus.platform || t('deploy_status_ready') })
                    : healthStatus?.error || t('deploy_status_checking')}
                </span>
              </div>
            </div>

            <button
              onClick={checkHealth}
              disabled={isCheckingHealth}
              className="px-2.5 py-1 text-xs font-semibold bg-[#EFECE2] dark:bg-[#2C2B27] hover:bg-[#DFDACB] dark:hover:bg-[#383632] text-[#141413] dark:text-[#FAF9F5] rounded-lg flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{t('deploy_ping')}</span>
            </button>
          </div>

          {/* Integration 1: Google Workspace / Firebase Auth */}
          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('deploy_sec1_title')}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                {t('deploy_sec1_badge')}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              {t('deploy_sec1_desc')}
            </p>

            <div className="bg-white dark:bg-[#1A1917] p-3 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B6860]">{t('deploy_sec1_domain_label')}</span>
                <button
                  onClick={() => copyToClipboard(currentHostname, 'host')}
                  className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded font-mono font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                >
                  <span>{currentHostname || t('deploy_sec1_domain_ph')}</span>
                  {copiedKey === 'host' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="pt-1.5 border-t border-[#DFDACB] dark:border-[#2C2B27] space-y-1 text-[#5C5A54] dark:text-[#B5B2A8]">
                <p className="font-semibold text-[#141413] dark:text-[#FAF9F5]">{t('deploy_sec1_steps_title')}</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-[#6B6860]">
                  <li>
                    {t('deploy_sec1_step1_pre')}
                    <a
                      href="https://console.firebase.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 underline inline-flex items-center gap-0.5"
                    >
                      {t('deploy_sec1_step1_link')} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li>
                    {t('deploy_sec1_step2')}
                  </li>
                  <li>
                    {t('deploy_sec1_step3_pre')}<code className="bg-[#FAF9F5] dark:bg-[#252422] px-1 py-0.5 rounded font-bold">{currentHostname || t('deploy_sec1_domain_ph')}</code>{t('deploy_sec1_step3_or')}<code className="bg-[#FAF9F5] dark:bg-[#252422] px-1 py-0.5 rounded font-bold">*.vercel.app</code>)
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Integration 2: Canvas Proxy */}
          <div className="p-4 rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-bold">
                <Layers className="w-4 h-4" />
                <span>{t('deploy_sec2_title')}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {t('deploy_sec2_badge')}
              </span>
            </div>

            <p className="text-[#6B6860] text-xs leading-relaxed">
              {t('deploy_sec2_desc_pre')}<code className="font-mono bg-white dark:bg-[#1A1917] px-1 py-0.5 rounded">api/index.ts</code>{t('deploy_sec2_desc_mid')}<code className="font-mono bg-white dark:bg-[#1A1917] px-1 py-0.5 rounded">vercel.json</code>{t('deploy_sec2_desc_post')}<code className="font-mono">/api/canvas/proxy</code>.
            </p>
          </div>

          {/* Integration 3: Gemini AI API Key */}
          <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>{t('deploy_sec3_title')}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                {t('deploy_sec3_badge')}
              </span>
            </div>

            <p className="text-[#6B6860] text-xs leading-relaxed">
              {t('deploy_sec3_desc')}
            </p>

            <div className="bg-white dark:bg-[#1A1917] p-3 rounded-lg border border-amber-200/80 dark:border-amber-800/80 space-y-2 text-xs">
              <p className="text-[#5C5A54] dark:text-[#B5B2A8]">
                {t('deploy_sec3_step1')}
              </p>
              <div className="flex items-center justify-between p-2 rounded bg-[#FAF9F5] dark:bg-[#252422] font-mono text-xs">
                <div>
                  <span className="text-[#6B6860]">{t('deploy_sec3_key_label')}</span>
                  <span className="font-bold text-[#141413] dark:text-[#FAF9F5]">GEMINI_API_KEY</span>
                </div>
                <button
                  onClick={() => copyToClipboard('GEMINI_API_KEY', 'envkey')}
                  className="px-2 py-0.5 bg-[#EFECE2] dark:bg-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] rounded hover:bg-[#DFDACB] transition-colors flex items-center gap-1 text-[11px]"
                >
                  <span>{t('deploy_sec3_copy_key')}</span>
                  {copiedKey === 'envkey' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-[11px] text-[#6B6860]">
                {t('deploy_sec3_step2')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8C897F]">
            {t('deploy_footer_files')}<code className="font-mono text-[#6B6860]">api/index.ts</code> & <code className="font-mono text-[#6B6860]">vercel.json</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl cursor-pointer shadow-xs transition-colors"
          >
            {t('deploy_close_btn')}
          </button>
        </div>
      </div>
    </div>
  );
};
