import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ArrowRight, ChevronDown } from 'lucide-react';
import { getValidGoogleToken } from '../services/firebase';
import { hasAnyCanvasSettings } from '../services/canvas';
import { getGrantedScopes, hasRefreshToken } from '../services/googleAuth';
import { useT } from '../services/i18n';

export type OnboardingChecks = { canvas: boolean; google: boolean; task: boolean; pomodoro: boolean };

export const ONBOARDING_COLLAPSED_KEY = 'scc_onboarding_collapsed_v1';
export const ONBOARDING_DISMISSED_KEY = 'scc_onboarding_dismissed_date_v1';

/** Pure helper — count completed checks (exported for Vitest). */
export function getOnboardingProgress(checks: OnboardingChecks): number {
  return (Object.values(checks) as boolean[]).filter(Boolean).length;
}

/** Pure helper — true when the checklist was dismissed today (exported for Vitest). */
export function isDismissedToday(todayStr: string, dismissedStr: string | null): boolean {
  return dismissedStr === todayStr;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const OnboardingChecklist: React.FC<{ onConnectCanvas: ()=>void; onConnectGoogle: ()=>void; onCreateTask: ()=>void; onStartPomodoro: ()=>void }> = ({ onConnectCanvas, onConnectGoogle, onCreateTask, onStartPomodoro }) => {
  const { t } = useT();
  const [checks, setChecks] = useState<OnboardingChecks>(() => {
    try { const raw = localStorage.getItem('scc_onboarding_checks_v1'); return raw ? JSON.parse(raw) : { canvas:false, google:false, task:false, pomodoro:false }; } catch { return { canvas:false, google:false, task:false, pomodoro:false }; }
  });
  // Collapsed by default after first visit; persisted in scc_onboarding_collapsed_v1.
  // First-time visitors (no stored value) see it expanded once; afterwards it stays collapsed.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(ONBOARDING_COLLAPSED_KEY);
      if (v !== null) return v === 'true';
      return false;
    } catch { return false; }
  });
  const [dismissedToday, setDismissedToday] = useState<boolean>(() => {
    try { return isDismissedToday(todayStr(), localStorage.getItem(ONBOARDING_DISMISSED_KEY)); } catch { return false; }
  });
  const save = (next: any) => { setChecks(next); try { localStorage.setItem('scc_onboarding_checks_v1', JSON.stringify(next)); } catch {} };
  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem(ONBOARDING_COLLAPSED_KEY, String(v)); } catch {}
  };
  const handleDismissToday = () => {
    try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, todayStr()); } catch {}
    try { localStorage.setItem(ONBOARDING_COLLAPSED_KEY, 'true'); } catch {}
    setDismissedToday(true);
    setCollapsed(true);
  };
  // Bang A Sec 4.2 Step 2: first-visit auto-collapse so greeting + Today Plan stay above fold.
  // If no stored choice AND (viewport <1024 OR Today Plan has >=1 task), collapse after first paint.
  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_COLLAPSED_KEY) !== null) return;
      let shouldCollapse = false;
      try { if (typeof window !== 'undefined' && window.innerWidth < 1024) shouldCollapse = true; } catch {}
      if (!shouldCollapse) {
        try {
          const raw = localStorage.getItem('scc_user_assignments_v2');
          if (raw && JSON.parse(raw).length > 0) shouldCollapse = true;
        } catch {}
      }
      if (!shouldCollapse) return;
      const doCollapse = () => {
        try { localStorage.setItem(ONBOARDING_COLLAPSED_KEY, 'true'); } catch {}
        setCollapsed(true);
      };
      const ric = (window as any).requestIdleCallback;
      if (typeof ric === 'function') {
        const id = ric(doCollapse, { timeout: 1500 });
        return () => { try { (window as any).cancelIdleCallback?.(id); } catch {} };
      }
      const t = setTimeout(doCollapse, 800);
      return () => clearTimeout(t);
    } catch {}
  }, []);
  // auto-detect (uses real connection state across individual Google tools & Canvas)
  useEffect(()=>{
    const syncStatus = () => {
      const hasCanvas = hasAnyCanvasSettings();
      let hasGoogle = false;
      try {
        hasGoogle = Boolean(getValidGoogleToken() || hasRefreshToken() || getGrantedScopes().length > 0);
      } catch {
        hasGoogle = false;
      }
      const hasTask = (()=>{ try{ const r=localStorage.getItem('scc_user_assignments_v2'); return r && JSON.parse(r).length>0; } catch{return false; }})();
      const hasPomo = (()=>{ try{ return Boolean(localStorage.getItem('scc_pomo_completed_v1')); } catch{return false; }})();
      setChecks(prev => {
        const next = { canvas: hasCanvas||prev.canvas, google: hasGoogle||prev.google, task: hasTask||prev.task, pomodoro: hasPomo||prev.pomodoro };
        if (JSON.stringify(next)!==JSON.stringify(prev)) {
          try { localStorage.setItem('scc_onboarding_checks_v1', JSON.stringify(next)); } catch {}
          return next;
        }
        return prev;
      });
    };
    syncStatus();
    window.addEventListener('scc-google-scopes-updated', syncStatus);
    window.addEventListener('scc-google-token-updated', syncStatus);
    return () => {
      window.removeEventListener('scc-google-scopes-updated', syncStatus);
      window.removeEventListener('scc-google-token-updated', syncStatus);
    };
  }, []);
  const progress = getOnboardingProgress(checks);
  if (progress===4) return null;
  if (dismissedToday) return null;
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-card space-y-3">
      <button
        type="button"
        onClick={() => setCollapsedPersist(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="onboarding-checklist-body"
        className="w-full flex items-center justify-between text-left cursor-pointer rounded-lg min-h-[44px]"
      >
        <span className="flex items-center gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">{t('onboard_check_title')}</h4>
          <span className="text-[10px] font-medium normal-case tracking-normal text-[var(--text-muted)] hidden sm:inline">{t('onboard_check_sub')}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{t('onboard_check_progress', { done: progress, total: 4 })}</span>
          <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </span>
      </button>
      <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={4} aria-label={t('onboard_check_aria')}>
        <div className="h-full bg-[var(--accent-fill)] transition-all duration-300" style={{ width: `${(progress / 4) * 100}%` }} />
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={() => onCreateTask()}
          className="w-full text-left text-[11px] font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 py-2 min-h-[44px] cursor-pointer"
        >
          {t('onboard_check_open_tracker')}
        </button>
      )}
      {!collapsed && (
        <div id="onboarding-checklist-body">
          <div className="space-y-2">
            {([
              { key: 'canvas', label: t('onboard_check_canvas'), done: checks.canvas, action: onConnectCanvas },
              { key: 'google', label: t('onboard_check_google'), done: checks.google, action: onConnectGoogle },
              { key: 'task', label: t('onboard_check_task'), done: checks.task, action: onCreateTask },
              { key: 'pomodoro', label: t('onboard_check_pomodoro'), done: checks.pomodoro, action: onStartPomodoro },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { if (!item.done) item.action(); }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold text-left min-h-[44px] transition-colors ${
                  item.done
                    ? 'bg-[var(--status-ok-bg)] border-[var(--status-ok-border)] text-[var(--status-ok-text)]'
                    : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)] shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                  <span>{item.label}</span>
                </span>
                {!item.done && <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDismissToday}
            className="w-full text-center text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-4 py-2 min-h-[44px] cursor-pointer"
          >
            {t('onboard_check_hide_today')}
          </button>
        </div>
      )}
    </div>
  );
};
