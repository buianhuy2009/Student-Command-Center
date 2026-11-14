import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Plus,
  FileText,
  Key,
  Search,
  Calendar,
  AlertTriangle,
  CheckSquare,
  FolderOpen,
  UploadCloud,
  SlidersHorizontal,
  Sparkles,
  Clock,
  ChevronRight,
  X,
  Share2,
  Sliders,
  Check,
  Brain,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { CanvasAssignment, CanvasSettings } from '../types';
import { loadCompletedCanvasIds, saveCompletedCanvasIds, resolveCanvasUrl, toMobileDeepLink, normalizeCanvasDomain } from '../services/canvas';
import { extractSubtasksFromCanvas, SubtaskResult, calculateGradePrediction } from '../services/gemini';
import { useT } from '../services/i18n';
import { WhyIsThisHardModal } from './WhyIsThisHardModal';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') { node.setAttribute('rel', 'noopener noreferrer'); }
});
const ALLOWED_TAGS = ['p', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'strong', 'em'];
const sanitizeAssignmentDescription = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'title', 'target'] });

// Local-midnight day-diff relative label for due dates (plain text only, XSS-safe).
const getRelativeDueLabel = (dueAt: string | null | undefined, t: ReturnType<typeof useT>['t']): string | null => {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startDue.getTime() - startToday.getTime()) / 86400000);
  if (diff === 0) return t('today').toLowerCase();
  if (diff === 1) return t('canvas_rel_tomorrow');
  if (diff > 1) return t('canvas_rel_in_days', { days: diff });
  if (diff === -1) return t('overdue').toLowerCase();
  return t('canvas_rel_overdue_days', { days: Math.abs(diff) });
};

interface CanvasSyncTabProps {
  settings: CanvasSettings;
  onSaveSettings: (settings: CanvasSettings) => void;
  canvasAssignments: CanvasAssignment[];
  isLoading: boolean;
  errorMessage?: string | null;
  lastSyncedAt?: Date | null;
  onFetchCanvas: (settingsOverride?: CanvasSettings) => void;
  onSyncToSheet: (assignment: CanvasAssignment) => Promise<void>;
  onSyncAllPending: () => Promise<void>;
  recentFiles?: any[];
  isGoogleConnected?: boolean;
  onSubmitAssignment?: (assignment: CanvasAssignment, fileId: string) => Promise<void>;
  googleToken?: string;
  onConnectGoogle?: () => void;
}

export const CanvasSyncTab: React.FC<CanvasSyncTabProps> = ({
  settings = { calendarFeedUrl: '', apiDomain: 'https://canvas.instructure.com', apiToken: '', autoSync: true },
  onSaveSettings,
  canvasAssignments = [],
  isLoading,
  errorMessage,
  lastSyncedAt,
  onFetchCanvas,
  onSyncToSheet,
  onSyncAllPending,
  recentFiles = [],
  isGoogleConnected = true,
  onSubmitAssignment,
  googleToken,
  onConnectGoogle,
}) => {
  const safeSettings = settings || { calendarFeedUrl: '', apiDomain: 'https://canvas.instructure.com', apiToken: '', autoSync: true };
  const [feedUrl, setFeedUrl] = useState(safeSettings.calendarFeedUrl || '');
  const [apiDomain, setApiDomain] = useState(safeSettings.apiDomain || 'https://canvas.instructure.com');
  const [apiToken, setApiToken] = useState(safeSettings.apiToken || '');
  const [autoSync, setAutoSync] = useState(safeSettings.autoSync ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  // Inline action errors (sync-all / Drive submit): never throw raw to the UI.
  const [actionError, setActionError] = useState<string | null>(null);

  // Keep drawer inputs in sync if settings are loaded/updated externally
  useEffect(() => {
    setFeedUrl(safeSettings.calendarFeedUrl || '');
    setApiDomain(safeSettings.apiDomain || 'https://canvas.instructure.com');
    setApiToken(safeSettings.apiToken || '');
    setAutoSync(safeSettings.autoSync ?? true);
  }, [safeSettings.calendarFeedUrl, safeSettings.apiDomain, safeSettings.apiToken, safeSettings.autoSync]);

  // Completion state loaded from local storage
  const [completedIds, setCompletedIds] = useState<string[]>(() => loadCompletedCanvasIds());

  // Filters
  const [activeTab, setActiveTab] = useState<'UNFINISHED' | 'ALL' | 'FINISHED'>('UNFINISHED');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected row for Slide-Over Inspector Drawer
  const [selectedAssignment, setSelectedAssignment] = useState<CanvasAssignment | null>(null);
  const [whyIsThisHardCanvasAssignment, setWhyIsThisHardCanvasAssignment] = useState<CanvasAssignment | null>(null);

  // AI Sub-task Extractor state
  const [subtaskData, setSubtaskData] = useState<Record<string, SubtaskResult>>({});
  const [extractingIds, setExtractingIds] = useState<Record<string, boolean>>({});
  const [checkedSubtasks, setCheckedSubtasks] = useState<Record<string, Set<number>>>({});

  // Google Drive submission state
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [isSubmittingDrive, setIsSubmittingDrive] = useState(false);
  // Grade predictor always visible — not just slider
  const [gradeCurrent, setGradeCurrent] = useState(84);
  const [gradeDesired, setGradeDesired] = useState(90);
  const [gradeFinalWeight, setGradeFinalWeight] = useState(30);
  const { t, formatDate, formatTime } = useT();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    const rawDomain = apiDomain.trim();
    const normalizedDomain = normalizeCanvasDomain(rawDomain);
    const trimmedToken = apiToken.trim();
    const trimmedFeed = feedUrl.trim();
    const isCustomDomain =
      rawDomain !== '' && normalizedDomain !== 'https://canvas.instructure.com';
    // Live token mode requires BOTH the Canvas school URL and an access token.
    if (!trimmedFeed && !trimmedToken) {
      setSettingsError(
        isCustomDomain
          ? t('canvas_err_need_token')
          : t('canvas_err_need_creds')
      );
      // Persist a custom URL so typed progress isn't lost, but never fire a
      // fetch with known-incomplete credentials — it can only fail confusingly.
      // The drawer stays open with the inline error above.
      if (isCustomDomain) {
        setApiDomain(normalizedDomain);
        onSaveSettings({
          calendarFeedUrl: '',
          apiDomain: normalizedDomain,
          apiToken: '',
          autoSync,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      return;
    }
    if (!trimmedFeed && trimmedToken && !rawDomain) {
      setSettingsError(t('canvas_err_need_url'));
      return;
    }
    setIsSaving(true);
    const updated = {
      calendarFeedUrl: trimmedFeed,
      apiDomain: normalizedDomain,
      apiToken: trimmedToken,
      autoSync,
      lastSyncedAt: new Date().toISOString(),
    };
    setApiDomain(normalizedDomain);
    onSaveSettings(updated);
    // Pass `updated` explicitly: the parent's fetch callback would otherwise
    // close over the previous settings state and sync with empty credentials,
    // clearing the list with no error (silent "load none" bug).
    setTimeout(() => {
      setIsSaving(false);
      onFetchCanvas(updated);
      setShowSettingsDrawer(false);
    }, 300);
  };

  const handleToggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveCompletedCanvasIds(next);
      return next;
    });
  };

  const handleExtractSubtasks = async (assignment: CanvasAssignment) => {
    setActionError(null);
    setExtractingIds((prev) => ({ ...prev, [assignment.id]: true }));
    try {
      const result = await extractSubtasksFromCanvas(assignment);
      setSubtaskData((prev) => ({ ...prev, [assignment.id]: result }));
    } catch (err: any) {
      console.error('Error extracting subtasks:', err);
      setActionError(err?.message || t('canvas_subtask_ai_err'));
    } finally {
      setExtractingIds((prev) => ({ ...prev, [assignment.id]: false }));
    }
  };

  const handleToggleSubtaskCheck = (assignmentId: string, index: number) => {
    setCheckedSubtasks((prev) => {
      const current = new Set(prev[assignmentId] || []);
      if (current.has(index)) current.delete(index);
      else current.add(index);
      return { ...prev, [assignmentId]: current };
    });
  };

  const handleSubmitDriveFile = async (assignment: CanvasAssignment) => {
    if ((!isGoogleConnected || !googleToken) && onConnectGoogle) {
      onConnectGoogle();
      return;
    }
    if (!onSubmitAssignment || !selectedFileId) return;
    setIsSubmittingDrive(true);
    setActionError(null);
    try {
      await onSubmitAssignment(assignment, selectedFileId);
      setSelectedFileId('');
    } catch (err: any) {
      setActionError(err?.message || t('canvas_submit_err'));
    } finally {
      setIsSubmittingDrive(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setActionError(null);
    try {
      await onSyncAllPending();
    } catch (err: any) {
      setActionError(err?.message || t('canvas_sync_all_err'));
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Course list
  const courses = useMemo(() => {
    return Array.from(new Set((canvasAssignments || []).map((a) => a?.courseName).filter(Boolean)));
  }, [canvasAssignments]);

  const unfinishedCount = useMemo(() => {
    return (canvasAssignments || []).filter((a) => a && !a.isCompleted && !(Array.isArray(completedIds) && completedIds.includes(a.id))).length;
  }, [canvasAssignments, completedIds]);

  const pendingSyncAssignments = useMemo(() => {
    return (canvasAssignments || []).filter((a) => a && !a.isSynced);
  }, [canvasAssignments]);

  const filteredAssignments = useMemo(() => {
    return (canvasAssignments || []).filter((a) => {
      if (!a) return false;
      const isCompleted = a.isCompleted || (Array.isArray(completedIds) && completedIds.includes(a.id));
      if (activeTab === 'UNFINISHED' && isCompleted) return false;
      if (activeTab === 'FINISHED' && !isCompleted) return false;
      if (selectedCourse !== 'ALL' && a.courseName !== selectedCourse) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (a.name || '').toLowerCase().includes(q);
        const matchCourse = (a.courseName || '').toLowerCase().includes(q);
        if (!matchName && !matchCourse) return false;
      }
      return true;
    });
  }, [canvasAssignments, activeTab, selectedCourse, searchQuery, completedIds]);

  const isApiConfigured = Boolean(
    safeSettings.apiToken?.trim() && safeSettings.apiDomain?.trim()
  );
  const isConfigured = Boolean(safeSettings.calendarFeedUrl?.trim() || isApiConfigured);

  return (
    <div className="space-y-4">
      {/* Sync error banner — single channel (no duplicate toast). Ember palette. */}
      {errorMessage && (() => {
        const isHostNotAllowlisted = /host-not-allowlisted|not on.*allowlist|allowlist/i.test(errorMessage);
        return (
          <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 text-[var(--accent-text)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                {isHostNotAllowlisted ? t('canvas_host_not_allowed_t') : t('canvas_sync_failed')}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 break-words">{errorMessage}</p>
              {isHostNotAllowlisted ? (
                <div className="mt-2 p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">{t('canvas_host_not_allowed_intro')}</p>
                  <p>{t('canvas_host_not_allowed_s1')}</p>
                  <p>{t('canvas_host_not_allowed_s2')}</p>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">{t('canvas_kept_below')}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {isHostNotAllowlisted && (
                <button
                  onClick={() => setShowSettingsDrawer(true)}
                  className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> {t('canvas_btn_conn_settings')}
                </button>
              )}
              <button
                onClick={() => onFetchCanvas()}
                className="px-3 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold shrink-0 min-h-[44px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('retry')}
              </button>
            </div>
          </div>
        );
      })()}
      {/* Inline action-error banner (sync-all / Drive submit) — same channel, no raw throws. */}
      {actionError && !errorMessage && (
        <div className="p-3 rounded-2xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] flex items-start gap-2.5" role="alert">
          <AlertTriangle className="w-4 h-4 text-[var(--status-warn-text)] shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-[var(--status-warn-text)] break-words">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-[var(--status-warn-text)] hover:opacity-70 shrink-0"
            aria-label={t('common_dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Filter & Actions Header */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        
        {/* Left: Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => setActiveTab('UNFINISHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNFINISHED'
                ? 'bg-[var(--accent-fill)] text-white shadow-xs ring-2 ring-[var(--accent-fill)]/50'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]'
            }`}
          >
            <span>{t('unfinished')}</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeTab === 'UNFINISHED' ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10'
            }`}>
              {unfinishedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-xs ring-2 ring-[var(--text-primary)]/20'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]'
            }`}
          >
            <span>{t('all')}</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10'
            }`}>
              {canvasAssignments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FINISHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FINISHED'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/50'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]'
            }`}
          >
            <span>{t('finished')}</span>
          </button>
        </div>

        {/* Right: Search, Course Dropdown & Sync Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('filter_tasks')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
            />
          </div>

          {/* Course Selector */}
          {courses.length > 0 && (
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-semibold cursor-pointer outline-none"
            >
              <option value="ALL">{t('all_courses')}</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {/* Sync All Button */}
          {pendingSyncAssignments.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs shadow-[var(--accent-fill)]/20"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t('canvas_sync_count', { count: pendingSyncAssignments.length })}</span>
            </button>
          )}

          {/* Config Drawer Toggle */}
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="p-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-secondary)] rounded-xl transition-colors cursor-pointer"
            title={t('canvas_settings_title')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Drawer Overlay if Opened */}
      {showSettingsDrawer && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--accent-text)]" />
              <h3 className="text-xs font-bold text-[var(--text-primary)]">
                {t('canvas_settings_title')}
              </h3>
            </div>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[var(--text-primary)] mb-1">
                {t('canvas_url_label')} <span className="text-rose-500">*</span>
                <span className="ml-1 font-normal text-[var(--text-muted)]">{t('canvas_url_req')}</span>
              </label>
              <input
                type="text"
                value={apiDomain}
                onChange={(e) => setApiDomain(e.target.value)}
                onBlur={() => setApiDomain((v) => (v.trim() ? normalizeCanvasDomain(v) : v))}
                placeholder={t('canvas_url_ph')}
                inputMode="url"
                className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                {t('canvas_url_hint')}
              </p>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-primary)] mb-1">
                {t('canvas_token_label')} <span className="text-rose-500">*</span>
                <span className="ml-1 font-normal text-[var(--text-muted)]">{t('canvas_token_req')}</span>
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={t('canvas_token_ph')}
                className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                {t('canvas_token_hint_1')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                {t('canvas_token_hint_2')}
              </p>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-primary)] mb-1">
                {t('canvas_feed_label')}
                <span className="ml-1 font-normal text-[var(--text-muted)]">{t('canvas_feed_opt')}</span>
              </label>
              <input
                type="text"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder={t('canvas_feed_ph')}
                className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
              />
            </div>

            {settingsError && (
              <div className="sm:col-span-2 p-3 rounded-xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-[11px] text-[var(--status-warn-text)]" role="alert">
                {settingsError}
              </div>
            )}

            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
              >
                {isSaving ? t('canvas_saving_syncing') : t('canvas_save_sync')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grade What-If Predictor — accordion (collapsed) */}
      <details className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-xs group">
        <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold">{t('grade_predictor')} <span className="px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[10px]">{t('expand')}</span></summary>
        <div className="mt-3">
        <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-[var(--accent-text)]" strokeWidth={1.75} /> {t('grade_predictor')}</h4>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <label className="space-y-1"><span className="text-[11px] font-bold text-[var(--text-muted)]">{t('canvas_grade_current')}</span><input type="number" value={gradeCurrent} onChange={e=>setGradeCurrent(parseInt(e.target.value)||0)} className="w-full px-2 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg text-sm font-mono" /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-[var(--text-muted)]">{t('canvas_grade_desired')}</span><input type="number" value={gradeDesired} onChange={e=>setGradeDesired(parseInt(e.target.value)||0)} className="w-full px-2 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg text-sm font-mono" /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-[var(--text-muted)]">{t('canvas_grade_weight')}</span><input type="range" min={10} max={50} value={gradeFinalWeight} onChange={e=>setGradeFinalWeight(parseInt(e.target.value))} className="w-full accent-[var(--accent-fill)]" /><span className="text-[11px] font-mono">{gradeFinalWeight}%</span></label>
        </div>
        {(() => {
          const r = calculateGradePrediction({ currentGrade: gradeCurrent, desiredGrade: gradeDesired, finalExamWeight: gradeFinalWeight });
          const statusLabel = r.status === 'Guaranteed' ? t('canvas_grade_status_guaranteed')
            : r.status === 'Achievable' ? t('canvas_grade_status_achievable')
            : r.status === 'Challenging' ? t('canvas_grade_status_challenging')
            : t('canvas_grade_status_unlikely');
          return (
            <div className="mt-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs space-y-1">
              <div className="flex items-center justify-between"><span className="font-bold">{t('canvas_grade_need')} <span className="text-[var(--accent-text)]">{r.requiredFinalScore}%</span></span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status==='Guaranteed'?'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]': r.status==='Achievable'?'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]': r.status==='Challenging'?'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]':'bg-[var(--status-err-bg)] text-[var(--status-err-text)] border border-[var(--status-err-border)]'}`}>{statusLabel}</span></div>
              <p className="text-[11px] text-[var(--text-muted)]">{r.feedback}</p>
              <p className="text-[11px] text-[var(--text-muted)] italic">{t('canvas_grade_note')}</p>
            </div>
          );
        })()}
        </div>
      </details>

      {/* Main High-Density macOS Table View (40px Rows) */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-semibold">{t('canvas_syncing_live')}</span>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-16 text-center text-[var(--text-muted)] space-y-2">
            <Layers className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {isConfigured
                ? (canvasAssignments.length === 0
                  ? t('canvas_empty_title')
                  : t('all_caught_up'))
                : t('canvas_not_connected')}
            </p>
            <p className="text-[11px] max-w-sm mx-auto">
              {isConfigured
                ? (canvasAssignments.length === 0
                  ? t('canvas_empty_hint')
                  : '')
                : t('canvas_not_connected_hint')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2.5 px-3 w-10 text-center">{t('done')}</th>
                  <th className="py-2.5 px-3 w-36">{t('canvas_th_course')}</th>
                  <th className="py-2.5 px-3">{t('canvas_th_title')}</th>
                  <th className="py-2.5 px-3 w-40">{t('due_date')}</th>
                  <th className="py-2.5 px-3 w-28 text-center">{t('status')}</th>
                  <th className="py-2.5 px-3 w-24 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-xs font-medium">
                {filteredAssignments.map((assignment) => {
                  const isCompleted = assignment.isCompleted || completedIds.includes(assignment.id);
                  const isSelected = selectedAssignment?.id === assignment.id;
                  const isDueSoon =
                    assignment.dueAt &&
                    new Date(assignment.dueAt).getTime() - Date.now() < 86400000 * 3 &&
                    new Date(assignment.dueAt).getTime() > Date.now();
                  const relativeDueLabel = getRelativeDueLabel(assignment.dueAt, t);

                  return (
                    <tr
                      key={assignment.id}
                      onClick={() => setSelectedAssignment(assignment)}
                      className={`h-10 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--bg-subtle)] font-semibold' : ''
                      } ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => handleToggleComplete(assignment.id)}
                          className="w-4 h-4 rounded text-[var(--accent-text)] focus:ring-[var(--accent-fill)] cursor-pointer"
                        />
                      </td>

                      {/* Course Badge */}
                      <td className="py-1.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] truncate max-w-[130px]">
                          {assignment.courseName}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-[var(--text-primary)] truncate ${isCompleted ? 'text-[var(--text-muted)]' : ''}`}>
                            {assignment.name}
                          </span>
                          {assignment.pointsPossible !== undefined && (
                            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                              ({t('canvas_pts', { pts: assignment.pointsPossible })})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-1.5 px-3 whitespace-nowrap text-[11px]">
                        <span className={isDueSoon ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-[var(--text-muted)]'}>
                          {assignment.dueAt ? formatDate(assignment.dueAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('gmail_no_due')}
                        </span>
                        {relativeDueLabel && (
                          <span className="ml-1 text-[var(--text-muted)]">· {relativeDueLabel}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3 text-center">
                        {assignment.isSynced ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                            {t('canvas_status_synced')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded">
                            {t('canvas_status_pending')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-text)] rounded-lg hover:bg-[var(--bg-hover)]"
                            title={t('view')}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLIDE-OVER INSPECTOR DRAWER */}
      {selectedAssignment && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          
          {/* Drawer Header */}
          <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] rounded-md">
                {selectedAssignment.courseName}
              </span>
              <span className="text-xs font-bold text-[var(--text-primary)]">{t('view')}</span>
            </div>

            <button
              onClick={() => setSelectedAssignment(null)}
              className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            
            {/* Title & Metadata */}
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                {selectedAssignment.name}
              </h3>
              <div className="space-y-1 text-[var(--text-muted)] text-[11px]">
                <div className="flex items-center justify-between">
                  <span>{t('due_date')}:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {selectedAssignment.dueAt ? `${formatDate(selectedAssignment.dueAt)} ${formatTime(selectedAssignment.dueAt)}` : t('gmail_no_due')}
                    {getRelativeDueLabel(selectedAssignment.dueAt, t) && (
                      <span className="ml-1 font-normal text-[var(--text-muted)]">· {getRelativeDueLabel(selectedAssignment.dueAt, t)}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('canvas_points_possible')}</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {selectedAssignment.pointsPossible ?? t('canvas_unspecified')}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Sub-task Extractor */}
            <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>{t('canvas_subtasks_title')}</span>
                </div>

                {!subtaskData[selectedAssignment.id] && (
                  <button
                    onClick={() => handleExtractSubtasks(selectedAssignment)}
                    disabled={extractingIds[selectedAssignment.id]}
                    className="px-2.5 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-lg text-[10px] cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className={`w-3 h-3 ${extractingIds[selectedAssignment.id] ? 'animate-spin' : ''}`} />
                    <span>{extractingIds[selectedAssignment.id] ? t('canvas_extracting') : t('canvas_deconstruct')}</span>
                  </button>
                )}
              </div>

              {subtaskData[selectedAssignment.id] && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {t('canvas_difficulty', { difficulty: subtaskData[selectedAssignment.id].difficulty, minutes: subtaskData[selectedAssignment.id].totalEstimatedMinutes })}
                  </div>
                  <div className="space-y-1.5">
                    {subtaskData[selectedAssignment.id].subtasks.map((st, idx) => {
                      const isChecked = checkedSubtasks[selectedAssignment.id]?.has(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded-xl border transition-colors cursor-pointer text-[11px] ${
                            isChecked
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 line-through text-[var(--text-muted)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(isChecked)}
                            onChange={() => handleToggleSubtaskCheck(selectedAssignment.id, idx)}
                            className="mt-0.5 rounded text-[var(--accent-text)] focus:ring-[var(--accent-fill)]"
                          />
                          <span className="flex-1 leading-tight">{st.title} (~{st.estimatedMinutes}m)</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Google Drive Submission Picker */}
            {onSubmitAssignment && (
              <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t('canvas_submit_drive_title')}</span>
                </div>

                {recentFiles.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedFileId}
                      onChange={(e) => setSelectedFileId(e.target.value)}
                      className="w-full p-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[11px] outline-none"
                    >
                      <option value="">{t('canvas_pick_drive_file')}</option>
                      {recentFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleSubmitDriveFile(selectedAssignment)}
                      disabled={isSubmittingDrive || !selectedFileId}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      {isSubmittingDrive ? t('canvas_submitting') : t('canvas_submit_btn')}
                    </button>
                  </div>
                ) : !isGoogleConnected && onConnectGoogle ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {t('canvas_connect_drive_hint')}
                    </p>
                    <button
                      type="button"
                      onClick={onConnectGoogle}
                      className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      {t('canvas_connect_drive_btn')}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {t('canvas_no_drive_files')}
                  </p>
                )}
              </div>
            )}

            {/* Description & Rubric */}
            {selectedAssignment.description && (
              <div>
                <span className="font-bold text-[var(--text-primary)] block mb-1">
                  {t('canvas_instructions')}
                </span>
                <div
                  className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] max-h-48 overflow-y-auto leading-relaxed prose dark:prose-invert prose-xs"
                  dangerouslySetInnerHTML={{ __html: sanitizeAssignmentDescription(typeof selectedAssignment.description === 'string' ? selectedAssignment.description : '') }}
                />
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhyIsThisHardCanvasAssignment(selectedAssignment)}
                className="px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title={t('tracker_cog_title')}
              >
                <Brain className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>{t('tracker_why_hard')}</span>
              </button>

              <button
                onClick={() => onSyncToSheet(selectedAssignment)}
                className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {t('canvas_sync_to_sheet')}
              </button>
            </div>

            <a
              href={resolveCanvasUrl(
                selectedAssignment.htmlUrl,
                settings.apiDomain,
                settings.calendarFeedUrl,
                selectedAssignment.courseId,
                selectedAssignment.id
              )}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span>{t('canvas_open_in_canvas')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Why Is This Hard Modal */}
      {whyIsThisHardCanvasAssignment && (
        <WhyIsThisHardModal
          isOpen={Boolean(whyIsThisHardCanvasAssignment)}
          onClose={() => setWhyIsThisHardCanvasAssignment(null)}
          assignmentTitle={whyIsThisHardCanvasAssignment.name}
          courseName={whyIsThisHardCanvasAssignment.courseName}
          description={whyIsThisHardCanvasAssignment.description}
        />
      )}
    </div>
  );
};
