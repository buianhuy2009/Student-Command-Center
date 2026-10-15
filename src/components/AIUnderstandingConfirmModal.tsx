import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Sparkles, TriangleAlert } from 'lucide-react';
import type { EmailAlert, EmailMessage, PriorityLevel } from '../types';

export interface AIConfirmEdited {
  assignmentName: string;
  subject: string;
  dueDate: string;
  priority: PriorityLevel;
  verified: boolean;
  confidence?: number;
  dateSource?: string;
  sourceQuote?: string;
  sourceEmailId?: string;
}

interface AIUnderstandingConfirmModalProps {
  alert: EmailAlert;
  initial: any;
  rawEmail?: EmailMessage;
  onConfirm: (edited: AIConfirmEdited) => void;
  onDismiss: () => void;
}

function formatDueShort(dueDate: string): string {
  if (!dueDate) return 'Unknown';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate);
  if (m) return `${parseInt(m[3], 10)}/${parseInt(m[2], 10)}`;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return dueDate;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function toDateInput(dueDate: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(dueDate || '');
  if (m) return m[1];
  if (!dueDate) return '';
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

const PRIORITIES: PriorityLevel[] = ['High', 'Med', 'Low'];

export const AIUnderstandingConfirmModal: React.FC<AIUnderstandingConfirmModalProps> = ({
  alert,
  initial,
  rawEmail,
  onConfirm,
  onDismiss,
}) => {
  const initName: string = (initial as any)?.name ?? (initial as any)?.assignmentName ?? '';
  const initSubject: string = (initial as any)?.subject ?? 'General';
  const initDue: string = toDateInput((initial as any)?.dueDate ?? '');
  const initPriority: PriorityLevel = (initial as any)?.priority ?? 'Med';
  const dateSource: string | undefined = (initial as any)?.dateSource;
  const sourceQuote: string | undefined =
    (initial as any)?.sourceQuote ?? alert?.oneLineSummary ?? undefined;
  const confidence: number | undefined = (initial as any)?.confidence;

  const [title, setTitle] = useState(initName);
  const [subject, setSubject] = useState(initSubject);
  const [dueDate, setDueDate] = useState(initDue);
  const [priority, setPriority] = useState<PriorityLevel>(initPriority);
  const [verified, setVerified] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const missingDate = !dueDate || dateSource === 'missing';
  // Empty date is only explicitly confirmed when the user checks "I checked source".
  const saveConfirmedDisabled = !title.trim() || (!dueDate && !verified);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  const buildEdited = (isVerified: boolean): AIConfirmEdited => ({
    assignmentName: title.trim(),
    subject: subject.trim() || 'General',
    dueDate: dueDate || '',
    priority,
    verified: isVerified,
    confidence,
    dateSource: (initial as any)?.dateSource,
    sourceQuote,
    sourceEmailId: (rawEmail as any)?.id ?? (alert as any)?.id ?? undefined,
  });

  const summaryLine = `${subject.trim() || 'General'} - due ${dueDate ? formatDueShort(dueDate) : 'Unknown'} - ${priority}. Is that correct?`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm AI understanding"
        className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#D97757]/15 text-[#D97757]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#141413] dark:text-[#FAF9F5]">
              AI understood as:
            </h3>
            <p className="text-sm text-[#5C5A54] dark:text-[#B5B2A8] mt-1 leading-relaxed">
              {summaryLine}
            </p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] p-1 rounded-lg hover:bg-[#FAF9F5] dark:hover:bg-[#252422] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {missingDate && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
          >
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>AI could not read a date from this email — pick a date below or keep Unknown.</span>
          </div>
        )}

        {sourceQuote && (
          <blockquote className="mt-4 pl-3 border-l-2 border-[#D97757]/50 text-xs italic text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed">
            “{sourceQuote}”
          </blockquote>
        )}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">Title</span>
            <input
              ref={firstInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assignment title"
              className="mt-1 w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="General"
              className="mt-1 w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757]"
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">
                Due date (empty = Unknown)
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757]"
              />
            </label>
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">Priority</span>
              <div className="mt-1 flex rounded-xl overflow-hidden border border-[#DFDACB] dark:border-[#2C2B27]" role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    aria-pressed={priority === p}
                    className={`flex-1 px-2 py-2 text-xs font-bold transition-colors ${
                      priority === p
                        ? 'bg-[#D97757] text-white'
                        : 'bg-white dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#2C2B27]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#5C5A54] dark:text-[#B5B2A8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="w-4 h-4 rounded accent-[#D97757]"
            />
            I checked source
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#DFDACB] dark:border-[#2C2B27] flex-wrap">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 text-xs font-medium text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] rounded-xl transition-colors"
          >
            Not assignment / Close
          </button>
          <button
            type="button"
            onClick={() => onConfirm(buildEdited(false))}
            disabled={!title.trim()}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] hover:border-[#D97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save unconfirmed
          </button>
          <button
            type="button"
            onClick={() => onConfirm(buildEdited(true))}
            disabled={saveConfirmedDisabled}
            title={!dueDate && !verified ? 'Check "I checked source" to confirm an Unknown date' : undefined}
            className="px-3 py-2 text-xs font-semibold rounded-xl text-white shadow-sm flex items-center gap-1.5 transition-all bg-[#D97757] hover:bg-[#C86646] shadow-[#D97757]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            Save confirmed
          </button>
        </div>
      </div>
    </div>
  );
};
