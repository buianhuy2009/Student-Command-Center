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
    'group flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)]';
  const num =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[11px] font-extrabold text-[var(--accent-text)]';

  return (
    <section
      aria-label={t('side_main_flow')}
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-card sm:p-5"
    >
      <div className="mb-3">
        <h2 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">{t('flow_title')}</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {t('flow_sub')}
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Sources */}
        <div className={step} role="group" aria-label={t('flow_sources')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <span className={num}>1</span>
            <PlugZap className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            {t('flow_sources')}
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => onNavigate('gmail')}
              className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] cursor-pointer"
            >
              {t('flow_gmail_item', { status: gmailReady ? '✓' : `· ${t('flow_connect')}` })}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('classroom')}
              className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] cursor-pointer"
            >
              {t('flow_classroom_item', { value: classroomReady || classroomCount > 0 ? classroomCount : t('flow_connect') })}
            </button>
            {canvasHidden ? (
              <button
                type="button"
                onClick={toggleCanvas}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                {t('flow_show_canvas')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] pl-2.5 text-[var(--text-primary)]">
                <button type="button" onClick={() => onNavigate('canvas')} className="py-1 hover:text-[var(--accent-text)] cursor-pointer">
                  {t('flow_canvas_item', { count: canvasCount })}
                </button>
                <button
                  type="button"
                  onClick={toggleCanvas}
                  aria-label={t('flow_hide_canvas')}
                  title={t('flow_hide_canvas_title')}
                  className="rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer"
                >
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 2. Needs you */}
        <button
          type="button"
          className={`${step} cursor-pointer ${
            needsYou > 0
              ? 'border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] hover:bg-[var(--status-warn-bg)]'
              : ''
          }`}
          onClick={() => onNavigate('gmail')}
        >
          <span className={`flex items-center gap-2 text-xs font-bold ${needsYou > 0 ? 'text-[var(--status-warn-text)]' : 'text-[var(--text-primary)]'}`}>
            <span className={num}>2</span>
            <Inbox className={`h-4 w-4 ${needsYou > 0 ? 'text-[var(--status-warn-text)]' : 'text-[var(--accent-text)]'}`} aria-hidden="true" />
            {t('flow_needs_check')}
          </span>
          <span className={`text-[11px] leading-relaxed ${needsYou > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {t('flow_pending_tasks', { count: stats.pending })}
            <br />
            {t('flow_emails_unread', { count: stats.review })}
            <br />
            {t('flow_unconfirmed_due', { count: stats.unconfirmed })}
          </span>
          <ChevronRight className="mt-auto h-4 w-4 self-end text-[var(--text-muted)] group-hover:text-[var(--accent-text)]" aria-hidden="true" />
        </button>

        {/* 3. Assignments */}
        <button type="button" className={`${step} cursor-pointer`} onClick={() => onNavigate('tracker')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <span className={num}>3</span>
            <ListChecks className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            {t('flow_assignments_due')}
          </span>
          <span className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {t('flow_due_week', { count: stats.week })}
            <br />
            {t('flow_no_date', { count: stats.noDate })}
          </span>
          <ChevronRight className="mt-auto h-4 w-4 self-end text-[var(--text-muted)] group-hover:text-[var(--accent-text)]" aria-hidden="true" />
        </button>

        {/* 4. Weekly plan */}
        <button type="button" className={`${step} cursor-pointer`} onClick={() => onNavigate('radar')}>
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <span className={num}>4</span>
            <CalendarCheck className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            {t('flow_weekly_plan')}
          </span>
          <span className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {t('flow_weekly_desc')}
          </span>
          <ChevronRight className="mt-auto h-4 w-4 self-end text-[var(--text-muted)] group-hover:text-[var(--accent-text)]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="font-bold text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer">
          {t('flow_privacy_link')}
        </button>
        {' · '}
        {t('flow_in_pilot')}{' '}
        <button type="button" onClick={downloadPilotExport} className="font-bold text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer">
          {t('flow_download_pilot')}
        </button>
      </p>
    </section>
  );
};

export default MainFlowCard;
