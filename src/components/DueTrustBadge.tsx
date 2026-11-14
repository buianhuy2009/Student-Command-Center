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
          className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-dashed border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 hover:border-amber-600"
        >
          {onConfirm ? t('trust_unconfirmed_tap') : t('trust_unconfirmed')}
        </button>
      )}
      {status === 'missing' && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-dashed border-amber-400 text-amber-800 dark:text-amber-200">
          {t('trust_missing')}
        </span>
      )}
      {a.sourceUrl && (
        <a
          href={a.sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#D97757] hover:underline"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          {t('trust_source')}
        </a>
      )}
    </>
  );
};

export default DueTrustBadge;
