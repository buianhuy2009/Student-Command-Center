import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare,
  Plus,
  Calendar,
  Sparkles,
  Search,
  ExternalLink,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  Circle,
  Check,
  Zap,
  X,
  ChevronRight,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ArrowRight,
  Brain,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, PriorityLevel, AssignmentStatus, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { estimateAssignmentEffort, EffortEstimate } from '../services/gemini';
import { t as i18nT, useT } from '../services/i18n';
import { WhyIsThisHardModal } from './WhyIsThisHardModal';
import { DueTrustBadge } from './DueTrustBadge';

interface AssignmentTrackerTabProps {
  assignments: Assignment[];
  sheetUrl?: string;
  sheetId?: string;
  isLoading: boolean;
  onRefresh: () => void;
  onAddAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
  onUpdateStatus: (assignment: Assignment, newStatus: AssignmentStatus) => Promise<void>;
  onScheduleStudyBlock: (assignment: Assignment) => void;
  onParseNaturalText: (text: string) => Promise<void>;
  isParsingAI: boolean;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  onClearCompleted?: () => Promise<void>;
  sheetError?: string | null;
  sheetApiInfo?: ApiEnablementInfo | null;
  onOpenLibrarySearch?: (query: string) => void;
  /** Student checked an AI-read deadline → mark it confirmed. */
  onConfirmDue?: (assignment: Assignment) => void;
}

type UrgencyState = 'overdue' | 'today' | 'tomorrow' | null;

export function getUrgencyInfo(
  dueDateStr?: string,
  isDone?: boolean,
  translate: typeof i18nT = i18nT,
) {
  if (!dueDateStr || isDone) return null;
  let due: Date;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dueDateStr.trim());
  if (m) {
    due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else {
    due = new Date(dueDateStr);
  }
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0) {
    return { state: 'overdue' as const, label: translate('overdue'), chip: URGENCY_CHIP.overdue, tint: URGENCY_TINT.overdue };
  }
  if (diff === 0) {
    return { state: 'today' as const, label: translate('due_today'), chip: URGENCY_CHIP.today, tint: URGENCY_TINT.today };
  }
  if (diff === 1) {
    return { state: 'tomorrow' as const, label: translate('tracker_urg_tomorrow'), chip: URGENCY_CHIP.tomorrow, tint: URGENCY_TINT.tomorrow };
  }
  return null;
}

function getUrgency(assignment: Assignment): UrgencyState {
  return getUrgencyInfo(assignment.dueDate, assignment.status === 'Done')?.state ?? null;
}

const URGENCY_CHIP: Record<Exclude<UrgencyState, null>, string> = {
  overdue:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  today:
    'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)]',
  tomorrow:
    'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

const URGENCY_LABEL: Record<Exclude<UrgencyState, null>, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
};

const URGENCY_TINT: Record<Exclude<UrgencyState, null>, string> = {
  overdue: 'bg-rose-50/40 dark:bg-rose-950/20',
  today: 'bg-[var(--status-warn-bg)]',
  tomorrow: 'bg-blue-50/40 dark:bg-blue-950/20',
};

export const AssignmentTrackerTab: React.FC<AssignmentTrackerTabProps> = ({
  assignments,
  sheetUrl,
  sheetId,
  isLoading,
  onRefresh,
  onAddAssignment,
  onUpdateStatus,
  onScheduleStudyBlock,
  onParseNaturalText,
  isParsingAI,
  isGoogleConnected = true,
  onConnectGoogle,
  onClearCompleted,
  sheetError,
  sheetApiInfo,
  onOpenLibrarySearch,
  onConfirmDue,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isClearingDone, setIsClearingDone] = useState(false);
  const [showAiAdd, setShowAiAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const { t } = useT();
  const displayStatus = (s: AssignmentStatus) =>
    s === 'Done' ? t('done') : s === 'In Progress' ? t('tracker_status_in_progress') : t('tracker_status_not_started');
  const displayPriority = (p: PriorityLevel) =>
    p === 'High' ? t('tracker_priority_high') : p === 'Low' ? t('tracker_priority_low') : t('tracker_priority_med_short');

  // Selected row for Slide-Over Inspector Sheet
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [whyIsThisHardTask, setWhyIsThisHardTask] = useState<Assignment | null>(null);

  // AI Dynamic Priority & Effort state
  const [effortEstimates, setEffortEstimates] = useState<Record<string, EffortEstimate>>({});
  const [isEstimating, setIsEstimating] = useState(false);
  const [sortByAIFocus, setSortByAIFocus] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const handleRunAIEstimates = async () => {
    setIsEstimating(true);
    setEstimateError(null);
    try {
      const estimates = await estimateAssignmentEffort(assignments);
      const map: Record<string, EffortEstimate> = {};
      estimates.forEach((e) => {
        map[e.id] = e;
      });
      setEffortEstimates(map);
      setSortByAIFocus(true);
    } catch (err: any) {
      console.error('Error running AI estimates:', err);
      setEstimateError(err?.message || t('tracker_est_err'));
    } finally {
      setIsEstimating(false);
    }
  };

  // New assignment modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('AP Calculus BC');
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [newPriority, setNewPriority] = useState<PriorityLevel>('Med');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = useMemo(() => {
    return Array.from(new Set(assignments.map((a) => a.subject).filter(Boolean)));
  }, [assignments]);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    await onParseNaturalText(quickInput.trim());
    setQuickInput('');
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddAssignment({
        assignmentName: newTitle.trim(),
        subject: newSubject.trim() || 'General',
        dueDate: newDueDate,
        priority: newPriority,
        status: 'Not Started',
        notes: newNotes.trim() || undefined,
      });

      setShowAddModal(false);
      setNewTitle('');
      setNewNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusClick = async (assignment: Assignment) => {
    let nextStatus: AssignmentStatus = 'In Progress';
    if (assignment.status === 'Not Started') {
      nextStatus = 'In Progress';
    } else if (assignment.status === 'In Progress') {
      nextStatus = 'Done';
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } else {
      nextStatus = 'Not Started';
    }

    await onUpdateStatus(assignment, nextStatus);
  };

  const handleClearDone = async () => {
    if (!onClearCompleted) return;
    setIsClearingDone(true);
    try {
      await onClearCompleted();
    } finally {
      setIsClearingDone(false);
    }
  };

  const { filteredAssignments, oldCompletedCount } = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let oldDone = 0;

    const filtered = assignments.filter((a) => {
      const isDone = a.status === 'Done';
      const dueDateMs = a.dueDate ? new Date(a.dueDate).getTime() : 0;

      if (isDone && dueDateMs && dueDateMs < oneWeekAgo && !showArchived && filterStatus !== 'Done') {
        oldDone++;
        return false;
      }

      if (filterSubject !== 'ALL' && a.subject !== filterSubject) return false;
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
      if (filterPriority !== 'ALL' && a.priority !== filterPriority) return false;
      if (needsReviewOnly) {
        const needsCheck =
          a.status !== 'Done' &&
          (a.dueStatus === 'unconfirmed' || a.dueStatus === 'missing' || !a.dueDate);
        if (!needsCheck) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.assignmentName.toLowerCase().includes(q);
        const matchSub = a.subject.toLowerCase().includes(q);
        const matchNotes = (a.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchSub && !matchNotes) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const aDone = a.status === 'Done';
      const bDone = b.status === 'Done';
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;

      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

      if (sortByAIFocus) {
        const aOrder = effortEstimates[a.id]?.focusOrder ?? 999;
        const bOrder = effortEstimates[b.id]?.focusOrder ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }

      return aDate - bDate;
    });

    return { filteredAssignments: filtered, oldCompletedCount: oldDone };
  }, [assignments, searchQuery, filterSubject, filterStatus, filterPriority, needsReviewOnly, showArchived, sortByAIFocus, effortEstimates]);

  const doneCount = assignments.filter((a) => a.status === 'Done').length;
  const highCount = assignments.filter((a) => a.priority === 'High' && a.status !== 'Done').length;
  const unconfirmedCount = assignments.filter(
    (a) => a.status !== 'Done' && (a.dueStatus === 'unconfirmed' || a.dueStatus === 'missing' || !a.dueDate)
  ).length;

  const handleSyncClick = () => {
    if (!isGoogleConnected) {
      onConnectGoogle?.();
      return;
    }
    onRefresh();
  };

  const handleExportCsv = () => {
    const escapeCsvCell = (value: string | undefined | null): string => {
      const str = value ?? '';
      return /["\n\r,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [t('tracker_th_name'), t('subject'), t('due_date'), t('status'), t('priority'), t('notes')];
    const lines = filteredAssignments.map((a) =>
      [
        a.assignmentName ?? '',
        a.subject ?? '',
        a.dueDate ?? '',
        a.status ?? '',
        a.priority ?? '',
        a.notes ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assignments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Google Sheets Disconnected Guidance Banner */}
      {!isGoogleConnected && (
        <div className="p-4 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--status-warn-text)]">{t('tracker_sheet_title')}</h4>
              <p className="text-[11px] text-[var(--status-warn-text)] mt-0.5 leading-relaxed">
                {t('tracker_sheet_desc')}
                <br />
                <span className="font-semibold">{t('tracker_sheet_setup')}</span>
              </p>
              {sheetError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-mono">{sheetError}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onConnectGoogle && (
              <button
                onClick={onConnectGoogle}
                className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t('connect_google')}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {sheetApiInfo && (
        <ApiActivationBanner info={sheetApiInfo} onRetry={onRefresh} compact />
      )}
      {estimateError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-200" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{estimateError}</span>
          </div>
          <button onClick={() => setEstimateError(null)} className="px-2 py-0.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 font-semibold cursor-pointer">
            {t('common_dismiss')}
          </button>
        </div>
      )}
      {/* Top Header — decluttered: stats + search + 4 primary actions. Filters, export, sheet link live in the Filters panel below. */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">

        {/* Left: Summary Stats */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <span className="text-xs font-bold text-[var(--text-primary)] px-1">
            {t('master_tracker')}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            {highCount} {t('high_priority')}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {doneCount} {t('done')}
          </span>
          {unconfirmedCount > 0 && (
            <button
              type="button"
              onClick={() => setNeedsReviewOnly((v) => !v)}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-dashed transition-colors cursor-pointer inline-flex items-center gap-1 ${
                needsReviewOnly
                  ? 'bg-[var(--status-warn-text)] text-white border-[var(--status-warn-text)]'
                  : 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)] hover:opacity-90'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{t('tracker_unconfirmed_filter')} ({unconfirmedCount})</span>
            </button>
          )}
        </div>

        {/* Right: Primary actions only */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_tracker')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
            />
          </div>

          {/* View Mode Toggle: Table vs Kanban (timeline removed — Gantt lives in its own workspace) */}
          <div className="flex items-center bg-[var(--bg-subtle)] p-0.5 rounded-xl border border-[var(--border-default)]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title={t('tracker_view_table')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title={t('tracker_view_kanban')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filters toggle — opens subject/status/priority + Export CSV + Open Sheet */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              showFilters
                ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent-fill)]'
            }`}
            title={t('tracker_filters_title')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Sync Sheet */}
          <button
            onClick={handleSyncClick}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-default)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={isGoogleConnected ? t('tracker_sync_title') : t('connect_google')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? t('syncing') : t('sync_sheet')}</span>
          </button>

          {/* Smart Add Toggle (AI Rank lives inside the expanded bar) */}
          <button
            onClick={() => setShowAiAdd(!showAiAdd)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showAiAdd
                ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-[var(--border-default)]'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${showAiAdd ? 'text-white' : 'text-[var(--accent-text)]'}`} />
            <span className="hidden sm:inline">{t('smart_add')}</span>
          </button>

          {/* Main Flow Next Step: Weekly Plan */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('scc-navigate', { detail: 'radar' }))}
            className="px-3 py-1.5 bg-[var(--accent-3-soft,var(--bg-subtle))] hover:bg-[var(--bg-hover)] text-[var(--accent-3-text,var(--text-primary))] text-xs font-bold rounded-xl border border-[var(--accent-3-border,var(--border-default))] transition-all flex items-center gap-1 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('tracker_plan_week_cta')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {/* New Task Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('new_task')}</span>
          </button>
        </div>
      </div>

      {/* Filters panel — secondary controls live here, out of the main row */}
      {showFilters && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-3 shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_subjects')}</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_status')}</option>
            <option value="Not Started">{t('tracker_status_not_started')}</option>
            <option value="In Progress">{t('tracker_status_in_progress')}</option>
            <option value="Done">{t('done')}</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_priority')}</option>
            <option value="High">{t('tracker_priority_high')}</option>
            <option value="Med">{t('tracker_priority_med_short')}</option>
            <option value="Low">{t('tracker_priority_low')}</option>
          </select>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-default)] transition-all flex items-center gap-1.5 cursor-pointer"
            title={t('tracker_export_title')}
          >
            <FileText className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{t('export_csv')}</span>
          </button>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl border border-[var(--border-default)] transition-all flex items-center gap-1 cursor-pointer"
              title={t('tracker_open_sheet_title')}
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--status-ok-text)]" />
              <span className="text-[11px]">{t('open_sheet')}</span>
            </a>
          )}
        </div>
      )}

      {/* Smart Add Bar — natural-language add + AI Rank merged here (out of main toolbar) */}
      {showAiAdd && (
        <form
          onSubmit={handleQuickSubmit}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-3 shadow-xs flex items-center gap-2 animate-in fade-in flex-wrap"
        >
          <Sparkles className="w-4 h-4 text-[var(--accent-text)] shrink-0 ml-1" />
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={t('smart_add_placeholder')}
            className="flex-1 basis-48 min-w-0 px-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
          />
          <button
            type="button"
            onClick={handleRunAIEstimates}
            disabled={isEstimating || assignments.length === 0}
            className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-xs font-bold rounded-xl border border-[var(--border-default)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title={t('tracker_ai_title')}
          >
            <Zap className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isEstimating ? 'animate-bounce' : ''}`} />
            <span>{isEstimating ? '…' : sortByAIFocus ? '✓ AI' : t('tracker_ai_rank')}</span>
          </button>
          <button
            type="submit"
            disabled={isParsingAI || !quickInput.trim()}
            className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isParsingAI ? '…' : t('add')}
          </button>
        </form>
      )}

      {/* VIEW RENDERER: TABLE | BOARD (timeline Gantt removed — lives in its own workspace) */}
      {viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden animate-in fade-in duration-150">
          {(
            [
              { id: 'Not Started', label: t('tracker_col_todo'), color: 'border-[var(--status-warn-border)]' },
              { id: 'In Progress', label: t('tracker_col_progress'), color: 'border-blue-200 dark:border-blue-900/60' },
              { id: 'Done', label: t('tracker_col_done'), color: 'border-emerald-200 dark:border-emerald-900/60' },
            ] as { id: 'Not Started' | 'In Progress' | 'Done'; label: string; color: string }[]
          ).map((col) => {
            const colTasks = filteredAssignments.filter((a) => a.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3.5 shadow-xs flex flex-col min-h-0 overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[var(--border-default)] shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      {col.label}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-[var(--text-muted)]">
                      {t('tracker_empty_col')} {col.label.toLowerCase()}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isHigh = task.priority === 'High';
                      const isDone = task.status === 'Done';
                      const urgency = getUrgency(task);

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedAssignment(task)}
                          className={`p-3.5 rounded-xl border bg-[var(--bg-subtle)] border-[var(--border-default)] hover:border-[var(--accent-fill)]/80 transition-all cursor-pointer space-y-2.5 shadow-2xs group ${
                            isDone ? 'opacity-70' : ''
                          } ${urgency ? URGENCY_TINT[urgency] : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] truncate max-w-[130px]">
                              {task.subject}
                            </span>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                isHigh
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {displayPriority(task.priority)}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2 ${
                              isDone ? 'line-through text-[var(--text-muted)]' : ''
                            }`}
                          >
                            {task.assignmentName}
                          </h4>

                          {effortEstimates[task.id] && (
                            <div className="text-[10px] text-[var(--accent-text)] font-semibold flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span>{t('tracker_est')} {effortEstimates[task.id].estimatedMinutes} {t('minutes')}</span>
                            </div>
                          )}

                          {/* Footer with Due Date & Status Mover */}
                          <div
                            className="flex items-center justify-between pt-2 border-t border-[var(--border-default)] text-[11px] text-[var(--text-muted)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span>{task.dueDate || t('tracker_no_due')}</span>
                              <DueTrustBadge assignment={task} onConfirm={onConfirmDue} />
                              {urgency && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${URGENCY_CHIP[urgency]}`}>
                                  {urgency === 'overdue' ? t('overdue') : urgency === 'today' ? t('due_today') : t('tracker_urg_tomorrow')}
                                </span>
                              )}
                            </span>

                            {/* Status Mover Quick Actions */}
                            <div className="flex items-center gap-1">
                              {col.id === 'Not Started' && (
                                <button
                                  onClick={() => onUpdateStatus(task, 'In Progress')}
                                  className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[10px] font-bold text-[var(--text-primary)] transition-colors"
                                  title={t('tracker_move_progress')}
                                >
                                  {t('tracker_start')}
                                </button>
                              )}
                              {col.id === 'In Progress' && (
                                <button
                                  onClick={() => {
                                    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
                                    onUpdateStatus(task, 'Done');
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold transition-colors"
                                  title={t('tracker_mark_done_title')}
                                >
                                  {t('tracker_complete')}
                                </button>
                              )}
                              {col.id === 'Done' && (
                                <button
                                  onClick={() => onUpdateStatus(task, 'Not Started')}
                                  className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                  title={t('tracker_reopen')}
                                >
                                  {t('tracker_reopen')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="flex-1 min-h-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-y-auto shadow-xs">
          {isLoading ? (
            <div className="p-16 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-text)]" />
              <span className="text-xs font-semibold">{t('tracker_syncing_sheet')}</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-16 text-center text-[var(--text-muted)] space-y-2">
              <CheckSquare className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {t('tracker_empty_view')}
              </p>
            </div>
          ) : (
            <>
            {/* Mobile card view <768px — avoids min-w-[600px] horizontal scroll */}
            <div className="md:hidden p-3 space-y-2">
              {filteredAssignments.map(a=>{
                const isDone = a.status==='Done';
                const urgency = getUrgency(a);
                return (
                  <div key={a.id} onClick={()=>setSelectedAssignment(a)} className={`p-3 rounded-2xl border bg-[var(--bg-subtle)] border-[var(--border-default)] flex flex-col gap-1.5 ${isDone?'opacity-60':''} ${urgency ? URGENCY_TINT[urgency] : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] truncate">{a.subject}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.priority==='High'?'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{displayPriority(a.priority)}</span>
                    </div>
                    <div className={`text-xs font-bold truncate ${isDone?'line-through text-[var(--text-muted)]':''}`}>{a.assignmentName}</div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{t('tracker_due')} {a.dueDate || t('tracker_no_date')}</span>
                        <DueTrustBadge assignment={a} onConfirm={onConfirmDue} />
                        {urgency && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${URGENCY_CHIP[urgency]}`}>
                            {urgency === 'overdue' ? t('overdue') : urgency === 'today' ? t('due_today') : t('tracker_urg_tomorrow')}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px]">{displayStatus(a.status)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="py-2.5 px-3 w-10 text-center">{t('done')}</th>
                    <th className="py-2.5 px-3 w-32">{t('subject')}</th>
                    <th className="py-2.5 px-3">{t('tracker_th_name')}</th>
                    <th className="py-2.5 px-3 w-36">{t('due_date')}</th>
                    <th className="py-2.5 px-3 w-24 text-center">{t('priority')}</th>
                    <th className="py-2.5 px-3 w-20 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)] text-xs font-medium">
                  {filteredAssignments.map((assignment) => {
                    const isDone = assignment.status === 'Done';
                    const isSelected = selectedAssignment?.id === assignment.id;
                    const isHigh = assignment.priority === 'High';
                    const urgency = getUrgency(assignment);

                    return (
                      <tr
                        key={assignment.id}
                        onClick={() => setSelectedAssignment(assignment)}
                        className={`h-10 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[var(--bg-subtle)] font-semibold' : ''
                        } ${isDone ? 'opacity-60' : ''} ${urgency && !isSelected && !isDone ? URGENCY_TINT[urgency] : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleStatusClick(assignment)}
                            aria-label={t('tracker_toggle_status_aria')}
                            className="text-[var(--text-muted)] hover:text-[var(--accent-text)]  transition-colors"
                          >
                            {isDone ? (
                              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Subject Badge */}
                        <td className="py-1.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] truncate max-w-[120px] border border-[var(--status-warn-border)]">
                            {assignment.subject}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2 truncate">
                            <span className={`text-[var(--text-primary)] truncate ${isDone ? 'line-through text-[var(--text-muted)]' : ''}`}>
                              {assignment.assignmentName}
                            </span>
                            {effortEstimates[assignment.id] && (
                              <span className="text-[10px] text-[var(--accent-text)] font-mono shrink-0">
                                (~{effortEstimates[assignment.id].estimatedMinutes}m)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="py-1.5 px-3 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{assignment.dueDate || t('tracker_no_due_date')}</span>
                            <DueTrustBadge assignment={assignment} onConfirm={onConfirmDue} />
                            {urgency && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${URGENCY_CHIP[urgency]}`}>
                                {urgency === 'overdue' ? t('overdue') : urgency === 'today' ? t('due_today') : t('tracker_urg_tomorrow')}
                              </span>
                            )}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isHigh
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {displayPriority(assignment.priority)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-1.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-text)]  rounded-lg hover:bg-[var(--bg-hover)]"
                            title={t('tracker_inspect')}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* SLIDE-OVER INSPECTOR DRAWER */}
      {selectedAssignment && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] rounded-md">
                {selectedAssignment.subject}
              </span>
              <span className="text-xs font-bold text-[var(--text-primary)]">{t('tracker_inspector')}</span>
            </div>

            <button
              onClick={() => setSelectedAssignment(null)}
              className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                {selectedAssignment.assignmentName}
              </h3>
              <div className="space-y-1 text-[var(--text-muted)] text-[11px]">
                <div className="flex items-center justify-between">
                  <span>{t('status')}:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{displayStatus(selectedAssignment.status)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('due_date')}:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedAssignment.dueDate || t('tracker_none')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('priority')}:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{displayPriority(selectedAssignment.priority)}</span>
                </div>
              </div>
            </div>

            {/* Source & Deadline Verification Card (Judge Flow #1) */}
            {(selectedAssignment.sourceUrl ||
              selectedAssignment.aiEvidence ||
              selectedAssignment.dueStatus === 'unconfirmed' ||
              selectedAssignment.dueStatus === 'missing' ||
              !selectedAssignment.dueDate) && (
              <div className="p-3.5 rounded-2xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)]/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[var(--status-warn-text)] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('tracker_source_card_title')}</span>
                  </span>
                  <DueTrustBadge
                    assignment={selectedAssignment}
                    onConfirm={
                      onConfirmDue
                        ? (a) => {
                            onConfirmDue(a);
                            setSelectedAssignment({ ...a, dueStatus: 'confirmed' });
                          }
                        : undefined
                    }
                  />
                </div>
                {selectedAssignment.aiEvidence && (
                  <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed">
                    {t('gmail_ai_read_label')} “{selectedAssignment.aiEvidence}”
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {selectedAssignment.dueStatus === 'unconfirmed' && onConfirmDue && (
                    <button
                      type="button"
                      onClick={() => {
                        onConfirmDue(selectedAssignment);
                        setSelectedAssignment({ ...selectedAssignment, dueStatus: 'confirmed' });
                      }}
                      className="px-2.5 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>{t('tracker_confirm_now')}</span>
                    </button>
                  )}
                  {selectedAssignment.sourceUrl && (
                    <a
                      href={selectedAssignment.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 text-[var(--accent-text)]" />
                      <span>{t('gmail_open_email')}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* AI Estimation Card if present */}
            {effortEstimates[selectedAssignment.id] && (
              <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[var(--accent-text)]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('tracker_ai_matrix')}</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {effortEstimates[selectedAssignment.id].aiTip}
                </div>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-[var(--text-muted)]">
                  <span>{t('tracker_est_time')} {effortEstimates[selectedAssignment.id].estimatedMinutes} {t('minutes')}</span>
                  <span>•</span>
                  <span>{t('tracker_risk')} {effortEstimates[selectedAssignment.id].riskScore}/10</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedAssignment.notes && (
              <div>
                <span className="font-bold text-[var(--text-primary)] block mb-1">{t('notes')}</span>
                <div className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {selectedAssignment.notes}
                </div>
              </div>
            )}

            {/* Open Library Shortcut */}
            {onOpenLibrarySearch && (
              <button
                onClick={() => {
                  const q = selectedAssignment.subject && selectedAssignment.subject !== 'General' ? selectedAssignment.subject : selectedAssignment.assignmentName;
                  onOpenLibrarySearch(q);
                  setSelectedAssignment(null);
                }}
                className="w-full py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t('tracker_find_book_pre')} "{selectedAssignment.subject}" {t('tracker_find_book_post')}</span>
              </button>
            )}
          </div>

          <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhyIsThisHardTask(selectedAssignment)}
                className="px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title={t('tracker_cog_title')}
              >
                <Brain className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>{t('tracker_why_hard')}</span>
              </button>

              <button
                onClick={() => {
                  onScheduleStudyBlock(selectedAssignment);
                  setSelectedAssignment(null);
                }}
                className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>{t('tracker_schedule_block')}</span>
              </button>
            </div>

            <button
              onClick={() => handleStatusClick(selectedAssignment)}
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {selectedAssignment.status === 'Done' ? t('tracker_mark_incomplete') : t('mark_done')}
            </button>
          </div>
        </div>
      )}

      {/* Why Is This Hard Modal */}
      {whyIsThisHardTask && (
        <WhyIsThisHardModal
          isOpen={Boolean(whyIsThisHardTask)}
          onClose={() => setWhyIsThisHardTask(null)}
          assignmentTitle={whyIsThisHardTask.assignmentName}
          courseName={whyIsThisHardTask.subject}
          description={whyIsThisHardTask.notes}
          onStartFocusSession={(title) => {
            onScheduleStudyBlock(whyIsThisHardTask);
          }}
        />
      )}

      {/* Manual Add Assignment Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-x-0 top-0 h-[var(--app-viewport-height,100dvh)] bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="tracker-add-title" className="max-h-full overflow-y-auto overscroll-contain bg-[var(--bg-surface)] rounded-3xl max-w-md w-full border border-[var(--border-default)] shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
              <h3 id="tracker-add-title" className="text-sm font-bold text-[var(--text-primary)]">{t('tracker_new')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label={t('close')}
                className="size-10 grid place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div>
                <label htmlFor="assign-title" className="block font-bold text-[var(--text-primary)] mb-1">
                  {t('tracker_add_title_label')}
                </label>
                <input
                  id="assign-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('tracker_title_ph')}
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="assign-subject" className="block font-bold text-[var(--text-primary)] mb-1">{t('subject')}</label>
                  <input
                    id="assign-subject"
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                  />
                </div>

                <div>
                  <label htmlFor="assign-due" className="block font-bold text-[var(--text-primary)] mb-1">{t('due_date')}</label>
                  <input
                    id="assign-due"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="assign-priority" className="block font-bold text-[var(--text-primary)] mb-1">{t('priority')}</label>
                <select
                  id="assign-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                >
                  <option value="High">{t('tracker_priority_high')}</option>
                  <option value="Med">{t('tracker_priority_med')}</option>
                  <option value="Low">{t('tracker_priority_low')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="assign-notes" className="block font-bold text-[var(--text-primary)] mb-1">{t('tracker_notes_opt')}</label>
                <textarea
                  id="assign-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder={t('tracker_notes_ph')}
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-xl text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmitting ? t('tracker_saving') : t('tracker_add_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
