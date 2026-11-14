import React, { useEffect, useState } from 'react';
import { CheckCircle2, Link2, LayoutGrid, ArrowRight, Play, ShieldCheck } from 'lucide-react';
import { useT } from '../services/i18n';

/**
 * 60-seconds-to-Aha: 3 quick steps.
 * 1) Optional Google Connections note (no upfront scope bundling!) 2) Paste Canvas link 3) Pick pinned apps.
 * Sample data toggle is explicit — never auto-populate demo that looks real.
 */
export const OnboardingWizard: React.FC<{
  onConnectGoogle: () => void;
  onTestCanvas: (feedUrl: string) => Promise<boolean>;
  onSaveCanvas: (feedUrl: string) => void;
  availableApps: { id: string; name: string }[];
  initialPinned: string[];
  onFinish: (pinned: string[], useSampleData: boolean) => void;
  onSkip: () => void;
}> = ({ onConnectGoogle, onTestCanvas, onSaveCanvas, availableApps, initialPinned, onFinish, onSkip }) => {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [feedUrl, setFeedUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [pinned, setPinned] = useState<string[]>(initialPinned.slice(0, 3));
  const [useSampleData, setUseSampleData] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  const togglePin = (id: string) => {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 5)));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboard_wiz_aria')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl p-6 space-y-4 bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i <= step ? 'bg-[var(--accent-fill)] text-white' : 'bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-muted)]'
              }`}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </span>
              {i < 2 && <span className="w-6 h-px bg-[var(--border-default)]" />}
            </span>
          ))}
          <span className="ml-auto text-[var(--text-secondary)]">
            {t('onboard_wiz_step', { step: step + 1, total: 3 })}
          </span>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold flex items-center gap-2 text-[var(--text-primary)]">
              <ShieldCheck className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
              <span>{t('onboard_wiz_s0_title')}</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('onboard_wiz_s0_body')}
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full px-4 py-3 text-sm font-bold text-white rounded-2xl min-h-[48px] cursor-pointer bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] transition-colors shadow-xs"
            >
              {t('onboard_wiz_s0_continue')}
            </button>
            <button
              type="button"
              onClick={() => { onConnectGoogle(); setStep(1); }}
              className="w-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[44px] cursor-pointer"
            >
              {t('onboard_wiz_s0_pick_google')}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              {t('onboard_wiz_s1_title')}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('onboard_wiz_s1_desc')}{' '}
              <a className="underline text-[var(--accent-text)] hover:opacity-80" href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-subscribe-to-the-Calendar-feed-using-Google-Calendar-as-a/ta-p/536" target="_blank" rel="noreferrer">
                {t('onboard_wiz_s1_guide')}
              </a>
            </p>
            <input
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://canvas…/feeds/calendars/…ics"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-fill)] outline-none"
              aria-label={t('onboard_wiz_s1_input_aria')}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!feedUrl || testing}
                onClick={async () => { setTesting(true); const ok = await onTestCanvas(feedUrl).catch(() => false); setTestOk(ok); setTesting(false); }}
                className="flex-1 px-3 py-2.5 text-xs font-bold rounded-xl border border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] min-h-[44px] inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> {testing ? t('onboard_wiz_s1_testing') : t('onboard_wiz_s1_test')}
              </button>
              <button
                type="button"
                disabled={!feedUrl}
                onClick={() => { onSaveCanvas(feedUrl); setStep(2); }}
                className="flex-1 px-3 py-2.5 text-xs font-bold text-white rounded-xl min-h-[44px] cursor-pointer disabled:opacity-50 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] transition-colors shadow-xs"
              >
                {t('onboard_wiz_s1_save_continue')}
              </button>
            </div>
            {testOk === true && (
              <p className="text-xs text-[var(--status-ok-text)] font-semibold">
                {t('onboard_wiz_s1_ok')}
              </p>
            )}
            {testOk === false && (
              <p className="text-xs text-[var(--status-err-text)] font-semibold">
                {t('onboard_wiz_s1_fail')}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">{t('onboard_wiz_s2_title')}</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('onboard_wiz_s2_desc')}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {availableApps.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => togglePin(a.id)}
                  aria-pressed={pinned.includes(a.id)}
                  className={`px-3 py-2.5 text-xs font-bold rounded-xl border text-left min-h-[44px] flex items-center gap-2 cursor-pointer transition-colors ${
                    pinned.includes(a.id)
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  }`}
                >
                  {pinned.includes(a.id) ? <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)]" /> : <LayoutGrid className="w-4 h-4 text-[var(--text-muted)]" />}
                  {a.name}
                </button>
              ))}
            </div>
            <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={useSampleData} onChange={(e) => setUseSampleData(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--accent-fill)]" />
              <span>
                <strong className="text-[var(--text-primary)]">{t('onboard_wiz_s2_sample_bold')}</strong>{t('onboard_wiz_s2_sample_rest')}
              </span>
            </label>
            <button
              type="button"
              onClick={() => onFinish(pinned, useSampleData)}
              className="w-full px-4 py-3 text-sm font-bold text-white rounded-2xl min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] transition-colors shadow-xs"
            >
              {t('onboard_wiz_s2_finish')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-between text-xs">
          {step > 0
            ? <button type="button" onClick={() => setStep(step - 1)} className="font-semibold opacity-60 min-h-[44px] px-2 cursor-pointer">← {t('common_back')}</button>
            : <span />}
          <button type="button" onClick={onSkip} className="opacity-60 min-h-[44px] px-2 cursor-pointer">{t('onboard_wiz_skip')}</button>
        </div>
        <p className="text-[11px] opacity-50 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> {t('onboard_wiz_search_tip')}
        </p>
      </div>
    </div>
  );
};
