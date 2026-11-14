import React, { useEffect, useState } from 'react';
import { useT } from '../../services/i18n';

/** Shimmer skeleton blocks that match final layout — use instead of spinners. */
export const SkeletonLine: React.FC<{ width?: string; height?: number; className?: string }> = ({ width = '100%', height = 12, className = '' }) => (
  <div className={`scc-skeleton ${className}`} style={{ width, height }} aria-hidden="true" />
);

export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  const { t } = useT();
  return (
    <div className="p-4 rounded-2xl border border-token space-y-2" style={{ borderColor: 'var(--line)' }} aria-label={t('common_loading')} role="status">
      <SkeletonLine width="40%" height={14} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={`${90 - i * 12}%`} />
      ))}
    </div>
  );
};

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  const { t } = useT();
  return (
    <div className="space-y-2" role="status" aria-label={t('skel_loading_list')}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--line)' }}>
          <div className="scc-skeleton rounded-full shrink-0" style={{ width: 36, height: 36 }} />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine width="55%" height={12} />
            <SkeletonLine width="80%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonCalendar: React.FC = () => {
  const { t } = useT();
  return (
    <div className="grid grid-cols-7 gap-1.5" role="status" aria-label={t('skel_loading_calendar')}>
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="scc-skeleton" style={{ height: 64 }} />
      ))}
    </div>
  );
};

export const SkeletonInbox: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  const { t } = useT();
  return (
    <div className="space-y-2" role="status" aria-label={t('skel_loading_emails')}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border space-y-1.5" style={{ borderColor: 'var(--line)' }}>
          <div className="flex justify-between"><SkeletonLine width="35%" height={12} /><SkeletonLine width="15%" height={10} /></div>
          <SkeletonLine width="70%" height={12} />
          <SkeletonLine width="95%" height={10} />
        </div>
      ))}
    </div>
  );
};

export const SkeletonDrive: React.FC = () => {
  const { t } = useT();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="status" aria-label={t('skel_loading_files')}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl border space-y-2" style={{ borderColor: 'var(--line)' }}>
          <div className="scc-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <SkeletonLine width="80%" />
          <SkeletonLine width="50%" height={10} />
        </div>
      ))}
    </div>
  );
};

/** Animated number count-up for grades / streaks. Respects reduced motion. */
export const CountUp: React.FC<{ value: number; suffix?: string; prefix?: string; durationMs?: number; decimals?: number; className?: string }> = ({
  value, suffix = '', prefix = '', durationMs = 800, decimals = 0, className = '',
}) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span className={`scc-count-up ${className}`}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
};

/** Confetti only for meaningful wins — lazy-loads canvas-confetti on first use. */
let confettiFiredFor = new Set<string>();
export async function celebrateWin(key: string, opts?: { particleCount?: number }) {
  if (confettiFiredFor.has(key)) return;
  confettiFiredFor.add(key);
  try {
    const { default: confetti } = await import('canvas-confetti');
    confetti({ particleCount: opts?.particleCount ?? 90, spread: 70, origin: { y: 0.6 }, colors: ['#D97757', '#10b981', '#7C3AED'] });
  } catch { /* confetti is decorative */ }
}
export function resetWinCelebrations() { confettiFiredFor = new Set<string>(); }
