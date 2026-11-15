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
  const classroomReady =
    isClassroomConnected === false
      ? false
      : Boolean(isClassroomConnected || hasFeatureAccess('classroom') || classroomCount > 0);

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

  return (
    <section
      aria-label={t('side_main_flow')}
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Compact Header Strip */}
      <div className="px-4 py-2.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-subtle)]/35">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">
            {t('flow_title')}
          </h2>
          <span className="hidden lg:inline text-[11px] text-[var(--text-muted)] truncate">
            · {t('flow_sub')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))}
            className="font-medium text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            {t('flow_privacy_link')}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={downloadPilotExport}
            className="font-medium text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            {t('flow_download_pilot')}
          </button>
        </div>
      </div>

      {/* Sleek 1-Row Divided Pipeline Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-hairline)]">
        {/* 1. Sources */}
        <div className="p-3.5 flex flex-col gap-2 min-w-0 bg-[var(--bg-surface)]" role="group" aria-label={t('flow_sources')}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
            <PlugZap className="h-3.5 w-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
            <span>{t('flow_sources')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => onNavigate('gmail')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 px-2 py-1 text-[var(--text-primary)] hover:border-[var(--border-default)] hover:text-[var(--accent-text)] cursor-pointer transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${gmailReady ? 'bg-[var(--status-ok-text)]' : 'bg-[var(--text-muted)]/50'}`} aria-hidden="true" />
              {t('flow_gmail_item', { status: gmailReady ? '✓' : t('flow_connect') })}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('classroom')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 px-2 py-1 text-[var(--text-primary)] hover:border-[var(--border-default)] hover:text-[var(--accent-text)] cursor-pointer transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${classroomReady ? 'bg-[var(--status-ok-text)]' : 'bg-[var(--text-muted)]/50'}`} aria-hidden="true" />
              {t('flow_classroom_item', { value: classroomReady ? classroomCount : t('flow_connect') })}
            </button>
            {canvasHidden ? (
              <button
                type="button"
                onClick={toggleCanvas}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border-default)] px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                {t('flow_show_canvas')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 pl-2 pr-1 text-[var(--text-primary)]">
                <button type="button" onClick={() => onNavigate('canvas')} className="py-1 hover:text-[var(--accent-text)] cursor-pointer tabular-nums">
                  {t('flow_canvas_item', { count: canvasCount })}
                </button>
                <button
                  type="button"
                  onClick={toggleCanvas}
                  aria-label={t('flow_hide_canvas')}
                  title={t('flow_hide_canvas_title')}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer"
                >
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 2. Needs Check */}
        <button
          type="button"
          onClick={() => onNavigate('gmail')}
          className={`group p-3.5 text-left flex items-center justify-between gap-2 transition-colors bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] cursor-pointer ${
            needsYou > 0 ? 'ring-1 ring-inset ring-[var(--status-warn-border)]/45' : ''
          }`}
        >
          <div className="min-w-0 space-y-1">
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${needsYou > 0 ? 'text-[var(--status-warn-text)]' : 'text-[var(--text-primary)]'}`}>
              <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t('flow_needs_check')}</span>
              {needsYou > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-[var(--status-warn-text)]">
                  {needsYou}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate tabular-nums">
              {t('flow_pending_tasks', { count: stats.pending })} · {t('flow_emails_unread', { count: stats.review })}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] shrink-0" aria-hidden="true" />
        </button>

        {/* 3. Assignments Due */}
        <button
          type="button"
          onClick={() => onNavigate('tracker')}
          className="group p-3.5 text-left flex items-center justify-between gap-2 transition-colors bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <ListChecks className="h-3.5 w-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>{t('flow_assignments_due')}</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate tabular-nums">
              {t('flow_due_week', { count: stats.week })} · {t('flow_no_date', { count: stats.noDate })}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] shrink-0" aria-hidden="true" />
        </button>

        {/* 4. Weekly Study Plan */}
        <button
          type="button"
          onClick={() => onNavigate('radar')}
          className="group p-3.5 text-left flex items-center justify-between gap-2 transition-colors bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <CalendarCheck className="h-3.5 w-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>{t('flow_weekly_plan')}</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {t('flow_weekly_desc')}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] shrink-0" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default MainFlowCard;
