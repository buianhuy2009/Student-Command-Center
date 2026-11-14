import React, { useEffect, useState } from 'react';
import { Sparkles, ExternalLink, TriangleAlert, Info, Check, X, Clock } from 'lucide-react';
import type { PriorityLevel } from '../types';
import { useT } from '../services/i18n';

/** What the AI thinks it found — nothing is saved until the student answers. */
export interface AiDraft {
  assignmentName: string;
  subject: string;
  dueDate: string; // '' when the AI found no date
  priority: PriorityLevel;
  dueConfidence?: 'explicit' | 'relative' | 'none';
  evidence?: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceText?: string;
  aiFailed?: boolean;
  origin: 'gmail' | 'classroom' | 'text' | 'review';
  alertId?: string;
}

export interface AiConfirmResult {
  assignmentName: string;
  subject: string;
  dueDate: string;
  priority: PriorityLevel;
}

interface Props {
  draft: AiDraft;
  onSave: (result: AiConfirmResult, dueStatus: 'confirmed' | 'unconfirmed' | 'missing') => void | Promise<void>;
  onReject: () => void;
  onClose: () => void;
}

const PRIORITY_KEYS: Record<PriorityLevel, string> = {
  High: 'confirm_prio_high',
  Med: 'confirm_prio_med',
  Low: 'confirm_prio_low',
};

function parseIsoLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export const AiConfirmCard: React.FC<Props> = ({ draft, onSave, onReject, onClose }) => {
  const { t, formatDate } = useT();
  const [name, setName] = useState(draft.assignmentName);
  const [subject, setSubject] = useState(draft.subject);
  const [due, setDue] = useState(draft.dueDate);
  const [priority, setPriority] = useState<PriorityLevel>(draft.priority);
  const [saving, setSaving] = useState(false);

  const parsedDue = due ? parseIsoLocalDate(due) : null;
  const dueShort = parsedDue ? formatDate(parsedDue, { day: 'numeric', month: 'numeric' }) : '';
  const dueWeekday = parsedDue ? t(`confirm_weekday_${parsedDue.getDay()}`) : '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const noDate = !draft.dueDate || draft.dueConfidence === 'none';
  const edited = name !== draft.assignmentName || subject !== draft.subject || due !== draft.dueDate || priority !== draft.priority;
  const result: AiConfirmResult = { assignmentName: name.trim() || draft.assignmentName, subject: subject.trim() || 'General', dueDate: due, priority };

  const save = async (status: 'confirmed' | 'unconfirmed' | 'missing') => {
    setSaving(true);
    try {
      await onSave(result, due ? status : 'missing');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    'w-full rounded-xl border border-[#DFDACB] bg-white px-3 py-2 text-sm text-[#1A1917] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/30 dark:border-[#2C2B27] dark:bg-[#1F1E1B] dark:text-[#F5F2EA]';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('confirm_dialog_aria')}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#DFDACB] bg-white p-5 shadow-xl dark:border-[#2C2B27] dark:bg-[#1A1917] sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#D97757]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {draft.aiFailed ? t('confirm_ai_failed') : t('confirm_ai_understood')}
          </p>
          <button type="button" onClick={onClose} aria-label={t('common_close')} className="rounded-lg p-1 text-[#6B6860] hover:text-[#D97757] dark:text-[#A8A49A]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The one sentence the judges asked for */}
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#1A1917] dark:text-[#F5F2EA]">
          {t('gmail_subj_label')} <strong className="text-[#D97757]">{subject || '?'}</strong>
          {' – '}
          {due ? (
            <>
              {t('gmail_due_label')} <strong className="text-[#D97757]">{dueShort} ({dueWeekday})</strong>
            </>
          ) : (
            <strong className="text-amber-700 dark:text-amber-300">{t('gmail_no_due_lower')}</strong>
          )}
          {' – '}
          {t('gmail_priority_label')} <strong className="text-[#D97757]">{t(PRIORITY_KEYS[priority])}</strong>.{' '}
          {t('confirm_question_end')}
        </p>
        <p className="mt-1 text-sm text-[#3A3835] dark:text-[#D6D2C7]">“{name}”</p>

        {noDate && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('confirm_no_date_warn')}</span>
          </div>
        )}
        {!noDate && draft.dueConfidence === 'relative' && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('confirm_relative_hint')}</span>
          </div>
        )}
        {draft.evidence && (
          <p className="mt-3 rounded-2xl bg-[#FAF9F5] p-3 text-xs leading-relaxed text-[#3A3835] dark:bg-[#1F1E1B] dark:text-[#D6D2C7]">
            <span className="font-bold">{t('gmail_ai_read_label')}</span> “{draft.evidence}”
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6860] dark:text-[#A8A49A]">
          <span className="min-w-0 truncate">{t('confirm_source_prefix')} {draft.sourceLabel}</span>
          {draft.sourceUrl && (
            <a
              href={draft.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DFDACB] px-2.5 py-1 font-bold text-[#3A3835] hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {draft.origin === 'classroom' ? t('gmail_open_post') : t('gmail_open_email')}
            </a>
          )}
        </div>

        {/* Always-editable fields: fixing is one tap, not a separate mode */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A] sm:col-span-2">
            {t('confirm_task_label')}
            <input className={`${fieldCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A]">
            {t('confirm_subject_label')}
            <input className={`${fieldCls} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A]">
            {t('due_date')}
            <input type="date" className={`${fieldCls} mt-1`} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <div className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A] sm:col-span-2">
            {t('priority')}
            <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup">
              {(['High', 'Med', 'Low'] as PriorityLevel[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={`min-h-[40px] rounded-xl border text-xs font-bold capitalize ${
                    priority === p
                      ? 'border-[#D97757] bg-[#D97757] text-white'
                      : 'border-[#DFDACB] text-[#3A3835] hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]'
                  }`}
                >
                  {t(PRIORITY_KEYS[p])}
                </button>
              ))}
            </div>
          </div>
          {due && (
            <button type="button" onClick={() => setDue('')} className="justify-self-start text-[11px] font-semibold text-[#6B6860] underline dark:text-[#A8A49A]">
              {t('confirm_clear_date')}
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={saving}
            onClick={() => save('confirmed')}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D97757] px-4 text-sm font-bold text-white hover:bg-[#C86646] disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {!due ? t('confirm_save_no_date') : edited ? t('confirm_save_edited') : t('confirm_save_ok')}
          </button>
          {due && !edited && !draft.aiFailed && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save('unconfirmed')}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DFDACB] px-4 text-sm font-bold text-[#3A3835] hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {t('confirm_save_later')}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={draft.origin === 'text' ? onClose : onReject}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-bold text-[#6B6860] hover:text-rose-600 dark:text-[#A8A49A]"
          >
            {draft.origin === 'text' ? t('common_cancel') : t('confirm_not_assignment')}
          </button>
        </div>
        {due && !edited && !draft.aiFailed && (
          <p className="mt-2 text-[11px] leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
            {t('confirm_check_later_note')}
          </p>
        )}
      </div>
    </div>
  );
};

export default AiConfirmCard;
