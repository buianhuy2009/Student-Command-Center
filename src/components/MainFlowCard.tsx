import React, { useMemo, useState } from 'react';
import { Inbox, ListChecks, CalendarCheck, PlugZap, ChevronRight, EyeOff, Eye } from 'lucide-react';
import type { Assignment, EmailAlert } from '../types';
import { getLang, useLang } from '../services/i18n';
import { getDismissedReviewIds } from '../utils/trust';
import { downloadPilotExport } from '../utils/pilotStats';

const L = (vi: string, en: string) => (getLang() === 'vi' ? vi : en);

export const CANVAS_HIDDEN_KEY = 'scc_hide_canvas_v1';

export function isCanvasHidden(): boolean {
  try {
    return localStorage.getItem(CANVAS_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCanvasHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(CANVAS_HIDDEN_KEY, '1');
    else localStorage.removeItem(CANVAS_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('scc-canvas-visibility', { detail: hidden }));
}

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim();

interface Props {
  assignments: Assignment[];
  emailAlerts: EmailAlert[];
  onNavigate: (tabId: string) => void;
  isGoogleConnected?: boolean;
  canvasCount?: number;
  classroomCount?: number;
}

/**
 * The one main flow judges asked us to focus on:
 * Gmail / Classroom / Canvas → confirm → assignments & due dates → weekly plan.
 */
export const MainFlowCard: React.FC<Props> = ({ assignments, emailAlerts, onNavigate, isGoogleConnected, canvasCount = 0, classroomCount = 0 }) => {
  useLang();
  const [canvasHidden, setHidden] = useState(isCanvasHidden);

  const stats = useMemo(() => {
    const dismissed = new Set(getDismissedReviewIds());
    const open = assignments.filter((a) => a.status !== 'Done' && !a.trashedAt);
    const saved = new Set(open.map((a) => norm(a.assignmentName)));
    const review = emailAlerts.filter((a) => !dismissed.has(a.id) && a.needsReview).length;
    const pending = emailAlerts.filter(
      (a) => !dismissed.has(a.id) && a.detectedAssignment?.isAssignment && !saved.has(norm(a.detectedAssignment.name)),
    ).length;
    const unconfirmed = open.filter((a) => a.dueStatus === 'unconfirmed').length;
    const noDate = open.filter((a) => !a.dueDate || a.dueStatus === 'missing').length;
    const now = Date.now();
    const week = open.filter((a) => {
      const t = Date.parse(a.dueDate);
      return Number.isFinite(t) && t - now < 7 * 86400000 && t - now > -86400000;
    }).length;
    return { review, pending, unconfirmed, noDate, week };
  }, [assignments, emailAlerts]);

  const toggleCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !canvasHidden;
    setHidden(next);
    setCanvasHidden(next);
  };

  const needsYou = stats.review + stats.pending + stats.unconfirmed;
  const step =
    'group flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#DFDACB] bg-white p-4 text-left transition hover:border-[#D97757] dark:border-[#2C2B27] dark:bg-[#1A1917]';
  const num = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D97757]/15 text-[11px] font-extrabold text-[#D97757]';

  return (
    <section aria-label={L('Luồng chính', 'Main flow')} className="rounded-3xl border border-[#DFDACB] bg-[#FAF9F5] p-4 shadow-card dark:border-[#2C2B27] dark:bg-[#1F1E1B] sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-extrabold text-[#1A1917] dark:text-[#F5F2EA]">{L('Luồng chính của bạn', 'Your main flow')}</h2>
        <p className="text-xs text-[#6B6860] dark:text-[#A8A49A]">
          {L('Thư, Classroom, Canvas → bài tập & hạn nộp → lịch học tuần. AI đề xuất, bạn quyết định.', 'Email, Classroom, Canvas → assignments & due dates → weekly plan. The AI suggests, you decide.')}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Sources */}
        <div className={step} role="group" aria-label={L('Nguồn', 'Sources')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>1</span>
            <PlugZap className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {L('Nguồn', 'Sources')}
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <button type="button" onClick={() => onNavigate('gmail')} className="rounded-full border border-[#DFDACB] px-2 py-1 hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]">
              Gmail {isGoogleConnected ? '✓' : `· ${L('kết nối', 'connect')}`}
            </button>
            <button type="button" onClick={() => onNavigate('classroom')} className="rounded-full border border-[#DFDACB] px-2 py-1 hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]">
              Classroom · {classroomCount}
            </button>
            {canvasHidden ? (
              <button type="button" onClick={toggleCanvas} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#DFDACB] px-2 py-1 text-[#6B6860] dark:border-[#2C2B27] dark:text-[#A8A49A]">
                <Eye className="h-3 w-3" aria-hidden="true" />
                {L('Hiện Canvas', 'Show Canvas')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#DFDACB] pl-2 dark:border-[#2C2B27] dark:text-[#D6D2C7]">
                <button type="button" onClick={() => onNavigate('canvas')} className="py-1 hover:text-[#D97757]">
                  Canvas · {canvasCount}
                </button>
                <button type="button" onClick={toggleCanvas} aria-label={L('Ẩn Canvas', 'Hide Canvas')} title={L('Ẩn Canvas nếu trường bạn không dùng', 'Hide Canvas if your school does not use it')} className="rounded-full p-1 text-[#6B6860] hover:text-[#D97757] dark:text-[#A8A49A]">
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 2. Needs you */}
        <button type="button" className={`${step} ${needsYou > 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : ''}`} onClick={() => onNavigate('gmail')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>2</span>
            <Inbox className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {L('Cần bạn xác nhận', 'Needs your check')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {stats.pending} {L('bài AI tìm thấy chờ lưu', 'AI-found tasks to confirm')}
            <br />
            {stats.review} {L('thư AI chưa đọc được', 'emails the AI could not read')}
            <br />
            {stats.unconfirmed} {L('hạn chưa xác nhận', 'unconfirmed due dates')}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>

        {/* 3. Assignments */}
        <button type="button" className={step} onClick={() => onNavigate('tracker')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>3</span>
            <ListChecks className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {L('Bài tập & hạn nộp', 'Assignments & due dates')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {stats.week} {L('bài trong 7 ngày tới', 'due in the next 7 days')}
            <br />
            {stats.noDate} {L('bài chưa có hạn — AI không tự đặt', 'without a date — never invented')}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>

        {/* 4. Weekly plan */}
        <button type="button" className={step} onClick={() => onNavigate('ai-planner')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>4</span>
            <CalendarCheck className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {L('Lịch học tuần', 'Weekly study plan')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {L('AI xếp lịch; bạn xem thay đổi, quay lại bản cũ và khoá buổi quan trọng.', 'The AI plans; you review changes, undo, and lock key sessions.')}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="font-bold text-[#D97757] underline">
          {L('Quyền riêng tư & dữ liệu gửi cho AI', 'Privacy & what the AI sees')}
        </button>
        {' · '}
        {L('Đang tham gia thử nghiệm?', 'In the pilot?')}{' '}
        <button type="button" onClick={downloadPilotExport} className="font-bold text-[#D97757] underline">
          {L('Tải số liệu thử nghiệm (ẩn danh: chỉ có số đếm, không có tên hay nội dung thư)', 'Download pilot numbers (anonymous: counts only, no names or email text)')}
        </button>
      </p>
    </section>
  );
};

export default MainFlowCard;
