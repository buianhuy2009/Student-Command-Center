import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Assignment, PriorityLevel, AssignmentStatus, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { estimateAssignmentEffort, EffortEstimate } from '../services/gemini';
import { t, useLang } from '../services/i18n';
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

export function getUrgencyInfo(dueDateStr?: string, isDone?: boolean) {
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
    return { state: 'overdue' as const, label: URGENCY_LABEL.overdue, chip: URGENCY_CHIP.overdue, tint: URGENCY_TINT.overdue };
  }
  if (diff === 0) {
    return { state: 'today' as const, label: URGENCY_LABEL.today, chip: URGENCY_CHIP.today, tint: URGENCY_TINT.today };
  }
  if (diff === 1) {
    return { state: 'tomorrow' as const, label: URGENCY_LABEL.tomorrow, chip: URGENCY_CHIP.tomorrow, tint: URGENCY_TINT.tomorrow };
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
    'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
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
  today: 'bg-amber-50/40 dark:bg-amber-950/20',
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
  const [showArchived, setShowArchived] = useState(false);
  const [isClearingDone, setIsClearingDone] = useState(false);
  const [showAiAdd, setShowAiAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  useLang();

  // Selected row for Slide-Over Inspector Sheet
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [whyIsThisHardTask, setWhyIsThisHardTask] = useState<Assignment | null>(null);

  // AI Dynamic Priority & Effort state
  const [effortEstimates, setEffortEstimates] = useState<Record<string, EffortEstimate>>({});
  const [isEstimating, setIsEstimating] = useState(false);
  const [sortByAIFocus, setSortByAIFocus] = useState(false);

  const handleRunAIEstimates = async () => {
    setIsEstimating(true);
    try {
      const estimates = await estimateAssignmentEffort(assignments);
      const map: Record<string, EffortEstimate> = {};
      estimates.forEach((e) => {
        map[e.id] = e;
      });
      setEffortEstimates(map);
      setSortByAIFocus(true);
    } catch (err) {
      console.error('Error running AI estimates:', err);
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
  }, [assignments, searchQuery, filterSubject, filterStatus, filterPriority, showArchived, sortByAIFocus, effortEstimates]);

  const doneCount = assignments.filter((a) => a.status === 'Done').length;
  const highCount = assignments.filter((a) => a.priority === 'High' && a.status !== 'Done').length;

  const handleSyncClick = () => {
    if (!isGoogleConnected) {
      // Show guidance instead of silent fail
      return;
    }
    onRefresh();
  };

  const handleExportCsv = () => {
    const escapeCsvCell = (value: string | undefined | null): string => {
      const str = value ?? '';
      return /["\n\r,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = ['Assignment Name', 'Subject', 'Due Date', 'Status', 'Priority', 'Notes'];
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
    <div className="space-y-4">
      {/* Google Sheets Disconnected Guidance Banner */}
      {!isGoogleConnected && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">{t('tracker_sheet_title')}</h4>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
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
                className="px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t('connect_google')}</span>
              </button>
            )}
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-white dark:bg-[#1A1917] border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              {t('tracker_try_anyway')}
            </button>
          </div>
        </div>
      )}
      {sheetApiInfo && (
        <ApiActivationBanner info={sheetApiInfo} onRetry={onRefresh} compact />
      )}
      {/* Top Header — decluttered: stats + search + 4 primary actions. Filters, export, sheet link live in the Filters panel below. */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">

        {/* Left: Summary Stats */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <span className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] px-1">
            {t('master_tracker')}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            {highCount} {t('high_priority')}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {doneCount} {t('done')}
          </span>
        </div>

        {/* Right: Primary actions only */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 text-[#8C897F] dark:text-[#B5B2A8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_tracker')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
            />
          </div>

          {/* View Mode Toggle: Table vs Kanban (timeline removed — Gantt lives in its own workspace) */}
          <div className="flex items-center bg-[#E8E6DC] dark:bg-[#1F1E1B] p-0.5 rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#252422] text-[#C96442] dark:text-[#E59A7C] shadow-2xs'
                  : 'text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#F5F4ED]'
              }`}
              title={t('tracker_view_table')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#252422] text-[#C96442] dark:text-[#E59A7C] shadow-2xs'
                  : 'text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#F5F4ED]'
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
                ? 'bg-[#C96442] text-white border-[#C96442]'
                : 'bg-[#E8E6DC] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442]'
            }`}
            title={t('tracker_filters_title')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Sync Sheet */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#F5F4ED] text-xs font-bold rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={t('tracker_sync_title')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C96442] dark:text-[#E59A7C] ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? t('syncing') : t('sync_sheet')}</span>
          </button>

          {/* Smart Add Toggle (AI Rank lives inside the expanded bar) */}
          <button
            onClick={() => setShowAiAdd(!showAiAdd)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showAiAdd
                ? 'bg-[#C96442] text-white border-[#C96442] shadow-xs'
                : 'bg-[#E8E6DC] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] border-[#E8E6DC] dark:border-[#2C2B27]'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${showAiAdd ? 'text-white' : 'text-[#C96442] dark:text-[#E59A7C]'}`} />
            <span className="hidden sm:inline">{t('smart_add')}</span>
          </button>

          {/* New Task Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('new_task')}</span>
          </button>
        </div>
      </div>

      {/* Filters panel — secondary controls live here, out of the main row */}
      {showFilters && (
        <div className="bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-2xl p-3 shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_subjects')}</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_status')}</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">{t('done')}</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-semibold cursor-pointer outline-none"
          >
            <option value="ALL">{t('tracker_all_priority')}</option>
            <option value="High">High</option>
            <option value="Med">Med</option>
            <option value="Low">Low</option>
          </select>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#F5F4ED] text-xs font-bold rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] transition-all flex items-center gap-1.5 cursor-pointer"
            title={t('tracker_export_title')}
          >
            <FileText className="w-3.5 h-3.5 text-[#C96442] dark:text-[#E59A7C]" />
            <span>{t('export_csv')}</span>
          </button>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] text-[#5C5A54] dark:text-[#B5B2A8] text-xs font-semibold rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] transition-all flex items-center gap-1 cursor-pointer"
              title={t('tracker_open_sheet_title')}
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#0F9D58] dark:text-[#4ADE80]" />
              <span className="text-[11px]">{t('open_sheet')}</span>
            </a>
          )}
        </div>
      )}

      {/* Smart Add Bar — natural-language add + AI Rank merged here (out of main toolbar) */}
      {showAiAdd && (
        <form
          onSubmit={handleQuickSubmit}
          className="bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-2xl p-3 shadow-xs flex items-center gap-2 animate-in fade-in flex-wrap"
        >
          <Sparkles className="w-4 h-4 text-[#C96442] dark:text-[#E59A7C] shrink-0 ml-1" />
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={t('smart_add_placeholder')}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
          />
          <button
            type="button"
            onClick={handleRunAIEstimates}
            disabled={isEstimating || assignments.length === 0}
            className="px-3 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] hover:bg-[#E8E6DC] text-xs font-bold rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title={t('tracker_ai_title')}
          >
            <Zap className={`w-3.5 h-3.5 text-[#C96442] dark:text-[#E59A7C] ${isEstimating ? 'animate-bounce' : ''}`} />
            <span>{isEstimating ? '…' : sortByAIFocus ? '✓ AI' : t('tracker_ai_rank')}</span>
          </button>
          <button
            type="submit"
            disabled={isParsingAI || !quickInput.trim()}
            className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isParsingAI ? '…' : t('add')}
          </button>
        </form>
      )}

      {/* VIEW RENDERER: TABLE | BOARD (timeline Gantt removed — lives in its own workspace) */}
      {viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-150">
          {(
            [
              { id: 'Not Started', label: t('tracker_col_todo'), color: 'border-amber-200 dark:border-amber-900/60' },
              { id: 'In Progress', label: t('tracker_col_progress'), color: 'border-blue-200 dark:border-blue-900/60' },
              { id: 'Done', label: t('tracker_col_done'), color: 'border-emerald-200 dark:border-emerald-900/60' },
            ] as { id: 'Not Started' | 'In Progress' | 'Done'; label: string; color: string }[]
          ).map((col) => {
            const colTasks = filteredAssignments.filter((a) => a.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] p-4 shadow-xs flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8E6DC]/60 dark:border-[#2C2B27]/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#141413] dark:text-[#F5F4ED]">
                      {col.label}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8E6DC] dark:bg-[#252422] text-[#8C897F] dark:text-[#B5B2A8] border border-[#E8E6DC] dark:border-[#2C2B27]">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[600px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-[#8C897F] dark:text-[#B5B2A8]">
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
                          className={`p-3.5 rounded-xl border bg-[#E8E6DC] dark:bg-[#1F1E1B] border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442]/80 transition-all cursor-pointer space-y-2.5 shadow-2xs group ${
                            isDone ? 'opacity-70' : ''
                          } ${urgency ? URGENCY_TINT[urgency] : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 truncate max-w-[130px]">
                              {task.subject}
                            </span>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                isHigh
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-bold text-[#141413] dark:text-[#F5F4ED] leading-snug line-clamp-2 ${
                              isDone ? 'line-through text-[#8C897F] dark:text-[#B5B2A8]' : ''
                            }`}
                          >
                            {task.assignmentName}
                          </h4>

                          {effortEstimates[task.id] && (
                            <div className="text-[10px] text-[#C96442] dark:text-[#E59A7C] font-semibold flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span>{t('tracker_est')} {effortEstimates[task.id].estimatedMinutes} {t('minutes')}</span>
                            </div>
                          )}

                          {/* Footer with Due Date & Status Mover */}
                          <div
                            className="flex items-center justify-between pt-2 border-t border-[#E8E6DC]/40 dark:border-[#2C2B27]/40 text-[11px] text-[#8C897F] dark:text-[#B5B2A8]"
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
                                  className="px-2 py-0.5 rounded bg-white dark:bg-[#252422] border border-[#E8E6DC] hover:border-[#C96442] text-[10px] font-bold text-[#141413] dark:text-[#F5F4ED] transition-colors"
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
                                  className="px-2 py-0.5 rounded bg-white dark:bg-[#252422] border border-[#E8E6DC] text-[10px] font-bold text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#F5F4ED] transition-colors"
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
        <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-16 text-center text-[#8C897F] dark:text-[#B5B2A8] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C96442] dark:text-[#E59A7C]" />
              <span className="text-xs font-semibold">{t('tracker_syncing_sheet')}</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-16 text-center text-[#8C897F] dark:text-[#B5B2A8] space-y-2">
              <CheckSquare className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
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
                  <div key={a.id} onClick={()=>setSelectedAssignment(a)} className={`p-3 rounded-2xl border bg-[#E8E6DC] dark:bg-[#1F1E1B] border-[#E8E6DC] dark:border-[#2C2B27] flex flex-col gap-1.5 ${isDone?'opacity-60':''} ${urgency ? URGENCY_TINT[urgency] : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 truncate">{a.subject}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.priority==='High'?'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{a.priority}</span>
                    </div>
                    <div className={`text-xs font-bold truncate ${isDone?'line-through text-[#6B6860] dark:text-[#B5B2A8]':''}`}>{a.assignmentName}</div>
                    <div className="flex items-center justify-between text-[11px] text-[#6B6860] dark:text-[#B5B2A8]">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{t('tracker_due')} {a.dueDate || t('tracker_no_date')}</span>
                        <DueTrustBadge assignment={a} onConfirm={onConfirmDue} />
                        {urgency && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${URGENCY_CHIP[urgency]}`}>
                            {urgency === 'overdue' ? t('overdue') : urgency === 'today' ? t('due_today') : t('tracker_urg_tomorrow')}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px]">{a.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6DC]/80 dark:border-[#2C2B27]/80 bg-[#E8E6DC] dark:bg-[#1F1E1B] text-[10px] font-bold uppercase tracking-wider text-[#6B6860] dark:text-[#B5B2A8]">
                    <th className="py-2.5 px-3 w-10 text-center">{t('done')}</th>
                    <th className="py-2.5 px-3 w-32">{t('subject')}</th>
                    <th className="py-2.5 px-3">{t('tracker_th_name')}</th>
                    <th className="py-2.5 px-3 w-36">{t('due_date')}</th>
                    <th className="py-2.5 px-3 w-24 text-center">{t('priority')}</th>
                    <th className="py-2.5 px-3 w-20 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E6DC]/40 dark:divide-[#2C2B27]/40 text-xs font-medium">
                  {filteredAssignments.map((assignment) => {
                    const isDone = assignment.status === 'Done';
                    const isSelected = selectedAssignment?.id === assignment.id;
                    const isHigh = assignment.priority === 'High';
                    const urgency = getUrgency(assignment);

                    return (
                      <tr
                        key={assignment.id}
                        onClick={() => setSelectedAssignment(assignment)}
                        className={`h-10 hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#E8E6DC] dark:bg-[#1F1E1B] font-semibold' : ''
                        } ${isDone ? 'opacity-60' : ''} ${urgency && !isSelected && !isDone ? URGENCY_TINT[urgency] : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleStatusClick(assignment)}
                            className="text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#C96442] dark:hover:text-[#E59A7C] transition-colors"
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
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 truncate max-w-[120px] border border-amber-200 dark:border-amber-800/60">
                            {assignment.subject}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2 truncate">
                            <span className={`text-[#141413] dark:text-[#F5F4ED] truncate ${isDone ? 'line-through text-[#8C897F] dark:text-[#B5B2A8]' : ''}`}>
                              {assignment.assignmentName}
                            </span>
                            {effortEstimates[assignment.id] && (
                              <span className="text-[10px] text-[#C96442] dark:text-[#E59A7C] font-mono shrink-0">
                                (~{effortEstimates[assignment.id].estimatedMinutes}m)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="py-1.5 px-3 whitespace-nowrap text-[11px] text-[#8C897F] dark:text-[#B5B2A8]">
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
                            {assignment.priority}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-1.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="p-1 text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#C96442] dark:hover:text-[#E59A7C] rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#252422]"
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
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-[#1A1917] border-l border-[#E8E6DC] dark:border-[#2C2B27] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-[#E8E6DC] dark:border-[#2C2B27] bg-[#E8E6DC] dark:bg-[#1F1E1B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 rounded-md">
                {selectedAssignment.subject}
              </span>
              <span className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">{t('tracker_inspector')}</span>
            </div>

            <button
              onClick={() => setSelectedAssignment(null)}
              className="p-1.5 text-[#8C897F] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#252422] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F4ED] mb-2">
                {selectedAssignment.assignmentName}
              </h3>
              <div className="space-y-1 text-[#8C897F] dark:text-[#B5B2A8] text-[11px]">
                <div className="flex items-center justify-between">
                  <span>{t('status')}:</span>
                  <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">{selectedAssignment.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('due_date')}:</span>
                  <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">{selectedAssignment.dueDate || t('tracker_none')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('priority')}:</span>
                  <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">{selectedAssignment.priority}</span>
                </div>
              </div>
            </div>

            {/* AI Estimation Card if present */}
            {effortEstimates[selectedAssignment.id] && (
              <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[#C96442] dark:text-[#E59A7C]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('tracker_ai_matrix')}</span>
                </div>
                <div className="text-[11px] text-[#5C5A54] dark:text-[#B5B2A8]">
                  {effortEstimates[selectedAssignment.id].aiTip}
                </div>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-[#8C897F] dark:text-[#B5B2A8]">
                  <span>{t('tracker_est_time')} {effortEstimates[selectedAssignment.id].estimatedMinutes} {t('minutes')}</span>
                  <span>•</span>
                  <span>{t('tracker_risk')} {effortEstimates[selectedAssignment.id].riskScore}/10</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedAssignment.notes && (
              <div>
                <span className="font-bold text-[#141413] dark:text-[#F5F4ED] block mb-1">{t('notes')}</span>
                <div className="p-3 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed">
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

          <div className="p-4 border-t border-[#E8E6DC] dark:border-[#2C2B27] bg-[#E8E6DC] dark:bg-[#1F1E1B] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhyIsThisHardTask(selectedAssignment)}
                className="px-3 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title={t('tracker_cog_title')}
              >
                <Brain className="w-3.5 h-3.5 text-[#C96442] dark:text-[#E59A7C]" />
                <span>{t('tracker_why_hard')}</span>
              </button>

              <button
                onClick={() => {
                  onScheduleStudyBlock(selectedAssignment);
                  setSelectedAssignment(null);
                }}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-[#C96442] dark:text-[#E59A7C]" />
                <span>{t('tracker_schedule_block')}</span>
              </button>
            </div>

            <button
              onClick={() => handleStatusClick(selectedAssignment)}
              className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
      {showAddModal && (
        <div className="fixed inset-0 bg-[#141413]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-md w-full border border-[#E8E6DC] dark:border-[#2C2B27] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6DC]/60 dark:border-[#2C2B27]/60">
              <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F4ED]">{t('tracker_new')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#F5F4ED]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div>
                <label htmlFor="assign-title" className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">
                  {t('tracker_add_title_label')}
                </label>
                <input
                  id="assign-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('tracker_title_ph')}
                  className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C96442]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="assign-subject" className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">{t('subject')}</label>
                  <input
                    id="assign-subject"
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C96442]"
                  />
                </div>

                <div>
                  <label htmlFor="assign-due" className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">{t('due_date')}</label>
                  <input
                    id="assign-due"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C96442]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="assign-priority" className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">{t('priority')}</label>
                <select
                  id="assign-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C96442]"
                >
                  <option value="High">High</option>
                  <option value="Med">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="assign-notes" className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">{t('tracker_notes_opt')}</label>
                <textarea
                  id="assign-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder={t('tracker_notes_ph')}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C96442]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmitting ? t('tracker_saving') : t('tracker_add_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
