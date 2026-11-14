import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Assignment } from '../types';
import { useT } from '../services/i18n';

/** Marks AI-read deadlines the student has not checked, and dates the AI could not read. */
export const DueTrustBadge: React.FC<{ assignment: Assignment; onConfirm?: (a: Assignment) => void }> = ({ assignment, onConfirm }) => {
  const { t } = useT();
  const a = assignment;
  const status = a.dueStatus || (!a.dueDate && (a.source === 'Gmail' || a.aiEvidence) ? 'missing' : undefined);
  return (
    <>
      {status === 'unconfirmed' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm?.(a);
          }}
          title={a.aiEvidence ? `${t('gmail_ai_read_label')} “${a.aiEvidence}”` : undefined}
          className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-dashed border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] hover:opacity-90 transition-opacity"
        >
          {onConfirm ? t('trust_unconfirmed_tap') : t('trust_unconfirmed')}
        </button>
      )}
      {status === 'missing' && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-dashed border-[var(--status-warn-border)] text-[var(--status-warn-text)]">
          {t('trust_missing')}
        </span>
      )}
      {a.sourceUrl && (
        <a
          href={a.sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[var(--accent-text)] hover:underline"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          {t('trust_source')}
        </a>
      )}
    </>
  );
};

export default DueTrustBadge;
