import React, { useState, useMemo, useEffect } from 'react';
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
  Calendar,
  LayoutGrid,
  Circle,
  SlidersHorizontal,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { getTodayQuote, QUOTE_BANK, DailyQuote } from '../data/quotes';
import { useNasaApod } from '../hooks/useNasaApod';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { EmptyAssignments } from './EmptyState';
import { MainFlowCard, isCanvasHidden } from './MainFlowCard';
import { APP_CATALOG, loadPinnedAppIds } from './AppStoreModal';
import { AppLogo } from './AppLogo';
import { setLayoutMode, type LayoutMode } from '../services/layoutMode';
import { useT } from '../services/i18n';

const LOCAL_STORAGE_NAME_KEY = 'scc_user_preferred_name';
const LOCAL_STORAGE_INTENTION_KEY = 'scc_user_daily_intention';
const LOCAL_STORAGE_VIBE_KEY = 'scc_user_selected_vibe';

interface DashboardHomeProps {
  assignments: Assignment[];
  onToggleAssignment?: (id: string) => void;
  onNavigateWorkspace: (tabId: string) => void;
  onOpenQuickDraft?: any;
  onOpenAiSuite?: any;
  onOpenAppStore?: () => void;
  onOpenAiCoach?: () => void;
  layoutMode?: LayoutMode;
  user?: User | null;
  isGoogleConnected?: boolean;
  isGmailConnected?: boolean;
  isClassroomConnected?: boolean;
  onConnectGoogle?: () => void;
  onOpenStudyPlan?: () => void;
  calendarEvents?: CalendarEvent[];
  emailAlerts?: EmailAlert[];
  isLoadingEvents?: boolean;
  canvasCount?: number;
  classroomCount?: number;
}

type VibeType = 'focus' | 'calm' | 'creative' | 'recharge';

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  assignments,
  onToggleAssignment,
  onNavigateWorkspace,
  onOpenAppStore,
  onOpenAiCoach,
  layoutMode = 'calm',
  user,
  isGoogleConnected = false,
  isGmailConnected,
  isClassroomConnected,
  onConnectGoogle,
  onOpenStudyPlan,
  calendarEvents = [],
  emailAlerts = [],
  isLoadingEvents = false,
  canvasCount = 0,
  classroomCount = 0,
}) => {
  const { t, lang, formatDate } = useT();

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
      t('dash_default_student')
    );
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(studentName);

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || t('dash_default_student');
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

  // Personalized Daily Vibe selector (calm token-based accent)
  const [selectedVibe, setSelectedVibe] = useState<VibeType>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_VIBE_KEY) as VibeType) || 'focus';
  });

  const handleSelectVibe = (vibe: VibeType) => {
    setSelectedVibe(vibe);
    localStorage.setItem(LOCAL_STORAGE_VIBE_KEY, vibe);
  };

  // Personalized Focus Sprint Goal via Zustand
  const { sprintGoal, setSprintGoal, completedSessions } = usePomodoroStore();
  const storeState = usePomodoroStore.getState() as unknown as { completedFocusSessions?: unknown };
  const rawFocusSessions: unknown = storeState.completedFocusSessions ?? completedSessions;
  const safeCompletedFocusSessions = Number.isFinite(rawFocusSessions) ? (rawFocusSessions as number) : 0;
  const safeSprintGoal = Number.isFinite(sprintGoal) ? (sprintGoal as number) : 0;
  const focusProgressPct = safeSprintGoal > 0 ? Math.min(100, (safeCompletedFocusSessions / safeSprintGoal) * 100) : 0;
  const handleAdjustSprintGoal = (amount: number) => {
    setSprintGoal(Math.max(1, (Number.isFinite(sprintGoal) ? (sprintGoal as number) : 0) + amount));
  };

  // Pinned / Quick App Shortcuts (syncs with App Store updates & Canvas visibility)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadPinnedAppIds());
  const [canvasHidden, setCanvasHidden] = useState<boolean>(() => isCanvasHidden());
  useEffect(() => {
    const onPinned = (e: Event) => {
      const detail = (e as CustomEvent<string[]>)?.detail;
      setPinnedIds(Array.isArray(detail) ? detail : loadPinnedAppIds());
    };
    const onCanvasVis = (e: Event) => {
      setCanvasHidden(Boolean((e as CustomEvent<boolean>)?.detail));
    };
    window.addEventListener('scc-pinned-apps-updated', onPinned);
    window.addEventListener('scc-canvas-visibility', onCanvasVis);
    return () => {
      window.removeEventListener('scc-pinned-apps-updated', onPinned);
      window.removeEventListener('scc-canvas-visibility', onCanvasVis);
    };
  }, []);

  const pinnedShortcuts = useMemo(() => {
    return pinnedIds
      .filter((id) => !(id === 'canvas' && canvasHidden))
      .map((id) => APP_CATALOG.find((app) => app.id === id))
      .filter((app): app is NonNullable<typeof app> => Boolean(app))
      .slice(0, 6);
  }, [pinnedIds, canvasHidden]);

  // Streak heatmap — memoized once per render
  const streakMap = useMemo(() => {
    try {
      const raw = localStorage.getItem('scc_focus_sessions_log');
      const parsed = raw ? JSON.parse(raw) : [];
      const log: { date: string; minutes: number }[] = Array.isArray(parsed) ? parsed : [];
      const map = new Map<string, number>();
      log.forEach((e) => {
        if (e && typeof e.date === 'string' && typeof e.minutes === 'number' && Number.isFinite(e.minutes) && e.minutes > 0) {
          map.set(e.date, (map.get(e.date) || 0) + e.minutes);
        }
      });
      if (map.size === 0 && safeCompletedFocusSessions > 0) {
        const today = new Date().toISOString().slice(0, 10);
        map.set(today, safeCompletedFocusSessions * 25);
      }
      return map;
    } catch {
      return new Map<string, number>();
    }
  }, [safeCompletedFocusSessions]);

  // Today's quote
  const [quote, setQuote] = useState<DailyQuote>(() => getTodayQuote());
  const handleShuffleQuote = () => {
    const currentIdx = QUOTE_BANK.findIndex((q) => q.quote === quote.quote);
    let randomIndex = Math.floor(Math.random() * QUOTE_BANK.length);
    if (QUOTE_BANK.length > 1 && randomIndex === currentIdx) {
      randomIndex = (randomIndex + 1 + Math.floor(Math.random() * (QUOTE_BANK.length - 1))) % QUOTE_BANK.length;
      if (randomIndex === currentIdx) randomIndex = (randomIndex + 1) % QUOTE_BANK.length;
    }
    setQuote(QUOTE_BANK[randomIndex]);
  };

  // Pending assignments & grouping
  const pendingAssignments = useMemo(() => {
    return assignments.filter((a) => a.status !== 'Done' && !a.trashedAt);
  }, [assignments]);

  const { overdueTasks, dueTodayTasks, upcomingTasks } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sortFn = (arr: Assignment[]) =>
      [...arr].sort((a, b) => {
        const pri: Record<string, number> = { High: 0, Med: 1, Low: 2 };
        const pa = pri[a.priority] ?? 1;
        const pb = pri[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
    return {
      overdueTasks: sortFn(pendingAssignments.filter((a) => a.dueDate && a.dueDate < todayStr)),
      dueTodayTasks: sortFn(pendingAssignments.filter((a) => a.dueDate === todayStr)),
      upcomingTasks: sortFn(pendingAssignments.filter((a) => !a.dueDate || a.dueDate > todayStr)),
    };
  }, [pendingAssignments]);

  // Next-up deadline strip
  const nextDeadline = useMemo(() => {
    const dated = pendingAssignments.filter((a) => {
      if (!a.dueDate || typeof a.dueDate !== 'string') return false;
      const ts = new Date(a.dueDate.length === 10 ? `${a.dueDate}T23:59:59` : a.dueDate).getTime();
      return !Number.isNaN(ts);
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
    const diffMs = dueTime - Date.now();
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
    const span =
      info.days > 0
        ? `${info.days}${t('dash_day_unit')} ${info.hours}${t('dash_hour_unit')}`
        : `${info.hours}${t('dash_hour_unit')}`;
    return info.isOverdue ? `${t('dash_overdue_by')} ${span}` : `${t('dash_due_in')} ${span}`;
  };

  const todayFormattedDate = useMemo(() => {
    return formatDate(new Date(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [formatDate, lang]);

  // Compact Today's Schedule events (sorted, max 4)
  const compactEvents = useMemo(() => {
    if (!calendarEvents || calendarEvents.length === 0) return [];
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isoToday = now.toISOString().slice(0, 10);
    const todayOnly = calendarEvents.filter((ev) => {
      const startStr = ev.start?.dateTime || ev.start?.date || '';
      const d = startStr.slice(0, 10);
      return d === localToday || d === isoToday;
    });
    const list = todayOnly.length > 0 ? todayOnly : calendarEvents;
    return [...list]
      .sort((a, b) => {
        const ta = Date.parse(a.start?.dateTime || a.start?.date || '') || 0;
        const tb = Date.parse(b.start?.dateTime || b.start?.date || '') || 0;
        return ta - tb;
      })
      .slice(0, 4);
  }, [calendarEvents]);

  const formatEventTime = (ev: CalendarEvent) => {
    if (ev.start?.dateTime) {
      const d = new Date(ev.start.dateTime);
      if (!Number.isNaN(d.getTime())) {
        return formatDate(d, { hour: 'numeric', minute: '2-digit' });
      }
    }
    return t('radar_all_day');
  };

  const { enabled: apodEnabled, apod: nasaApod, loading: apodLoading, error: apodError, reload: reloadApod } = useNasaApod();
  const [apodExpanded, setApodExpanded] = useState(false);

  if (layoutMode === 'calm') {
    const VIBE_CHIPS: { id: VibeType; label: string }[] = [
      { id: 'focus', label: t('dash_vibe_focus') },
      { id: 'calm', label: t('dash_vibe_calm') },
      { id: 'creative', label: t('dash_vibe_creative') },
      { id: 'recharge', label: t('dash_vibe_recharge') },
    ];

    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10 text-left animate-in fade-in duration-300">
        {/* Calming Welcome Header */}
        <header className="space-y-4">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
            {todayFormattedDate}
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="px-3 py-1.5 text-2xl sm:text-4xl font-bold bg-[var(--bg-surface)] border border-[var(--accent-fill)] rounded-xl text-[var(--text-primary)] max-w-xs"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveName}
                aria-label={t('common_save')}
                className="p-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl cursor-pointer min-h-[40px]"
              >
                <Check className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight leading-tight truncate">
                {greetingPrefix}, <span>{studentName}</span>
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(studentName);
                  setIsEditingName(true);
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors shrink-0 cursor-pointer"
                aria-label={t('dash_edit_name')}
                title={t('dash_edit_name')}
              >
                <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* Soft Daily Intention */}
          <div>
            {isEditingIntention ? (
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={intentionInput}
                  onChange={(e) => setIntentionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveIntention()}
                  placeholder={t('dash_intention_ph')}
                  className="w-full px-3 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--accent-fill)] rounded-xl text-[var(--text-primary)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveIntention}
                  aria-label={t('common_save')}
                  className="p-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIntentionInput(dailyIntention);
                  setIsEditingIntention(true);
                }}
                className="text-sm sm:text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                title={t('dash_intention_title')}
              >
                {dailyIntention ? `"${dailyIntention}"` : t('dash_calm_intention_prompt')}
              </button>
            )}
          </div>

          {/* Gentle Study Vibe Selector */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {VIBE_CHIPS.map((vibe) => (
              <button
                key={vibe.id}
                type="button"
                onClick={() => handleSelectVibe(vibe.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  selectedVibe === vibe.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                    : 'bg-[var(--bg-surface)]/70 text-[var(--text-muted)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                }`}
              >
                {vibe.label}
              </button>
            ))}
          </div>
        </header>

        {/* Quiet Reflection Quote */}
        <section className="rounded-2xl bg-[var(--bg-subtle)]/45 border border-[var(--border-hairline)] px-6 py-5 flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <blockquote className="text-base sm:text-lg font-serif italic text-[var(--text-primary)] leading-relaxed">
              &ldquo;{quote.quote}&rdquo;
            </blockquote>
            <cite className="text-xs text-[var(--text-muted)] not-italic block">
              — {quote.author}
            </cite>
          </div>
          <button
            type="button"
            onClick={handleShuffleQuote}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer shrink-0"
            title={t('dash_another_quote')}
            aria-label={t('dash_another_quote')}
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </section>

        {/* 3 Airy Invitations — Calm Starting Paths Without Stress */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigateWorkspace('pomodoro')}
            className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-left space-y-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center">
              <Timer className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
              {t('dash_calm_card_focus_title')}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t('dash_calm_card_focus_desc')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateWorkspace('radar')}
            className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-left space-y-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] flex items-center justify-center">
              <Calendar className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
              {t('dash_calm_card_rhythm_title')}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t('dash_calm_card_rhythm_desc')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => (onOpenAiCoach ? onOpenAiCoach() : onNavigateWorkspace('notes-markdown'))}
            className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-left space-y-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)] flex items-center justify-center">
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
              {t('dash_calm_card_coach_title')}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t('dash_calm_card_coach_desc')}
            </p>
          </button>
        </section>

        {/* Quiet Quick Links & Mode Switch */}
        <footer className="pt-4 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateWorkspace('tracker')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {t('dash_calm_link_tasks')}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('gmail')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {t('side_flow_gmail_t')}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('notes-markdown')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {t('app_tab_notes')}
            </button>
            {onOpenAppStore && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenAppStore}
                  className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {t('side_app_store')}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setLayoutMode('classic')}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)] underline underline-offset-4 cursor-pointer"
          >
            {t('dash_switch_to_classic')}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5 text-left animate-in fade-in duration-200">
      {/* (a) Greeting, Daily Intention & Quick Actions Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <span>{todayFormattedDate}</span>
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="px-3 py-1.5 text-2xl sm:text-3xl font-extrabold bg-[var(--bg-surface)] border border-[var(--accent-fill)] rounded-xl text-[var(--text-primary)] max-w-xs"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveName}
                aria-label={t('common_save')}
                className="p-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl cursor-pointer min-h-[40px]"
              >
                <Check className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight truncate">
                {greetingPrefix}, <span>{studentName}</span>
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(studentName);
                  setIsEditingName(true);
                }}
                className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors shrink-0 cursor-pointer"
                aria-label={t('dash_edit_name')}
                title={t('dash_edit_name')}
              >
                <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* Inline Daily Intention */}
          <div>
            {isEditingIntention ? (
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={intentionInput}
                  onChange={(e) => setIntentionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveIntention()}
                  placeholder={t('dash_intention_ph')}
                  className="w-full px-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--accent-fill)] rounded-xl text-[var(--text-primary)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveIntention}
                  aria-label={t('common_save')}
                  className="p-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIntentionInput(dailyIntention);
                  setIsEditingIntention(true);
                }}
                className="text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer italic text-left"
                title={t('dash_intention_title')}
              >
                {dailyIntention ? `"${dailyIntention}"` : t('dash_intention_empty')}
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!canvasHidden && (
            <button
              type="button"
              onClick={() => onNavigateWorkspace('canvas')}
              className="px-3.5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[36px] transition-colors"
            >
              <span>{t('dash_enter_lms')}</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateWorkspace('pomodoro')}
            className="px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer min-h-[36px] transition-colors"
          >
            <Timer className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
            <span>{t('app_tab_pomodoro')}</span>
          </button>
          {onOpenStudyPlan && (
            <button
              type="button"
              onClick={onOpenStudyPlan}
              className="px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer min-h-[36px] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              <span>{t('plan_title')}</span>
            </button>
          )}
        </div>
      </header>

      {/* (a) Hero Focus Strip — Next Deadline */}
      {nextDeadline && nextDeadlineInfo && (
        <div
          className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl border ${
            nextDeadlineInfo.isOverdue
              ? 'border-[var(--status-err-border)]/70 bg-[var(--status-err-bg)]/70'
              : 'border-[var(--border-default)] bg-[var(--bg-surface)]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 text-xs sm:text-[13px]">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                nextDeadlineInfo.isOverdue ? 'bg-[var(--status-err-text)]' : 'bg-[var(--accent-fill)]'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--text-secondary)] shrink-0">{t('dash_next_up')}</span>
            <span className="font-semibold text-[var(--text-primary)] truncate">{nextDeadline.assignmentName}</span>
            {nextDeadline.subject && (
              <span className="text-xs text-[var(--text-muted)] truncate hidden sm:inline">· {nextDeadline.subject}</span>
            )}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <span
              className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md ${
                nextDeadlineInfo.isOverdue
                  ? 'bg-[var(--bg-surface)] text-[var(--status-err-text)] border border-[var(--status-err-border)]/60'
                  : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
              }`}
            >
              {formatDeadline(nextDeadlineInfo)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('tracker')}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors min-h-[30px] cursor-pointer"
            >
              {t('view')}
            </button>
          </div>
        </div>
      )}

      {/* (b) Compact Schedule & Tasks Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Clean Hairline Assignment List */}
        <section
          aria-label={t('app_tab_tracker')}
          className="lg:col-span-7 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{t('app_tab_tracker')}</h2>
              {pendingAssignments.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                  {pendingAssignments.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('tracker')}
              className="text-xs font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>{t('dash_open_tracker')}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4">
            {pendingAssignments.length > 0 ? (
              <div className="space-y-4">
                {overdueTasks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-err-text)] mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-err-text)]" aria-hidden="true" />
                      {t('overdue')} · <span className="tabular-nums">{overdueTasks.length}</span>
                    </h3>
                    <div className="divide-y divide-[var(--border-hairline)]">
                      {overdueTasks.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 py-2 px-1.5 rounded-lg hover:bg-[var(--status-err-bg)]/45 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {onToggleAssignment ? (
                              <button
                                type="button"
                                onClick={() => onToggleAssignment(a.id)}
                                aria-label={`${t('mark_done')}: ${a.assignmentName}`}
                                className="text-[var(--status-err-text)] hover:opacity-80 cursor-pointer shrink-0"
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[var(--status-err-text)] shrink-0" />
                            )}
                            <span className="font-medium text-[var(--text-primary)] truncate">{a.assignmentName}</span>
                          </div>
                          <span className="text-[11px] text-[var(--status-err-text)] font-medium shrink-0 tabular-nums">
                            {a.subject} · {a.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dueTodayTasks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-warn-text)] mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warn-text)]" aria-hidden="true" />
                      {t('due_today')} · <span className="tabular-nums">{dueTodayTasks.length}</span>
                    </h3>
                    <div className="divide-y divide-[var(--border-hairline)]">
                      {dueTodayTasks.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 py-2 px-1.5 rounded-lg hover:bg-[var(--status-warn-bg)]/45 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {onToggleAssignment ? (
                              <button
                                type="button"
                                onClick={() => onToggleAssignment(a.id)}
                                aria-label={`${t('mark_done')}: ${a.assignmentName}`}
                                className="text-[var(--status-warn-text)] hover:opacity-80 cursor-pointer shrink-0"
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[var(--status-warn-text)] shrink-0" />
                            )}
                            <span className="font-medium text-[var(--text-primary)] truncate">{a.assignmentName}</span>
                          </div>
                          <span className="text-[11px] text-[var(--status-warn-text)] font-medium shrink-0">
                            {a.subject} · {t('today')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[var(--accent-text)]" aria-hidden="true" />
                    <span>{t('upcoming')}</span>
                  </h3>
                  {upcomingTasks.length > 0 ? (
                    <div className="divide-y divide-[var(--border-hairline)]">
                      {upcomingTasks.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 py-2 px-1.5 rounded-lg hover:bg-[var(--bg-subtle)]/65 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {onToggleAssignment ? (
                              <button
                                type="button"
                                onClick={() => onToggleAssignment(a.id)}
                                aria-label={`${t('mark_done')}: ${a.assignmentName}`}
                                className="text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer shrink-0"
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  a.priority === 'High'
                                    ? 'bg-[var(--status-err-text)]'
                                    : a.priority === 'Med'
                                      ? 'bg-[var(--status-warn-border)]'
                                      : 'bg-[var(--status-ok-border)]'
                                }`}
                              />
                            )}
                            <span className="font-medium text-[var(--text-primary)] truncate">{a.assignmentName}</span>
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] shrink-0 flex items-center gap-1.5 tabular-nums">
                            <span>
                              {a.subject}
                              {a.dueDate ? ` · ${a.dueDate}` : ''}
                            </span>
                            {a.priority === 'High' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-err-text)]" title={t('dash_high_badge')} />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    overdueTasks.length === 0 && dueTodayTasks.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] italic py-1">{t('dash_all_caught_up')}</p>
                    )
                  )}
                </div>
              </div>
            ) : (
              <EmptyAssignments
                onImportCanvas={() => onNavigateWorkspace('canvas')}
                onCreate={() => onNavigateWorkspace('tracker')}
              />
            )}
          </div>
        </section>

        {/* Right: Clean Hairline Schedule Overview */}
        <section
          aria-label={t('radar_timeline')}
          className="lg:col-span-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{t('radar_timeline')}</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateWorkspace('radar')}
              className="text-xs font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>{t('app_tab_radar')}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4">
            {isLoadingEvents ? (
              <div className="space-y-2" role="status" aria-label={t('radar_syncing')}>
                <div className="scc-skeleton h-9" />
                <div className="scc-skeleton h-9" />
                <div className="scc-skeleton h-9" />
              </div>
            ) : compactEvents.length > 0 ? (
              <div className="divide-y divide-[var(--border-hairline)]">
                {compactEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-3 py-2.5 px-1 rounded-lg hover:bg-[var(--bg-subtle)]/55 transition-colors text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text-primary)] truncate">{ev.summary}</div>
                      {ev.location && (
                        <div className="text-[11px] text-[var(--text-muted)] truncate">{ev.location}</div>
                      )}
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-[var(--accent-text)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                      {formatEventTime(ev)}
                    </span>
                  </div>
                ))}
              </div>
            ) : !isGoogleConnected ? (
              <div className="py-3 space-y-3 text-xs">
                <p className="text-[var(--text-secondary)] leading-relaxed">{t('radar_disconnected_hint')}</p>
                {onConnectGoogle && (
                  <button
                    type="button"
                    onClick={onConnectGoogle}
                    className="px-3.5 py-2 rounded-lg bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold cursor-pointer min-h-[34px] transition-colors"
                  >
                    {t('radar_connect_cal')}
                  </button>
                )}
              </div>
            ) : (
              <div className="py-3 space-y-2 text-xs">
                <p className="font-medium text-[var(--text-secondary)]">{t('radar_no_commit')}</p>
                <button
                  type="button"
                  onClick={() => onNavigateWorkspace('radar')}
                  className="text-xs font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer"
                >
                  {t('radar_schedule_45')} →
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Main Flow Summary */}
      <MainFlowCard
        assignments={assignments}
        emailAlerts={emailAlerts}
        onNavigate={onNavigateWorkspace}
        isGoogleConnected={isGoogleConnected}
        isGmailConnected={isGmailConnected}
        isClassroomConnected={isClassroomConnected}
        canvasCount={canvasCount}
        classroomCount={classroomCount}
      />

      {/* (c) Pinned / Quick App Shortcuts */}
      <section
        aria-label={t('side_pinned')}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-card space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">{t('side_pinned')}</h2>
          </div>
          {onOpenAppStore && (
            <button
              type="button"
              onClick={onOpenAppStore}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-bold cursor-pointer"
            >
              {t('side_open_store')}
            </button>
          )}
        </div>
        {pinnedShortcuts.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic">{t('side_no_pinned')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {pinnedShortcuts.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => onNavigateWorkspace(app.id)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-left transition-colors cursor-pointer min-w-0 min-h-[48px]"
              >
                <AppLogo id={app.id} size="sm" className="shrink-0" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{t(app.nameKey)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Secondary Disclosures (collapsed by default so main viewport stays content-first) */}
      <div className="space-y-3">
        {/* Focus Analytics, Habit Streak & Daily Quote */}
        <details className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 text-xs group shadow-card">
          <summary className="list-none flex items-center justify-between cursor-pointer font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[32px]">
            <span className="flex items-center gap-2 uppercase tracking-wider">
              <Timer className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
              <span>{t('dash_focus_analytics')}</span>
              <span className="font-mono font-semibold text-[var(--text-muted)] normal-case tracking-normal">
                • {safeCompletedFocusSessions}/{safeSprintGoal} {t('dash_sprints')}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" strokeWidth={1.75} />
          </summary>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 28-Day Habit Streak */}
              <div className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-[var(--accent-text)]" strokeWidth={1.75} />
                  <span>{t('dash_streak_title')}</span>
                </h3>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (27 - i));
                    const dateStr = d.toISOString().slice(0, 10);
                    let mins = streakMap.get(dateStr) || 0;
                    if (mins === 0 && dateStr === new Date().toISOString().slice(0, 10) && safeCompletedFocusSessions > 0 && streakMap.size <= 1) {
                      mins = safeCompletedFocusSessions * 25;
                    }
                    let cellStyle = 'bg-[var(--bg-surface)] border border-[var(--border-default)]';
                    if (mins >= 60) cellStyle = 'bg-[var(--status-ok-text)] border border-[var(--status-ok-border)]';
                    else if (mins >= 45) cellStyle = 'bg-[var(--status-ok-border)] border border-[var(--status-ok-border)]';
                    else if (mins > 0) cellStyle = 'bg-[var(--status-ok-bg)] border border-[var(--status-ok-border)]';
                    return <div key={i} className={`w-full aspect-square rounded-sm ${cellStyle}`} title={`${dateStr}: ${mins}m`} />;
                  })}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  {safeCompletedFocusSessions} {t('dash_focus_sprints')} • {safeSprintGoal} {t('dash_daily_target')}
                </p>
              </div>

              {/* Focus Analytics */}
              <div className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" strokeWidth={1.75} />
                    <span>{t('dash_focus_analytics')}</span>
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-primary)]">
                      <span>{t('dash_deep_work')}</span>
                      <span className="font-mono font-bold">
                        {safeCompletedFocusSessions * 25}m / {safeSprintGoal * 25}m
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent-fill)] transition-all duration-300" style={{ width: `${focusProgressPct}%` }} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-3">
                  {t('dash_completion_funnel')} {assignments.filter((a) => a.status === 'Done').length}/{assignments.length} {t('dash_tasks_done')}
                </p>
              </div>
            </div>

            {/* Compact Serif Quote */}
            <div className="pt-3 border-t border-[var(--border-default)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Quote className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <blockquote className="text-sm font-serif italic text-[var(--text-secondary)] leading-relaxed">
                    &ldquo;{quote.quote}&rdquo;
                  </blockquote>
                  <cite className="text-[11px] font-bold text-[var(--text-muted)] not-italic block mt-1">
                    — {quote.author} <span className="font-mono">({quote.field})</span>
                  </cite>
                </div>
              </div>
              <button
                type="button"
                onClick={handleShuffleQuote}
                className="p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors cursor-pointer shrink-0"
                title={t('dash_another_quote')}
                aria-label={t('dash_another_quote')}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </details>

        {/* Personalize Disclosure */}
        <details
          className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 text-xs group shadow-card"
          open={(() => {
            try {
              return localStorage.getItem('scc_dashboard_personalize_open') === 'true';
            } catch {
              return false;
            }
          })()}
          onToggle={(e) => {
            try {
              localStorage.setItem('scc_dashboard_personalize_open', String((e.currentTarget as HTMLDetailsElement).open));
            } catch {}
          }}
        >
          <summary className="list-none flex items-center justify-between cursor-pointer font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[32px]">
            <span className="flex items-center gap-2 uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
              <span>{t('dash_personalize')}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2.5 py-0.5 rounded-full text-[var(--text-secondary)]">
              <span>{t('edit')}</span>
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" strokeWidth={1.75} />
            </span>
          </summary>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Vibe Selection */}
            <div className="space-y-2">
              <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                {t('dash_vibe_title')}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { id: 'focus', label: t('dash_vibe_focus'), activeClass: 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]' },
                  { id: 'calm', label: t('dash_vibe_calm'), activeClass: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]' },
                  { id: 'creative', label: t('dash_vibe_creative'), activeClass: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]' },
                  { id: 'recharge', label: t('dash_vibe_recharge'), activeClass: 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border-[var(--status-ok-border)]' },
                ] as const).map((vibe) => (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => handleSelectVibe(vibe.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer border ${
                      selectedVibe === vibe.id
                        ? vibe.activeClass
                        : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {vibe.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Sprint Target Goal */}
            <div className="space-y-2 flex flex-col justify-center">
              <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                {t('dash_pomodoro_target')}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl px-3 py-1.5 font-bold">
                  <span className="font-mono text-sm text-[var(--text-primary)]">
                    {safeCompletedFocusSessions} / {safeSprintGoal} {t('dash_sprints')}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustSprintGoal(-1)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title={t('dash_decrease')}
                    aria-label={t('dash_decrease')}
                  >
                    <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSprintGoal(1)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title={t('dash_increase')}
                    aria-label={t('dash_increase')}
                  >
                    <ChevronUp className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* NASA APOD — Collapsed Disclosure */}
        {apodEnabled && (
          <details
            className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 text-left group shadow-card"
            aria-label={t('dash_apod_aria')}
          >
            <summary className="list-none flex items-center justify-between gap-2 cursor-pointer text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[32px]">
              <span className="flex items-center gap-2 min-w-0">
                <span className="uppercase tracking-wider shrink-0">{t('nasa_title')}</span>
                {nasaApod?.title && (
                  <span className="font-normal text-[var(--text-muted)] truncate">• {nasaApod.title}</span>
                )}
              </span>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180 shrink-0" strokeWidth={1.75} />
            </summary>

            <div className="mt-3 space-y-3">
              {apodLoading && !nasaApod && (
                <div className="space-y-2" role="status" aria-live="polite" aria-label={t('dash_apod_loading')}>
                  <div className="scc-skeleton h-40 rounded-xl" />
                  <div className="scc-skeleton h-3 w-2/3" />
                  <div className="scc-skeleton h-3 w-1/2" />
                </div>
              )}
              {apodError && !nasaApod && (
                <div className="p-3 rounded-xl bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-xs space-y-2" role="status" aria-live="polite">
                  <p className="font-bold text-[var(--status-warn-text)]">{t('dash_apod_error')}</p>
                  <p className="text-[var(--text-secondary)]">{apodError}</p>
                  <button
                    type="button"
                    onClick={reloadApod}
                    className="px-3 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold min-h-[40px] cursor-pointer"
                  >
                    {t('retry')}
                  </button>
                </div>
              )}
              {nasaApod && (
                <div className="space-y-2">
                  {nasaApod.mediaType === 'image' ? (
                    <img
                      src={nasaApod.url}
                      alt={nasaApod.title || t('dash_apod_aria')}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      referrerPolicy="no-referrer"
                      className="w-full max-h-72 object-cover rounded-xl border border-[var(--border-default)]"
                    />
                  ) : (
                    <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs space-y-2">
                      {nasaApod.thumbnailUrl && (
                        <img
                          src={nasaApod.thumbnailUrl}
                          alt={nasaApod.title || t('dash_apod_video_alt')}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full max-h-72 object-cover rounded-xl border border-[var(--border-default)]"
                        />
                      )}
                      <p className="font-bold">{t('dash_apod_video_title')}</p>
                      <a href={nasaApod.url} target="_blank" rel="noreferrer" className="text-[var(--accent-text)] underline underline-offset-4 font-bold inline-block min-h-[40px] py-2">
                        {t('dash_apod_watch_video')}
                      </a>
                    </div>
                  )}
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {nasaApod.title}{' '}
                    <span className="font-mono font-medium text-[10px] text-[var(--text-muted)]">{nasaApod.date}</span>
                  </p>
                  {nasaApod.explanation && (
                    <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                      {apodExpanded || nasaApod.explanation.length <= 280
                        ? nasaApod.explanation
                        : `${nasaApod.explanation.slice(0, 280)}… `}
                      {nasaApod.explanation.length > 280 && (
                        <button
                          type="button"
                          onClick={() => setApodExpanded(!apodExpanded)}
                          className="font-bold text-[var(--accent-text)] hover:underline underline-offset-4 ml-1 cursor-pointer"
                          aria-expanded={apodExpanded}
                        >
                          {apodExpanded ? t('show_less') : t('dash_read_more')}
                        </button>
                      )}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>
                      {t('dash_image_credit')}
                      {nasaApod.copyright ? ` • © ${nasaApod.copyright}` : ''}
                    </span>
                    {nasaApod.hdurl && (
                      <a
                        href={nasaApod.hdurl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[var(--accent-text)] hover:underline underline-offset-4 shrink-0"
                      >
                        {t('dash_open_hd')}
                      </a>
                    )}
                  </div>
                  {apodError && (
                    <p className="text-[10px] text-[var(--status-warn-text)]" role="status">
                      {t('dash_apod_error')}{' '}
                      <button type="button" onClick={reloadApod} className="font-bold underline underline-offset-4 cursor-pointer min-h-[36px] px-2">
                        {t('retry')}
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* Footer Label */}
      <footer className="text-[10px] text-[var(--text-muted)] font-mono select-none uppercase tracking-wider pt-2 text-center">
        {t('dash_footer_brand')}
      </footer>
    </div>
  );
};
