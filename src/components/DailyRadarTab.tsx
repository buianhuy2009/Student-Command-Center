import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Video,
  CheckCircle2,
  Layers,
  Mail,
  ArrowRight,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { CalendarEvent, CanvasAssignment, ApiEnablementInfo, Assignment, EmailAlert } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { AIPlannerWorkspace } from './workspaces/AIPlannerWorkspace';
import { toMobileDeepLink } from '../services/canvas';
import { suggestStudySlots, StudySlotResult, StudySlotSuggestion } from '../services/gemini';
import { t, useLang } from '../services/i18n';

interface DailyRadarTabProps {
  events: CalendarEvent[];
  isLoadingEvents: boolean;
  onRefreshEvents: () => void;
  onOpenScheduleModal: (event?: Partial<CalendarEvent>) => void;
  onNavigateToTab?: (tab: string) => void;
  urgentCanvasItems?: CanvasAssignment[];
  allCanvasAssignments?: CanvasAssignment[];
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  calendarError?: string | null;
  calendarApiInfo?: ApiEnablementInfo | null;
  pendingAssignments?: Assignment[];
  onAddStudyBlock?: (eventData: { title: string; description: string; startDateTime: string; endDateTime: string }) => Promise<void>;
  initialMode?: 'agenda' | 'planner' | 'schedule';
  classroomAssignments?: CanvasAssignment[];
  emailAlerts?: EmailAlert[];
}

interface BusyInterval {
  startMs: number;
  endMs: number;
}

interface FreeStudySlot {
  dateStr: string;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  assignmentName: string;
  subject: string;
}

function parseDateTimeMs(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Finds up to 3 collision-free 45-min study windows across the next 7 days. */
function findCollisionFreeStudySlots(params: {
  events: CalendarEvent[];
  canvasAssignments: CanvasAssignment[];
  pendingAssignments: Assignment[];
  chronotype: 'morning' | 'balanced' | 'evening';
  now?: Date;
  maxBlocks?: number;
}): FreeStudySlot[] {
  const {
    events,
    canvasAssignments,
    pendingAssignments,
    chronotype,
    now = new Date(),
    maxBlocks = 3,
  } = params;

  if (pendingAssignments.length === 0) return [];

  const busy: BusyInterval[] = [];
  for (const evt of events) {
    const startMs = parseDateTimeMs(evt.start?.dateTime);
    const endMs = parseDateTimeMs(evt.end?.dateTime);
    if (startMs !== null && endMs !== null && endMs > startMs) {
      busy.push({ startMs, endMs });
    }
  }
  for (const ca of canvasAssignments) {
    if (ca.isCompleted || !ca.dueAt || !ca.dueAt.includes('T')) continue;
    const dueMs = parseDateTimeMs(ca.dueAt);
    if (dueMs !== null) {
      busy.push({ startMs: dueMs - 45 * 60_000, endMs: dueMs + 15 * 60_000 });
    }
  }

  const prioRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const orderedTasks = [...pendingAssignments].sort((a, b) => {
    const aDue = a.dueDate || '9999-12-31';
    const bDue = b.dueDate || '9999-12-31';
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return (prioRank[a.priority] ?? 1) - (prioRank[b.priority] ?? 1);
  });

  const windowsByChronotype: Record<'morning' | 'balanced' | 'evening', Array<[number, number]>> = {
    morning: [[8, 0], [9, 0], [10, 0], [11, 0], [14, 0], [15, 0], [16, 0], [19, 0]],
    balanced: [[10, 0], [11, 0], [14, 0], [15, 0], [9, 0], [16, 0], [19, 0], [20, 0]],
    evening: [[19, 0], [20, 0], [16, 0], [15, 0], [14, 0], [10, 0], [11, 0], [9, 0]],
  };
  const candidateTimes = windowsByChronotype[chronotype];
  const minStartMs = now.getTime() + 15 * 60_000;
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const chosen: FreeStudySlot[] = [];
  for (let dayOffset = 1; dayOffset <= 7 && chosen.length < maxBlocks; dayOffset++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + dayOffset);
    const dateStr = `${dayDate.getFullYear()}-${pad2(dayDate.getMonth() + 1)}-${pad2(dayDate.getDate())}`;

    for (const [hour, minute] of candidateTimes) {
      const startMs = new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        hour,
        minute,
        0,
        0
      ).getTime();
      const endMs = startMs + 45 * 60_000;
      if (startMs < minStartMs) continue;

      const overlapsBusy = busy.some((b) => startMs < b.endMs && endMs > b.startMs);
      const overlapsChosen = chosen.some((c) => startMs < c.endMs && endMs > c.startMs);
      if (overlapsBusy || overlapsChosen) continue;

      const task = orderedTasks[chosen.length % orderedTasks.length];
      const totalEndMins = hour * 60 + minute + 45;
      chosen.push({
        dateStr,
        startTime: `${pad2(hour)}:${pad2(minute)}`,
        endTime: `${pad2(Math.floor(totalEndMins / 60))}:${pad2(totalEndMins % 60)}`,
        startMs,
        endMs,
        assignmentName: task.assignmentName || 'Focused Study',
        subject: task.subject || 'General',
      });
      busy.push({ startMs, endMs });
      break;
    }
  }

  return chosen;
}

const resolveRadarMode = (mode?: 'agenda' | 'planner' | 'schedule'): 'agenda' | 'planner' =>
  mode === 'planner' ? 'planner' : 'agenda';

export const DailyRadarTab: React.FC<DailyRadarTabProps> = ({
  events,
  isLoadingEvents,
  onRefreshEvents,
  onOpenScheduleModal,
  onNavigateToTab,
  urgentCanvasItems = [],
  allCanvasAssignments = [],
  isGoogleConnected = true,
  onConnectGoogle,
  calendarError,
  calendarApiInfo,
  pendingAssignments = [],
  onAddStudyBlock,
  initialMode,
  classroomAssignments = [],
  emailAlerts = [],
}) => {
  useLang();
  const [viewMode, setViewMode] = useState<'agenda' | 'planner'>(() => resolveRadarMode(initialMode));
  useEffect(() => {
    if (initialMode) {
      setViewMode(resolveRadarMode(initialMode));
    }
  }, [initialMode]);
  const now = new Date();
  
  // Format current date as YYYY-MM-DD in local time
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${localYear}-${localMonth}-${localDay}`;

  // AI Chronotype Study Slot states
  const [showChronotypePanel, setShowChronotypePanel] = useState(false);
  const [chronotype, setChronotypeState] = useState<'morning' | 'balanced' | 'evening'>(() => {
    try {
      const saved = localStorage.getItem('scc_chronotype_v1');
      return saved === 'morning' || saved === 'balanced' || saved === 'evening' ? saved : 'morning';
    } catch {
      return 'morning';
    }
  });
  const setChronotype = (value: 'morning' | 'balanced' | 'evening') => {
    setChronotypeState(value);
    try {
      localStorage.setItem('scc_chronotype_v1', value);
    } catch {
      /* storage unavailable — ignore */
    }
  };
  const [isSuggestingSlots, setIsSuggestingSlots] = useState(false);
  const [studySlotResult, setStudySlotResult] = useState<StudySlotResult | null>(null);
  const [schedulingSlotIndex, setSchedulingSlotIndex] = useState<number | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [autoBlockSummary, setAutoBlockSummary] = useState<string | null>(null);

  const handleGenerateSlots = async () => {
    setIsSuggestingSlots(true);
    setSlotError(null);
    setAutoBlockSummary(null);
    try {
      const result = await suggestStudySlots(events, pendingAssignments, chronotype, todayStr);
      setStudySlotResult(result);
    } catch (err: any) {
      console.error('Failed to suggest study slots:', err);
      setSlotError(err?.message || 'Could not generate AI study slot suggestions. Check your AI API key or use Auto-Block / AI Planner.');
    } finally {
      setIsSuggestingSlots(false);
    }
  };

  const handleAutoBlockWeek = async () => {
    setSlotError(null);
    setAutoBlockSummary(null);
    if (!onAddStudyBlock) {
      setSlotError('Connect Google Calendar before auto-blocking study sessions.');
      return;
    }
    const freeSlots = findCollisionFreeStudySlots({
      events,
      canvasAssignments: allCanvasAssignments,
      pendingAssignments,
      chronotype,
      now,
      maxBlocks: 3,
    });
    if (freeSlots.length === 0) {
      setSlotError('No collision-free 45-minute windows found over the next 7 days. Open AI Planner to customize blocked hours.');
      return;
    }
    setIsSuggestingSlots(true);
    try {
      const scheduledLabels: string[] = [];
      for (const s of freeSlots) {
        await onAddStudyBlock({
          title: `Focus: ${s.assignmentName} (${s.subject})`,
          description: `Collision-free 45m study block (${chronotype} chronotype) avoiding ${events.length} calendar events and Canvas due cutoffs.`,
          startDateTime: `${s.dateStr}T${s.startTime}:00`,
          endDateTime: `${s.dateStr}T${s.endTime}:00`,
        });
        scheduledLabels.push(`${s.dateStr} ${s.startTime}`);
      }
      setAutoBlockSummary(`Scheduled ${scheduledLabels.length} conflict-free study block(s): ${scheduledLabels.join(' · ')}`);
    } catch (err: any) {
      console.error('Auto-block scheduling failed:', err);
      setSlotError(err?.message || 'Could not save study blocks to Google Calendar.');
    } finally {
      setIsSuggestingSlots(false);
    }
  };

  const handleApplySlot = async (slot: StudySlotSuggestion, idx: number) => {
    if (!onAddStudyBlock) return;
    setSchedulingSlotIndex(idx);
    setSlotError(null);
    try {
      const startDateTime = `${todayStr}T${slot.startTime}:00`;
      const endDateTime = `${todayStr}T${slot.endTime}:00`;
      await onAddStudyBlock({
        title: `Focus: ${slot.taskName} (${slot.taskSubject})`,
        description: `Scheduled via AI Chronotype Blocker.\nReason: ${slot.reason}`,
        startDateTime,
        endDateTime,
      });
      setStudySlotResult((prev) =>
        prev
          ? {
              ...prev,
              suggestedSlots: prev.suggestedSlots.filter((_, i) => i !== idx),
            }
          : null
      );
    } catch (err: any) {
      console.error('Error applying study slot:', err);
      setSlotError(err?.message || 'Could not schedule study block in Google Calendar.');
    } finally {
      setSchedulingSlotIndex(null);
    }
  };

  const canvasTimelineItems = allCanvasAssignments
    .filter((a) => a.dueAt === todayStr && !a.isCompleted)
    .map((a) => ({
      id: a.id,
      summary: `Canvas: ${a.name} (${a.pointsPossible !== undefined ? `${a.pointsPossible} pts` : 'Ungraded'})`,
      description: a.description,
      location: a.courseName,
      start: { dateTime: a.dueAt ? `${a.dueAt}T23:59:00` : undefined },
      end: { dateTime: a.dueAt ? `${a.dueAt}T23:59:59` : undefined },
      htmlLink: a.htmlUrl,
      isCanvas: true,
      isStudyBlock: false,
      hangoutLink: undefined,
    }));

  const combinedTimeline = [
    ...events.map(e => ({ ...e, isCanvas: false })),
    ...canvasTimelineItems
  ].sort((a, b) => {
    const timeA = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
    const timeB = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
    return timeA - timeB;
  });

  const nextUpcomingEvent = combinedTimeline.find((e) => {
    if (!e.start?.dateTime) return false;
    return new Date(e.start.dateTime) > now;
  });

  const minutesUntilNext = nextUpcomingEvent?.start?.dateTime
    ? Math.round((new Date(nextUpcomingEvent.start.dateTime).getTime() - now.getTime()) / (1000 * 60))
    : null;

  const formatEventTime = (isoString?: string) => {
    if (!isoString) return t('radar_all_day');
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Clean Header */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-5 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D97757]/15 text-[#D97757] dark:text-[#E59A7C] flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] tracking-tight">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </h2>
            <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5">
              {events.length} {events.length === 1 ? t('radar_event_1') : t('radar_events')} {t('radar_scheduled_today')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27]">
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-[#D97757] text-white shadow-2xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5]'
              }`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => setViewMode('planner')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'planner'
                  ? 'bg-[#D97757] text-white shadow-2xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Planner</span>
            </button>
          </div>

          {viewMode === 'agenda' && (
            <>
              <button
                onClick={() => setShowChronotypePanel(!showChronotypePanel)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  showChronotypePanel
                    ? 'bg-[#D97757] text-white border-[#D97757] shadow-xs'
                    : 'bg-[#D97757]/10 text-[#D97757] dark:text-[#E59A7C] hover:bg-[#D97757]/20 border-[#D97757]/30'
                }`}
                title={t('radar_chrono_title')}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('radar_chrono')}</span>
              </button>

              <button
                onClick={() => onOpenScheduleModal()}
                className="px-3.5 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('radar_add_focus')}</span>
              </button>

              <button
                id="btn-refresh-schedule-radar"
                onClick={onRefreshEvents}
                className="p-1.5 rounded-xl hover:bg-[#FAF9F5] dark:hover:bg-[#252422] text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#D97757] dark:hover:text-[#E59A7C] transition-colors cursor-pointer border border-transparent hover:border-[#DFDACB] dark:hover:border-[#2C2B27]"
                title={t('radar_sync_title')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'planner' ? (
        <AIPlannerWorkspace
          assignments={pendingAssignments}
          canvasAssignments={allCanvasAssignments}
          classroomAssignments={classroomAssignments}
          emailAlerts={emailAlerts}
          meetings={events}
        />
      ) : (
      <>
      {showChronotypePanel && (
        <div className="p-4 bg-[#D97757]/5 dark:bg-[#D97757]/10 border border-[#D97757]/30 rounded-2xl space-y-4 animate-in slide-in-from-top-3 duration-250">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] uppercase tracking-wider">
                {t('radar_peak')}
              </h4>
              <p className="text-[10px] text-[#6B6860] dark:text-[#B5B2A8] mt-0.5">
                {t('radar_peak_hint')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-[#252422] p-1 rounded-xl border border-[#DFDACB] dark:border-[#2C2B27]">
              <button
                type="button"
                onClick={() => setChronotype('morning')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  chronotype === 'morning'
                    ? 'bg-[#D97757] text-white shadow-2xs'
                    : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#1F1E1B]'
                }`}
              >
                {t('radar_morning')}
              </button>
              <button
                type="button"
                onClick={() => setChronotype('balanced')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  chronotype === 'balanced'
                    ? 'bg-[#D97757] text-white shadow-2xs'
                    : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#1F1E1B]'
                }`}
              >
                {t('radar_balanced')}
              </button>
              <button
                type="button"
                onClick={() => setChronotype('evening')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  chronotype === 'evening'
                    ? 'bg-[#D97757] text-white shadow-2xs'
                    : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#1F1E1B]'
                }`}
              >
                {t('radar_night')}
              </button>
            </div>      </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-[#6B6860] dark:text-[#B5B2A8]">
              {pendingAssignments.length} {t('radar_pending_tasks')} • {t('radar_scans_gaps')}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateSlots}
                disabled={isSuggestingSlots}
                className="px-3.5 py-1.5 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSuggestingSlots ? 'animate-spin' : ''}`} />
                <span>{isSuggestingSlots ? t('radar_calculating') : t('radar_generate')}</span>
              </button>
              <button
                onClick={handleAutoBlockWeek}
                disabled={isSuggestingSlots || pendingAssignments.length === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>{t('radar_autoblock')}</span>
              </button>
            </div>
          </div>

          {slotError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{slotError}</span>
            </div>
          )}

          {autoBlockSummary && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{autoBlockSummary}</span>
            </div>
          )}

          {/* Render Suggestions */}
          {studySlotResult && (
            <div className="space-y-3 pt-2">
              {studySlotResult.chronotypeAdvice && (
                <div className="p-3 bg-[#D97757]/10 dark:bg-[#D97757]/15 rounded-xl text-xs text-[#141413] dark:text-[#FAF9F5] flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#D97757] dark:text-[#E8A07E] shrink-0 mt-0.5" />
                  <span>{studySlotResult.chronotypeAdvice}</span>
                </div>
              )}

              {studySlotResult.suggestedSlots.length === 0 ? (
                <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] italic py-2">
                  {t('radar_all_added')}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {studySlotResult.suggestedSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white dark:bg-[#252422] rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xs flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-[#D97757] dark:text-[#E8A07E] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{slot.startTime} - {slot.endTime}</span>
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#EFECE2] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8]">
                            {slot.taskSubject}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] mt-1.5">
                          {slot.taskName}
                        </h4>
                        <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] mt-1">
                          {slot.reason}
                        </p>
                      </div>

                      <button
                        onClick={() => handleApplySlot(slot, idx)}
                        disabled={schedulingSlotIndex === idx}
                        className="w-full py-1.5 px-3 bg-[#D97757]/10 dark:bg-[#D97757]/15 hover:bg-[#D97757] text-[#D97757] dark:text-[#E59A7C] hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border border-[#D97757]/30 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{schedulingSlotIndex === idx ? t('radar_scheduling') : t('radar_add_to_cal')}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Schedule Container */}
      <section className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-5 sm:p-6 shadow-xs">
        {/* Card Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#DFDACB] dark:border-[#2C2B27]">
          <h3 className="font-bold text-[#141413] dark:text-[#FAF9F5] text-xs uppercase tracking-wider">
            {t('radar_timeline')}
          </h3>
        </div>

        {/* API Disabled or Error Banner */}
        {calendarApiInfo ? (
          <div className="mt-4">
            <ApiActivationBanner
              info={calendarApiInfo}
              onRetry={onRefreshEvents}
              isRetrying={isLoadingEvents}
            />
          </div>
        ) : calendarError ? (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{calendarError}</span>
            </div>
            {onConnectGoogle && (
              <button
                onClick={onConnectGoogle}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shrink-0 cursor-pointer text-xs"
              >
                {t('radar_reconnect')}
              </button>
            )}
          </div>
        ) : null}

        {/* Schedule Timeline */}
        <div className="mt-5 space-y-3.5">
          {!isGoogleConnected ? (
            <div className="py-12 px-4 text-center bg-[#FAF9F5] dark:bg-[#252422]/60 rounded-xl border border-dashed border-[#DFDACB] dark:border-[#2C2B27]">
              <CalendarIcon className="w-10 h-10 mx-auto text-[#D97757] dark:text-[#E59A7C] mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">{t('radar_disconnected')}</h3>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-1 max-w-md mx-auto">
                {t('radar_disconnected_hint')}
              </p>
              {onConnectGoogle && (
                <button
                  onClick={onConnectGoogle}
                  className="mt-3 px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('radar_connect_cal')}</span>
                </button>
              )}
            </div>
          ) : isLoadingEvents ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#6B6860] dark:text-[#B5B2A8]">
              <RefreshCw className="w-7 h-7 animate-spin text-[#D97757] dark:text-[#E59A7C] mb-2" />
              <p className="text-xs font-semibold text-[#6B6860] dark:text-[#B5B2A8]">
                {t('radar_syncing')}
              </p>
            </div>
          ) : combinedTimeline.length === 0 ? (
            <div className="py-16 text-center text-[#6B6860] dark:text-[#B5B2A8]">
              <CalendarIcon className="w-10 h-10 mx-auto text-[#DFDACB] dark:text-[#2C2B27] mb-2" />
              <p className="text-sm font-semibold text-[#141413] dark:text-[#FAF9F5]">
                {t('radar_no_commit')}
              </p>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-1 max-w-sm mx-auto">
                {t('radar_clear_hint')}
              </p>
              <button
                onClick={() => onOpenScheduleModal()}
                className="mt-4 px-4 py-2 text-xs font-semibold bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl transition-colors shadow-2xs"
              >
                {t('radar_schedule_45')}
              </button>
            </div>
          ) : (
            combinedTimeline.map((event: any, idx) => {
              const isPast = event.end?.dateTime && new Date(event.end.dateTime) < now;
              const isCurrent =
                event.start?.dateTime &&
                event.end?.dateTime &&
                new Date(event.start.dateTime) <= now &&
                new Date(event.end.dateTime) >= now;

              return (
                <div
                  key={event.id || idx}
                  id={`event-timeline-${event.id}`}
                  className="flex items-start gap-3.5 group timeline-reveal-item"
                >
                  {/* Time on left */}
                  <div className="w-16 text-xs font-mono font-medium text-[#6B6860] dark:text-[#B5B2A8] pt-2.5 shrink-0 text-right">
                    {formatEventTime(event.start?.dateTime)}
                  </div>

                  {/* Card on right */}
                  <div
                    className={`flex-1 p-4 rounded-xl border-l-4 transition-all ${
                      event.isCanvas
                        ? 'border-[#D97757] bg-[#D97757]/10 dark:bg-[#D97757]/10 text-[#141413] dark:text-[#FAF9F5]'
                        : event.isStudyBlock
                        ? 'border-[#D97757] bg-[#D97757]/10 dark:bg-[#D97757]/15 text-[#141413] dark:text-[#FAF9F5]'
                        : isCurrent
                        ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 text-[#141413] dark:text-[#FAF9F5] shadow-xs'
                        : isPast
                        ? 'border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#252422]/40 text-[#6B6860] dark:text-[#B5B2A8] opacity-60'
                        : 'border-[#DFDACB] dark:border-[#2C2B27] bg-white dark:bg-[#1A1917] text-[#141413] dark:text-[#FAF9F5] hover:border-[#D97757]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            {event.isCanvas && (
                              <svg className="w-3.5 h-3.5 text-[#D97757] dark:text-[#E59A7C] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="10" className="text-[#D97757]/20 dark:text-[#E59A7C]/20" />
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" className="text-[#D97757] dark:text-[#E59A7C]" />
                              </svg>
                            )}
                            <h4
                              className={`text-sm font-semibold truncate ${
                                isPast ? 'line-through text-[#6B6860] dark:text-[#B5B2A8]' : 'text-[#141413] dark:text-[#FAF9F5]'
                              }`}
                            >
                              {event.summary}
                            </h4>
                          </div>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded">
                              LIVE NOW
                            </span>
                          )}
                          {event.isStudyBlock && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#D97757] text-white rounded">
                              45M FOCUS
                            </span>
                          )}
                          {event.isCanvas && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#D97757] text-white rounded uppercase tracking-wider">
                              {t('radar_lms_deadline')}
                            </span>
                          )}
                        </div>

                        {event.location && (
                          <div className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] font-mono mt-1 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#6B6860] dark:text-[#B5B2A8] shrink-0" />
                            <span>{event.location}</span>
                          </div>
                        )}

                        {event.description && (
                          <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-1.5 line-clamp-2 leading-relaxed">
                            {event.description.replace(/<[^>]*>?/gm, '')}
                          </p>
                        )}
                      </div>

                      {/* Video / Cal Links */}
                      <div className="flex items-center gap-1 shrink-0">
                        {event.hangoutLink && (
                          <a
                            href={event.hangoutLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                            title={t('radar_join_meet')}
                          >
                            <Video className="w-4 h-4" />
                          </a>
                        )}
                        {event.htmlLink && (
                          <a
                            href={toMobileDeepLink(event.htmlLink)}
                            target="_blank"
                            rel="noreferrer"
                              className={`p-1.5 rounded-lg transition-colors ${
                                event.isCanvas
                                  ? 'text-[#D97757] dark:text-[#E59A7C] hover:bg-[#D97757]/10'
                                  : 'text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5]'
                              }`}
                            title={event.isCanvas ? t('radar_open_canvas') : t('radar_open_gcal')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & Direct links */}
        <div className="mt-6 pt-4 border-t border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between text-xs text-[#6B6860] dark:text-[#B5B2A8]">
          <button
            onClick={() => onOpenScheduleModal()}
            className="font-semibold text-[#D97757] dark:text-[#E8A07E] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('radar_schedule_another')}</span>
          </button>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:text-[#D97757] dark:hover:text-[#E59A7C] inline-flex items-center gap-1"
          >
            <span>{t('radar_open_gcal_btn')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </section>

      {/* Quick Links */}
      {onNavigateToTab && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigateToTab('canvas')}
            className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] transition-all cursor-pointer shadow-xs group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#D97757]/15 text-[#D97757] dark:text-[#E59A7C] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
                  {t('radar_canvas_title')}
                </h4>
                <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8]">
                  {t('radar_canvas_hint')}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#6B6860] dark:text-[#B5B2A8] group-hover:translate-x-1 transition-transform" />
          </div>

          <div
            onClick={() => onNavigateToTab('gmail')}
            className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] hover:border-rose-400 dark:hover:border-rose-500 transition-all cursor-pointer shadow-xs group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
                  {t('radar_gmail_title')}
                </h4>
                <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8]">
                  {t('radar_gmail_hint')}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#6B6860] dark:text-[#B5B2A8] group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
