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
import { t, useLang } from '../services/i18n';
import { WhyIsThisHardModal } from './WhyIsThisHardModal';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') { node.setAttribute('rel', 'noopener noreferrer'); }
});
const ALLOWED_TAGS = ['p', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'strong', 'em'];
const sanitizeAssignmentDescription = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'title', 'target'] });

// Local-midnight day-diff relative label for due dates (plain text only, XSS-safe).
const getRelativeDueLabel = (dueAt?: string | null): string | null => {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startDue.getTime() - startToday.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1) return `in ${diff}d`;
  if (diff === -1) return 'overdue';
  return `overdue ${Math.abs(diff)}d`;
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
  useLang();

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
          ? 'Canvas URL saved — now add your access token to enable live sync (Canvas → Account → Settings → New Access Token).'
          : 'Paste either your Calendar Feed link or your Canvas URL + access token to connect.'
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
      setSettingsError('Access token needs your Canvas school URL too (e.g. https://4015.instructure.com).');
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
      setActionError(err?.message || 'Could not break down Canvas assignment with AI. Check your AI key in Settings.');
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
      setActionError(err?.message || 'Submit to Canvas failed. Check your connection, then retry.');
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
      setActionError(err?.message || 'Sync-all failed. Check your connection, then retry.');
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
          <div className="p-4 rounded-2xl border border-[#E8E6DC] dark:border-[#4F4A3E] bg-white dark:bg-[#262624] flex flex-col sm:flex-row items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 text-[#C96442] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                {isHostNotAllowlisted ? 'School Canvas Domain Not Allowlisted' : t('canvas_sync_failed')}
              </h4>
              <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-0.5 break-words">{errorMessage}</p>
              {isHostNotAllowlisted ? (
                <div className="mt-2 p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#3A3832] text-[11px] text-[#4A4945] dark:text-[#C5C2B8] space-y-1">
                  <p className="font-semibold text-[#141413] dark:text-[#F5F4ED]">How to connect a custom or self-hosted Canvas school URL:</p>
                  <p>1. <strong>Recommended (instant):</strong> Open Connection Settings and switch to your school&apos;s <strong>Canvas Calendar Feed (.ics URL)</strong> from Canvas Calendar &rarr; Calendar Feed.</p>
                  <p>2. <strong>REST API Token:</strong> For live REST API proxying, your deployment admin must add your school hostname to <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded font-mono">CANVAS_ALLOWED_HOSTS</code> on the server.</p>
                </div>
              ) : (
                <p className="text-[11px] text-[#5E5D59] dark:text-[#B5B2A8] mt-1">{t('canvas_kept_below')}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {isHostNotAllowlisted && (
                <button
                  onClick={() => setShowSettingsDrawer(true)}
                  className="px-3 py-2 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#3A3832] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> Connection Settings
                </button>
              )}
              <button
                onClick={() => onFetchCanvas()}
                className="px-3 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold shrink-0 min-h-[44px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('retry')}
              </button>
            </div>
          </div>
        );
      })()}
      {/* Inline action-error banner (sync-all / Drive submit) — same channel, no raw throws. */}
      {actionError && !errorMessage && (
        <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 flex items-start gap-2.5" role="alert">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-200 break-words">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-amber-700 dark:text-amber-300 hover:opacity-70 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Filter & Actions Header */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        
        {/* Left: Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => setActiveTab('UNFINISHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNFINISHED'
                ? 'bg-[#C96442] text-white shadow-xs ring-2 ring-[#C96442]/50'
                : 'bg-[#E8E6DC] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] border border-[#E8E6DC] dark:border-[#2C2B27]'
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
                ? 'bg-[#141413] text-white dark:bg-[#F5F4ED] dark:text-[#141413] shadow-xs ring-2 ring-[#141413]/20'
                : 'bg-[#E8E6DC] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] border border-[#E8E6DC] dark:border-[#2C2B27]'
            }`}
          >
            <span>{t('all')}</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeTab === 'ALL' ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#141413]' : 'bg-black/5 dark:bg-white/10'
            }`}>
              {canvasAssignments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FINISHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FINISHED'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/50'
                : 'bg-[#E8E6DC] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#2C2A26] border border-[#E8E6DC] dark:border-[#2C2B27]'
            }`}
          >
            <span>{t('finished')}</span>
          </button>
        </div>

        {/* Right: Search, Course Dropdown & Sync Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('filter_tasks')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
            />
          </div>

          {/* Course Selector */}
          {courses.length > 0 && (
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-[#141413] dark:text-[#F5F4ED] font-semibold cursor-pointer outline-none"
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
              className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs shadow-[#C96442]/20"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Sync ({pendingSyncAssignments.length})</span>
            </button>
          )}

          {/* Config Drawer Toggle */}
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="p-1.5 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl transition-colors cursor-pointer"
            title="Canvas LMS Connection Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Drawer Overlay if Opened */}
      {showSettingsDrawer && (
        <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E6DC]/60 dark:border-[#2C2B27]/60">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#C96442]" />
              <h3 className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                {t('canvas_settings_title')}
              </h3>
            </div>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">
                Canvas School URL <span className="text-rose-500">*</span>
                <span className="ml-1 font-normal text-[#8C897F]">— required with Access Token</span>
              </label>
              <input
                type="text"
                value={apiDomain}
                onChange={(e) => setApiDomain(e.target.value)}
                onBlur={() => setApiDomain((v) => (v.trim() ? normalizeCanvasDomain(v) : v))}
                placeholder="https://4015.instructure.com"
                inputMode="url"
                className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#C96442]"
              />
              <p className="mt-1 text-[11px] text-[#8C897F] leading-snug">
                Paste your school's Canvas link — even a login URL works
                (e.g. <span className="font-mono">https://4015.instructure.com/login/</span>).
                We trim it to the base <span className="font-mono">https://…</span> school web address.
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">
                Canvas Access Token <span className="text-rose-500">*</span>
                <span className="ml-1 font-normal text-[#8C897F]">— required with URL</span>
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Canvas -> Account -> Settings -> New Access Token"
                className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#C96442]"
              />
              <p className="mt-1 text-[11px] text-[#8C897F] leading-snug">
                Live assignment &amp; grade sync needs <span className="font-semibold">both</span> the URL above and this token.
              </p>
              <p className="mt-1 text-[11px] text-[#8C897F] leading-snug">
                Saved only in this browser for your signed-in account — it survives sign-out and reload, and is never shared with other accounts on this device. Treat it like a password.
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#141413] dark:text-[#F5F4ED] mb-1">
                Canvas Calendar Feed (.ics URL)
                <span className="ml-1 font-normal text-[#8C897F]">— alternative / extra source</span>
              </label>
              <input
                type="text"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://canvas.instructure.com/feeds/calendars/..."
                className="w-full px-3 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#C96442]"
              />
            </div>

            {settingsError && (
              <div className="sm:col-span-2 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-800 dark:text-amber-200" role="alert">
                {settingsError}
              </div>
            )}

            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
              >
                {isSaving ? 'Saving & Syncing...' : 'Save & Sync Canvas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grade What-If Predictor — accordion (collapsed) */}
      <details className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] p-4 shadow-xs group">
        <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold">{t('grade_predictor')} <span className="px-2 py-0.5 rounded-full bg-[#E8E6DC] dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] text-[10px]">{t('expand')}</span></summary>
        <div className="mt-3">
        <h4 className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-[#C96442]" strokeWidth={1.75} /> Grade Predictor — What-if Final Exam</h4>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <label className="space-y-1"><span className="text-[11px] font-bold text-[#6B6860]">Current %</span><input type="number" value={gradeCurrent} onChange={e=>setGradeCurrent(parseInt(e.target.value)||0)} className="w-full px-2 py-1.5 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-sm font-mono" /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-[#6B6860]">Desired %</span><input type="number" value={gradeDesired} onChange={e=>setGradeDesired(parseInt(e.target.value)||0)} className="w-full px-2 py-1.5 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-sm font-mono" /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-[#6B6860]">Final weight %</span><input type="range" min={10} max={50} value={gradeFinalWeight} onChange={e=>setGradeFinalWeight(parseInt(e.target.value))} className="w-full accent-[#C96442]" /><span className="text-[11px] font-mono">{gradeFinalWeight}%</span></label>
        </div>
        {(() => {
          const r = calculateGradePrediction({ currentGrade: gradeCurrent, desiredGrade: gradeDesired, finalExamWeight: gradeFinalWeight });
          return (
            <div className="mt-3 p-3 rounded-xl bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] text-xs space-y-1">
              <div className="flex items-center justify-between"><span className="font-bold">Need on final: <span className="text-[#C96442]">{r.requiredFinalScore}%</span></span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status==='Guaranteed'?'bg-emerald-100 text-emerald-700': r.status==='Achievable'?'bg-blue-100 text-blue-700': r.status==='Challenging'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>{r.status}</span></div>
              <p className="text-[11px] text-[#6B6860]">{r.feedback}</p>
              <p className="text-[11px] text-[#6B6860] italic">Weighted GPA: Canvas grades auto-imported → GPA calculation uses same formula.</p>
            </div>
          );
        })()}
        </div>
      </details>

      {/* Main High-Density macOS Table View (40px Rows) */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 text-center text-[#8C897F] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#C96442]" />
            <span className="text-xs font-semibold">Syncing live Canvas assignments...</span>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-16 text-center text-[#8C897F] space-y-2">
            <Layers className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
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
                <tr className="border-b border-[#E8E6DC]/80 dark:border-[#2C2B27]/80 bg-[#E8E6DC] dark:bg-[#1F1E1B] text-[10px] font-bold uppercase tracking-wider text-[#8C897F]">
                  <th className="py-2.5 px-3 w-10 text-center">Done</th>
                  <th className="py-2.5 px-3 w-36">Course</th>
                  <th className="py-2.5 px-3">Assignment Title</th>
                  <th className="py-2.5 px-3 w-40">Due Date</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6DC]/40 dark:divide-[#2C2B27]/40 text-xs font-medium">
                {filteredAssignments.map((assignment) => {
                  const isCompleted = assignment.isCompleted || completedIds.includes(assignment.id);
                  const isSelected = selectedAssignment?.id === assignment.id;
                  const isDueSoon =
                    assignment.dueAt &&
                    new Date(assignment.dueAt).getTime() - Date.now() < 86400000 * 3 &&
                    new Date(assignment.dueAt).getTime() > Date.now();
                  const relativeDueLabel = getRelativeDueLabel(assignment.dueAt);

                  return (
                    <tr
                      key={assignment.id}
                      onClick={() => setSelectedAssignment(assignment)}
                      className={`h-10 hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#E8E6DC] dark:bg-[#1F1E1B] font-semibold' : ''
                      } ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => handleToggleComplete(assignment.id)}
                          className="w-4 h-4 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                        />
                      </td>

                      {/* Course Badge */}
                      <td className="py-1.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 truncate max-w-[130px] border border-amber-200 dark:border-amber-800/60">
                          {assignment.courseName}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-[#141413] dark:text-[#F5F4ED] truncate ${isCompleted ? 'text-[#6B6860]' : ''}`}>
                            {assignment.name}
                          </span>
                          {assignment.pointsPossible !== undefined && (
                            <span className="text-[10px] text-[#8C897F] font-mono shrink-0">
                              ({assignment.pointsPossible} pts)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-1.5 px-3 whitespace-nowrap text-[11px]">
                        <span className={isDueSoon ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-[#8C897F]'}>
                          {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Due Date'}
                        </span>
                        {relativeDueLabel && (
                          <span className="ml-1 text-[#8C897F]">· {relativeDueLabel}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3 text-center">
                        {assignment.isSynced ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                            Synced
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="p-1 text-[#8C897F] hover:text-[#C96442] rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#252422]"
                            title="Inspect Details"
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
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-[#1A1917] border-l border-[#E8E6DC] dark:border-[#2C2B27] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#E8E6DC] dark:border-[#2C2B27] bg-[#E8E6DC] dark:bg-[#1F1E1B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 rounded-md">
                {selectedAssignment.courseName}
              </span>
              <span className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">Inspector</span>
            </div>

            <button
              onClick={() => setSelectedAssignment(null)}
              className="p-1.5 text-[#8C897F] hover:bg-[#E8E6DC] dark:hover:bg-[#252422] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            
            {/* Title & Metadata */}
            <div>
              <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F4ED] mb-2">
                {selectedAssignment.name}
              </h3>
              <div className="space-y-1 text-[#8C897F] text-[11px]">
                <div className="flex items-center justify-between">
                  <span>Due Date:</span>
                  <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">
                    {selectedAssignment.dueAt ? new Date(selectedAssignment.dueAt).toLocaleString() : 'None'}
                    {getRelativeDueLabel(selectedAssignment.dueAt) && (
                      <span className="ml-1 font-normal text-[#8C897F]">· {getRelativeDueLabel(selectedAssignment.dueAt)}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Points Possible:</span>
                  <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">
                    {selectedAssignment.pointsPossible ?? 'Unspecified'}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Sub-task Extractor */}
            <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[#141413] dark:text-[#F5F4ED]">
                  <Sparkles className="w-3.5 h-3.5 text-[#C96442]" />
                  <span>AI Sub-task Extractor</span>
                </div>

                {!subtaskData[selectedAssignment.id] && (
                  <button
                    onClick={() => handleExtractSubtasks(selectedAssignment)}
                    disabled={extractingIds[selectedAssignment.id]}
                    className="px-2.5 py-1 bg-[#C96442] hover:bg-[#A94E33] text-white font-bold rounded-lg text-[10px] cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className={`w-3 h-3 ${extractingIds[selectedAssignment.id] ? 'animate-spin' : ''}`} />
                    <span>{extractingIds[selectedAssignment.id] ? 'Extracting...' : 'Deconstruct'}</span>
                  </button>
                )}
              </div>

              {subtaskData[selectedAssignment.id] && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <div className="text-[10px] text-[#8C897F]">
                    Difficulty: {subtaskData[selectedAssignment.id].difficulty} (Est. {subtaskData[selectedAssignment.id].totalEstimatedMinutes}m)
                  </div>
                  <div className="space-y-1.5">
                    {subtaskData[selectedAssignment.id].subtasks.map((st, idx) => {
                      const isChecked = checkedSubtasks[selectedAssignment.id]?.has(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded-xl border transition-colors cursor-pointer text-[11px] ${
                            isChecked
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 line-through text-[#8C897F]'
                              : 'bg-white dark:bg-[#252422] border-[#E8E6DC] dark:border-[#2C2B27] text-[#141413] dark:text-[#F5F4ED]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(isChecked)}
                            onChange={() => handleToggleSubtaskCheck(selectedAssignment.id, idx)}
                            className="mt-0.5 rounded text-[#C96442] focus:ring-[#C96442]"
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
              <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-[#141413] dark:text-[#F5F4ED]">
                  <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
                  <span>Submit from Google Drive</span>
                </div>

                {recentFiles.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedFileId}
                      onChange={(e) => setSelectedFileId(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-[11px] outline-none"
                    >
                      <option value="">Select a Drive file to attach...</option>
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
                      {isSubmittingDrive ? 'Submitting...' : 'Submit to Canvas'}
                    </button>
                  </div>
                ) : !isGoogleConnected && onConnectGoogle ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#8C897F]">
                      Connect Google Drive to pick documents you created in StudentOS and submit them here.
                    </p>
                    <button
                      type="button"
                      onClick={onConnectGoogle}
                      className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      Connect Google Drive
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-[#8C897F]">
                    No StudentOS Google Drive files yet. Create or open a Google Doc first to attach it here.
                  </p>
                )}
              </div>
            )}

            {/* Description & Rubric */}
            {selectedAssignment.description && (
              <div>
                <span className="font-bold text-[#141413] dark:text-[#F5F4ED] block mb-1">
                  Assignment Instructions
                </span>
                <div
                  className="p-3 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] max-h-48 overflow-y-auto leading-relaxed prose dark:prose-invert prose-xs"
                  dangerouslySetInnerHTML={{ __html: sanitizeAssignmentDescription(typeof selectedAssignment.description === 'string' ? selectedAssignment.description : '') }}
                />
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#E8E6DC] dark:border-[#2C2B27] bg-[#E8E6DC] dark:bg-[#1F1E1B] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhyIsThisHardCanvasAssignment(selectedAssignment)}
                className="px-3 py-1.5 bg-[#E8E6DC] dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="AI Cognitive Deconstruction"
              >
                <Brain className="w-3.5 h-3.5 text-[#C96442]" />
                <span>Why Is This Hard?</span>
              </button>

              <button
                onClick={() => onSyncToSheet(selectedAssignment)}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Sync to Sheet
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
              className="px-3 py-1.5 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span>Open in Canvas</span>
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
