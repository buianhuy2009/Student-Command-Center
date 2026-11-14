import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, ListChecks, CalendarCheck, PlugZap, ChevronRight, EyeOff, Eye } from 'lucide-react';
import type { Assignment, EmailAlert } from '../types';
import { useT } from '../services/i18n';
import { hasFeatureAccess } from '../services/googleAuth';
import { getDismissedReviewIds } from '../utils/trust';
import { downloadPilotExport } from '../utils/pilotStats';

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
  isGmailConnected?: boolean;
  isClassroomConnected?: boolean;
  canvasCount?: number;
  classroomCount?: number;
}

/**
 * The one main flow judges asked us to focus on:
 * Gmail / Classroom / Canvas → confirm → assignments & due dates → weekly plan.
 */
export const MainFlowCard: React.FC<Props> = ({ assignments, emailAlerts, onNavigate, isGoogleConnected, isGmailConnected, isClassroomConnected, canvasCount = 0, classroomCount = 0 }) => {
  const { t } = useT();
  const [canvasHidden, setHidden] = useState(isCanvasHidden);
  const [, setScopeTick] = useState(0);
  useEffect(() => {
    const refresh = () => setScopeTick((n) => n + 1);
    window.addEventListener('scc-google-scopes-updated', refresh);
    window.addEventListener('scc-google-token-updated', refresh);
    return () => {
      window.removeEventListener('scc-google-scopes-updated', refresh);
      window.removeEventListener('scc-google-token-updated', refresh);
    };
  }, []);
  const gmailReady = isGmailConnected ?? (hasFeatureAccess('gmail') || Boolean(isGoogleConnected && false));
  const classroomReady = isClassroomConnected ?? hasFeatureAccess('classroom');

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
    <section aria-label={t('side_main_flow')} className="rounded-3xl border border-[#DFDACB] bg-[#FAF9F5] p-4 shadow-card dark:border-[#2C2B27] dark:bg-[#1F1E1B] sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-extrabold text-[#1A1917] dark:text-[#F5F2EA]">{t('flow_title')}</h2>
        <p className="text-xs text-[#6B6860] dark:text-[#A8A49A]">
          {t('flow_sub')}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Sources */}
        <div className={step} role="group" aria-label={t('flow_sources')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>1</span>
            <PlugZap className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {t('flow_sources')}
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <button type="button" onClick={() => onNavigate('gmail')} className="rounded-full border border-[#DFDACB] px-2 py-1 hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]">
              {t('flow_gmail_item', { status: gmailReady ? '✓' : `· ${t('flow_connect')}` })}
            </button>
            <button type="button" onClick={() => onNavigate('classroom')} className="rounded-full border border-[#DFDACB] px-2 py-1 hover:border-[#D97757] dark:border-[#2C2B27] dark:text-[#D6D2C7]">
              {t('flow_classroom_item', { value: classroomReady || classroomCount > 0 ? classroomCount : t('flow_connect') })}
            </button>
            {canvasHidden ? (
              <button type="button" onClick={toggleCanvas} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#DFDACB] px-2 py-1 text-[#6B6860] dark:border-[#2C2B27] dark:text-[#A8A49A]">
                <Eye className="h-3 w-3" aria-hidden="true" />
                {t('flow_show_canvas')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#DFDACB] pl-2 dark:border-[#2C2B27] dark:text-[#D6D2C7]">
                <button type="button" onClick={() => onNavigate('canvas')} className="py-1 hover:text-[#D97757]">
                  {t('flow_canvas_item', { count: canvasCount })}
                </button>
                <button type="button" onClick={toggleCanvas} aria-label={t('flow_hide_canvas')} title={t('flow_hide_canvas_title')} className="rounded-full p-1 text-[#6B6860] hover:text-[#D97757] dark:text-[#A8A49A]">
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
            {t('flow_needs_check')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {t('flow_pending_tasks', { count: stats.pending })}
            <br />
            {t('flow_emails_unread', { count: stats.review })}
            <br />
            {t('flow_unconfirmed_due', { count: stats.unconfirmed })}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>

        {/* 3. Assignments */}
        <button type="button" className={step} onClick={() => onNavigate('tracker')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>3</span>
            <ListChecks className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {t('flow_assignments_due')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {t('flow_due_week', { count: stats.week })}
            <br />
            {t('flow_no_date', { count: stats.noDate })}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>

        {/* 4. Weekly plan */}
        <button type="button" className={step} onClick={() => onNavigate('radar')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <span className={num}>4</span>
            <CalendarCheck className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
            {t('flow_weekly_plan')}
          </span>
          <span className="text-[11px] leading-relaxed text-[#3A3835] dark:text-[#D6D2C7]">
            {t('flow_weekly_desc')}
          </span>
          <ChevronRight className="h-4 w-4 self-end text-[#6B6860] group-hover:text-[#D97757]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="font-bold text-[#D97757] underline">
          {t('flow_privacy_link')}
        </button>
        {' · '}
        {t('flow_in_pilot')}{' '}
        <button type="button" onClick={downloadPilotExport} className="font-bold text-[#D97757] underline">
          {t('flow_download_pilot')}
        </button>
      </p>
    </section>
  );
};

export default MainFlowCard;
