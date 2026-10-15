import React, { useState, useMemo } from 'react';
import {
  Quote,
  ArrowRight,
  Edit2,
  Check,
  Shuffle,
  Clock,
  Sparkles,
  Timer,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { getTodayQuote, QUOTE_BANK, DailyQuote } from '../data/quotes';
import { useNasaApod } from '../hooks/useNasaApod';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { EmptyAssignments } from './EmptyState';
import { t, useLang } from '../services/i18n';

const LOCAL_STORAGE_NAME_KEY = 'scc_user_preferred_name';
const LOCAL_STORAGE_INTENTION_KEY = 'scc_user_daily_intention';
const LOCAL_STORAGE_VIBE_KEY = 'scc_user_selected_vibe';
const LOCAL_STORAGE_SPRINT_GOAL_KEY = 'scc_user_sprint_goal';

interface DashboardHomeProps {
  assignments: Assignment[];
  onToggleAssignment?: (id: string) => void;
  onNavigateWorkspace: (tabId: string) => void;
  onOpenQuickDraft?: any;
  onOpenAiSuite?: any;
  onOpenAppStore?: () => void;
  user?: User | null;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  onOpenStudyPlan?: () => void;
  calendarEvents?: CalendarEvent[];
  emailAlerts?: EmailAlert[];
  isLoadingEvents?: boolean;
}

type VibeType = 'focus' | 'calm' | 'creative' | 'recharge';

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  assignments,
  onNavigateWorkspace,
  user,
  isGoogleConnected = false,
  onConnectGoogle,
  onOpenStudyPlan,
  calendarEvents = [],
  emailAlerts = [],
  isLoadingEvents = false,
}) => {
  useLang();
  // Time-aware greeting prefix
  const greetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'dash_greet_morning';
    if (hour < 17) return 'dash_greet_afternoon';
    return 'dash_greet_evening';
  }, []);
  const greetingPrefix = t(greetingKey);

  // Personalized Preferred Name
  const [studentName, setStudentName] = useState<string>(() => {
    return (
      localStorage.getItem(LOCAL_STORAGE_NAME_KEY) ||
      user?.displayName?.split(' ')[0] ||
      'Student'
    );
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(studentName);

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'Student';
    setStudentName(trimmed);
    localStorage.setItem(LOCAL_STORAGE_NAME_KEY, trimmed);
    setIsEditingName(false);
  };

  // Personalized Daily Intention
  const [dailyIntention, setDailyIntention] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_INTENTION_KEY) || '';
  });
  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [intentionInput, setIntentionInput] = useState(dailyIntention);

  const handleSaveIntention = () => {
    const trimmed = intentionInput.trim();
    setDailyIntention(trimmed);
    localStorage.setItem(LOCAL_STORAGE_INTENTION_KEY, trimmed);
    setIsEditingIntention(false);
  };

  // Personalized Daily Vibe/Theme selector
  const [selectedVibe, setSelectedVibe] = useState<VibeType>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_VIBE_KEY) as VibeType) || 'focus';
  });

  const handleSelectVibe = (vibe: VibeType) => {
    setSelectedVibe(vibe);
    localStorage.setItem(LOCAL_STORAGE_VIBE_KEY, vibe);
  };

  // Personalized Focus Sprint Goal — now via Zustand (prevents BroadcastChannel race), clamped floor 1
  const { sprintGoal, setSprintGoal, completedSessions } = usePomodoroStore();
  // NaN guard: the store exposes `completedSessions`; a legacy `completedFocusSessions`
  // read is undefined when there is no focus data yet (undefined * 25 = NaN → "NaNm/75m").
  // Fall back to the live store value, then to 0. Finite real data passes through unchanged.
  const storeState = usePomodoroStore.getState() as unknown as { completedFocusSessions?: unknown };
  const rawFocusSessions: unknown = storeState.completedFocusSessions ?? completedSessions;
  const safeCompletedFocusSessions = Number.isFinite(rawFocusSessions) ? (rawFocusSessions as number) : 0;
  const safeSprintGoal = Number.isFinite(sprintGoal) ? (sprintGoal as number) : 0;
  const focusProgressPct = safeSprintGoal > 0 ? Math.min(100, (safeCompletedFocusSessions / safeSprintGoal) * 100) : 0;
  const handleAdjustSprintGoal = (amount: number) => {
    setSprintGoal(Math.max(1, (Number.isFinite(sprintGoal) ? (sprintGoal as number) : 0) + amount));
  };

  // Streak heatmap — memoized once per render (not 28 JSON.parse per cell)
  const streakMap = useMemo(() => {
    try {
      const raw = localStorage.getItem('scc_focus_sessions_log');
      const log: {date:string, minutes:number}[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, number>();
      log.forEach(e => map.set(e.date, (map.get(e.date)||0)+e.minutes));
      if (map.size===0 && safeCompletedFocusSessions>0) {
        const today = new Date().toISOString().slice(0,10);
        map.set(today, safeCompletedFocusSessions*25);
      }
      return map;
    } catch { return new Map<string, number>(); }
  }, [safeCompletedFocusSessions]);

  // Today's quote — exclude current index on shuffle
  const [quote, setQuote] = useState<DailyQuote>(() => getTodayQuote());

  const handleShuffleQuote = () => {
    const currentIdx = QUOTE_BANK.findIndex(q => q.quote === quote.quote);
    let randomIndex = Math.floor(Math.random() * QUOTE_BANK.length);
    if (QUOTE_BANK.length > 1 && randomIndex === currentIdx) {
      randomIndex = (randomIndex + 1 + Math.floor(Math.random() * (QUOTE_BANK.length - 1))) % QUOTE_BANK.length;
      if (randomIndex === currentIdx) randomIndex = (randomIndex + 1) % QUOTE_BANK.length;
    }
    setQuote(QUOTE_BANK[randomIndex]);
  };

  // Real Counts (No Spoofing) — Today Plan grouping
  const pendingAssignments = useMemo(() => {
    return assignments.filter((a) => a.status !== 'Done');
  }, [assignments]);

  // Next-up hero strip — nearest incomplete assignment with a valid due date
  const nextDeadline = useMemo(() => {
    const dated = pendingAssignments.filter((a) => {
      if (!a.dueDate || typeof a.dueDate !== 'string') return false;
      const t = new Date(a.dueDate.length === 10 ? `${a.dueDate}T23:59:59` : a.dueDate).getTime();
      return !Number.isNaN(t);
    });
    if (dated.length === 0) return null;
    const withTime = dated.map((a) => ({
      assignment: a,
      dueTime: new Date(a.dueDate.length === 10 ? `${a.dueDate}T23:59:59` : a.dueDate).getTime(),
    }));
    withTime.sort((x, y) => x.dueTime - y.dueTime);
    return withTime[0].assignment;
  }, [pendingAssignments]);

  const nextDeadlineInfo = useMemo(() => {
    if (!nextDeadline?.dueDate) return null;
    const dueTime = new Date(
      nextDeadline.dueDate.length === 10 ? `${nextDeadline.dueDate}T23:59:59` : nextDeadline.dueDate
    ).getTime();
    if (Number.isNaN(dueTime)) return null;
    const now = Date.now();
    const diffMs = dueTime - now;
    if (diffMs < 0) {
      const absMs = -diffMs;
      const days = Math.floor(absMs / 86400000);
      const hours = Math.floor((absMs % 86400000) / 3600000);
      if (days > 0) return { days, hours, isOverdue: true as const, ltHour: false as const };
      return { days: 0, hours: Math.max(hours, 1), isOverdue: true as const, ltHour: false as const };
    }
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    if (days > 0) return { days, hours, isOverdue: false as const, ltHour: false as const };
    if (hours > 0) return { days: 0, hours, isOverdue: false as const, ltHour: false as const };
    return { days: 0, hours: 0, isOverdue: false as const, ltHour: true as const };
  }, [nextDeadline]);

  const formatDeadline = (info: { days: number; hours: number; isOverdue: boolean; ltHour: boolean }) => {
    if (info.ltHour) return t('dash_due_lt_hour');
    const span = info.days > 0
      ? `${info.days}${t('dash_day_unit')} ${info.hours}${t('dash_hour_unit')}`
      : `${info.hours}${t('dash_hour_unit')}`;
    return info.isOverdue ? `${t('dash_overdue_by')} ${span}` : `${t('dash_due_in')} ${span}`;
  };

  // todayFormattedDate kept for potential use but not shown above fold (moved to navbar)
  const todayFormattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  // Vibe background glow — bumped to /25 in dark for visibility
  const vibeGlowClass = {
    focus: 'from-[#D97757]/15 dark:from-[#D97757]/25',
    calm: 'from-blue-500/15 dark:from-blue-900/25',
    creative: 'from-violet-500/15 dark:from-violet-900/25',
    recharge: 'from-emerald-500/15 dark:from-emerald-900/25',
  }[selectedVibe];

  const vibeBorderHoverClass = {
    focus: 'hover:border-[#D97757]',
    calm: 'hover:border-blue-500',
    creative: 'hover:border-violet-500',
    recharge: 'hover:border-emerald-500',
  }[selectedVibe];

  const vibeTextAccentClass = {
    focus: 'text-[#D97757] dark:text-[#E59A7C]',
    calm: 'text-blue-500 dark:text-blue-400',
    creative: 'text-violet-500 dark:text-violet-400',
    recharge: 'text-emerald-600 dark:text-emerald-400',
  }[selectedVibe];

  const { enabled: apodEnabled, apod: nasaApod, loading: apodLoading, error: apodError, reload: reloadApod } = useNasaApod();
  const [apodExpanded, setApodExpanded] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-transparent dark:bg-[#141413] px-6 py-12 text-center animate-in fade-in duration-300 select-none relative overflow-y-auto">

      {/* Dynamic Ambient Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br ${vibeGlowClass} via-transparent to-transparent rounded-full blur-3xl pointer-events-none transition-all duration-700`} />

      {/* Main Centered Personalization Hub — above-fold tightened (clock moved to navbar) */}
      <div className="max-w-3xl w-full space-y-8 my-auto py-6 z-10 stagger">
        
        {/* Large Typographic Piece: The Personalized Greeting — explicit edit button only */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="px-4 py-1.5 text-4xl sm:text-5xl font-extrabold bg-white dark:bg-[#1F1E1B] border-2 border-[#D97757] rounded-2xl focus:outline-none text-[#141413] dark:text-[#FAF9F5] text-center max-w-md shadow-xs"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-3 bg-[#D97757] text-white rounded-xl shadow-sm cursor-pointer"
                >
                  <Check className="w-5 h-5" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 min-w-0 max-w-full">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-[#141413] dark:text-[#FAF9F5] tracking-tight leading-tight truncate min-w-0 max-w-[60vw] sm:max-w-none">
                  {greetingPrefix}, <span className="truncate">{studentName}</span>
                </h1>
                <button
                  onClick={() => {
                    setNameInput(studentName);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 rounded-lg bg-white dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] text-[#6B6860] dark:text-[#B5B2A8] hover:text-[#D97757] dark:hover:text-[#E59A7C] hover:border-[#D97757]/40 transition-colors shrink-0"
                  aria-label={t('dash_edit_name')}
                  title={t('dash_edit_name')}
                >
                  <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </div>

          {/* Inline Daily Intention under Greeting */}
          <div className="max-w-lg mx-auto">
            {isEditingIntention ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={intentionInput}
                  onChange={(e) => setIntentionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveIntention()}
                  placeholder={t('dash_intention_ph')}
                  className="w-full px-4 py-1.5 text-sm bg-white dark:bg-[#1F1E1B] border border-[#D97757] rounded-xl focus:outline-none text-[#141413] dark:text-[#FAF9F5] text-center"
                  autoFocus
                />
                <button
                  onClick={handleSaveIntention}
                  className="p-2 bg-[#D97757] text-white rounded-lg cursor-pointer shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                onClick={() => {
                  setIntentionInput(dailyIntention);
                  setIsEditingIntention(true);
                }}
                className="text-xs sm:text-sm text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#D97757] dark:hover:text-[#E59A7C] transition-colors cursor-pointer italic leading-relaxed"
                title={t('dash_intention_title')}
              >
                {dailyIntention ? `"${dailyIntention}"` : t('dash_intention_empty')}
              </p>
            )}
          </div>
        </div>

        {/* AI Planner — most-used planning entry point */}
        <div className="bg-gradient-to-br from-violet-600 via-[#6D28D9] to-[#4C1D95] rounded-3xl p-5 text-left text-white shadow-lg shadow-violet-500/20 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> AI Planner
            </span>
            <span className="text-[11px] font-semibold text-white/80">
              {pendingAssignments.length} deadlines · {calendarEvents.length} meetings avoided
            </span>
          </div>
          <h2 className="text-lg font-extrabold leading-tight">Your week, planned from every source.</h2>
          <ul className="text-xs leading-relaxed text-white/90 space-y-1 list-disc pl-4">
            <li>Tracker + Canvas + Classroom + Gmail + Moodle in one exclusive 7-day timetable.</li>
            <li>Gmail-native inbox: Spam/Promos share a tab, Social separate, academic senders in Promo still AI-sorted — zero keywords.</li>
            <li>AI chain 3.5-flash → 3.0-flash → Groq with offline fallback — never blank.</li>
          </ul>
          <button
            onClick={() => onNavigateWorkspace('ai-planner')}
            className="px-5 py-2.5 bg-white text-[#4C1D95] rounded-xl text-xs font-extrabold hover:bg-white/90 transition flex items-center gap-2 cursor-pointer"
          >
            Open AI Planner <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Today's Plan — overdue grouping + due today */}
        {pendingAssignments.length > 0 ? (
          <div className="bg-white/70 dark:bg-[#1C1B19]/60 backdrop-blur-md rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-5 text-left space-y-3">
            {/* Next Up deadline countdown strip — hero banner at top of Today's Plan */}
            {nextDeadline && nextDeadlineInfo && (
              <div
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md text-left ${
                  nextDeadlineInfo.isOverdue
                    ? 'border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30'
                    : 'border-[#D97757]/30 dark:border-[#D97757]/30 bg-white/70 dark:bg-[#1C1B19]/60'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        nextDeadlineInfo.isOverdue ? 'bg-rose-500' : 'bg-[#D97757]'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        nextDeadlineInfo.isOverdue ? 'bg-rose-600' : 'bg-[#D97757]'
                      }`}
                    />
                  </span>
                  <span className="font-bold text-[#141413] dark:text-[#FAF9F5] shrink-0">{t('dash_next_up')}</span>
                  <span className="font-semibold text-[#141413] dark:text-[#FAF9F5] truncate">{nextDeadline.assignmentName}</span>
                  <span className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] truncate hidden sm:inline">• {nextDeadline.subject}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] sm:text-xs font-bold ${
                      nextDeadlineInfo.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-[#D97757] dark:text-[#E59A7C]'
                    }`}
                  >
                    {nextDeadlineInfo ? formatDeadline(nextDeadlineInfo) : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateWorkspace('tracker')}
                    className="px-3 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C86646] text-white text-[11px] font-bold transition-colors min-h-[32px] cursor-pointer"
                  >
                    {t('view')}
                  </button>
                </span>
              </div>
            )}
            {(() => {
              const todayStr = new Date().toISOString().slice(0,10);
              const hasValidDate = (a: typeof pendingAssignments[number]) => {
                if (!a.dueDate || typeof a.dueDate !== 'string') return false;
                return !Number.isNaN(new Date(a.dueDate.length === 10 ? `${a.dueDate}T23:59:59` : a.dueDate).getTime());
              };
              const isUnconfirmed = (a: typeof pendingAssignments[number]) =>
                (a as any)?.verificationStatus === 'unconfirmed' ||
                (a as any)?.verificationStatus === 'unknown-date' ||
                (a as any)?.needsReview === true;
              const overdue = pendingAssignments.filter(a => a.dueDate && a.dueDate < todayStr);
              const dueToday = pendingAssignments.filter(a => a.dueDate === todayStr);
              // Unknown-date items are quarantined: never shown with an invented countdown date.
              const upcoming = pendingAssignments.filter(a => hasValidDate(a) && a.dueDate > todayStr);
              const needsConfirmation = pendingAssignments.filter(a => !hasValidDate(a));
              const sorted = (arr: typeof pendingAssignments) => [...arr].sort((a,b)=>{
                const pri = { High:0, Med:1, Low:2 } as any;
                const pa = pri[a.priority] ?? 1; const pb = pri[b.priority] ?? 1;
                if (pa !== pb) return pa - pb;
                const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                return da - db;
              });
              return (
                <>
                  {overdue.length>0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{t('overdue')} • {overdue.length}</h4>
                      {sorted(overdue).slice(0,2).map(a=>(
                        <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs">
                          <span className="font-semibold truncate flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />{a.assignmentName}</span>
                          <span className="text-[11px] text-rose-700 dark:text-rose-300 ml-2 shrink-0">{a.subject} • {a.dueDate}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dueToday.length>0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">{t('due_today')} • {dueToday.length}</h4>
                      {sorted(dueToday).slice(0,2).map(a=>(
                        <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs">
                          <span className="font-semibold truncate flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />{a.assignmentName}</span>
                          <span className="text-[11px] text-amber-800 dark:text-amber-200 ml-2 shrink-0">{a.subject} • {t('today')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#6B6860] dark:text-[#B5B2A8] flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#D97757] dark:text-[#E59A7C]" />{t('upcoming')}</h4>
                    {sorted(upcoming).slice(0,3).map(a=>(
                      <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1A1917] border border-[#DFDACB]/40 text-xs">
                        <span className="font-semibold truncate flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.priority==='High'?'bg-rose-500': a.priority==='Med'?'bg-amber-500':'bg-emerald-500'}`} />{a.assignmentName}</span>
                        <span className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] ml-2 shrink-0">{a.subject} • {t('tracker_due')} {a.dueDate} {a.priority==='High' && <span className="ml-1 px-1 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[9px] font-bold">{t('dash_high_badge')}</span>}{isUnconfirmed(a) && <span title={(a as any)?.sourceQuote || 'AI-guessed deadline — confirm before trusting this date'} className="ml-1 px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-bold">Unconfirmed</span>}</span>
                      </div>
                    ))}
                    {needsConfirmation.length>0 && (
                      <button
                        type="button"
                        onClick={() => onNavigateWorkspace('tracker')}
                        title="These items carry no usable deadline — confirm dates in the tracker"
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-dashed border-amber-300 dark:border-amber-800 text-xs cursor-pointer"
                      >
                        <span className="font-semibold text-amber-800 dark:text-amber-200">Needs deadline confirmation • {needsConfirmation.length}</span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">Review →</span>
                      </button>
                    )}
                    {upcoming.length===0 && overdue.length===0 && dueToday.length===0 && <div className="text-xs text-[#6B6860] dark:text-[#B5B2A8] italic">{t('dash_all_caught_up')}</div>}
                  </div>
                </>
              );
            })()}
            <button onClick={()=>onNavigateWorkspace('tracker')} className="w-full py-2.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]">{t('dash_open_tracker')} <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
          </div>
        ) : (
          <div className="bg-white/70 dark:bg-[#1C1B19]/60 backdrop-blur-md rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 text-center">
            <EmptyAssignments />
          </div>
        )}

        {/* Personalize — collapsible drawer; defaults true for first-run (persist scc_dashboard_personalize_open) */}
        <details
          className="bg-white/40 dark:bg-[#1C1B19]/30 backdrop-blur-md rounded-3xl border border-[#DFDACB]/60 dark:border-[#2C2B27]/60 p-4 sm:p-5 text-xs text-left group"
          open={(() => { try { const v=localStorage.getItem('scc_dashboard_personalize_open'); return v===null ? true : v==='true'; } catch { return true; } })()}
          onToggle={(e)=>{ try{ localStorage.setItem('scc_dashboard_personalize_open', String((e.currentTarget as HTMLDetailsElement).open)); }catch{} }}
        >
          <summary className="list-none flex items-center justify-between cursor-pointer font-bold text-[#6B6860] dark:text-[#B5B2A8] uppercase tracking-wider">{t('dash_personalize')} <span className="flex items-center gap-1.5 text-[10px] bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] px-2 py-0.5 rounded-full">{t('edit')} <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" strokeWidth={1.75} /></span></summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Left: Vibe / Ambient Light Selection */}
          <div className="space-y-2">
            <span className="font-bold text-[#6B6860] dark:text-[#B5B2A8] uppercase tracking-wider block">
              {t('dash_vibe_title')}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'focus', label: t('dash_vibe_focus'), color: 'bg-[#D97757] text-white border-[#D97757]' },
                  { id: 'calm', label: t('dash_vibe_calm'), color: 'bg-blue-500 text-white border-blue-500' },
                  { id: 'creative', label: t('dash_vibe_creative'), color: 'bg-violet-500 text-white border-violet-500' },
                  { id: 'recharge', label: t('dash_vibe_recharge'), color: 'bg-emerald-500 text-white border-emerald-500' },
                ] as const
              ).map((vibe) => (
                <button
                  key={vibe.id}
                  onClick={() => handleSelectVibe(vibe.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                    selectedVibe === vibe.id
                      ? `${vibe.color} shadow-2xs`
                      : 'bg-white/70 dark:bg-[#1E1D1B]/50 border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757]'
                  }`}
                >
                  {vibe.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Daily Sprint Target Goal */}
          <div className="space-y-2 flex flex-col justify-center">
            <span className="font-bold text-[#6B6860] dark:text-[#B5B2A8] uppercase tracking-wider block">
              {t('dash_pomodoro_target')}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/70 dark:bg-[#1E1D1B]/50 border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl px-3 py-1 font-bold">
                <span className="font-mono text-sm text-[#141413] dark:text-[#FAF9F5]">
                  {safeCompletedFocusSessions} / {safeSprintGoal} {t('dash_sprints')}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white/70 dark:bg-[#1E1D1B]/50 border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl p-0.5">
                <button
                  onClick={() => handleAdjustSprintGoal(-1)}
                  className="p-1 text-[#6B6860] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5] transition-colors"
                  title={t('dash_decrease')}
                >
                  <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleAdjustSprintGoal(1)}
                  className="p-1 text-[#6B6860] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5] transition-colors"
                  title={t('dash_increase')}
                >
                  <ChevronUp className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
          </div>
        </details>

        {/* Habit Streak — memoized via streakMap (single JSON.parse) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
          <div className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-card text-left hover-lift">
            <h4 className="text-xs font-bold text-[#6B6860] dark:text-[#B5B2A8] uppercase tracking-wider flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-[#D97757] dark:text-[#E59A7C]" strokeWidth={1.75} /> {t('dash_streak_title')}</h4>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {Array.from({length:28}).map((_,i)=>{
                const d=new Date(); d.setDate(d.getDate()-(27-i));
                const dateStr=d.toISOString().slice(0,10);
                let mins = streakMap.get(dateStr) || 0;
                if(mins===0 && dateStr===new Date().toISOString().slice(0,10) && safeCompletedFocusSessions>0 && streakMap.size<=1) mins=safeCompletedFocusSessions*25;
                let intensity='bg-[#EFECE2] dark:bg-[#252422]';
                if(mins>=60) intensity='bg-emerald-600';
                else if(mins>=45) intensity='bg-emerald-500';
                else if(mins>=25) intensity='bg-emerald-300';
                else if(mins>0) intensity='bg-emerald-200 dark:bg-emerald-900/50';
                return <div key={i} className={`w-full aspect-square rounded-sm ${intensity}`} title={`${dateStr}: ${mins}m`} />
              })}
            </div>
            <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] mt-2">{safeCompletedFocusSessions} {t('dash_focus_sprints')} • {safeSprintGoal} {t('dash_daily_target')}</p>
          </div>
          <div className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-card text-left hover-lift">
            <h4 className="text-xs font-bold text-[#6B6860] dark:text-[#B5B2A8] uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#A78BFA]" strokeWidth={1.75} /> {t('dash_focus_analytics')}</h4>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs"><span>{t('dash_deep_work')}</span><span className="font-mono font-bold">{safeCompletedFocusSessions * 25}m / {safeSprintGoal * 25}m</span></div>
              <div className="h-2 bg-[#EFECE2] dark:bg-[#252422] rounded-full overflow-hidden"><div className="h-full bg-[#D97757]" style={{width: `${focusProgressPct}%`}} /></div>
              <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8]">{t('dash_completion_funnel')} {assignments.filter(a=>a.status==='Done').length}/{assignments.length} {t('dash_tasks_done')}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Row — primary terracotta CTA only, secondary tertiary ghost */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigateWorkspace('canvas')}
            className={`px-8 py-3.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-[#D97757]/15 hover:shadow-[#D97757]/30 hover:scale-[1.02] flex items-center gap-2 cursor-pointer group min-h-[44px]`}
          >
            <span>{t('dash_enter_lms')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
          </button>

          {onOpenStudyPlan && (
            <button
              onClick={onOpenStudyPlan}
              className="px-2 py-2 text-xs font-semibold text-[#D97757] dark:text-[#E59A7C] hover:text-[#C86646] dark:hover:text-[#E59A7C] hover:underline underline-offset-4 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{t('dash_ai_plan')}</span>
            </button>
          )}
        </div>

        {/* Serif Quote Block */}
        <div className="space-y-3.5 pt-4 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 relative group">
          <div className="flex items-center justify-center gap-2">
            <Quote className="w-4 h-4 text-[#D97757]/30 dark:text-[#E59A7C]/30 mx-auto" />
            <button
              onClick={handleShuffleQuote}
              className="p-1 text-[#8C897F] dark:text-[#B5B2A8] hover:text-[#D97757] dark:hover:text-[#E59A7C] rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer absolute right-2"
              title={t('dash_another_quote')}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>
          <blockquote className="text-base sm:text-lg font-serif italic text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed max-w-xl mx-auto">
            &ldquo;{quote.quote}&rdquo;
          </blockquote>
          <cite className="text-xs font-bold text-[#8C897F] dark:text-[#B5B2A8] not-italic block">
            — {quote.author} <span className="text-[10px] font-mono text-[#8C897F]/75 dark:text-[#B5B2A8]/75">({quote.field})</span>
          </cite>
        </div>

        {/* NASA Astronomy Picture of the Day — visible educational card (toggle in Settings → Appearance) */}
        {apodEnabled && (
          <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-4 shadow-card text-left space-y-3" aria-label={t('dash_apod_aria')}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B6860] dark:text-[#B5B2A8]">{t('nasa_title')}</h4>
            </div>
            {apodLoading && !nasaApod && (
              <div className="animate-pulse space-y-2" role="status" aria-live="polite" aria-label={t('dash_apod_loading')}>
                <div className="h-40 bg-[#EFECE2] dark:bg-[#252422] rounded-xl" />
                <div className="h-3 bg-[#EFECE2] dark:bg-[#252422] rounded w-2/3" />
                <div className="h-3 bg-[#EFECE2] dark:bg-[#252422] rounded w-1/2" />
              </div>
            )}
            {apodError && !nasaApod && (
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950 via-[#1A1917] to-[#D97757]/20 border border-[#DFDACB] dark:border-[#2C2B27] text-xs space-y-2" role="status" aria-live="polite">
                <p className="font-bold text-[#141413] dark:text-[#FAF9F5]">NASA giới hạn hoặc mất mạng. Đang hiện ảnh dự phòng — bấm Thử lại.</p>
                <p className="text-[#6B6860] dark:text-[#B5B2A8]">{apodError}</p>
                <button type="button" onClick={reloadApod} className="px-3 py-2 bg-[#D97757] text-white rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Thử lại • Retry</button>
              </div>
            )}
            {nasaApod && (
              <div className="space-y-2">
                {nasaApod.mediaType === 'image' ? (
                  <img src={nasaApod.url} alt={nasaApod.title || 'NASA Astronomy Picture of the Day'} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" className="w-full max-h-72 object-cover rounded-xl border border-[#DFDACB] dark:border-[#2C2B27]" />
                ) : (
                  <div className="p-3 rounded-xl bg-indigo-950 text-white text-xs space-y-2">
                    {nasaApod.thumbnailUrl && (
                      <img src={nasaApod.thumbnailUrl} alt={nasaApod.title || 'NASA video thumbnail'} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full max-h-72 object-cover rounded-xl border border-white/20" />
                    )}
                    <p className="font-bold">Hôm nay NASA chọn video — Today&apos;s NASA pick is a video</p>
                    <a href={nasaApod.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 font-bold inline-block min-h-[44px] py-2">Xem video trên NASA • Watch video on NASA</a>
                  </div>
                )}
                <p className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">{nasaApod.title} <span className="font-mono font-medium text-[10px] text-[#6B6860]">{nasaApod.date}</span></p>
                {nasaApod.explanation && (
                  <p className="text-[11px] leading-relaxed text-[#5C5A54] dark:text-[#B5B2A8]">
                    {apodExpanded || nasaApod.explanation.length <= 280 ? nasaApod.explanation : `${nasaApod.explanation.slice(0, 280)}… `}
                    {nasaApod.explanation.length > 280 && (
                      <button type="button" onClick={() => setApodExpanded(!apodExpanded)} className="font-bold text-[#D97757] dark:text-[#E59A7C] hover:underline underline-offset-4 ml-1 cursor-pointer" aria-expanded={apodExpanded}>
                        {apodExpanded ? t('show_less') : t('dash_read_more')}
                      </button>
                    )}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 text-[10px] text-[#6B6860] dark:text-[#B5B2A8]">
                  <span>{t('dash_image_credit')}{nasaApod.copyright ? ` • © ${nasaApod.copyright}` : ''}</span>
                  {nasaApod.hdurl && <a href={nasaApod.hdurl} target="_blank" rel="noreferrer" className="font-bold text-[#D97757] dark:text-[#E59A7C] hover:underline underline-offset-4 shrink-0">{t('dash_open_hd')}</a>}
                </div>
                {apodError && <p className="text-[10px] text-amber-700 dark:text-amber-300" role="status">{t('dash_apod_error')} <button type="button" onClick={reloadApod} className="font-bold underline underline-offset-4 cursor-pointer min-h-[44px] px-2">{t('retry')}</button></p>}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom Section: Command Center Label */}
      <div className="text-[10px] text-[#8C897F] dark:text-[#B5B2A8] font-mono select-none uppercase tracking-wider shrink-0">
        Student Command Center • Version 2.4.2
      </div>

    </div>
  );
};
