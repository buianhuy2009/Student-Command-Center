import React from 'react';
import { Square } from 'lucide-react';
import { useT } from '../../services/i18n';

interface AiProgressBarProps {
  percent: number;
  label: string;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
  etaText?: string;
  indeterminate?: boolean;
  onCancel?: () => void;
  compact?: boolean;
  className?: string;
}

export const AiProgressBar: React.FC<AiProgressBarProps> = ({
  percent,
  label,
  detail,
  currentItem,
  totalItems,
  etaText,
  indeterminate = false,
  onCancel,
  compact = false,
  className = '',
}) => {
  const { t } = useT();
  const safePercent = Math.max(0, Math.min(100, Math.round(Number.isFinite(percent) ? percent : 0)));
  const hasCounts =
    typeof currentItem === 'number' &&
    typeof totalItems === 'number' &&
    totalItems > 0;

  return (
    <div
      className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/80 ${
        compact ? 'p-2.5 space-y-1.5' : 'p-3.5 space-y-2'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-fill)] animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {label}
          </span>
          {hasCounts && (
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] shrink-0">
              {currentItem} / {totalItems}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!indeterminate && (
            <span className="text-xs font-mono font-bold text-[var(--accent-text)] tabular-nums">
              {safePercent}%
            </span>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('ai_job_stop')}
              title={t('ai_job_stop')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[var(--bg-surface)] hover:bg-[var(--status-err-bg)] text-[var(--text-secondary)] hover:text-[var(--status-err-text)] border border-[var(--border-default)] hover:border-[var(--status-err-border)] transition-colors cursor-pointer"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>{t('ai_job_stop')}</span>
            </button>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : safePercent}
        className="w-full h-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] overflow-hidden"
      >
        {indeterminate ? (
          <div className="h-full w-2/5 rounded-full bg-[var(--accent-fill)] animate-pulse" />
        ) : (
          <div
            className="h-full rounded-full bg-[var(--accent-fill)] transition-[width] duration-300 ease-out"
            style={{ width: `${safePercent}%` }}
          />
        )}
      </div>

      {(detail || etaText) && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="truncate">{detail}</span>
          {etaText && <span className="shrink-0 font-medium">{etaText}</span>}
        </div>
      )}
    </div>
  );
};
