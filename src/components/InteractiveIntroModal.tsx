import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, MapPin, MousePointerClick } from 'lucide-react';
import { useT } from '../services/i18n';

interface TourStop {
  id: string;
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  /** Navigate to this tab when the stop activates (Next/Back/jump auto-move). */
  tab?: string;
  /** Anchor candidates in priority order — first visible match wins. */
  selectors: readonly string[];
  /** Optional "Try it" action: finishes the tour, then opens the real UI. */
  tryIt?: 'search' | 'sync' | 'coach';
  tryItLabelKey?: string;
  tip?: 'SHORTCUT_TIP';
}

function isMac(): boolean {
  try {
    const uaData = (navigator as any).userAgentData;
    const platform = uaData?.platform || (navigator as any).platform || navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/.test(platform);
  } catch { return true; }
}

const TOUR_STOPS: readonly TourStop[] = [
  {
    id: 'sidebar',
    tagKey: 'intro_s1_tag',
    titleKey: 'intro_s1_title',
    bodyKey: 'intro_s1_body',
    selectors: ['[data-tour="sidebar"]', 'aside[aria-label]'],
  },
  {
    id: 'search',
    tagKey: 'intro_s2_tag',
    titleKey: 'intro_s2_title',
    bodyKey: 'intro_s2_body',
    selectors: ['[data-tour="search"]'],
    tryIt: 'search',
    tryItLabelKey: 'intro_s2_try',
    tip: 'SHORTCUT_TIP',
  },
  {
    id: 'sync',
    tagKey: 'intro_s3_tag',
    titleKey: 'intro_s3_title',
    bodyKey: 'intro_s3_body',
    selectors: ['[data-tour="sync"]', '#btn-nav-google-sync'],
    tryIt: 'sync',
    tryItLabelKey: 'intro_s3_try',
  },
  {
    id: 'tracker',
    tagKey: 'intro_s4_tag',
    titleKey: 'intro_s4_title',
    bodyKey: 'intro_s4_body',
    tab: 'tracker',
    selectors: ['[data-tour-tab="tracker"]', '[data-tour="sidebar"]', 'aside[aria-label]'],
  },
  {
    id: 'coach',
    tagKey: 'intro_s5_tag',
    titleKey: 'intro_s5_title',
    bodyKey: 'intro_s5_body',
    selectors: ['[data-tour="coach"]', '#btn-nav-ai-coach'],
    tryIt: 'coach',
    tryItLabelKey: 'intro_s5_try',
  },
  {
    id: 'focus',
    tagKey: 'intro_s6_tag',
    titleKey: 'intro_s6_title',
    bodyKey: 'intro_s6_body',
    tab: 'pomodoro',
    selectors: ['[data-tour-tab="pomodoro"]', '[data-tour="sidebar"]', 'aside[aria-label]'],
  },
] as const;

interface Rect { top: number; left: number; width: number; height: number; }

function resolveTarget(selectors: readonly string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el && el.offsetParent !== null) return el;
    } catch {}
  }
  return null;
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

interface InteractiveIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenAiCoach?: () => void;
  onOpenGoogleSync?: () => void;
}

export const InteractiveIntroModal: React.FC<InteractiveIntroModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSearch,
  onOpenAiCoach,
  onOpenGoogleSync,
}) => {
  const { t } = useT();
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [macPlatform, setMacPlatform] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setMacPlatform(isMac());
  }, []);

  const stop = TOUR_STOPS[currentStep];
  const isLast = currentStep === TOUR_STOPS.length - 1;
  const shortcutTip = macPlatform ? t('intro_shortcut_mac') : t('intro_shortcut_win');

  const measure = useCallback((selectors: readonly string[]) => {
    const el = resolveTarget(selectors);
    if (!el) { setRect(null); return; }
    try {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    } catch {}
    setTimeout(() => {
      const live = resolveTarget(selectors);
      if (!live) { setRect(null); return; }
      const r = live.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, prefersReducedMotion() ? 50 : 350);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (stop.tab && onNavigate) {
      try { onNavigate(stop.tab); } catch {}
    }
    let tries = 0;
    const tick = () => {
      tries += 1;
      const el = resolveTarget(stop.selectors);
      if (el || tries >= 14) {
        measure(stop.selectors);
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 150);
    const onRepos = () => measure(stop.selectors);
    window.addEventListener('resize', onRepos);
    window.addEventListener('scroll', onRepos, true);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      window.removeEventListener('resize', onRepos);
      window.removeEventListener('scroll', onRepos, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const markSeen = () => {
    try { localStorage.setItem('scc_tour_seen_v2', 'true'); } catch {}
  };

  const handleSkip = () => { markSeen(); onClose(); };
  const handleNext = () => {
    if (isLast) { markSeen(); onClose(); }
    else setCurrentStep((p) => p + 1);
  };
  const handlePrev = () => setCurrentStep((p) => Math.max(0, p - 1));

  const handleTryIt = () => {
    markSeen();
    onClose();
    setTimeout(() => {
      try {
        if (stop.tryIt === 'search' && onOpenSearch) onOpenSearch();
        else if (stop.tryIt === 'sync' && onOpenGoogleSync) onOpenGoogleSync();
        else if (stop.tryIt === 'coach' && onOpenAiCoach) onOpenAiCoach();
      } catch {}
    }, 80);
  };

  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const isMobile = vw < 640;
  const cardW = Math.min(330, vw - 16);

  let cardStyle: React.CSSProperties;
  if (!rect || isMobile) {
    cardStyle = isMobile
      ? { left: 8, right: 8, bottom: 8, position: 'fixed' as const }
      : { left: Math.max(8, (vw - cardW) / 2), bottom: 24, position: 'fixed' as const, width: cardW };
  } else {
    const belowFits = rect.top + rect.height + 16 + 260 < vh;
    const top = belowFits ? rect.top + rect.height + 12 : Math.max(8, rect.top - 12 - 260);
    const left = Math.max(8, Math.min(rect.left, vw - cardW - 8));
    cardStyle = { top, left, width: cardW, position: 'fixed' as const };
  }

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none select-none" role="dialog" aria-modal="true" aria-label={t('intro_dialog_aria')}>
      {/* Dim layer */}
      <div className="absolute inset-0 bg-[#141413]/55" />
      {/* Spotlight cutout */}
      {rect && (
        <div
          className="scc-tour-spotlight absolute rounded-2xl"
          style={{
            top: Math.max(0, rect.top - pad),
            left: Math.max(0, rect.left - pad),
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(20,20,19,0.55), 0 0 0 3px #D97757, 0 0 24px rgba(217,119,87,0.55)',
          }}
        />
      )}

      {/* Popover card */}
      <div
        className="pointer-events-auto absolute bg-[#FAF9F5] dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl p-4 space-y-3 animate-in zoom-in-95 duration-150"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/15 text-[#D97757]">
            {t(stop.tagKey)}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1.5 rounded-lg text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] hover:bg-[#EFECE2] dark:hover:bg-[#252422] transition-colors cursor-pointer"
            title={t('intro_skip')}
            aria-label={t('intro_skip')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-[#141413] dark:text-[#FAF9F5] leading-snug flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>{t(stop.titleKey)}</span>
          </h3>
          <p className="text-xs text-[#5C5A54] dark:text-[#B5B2A8] mt-1 leading-relaxed">
            {t(stop.bodyKey)}
          </p>
          {stop.tip === 'SHORTCUT_TIP' && (
            <p className="text-[11px] font-semibold text-[#D97757] mt-1.5">{shortcutTip}</p>
          )}
        </div>

        {stop.tryIt && stop.tryItLabelKey && (
          <button
            type="button"
            onClick={handleTryIt}
            className="w-full px-3 py-2 bg-white dark:bg-[#252422] border border-[#D97757]/40 hover:border-[#D97757] text-[#D97757] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              {t('intro_try_it_suffix', { label: t(stop.tryItLabelKey) })}
            </span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {TOUR_STOPS.map((s, idx) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentStep === idx ? 'w-6 bg-[#D97757]' : 'w-2 bg-[#DFDACB] dark:bg-[#2C2B27]'
                }`}
                aria-label={t('intro_jump_to', { step: idx + 1 })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('common_back')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>
                {isLast ? t('intro_start_studying') : t('common_next')}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
