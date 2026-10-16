import React, { useEffect, useState } from 'react';
import { Sparkles, ExternalLink, TriangleAlert, Info, Check, X, Clock } from 'lucide-react';
import type { PriorityLevel } from '../types';
import { getLang, useLang } from '../services/i18n';

const L = (vi: string, en: string) => (getLang() === 'vi' ? vi : en);

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

const PRIORITY_VI: Record<PriorityLevel, [string, string]> = {
  High: ['cao', 'high'],
  Med: ['trung bình', 'medium'],
  Low: ['thấp', 'low'],
};

function weekdayOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const vi = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
  const en = d.toLocaleDateString('en-US', { weekday: 'short' });
  return L(vi, en);
}

function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return L(`${Number(m[3])}/${Number(m[2])}`, `${m[2]}/${m[3]}`);
}

export const AiConfirmCard: React.FC<Props> = ({ draft, onSave, onReject, onClose }) => {
  useLang();
  const [name, setName] = useState(draft.assignmentName);
  const [subject, setSubject] = useState(draft.subject);
  const [due, setDue] = useState(draft.dueDate);
  const [priority, setPriority] = useState<PriorityLevel>(draft.priority);
  const [saving, setSaving] = useState(false);

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
      aria-label={L('Xác nhận bài tập AI tìm thấy', 'Confirm the assignment the AI found')}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#DFDACB] bg-white p-5 shadow-xl dark:border-[#2C2B27] dark:bg-[#1A1917] sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#D97757]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {draft.aiFailed ? L('AI đang lỗi — bạn tự điền giúp nhé', 'AI is unavailable — please fill this in') : L('AI hiểu là', 'The AI understood')}
          </p>
          <button type="button" onClick={onClose} aria-label={L('Đóng', 'Close')} className="rounded-lg p-1 text-[#6B6860] hover:text-[#D97757] dark:text-[#A8A49A]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The one sentence the judges asked for */}
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#1A1917] dark:text-[#F5F2EA]">
          {L('môn', 'subject')} <strong className="text-[#D97757]">{subject || '?'}</strong>
          {' – '}
          {due ? (
            <>
              {L('hạn', 'due')} <strong className="text-[#D97757]">{shortDate(due)} ({weekdayOf(due)})</strong>
            </>
          ) : (
            <strong className="text-amber-700 dark:text-amber-300">{L('chưa rõ hạn', 'no due date')}</strong>
          )}
          {' – '}
          {L('ưu tiên', 'priority')} <strong className="text-[#D97757]">{L(PRIORITY_VI[priority][0], PRIORITY_VI[priority][1])}</strong>.{' '}
          {L('Đúng chưa?', 'Is that right?')}
        </p>
        <p className="mt-1 text-sm text-[#3A3835] dark:text-[#D6D2C7]">“{name}”</p>

        {noDate && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {L(
                'AI không đọc được ngày nộp. Bạn chọn ngày giúp nhé — AI sẽ không tự đặt hạn. Chưa biết thì cứ lưu là "chưa có hạn".',
                'The AI could not find a due date. Pick one — the AI never invents a deadline. Not sure yet? Save it as "no due date".',
              )}
            </span>
          </div>
        )}
        {!noDate && draft.dueConfidence === 'relative' && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{L('AI tự tính ngày từ chữ trong thư (ví dụ "thứ 6 tuần này") — bạn kiểm tra lại nhé.', 'The AI worked the date out from words like "this Friday" — please double-check.')}</span>
          </div>
        )}
        {draft.evidence && (
          <p className="mt-3 rounded-2xl bg-[#FAF9F5] p-3 text-xs leading-relaxed text-[#3A3835] dark:bg-[#1F1E1B] dark:text-[#D6D2C7]">
            <span className="font-bold">{L('AI đọc thấy:', 'The AI read:')}</span> “{draft.evidence}”
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6860] dark:text-[#A8A49A]">
          <span className="min-w-0 truncate">{L('Nguồn:', 'Source:')} {draft.sourceLabel}</span>
          {draft.sourceUrl && (
            <a
              href={draft.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DFDACB] px-2.5 py-1 font-bold text-[#3A3835] hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {draft.origin === 'classroom' ? L('Mở bài gốc', 'Open original post') : L('Mở thư gốc', 'Open original email')}
            </a>
          )}
        </div>

        {/* Always-editable fields: fixing is one tap, not a separate mode */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A] sm:col-span-2">
            {L('Tên bài', 'Task')}
            <input className={`${fieldCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A]">
            {L('Môn', 'Subject')}
            <input className={`${fieldCls} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A]">
            {L('Hạn nộp', 'Due date')}
            <input type="date" className={`${fieldCls} mt-1`} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <div className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A] sm:col-span-2">
            {L('Ưu tiên', 'Priority')}
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
                  {L(PRIORITY_VI[p][0], PRIORITY_VI[p][1])}
                </button>
              ))}
            </div>
          </div>
          {due && (
            <button type="button" onClick={() => setDue('')} className="justify-self-start text-[11px] font-semibold text-[#6B6860] underline dark:text-[#A8A49A]">
              {L('Xoá ngày (chưa có hạn)', 'Clear date (no due date)')}
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
            {!due ? L('Lưu — chưa có hạn', 'Save — no due date') : edited ? L('Lưu bản đã sửa', 'Save my changes') : L('Đúng rồi, lưu', 'Yes, save it')}
          </button>
          {due && !edited && !draft.aiFailed && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save('unconfirmed')}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DFDACB] px-4 text-sm font-bold text-[#3A3835] hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {L('Lưu, xem lại sau', 'Save, check later')}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={draft.origin === 'text' ? onClose : onReject}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-bold text-[#6B6860] hover:text-rose-600 dark:text-[#A8A49A]"
          >
            {draft.origin === 'text' ? L('Huỷ', 'Cancel') : L('Không phải bài tập', 'Not an assignment')}
          </button>
        </div>
        {due && !edited && !draft.aiFailed && (
          <p className="mt-2 text-[11px] leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
            {L('"Xem lại sau" vẫn lưu bài, nhưng hạn được đánh dấu "chưa xác nhận" ở mọi nơi cho tới khi bạn kiểm tra.', '"Check later" saves it, but the date stays marked "unconfirmed" everywhere until you check it.')}
          </p>
        )}
      </div>
    </div>
  );
};

export default AiConfirmCard;
