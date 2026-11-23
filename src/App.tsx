import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Shell } from './layouts/Shell';
import { DashboardHome } from './components/DashboardHome';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useBadgeCounts } from './hooks/useBadgeCounts';
import { useDebouncedCallback } from './hooks/useDebouncedCallback';
import { initTheme, setTheme, syncDarkToTheme } from './services/theme';
import { getLayoutMode, LAYOUT_MODE_EVENT, type LayoutMode } from './services/layoutMode';
import { loadDailyReportConfig, saveDailyReportConfig, shouldSendDailyReportNow, sendDailyReport } from './services/dailyReport';
import { useT } from './services/i18n';
// Chunk-resilient lazy(): after a fresh deploy the service worker can serve a
// stale index.html that references rotated chunk filenames → dynamic import()
// rejects → React throws during render → full-app error fallback. Retry once
// with a hard reload (fresh HTML + fresh SW); if it still fails, throw for real.
const CHUNK_RETRY_KEY = 'scc_chunk_reload_v1';
function lazyRetry<T extends { default: React.ComponentType<any> }>(importer: () => Promise<T>) {
  return lazy(() =>
    importer().catch((err) => {
      try {
        if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
          sessionStorage.setItem(CHUNK_RETRY_KEY, '1');
          window.location.reload();
          // Return a never-resolving promise while the reload happens.
          return new Promise<T>(() => {});
        }
        sessionStorage.removeItem(CHUNK_RETRY_KEY);
      } catch {}
      throw err;
    })
  );
}
const DocumentHubWorkspace = lazyRetry(() => import('./components/workspaces/DocumentHubWorkspace').then(m => ({ default: m.DocumentHubWorkspace })));
const NoteScannerWorkspace = lazyRetry(() => import('./components/workspaces/NoteScannerWorkspace').then(m => ({ default: m.NoteScannerWorkspace })));
const DesmosWorkspace = lazyRetry(() => import('./components/workspaces/DesmosWorkspace').then(m => ({ default: m.DesmosWorkspace })));
const GeoGebraWorkspace = lazyRetry(() => import('./components/workspaces/GeoGebraWorkspace').then(m => ({ default: m.GeoGebraWorkspace })));
const ExcalidrawWorkspace = lazyRetry(() => import('./components/workspaces/ExcalidrawWorkspace').then(m => ({ default: m.ExcalidrawWorkspace })));
const PhETWorkspace = lazyRetry(() => import('./components/workspaces/PhETWorkspace').then(m => ({ default: m.PhETWorkspace })));
const PomodoroWorkspace = lazyRetry(() => import('./components/workspaces/PomodoroWorkspace').then(m => ({ default: m.PomodoroWorkspace })));
const ArxivWorkspace = lazyRetry(() => import('./components/workspaces/ArxivWorkspace').then(m => ({ default: m.ArxivWorkspace })));
const OpenLibraryWorkspace = lazyRetry(() => import('./components/workspaces/OpenLibraryWorkspace').then(m => ({ default: m.OpenLibraryWorkspace })));
const WikipediaLookupModal = lazyRetry(() => import('./components/WikipediaLookupModal').then(m => ({ default: m.WikipediaLookupModal })));
const StudyCardModal = lazyRetry(() => import('./components/StudyCardModal').then(m => ({ default: m.StudyCardModal })));
const MorningCheckInModal = lazyRetry(() => import('./components/MorningCheckInModal').then(m => ({ default: m.MorningCheckInModal })));
const OnboardingChecklist = lazyRetry(() => import('./components/OnboardingChecklist').then(m => ({ default: m.OnboardingChecklist })));
const DailyRadarTab = lazyRetry(() => import('./components/DailyRadarTab').then(m => ({ default: m.DailyRadarTab })));
const GmailRadarTab = lazyRetry(() => import('./components/GmailRadarTab').then(m => ({ default: m.GmailRadarTab })));
const AssignmentTrackerTab = lazyRetry(() => import('./components/AssignmentTrackerTab').then(m => ({ default: m.AssignmentTrackerTab })));
const CanvasSyncTab = lazyRetry(() => import('./components/CanvasSyncTab').then(m => ({ default: m.CanvasSyncTab })));
const GoogleDriveTab = lazyRetry(() => import('./components/GoogleDriveTab').then(m => ({ default: m.GoogleDriveTab })));
const FlashcardStudioTab = lazyRetry(() => import('./components/FlashcardStudioTab').then(m => ({ default: m.FlashcardStudioTab })));
const GoogleClassroomPanel = lazyRetry(() => import('./components/GoogleClassroomPanel').then(m => ({ default: m.GoogleClassroomPanel })));
import { AppStoreModal, loadPinnedAppIds, savePinnedAppIds } from './components/AppStoreModal';
import { ChangelogModal, CURRENT_VERSION } from './components/ChangelogModal';
const StudyPlanGeneratorModal = lazyRetry(() => import('./components/StudyPlanGeneratorModal').then(m => ({ default: m.StudyPlanGeneratorModal })));
const InteractiveIntroModal = lazyRetry(() => import('./components/InteractiveIntroModal').then(m => ({ default: m.InteractiveIntroModal })));
import { LandingPage } from './components/LandingPage';
const QuickDraftModal = lazyRetry(() => import('./components/QuickDraftModal').then(m => ({ default: m.QuickDraftModal })));
const ScheduleStudyModal = lazyRetry(() => import('./components/ScheduleStudyModal').then(m => ({ default: m.ScheduleStudyModal })));
const ConfirmationModal = lazyRetry(() => import('./components/ConfirmationModal').then(m => ({ default: m.ConfirmationModal })));
const StudyAssistantChat = lazyRetry(() => import('./components/StudyAssistantChat').then(m => ({ default: m.StudyAssistantChat })));
const AccountSettingsModal = lazyRetry(() => import('./components/AccountSettingsModal').then(m => ({ default: m.AccountSettingsModal })));
import { ShortcutSettings, defaultShortcutSettings } from './components/AccountSettingsModal';
const CommandPalette = lazyRetry(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const ShortcutsModal = lazyRetry(() => import('./components/ShortcutsModal').then(m => ({ default: m.ShortcutsModal })));
const DeploymentModal = lazyRetry(() => import('./components/DeploymentModal').then(m => ({ default: m.DeploymentModal })));
const OAuthGuideModal = lazyRetry(() => import('./components/OAuthGuideModal').then(m => ({ default: m.OAuthGuideModal })));
const ApiActivationModal = lazyRetry(() => import('./components/ApiActivationModal').then(m => ({ default: m.ApiActivationModal })));
const GeminiSettingsModal = lazyRetry(() => import('./components/GeminiSettingsModal').then(m => ({ default: m.GeminiSettingsModal })));
const AiAcademicSuiteModal = lazyRetry(() => import('./components/AiAcademicSuiteModal').then(m => ({ default: m.AiAcademicSuiteModal })));
const GoogleSyncHubModal = lazyRetry(() => import('./components/GoogleSyncHubModal').then(m => ({ default: m.GoogleSyncHubModal })));
import { ToastContainer } from './components/Toast';
import { AppTab, AgentAction } from './types';
import { loadSRSDecks, saveSRSDecks, createNewSRSCard, SRSDeck } from './services/srsEngine';
import { usePomodoroStore, recordStreakDate } from './stores/pomodoroStore';
import { trackEvent } from './services/analytics';
import { db } from './services/db';

import {
  signInWithGoogle,
  OAuthTestUserRequiredError,
  signOutUser,
  onAuthStateChangedListener,
  getStoredGoogleToken,
  getValidGoogleToken,
  setActiveGoogleUid,
  hydrateGoogleTokenForUser,
  classifySignInError,
  diagnoseSignInEnvironment,
  consumeRedirectResult,
  signInWithRedirectFlow,
} from './services/firebase';
import {
  ensureFreshGoogleToken,
  refreshGoogleAccessToken,
  hasRefreshToken,
  hasFeatureAccess,
  FEATURE_SCOPES,
  getGrantedScopes,
  getMissingOptionalFeatureScopes,
  markGoogleConnected,
  normalizeScopes,
  recordGrantedScopes,
  removeGrantedScopes,
  requestFeaturePermissionDetailed,
  onLateGooglePermissionGranted,
  preloadGoogleOAuthReadiness,
  hydrateRefreshGrant,
  clearGoogleGrant,
  type GoogleFeature,
} from './services/googleAuth';
import { GooglePermissionModal } from './components/GooglePermissionModal';
import type { SignInDiagnosis } from './services/firebase';
import * as googleWorkspaceApi from './services/googleWorkspace';
import type { FetchEmailOptions } from './services/googleWorkspace';
const {
  fetchTodayCalendarEvents,
  insertCalendarEvent,
  fetchAcademicEmails,
  createGmailDraft,
  getOrCreateMasterSheet,
  fetchSheetAssignments,
  appendAssignmentToSheet,
  updateAssignmentInSheet,
  syncAllAssignmentsToSheet,
  fetchRecentSchoolFiles,
  shareGoogleDriveFile,
} = googleWorkspaceApi;

const deleteAssignmentInSheetFn = (
  googleWorkspaceApi as Record<string, any>
).deleteAssignmentInSheet as
  | ((token: string, spreadsheetId: string, rowIndexOrAssignment: number | Assignment) => Promise<void>)
  | undefined;
import { fetchAllClassroomAssignments, fetchRecentClassroomAnnouncements } from './services/googleClassroom';
import {
  loadCanvasSettings,
  saveCanvasSettings,
  hydrateCanvasSettingsForUser,
  setActiveCanvasUid,
  fetchCanvasAssignmentsFromFeed,
  fetchCanvasAssignmentsFromApi,
  crossReferenceCanvasWithSheet,
  reconcileCanvasAssignmentsWithTracker,
  submitCanvasAssignment,
  loadCompletedCanvasIds,
  saveCompletedCanvasIds,
  loadDismissedCanvasIds,
  undismissCanvasAssignmentId,
  normalizeCanvasDomain,
} from './services/canvas';
import {
  summarizeEmailsWithGemini,
  partitionEmailsForAIScan,
  mergeScannedEmailAlerts,
  generateQuickDraft,
  parseNaturalLanguageAssignment,
} from './services/gemini';
import {
  Assignment,
  CalendarEvent,
  EmailAlert,
  EmailMessage,
  SchoolFile,
  CanvasAssignment,
  CanvasSettings,
  ToastNotification,
  ConfirmationModalState,
  QuickDraftRequest,
  AssignmentStatus,
  PriorityLevel,
  ApiEnablementInfo,
} from './types';
import { sanitizeAssignments, sanitizeCanvasAssignments, sanitizeEmailAlerts, sanitizeRawEmails } from './utils/sanitize';
import { AiConfirmCard, type AiDraft, type AiConfirmResult } from './components/AiConfirmCard';
import { dismissReview } from './utils/trust';
import { logPilot, recordMissedDeadlines } from './utils/pilotStats';
import { PrivacyModal } from './components/PrivacyModal';

const LOCAL_ASSIGNMENTS_KEY = 'scc_user_assignments_v2';
const LOCAL_EMAIL_ALERTS_KEY = 'scc_cached_email_alerts_v2';
const LOCAL_RAW_EMAILS_KEY = 'scc_cached_raw_emails_v2';
const LOCAL_EMAILS_LAST_SYNCED_KEY = 'scc_emails_last_synced_v1';

const KEPT_APP_TABS: ReadonlySet<string> = new Set<AppTab>([
  'dashboard',
  'canvas',
  'classroom',
  'gmail',
  'drive',
  'radar',
  'tracker',
  'notes-markdown',
  'note-scanner',
  'flashcards',
  'excalidraw',
  'geogebra',
  'desmos-graphing',
  'phet',
  'arxiv',
  'open-library',
  'pomodoro',
]);

const TAB_LABEL_KEYS: Record<AppTab, string> = {
  dashboard: 'app_tab_dashboard',
  canvas: 'app_tab_canvas',
  classroom: 'app_tab_classroom',
  gmail: 'app_tab_gmail',
  drive: 'app_tab_drive',
  radar: 'app_tab_radar',
  tracker: 'app_tab_tracker',
  'notes-markdown': 'app_tab_notes',
  'note-scanner': 'app_tab_note_scanner',
  flashcards: 'app_tab_flashcards',
  excalidraw: 'app_tab_excalidraw',
  geogebra: 'app_tab_geogebra',
  'desmos-graphing': 'app_tab_desmos',
  phet: 'app_tab_phet',
  arxiv: 'app_tab_arxiv',
  'open-library': 'app_tab_library',
  pomodoro: 'app_tab_pomodoro',
};

function normalizeAppTab(raw: string): AppTab {
  if (raw === 'academic' || raw === 'ws-academic') return 'canvas';
  if (raw === 'ai-planner') return 'radar';
  if (raw === 'documents') return 'notes-markdown';
  if (raw === 'quizlet' || raw === 'anki') return 'flashcards';
  if (raw === 'desmos-scientific') return 'desmos-graphing';
  return KEPT_APP_TABS.has(raw) ? (raw as AppTab) : 'dashboard';
}

async function celebrateWin(opts: {
  particleCount?: number;
  spread?: number;
  origin?: { y?: number };
  colors?: string[];
}): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      return;
    }
    const { default: confetti } = await import('canvas-confetti');
    confetti(opts);
  } catch {}
}

function loadSavedAssignments(): Assignment[] {
  try {
    const saved = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Sanitize: legacy/corrupt entries with missing fields used to crash setState updaters (white screen)
      if (Array.isArray(parsed)) return sanitizeAssignments(parsed);
    }
  } catch (e) {
    console.error('Error loading saved assignments:', e);
  }
  return [];
}

function saveSavedAssignments(list: Assignment[]) {
  try {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving assignments:', e);
  }
}

function loadSavedEmailAlerts(): EmailAlert[] {
  try {
    const saved = localStorage.getItem(LOCAL_EMAIL_ALERTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return sanitizeEmailAlerts(parsed);
    }
  } catch (e) {
    console.error('Error loading cached email alerts:', e);
  }
  return [];
}

function loadSavedRawEmails(): EmailMessage[] {
  try {
    const saved = localStorage.getItem(LOCAL_RAW_EMAILS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return sanitizeRawEmails(parsed);
    }
  } catch (e) {
    console.error('Error loading cached raw emails:', e);
  }
  return [];
}

function saveEmailAlerts(list: EmailAlert[]) {
  try {
    localStorage.setItem(LOCAL_EMAIL_ALERTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving cached email alerts:', e);
  }
}

function saveRawEmails(list: EmailMessage[]) {
  try {
    localStorage.setItem(LOCAL_RAW_EMAILS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving cached raw emails:', e);
  }
}

export default function App() {
  const { t, formatDate } = useT();
  // Theme — single source of truth is src/services/theme.ts (owns DOM + storage).
  // `darkMode` state is a MIRROR for UI highlights only. Nothing writes the theme
  // on mount, so a stored dark choice can never be clobbered back to light.
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    try {
      return document.documentElement.classList.contains('dark');
    } catch { return false; }
  });

  const applyDarkMode = useCallback((v: boolean) => {
    try {
      // Explicit user choice wins over OS auto-follow from here on.
      localStorage.setItem('scc_explicit_theme_v1', '1');
      localStorage.setItem('scc_auto_system_theme_v1', 'false');
    } catch {}
    syncDarkToTheme(v);
    setDarkModeState(v);
  }, []);

  const toggleDarkMode = useCallback(() => {
    let next = true;
    try {
      next = !document.documentElement.classList.contains('dark');
    } catch {}
    applyDarkMode(next);
  }, [applyDarkMode]);

  // Initialize Density & Palette Theme attributes via theme service
  useEffect(() => {
    initTheme();
    try {
      const savedDensity = localStorage.getItem('scc_ui_density_v1') || 'comfortable';
      document.documentElement.setAttribute('data-density', savedDensity);
      // OS auto-follow applies ONLY until the user makes an explicit choice —
      // otherwise it forces the OS theme on every reload and dark "never sticks".
      const explicit = localStorage.getItem('scc_explicit_theme_v1') === '1';
      const autoSystem = localStorage.getItem('scc_auto_system_theme_v1') === 'true';
      if (autoSystem && !explicit) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        syncDarkToTheme(isDark);
      }
      const isDarkNow = document.documentElement.classList.contains('dark');
      setDarkModeState(isDarkNow);
    } catch (e) {
      console.error('Theme init error:', e);
    }
  }, []);

  // (Removed navClock/navDate — menu bar decluttered per user request)

  // PWA install prompt + beforeinstallprompt handling — now renders Install banner
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [installDismissedUntil, setInstallDismissedUntil] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('scc_install_dismissed_until')||'0',10); } catch { return 0; }
  });
  useEffect(() => {
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      if (Date.now() < installDismissedUntil) return;
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    const onAppInstalled = () => { setShowInstallBtn(false); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBeforeInstall); window.removeEventListener('appinstalled', onAppInstalled); };
  }, [installDismissedUntil]);

  const handleInstallPwa = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') trackEvent('pwa_install_accepted');
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    } catch {}
  }, [deferredPrompt]);

  const handleDismissPwa = useCallback(() => {
    const until = Date.now() + 7 * 86400000;
    try { localStorage.setItem('scc_install_dismissed_until', String(until)); } catch {}
    setInstallDismissedUntil(until);
    setShowInstallBtn(false);
  }, []);

  // Dexie migration single source — storage sprawl fix
  useEffect(() => {
    (async () => {
      try {
        const { migrateLocalStorageToDexie } = await import('./services/db');
        await migrateLocalStorageToDexie();
      } catch {}
    })();
  }, []);

  // Auth & User
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Unified Active Tab (replaces dead activeWorkspace + activeTab split)
  const [radarInitialMode, setRadarInitialMode] = useState<'schedule' | 'planner'>(() => {
    try {
      return localStorage.getItem('scc_active_workspace_v1') === 'ai-planner' ? 'planner' : 'schedule';
    } catch {
      return 'schedule';
    }
  });
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('scc_active_workspace_v1');
      if (!saved) return 'dashboard';
      const normalized = normalizeAppTab(saved);
      if (normalized !== saved) localStorage.setItem('scc_active_workspace_v1', normalized);
      return normalized;
    } catch {
      return 'dashboard';
    }
  });
  const [pomodoroFocusMinutes, setPomodoroFocusMinutes] = useState<number | undefined>(() => {
    try {
      const saved = localStorage.getItem('scc_pomo_preset_mins_v1');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    } catch {
      return undefined;
    }
  });
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [aiSuiteOpen, setAiSuiteOpen] = useState(false);
  const [aiSuiteTab, setAiSuiteTab] = useState<'planner' | 'syllabus' | 'quiz' | 'grades'>('planner');
  const [clearedTabBadges, setClearedTabBadges] = useState<Set<string>>(new Set());
  const [isWikipediaModalOpen, setIsWikipediaModalOpen] = useState(false);
  const [wikipediaInitialQuery, setWikipediaInitialQuery] = useState('');
  const [isStudyCardOpen, setIsStudyCardOpen] = useState(false);
  const [isMorningCheckInOpen, setIsMorningCheckInOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isStudyPlanOpen, setIsStudyPlanOpen] = useState(false);
  const [isIntroTourOpen, setIsIntroTourOpen] = useState(false);
  const [showChangelogDot, setShowChangelogDot] = useState(false);

  // Dynamic title for SEO per workspace — MUST be after activeTab declaration to avoid TDZ
  useEffect(() => {
    const label = t(TAB_LABEL_KEYS[activeTab] || 'app_tab_dashboard');
    document.title = t('app_doc_title', { label });
  }, [activeTab, t]);

  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastCheckIn = localStorage.getItem('scc_last_morning_checkin');
      if (lastCheckIn !== todayStr) {
        setIsMorningCheckInOpen(true);
      }

      // Guided tour: new users only, AFTER morning check-in closes (no stacked modals).
      // X = snooze (key stays unset); "Start studying" marks scc_tour_seen_v2.
      const tourSeen = localStorage.getItem('scc_tour_seen_v2');
      if (tourSeen !== 'true') {
        const delay = lastCheckIn !== todayStr ? 4000 : 1500;
        const t = setTimeout(() => {
          try {
            if (localStorage.getItem('scc_tour_seen_v2') !== 'true') setIsIntroTourOpen(true);
          } catch { setIsIntroTourOpen(true); }
        }, delay);
        return () => clearTimeout(t);
      }
      
      // Changelog: show dot not modal — user clicks What's New dot to open
      const lastSeenVersion = localStorage.getItem('scc_last_seen_version');
      if (lastSeenVersion !== CURRENT_VERSION) {
        setShowChangelogDot(true);
      }
    } catch (e) {
      console.error('Error checking morning checkin and version seen:', e);
    }
  }, []);

  const handleSaveMorningIntention = (intention: string, targetHours: number, mood?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('scc_last_morning_checkin', todayStr);
    localStorage.setItem('scc_daily_intention', intention);
    localStorage.setItem('scc_target_focus_hours', String(targetHours));
    try { if (mood) localStorage.setItem('scc_last_morning_mood', mood); } catch {}
    // streak + confetti on 7-day (compatible with pomodoroStore.ts Record<string, number>)
    try {
      const history = recordStreakDate(todayStr, { increment: false });
      const streakDays = Object.keys(history).length;
      if (streakDays % 7 === 0 && streakDays > 0) {
        void celebrateWin({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#C96442', '#10b981', '#7C3AED'] });
      }
    } catch {}
    addToast({
      type: 'success',
      title: t('app_toast_intention_title'),
      message: t('app_toast_intention_msg', { hours: targetHours }),
    });
  };

  // Unified AppTab navigation with legacy tab normalization & View Transitions support
  const handleTabTransition = useCallback((rawTab: string) => {
    if (rawTab === 'ai-suite') {
      setAiSuiteTab('planner');
      setAiSuiteOpen(true);
      return;
    }
    if (rawTab === 'ai-planner') {
      setRadarInitialMode('planner');
      try { window.dispatchEvent(new CustomEvent('scc-radar-mode', { detail: { mode: 'planner' } })); } catch {}
    } else if (rawTab === 'radar') {
      setRadarInitialMode('schedule');
      try { window.dispatchEvent(new CustomEvent('scc-radar-mode', { detail: { mode: 'schedule' } })); } catch {}
    }
    const newTab = normalizeAppTab(rawTab);

    setClearedTabBadges((prev) => new Set(prev).add(newTab));
    setAiChatOpen(false);

    // IA: Recent:3 + Most Used tracking for dynamic Top8
    try {
      const recentRaw = localStorage.getItem('scc_recent_tabs_v1');
      const recent: string[] = recentRaw ? JSON.parse(recentRaw) : [];
      const nextRecent = Array.from(new Set([newTab, ...recent.map((x: string) => normalizeAppTab(x))])).slice(0, 10);
      localStorage.setItem('scc_recent_tabs_v1', JSON.stringify(nextRecent));
      const usageRaw = localStorage.getItem('scc_app_usage_v1');
      const usage: Record<string, number> = usageRaw ? JSON.parse(usageRaw) : {};
      usage[newTab] = (usage[newTab] || 0) + 1;
      localStorage.setItem('scc_app_usage_v1', JSON.stringify(usage));
      try { localStorage.setItem('scc_active_workspace_v1', newTab); } catch {}
    } catch {}
    try { trackEvent('command_executed', { command: newTab }); } catch {}

    if (typeof document !== 'undefined' && (document as any).startViewTransition) {
      try {
        (document as any).startViewTransition(() => {
          setActiveTab(newTab);
        });
      } catch {
        setActiveTab(newTab);
      }
    } else {
      setActiveTab(newTab);
    }
  }, []);

  // Breadcrumb navigation — StudentOS click → dashboard
  useEffect(() => {
    const onNav = (e: any) => { if (e.detail === 'dashboard') handleTabTransition('dashboard'); };
    window.addEventListener('scc-navigate' as any, onNav);
    return () => window.removeEventListener('scc-navigate' as any, onNav);
  }, [handleTabTransition]);

  // Confetti respects reduced motion already handled at trigger; also add global check

  // Real Data State (Zero Fake Data)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>(loadSavedEmailAlerts);
  const [rawEmails, setRawEmails] = useState<EmailMessage[]>(loadSavedRawEmails);
  const rawEmailsRef = useRef(rawEmails);
  rawEmailsRef.current = rawEmails;
  const emailAlertsRef = useRef(emailAlerts);
  emailAlertsRef.current = emailAlerts;
  const [assignments, setAssignments] = useState<Assignment[]>(loadSavedAssignments());
  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;
  const canvasSettingsRef = useRef<CanvasSettings | null>(null);
  const masterSheetIdRef = useRef<string | undefined>(undefined);
  const [recentFiles, setRecentFiles] = useState<SchoolFile[]>([]);
  const [canvasAssignments, setCanvasAssignments] = useState<CanvasAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('scc_cached_canvas_assignments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [classroomAssignments, setClassroomAssignments] = useState<CanvasAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('scc_cached_classroom_assignments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingClassroom, setIsLoadingClassroom] = useState(false);
  const [classroomError, setClassroomError] = useState<string | null>(null);
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(loadCanvasSettings());
  canvasSettingsRef.current = canvasSettings;

  // Sidebar expanded / collapsed state (persisted in localStorage)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('scc_sidebar_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('scc_sidebar_expanded', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1180px)');
    const syncCompactSidebar = () => {
      if (mq.matches) {
        setIsSidebarExpanded(false);
      } else if (window.innerWidth > 1180) {
        try {
          const saved = localStorage.getItem('scc_sidebar_expanded');
          setIsSidebarExpanded(saved !== null ? saved === 'true' : true);
        } catch {
          setIsSidebarExpanded(true);
        }
      }
    };
    syncCompactSidebar();
    mq.addEventListener?.('change', syncCompactSidebar);
    return () => mq.removeEventListener?.('change', syncCompactSidebar);
  }, []);
  useEffect(() => {
    if (mobileNavOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  // App Store & Pinned Tools State
  const [appStoreOpen, setAppStoreOpen] = useState(false);
  const [pinnedAppIds, setPinnedAppIds] = useState<string[]>(loadPinnedAppIds);

  const handleTogglePinApp = useCallback((appId: string) => {
    setPinnedAppIds((prev) => {
      const next = prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId];
      savePinnedAppIds(next);
      return next;
    });
  }, []);

  const handleUnpinApp = useCallback((appId: string) => {
    setPinnedAppIds((prev) => {
      const next = prev.filter((id) => id !== appId);
      savePinnedAppIds(next);
      return next;
    });
  }, []);

  // Keyboard Shortcut Preferences (all off by default)
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(() => {
    try {
      const saved = localStorage.getItem('scc_shortcut_settings');
      return saved ? JSON.parse(saved) : defaultShortcutSettings;
    } catch {
      return defaultShortcutSettings;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('scc_shortcut_settings', JSON.stringify(shortcutSettings));
    } catch {
      // ignore
    }
  }, [shortcutSettings]);

  // Accessibility / Appearance Preferences
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scc_reduced_motion') === 'true';
    } catch {
      return false;
    }
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scc_high_contrast') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('scc_reduced_motion', String(reducedMotion));
      if (reducedMotion) document.documentElement.classList.add('reduce-motion');
      else document.documentElement.classList.remove('reduce-motion');
      document.documentElement.style.setProperty('--motion-reduce', reducedMotion ? '1' : '0');
    } catch {}
  }, [reducedMotion]);

  useEffect(() => {
    try {
      localStorage.setItem('scc_high_contrast', String(highContrast));
      if (highContrast) document.documentElement.classList.add('high-contrast');
      else document.documentElement.classList.remove('high-contrast');
    } catch {}
  }, [highContrast]);

  // Zen Focus Mode (Distraction-Free Experience)
  const [zenFocusMode, setZenFocusMode] = useState<boolean>(false);
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => getLayoutMode());
  useEffect(() => {
    const onLayout = (e: any) => {
      const next = e?.detail === 'classic' || e?.detail === 'calm' ? e.detail : getLayoutMode();
      setLayoutModeState(next);
    };
    window.addEventListener(LAYOUT_MODE_EVENT, onLayout);
    return () => window.removeEventListener(LAYOUT_MODE_EVENT, onLayout);
  }, []);

  // Zen Focus: opt-in fullscreen (respects user preference, iOS-safe, Esc to exit)
  useEffect(() => {
    const prefersFullscreen = (() => { try { return localStorage.getItem('scc_zen_auto_fullscreen') === 'true'; } catch { return false; } })();
    if (!prefersFullscreen) return;
    // Guard iOS where requestFullscreen may fail
    if (zenFocusMode) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    }
  }, [zenFocusMode]);

  // Badge counts — extracted to reusable hook (no duplicated parsing)
  const { canvasUnfinished: canvasUnfinishedCount, urgentEmail: urgentEmailCount, pendingAssignment: pendingAssignmentCount, flashcardDue: flashcardDueCount } = useBadgeCounts(canvasAssignments, assignments, emailAlerts);

  // Error States
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  // Permanent offline grant (GIS code flow + server-side refresh) means access
  // tokens renew silently — there is no expiring "session" to warn about.
  // Connected = usable access now, or a refresh grant that can mint one.
  const [googleToken, setGoogleToken] = useState<string | null>(() => getStoredGoogleToken());
  const dailyReportSendingRef = useRef(false);
  useEffect(() => {
    const checkAndSend = async () => {
      if (dailyReportSendingRef.current) return;
      const cfg = loadDailyReportConfig(user?.email || '');
      if (!shouldSendDailyReportNow(cfg)) return;
      dailyReportSendingRef.current = true;
      try {
        const result = await sendDailyReport({
          config: cfg,
          assignments,
          events: calendarEvents,
          googleAccessToken: googleToken,
        });
        if (result.delivered) {
          saveDailyReportConfig({ ...cfg, lastSentDateGmt7: result.dateStrGmt7 });
        }
      } catch {}
      finally {
        dailyReportSendingRef.current = false;
      }
    };
    void checkAndSend();
    const timer = setInterval(() => {
      void checkAndSend();
    }, 60_000);
    return () => clearInterval(timer);
  }, [user?.email, assignments, calendarEvents, googleToken]);
  const [scopeRevision, setScopeRevision] = useState(0);
  useEffect(() => {
    const bump = () => setScopeRevision((n) => n + 1);
    window.addEventListener('scc-google-scopes-updated', bump);
    window.addEventListener('scc-google-token-updated', bump);
    return () => {
      window.removeEventListener('scc-google-scopes-updated', bump);
      window.removeEventListener('scc-google-token-updated', bump);
    };
  }, []);

  const [permissionPrompt, setPermissionPrompt] = useState<{
    feature: GoogleFeature;
    afterConnect?: () => Promise<void> | void;
  } | null>(null);
  const [connectingFeature, setConnectingFeature] = useState<GoogleFeature | null>(null);

  const uidForScopes = user?.uid || null;
  const hasCalendarAccess = Boolean(isDemoMode || (scopeRevision >= 0 && hasFeatureAccess('calendar', uidForScopes)));
  const hasGmailAccess = Boolean(isDemoMode || (scopeRevision >= 0 && hasFeatureAccess('gmail', uidForScopes)));
  const hasDriveAccess = Boolean(isDemoMode || (scopeRevision >= 0 && hasFeatureAccess('drive', uidForScopes)));
  const hasSheetsAccess = Boolean(isDemoMode || (scopeRevision >= 0 && hasFeatureAccess('sheets', uidForScopes)));
  const hasClassroomAccess = Boolean(isDemoMode || (scopeRevision >= 0 && hasFeatureAccess('classroom', uidForScopes)));
  const isGoogleConnected =
    isDemoMode ||
    hasCalendarAccess ||
    hasGmailAccess ||
    hasDriveAccess ||
    hasSheetsAccess ||
    hasClassroomAccess;

  // Service availability status (populated only if Google reports a service unavailable)
  const [driveApiInfo, setDriveApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [calendarApiInfo, setCalendarApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [gmailApiInfo, setGmailApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [sheetApiInfo, setSheetApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [classroomApiInfo, setClassroomApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [apiActivationModalInfo, setApiActivationModalInfo] = useState<ApiEnablementInfo | null>(null);
  const [apiActivationModalOpen, setApiActivationModalOpen] = useState(false);

  // Sync Timestamp & Status
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const isSyncingRef = useRef(false);
  const pendingFullSyncRef = useRef(false);
  const isLoadingEmailsRef = useRef(false);
  const lastEmailSyncAtRef = useRef<number>((() => {
    try {
      const saved = localStorage.getItem(LOCAL_EMAILS_LAST_SYNCED_KEY);
      const parsed = saved ? Date.parse(saved) : NaN;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  })());
  const lastFocusSyncAtRef = useRef<number>(0);
  const lastSyncedTokenRef = useRef<string | null>(getStoredGoogleToken());
  const connectAttemptRef = useRef(0);
  const isConnectingOAuthRef = useRef(false);
  const syncFeatureByKeyRef = useRef<((feature: GoogleFeature) => Promise<void>) | null>(null);
  const pendingLateFeatureRef = useRef<{
    feature: GoogleFeature;
    afterConnect?: () => Promise<void> | void;
  } | null>(null);

  // Master Sheet metadata
  const [masterSheetId, setMasterSheetId] = useState<string | undefined>();
  masterSheetIdRef.current = masterSheetId;
  const isDemoModeRef = useRef(isDemoMode);
  isDemoModeRef.current = isDemoMode;
  const [masterSheetUrl, setMasterSheetUrl] = useState<string | undefined>();

  // Loading States
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [emailLoadStage, setEmailLoadStage] = useState<'idle' | 'fetching' | 'analyzing'>('idle');
  const [emailsLastSyncedAt, setEmailsLastSyncedAt] = useState<string | null>(() => {
    try { return localStorage.getItem(LOCAL_EMAILS_LAST_SYNCED_KEY); } catch { return null; }
  });
  const [emailsAreCachedOnly, setEmailsAreCachedOnly] = useState<boolean>(true);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isParsingAI, setIsParsingAI] = useState(false);
  // AI results wait here until the student confirms them (judges: "AI hiểu là … Đúng chưa?").
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  useEffect(() => {
    const open = () => setPrivacyOpen(true);
    window.addEventListener('scc-open-privacy', open);
    if (typeof window !== 'undefined' && (window.location.pathname === '/privacy' || window.location.hash === '#privacy')) {
      setPrivacyOpen(true);
    }
    return () => window.removeEventListener('scc-open-privacy', open);
  }, []);
  const [classroomAlerts, setClassroomAlerts] = useState<EmailAlert[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  interface NotificationItem { id: string; tier: 'urgent' | 'updates' | 'activity'; title: string; description: string; link: string; source: string; }
  // Dynamic Aggregated Notification Center Model — strictly typed & null safe
  const notifications: NotificationItem[] = React.useMemo(() => {
    const list: NotificationItem[] = [];
    const now = new Date();

    // 1. Urgent Tiers (Deadlines in 24h, Grades posted)
    (canvasAssignments || []).forEach((c) => {
      if (!c) return;
      // Due in 24h
      if (c.dueAt && !c.isCompleted) {
        try {
          const dueIso = c.dueAt.includes('T') ? c.dueAt : `${c.dueAt}T23:59:59`;
          const dueTime = new Date(dueIso).getTime();
          if (!isNaN(dueTime)) {
            const diff = dueTime - now.getTime();
            if (diff > 0 && diff < 86400000) {
              list.push({
                id: `urgent-due-${c.id}`,
                tier: 'urgent',
                title: t('app_notif_due_title', { name: c.name || t('app_notif_assignment_fallback') }),
                description: t('app_notif_due_desc', {
                  subject: c.courseName || t('app_notif_course_fallback'),
                  hours: Math.round(diff / 3600000),
                }),
                link: c.htmlUrl || '#',
                source: 'Canvas',
              });
            }
          }
        } catch {}
      }

      // Grade Posted Feedback mapping directly back to commented Google Doc anchor locations
      const cName = (c.name || '').toLowerCase().trim();
      if (cName) {
        const matchingSheet = (assignments || []).find(
          (s) => s && (s.assignmentName || '').toLowerCase().trim() === cName
        );
        if (c.isCompleted && matchingSheet?.docUrl) {
          list.push({
            id: `urgent-grade-${c.id}`,
            tier: 'urgent',
            title: t('app_notif_grade_title', { name: c.name || t('app_notif_assignment_fallback') }),
            description: t('app_notif_grade_desc'),
            link: matchingSheet.docUrl,
            source: 'Google Doc',
          });
        }
      }
    });

    // 2. Updates Tier (Announcements / Slide changes)
    (canvasAssignments || []).filter(c => c && c.isInformational).forEach((c) => {
      list.push({
        id: `update-announcement-${c.id}`,
        tier: 'updates',
        title: t('app_notif_announce_title', { name: c.name || t('app_notif_announce_fallback') }),
        description: t('app_notif_announce_desc', { course: c.courseName || 'Canvas' }),
        link: c.htmlUrl || '#',
        source: 'Canvas',
      });
    });

    // Google Drive files modified in last 24h
    (recentFiles || []).slice(0, 5).forEach((f) => {
      if (!f) return;
      list.push({
        id: `update-file-${f.id}`,
        tier: 'updates',
        title: t('app_notif_file_title', { name: f.name || t('app_notif_file_fallback') }),
        description: t('app_notif_file_desc'),
        link: f.webViewLink || '#',
        source: 'Google Drive',
      });
    });

    // 3. Activity Tier (Discussion replies) — gated behind isDemoMode
    if (isDemoMode) {
      list.push({
        id: 'activity-discussion-demo',
        tier: 'activity',
        title: t('app_notif_demo_title'),
        description: t('app_notif_demo_desc'),
        link: '#',
        source: 'Canvas',
      });
    }

    return list;
  }, [canvasAssignments, recentFiles, assignments, isDemoMode, t]);

  // Modals & Panels
  const [quickDraftModalOpen, setQuickDraftModalOpen] = useState(false);
  const [geminiSettingsOpen, setGeminiSettingsOpen] = useState(false);
  const [draftInitialEmail, setDraftInitialEmail] = useState<EmailMessage | null>(null);
  const [draftInitialAlert, setDraftInitialAlert] = useState<EmailAlert | null>(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedAssignmentForSchedule, setSelectedAssignmentForSchedule] =
    useState<Assignment | null>(null);
  const [selectedEventForSchedule, setSelectedEventForSchedule] =
    useState<Partial<CalendarEvent> | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [deploymentModalOpen, setDeploymentModalOpen] = useState(false);
  const [oauthGuideModalOpen, setOauthGuideModalOpen] = useState(false);
  const [oauthRetryFeature, setOauthRetryFeature] = useState<GoogleFeature | null>(null);
  const [oauthDiagnosis, setOauthDiagnosis] = useState<SignInDiagnosis | null>(null);
  const [googleSyncHubOpen, setGoogleSyncHubOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Persistent error toasts (and duration: 0) stay until dismissed or retried
    if ((toast as any).persistent === true || toast.duration === 0) return;
    const timeout = toast.duration || 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeout);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Bridge window `scc-toast` custom events (e.g. CommandPalette, GmailRadarTab) into ToastContainer
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: ToastNotification['type']; title?: string; message?: string }>).detail;
      if (!detail?.title) return;
      addToast({
        type: detail.type || 'info',
        title: detail.title,
        message: detail.message,
      });
    };
    window.addEventListener('scc-toast', handleToastEvent);
    return () => window.removeEventListener('scc-toast', handleToastEvent);
  }, [addToast]);

  // Deep-link ?demo=1 → Enable demo mode; Share target handling
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1') {
        setIsDemoMode(true);
        addToast({ type: 'info', title: t('app_toast_demo_title'), message: t('app_toast_demo_msg') });
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('share-target') === '1') {
        const title = params.get('title') || '';
        const text = params.get('text') || '';
        const url = params.get('url') || '';
        const isPdf = url.toLowerCase().endsWith('.pdf') || title.toLowerCase().endsWith('.pdf');
        const isImage = /\.(png|jpe?g|gif|webp)$/i.test(url) || /\.(png|jpe?g|gif|webp)$/i.test(title);
        if (isPdf || isImage) {
          try { localStorage.setItem('scc_shared_file_url', url || text); } catch {}
          setTimeout(() => {
            handleTabTransition('drive');
            addToast({ type: 'info', title: t('app_toast_share_file_title'), message: isPdf ? t('app_toast_share_pdf_msg') : t('app_toast_share_img_msg') });
          }, 500);
        } else {
          const name = title || text.slice(0, 80) || url || t('app_share_note_fallback');
          const assignmentName = name.slice(0, 120);
          const notes = [text, url].filter(Boolean).join('\n');
          setTimeout(() => {
            setAssignments(prev => [...prev, { id: `share-${Date.now()}`, assignmentName, subject: t('app_subject_general'), dueDate: new Date(Date.now()+86400000*3).toISOString().split('T')[0], priority: 'Med', status: 'Not Started', source: 'Manual', notes }]);
            addToast({ type: 'success', title: t('app_toast_share_task_title'), message: t('app_toast_share_task_msg', { name: assignmentName }) });
          }, 800);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
      // also handle file share via POST (if service worker forwards)
      if (params.get('fileShared') === '1') {
        handleTabTransition('drive');
      }
    } catch {}
  }, [addToast, handleTabTransition, t]);

  // Offline queue retry with exponential backoff via Dexie + navigator.onLine + Background Sync
  useEffect(() => {
    const retryQueue = async () => {
      if (!navigator.onLine) return;
      try {
        const queued = await db.assignmentsQueue.toArray();
        if (!queued.length) return;
        if (!hasFeatureAccess('sheets', authUidRef.current)) return;
        const token = await ensureFreshGoogleToken();
        if (!token || !masterSheetId) return;
        for (const item of queued) {
          try {
            const anyItem: any = item;
            const normalizedAssign: Assignment = {
              id: anyItem.id,
              assignmentName: anyItem.assignmentName,
              subject: anyItem.subject,
              dueDate: anyItem.dueDate,
              priority: anyItem.priority === 'High' || anyItem.priority === 'Low' ? anyItem.priority : 'Med',
              status: anyItem.status === 'In Progress' || anyItem.status === 'Done' ? anyItem.status : 'Not Started',
              sheetRowIndex: anyItem.sheetRowIndex,
              source: anyItem.source === 'Canvas' || anyItem.source === 'Gmail' ? anyItem.source : 'Manual',
            };
            if (anyItem._op === 'update' && anyItem.sheetRowIndex) {
              await updateAssignmentInSheet(token, masterSheetId, normalizedAssign);
            } else if (anyItem._op === 'delete' && anyItem.sheetRowIndex) {
              if (deleteAssignmentInSheetFn) {
                await deleteAssignmentInSheetFn(token, masterSheetId, anyItem.sheetRowIndex);
              } else {
                await syncAllAssignmentsToSheet(token, masterSheetId, assignments);
              }
            } else {
              await appendAssignmentToSheet(token, masterSheetId, normalizedAssign);
            }
            await db.assignmentsQueue.delete(item.id);
          } catch (e) { console.warn('Queue retry failed', e); }
        }
      } catch {}
    };
    window.addEventListener('online', retryQueue);
    // Background Sync API if available
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in (window as any)) {
        navigator.serviceWorker.ready.then((reg: any) => {
          if (reg.sync) reg.sync.register('scc-queue-sync').catch(()=>{});
        });
      }
    } catch {}
    const onSyncMessage = (e: MessageEvent) => { if ((e.data as any)?.type === 'SYNC_QUEUE') retryQueue(); };
    navigator.serviceWorker?.addEventListener('message', onSyncMessage as any);
    const iv = setInterval(retryQueue, 30000);
    return () => { window.removeEventListener('online', retryQueue); navigator.serviceWorker?.removeEventListener('message', onSyncMessage as any); clearInterval(iv); };
  }, [masterSheetId, assignments]);

  const handleExecuteAgentAction = useCallback((action: AgentAction) => {
    switch (action.type) {
      case 'setWorkspaceLayout': {
        handleTabTransition(normalizeAppTab(action.payload.leftPane || 'notes-markdown'));
        break;
      }

      case 'injectDesmosEquation': {
        handleTabTransition('desmos-graphing');
        addToast({
          type: 'success',
          title: t('app_toast_desmos_title'),
          message: t('app_toast_desmos_msg', { count: action.payload.expressions.length }),
        });
        break;
      }

      case 'createCalendarMilestones': {
        const newEvents: Assignment[] = action.payload.events.map((evt, i) => ({
          id: `milestone-${Date.now()}-${i}`,
          assignmentName: evt.title,
          subject: t('app_milestone_subject'),
          dueDate: evt.date,
          status: 'Not Started',
          weight: evt.weight || 10,
          source: 'Manual',
          priority: 'High',
          notes: t('app_milestone_note', { type: evt.type }),
        }));
        setAssignments((prev) => [...prev, ...newEvents]);
        addToast({
          type: 'success',
          title: t('app_toast_milestones_title'),
          message: t('app_toast_milestones_msg', { count: newEvents.length }),
        });
        break;
      }

      case 'createSRSDeck': {
        const currentDecks = loadSRSDecks();
        const nowFormatted = formatDate(new Date());
        const newDeck: SRSDeck = {
          id: `deck-${Date.now()}`,
          title: action.payload.deckTitle,
          subject: action.payload.subject || t('app_subject_general'),
          createdAt: nowFormatted,
          updatedAt: nowFormatted,
          cards: action.payload.cards.map((c) =>
            createNewSRSCard({ front: c.front, back: c.back, tags: c.tags })
          ),
        };
        saveSRSDecks([newDeck, ...currentDecks]);
        handleTabTransition('flashcards');
        addToast({
          type: 'success',
          title: t('app_toast_deck_title'),
          message: t('app_toast_deck_msg', { title: action.payload.deckTitle, count: action.payload.cards.length }),
        });
        break;
      }

      case 'generateMermaidDiagram': {
        handleTabTransition('excalidraw');
        addToast({
          type: 'info',
          title: t('app_toast_whiteboard_title'),
          message: t('app_toast_whiteboard_msg', { title: action.payload.title }),
        });
        break;
      }

      // Division A safe previews (student-approved only — never auto-delete/submit/send)
      case 'createStudyFlashcardsPreview': {
        const currentDecks = loadSRSDecks();
        const count = action.payload.count || 5;
        const nowFormatted = formatDate(new Date());
        const newDeck: SRSDeck = {
          id: `deck-${Date.now()}`,
          title: t('app_preview_deck_title', { topic: action.payload.topic }),
          subject: t('app_subject_general'),
          createdAt: nowFormatted,
          updatedAt: nowFormatted,
          cards: Array.from({ length: Math.min(8, Math.max(3, count)) }).map((_, i) =>
            createNewSRSCard({
              front: t('app_preview_card_front', { topic: action.payload.topic, num: i + 1 }),
              back: t('app_preview_card_back'),
              tags: ['agent-preview'],
            })
          ),
        };
        saveSRSDecks([newDeck, ...currentDecks]);
        handleTabTransition('flashcards');
        addToast({
          type: 'success',
          title: t('app_toast_preview_title'),
          message: t('app_toast_preview_msg', { topic: action.payload.topic }),
        });
        break;
      }

      case 'draftPresentationOutline': {
        try {
          localStorage.setItem('scc_agent_outline_v1', JSON.stringify({ topic: action.payload.topic, minutes: action.payload.minutes || 5, at: new Date().toISOString() }));
        } catch {}
        handleTabTransition('notes-markdown');
        addToast({
          type: 'info',
          title: t('app_toast_outline_title'),
          message: t('app_toast_outline_msg', { minutes: action.payload.minutes || 5, topic: action.payload.topic }),
        });
        break;
      }
    }
  }, [handleTabTransition, addToast, t, formatDate]);

  // Save assignments locally whenever state changes
  useEffect(() => {
    saveSavedAssignments(assignments);
  }, [assignments]);

  // When demo mode is toggled, populate interactive sample data
  useEffect(() => {
    if (isDemoMode && !user) {
      setCanvasAssignments([
        {
          id: 'demo-c1',
          name: 'DBQ Essay: New Deal & Great Depression Policies',
          courseName: 'AP US History',
          dueAt: new Date(Date.now() + 86400000 * 2).toISOString(),
          pointsPossible: 100,
          htmlUrl: 'https://canvas.instructure.com',
          description: 'Write a 4-page document-based essay analyzing primary sources 1-7.',
          isSynced: false,
          isCompleted: false,
        },
        {
          id: 'demo-c2',
          name: 'Problem Set 8: Integration by Parts & Series',
          courseName: 'Calculus BC',
          dueAt: new Date(Date.now() + 86400000 * 1).toISOString(),
          pointsPossible: 50,
          htmlUrl: 'https://canvas.instructure.com',
          description: 'Complete problems 14 through 28 in chapter 7.',
          isSynced: true,
          isCompleted: false,
        },
        {
          id: 'demo-c3',
          name: 'Unit 4 Exam Review & Practice Quiz',
          courseName: 'AP Physics C',
          dueAt: new Date(Date.now() + 86400000 * 4).toISOString(),
          pointsPossible: 30,
          htmlUrl: 'https://canvas.instructure.com',
          description: 'Online timed quiz on rotational dynamics.',
          isSynced: false,
          isCompleted: false,
        },
        {
          id: 'demo-c4',
          name: 'Hamlet Act 2 Soliloquy Critical Reflection',
          courseName: 'English Lit',
          dueAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          pointsPossible: 40,
          htmlUrl: 'https://canvas.instructure.com',
          description: 'Close textual analysis of Act 2 Scene 2.',
          isSynced: true,
          isCompleted: true,
        },
      ]);

      setEmailAlerts([
        {
          id: 'demo-email-1',
          sender: 'Dr. Rebecca Vance (AP Physics)',
          subject: 'Office Hours & Unit 4 Quiz Prep',
          oneLineSummary: 'Extra help session tomorrow at 3:30 PM in Room 204.',
          urgency: 'HIGH',
          category: 'EXAM',
          categoryLabel: t('app_demo_cat_exam'),
          isSpam: false,
          language: 'en',
          rawEmail: {
            id: 'demo-raw-1',
            threadId: 't1',
            sender: 'Dr. Rebecca Vance',
            senderEmail: 'rvance@school.edu',
            subject: 'Office Hours & Unit 4 Quiz Prep',
            snippet: 'Hi students, I will be holding extra office hours tomorrow at 3:30 PM for anyone needing help before Friday quiz.',
            date: new Date().toISOString(),
            unread: true,
          },
        },
        {
          id: 'demo-email-2',
          sender: 'Mr. David Miller (AP US History)',
          subject: 'DBQ Rubric & Primary Source Packet',
          oneLineSummary: 'Updated rubric uploaded to Canvas. Due date unchanged.',
          urgency: 'MEDIUM',
          category: 'ASSIGNMENT',
          categoryLabel: t('app_demo_cat_assign'),
          isSpam: false,
          language: 'en',
          rawEmail: {
            id: 'demo-raw-2',
            threadId: 't2',
            sender: 'Mr. David Miller',
            senderEmail: 'dmiller@school.edu',
            subject: 'DBQ Rubric & Primary Source Packet',
            snippet: 'Please review the attached rubric for the New Deal DBQ. Be sure to cite at least 4 documents.',
            date: new Date().toISOString(),
            unread: false,
          },
        },
        {
          id: 'demo-email-3',
          sender: 'Shopee Deals',
          subject: 'Super Flash Sale 50% Off Back to School',
          oneLineSummary: 'Limited time coupon discounts on supplies.',
          urgency: 'INFO',
          category: 'SPAM',
          categoryLabel: t('app_demo_cat_spam'),
          isSpam: true,
          spamReason: 'Commercial e-commerce promotion',
          language: 'en',
          rawEmail: {
            id: 'demo-raw-3',
            threadId: 't3',
            sender: 'Shopee Deals',
            senderEmail: 'promo@shopee.vn',
            subject: 'Super Flash Sale 50% Off Back to School',
            snippet: 'Claim your 50% voucher today only! Click to view discounts on stationery and backpacks.',
            date: new Date().toISOString(),
            unread: false,
          },
        },
        {
          id: 'demo-email-4',
          sender: 'Spotify Student',
          subject: 'Your Weekly Student Playlist is Ready',
          oneLineSummary: 'Music playlist digest newsletter.',
          urgency: 'INFO',
          category: 'SPAM',
          categoryLabel: t('app_demo_cat_spam'),
          isSpam: true,
          spamReason: 'Marketing subscription newsletter',
          language: 'en',
          rawEmail: {
            id: 'demo-raw-4',
            threadId: 't4',
            sender: 'Spotify',
            senderEmail: 'no-reply@spotify.com',
            subject: 'Your Weekly Student Playlist is Ready',
            snippet: 'Check out new study focus tracks curated for university students this week.',
            date: new Date().toISOString(),
            unread: false,
          },
        },
      ]);

      setRecentFiles([
        {
          id: 'demo-file-1',
          name: 'AP US History - DBQ Thesis Outline.docx',
          mimeType: 'application/vnd.google-apps.document',
          webViewLink: 'https://docs.google.com',
          modifiedTime: new Date(Date.now() - 3600000 * 2).toISOString(),
          size: '24 KB',
        },
        {
          id: 'demo-file-2',
          name: 'Physics Lab 3 - Pendulum Data & Graphs.xlsx',
          mimeType: 'application/vnd.google-apps.spreadsheet',
          webViewLink: 'https://sheets.google.com',
          modifiedTime: new Date(Date.now() - 3600000 * 5).toISOString(),
          size: '48 KB',
        },
        {
          id: 'demo-file-3',
          name: 'Calculus BC - Series & Tests Presentation.pptx',
          mimeType: 'application/vnd.google-apps.presentation',
          webViewLink: 'https://slides.google.com',
          modifiedTime: new Date(Date.now() - 86400000 * 1).toISOString(),
          size: '3.2 MB',
        },
        {
          id: 'demo-file-4',
          name: 'Hamlet Act 2 Text & Critical Commentary.pdf',
          mimeType: 'application/pdf',
          webViewLink: 'https://drive.google.com',
          modifiedTime: new Date(Date.now() - 86400000 * 2).toISOString(),
          size: '1.5 MB',
        },
      ]);

      setAssignments((prev) =>
        prev.length > 0
          ? prev
          : [
              {
                id: 'demo-t1',
                assignmentName: 'Problem Set 8: Integration by Parts & Series',
                subject: 'Calculus BC',
                dueDate: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
                priority: 'High',
                status: 'In Progress',
                source: 'Canvas',
                notes: 'Problems 14–28 in Chapter 7',
              },
              {
                id: 'demo-t2',
                assignmentName: 'DBQ Essay: New Deal & Great Depression Policies',
                subject: 'AP US History',
                dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                priority: 'High',
                status: 'Not Started',
                source: 'Canvas',
                notes: 'Cite at least 4 primary documents per Mr. Miller rubric',
              },
              {
                id: 'demo-t3',
                assignmentName: 'Unit 4 Quiz Prep & Office Hours Review',
                subject: 'AP Physics C',
                dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
                priority: 'Med',
                status: 'Not Started',
                source: 'Gmail',
                notes: 'Dr. Vance office hours tomorrow 3:30 PM (Room 204)',
              },
              {
                id: 'demo-t4',
                assignmentName: 'Hamlet Act 2 Soliloquy Critical Reflection',
                subject: 'English Lit',
                dueDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
                priority: 'Low',
                status: 'Done',
                source: 'Canvas',
                notes: 'Submitted & reviewed',
              },
            ]
      );

      setCalendarEvents((prev) => {
        if (prev.length > 0) return prev;
        const today = new Date();
        const mkTime = (dayOffset: number, h: number, m = 0) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, m, 0);
          return d.toISOString();
        };
        return [
          {
            id: 'demo-ev-1',
            summary: 'Calculus BC Problem Set Focus Block',
            start: { dateTime: mkTime(0, 19, 0) },
            end: { dateTime: mkTime(0, 20, 0) },
            description: 'Scheduled study sprint for Chapter 7 integration by parts',
          },
          {
            id: 'demo-ev-2',
            summary: 'AP Physics Office Hours (Room 204)',
            start: { dateTime: mkTime(1, 15, 30) },
            end: { dateTime: mkTime(1, 16, 30) },
            location: 'Science Wing 204',
            description: 'Rotational dynamics pre-quiz Q&A with Dr. Vance',
          },
          {
            id: 'demo-ev-3',
            summary: 'AP US History DBQ Drafting Session',
            start: { dateTime: mkTime(1, 19, 30) },
            end: { dateTime: mkTime(1, 21, 0) },
            description: 'Outline thesis + annotate primary sources 1–7',
          },
        ];
      });
    }
  }, [isDemoMode, user]);

  // Listen to Auth State + restore this account's connection bundle.
  // Token/Canvas settings live in per-uid vaults: relogin restores them,
  // switching accounts swaps bundles instead of mixing them.
  const authUidRef = useRef<string | null>(null);
  const tokenHydrationRef = useRef<Promise<void>>(Promise.resolve());
  const isHydratingAuthRef = useRef(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((currentUser) => {
      const uid = currentUser?.uid || null;
      const uidChanged = authUidRef.current !== uid;
      authUidRef.current = uid;
      if (uid) {
        setActiveGoogleUid(uid);
        preloadGoogleOAuthReadiness();
        // Swap Canvas to this account's bundle immediately (sync layer).
        if (uidChanged) {
          try {
            setCanvasSettings(hydrateCanvasSettingsForUser(uid));
          } catch {}
        }
        // Restore this account's Google token bundle, then cross-device grant.
        // Track promise so useEffect([user]) waits for hydration before runFullSync.
        isHydratingAuthRef.current = true;
        tokenHydrationRef.current = (
          isConnectingOAuthRef.current
            ? Promise.resolve().then(() => {
                const valid = getValidGoogleToken();
                if (valid) setGoogleToken(valid);
                setScopeRevision((n) => n + 1);
              })
            : hydrateGoogleTokenForUser(uid).then(async (restored) => {
                if (isConnectingOAuthRef.current) {
                  const valid = getValidGoogleToken();
                  if (valid) setGoogleToken(valid);
                  setScopeRevision((n) => n + 1);
                  return;
                }
                const cur = getValidGoogleToken() ?? restored ?? getStoredGoogleToken();
                setGoogleToken(cur);
                if (!hasRefreshToken(uid)) {
                  await hydrateRefreshGrant(uid).catch(() => false);
                }
                if (!isConnectingOAuthRef.current && !getValidGoogleToken()) {
                  try {
                    const t = await ensureFreshGoogleToken(uid);
                    if (t && !isConnectingOAuthRef.current) setGoogleToken(t);
                  } catch {}
                }
                setScopeRevision((n) => n + 1);
              })
        ).catch(() => {
          setGoogleToken(getStoredGoogleToken());
        }).finally(() => {
          isHydratingAuthRef.current = false;
        });
      } else {
        setActiveGoogleUid(null);
        setActiveCanvasUid(null);
        setGoogleToken(null);
        tokenHydrationRef.current = Promise.resolve();
        isHydratingAuthRef.current = false;
      }
      setUser(currentUser);
      const curToken = getStoredGoogleToken();
      if (currentUser && (getValidGoogleToken() || hasRefreshToken() || curToken)) {
        setIsDemoMode(false);
        // onboarding: if never seen, show tour after login
        try {
          const tourSeen = localStorage.getItem('scc_tour_seen_v2');
          if (tourSeen !== 'true') setTimeout(() => setIsIntroTourOpen(true), 1200);
        } catch {}
      } else if (currentUser) {
        try {
          const tourSeen = localStorage.getItem('scc_tour_seen_v2');
          if (tourSeen !== 'true') setTimeout(() => setIsIntroTourOpen(true), 1500);
        } catch {}
      }
    });
    return () => unsubscribe();
  }, []);

  /** Shared handler when feature scopes exist but no valid/refreshable access token could be obtained. */
  const handleMissingGoogleToken = useCallback(
    (
      setError: (msg: string | null) => void,
      setApiInfo: ((info: ApiEnablementInfo | null) => void) | null,
      disconnectedMsg: string,
      syncTitle: string,
      isSilent: boolean
    ) => {
      setGoogleToken(getStoredGoogleToken());
      setScopeRevision((n) => n + 1);
      setApiInfo?.(null);
      setError(disconnectedMsg);
      if (!isSilent) {
        addToast({
          type: 'warning',
          title: syncTitle,
          message: disconnectedMsg,
        });
      }
    },
    [addToast]
  );

  /** Shared Google API loader failure handler: preserves working features on 401 when refresh grant exists and revokes only the failing scope on 403 insufficient scope. */
  const handleGoogleLoaderFailure = useCallback(
    async (
      feature: GoogleFeature,
      err: any,
      setError: (msg: string | null) => void,
      setApiInfo: ((info: ApiEnablementInfo | null) => void) | null,
      defaults: {
        serviceName: string;
        serviceId: string;
        disconnectedMsg: string;
        fetchMsg: string;
        unavailTitle: string;
        syncTitle: string;
        syncMsg?: string;
      },
      isSilent: boolean
    ) => {
      const msg = String(err?.message || '');
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(msg);
      if (is401) {
        if (!hasRefreshToken(authUidRef.current)) {
          await clearGoogleGrant(authUidRef.current);
          setGoogleToken(null);
          setScopeRevision((n) => n + 1);
        }
        setError(defaults.disconnectedMsg);
        return;
      }

      const isScope =
        Boolean(err?.isInsufficientScope) ||
        (err?.status === 403 && /insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg));
      if (isScope) {
        removeGrantedScopes(FEATURE_SCOPES[feature], authUidRef.current);
        setScopeRevision((n) => n + 1);
        setApiInfo?.(null);
        setError(msg || defaults.disconnectedMsg);
        return;
      }

      if (err?.isServiceDisabled && setApiInfo) {
        setApiInfo({
          serviceName: err.serviceName || defaults.serviceName,
          serviceId: err.serviceId || defaults.serviceId,
          activationUrl: err.activationUrl,
          projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
        });
      } else {
        setApiInfo?.(null);
      }

      const errMsg = msg || defaults.fetchMsg;
      setError(errMsg);
      if (!isSilent) {
        addToast({
          type: 'warning',
          title: err?.isServiceDisabled ? defaults.unavailTitle : defaults.syncTitle,
          message: defaults.syncMsg ? msg || defaults.syncMsg : errMsg,
        });
      }
    },
    [addToast]
  );

  // Fetch Google Calendar Events (runs ONLY when Calendar permission is granted)
  const loadCalendarEvents = useCallback(async (isSilent = false, _retried = false) => {
    if (!hasFeatureAccess('calendar', authUidRef.current)) {
      if (!isDemoModeRef.current) setCalendarEvents([]);
      setCalendarError(null);
      setCalendarApiInfo(null);
      return;
    }
    const token = await ensureFreshGoogleToken(authUidRef.current);
    if (!token) {
      handleMissingGoogleToken(
        setCalendarError,
        setCalendarApiInfo,
        t('app_err_cal_disconnected'),
        t('app_toast_cal_sync'),
        isSilent
      );
      return;
    }

    if (!isSilent) setIsLoadingEvents(true);
    try {
      // Planner needs a 7-day window — fetch upcoming, fall back to today-only.
      let items: CalendarEvent[] = [];
      try {
        const { fetchUpcomingCalendarEvents } = await import('./services/googleWorkspace');
        items = await fetchUpcomingCalendarEvents(token, 7);
      } catch {
        items = await fetchTodayCalendarEvents(token);
      }
      setCalendarEvents(items);
      setCalendarError(null);
      setCalendarApiInfo(null);
      setGoogleToken(token);
    } catch (err: any) {
      console.error('Calendar fetch error:', err);
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true, authUidRef.current)) {
          return loadCalendarEvents(isSilent, true);
        }
      }
      await handleGoogleLoaderFailure(
        'calendar',
        err,
        setCalendarError,
        setCalendarApiInfo,
        {
          serviceName: 'Google Calendar API',
          serviceId: 'calendar-json.googleapis.com',
          disconnectedMsg: t('app_err_cal_disconnected'),
          fetchMsg: t('app_err_cal_fetch'),
          unavailTitle: t('app_toast_cal_unavail'),
          syncTitle: t('app_toast_cal_sync'),
          syncMsg: t('app_toast_cal_msg'),
        },
        isSilent
      );
    } finally {
      if (!isSilent) setIsLoadingEvents(false);
    }
  }, [handleGoogleLoaderFailure, handleMissingGoogleToken, t]);

  // Fetch Academic Emails & Summarize with Gemini (runs ONLY when Gmail permission is granted)
  const loadEmailsAndAlerts = useCallback(async (isSilent = false, forceResort = false, options?: FetchEmailOptions, _retried = false) => {
    const EMAIL_AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
    if (isLoadingEmailsRef.current && !_retried) {
      return;
    }
    if (!hasFeatureAccess('gmail', authUidRef.current)) {
      if (!isDemoModeRef.current && rawEmailsRef.current.length === 0) {
        setRawEmails([]);
        setEmailAlerts([]);
      }
      if (emailAlertsRef.current.length > 0) setEmailsAreCachedOnly(true);
      setEmailError(null);
      setGmailApiInfo(null);
      return;
    }
    if (
      isSilent &&
      !forceResort &&
      !options &&
      rawEmailsRef.current.length > 0 &&
      Date.now() - lastEmailSyncAtRef.current < EMAIL_AUTO_SYNC_COOLDOWN_MS
    ) {
      return;
    }
    const token = await ensureFreshGoogleToken(authUidRef.current);
    if (!token) {
      if (emailAlertsRef.current.length > 0) setEmailsAreCachedOnly(true);
      handleMissingGoogleToken(
        setEmailError,
        setGmailApiInfo,
        t('app_err_gmail_disconnected'),
        t('app_toast_gmail_sync'),
        isSilent
      );
      return;
    }

    isLoadingEmailsRef.current = true;
    const showProgress = !isSilent;
    if (showProgress) {
      setIsLoadingEmails(true);
      setEmailLoadStage('fetching');
    }
    try {
      const emails = await fetchAcademicEmails(token, options);
      lastEmailSyncAtRef.current = Date.now();
      setGoogleToken(token);
      setEmailError(null);
      setGmailApiInfo(null);
      const syncedIso = new Date().toISOString();
      setEmailsLastSyncedAt(syncedIso);
      setEmailsAreCachedOnly(false);
      try { localStorage.setItem(LOCAL_EMAILS_LAST_SYNCED_KEY, syncedIso); } catch {}

      const currentRaw = rawEmailsRef.current;
      const currentAlerts = emailAlertsRef.current;
      const isSameSet =
        currentRaw.length > 0 &&
        currentRaw.length === emails.length &&
        currentRaw.every((re, i) => re.id === emails[i]?.id);

      const { emailsToScan, reusableByEmailId } = partitionEmailsForAIScan(emails, currentAlerts);
      const onlyPreviouslyFailed =
        emailsToScan.length > 0 &&
        emailsToScan.every((msg) => {
          const prev = currentAlerts.find((a) => (a.rawEmail?.id || a.id.replace(/^alert-/, '')) === msg.id);
          return prev?.aiStatus === 'failed';
        });

      setRawEmails(sanitizeRawEmails(emails));
      saveRawEmails(sanitizeRawEmails(emails));

      if (emails.length === 0) {
        setEmailAlerts([]);
        try {
          localStorage.removeItem(LOCAL_EMAIL_ALERTS_KEY);
        } catch {}
        return;
      }

      if (emailsToScan.length === 0 || (isSameSet && isSilent && !forceResort && onlyPreviouslyFailed)) {
        // All emails are already scanned (or silent sync won't hammer AI on previously failed items): preserve existing alerts.
        const merged = mergeScannedEmailAlerts(emails, reusableByEmailId, currentAlerts);
        setEmailAlerts(sanitizeEmailAlerts(merged));
        saveEmailAlerts(sanitizeEmailAlerts(merged));
        return;
      }

      if (showProgress) setEmailLoadStage('analyzing');
      let scannedAlerts: EmailAlert[] = [];
      try {
        scannedAlerts = await summarizeEmailsWithGemini(emailsToScan, { forceAI: true });
      } catch (geminiErr) {
        console.warn('Gemini email summarizer unavailable, using Gmail-native fallback:', geminiErr);
        scannedAlerts = emailsToScan.map((msg, idx) => {
          const labels = (msg as any).labelIds || [];
          const isPromo = labels.includes('SPAM') || labels.includes('CATEGORY_PROMOTIONS');
          const isSocial = !isPromo && labels.includes('CATEGORY_SOCIAL');
          const summary = msg.snippet ? (msg.snippet.slice(0, 160) + (msg.snippet.length > 160 ? '...' : '')) : msg.subject;

          return {
            id: msg.id || `alert-${idx}`,
            sender: msg.sender,
            subject: msg.subject,
            oneLineSummary: summary,
            urgency: isPromo || isSocial ? 'INFO' as const : 'MEDIUM' as const,
            category: isPromo ? 'PROMOTION' as const : isSocial ? 'SOCIAL' as const : 'GENERAL' as const,
            isSpam: isPromo,
            spamReason: isPromo ? t('app_gmail_sorted_by') : '',
            gmailLabels: labels,
            detectedAssignment: undefined,
            rawEmail: msg,
            aiStatus: 'failed' as const,
            needsReview: !isPromo,
            reviewReason: 'ai_failed',
          };
        });
      }
      const mergedAlerts = mergeScannedEmailAlerts(emails, reusableByEmailId, scannedAlerts);
      setEmailAlerts(sanitizeEmailAlerts(mergedAlerts));
      saveEmailAlerts(sanitizeEmailAlerts(mergedAlerts));
    } catch (err: any) {
      console.error('Email fetch error:', err);
      lastEmailSyncAtRef.current = Date.now();
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(err?.message || '');
      if (is401 && !_retried) {
        if (await refreshGoogleAccessToken(true, authUidRef.current)) {
          return loadEmailsAndAlerts(isSilent, forceResort, options, true);
        }
      }
      await handleGoogleLoaderFailure(
        'gmail',
        err,
        setEmailError,
        setGmailApiInfo,
        {
          serviceName: 'Gmail API',
          serviceId: 'gmail.googleapis.com',
          disconnectedMsg: t('app_err_gmail_disconnected'),
          fetchMsg: t('app_err_gmail_fetch'),
          unavailTitle: t('app_toast_gmail_unavail'),
          syncTitle: t('app_toast_gmail_sync'),
          syncMsg: t('app_toast_gmail_msg'),
        },
        isSilent
      );
    } finally {
      isLoadingEmailsRef.current = false;
      setIsLoadingEmails(false);
      setEmailLoadStage('idle');
    }
  }, [handleGoogleLoaderFailure, handleMissingGoogleToken, t]);

  // Fetch Master Sheet Assignments (runs ONLY when Google Sheets permission is granted)
  const loadSheetAssignments = useCallback(async (isSilent = false, _retried = false) => {
    if (!hasFeatureAccess('sheets', authUidRef.current)) {
      setSheetError(null);
      setSheetApiInfo(null);
      return;
    }
    const token = await ensureFreshGoogleToken(authUidRef.current);
    if (!token) {
      handleMissingGoogleToken(
        setSheetError,
        setSheetApiInfo,
        t('app_err_sheet_disconnected'),
        t('app_toast_sheet_sync'),
        isSilent
      );
      return;
    }

    if (!isSilent) setIsLoadingAssignments(true);
    try {
      const sheet = await getOrCreateMasterSheet(token);
      setMasterSheetId(sheet.spreadsheetId);
      setMasterSheetUrl(sheet.spreadsheetUrl);

      const items = await fetchSheetAssignments(token, sheet.spreadsheetId);
      if (items && items.length > 0) {
        // Merge not replace: preserve manual tasks not in sheet, handle conflict via updatedAt + toast.
        // All key access is null-safe: one malformed row must never crash the updater (white screen).
        const safeItems = sanitizeAssignments(items);
        let conflictCount = 0;
        const nameKey = (v: any): string => String(v?.assignmentName ?? '').toLowerCase().trim();
        setAssignments(prev => {
          const safePrev = sanitizeAssignments(prev);
          if (!safePrev.length) return safeItems;
          const sheetIds = new Set(safeItems.map((x: any) => x.id));
          const sheetNames = new Set(safeItems.map(nameKey));
          const manualOnly = safePrev.filter(p => !sheetIds.has(p.id) && !sheetNames.has(nameKey(p)));
          // conflict detection: same name but different updatedAt
          const overlapping = safePrev.filter(p => sheetNames.has(nameKey(p)));
          overlapping.forEach(p => {
            const matched = safeItems.find((s: any) => nameKey(s) === nameKey(p));
            if (matched && p.updatedAt && (matched as any).updatedAt && p.updatedAt !== (matched as any).updatedAt) conflictCount++;
          });
          const merged = [...safeItems];
          if (safeItems.length === 0 && manualOnly.length) return safePrev;
          return [...merged, ...manualOnly];
        });
        if (conflictCount>0) setTimeout(()=> addToast({ type: 'warning', title: t('app_toast_conflict_title'), message: t('app_toast_conflict_msg', { count: conflictCount }) }), 500);
      } else if (items && items.length === 0) {
        // sheet empty -> do NOT overwrite existing manual tasks
        console.warn('Sheet empty, preserving local assignments');
      }
      setSheetError(null);
      setSheetApiInfo(null);
      setGoogleToken(token);
    } catch (err: any) {
      console.error('Sheet fetch error:', err);
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true, authUidRef.current)) {
          return loadSheetAssignments(isSilent, true);
        }
      }
      await handleGoogleLoaderFailure(
        'sheets',
        err,
        setSheetError,
        setSheetApiInfo,
        {
          serviceName: 'Google Sheets API',
          serviceId: 'sheets.googleapis.com',
          disconnectedMsg: t('app_err_sheet_disconnected'),
          fetchMsg: t('app_err_sheet_fetch'),
          unavailTitle: t('app_toast_sheet_unavail'),
          syncTitle: t('app_toast_sheet_sync'),
          syncMsg: t('app_toast_sheet_msg'),
        },
        isSilent
      );
    } finally {
      if (!isSilent) setIsLoadingAssignments(false);
    }
  }, [handleGoogleLoaderFailure, handleMissingGoogleToken, t]);

  // Fetch Recent Files (runs ONLY when Google Drive permission is granted)
  const loadRecentFiles = useCallback(async (isSilent = false, _retried = false) => {
    if (!hasFeatureAccess('drive', authUidRef.current)) {
      if (!isDemoModeRef.current) setRecentFiles([]);
      setDriveError(null);
      setDriveApiInfo(null);
      return;
    }
    const token = await ensureFreshGoogleToken(authUidRef.current);
    if (!token) {
      handleMissingGoogleToken(
        setDriveError,
        setDriveApiInfo,
        t('app_err_drive_disconnected'),
        t('app_toast_drive_sync'),
        isSilent
      );
      return;
    }

    if (!isSilent) setIsLoadingFiles(true);
    try {
      const files = await fetchRecentSchoolFiles(token);
      setRecentFiles(files);
      setDriveError(null);
      setDriveApiInfo(null);
      setGoogleToken(token);
    } catch (err: any) {
      console.error('Drive files error:', err);
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true, authUidRef.current)) {
          return loadRecentFiles(isSilent, true);
        }
      }
      await handleGoogleLoaderFailure(
        'drive',
        err,
        setDriveError,
        setDriveApiInfo,
        {
          serviceName: 'Google Drive API',
          serviceId: 'drive.googleapis.com',
          disconnectedMsg: t('app_err_drive_disconnected'),
          fetchMsg: t('app_err_drive_fetch'),
          unavailTitle: t('app_toast_drive_unavail'),
          syncTitle: t('app_toast_drive_sync'),
        },
        isSilent
      );
    } finally {
      if (!isSilent) setIsLoadingFiles(false);
    }
  }, [handleGoogleLoaderFailure, handleMissingGoogleToken, t]);

  // Classroom announcements → same AI reader as Gmail. Re-read only when the post set changes.
  const loadClassroomAnnouncements = useCallback(async (token: string) => {
    const CACHE = 'scc_classroom_alerts_v1';
    try {
      const posts = await fetchRecentClassroomAnnouncements(token);
      const ids = posts.map((p) => p.id).join(',');
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
        if (cached && cached.ids === ids && Array.isArray(cached.alerts)) {
          setClassroomAlerts(sanitizeEmailAlerts(cached.alerts));
          return;
        }
      } catch {}
      if (posts.length === 0) {
        setClassroomAlerts([]);
        return;
      }
      const alerts = sanitizeEmailAlerts(await summarizeEmailsWithGemini(posts, { forceAI: true, origin: 'classroom' }));
      setClassroomAlerts(alerts);
      try {
        localStorage.setItem(CACHE, JSON.stringify({ ids, alerts }));
      } catch {}
    } catch (err) {
      console.warn('Classroom announcements unavailable:', err);
    }
  }, []);

  // Pilot metric: deadlines that passed while the work was not done (anonymous, on-device).
  useEffect(() => {
    recordMissedDeadlines(assignments);
  }, [assignments]);

  // One inbox of school messages: Gmail + Classroom announcements.
  const allAlerts = useMemo(() => [...emailAlerts, ...classroomAlerts], [emailAlerts, classroomAlerts]);

  // "Cho AI đọc thư này": the student asks the AI to read one email Gmail had filed away.
  const handleForceAIRead = useCallback(async (alert: EmailAlert) => {
    const raw = alert.rawEmail;
    if (!raw) return;
    try {
      const [fresh] = await summarizeEmailsWithGemini([raw], { forceAI: true, origin: alert.origin || 'gmail' });
      if (!fresh) return;
      const swap = (list: EmailAlert[]) => list.map((a) => (a.id === alert.id ? { ...fresh, id: alert.id } : a));
      if (alert.origin === 'classroom') setClassroomAlerts((prev) => swap(prev));
      else {
        setEmailAlerts((prev) => {
          const next = sanitizeEmailAlerts(swap(prev));
          saveEmailAlerts(next);
          return next;
        });
      }
    } catch (err) {
      console.warn('Force AI read failed:', err);
    }
  }, []);

  // Fetch Google Classroom coursework (runs ONLY when Classroom permission is granted)
  const loadClassroomData = useCallback(async (isSilent = false, _retried = false) => {
    if (!hasFeatureAccess('classroom', authUidRef.current)) {
      setClassroomError(null);
      setClassroomApiInfo(null);
      return;
    }
    const token = await ensureFreshGoogleToken(authUidRef.current);
    if (!token) {
      handleMissingGoogleToken(
        setClassroomError,
        setClassroomApiInfo,
        t('app_err_cls_disconnected'),
        t('app_toast_cls_sync'),
        isSilent
      );
      return;
    }

    if (!isSilent) setIsLoadingClassroom(true);
    try {
      const list = await fetchAllClassroomAssignments(token);
      setClassroomAssignments(list);
      setClassroomError(null);
      setClassroomApiInfo(null);
      setGoogleToken(token);
      void loadClassroomAnnouncements(token);
      try {
        localStorage.setItem('scc_cached_classroom_assignments', JSON.stringify(list));
      } catch {}
    } catch (err: any) {
      console.error('Classroom fetch error:', err);
      const is401 = err?.status === 401 || /401|expired|hết hạn/i.test(err?.message || '');
      if (is401 && !_retried) {
        if (await refreshGoogleAccessToken(true, authUidRef.current)) {
          return loadClassroomData(isSilent, true);
        }
      }
      if (err?.missingCourseworkScope) {
        removeGrantedScopes(
          ['https://www.googleapis.com/auth/classroom.coursework.me.readonly'],
          authUidRef.current
        );
        setScopeRevision((n) => n + 1);
        setClassroomApiInfo(null);
        setClassroomError(t('classroom_partial_scope_desc'));
        return;
      }
      await handleGoogleLoaderFailure(
        'classroom',
        err,
        setClassroomError,
        setClassroomApiInfo,
        {
          serviceName: 'Google Classroom API',
          serviceId: 'classroom.googleapis.com',
          disconnectedMsg: t('app_err_cls_disconnected'),
          fetchMsg: t('app_err_cls_fetch'),
          unavailTitle: t('app_toast_cls_sync'),
          syncTitle: t('app_toast_cls_sync'),
        },
        isSilent
      );
    } finally {
      if (!isSilent) setIsLoadingClassroom(false);
    }
  }, [handleGoogleLoaderFailure, handleMissingGoogleToken, t]);

  // Fetch Canvas assignments (Zero fake data)
  // NOTE: accepts an optional settings override so Save & Sync in CanvasSyncTab
  // can fetch with freshly-typed credentials immediately. Without this, the
  // callback closes over the *previous* canvasSettings state, sees empty
  // credentials, hits the early-return below, clears the list and shows no
  // error — the silent "load none, no red flag" bug.
  const loadCanvasData = useCallback(async (isSilent = false, settingsOverride?: CanvasSettings) => {
    const effectiveSettings = settingsOverride ?? canvasSettingsRef.current ?? canvasSettings;
    const feedUrl = effectiveSettings.calendarFeedUrl?.trim() || '';
    const apiToken = effectiveSettings.apiToken?.trim() || '';
    const apiDomain = effectiveSettings.apiDomain?.trim()
      ? normalizeCanvasDomain(effectiveSettings.apiDomain)
      : '';
    const isApiConfigured = Boolean(apiToken && apiDomain);
    if (!feedUrl && !isApiConfigured) {
      if (isDemoModeRef.current && !authUidRef.current && !settingsOverride) {
        setCanvasError(null);
        return;
      }
      setCanvasAssignments([]);
      // If user saved a custom URL but no token yet, explain what's missing
      // instead of silently showing an empty tab.
      if (effectiveSettings.apiDomain?.trim() && !apiToken && !feedUrl) {
        setCanvasError(t('app_canvas_missing_token_err'));
      } else {
        setCanvasError(null);
      }
      return;
    }

    if (!isSilent) setIsLoadingCanvas(true);
    try {
      let apiFetched: CanvasAssignment[] = [];
      let feedFetched: CanvasAssignment[] = [];
      let apiError: { message: string; kind?: string; code?: string } | null = null;
      let feedError: { message: string; kind?: string; code?: string } | null = null;

      // 1. Fetch via REST API if configured (requires BOTH Canvas URL + token)
      if (isApiConfigured) {
        try {
          apiFetched = await fetchCanvasAssignmentsFromApi(
            apiDomain,
            apiToken
          );
        } catch (e: any) {
          console.warn('Canvas REST API query error:', e);
          apiError = { message: e?.message || t('app_canvas_api_req_err'), kind: (e as any)?.kind, code: (e as any)?.code };
        }
      }

      // 2. Fetch via Calendar Feed if configured
      if (feedUrl) {
        try {
          feedFetched = await fetchCanvasAssignmentsFromFeed(feedUrl);
        } catch (e: any) {
          console.warn('Canvas Calendar Feed query error:', e);
          feedError = { message: e?.message || t('app_canvas_feed_req_err'), kind: (e as any)?.kind, code: (e as any)?.code };
        }
      }

      // 3. Intelligent Union Merge so all courses (KHTN, Ngữ Văn, etc.) are captured.
      // Malformed items are normalized, never allowed to throw and wipe the whole sync.
      // Keyed by name + course + due date so same-named work across courses never collapses.
      const mergedMap = new Map<string, CanvasAssignment>();
      const mergeKey = (item: any): string =>
        [item?.name ?? item?.title ?? t('app_canvas_default_name'), item?.courseName ?? item?.course ?? '', item?.dueAt ?? item?.dueDate ?? '']
          .join('|').toLowerCase().trim();

      // Put feed items first
      for (const item of feedFetched) {
        if (!item) continue;
        mergedMap.set(mergeKey(item), item);
      }

      // Merge API items, overlaying authentic live submission states & URLs
      for (const item of apiFetched) {
        if (!item) continue;
        const key = mergeKey(item);
        const existing = mergedMap.get(key);
        if (existing) {
          mergedMap.set(key, {
            ...existing,
            ...item,
            htmlUrl: item.htmlUrl || existing.htmlUrl,
            courseName: item.courseName || existing.courseName,
            isCompleted: Boolean(item.isCompleted),
          });
        } else {
          mergedMap.set(key, item);
        }
      }

      const fetched = Array.from(mergedMap.values());

      const currentAssignments = assignmentsRef.current;
      const crossRef = crossReferenceCanvasWithSheet(fetched, currentAssignments);
      // Single-channel error policy: the inline banner is the source of truth.
      // Never toast the same message (that was the duplicate banner+toast bug),
      // and never overwrite the list with [] on failure — keep previous items.
      if (fetched.length === 0 && (apiError || feedError)) {
        // Message is composed here ONCE from the typed failure — the service
        // throws bare reasons, so the hint can never duplicate (Image 1 bug).
        // hasHint matches anywhere (not just the ending) so older cached
        // service messages that already embed guidance never get a 2nd copy.
        const hasHint = (s: string) => /retr(y|ied)|check your canvas/i.test(s);
        const cleanTail = (s: string) => s.trim().replace(/[\s.]+$/, '');
        let errMsg: string;
        if (apiError && !feedError) {
          switch (apiError.kind) {
            case 'auth':
              errMsg = t('app_canvas_auth_err');
              break;
            case 'host': {
              // Allowlist blocks carry code + detail from the service: the token
              // is fine, the deployment refuses the host — name that exact fix.
              const blockedByAllowlist =
                apiError.code === 'host-not-allowlisted' || /allowlist/i.test(apiError.message || '');
              errMsg = blockedByAllowlist
                ? t('app_canvas_allowlist_err', { detail: cleanTail(apiError.message || '') })
                : t('app_canvas_host_err', { detail: apiError.message || '' });
              break;
            }
            case 'network':
              errMsg = t('app_canvas_network_err');
              break;
            case 'backend':
              errMsg = t('app_canvas_backend_err', { detail: apiError.message || '' });
              break;
            default: {
              const reason = cleanTail(apiError.message || '');
              errMsg = hasHint(reason)
                ? t('app_canvas_failed_err', { reason })
                : t('app_canvas_failed_hint_err', { reason });
              break;
            }
          }
        } else {
          if (feedError?.kind === 'backend') {
            errMsg = t('app_canvas_backend_err', { detail: feedError.message || '' });
          } else {
            const combined = cleanTail([apiError?.message, feedError?.message].filter(Boolean).join(' ').trim());
            errMsg = hasHint(combined)
              ? t('app_canvas_failed_err', { reason: combined })
              : t('app_canvas_failed_hint_err', { reason: combined });
          }
        }
        setCanvasError(errMsg);
        return;
      }
      // Configured but zero assignments and zero errors (e.g. all sources quietly
      // empty): say so explicitly instead of a misleading "all caught up".
      if (fetched.length === 0 && (isApiConfigured || feedUrl)) {
        setCanvasError(t('app_canvas_zero_err'));
        return;
      }
      // Auto-sync new unfinished Canvas assignments into Assignments & Due and remove finished ones
      const token = hasFeatureAccess('sheets', authUidRef.current)
        ? await ensureFreshGoogleToken()
        : null;
      const sheetId = masterSheetIdRef.current;

      let reconciledAdded = 0;
      let reconciledRemoved = 0;
      let updatedSheetCount = 0;

      if (effectiveSettings.autoSync !== false) {
        const reconciled = reconcileCanvasAssignmentsWithTracker({
          canvasItems: crossRef,
          currentAssignments: currentAssignments,
          completedCanvasIds: loadCompletedCanvasIds(),
          dismissedCanvasIds: loadDismissedCanvasIds(),
        });
        reconciledAdded = reconciled.added.length;
        reconciledRemoved = reconciled.removed.length;
        updatedSheetCount = reconciledAdded + reconciledRemoved + reconciled.updatedCount;

        const syncedIds = new Set(reconciled.added.map((a) => a.canvasId).filter(Boolean));
        const finalCanvasList = crossRef.map((c) =>
          syncedIds.has(c.id) ? { ...c, isSynced: true } : c
        );
        setCanvasAssignments(finalCanvasList);
        try { localStorage.setItem('scc_cached_canvas_assignments', JSON.stringify(finalCanvasList)); } catch {}
        setCanvasError(null);
        setLastSyncedAt(new Date());

        if (updatedSheetCount > 0) {
          setAssignments(reconciled.nextAssignments);
          if (token && sheetId) {
            syncAllAssignmentsToSheet(
              token,
              sheetId,
              reconciled.nextAssignments.filter((a) => !a.trashedAt)
            )
              .then((syncedRows) => setAssignments(syncedRows))
              .catch((e) => console.warn('Auto-sync Canvas changes to sheet error:', e));
          }
        }
      } else {
        setCanvasAssignments(crossRef);
        try { localStorage.setItem('scc_cached_canvas_assignments', JSON.stringify(crossRef)); } catch {}
        setCanvasError(null);
        setLastSyncedAt(new Date());
      }

      if (!isSilent) {
        const extraParts: string[] = [];
        if (reconciledAdded > 0) extraParts.push(t('app_toast_canvas_auto_added', { count: reconciledAdded }));
        if (reconciledRemoved > 0) extraParts.push(t('app_toast_canvas_auto_removed', { count: reconciledRemoved }));
        addToast({
          type: 'success',
          title: t('app_toast_canvas_title'),
          message:
            t('app_toast_canvas_msg', { count: crossRef.length }) +
            (extraParts.length > 0 ? ` (${extraParts.join(', ')})` : ''),
        });
      }
    } catch (err: any) {
      console.error('Canvas load error:', err);
      const errMsg = err.message || t('app_canvas_catch_err');
      setCanvasError(errMsg);
      // Keep previously loaded assignments so the tab never goes blank on a transient failure.
      // Banner-only (no duplicate toast) per single-channel error policy.
    } finally {
      if (!isSilent) setIsLoadingCanvas(false);
    }
  }, [addToast, t]);

  // Comprehensive Auto-Sync Routine — debounced + AbortController + isSyncing guard
  const syncAbortRef = useRef<AbortController | null>(null);
  const runFullSync = useCallback(
    async (isSilent = true, externalSignal?: AbortSignal) => {
      if (isSyncingRef.current) {
        pendingFullSyncRef.current = true;
        return;
      }
      isSyncingRef.current = true;
      const abort = externalSignal ? null : new AbortController();
      const signal = externalSignal || abort?.signal;
      if (abort) syncAbortRef.current = abort;
      try {
        if (signal?.aborted) return;
        await Promise.allSettled([
          loadCanvasData(isSilent),
          loadCalendarEvents(isSilent),
          loadEmailsAndAlerts(isSilent),
          loadSheetAssignments(isSilent),
          loadRecentFiles(isSilent),
          loadClassroomData(isSilent),
        ]);
        if (!signal?.aborted) setLastSyncedAt(new Date());
      } finally {
        isSyncingRef.current = false;
        if (abort) syncAbortRef.current = null;
        if (pendingFullSyncRef.current && !signal?.aborted) {
          pendingFullSyncRef.current = false;
          void runFullSync(true);
        } else {
          pendingFullSyncRef.current = false;
        }
      }
    },
    [
      loadCanvasData,
      loadCalendarEvents,
      loadEmailsAndAlerts,
      loadSheetAssignments,
      loadRecentFiles,
      loadClassroomData,
    ]
  );

  // Debounced wrapper for visibility/focus storm protection
  const debouncedSync = useDebouncedCallback(() => { runFullSync(true); }, 1200);

  // Finish a redirect sign-in when Google returns to the app (popup-blocked path).
  // Without this, users came back signed-in but with no confirmation and no sync.
  const redirectConsumedRef = useRef(false);
  useEffect(() => {
    if (redirectConsumedRef.current) return;
    redirectConsumedRef.current = true;
    (async () => {
      try {
        const resumed = await consumeRedirectResult();
        if (!resumed) return;
        authUidRef.current = resumed.user.uid;
        setUser(resumed.user);
        setIsDemoMode(false);
        setOauthGuideModalOpen(false);
        setOauthRetryFeature(null);
        setActiveGoogleUid(resumed.user.uid);
        if (resumed.grantedScopes?.length) {
          recordGrantedScopes(resumed.grantedScopes, resumed.user.uid);
        }
        if (resumed.accessToken) {
          markGoogleConnected();
          setGoogleToken(resumed.accessToken);
          setScopeRevision((n) => n + 1);
          try { await hydrateRefreshGrant(resumed.user.uid); } catch {}
          if (resumed.feature && resumed.feature in FEATURE_SCOPES && syncFeatureByKeyRef.current) {
            await syncFeatureByKeyRef.current(resumed.feature as GoogleFeature);
            void runFullSync(true);
          } else {
            await runFullSync(false);
          }
          addToast({
            type: 'success',
            title: t('app_toast_signed_in_title'),
            message: t('app_toast_signed_in_msg', { name: resumed.user.displayName || resumed.user.email || t('app_student_fallback') }),
          });
        } else {
          addToast({
            type: 'info',
            title: t('app_toast_signed_in_title'),
            message: t('app_toast_signed_in_msg', { name: resumed.user.displayName || resumed.user.email || t('app_student_fallback') }),
          });
        }
      } catch {}
    })();
  }, [runFullSync, addToast, t]);

  // Manual Refresh All Data Button
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    try {
      // cancel any pending debounced sync and force immediate
      syncAbortRef.current?.abort();
      await runFullSync(false);
      addToast({
        type: 'info',
        title: t('app_toast_refresh_title'),
        message: t('app_toast_refresh_msg'),
      });
    } finally {
      setIsRefreshingAll(false);
    }
  }, [runFullSync, addToast, t]);

  // 1. Auto-Sync on App Startup and when User Auth resolves or changes (wait for token hydration first)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await tokenHydrationRef.current;
      } catch {}
      if (!cancelled) {
        await runFullSync(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 1b. Real-Time Auto-Sync on Google Token Acquisition or Refresh (skip redundant fire during hydration or active sync)
  useEffect(() => {
    const handleTokenUpdated = (e: any) => {
      const updated = e.detail?.token ?? getStoredGoogleToken();
      setGoogleToken(updated);
      setScopeRevision((n) => n + 1);
      const tokenChanged = Boolean(updated && updated !== lastSyncedTokenRef.current);
      if (updated) lastSyncedTokenRef.current = updated;
      if (tokenChanged && !isHydratingAuthRef.current && !isConnectingOAuthRef.current && !isSyncingRef.current) {
        void runFullSync(true);
      }
    };
    window.addEventListener('scc-google-token-updated', handleTokenUpdated);
    return () => window.removeEventListener('scc-google-token-updated', handleTokenUpdated);
  }, [runFullSync]);

  // 2. Real-Time Background Auto-Sync (every 5 minutes, debounced)
  useEffect(() => {
    const interval = setInterval(() => debouncedSync(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [debouncedSync]);

  // 3. Real-Time Auto-Sync on Tab Focus / Document Visibility Change (cooldown-gated to prevent rapid re-syncs)
  useEffect(() => {
    const FOCUS_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
    const triggerFocusSync = () => {
      const now = Date.now();
      if (now - lastFocusSyncAtRef.current < FOCUS_SYNC_COOLDOWN_MS) return;
      lastFocusSyncAtRef.current = now;
      debouncedSync();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerFocusSync();
    };
    const handleWindowFocus = () => triggerFocusSync();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [debouncedSync]);

  // Re-cross reference Canvas whenever assignments change.
  // Hardened: crossReference never throws on malformed items, and the updater
  // defensively sanitizes so a bad record can never unmount the app (white screen).
  useEffect(() => {
    try {
      setCanvasAssignments((prev) => crossReferenceCanvasWithSheet(sanitizeCanvasAssignments(prev), sanitizeAssignments(assignments)));
    } catch (e) {
      console.error('Re-cross-reference failed (non-fatal):', e);
    }
  }, [assignments]);

  // Google Sign In Handler
  // Every failure gets a plain-language diagnosis + the guide modal for blocking
  // issues (test-user list, admin block, bad domain/key, missing token, timeout).
  const handleSignInFailure = useCallback((err: any, context: 'workspace' | 'gmail') => {
    console.error('Sign in error:', err);
    const diagnosis = classifySignInError(err);
    const legacyBlocked =
      err instanceof OAuthTestUserRequiredError ||
      err?.isOAuthBlocked ||
      err?.message?.includes('OAuth Verification') ||
      err?.message?.includes('Test users') ||
      err?.message?.includes('verification process');
    const openGuide =
      legacyBlocked ||
      ['test-user', 'admin-blocked', 'unauthorized-domain', 'api-key', 'token-missing', 'timeout'].includes(diagnosis.kind);
    if (openGuide) {
      setOauthDiagnosis(diagnosis);
      setOauthGuideModalOpen(true);
      addToast({
        type: 'warning',
        title: diagnosis.title,
        message: diagnosis.fix,
        duration: 9000,
      });
    } else {
      addToast({
        type: 'error',
        title: context === 'gmail' ? t('app_toast_gmail_fail_title') : t('app_toast_signin_fail_title'),
        message: `${diagnosis.detail} ${diagnosis.fix}`,
      });
    }
  }, [addToast, t]);

  // Popup-hostile browsers: full-page redirect to Google and back (basic sign-in only)
  const handleRedirectSignIn = useCallback(async (requestWorkspace = false, feature?: GoogleFeature | null) => {
    setIsLoggingIn(true);
    try {
      addToast({ type: 'info', title: t('app_toast_redirect_title'), message: t('app_toast_redirect_msg') });
      await signInWithRedirectFlow({
        requestWorkspace,
        ...(feature
          ? {
              feature,
              scopes: normalizeScopes([
                ...getGrantedScopes(authUidRef.current),
                ...FEATURE_SCOPES[feature],
              ]),
            }
          : {}),
      });
    } catch (err: any) {
      handleSignInFailure(err, feature === 'gmail' ? 'gmail' : 'workspace');
    } finally {
      setIsLoggingIn(false);
    }
  }, [addToast, handleSignInFailure, t]);

  const syncFeatureByKey = useCallback(async (feature: GoogleFeature) => {
    switch (feature) {
      case 'calendar':
        await loadCalendarEvents(false);
        break;
      case 'gmail':
        await loadEmailsAndAlerts(false);
        break;
      case 'drive':
        await loadRecentFiles(false);
        break;
      case 'sheets':
        await loadSheetAssignments(false);
        break;
      case 'classroom':
        await loadClassroomData(false);
        break;
    }
  }, [loadCalendarEvents, loadEmailsAndAlerts, loadRecentFiles, loadSheetAssignments, loadClassroomData]);

  const promptConnectFeature = useCallback(
    (feature: GoogleFeature, afterConnect?: () => Promise<void> | void) => {
      setPermissionPrompt({ feature, afterConnect });
    },
    []
  );

  const handleGoogleSignIn = async (requestWorkspace = false) => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogle({ requestWorkspace });
      if (!result) {
        return;
      }
      setUser(result.user);
      setIsDemoMode(false);
      setOauthGuideModalOpen(false);
      setOauthDiagnosis(null);
      setActiveGoogleUid(result.user.uid);
      // Fresh sign-in: clear stale sync errors
      setCalendarError(null);
      setEmailError(null);
      setSheetError(null);
      setDriveError(null);
      setCanvasError(null);
      setClassroomError(null);

      try {
        if (result.user?.uid) {
          await hydrateRefreshGrant(result.user.uid);
        }
      } catch (grantErr) {
        console.warn('Grant check skipped:', grantErr);
      }

      if (result.accessToken) {
        setGoogleToken(result.accessToken);
      }
      setScopeRevision((n) => n + 1);
      await runFullSync(false);

      addToast({
        type: 'success',
        title: t('app_toast_signed_in_title'),
        message: t('app_toast_welcome_msg', { name: result.user.displayName || result.user.email || t('app_student_fallback') }),
        duration: 6000,
      });
    } catch (err: any) {
      handleSignInFailure(err, 'workspace');
    } finally {
      setIsLoggingIn(false);
    }
  };

  syncFeatureByKeyRef.current = syncFeatureByKey;

  const connectGoogleFeature = useCallback(
    async (feature: GoogleFeature, afterConnect?: () => Promise<void> | void) => {
      const attemptId = ++connectAttemptRef.current;
      isConnectingOAuthRef.current = true;
      setConnectingFeature(feature);
      setIsLoggingIn(true);
      try {
        // Reset any previous error state so retrying after an earlier Cancel/Deny starts clean.
        if (feature === 'calendar') { setCalendarError(null); setCalendarApiInfo(null); }
        if (feature === 'gmail') { setEmailError(null); setGmailApiInfo(null); }
        if (feature === 'sheets') { setSheetError(null); setSheetApiInfo(null); }
        if (feature === 'drive') { setDriveError(null); setDriveApiInfo(null); }
        if (feature === 'classroom') { setClassroomError(null); setClassroomApiInfo(null); }

        pendingLateFeatureRef.current = { feature, afterConnect };
        // Firebase Auth popup (`__/auth/handler`) handles both initial sign-in and feature
        // consent in a single user-activated popup even when the user is currently signed out.
        const perm = await requestFeaturePermissionDetailed(feature, {
          loginHint: user?.email || undefined,
          uid: user?.uid || undefined,
          forceConsent: true,
        });

        // If user closed/cancelled the modal while OAuth popup was open, do not overwrite UI state.
        if (attemptId !== connectAttemptRef.current) return;

        // Always close the prompt and clear loading state as soon as OAuth returns.
        setPermissionPrompt(null);
        setConnectingFeature(null);
        setIsLoggingIn(false);

        if (perm.status === 'dismissed') {
          if (!perm.popupInterruptedQuickly) {
            pendingLateFeatureRef.current = null;
          }
          addToast({
            type: 'info',
            title: perm.popupInterruptedQuickly
              ? t('app_toast_perm_interrupted_title')
              : t('app_toast_perm_dismissed_title'),
            message: perm.popupInterruptedQuickly
              ? t('app_toast_perm_interrupted_msg')
              : t('app_toast_perm_dismissed_msg'),
            duration: perm.popupInterruptedQuickly ? 9500 : 5000,
            retryLabel: t('app_toast_retry_btn'),
            onRetry: () => {
              void connectGoogleFeature(feature, afterConnect);
            },
          } as any);
          return;
        }

        if (perm.status === 'partial_scopes') {
          pendingLateFeatureRef.current = null;
          const missing = perm.missingScopes
            .map((s) => s.replace(/^https:\/\/www\.googleapis\.com\/auth\//, ''))
            .join(', ');
          addToast({
            type: 'warning',
            title: t('app_toast_perm_partial_title'),
            message: missing
              ? t('app_toast_perm_partial_detail_msg', { missing })
              : t('app_toast_perm_partial_msg'),
            duration: 7500,
            retryLabel: t('app_toast_retry_btn'),
            onRetry: () => {
              void connectGoogleFeature(feature, afterConnect);
            },
          } as any);
          return;
        }

        if (perm.status === 'popup_blocked') {
          pendingLateFeatureRef.current = null;
          setOauthRetryFeature(feature);
          addToast({
            type: 'warning',
            title: t('app_toast_popup_blocked_title'),
            message: t('app_toast_popup_blocked_msg'),
            duration: 7500,
            retryLabel: t('app_toast_troubleshoot_btn'),
            onRetry: () => setOauthGuideModalOpen(true),
          } as any);
          return;
        }

        if (perm.status !== 'granted') {
          pendingLateFeatureRef.current = null;
          setOauthRetryFeature(feature);
          handleSignInFailure(
            new Error(perm.message || t('gauth_connect_failed')),
            feature === 'gmail' ? 'gmail' : 'workspace'
          );
          return;
        }

        setOauthRetryFeature(null);
        pendingLateFeatureRef.current = null;
        const resolvedUser = perm.user || user;
        if (resolvedUser?.uid) {
          authUidRef.current = resolvedUser.uid;
          setUser(resolvedUser);
          setIsDemoMode(false);
          setActiveGoogleUid(resolvedUser.uid);
        }
        const token = perm.accessToken;
        setGoogleToken(token);
        setScopeRevision((n) => n + 1);

        const labelMap: Record<GoogleFeature, string> = {
          calendar: t('app_feature_cal'),
          gmail: t('app_feature_gmail'),
          drive: t('app_feature_drive'),
          sheets: t('app_feature_sheets'),
          classroom: t('app_feature_cls'),
        };
        const accountLabel =
          resolvedUser?.email || resolvedUser?.displayName || t('app_your_account');
        addToast({
          type: 'success',
          title: t('app_toast_feature_connected', { feature: labelMap[feature] }),
          message:
            perm.mode === 'offline'
              ? t('app_toast_feature_ready', { name: accountLabel })
              : t('app_toast_feature_session_ready', { name: accountLabel }),
        });

        // Sync the target feature cleanly first, then quietly refresh any sibling connected services.
        isConnectingOAuthRef.current = false;
        void (async () => {
          await (afterConnect ? afterConnect() : syncFeatureByKey(feature));
          void runFullSync(true);
        })();
      } catch (err: any) {
        if (attemptId === connectAttemptRef.current) {
          setPermissionPrompt(null);
          setOauthRetryFeature(feature);
          handleSignInFailure(err, feature === 'gmail' ? 'gmail' : 'workspace');
        }
      } finally {
        isConnectingOAuthRef.current = false;
        if (attemptId === connectAttemptRef.current) {
          setConnectingFeature(null);
          setIsLoggingIn(false);
        }
      }
    },
    [user, addToast, handleSignInFailure, syncFeatureByKey, runFullSync, t]
  );

  const confirmPermissionPrompt = async () => {
    if (!permissionPrompt) return;
    const { feature, afterConnect } = permissionPrompt;
    await connectGoogleFeature(feature, afterConnect);
    setPermissionPrompt(null);
  };

  useEffect(() => {
    return onLateGooglePermissionGranted((grant) => {
      const pending = pendingLateFeatureRef.current;
      pendingLateFeatureRef.current = null;
      const inferredFeature =
        pending?.feature ||
        (['calendar', 'gmail', 'drive', 'sheets', 'classroom'] as GoogleFeature[]).find((f) =>
          FEATURE_SCOPES[f].every((scope) => grant.grantedScopes.includes(scope))
        );

      setPermissionPrompt(null);
      setConnectingFeature(null);
      setIsLoggingIn(false);
      setGoogleToken(grant.accessToken);
      setScopeRevision((n) => n + 1);

      if (inferredFeature) {
        if (inferredFeature === 'calendar') { setCalendarError(null); setCalendarApiInfo(null); }
        if (inferredFeature === 'gmail') { setEmailError(null); setGmailApiInfo(null); }
        if (inferredFeature === 'sheets') { setSheetError(null); setSheetApiInfo(null); }
        if (inferredFeature === 'drive') { setDriveError(null); setDriveApiInfo(null); }
        if (inferredFeature === 'classroom') { setClassroomError(null); setClassroomApiInfo(null); }
      }

      const labelMap: Record<GoogleFeature, string> = {
        calendar: t('app_feature_cal'),
        gmail: t('app_feature_gmail'),
        drive: t('app_feature_drive'),
        sheets: t('app_feature_sheets'),
        classroom: t('app_feature_cls'),
      };
      const accountLabel = user?.email || user?.displayName || t('app_your_account');
      if (inferredFeature) {
        addToast({
          type: 'success',
          title: t('app_toast_feature_connected', { feature: labelMap[inferredFeature] }),
          message:
            grant.mode === 'offline'
              ? t('app_toast_feature_ready', { name: accountLabel })
              : t('app_toast_feature_session_ready', { name: accountLabel }),
        });
      }

      void (async () => {
        if (pending?.afterConnect) {
          await pending.afterConnect();
        } else if (inferredFeature) {
          await syncFeatureByKey(inferredFeature);
        }
        void runFullSync(true);
      })();
    });
  }, [addToast, runFullSync, syncFeatureByKey, t, user?.displayName, user?.email]);

  const handleBasicSignIn = async () => {
    await handleGoogleSignIn(false);
  };

  const handleDisconnectGoogle = useCallback(async () => {
    // Explicit disconnect: forget THIS account's grant + token vault entirely.
    // (Unlike logout, the next sign-in starts blank for this account.)
    await clearGoogleGrant(user?.uid || null);
    setGoogleToken(null);
    setScopeRevision((n) => n + 1);
    setCalendarEvents([]);
    setEmailAlerts([]);
    setRawEmails([]);
    setRecentFiles([]);
    setClassroomAssignments([]);
    setClassroomError(null);
    setMasterSheetId(undefined);
    setMasterSheetUrl(undefined);
    addToast({
      type: 'info',
      title: t('app_toast_google_disc_title'),
      message: t('app_toast_google_disc_msg'),
    });
  }, [addToast, user?.uid, t]);

  // Logout Handler — sign out but KEEP this account's connection bundle
  // (Canvas settings + Google token vault + offline grant). The next login
  // with the same account restores everything instantly, no re-connect needed.
  const handleLogout = async () => {
    setConfirmationModal({
      isOpen: true,
      title: t('app_signout_title'),
      description: t('app_signout_desc'),
      isDestructive: false,
      confirmLabel: t('app_signout_confirm'),
      onConfirm: async () => {
        await signOutUser();
        setGoogleToken(null);
        setUser(null);
        setCalendarEvents([]);
        setEmailAlerts([]);
        setRawEmails([]);
        setRecentFiles([]);
        setClassroomAssignments([]);
        setClassroomError(null);
        setMasterSheetId(undefined);
        setMasterSheetUrl(undefined);
        addToast({
          type: 'info',
          title: t('app_signout_done_title'),
          message: t('app_signout_done_msg'),
        });
      },
    });
  };

  // Add Assignment
  const handleAddAssignment = async (newAssign: Omit<Assignment, 'id'>) => {
    const token = hasFeatureAccess('sheets', authUidRef.current)
      ? await ensureFreshGoogleToken()
      : null;
    const tempId = `assign-${Date.now()}`;
    const fullAssign: Assignment = { ...newAssign, id: tempId };

    if (token && masterSheetId) {
      try {
        const added = await appendAssignmentToSheet(token, masterSheetId, fullAssign);
        setAssignments((prev) => [...prev, added]);
        addToast({
          type: 'success',
          title: t('app_toast_sheet_saved_title'),
          message: t('app_toast_added_msg', { name: fullAssign.assignmentName }),
          actionLabel: t('open_sheet'),
          actionUrl: masterSheetUrl,
        });
      } catch (err: any) {
        console.error('Error appending to sheet:', err);
        setAssignments((prev) => [...prev, fullAssign]);
        addToast({
          type: 'warning',
          title: t('app_toast_local_saved_title'),
          message: t('app_toast_local_saved_msg'),
        });
      }
    } else {
      setAssignments((prev) => [...prev, fullAssign]);
      addToast({
        type: 'success',
        title: t('app_toast_added_title'),
        message: t('app_toast_added_local_msg', { name: fullAssign.assignmentName }),
      });
    }
  };

  // Update Status
  const handleUpdateStatus = async (assignment: Assignment, newStatus: AssignmentStatus) => {
    const updated = { ...assignment, status: newStatus };
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? updated : a)));
    const statusLabel =
      newStatus === 'Done'
        ? t('app_status_done')
        : newStatus === 'In Progress'
        ? t('app_status_in_progress')
        : t('app_status_not_started');

    const token = hasFeatureAccess('sheets', authUidRef.current)
      ? await ensureFreshGoogleToken()
      : null;
    if (token && masterSheetId && assignment.sheetRowIndex) {
      try {
        await updateAssignmentInSheet(token, masterSheetId, updated);
        addToast({
          type: 'info',
          title: t('app_toast_status_sheet_title'),
          message: t('app_toast_status_msg', { name: assignment.assignmentName, status: statusLabel }),
        });
      } catch (err) {
        console.error('Error updating status in sheet:', err);
      }
    } else {
      addToast({
        type: 'info',
        title: t('app_toast_status_title'),
        message: t('app_toast_status_msg', { name: assignment.assignmentName, status: statusLabel }),
      });
    }
  };

  const handleToggleAssignmentById = async (id: string) => {
    const target = assignments.find((a) => a.id === id);
    if (!target) return;
    const nextStatus: AssignmentStatus = target.status === 'Done' ? 'Not Started' : 'Done';
    await handleUpdateStatus(target, nextStatus);
  };

  // Clear / Purge all completed assignments from Master Sheet and tracker
  const handleClearCompletedAssignments = async () => {
    const activeOnly = assignments.filter((a) => a.status !== 'Done');
    const token = hasFeatureAccess('sheets', authUidRef.current)
      ? await ensureFreshGoogleToken()
      : null;

    if (token && masterSheetId) {
      try {
        const synced = await syncAllAssignmentsToSheet(token, masterSheetId, activeOnly);
        setAssignments(synced);
        addToast({
          type: 'success',
          title: t('app_toast_cleared_title'),
          message: t('app_toast_cleared_sheet_msg'),
        });
      } catch (err: any) {
        console.error('Error clearing completed from sheet:', err);
        setAssignments(activeOnly);
        addToast({
          type: 'info',
          title: t('app_toast_cleared_local_title'),
          message: t('app_toast_cleared_local_msg'),
        });
      }
    } else {
      setAssignments(activeOnly);
      addToast({
        type: 'success',
        title: t('app_toast_cleared_title'),
        message: t('app_toast_cleared_tracker_msg'),
      });
    }
  };

  // Natural Language Task Parse → confirm card (never auto-saved, never a made-up date)
  const handleParseNaturalText = async (text: string) => {
    setIsParsingAI(true);
    try {
      const parsed: any = await parseNaturalLanguageAssignment(text);
      setAiDraft({
        assignmentName: parsed.assignmentName || text,
        subject: parsed.subject || '',
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate || '') ? parsed.dueDate : '',
        priority: parsed.priority === 'High' || parsed.priority === 'Low' ? parsed.priority : 'Med',
        dueConfidence: parsed.dueConfidence,
        evidence: parsed.dueEvidence || '',
        sourceLabel: `“${text.slice(0, 80)}”`,
        aiFailed: parsed.aiStatus === 'failed',
        origin: 'text',
      });
    } catch (err: any) {
      console.error('Parse error:', err);
      setAiDraft({
        assignmentName: text,
        subject: '',
        dueDate: '',
        priority: 'Med',
        dueConfidence: 'none',
        sourceLabel: `“${text.slice(0, 80)}”`,
        aiFailed: true,
        origin: 'text',
      });
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleConfirmAiDraft = async (result: AiConfirmResult, dueStatus: 'confirmed' | 'unconfirmed' | 'missing') => {
    const d = aiDraft;
    if (!d) return;
    await handleAddAssignment({
      assignmentName: result.assignmentName,
      subject: result.subject,
      dueDate: result.dueDate,
      priority: result.priority,
      status: 'Not Started',
      source: d.origin === 'text' ? 'Manual' : 'Gmail',
      notes: d.origin === 'text' ? `AI: ${d.sourceLabel}` : `${d.sourceLabel}`,
      dueStatus,
      sourceUrl: d.sourceUrl,
      aiEvidence: d.evidence || undefined,
    });
    if (d.alertId) dismissReview(d.alertId);
    const edited = result.assignmentName !== d.assignmentName || result.subject !== (d.subject || t('app_subject_general')) || result.dueDate !== d.dueDate || result.priority !== d.priority;
    logPilot(dueStatus === 'missing' ? 'ai_no_date' : dueStatus === 'unconfirmed' ? 'ai_later' : edited ? 'ai_edited' : 'ai_confirmed');
    setAiDraft(null);
  };

  // Student tapped "Hạn chưa xác nhận" in the tracker → the date is now theirs.
  const handleConfirmDue = async (target: Assignment) => {
    const next = assignments.map((a) => (a.id === target.id ? { ...a, dueStatus: 'confirmed' as const, updatedAt: new Date().toISOString() } : a));
    setAssignments(next);
    logPilot('due_confirmed');
    addToast({ type: 'success', title: t('app_toast_due_confirmed_title'), message: t('app_toast_due_confirmed_msg', { name: target.assignmentName, due: target.dueDate }) });
    try {
      const token = hasFeatureAccess('sheets', authUidRef.current)
        ? await ensureFreshGoogleToken()
        : null;
      if (token && masterSheetId) await syncAllAssignmentsToSheet(token, masterSheetId, next.filter((a) => !a.trashedAt));
    } catch (err) {
      console.warn('Sheet update after confirm failed (kept locally):', err);
    }
  };

  const handleRejectAiDraft = () => {
    const d = aiDraft;
    if (d?.alertId) dismissReview(d.alertId);
    logPilot('ai_rejected');
    setAiDraft(null);
    addToast({ type: 'info', title: t('app_toast_rejected_title'), message: t('app_toast_rejected_msg') });
  };

  // Schedule Study Block in Google Calendar
  const handleScheduleStudyBlock = async (eventData: {
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
  }) => {
    if (!hasFeatureAccess('calendar', authUidRef.current) && !isDemoModeRef.current) {
      promptConnectFeature('calendar', async () => {
        await handleScheduleStudyBlock(eventData);
      });
      return;
    }

    setIsScheduling(true);
    const token = await ensureFreshGoogleToken();

    try {
      if (token) {
        const createdEvent = await insertCalendarEvent(token, {
          summary: eventData.title,
          description: eventData.description,
          start: { dateTime: eventData.startDateTime },
          end: { dateTime: eventData.endDateTime },
          location: eventData.location,
        });

        setCalendarEvents((prev) => [
          ...prev,
          { ...createdEvent, isStudyBlock: true },
        ]);

        addToast({
          type: 'success',
          title: t('app_toast_study_block_title'),
          message: t('app_toast_study_block_msg', { title: eventData.title }),
          actionLabel: t('app_open_calendar'),
          actionUrl: createdEvent.htmlLink || 'https://calendar.google.com',
        });
      } else if (isDemoModeRef.current) {
        setCalendarEvents((prev) => [
          ...prev,
          {
            id: `demo-study-${Date.now()}`,
            summary: eventData.title,
            description: eventData.description,
            start: { dateTime: eventData.startDateTime },
            end: { dateTime: eventData.endDateTime },
            isStudyBlock: true,
          },
        ]);
        addToast({
          type: 'success',
          title: t('app_toast_demo_block_title'),
          message: t('app_toast_demo_block_msg', { title: eventData.title }),
        });
      } else {
        promptConnectFeature('calendar', async () => {
          await handleScheduleStudyBlock(eventData);
        });
      }
    } catch (err: any) {
      console.error('Error adding study block:', err);
      if (err?.isServiceDisabled) {
        setApiActivationModalInfo({
          serviceName: err.serviceName || 'Google Calendar',
          serviceId: err.serviceId || 'calendar-json.googleapis.com',
          activationUrl: err.activationUrl,
          projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
        });
        setApiActivationModalOpen(true);
      }
      addToast({
        type: 'error',
        title: err?.isServiceDisabled ? t('app_toast_cal_unavail') : t('app_toast_study_block_fail_title'),
        message: err.message || t('app_toast_study_block_fail_msg'),
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Save Gmail Draft
  // Opens Gmail's own compose window pre-filled — the student reviews and sends it.
  // Needs no Gmail permission at all (gmail.compose was dropped in v2.17.0).
  const handleSaveToGmailDrafts = async (to: string, subject: string, body: string) => {
    setIsSavingDraft(true);
    try {
      let account = '';
      try {
        account = localStorage.getItem('scc_google_email_v1') || '';
      } catch {}
      const params = new URLSearchParams({ view: 'cm', fs: '1', to: to || '', su: subject || '', body: (body || '').slice(0, 1800) });
      if (account.includes('@')) params.set('authuser', account);
      window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank', 'noopener');
      addToast({
        type: 'success',
        title: t('app_toast_gmail_draft_title'),
        message: t('app_toast_gmail_draft_msg', { to: to || t('app_toast_gmail_draft_to_fallback') }),
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Extract Assignment from Scanned Email Alert → confirm card (works even when the AI found nothing)
  const handleExtractAssignment = (alert: EmailAlert) => {
    const det = alert.detectedAssignment;
    const fromClassroom = alert.origin === 'classroom';
    setAiDraft({
      assignmentName: det?.name || alert.subject || '',
      subject: det?.subject || '',
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(det?.dueDate || '') ? (det as any).dueDate : '',
      priority: det?.priority || 'Med',
      dueConfidence: det?.dueDate ? det?.dueConfidence || 'explicit' : 'none',
      evidence: det?.dueEvidence || '',
      sourceLabel: `${fromClassroom ? 'Classroom' : 'Gmail'} · ${alert.sender} · ${alert.subject}`.slice(0, 120),
      sourceUrl: alert.sourceUrl,
      sourceText: alert.rawEmail?.body || alert.rawEmail?.snippet,
      aiFailed: alert.aiStatus === 'failed' || alert.aiStatus === 'skipped',
      origin: fromClassroom ? 'classroom' : alert.needsReview ? 'review' : 'gmail',
      alertId: alert.id,
    });
  };

  // Handle manual completion toggle inside CanvasSyncTab: remove from Assignments & Due when finished, restore when unfinished
  const handleToggleCanvasComplete = useCallback(async (canvasItem: CanvasAssignment, isNowCompleted: boolean) => {
    const updatedCanvasList = canvasAssignments.map((c) =>
      c.id === canvasItem.id ? { ...c, isCompleted: isNowCompleted } : c
    );
    setCanvasAssignments(updatedCanvasList);
    try { localStorage.setItem('scc_cached_canvas_assignments', JSON.stringify(updatedCanvasList)); } catch {}

    const prevCompleted = loadCompletedCanvasIds();
    const nextCompleted = isNowCompleted
      ? Array.from(new Set([...prevCompleted, canvasItem.id]))
      : prevCompleted.filter((id) => id !== canvasItem.id);
    saveCompletedCanvasIds(nextCompleted);

    if (!isNowCompleted) {
      undismissCanvasAssignmentId(canvasItem.id);
    }

    const reconciled = reconcileCanvasAssignmentsWithTracker({
      canvasItems: updatedCanvasList,
      currentAssignments: assignmentsRef.current,
      completedCanvasIds: nextCompleted,
      dismissedCanvasIds: loadDismissedCanvasIds(),
    });

    if (reconciled.added.length > 0 || reconciled.removed.length > 0) {
      setAssignments(reconciled.nextAssignments);
      const token = hasFeatureAccess('sheets', authUidRef.current)
        ? await ensureFreshGoogleToken()
        : null;
      if (token && masterSheetIdRef.current) {
        syncAllAssignmentsToSheet(
          token,
          masterSheetIdRef.current,
          reconciled.nextAssignments.filter((a) => !a.trashedAt)
        )
          .then((syncedRows) => setAssignments(syncedRows))
          .catch((e) => console.warn('Canvas toggle sheet sync error:', e));
      }
    }
  }, [canvasAssignments]);

  // Sync single Canvas assignment to Google Sheet
  const handleSyncCanvasToSheet = async (canvasItem: CanvasAssignment) => {
    await handleAddAssignment({
      assignmentName: canvasItem.name,
      subject: canvasItem.courseName,
      dueDate: canvasItem.dueAt,
      priority: canvasItem.pointsPossible && canvasItem.pointsPossible >= 50 ? 'High' : 'Med',
      status: 'Not Started',
      source: 'Canvas',
      notes: canvasItem.description || t('app_canvas_note_pts', { pts: canvasItem.pointsPossible || 0 }),
    });

    setCanvasAssignments((prev) =>
      prev.map((c) => (c.id === canvasItem.id ? { ...c, isSynced: true } : c))
    );
  };

  // Sync All Pending Canvas to Sheet
  const handleSyncAllPendingCanvas = async () => {
    const pending = canvasAssignments.filter((a) => !a.isSynced);
    if (pending.length === 0) return;

    for (const item of pending) {
      await handleSyncCanvasToSheet(item);
    }

    addToast({
      type: 'success',
      title: t('app_toast_canvas_batch_title'),
      message: t('app_toast_canvas_batch_msg', { count: pending.length }),
      actionLabel: masterSheetUrl ? t('open_sheet') : undefined,
      actionUrl: masterSheetUrl,
    });
  };

  // Google Drive & Canvas direct submission workflow
  // Public link sharing only after the student agrees (it used to happen silently).
  const handleSubmitAssignment = async (assignment: CanvasAssignment, fileId: string) => {
    setConfirmationModal({
      isOpen: true,
      title: t('app_confirm_share_title'),
      description: t('app_confirm_share_desc'),
      confirmLabel: t('app_confirm_share_btn'),
      isDestructive: false,
      onConfirm: async () => {
        await submitAssignmentWithShare(assignment, fileId);
      },
    });
  };

  const submitAssignmentWithShare = async (assignment: CanvasAssignment, fileId: string) => {
    if (!hasFeatureAccess('drive', authUidRef.current) && !isDemoModeRef.current) {
      promptConnectFeature('drive', async () => {
        await submitAssignmentWithShare(assignment, fileId);
      });
      return;
    }
    const token = await ensureFreshGoogleToken();
    if (!token && !isDemoMode) {
      promptConnectFeature('drive', async () => {
        await submitAssignmentWithShare(assignment, fileId);
      });
      return;
    }

    try {
      // 1. Auto-share document permissions (anyone with link can view)
      if (token) {
        await shareGoogleDriveFile(token, fileId);
      }

      // 2. Generate standard document URL
      const fileUrl = `https://docs.google.com/document/d/${fileId}/edit`;

      // 3. Submit directly to Canvas if REST API credentials exist
      if (canvasSettings.apiToken && canvasSettings.apiDomain && assignment.courseId) {
        await submitCanvasAssignment(
          canvasSettings.apiDomain,
          canvasSettings.apiToken,
          assignment.courseId,
          assignment.id,
          fileUrl
        );
      }

      // 4. Sync done status to Master Google Sheet tracker (null-safe name match)
      const targetName = String((assignment as any)?.name ?? '').toLowerCase().trim();
      const targetSheetItem = targetName ? assignments.find(
        (a) => {
          const aName = String(a?.assignmentName ?? '').toLowerCase().trim();
          return aName !== '' && (aName === targetName || targetName.includes(aName));
        }
      ) : undefined;

      if (targetSheetItem) {
        await handleUpdateStatus(targetSheetItem, 'Done');
      }

      // 5. Update state
      setCanvasAssignments((prev) =>
        prev.map((c) => (c.id === assignment.id ? { ...c, isCompleted: true } : c))
      );

      // Trigger celebration confetti — respect prefers-reduced-motion
      void celebrateWin({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'],
      });

      addToast({
        type: 'success',
        title: t('app_toast_submitted_title'),
        message: t('app_toast_submitted_msg', { name: assignment.name }),
      });
    } catch (err: any) {
      console.error('Canvas submit workflow error:', err);
      addToast({
        type: 'error',
        title: t('app_toast_submit_fail_title'),
        message: err.message || t('app_toast_submit_fail_msg'),
      });
      throw err;
    }
  };


  // Keyboard Shortcuts — includes global hotkeys (g d, g c, n, ?, cmd+k) + roving palette
  const lastGRef = useRef<number>(0);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if (isTyping) { if (e.key === 'Escape') target.blur(); return; }
      // Global cmd+k always works
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCommandPaletteOpen(p => !p); return;
      }
      if (e.key === '?' ) { if (!isTyping) { setShortcutsModalOpen(true); return; } }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); handleTabTransition('tracker'); return;
      }
      // g + {d,c,n} sequence (go dashboard/canvas/new)
      if (e.key.toLowerCase() === 'g' && !e.metaKey) { lastGRef.current = Date.now(); return; }
      if (lastGRef.current && Date.now() - lastGRef.current < 800) {
        const seq = e.key.toLowerCase();
        if (seq === 'd') { e.preventDefault(); handleTabTransition('dashboard'); lastGRef.current = 0; return; }
        if (seq === 'c') { e.preventDefault(); handleTabTransition('canvas'); lastGRef.current = 0; return; }
        if (seq === 't') { e.preventDefault(); handleTabTransition('tracker'); lastGRef.current = 0; return; }
        if (seq === 'm') { e.preventDefault(); handleTabTransition('gmail'); lastGRef.current = 0; return; }
      }
      if (!shortcutSettings.masterEnabled) {
        if (e.key === 'Escape') { if (zenFocusMode) setZenFocusMode(false); setAccountSettingsOpen(false); setAiChatOpen(false); setCommandPaletteOpen(false); }
        return;
      }
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) setZenFocusMode(p=>!p);
      else if (e.key === '0') handleTabTransition('dashboard');
      else if (e.key === '1') handleTabTransition('canvas');
      else if (e.key === '2') handleTabTransition('radar');
      else if (e.key === '3') handleTabTransition('tracker');
      else if (e.key === '4') handleTabTransition('gmail');
      else if (e.key === '5') handleTabTransition('drive');
      else if (e.key === '6') handleTabTransition('notes-markdown');
      else if ((e.key === 'r' || e.key === 'R') && shortcutSettings.keys.sync) handleRefreshAll();
      else if (e.key === '?' && shortcutSettings.keys.help) setAccountSettingsOpen(true);
      else if (e.key === 'Escape') { if (zenFocusMode) setZenFocusMode(false); setAccountSettingsOpen(false); setAiChatOpen(false); setCommandPaletteOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefreshAll, shortcutSettings, handleTabTransition, zenFocusMode]);

  if (!user && !isDemoMode) {
    return (
      <>
        <LandingPage
          onSignIn={() => handleGoogleSignIn(false)}
          onExploreDemo={() => setIsDemoMode(true)}
          isLoggingIn={isLoggingIn}
          darkMode={darkMode}
          setDarkMode={applyDarkMode}
        />
        {oauthGuideModalOpen && (
        <OAuthGuideModal
          isOpen={oauthGuideModalOpen}
          onClose={() => { setOauthGuideModalOpen(false); setOauthDiagnosis(null); setOauthRetryFeature(null); }}
          onRetryWorkspaceSignIn={() => {
            const retryFeature = oauthRetryFeature;
            setOauthGuideModalOpen(false);
            if (retryFeature) {
              void connectGoogleFeature(retryFeature);
            } else {
              void handleGoogleSignIn(false);
            }
          }}
          onBasicSignIn={() => handleGoogleSignIn(false)}
          isLoggingIn={isLoggingIn}
          projectId=""
          userEmail=""
          diagnosis={oauthDiagnosis}
          onRunDiagnostics={diagnoseSignInEnvironment}
          onRedirectSignIn={() => handleRedirectSignIn(false, oauthRetryFeature)}
        />
        )}
        {privacyOpen && (
          <PrivacyModal
            onClose={() => setPrivacyOpen(false)}
            onRevoke={async () => {
              await handleDisconnectGoogle();
              setPrivacyOpen(false);
            }}
            onDeleteAll={async () => {
              try { await clearGoogleGrant(null); } catch {}
              try { await db.delete(); } catch {}
              try { localStorage.clear(); sessionStorage.clear(); } catch {}
              try { await signOutUser(); } catch {}
              window.location.reload();
            }}
          />
        )}
        <ToastContainer
          toasts={toasts}
          onDismiss={dismissToast}
          onRetry={(id: string) => {
            const t = toasts.find((x) => x.id === id);
            if (t?.reconnectGoogle) handleGoogleSignIn(false);
          }}
        />
      </>
    );
  }

  // reducedMotion already handled via CSS prefers-reduced-motion + index.css; MotionConfig not required (motion 12 export issue avoided)
  const demoBanner = !user && isDemoMode ? (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] text-[var(--text-primary)] px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 z-30 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-fill)] shrink-0" aria-hidden="true" />
        <span className="truncate">
          {t('app_demo_banner_prefix')}
          <strong>{t('app_demo_banner_bold')}</strong>
          {t('app_demo_banner_suffix')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => handleGoogleSignIn(false)}
          disabled={isLoggingIn}
          className="px-3 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
        >
          {t('app_demo_signin_btn')}
        </button>
        <button
          type="button"
          onClick={() => setIsDemoMode(false)}
          className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs cursor-pointer"
        >
          {t('app_demo_exit_btn')}
        </button>
      </div>
    </div>
  ) : null;

  const pwaBanner = showInstallBtn && !zenFocusMode ? (
    <div className="mx-4 mt-2 p-2.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl flex items-center justify-between text-xs shadow-xs shrink-0">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">📲</span>
        <span className="font-semibold text-[var(--text-primary)]">{t('app_install_banner_text')}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstallPwa}
          className="px-3 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-bold cursor-pointer"
        >
          {t('app_install_btn')}
        </button>
        <button
          type="button"
          onClick={handleDismissPwa}
          className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          {t('app_install_later')}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Shell
        isZen={zenFocusMode}
        mobileNavOpen={mobileNavOpen}
        onMobileNavChange={setMobileNavOpen}
        topBanner={demoBanner}
        subBanner={pwaBanner}
        sidebarProps={{
          activeTab,
          onSelectTab: (tab) => {
            handleTabTransition(tab);
            setMobileNavOpen(false);
          },
          isExpanded: isSidebarExpanded,
          onToggleExpand: toggleSidebar,
          user,
          onSignIn: () => handleGoogleSignIn(false),
          onSignOut: handleLogout,
          onOpenSettings: () => setAccountSettingsOpen(true),
          onOpenAppStore: () => setAppStoreOpen(true),
          onOpenShortcuts: () => setShortcutsModalOpen(true),
          onOpenSearch: () => setCommandPaletteOpen(true),
          onToggleAiChat: () => setAiChatOpen((v) => !v),
          isAiChatOpen: aiChatOpen,
          onToggleDarkMode: toggleDarkMode,
          darkMode,
          pinnedAppIds,
          onUnpinApp: handleUnpinApp,
          badges: {
            canvas: clearedTabBadges.has('canvas') ? 0 : canvasUnfinishedCount,
            schedule: clearedTabBadges.has('radar') ? 0 : calendarEvents.length,
            tracker: clearedTabBadges.has('tracker') ? 0 : pendingAssignmentCount,
            gmail: clearedTabBadges.has('gmail') ? 0 : urgentEmailCount,
            flashcards: clearedTabBadges.has('flashcards') ? 0 : flashcardDueCount,
            pomodoro: 0,
          },
        }}
        navbarProps={{
          hidden: layoutMode === 'calm',
          activeTabLabel: t(TAB_LABEL_KEYS[activeTab] || 'nav_default_tab'),
          onOpenCommandPalette: () => setCommandPaletteOpen(true),
          onToggleAiChat: () => setAiChatOpen(!aiChatOpen),
          notifications,
          isAiChatOpen: aiChatOpen,
          onOpenGoogleSync: () => setGoogleSyncHubOpen(true),
          isGoogleConnected,
          isSyncingGoogle: isRefreshingAll,
          onNotificationClick: (n) => {
            if (n.source === 'Canvas' || n.id.startsWith('urgent-due-')) handleTabTransition('canvas');
            else if (n.source === 'Google Drive') handleTabTransition('drive');
            else if (n.source === 'Gmail') handleTabTransition('gmail');
            else if (n.tier === 'urgent') handleTabTransition('tracker');
            else handleTabTransition('radar');
            setTimeout(() => { window.dispatchEvent(new CustomEvent('scc-highlight-tracker')); }, 300);
          },
        }}
        fullScreenView={
          aiChatOpen ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-[var(--accent-fill)] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-xs text-[var(--text-muted)]">{t('app_loading_coach')}</span>
                </div>
              }
            >
              <StudyAssistantChat
                isOpen={true}
                onClose={() => setAiChatOpen(false)}
                assignments={assignments}
                events={calendarEvents}
                alerts={emailAlerts}
                isFullScreen={true}
              />
            </Suspense>
          ) : undefined
        }
      >
        <ErrorBoundary fallback={<div className="p-6 rounded-xl border border-[var(--status-err-border)] bg-[var(--status-err-bg)] text-[var(--status-err-text)] text-sm">{t('app_workspace_fallback')}</div>}>
          <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--accent-fill)] border-t-transparent rounded-full animate-spin" /><span className="ml-2 text-xs text-[var(--text-muted)]">{t('app_loading_workspace')}</span></div>}>
            <div className="max-w-7xl mx-auto space-y-6 enter">
                {/* Google Workspace Connection Banner: only when no usable grant
                    exists. Access renews silently via the offline grant, so no
                    expiry state is ever surfaced — reconnecting once upgrades
                    legacy hourly tokens to permanent automatically. */}
                {activeTab === 'canvas' && (
                  <CanvasSyncTab
                    settings={canvasSettings}
                    onSaveSettings={(newSettings: CanvasSettings) => {
                      setCanvasSettings(newSettings);
                      saveCanvasSettings(newSettings, user?.uid || null);
                    }}
                    canvasAssignments={canvasAssignments}
                    isLoading={isLoadingCanvas}
                    errorMessage={canvasError}
                    lastSyncedAt={lastSyncedAt}
                    onFetchCanvas={(override?: CanvasSettings) => loadCanvasData(false, override)}
                    onSyncToSheet={handleSyncCanvasToSheet}
                    onSyncAllPending={handleSyncAllPendingCanvas}
                    recentFiles={recentFiles}
                    isGoogleConnected={hasDriveAccess}
                    onSubmitAssignment={handleSubmitAssignment}
                    googleToken={hasDriveAccess ? googleToken || undefined : undefined}
                    onConnectGoogle={() => promptConnectFeature('drive', () => loadRecentFiles(false))}
                    onToggleComplete={handleToggleCanvasComplete}
                  />
                )}

                {activeTab === 'radar' && (
                  <DailyRadarTab
                    events={calendarEvents}
                    isLoadingEvents={isLoadingEvents}
                    onRefreshEvents={loadCalendarEvents}
                    onOpenScheduleModal={(evt?: Partial<CalendarEvent>) => {
                      setSelectedEventForSchedule(evt || null);
                      setSelectedAssignmentForSchedule(null);
                      setScheduleModalOpen(true);
                    }}
                    onNavigateToTab={handleTabTransition}
                    urgentCanvasItems={canvasAssignments.filter((c) => !c.isSynced).slice(0, 3)}
                    allCanvasAssignments={canvasAssignments}
                    isGoogleConnected={hasCalendarAccess}
                    onConnectGoogle={() => promptConnectFeature('calendar', () => loadCalendarEvents(false))}
                    calendarError={calendarError}
                    calendarApiInfo={calendarApiInfo}
                    pendingAssignments={assignments.filter((a) => a.status !== 'Done')}
                    onAddStudyBlock={handleScheduleStudyBlock}
                    {...({
                      initialMode: radarInitialMode,
                      classroomAssignments,
                      emailAlerts: allAlerts,
                    } as Record<string, any>)}
                  />
                )}

                {activeTab === 'tracker' && (
                  <AssignmentTrackerTab
                    assignments={assignments}
                    sheetUrl={masterSheetUrl}
                    sheetId={masterSheetId}
                    isLoading={isLoadingAssignments}
                    onRefresh={loadSheetAssignments}
                    onAddAssignment={handleAddAssignment}
                    onUpdateStatus={handleUpdateStatus}
                    onScheduleStudyBlock={(assignment: Assignment) => {
                      setSelectedAssignmentForSchedule(assignment);
                      setSelectedEventForSchedule(null);
                      setScheduleModalOpen(true);
                    }}
                    onParseNaturalText={handleParseNaturalText}
                    isParsingAI={isParsingAI}
                    isGoogleConnected={hasSheetsAccess}
                    onConnectGoogle={() => promptConnectFeature('sheets', () => loadSheetAssignments(false))}
                    onClearCompleted={handleClearCompletedAssignments}
                    onConfirmDue={handleConfirmDue}
                    sheetError={sheetError}
                    sheetApiInfo={sheetApiInfo}
                    onOpenLibrarySearch={(q: string) => {
                      try { localStorage.setItem('scc_openlib_prefill_v1', q); } catch {}
                      handleTabTransition('open-library');
                    }}
                  />
                )}

                {activeTab === 'gmail' && (
                  <GmailRadarTab
                    emailAlerts={allAlerts}
                    onForceAIRead={handleForceAIRead}
                    rawEmails={rawEmails}
                    isLoadingEmails={isLoadingEmails}
                    emailLoadStage={emailLoadStage}
                    emailsLastSyncedAt={emailsLastSyncedAt}
                    emailsAreCachedOnly={emailsAreCachedOnly}
                    onRefreshEmails={(forceResort?: boolean, options?: FetchEmailOptions) =>
                      loadEmailsAndAlerts(forceResort === false && rawEmailsRef.current.length > 0, forceResort ?? true, options)
                    }
                    onOpenQuickDraft={(email?: EmailMessage, alert?: EmailAlert) => {
                      setDraftInitialEmail(email || null);
                      setDraftInitialAlert(alert || null);
                      setQuickDraftModalOpen(true);
                    }}
                    onExtractAssignment={handleExtractAssignment}
                    isGoogleConnected={hasGmailAccess}
                    onConnectGoogle={() => promptConnectFeature('gmail', () => loadEmailsAndAlerts(false))}
                    onDisconnectGoogle={handleDisconnectGoogle}
                    connectedEmail={user?.email || null}
                    emailError={emailError}
                    gmailApiInfo={gmailApiInfo}
                  />
                )}

                {activeTab === 'drive' && (
                  <GoogleDriveTab
                    recentFiles={recentFiles}
                    isLoadingFiles={isLoadingFiles}
                    onRefreshFiles={() => loadRecentFiles(false)}
                    isGoogleConnected={hasDriveAccess}
                    onConnectGoogle={() => promptConnectFeature('drive', () => loadRecentFiles(false))}
                    driveError={driveError}
                    driveApiInfo={driveApiInfo}
                    googleToken={hasDriveAccess ? googleToken || undefined : undefined}
                  />
                )}

                {activeTab === 'classroom' && (
                  <GoogleClassroomPanel
                    googleToken={hasClassroomAccess ? googleToken || undefined : undefined}
                    isGoogleConnected={hasClassroomAccess}
                    onConnectGoogle={() => promptConnectFeature('classroom', () => loadClassroomData(false))}
                    onSyncToSheet={handleSyncCanvasToSheet}
                    classroomAssignments={classroomAssignments}
                    isLoading={isLoadingClassroom}
                    errorMessage={classroomError}
                    classroomApiInfo={classroomApiInfo}
                    onRefresh={() => loadClassroomData(false)}
                    missingCourseworkScope={
                      hasClassroomAccess &&
                      getMissingOptionalFeatureScopes('classroom', uidForScopes).some((s) =>
                        s.includes('classroom.coursework')
                      )
                    }
                  />
                )}

                {activeTab === 'flashcards' && (
                  <FlashcardStudioTab />
                )}

                {activeTab === 'desmos-graphing' && (
                  <DesmosWorkspace mode="graphing" />
                )}

                {activeTab === 'geogebra' && (
                  <GeoGebraWorkspace />
                )}

                {activeTab === 'phet' && (
                  <PhETWorkspace />
                )}

                {activeTab === 'excalidraw' && (
                  <ExcalidrawWorkspace />
                )}

                {activeTab === 'pomodoro' && (
                  <PomodoroWorkspace
                    {...(pomodoroFocusMinutes
                      ? ({ initialMinutes: pomodoroFocusMinutes } as Record<string, any>)
                      : {})}
                  />
                )}

                {activeTab === 'arxiv' && (
                  <ArxivWorkspace />
                )}

                {activeTab === 'open-library' && (
                  <OpenLibraryWorkspace />
                )}

                {activeTab === 'notes-markdown' && (
                  <DocumentHubWorkspace
                    recentFiles={recentFiles}
                    isLoadingFiles={isLoadingFiles}
                    onRefreshFiles={() => loadRecentFiles(false)}
                    isGoogleConnected={hasDriveAccess}
                    googleToken={hasDriveAccess ? googleToken || undefined : undefined}
                    onConnectGoogle={() => promptConnectFeature('drive', () => loadRecentFiles(false))}
                  />
                )}

                {activeTab === 'note-scanner' && (
                  <NoteScannerWorkspace
                    onOpenNotes={() => handleTabTransition('notes-markdown')}
                  />
                )}

                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    {/* Home hierarchy fix (v2.5.0): greeting + Today Plan stay above the fold — checklist demoted below DashboardHome */}
                    <DashboardHome
                      assignments={assignments}
                      onToggleAssignment={handleToggleAssignmentById}
                      onNavigateWorkspace={(ws: string) => handleTabTransition(ws)}
                      onOpenQuickDraft={(emailAlert?: EmailAlert) => {
                        if (emailAlert) {
                          setDraftInitialEmail(emailAlert.rawEmail || null);
                          setDraftInitialAlert(emailAlert);
                        } else {
                          setDraftInitialEmail(null);
                          setDraftInitialAlert(null);
                        }
                        setQuickDraftModalOpen(true);
                      }}
                      onOpenAiSuite={(tab?: 'planner' | 'syllabus' | 'quiz' | 'grades') => {
                        setAiSuiteTab(tab || 'planner');
                        setAiSuiteOpen(true);
                      }}
                      onOpenAppStore={() => setAppStoreOpen(true)}
                      onOpenAiCoach={() => setAiChatOpen(true)}
                      layoutMode={layoutMode}
                      user={user}
                      isGoogleConnected={isGoogleConnected}
                      isGmailConnected={hasGmailAccess}
                      isClassroomConnected={hasClassroomAccess}
                      onConnectGoogle={() => setGoogleSyncHubOpen(true)}
                      onOpenStudyPlan={() => setIsStudyPlanOpen(true)}
                      calendarEvents={calendarEvents}
                      emailAlerts={allAlerts}
                      isLoadingEvents={isLoadingEvents}
                      canvasCount={canvasAssignments.filter((c) => !c.isCompleted).length}
                      classroomCount={hasClassroomAccess ? classroomAssignments.filter((c) => !c.isCompleted).length : 0}
                    />
                    {layoutMode === 'classic' && (
                    <OnboardingChecklist
                      onConnectCanvas={()=>handleTabTransition('canvas')}
                      onConnectGoogle={()=>setGoogleSyncHubOpen(true)}
                      onCreateTask={()=>handleTabTransition('tracker')}
                      onStartPomodoro={()=>{ handleTabTransition('pomodoro'); setZenFocusMode(true); }}
                    />
                    )}
                  </div>
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        </Shell>

      {/* Unified 2-Column Account & Settings Modal — gated so its chunk only loads when opened */}
      {accountSettingsOpen && (
      <Suspense fallback={null}>
      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        user={user}
        onGoogleSignIn={() => handleGoogleSignIn(false)}
        onLogout={handleLogout}
        onConnectFeature={(feature: GoogleFeature) => promptConnectFeature(feature, () => syncFeatureByKey(feature))}
        onOpenGoogleSyncHub={() => setGoogleSyncHubOpen(true)}
        isLoggingIn={isLoggingIn}
        darkMode={darkMode}
        setDarkMode={applyDarkMode}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isRefreshingAll}
        sheetUrl={masterSheetUrl || null}
        onOpenTour={() => setIsIntroTourOpen(true)}
        onOpenOAuthGuide={() => setOauthGuideModalOpen(true)}
        onOpenDeploymentGuide={() => setDeploymentModalOpen(true)}
        onOpenChangelog={() => setIsChangelogOpen(true)}
        shortcutSettings={shortcutSettings}
        setShortcutSettings={setShortcutSettings}
        reducedMotion={reducedMotion}
        setReducedMotion={setReducedMotion}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        isSidebarExpanded={isSidebarExpanded}
        toggleSidebar={toggleSidebar}
        pwaInstallAvailable={showInstallBtn && !!deferredPrompt}
        deferredPrompt={deferredPrompt}
        onInstallPwa={handleInstallPwa}
        onDismissPwa={handleDismissPwa}
        assignments={assignments}
        calendarEvents={calendarEvents}
        googleAccessToken={googleToken}
      />
      </Suspense>
      )}
      {/* Remaining lazy modals share one Suspense (closed at the end of the stack) */}
      <Suspense fallback={null}>
      {/* Quick Draft Modal — intentionally always mounted to preserve in-progress drafts */}
      <QuickDraftModal
        isOpen={quickDraftModalOpen}
        onClose={() => {
          setQuickDraftModalOpen(false);
          setDraftInitialEmail(null);
          setDraftInitialAlert(null);
        }}
        initialEmail={draftInitialEmail}
        initialAlert={draftInitialAlert}
        onGenerateDraft={generateQuickDraft}
        onSaveToGmailDrafts={handleSaveToGmailDrafts}
        isSavingDraft={isSavingDraft}
        recentFiles={recentFiles}
      />

      {/* Schedule Study Session Modal — gated so its chunk only loads when opened */}
      {scheduleModalOpen && (
      <ScheduleStudyModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setSelectedAssignmentForSchedule(null);
          setSelectedEventForSchedule(null);
        }}
        assignment={selectedAssignmentForSchedule}
        initialEvent={selectedEventForSchedule}
        onSchedule={handleScheduleStudyBlock}
        isScheduling={isScheduling}
      />
      )}

      {/* Google Connections Hub Modal */}
      {googleSyncHubOpen && (
        <Suspense fallback={null}>
          <GoogleSyncHubModal
            isOpen={googleSyncHubOpen}
            onClose={() => setGoogleSyncHubOpen(false)}
            user={user}
            hasGoogleToken={isGoogleConnected}
            isSyncing={isRefreshingAll}
            onSyncAll={async () => {
              await runFullSync(false);
            }}
            onConnectGoogle={() => handleGoogleSignIn(false)}
            onDisconnectGoogle={handleDisconnectGoogle}
            onConnectGmail={() => loadEmailsAndAlerts(false)}
            isConnectingGmail={isLoadingEmails}
            onConnectFeature={(feature: GoogleFeature) => {
              setGoogleSyncHubOpen(false);
              promptConnectFeature(feature);
            }}
            connectingFeature={connectingFeature}
            calendarEventsCount={calendarEvents.length}
            emailCount={rawEmails.length}
            schoolFilesCount={recentFiles.length}
            classroomCount={classroomAssignments.length}
            sheetUrl={masterSheetUrl}
            onSyncSheet={async () => {
              if (!hasSheetsAccess && !isDemoMode) {
                setGoogleSyncHubOpen(false);
                promptConnectFeature('sheets', () => loadSheetAssignments(false));
                return;
              }
              await loadSheetAssignments(false);
            }}
            isSyncingSheet={isLoadingAssignments}
            onSyncClassroom={async () => {
              if (!hasClassroomAccess && !isDemoMode) {
                setGoogleSyncHubOpen(false);
                promptConnectFeature('classroom', () => loadClassroomData(false));
                return;
              }
              await loadClassroomData(false);
            }}
            isSyncingClassroom={isLoadingClassroom}
          />
        </Suspense>
      )}

      {/* Global Confirmation Modal — gated so its chunk only loads when opened */}
      {confirmationModal.isOpen && (
      <ConfirmationModal
        modal={confirmationModal}
        onClose={() => setConfirmationModal((prev) => ({ ...prev, isOpen: false }))}
      />
      )}

      {privacyOpen && (
        <PrivacyModal
          onClose={() => setPrivacyOpen(false)}
          onRevoke={async () => {
            await handleDisconnectGoogle();
            setPrivacyOpen(false);
          }}
          onDeleteAll={async () => {
            // "Xoá toàn bộ dữ liệu": Google grant (incl. the Firestore copy), Dexie, browser storage.
            try { await clearGoogleGrant(user?.uid || null); } catch {}
            try { await db.delete(); } catch {}
            try { localStorage.clear(); sessionStorage.clear(); } catch {}
            try { await signOutUser(); } catch {}
            window.location.reload();
          }}
        />
      )}

      {aiDraft && (
        <AiConfirmCard
          draft={aiDraft}
          onSave={handleConfirmAiDraft}
          onReject={handleRejectAiDraft}
          onClose={() => setAiDraft(null)}
        />
      )}

      {/* Command Palette — gated so its chunk only loads when opened */}
      {commandPaletteOpen && (
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectWorkspace={handleTabTransition}
        onOpenQuickDraft={() => {
          setDraftInitialEmail(null);
          setDraftInitialAlert(null);
          setQuickDraftModalOpen(true);
        }}
        onOpenNewAssignment={() => {
          handleTabTransition('tracker');
        }}
        onCreateAssignment={handleAddAssignment}
        onToggleAiChat={() => setAiChatOpen(!aiChatOpen)}
        onToggleDarkMode={toggleDarkMode}
        assignments={assignments}
        sheetUrl={masterSheetUrl}
      />
      )}

      {/* Keyboard Shortcuts Cheat-sheet Modal — gated so its chunk only loads when opened */}
      {shortcutsModalOpen && (
      <ShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
      )}

      {/* Vercel Deployment & Integrations Guide Modal — gated so its chunk only loads when opened */}
      {deploymentModalOpen && (
      <DeploymentModal
        isOpen={deploymentModalOpen}
        onClose={() => setDeploymentModalOpen(false)}
      />
      )}

      {/* Plain-English Per-Feature Google Permission Prompt */}
      <GooglePermissionModal
        isOpen={Boolean(permissionPrompt)}
        feature={permissionPrompt?.feature || 'calendar'}
        userEmail={user?.email || null}
        isConnecting={Boolean(connectingFeature)}
        onConfirm={confirmPermissionPrompt}
        onCancel={() => {
          connectAttemptRef.current += 1;
          setConnectingFeature(null);
          setIsLoggingIn(false);
          setPermissionPrompt(null);
        }}
      />

      {/* Google Sign-In Troubleshooting Modal — gated so its chunk only loads when opened */}
      {oauthGuideModalOpen && (
      <OAuthGuideModal
        isOpen={oauthGuideModalOpen}
        onClose={() => { setOauthGuideModalOpen(false); setOauthDiagnosis(null); setOauthRetryFeature(null); }}
        onRetryWorkspaceSignIn={() => {
          const retryFeature = oauthRetryFeature;
          setOauthGuideModalOpen(false);
          if (retryFeature) {
            void connectGoogleFeature(retryFeature);
          } else {
            void handleGoogleSignIn(false);
          }
        }}
        onBasicSignIn={handleBasicSignIn}
        isLoggingIn={isLoggingIn}
        projectId=""
        userEmail={user?.email || ''}
        diagnosis={oauthDiagnosis}
        onRunDiagnostics={diagnoseSignInEnvironment}
        onRedirectSignIn={() => handleRedirectSignIn(false, oauthRetryFeature)}
      />
      )}

      {/* Google Cloud API Enablement Modal — gated so its chunk only loads when opened */}
      {apiActivationModalOpen && (
      <ApiActivationModal
        isOpen={apiActivationModalOpen}
        onClose={() => setApiActivationModalOpen(false)}
        info={apiActivationModalInfo}
        onRetry={() => {
          setApiActivationModalOpen(false);
          handleRefreshAll();
        }}
      />
      )}

      {/* App Store & Tool Catalog Modal */}
      <AppStoreModal
        isOpen={appStoreOpen}
        onClose={() => setAppStoreOpen(false)}
        onLaunchApp={(appId) => handleTabTransition(appId)}
        pinnedAppIds={pinnedAppIds}
        onTogglePinApp={handleTogglePinApp}
      />

      {/* AI Academic Suite Modal (Planner, Quiz, Syllabus, Grades) — gated so its chunk only loads when opened */}
      {aiSuiteOpen && (
      <AiAcademicSuiteModal
        isOpen={aiSuiteOpen}
        onClose={() => setAiSuiteOpen(false)}
        assignments={assignments}
        onAddAssignments={(newItems: Partial<Assignment>[]) => {
          newItems.forEach((item: Partial<Assignment>) => {
            handleAddAssignment({
              assignmentName: item.assignmentName || t('app_notif_assignment_fallback'),
              subject: item.subject || t('app_subject_general'),
              dueDate: item.dueDate || t('app_due_upcoming_fallback'),
              priority: (item.priority as PriorityLevel) || 'Med',
              status: (item.status as AssignmentStatus) || 'Not Started',
              notes: item.notes || '',
            });
          });
        }}
        defaultTab={aiSuiteTab}
      />
      )}

      {/* Persistent Gemini & Groq AI Settings Modal — gated so its chunk only loads when opened */}
      {geminiSettingsOpen && (
      <GeminiSettingsModal
        isOpen={geminiSettingsOpen}
        onClose={() => setGeminiSettingsOpen(false)}
      />
      )}

      {/* Wikipedia Quick Look Modal — gated so its chunk only loads when opened */}
      {isWikipediaModalOpen && (
      <WikipediaLookupModal
        isOpen={isWikipediaModalOpen}
        onClose={() => setIsWikipediaModalOpen(false)}
        initialQuery={wikipediaInitialQuery}
      />
      )}

      {/* Study Card Modal — gated so its chunk only loads when opened */}
      {isStudyCardOpen && (
      <StudyCardModal
        isOpen={isStudyCardOpen}
        onClose={() => setIsStudyCardOpen(false)}
        userName={user?.displayName || t('app_student_fallback')}
        completedTasksCount={assignments.filter((a) => a.status === 'Done').length}
      />
      )}

      {/* Daily Morning Check-in Modal — gated so its chunk only loads when opened */}
      {isMorningCheckInOpen && (
      <MorningCheckInModal
        isOpen={isMorningCheckInOpen}
        onClose={() => setIsMorningCheckInOpen(false)}
        userName={user?.displayName || t('app_student_fallback')}
        onSaveIntention={handleSaveMorningIntention}
      />
      )}

      {/* Changelog Releases Modal — gated so its chunk only loads when opened */}
      {isChangelogOpen && (
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
      )}

      {/* AI Daily Study Plan Generator Modal — gated so its chunk only loads when opened */}
      {isStudyPlanOpen && (
      <StudyPlanGeneratorModal
        isOpen={isStudyPlanOpen}
        onClose={() => setIsStudyPlanOpen(false)}
        assignments={assignments}
        onAddStudyBlock={handleScheduleStudyBlock}
        onStartFocusSession={(mins: number) => {
          setPomodoroFocusMinutes(mins);
          try {
            localStorage.setItem('scc_pomo_preset_mins_v1', String(mins));
            window.dispatchEvent(new CustomEvent('scc-pomo-start', { detail: { minutes: mins } }));
          } catch {}
          handleTabTransition('pomodoro');
          setZenFocusMode(true);
          addToast({
            type: 'info',
            title: t('app_toast_pomo_title', { mins }),
            message: t('app_toast_pomo_msg', { mins }),
          });
        }}
      />
      )}

      {/* Guided spotlight tour — points at real UI, auto-moves tabs on Next/Back */}
      {isIntroTourOpen && (
      <InteractiveIntroModal
        isOpen={isIntroTourOpen}
        onClose={() => setIsIntroTourOpen(false)}
        onNavigate={(tab: string) => handleTabTransition(tab)}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onOpenAiCoach={() => setAiChatOpen(true)}
        onOpenGoogleSync={() => setGoogleSyncHubOpen(true)}
      />
      )}

      </Suspense>

      {/* Toast Notification Container — pauseOnHover + undo (Feedback + PWA Install now live inside Settings → Help & Support) */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} onRetry={(id:string)=>{
        // Expiry toasts reconnect Google; others run their own retry handler
        try {
          const toastItem = toasts.find((x) => x.id === id) as any;
          if (toastItem?.reconnectGoogle) {
            dismissToast(id);
            handleGoogleSignIn(false);
            return;
          }
          if (typeof toastItem?.onRetry === 'function') toastItem.onRetry();
        } catch {}
        dismissToast(id);
      }} onUndo={(id:string)=>{
        // undo delete-assignment: restore last deleted from localStorage stash
        try {
          const raw = localStorage.getItem('scc_last_deleted_assignment');
          if (raw) {
            const a = sanitizeAssignments([JSON.parse(raw)])[0];
            if (a) setAssignments(prev=> [...prev, a]);
            localStorage.removeItem('scc_last_deleted_assignment');
            addToast({ type:'success', title: t('app_toast_restored_title'), message: a?.assignmentName ?? t('app_toast_restored_fallback') });
          }
        } catch {}
        dismissToast(id);
      }} />
    </>
  );
}
