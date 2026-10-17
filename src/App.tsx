import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardHome } from './components/DashboardHome';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useBadgeCounts } from './hooks/useBadgeCounts';
import { useDebouncedCallback } from './hooks/useDebouncedCallback';
import { initTheme, setTheme, syncDarkToTheme } from './services/theme';
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
const AcademicRadarWorkspace = lazyRetry(() => import('./components/workspaces/AcademicRadarWorkspace').then(m => ({ default: m.AcademicRadarWorkspace })));
const StemLabWorkspace = lazyRetry(() => import('./components/workspaces/StemLabWorkspace').then(m => ({ default: m.StemLabWorkspace })));
const CreationStudioWorkspace = lazyRetry(() => import('./components/workspaces/CreationStudioWorkspace').then(m => ({ default: m.CreationStudioWorkspace })));
const RetentionVaultWorkspace = lazyRetry(() => import('./components/workspaces/RetentionVaultWorkspace').then(m => ({ default: m.RetentionVaultWorkspace })));
const DocumentHubWorkspace = lazyRetry(() => import('./components/workspaces/DocumentHubWorkspace').then(m => ({ default: m.DocumentHubWorkspace })));
const DesmosWorkspace = lazyRetry(() => import('./components/workspaces/DesmosWorkspace').then(m => ({ default: m.DesmosWorkspace })));
const GeoGebraWorkspace = lazyRetry(() => import('./components/workspaces/GeoGebraWorkspace').then(m => ({ default: m.GeoGebraWorkspace })));
const ExcalidrawWorkspace = lazyRetry(() => import('./components/workspaces/ExcalidrawWorkspace').then(m => ({ default: m.ExcalidrawWorkspace })));
const PhETWorkspace = lazyRetry(() => import('./components/workspaces/PhETWorkspace').then(m => ({ default: m.PhETWorkspace })));
const MermaidWorkspace = lazyRetry(() => import('./components/workspaces/MermaidWorkspace').then(m => ({ default: m.MermaidWorkspace })));
const WolframWorkspace = lazyRetry(() => import('./components/workspaces/WolframWorkspace').then(m => ({ default: m.WolframWorkspace })));
const RubricCheckerWorkspace = lazyRetry(() => import('./components/workspaces/RubricCheckerWorkspace').then(m => ({ default: m.RubricCheckerWorkspace })));
const FeynmanWorkspace = lazyRetry(() => import('./components/workspaces/FeynmanWorkspace').then(m => ({ default: m.FeynmanWorkspace })));
const PhotoMathWorkspace = lazyRetry(() => import('./components/workspaces/PhotoMathWorkspace').then(m => ({ default: m.PhotoMathWorkspace })));
const PdfReaderWorkspace = lazyRetry(() => import('./components/workspaces/PdfReaderWorkspace').then(m => ({ default: m.PdfReaderWorkspace })));
const QuizGeneratorWorkspace = lazyRetry(() => import('./components/workspaces/QuizGeneratorWorkspace').then(m => ({ default: m.QuizGeneratorWorkspace })));
const PomodoroWorkspace = lazyRetry(() => import('./components/workspaces/PomodoroWorkspace').then(m => ({ default: m.PomodoroWorkspace })));
const PeriodicTableWorkspace = lazyRetry(() => import('./components/workspaces/PeriodicTableWorkspace').then(m => ({ default: m.PeriodicTableWorkspace })));
const UnitConverterWorkspace = lazyRetry(() => import('./components/workspaces/UnitConverterWorkspace').then(m => ({ default: m.UnitConverterWorkspace })));
const ArxivWorkspace = lazyRetry(() => import('./components/workspaces/ArxivWorkspace').then(m => ({ default: m.ArxivWorkspace })));
const OpenLibraryWorkspace = lazyRetry(() => import('./components/workspaces/OpenLibraryWorkspace').then(m => ({ default: m.OpenLibraryWorkspace })));
const CitationVaultWorkspace = lazyRetry(() => import('./components/workspaces/CitationVaultWorkspace').then(m => ({ default: m.CitationVaultWorkspace })));
const TimetableWorkspace = lazyRetry(() => import('./components/workspaces/TimetableWorkspace').then(m => ({ default: m.TimetableWorkspace })));
const ScholarshipTrackerWorkspace = lazyRetry(() => import('./components/workspaces/ScholarshipTrackerWorkspace').then(m => ({ default: m.ScholarshipTrackerWorkspace })));
const GroupProjectWorkspace = lazyRetry(() => import('./components/workspaces/GroupProjectWorkspace').then(m => ({ default: m.GroupProjectWorkspace })));
const PeerQAWorkspace = lazyRetry(() => import('./components/workspaces/PeerQAWorkspace').then(m => ({ default: m.PeerQAWorkspace })));
const NotionImportWorkspace = lazyRetry(() => import('./components/workspaces/NotionImportWorkspace').then(m => ({ default: m.NotionImportWorkspace })));
const DeadlineGanttWorkspace = lazyRetry(() => import('./components/workspaces/DeadlineGanttWorkspace').then(m => ({ default: m.DeadlineGanttWorkspace })));
const AIPlannerWorkspace = lazyRetry(() => import('./components/workspaces/AIPlannerWorkspace').then(m => ({ default: m.AIPlannerWorkspace })));
const GradeForecasterWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.GradeForecasterWorkspace })));
const ExamModeWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.ExamModeWorkspace })));
const InternshipTrackerWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.InternshipTrackerWorkspace })));
const BudgetWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.BudgetWorkspace })));
const HabitSleepWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.HabitSleepWorkspace })));
const TimetableOptimizerWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.TimetableOptimizerWorkspace })));
const CodeRunnerWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.CodeRunnerWorkspace })));
const ResumeBuilderWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.ResumeBuilderWorkspace })));
const PresentationCoachWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.PresentationCoachWorkspace })));
const LabReportWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.LabReportWorkspace })));
const EssayOutlinerWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.EssayOutlinerWorkspace })));
const ImageOcclusionWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.ImageOcclusionWorkspace })));
const FSRSSchedulerInfo = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.FSRSSchedulerInfo })));
const VivaWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.VivaWorkspace })));
const LanguageLabWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.LanguageLabWorkspace })));
const ZoteroImportWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.ZoteroImportWorkspace })));
const PaperChatWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.PaperChatWorkspace })));
const DatasetFinderWorkspace = lazyRetry(() => import('./components/workspaces/NewAppsWorkspaces').then(m => ({ default: m.DatasetFinderWorkspace })));
const StudyRoomPanel = lazyRetry(() => import('./components/collab').then(m => ({ default: m.StudyRoomPanel })));
const TeacherShareView = lazyRetry(() => import('./components/collab').then(m => ({ default: m.TeacherShareView })));
const LectureCopilot = lazyRetry(() => import('./components/collab').then(m => ({ default: m.LectureCopilot })));
const ApiDocsPanel = lazyRetry(() => import('./components/collab').then(m => ({ default: m.ApiDocsPanel })));
const ExtensionHelper = lazyRetry(() => import('./components/collab').then(m => ({ default: m.ExtensionHelper })));
const WikipediaLookupModal = lazyRetry(() => import('./components/WikipediaLookupModal').then(m => ({ default: m.WikipediaLookupModal })));
const StudyCardModal = lazyRetry(() => import('./components/StudyCardModal').then(m => ({ default: m.StudyCardModal })));
const PortfolioExportModal = lazyRetry(() => import('./components/PortfolioExportModal').then(m => ({ default: m.PortfolioExportModal })));
const MorningCheckInModal = lazyRetry(() => import('./components/MorningCheckInModal').then(m => ({ default: m.MorningCheckInModal })));
const OnboardingChecklist = lazyRetry(() => import('./components/OnboardingChecklist').then(m => ({ default: m.OnboardingChecklist })));
const ModelTrainingWorkspace = lazyRetry(() => import('./components/workspaces/ModelTrainingWorkspace').then(m => ({ default: m.ModelTrainingWorkspace })));
const FewShotLabWorkspace = lazyRetry(() => import('./components/workspaces/FewShotLabWorkspace').then(m => ({ default: m.FewShotLabWorkspace })));
const CompetitionDossierWorkspace = lazyRetry(() => import('./components/workspaces/CompetitionDossierWorkspace').then(m => ({ default: m.CompetitionDossierWorkspace })));
const SplitScreenStudio = lazyRetry(() => import('./components/SplitScreenStudio').then(m => ({ default: m.SplitScreenStudio })));
const DailyRadarTab = lazyRetry(() => import('./components/DailyRadarTab').then(m => ({ default: m.DailyRadarTab })));
const GmailRadarTab = lazyRetry(() => import('./components/GmailRadarTab').then(m => ({ default: m.GmailRadarTab })));
const AssignmentTrackerTab = lazyRetry(() => import('./components/AssignmentTrackerTab').then(m => ({ default: m.AssignmentTrackerTab })));
const CanvasSyncTab = lazyRetry(() => import('./components/CanvasSyncTab').then(m => ({ default: m.CanvasSyncTab })));
const GoogleDriveTab = lazyRetry(() => import('./components/GoogleDriveTab').then(m => ({ default: m.GoogleDriveTab })));
const NotebookLMStudioTab = lazyRetry(() => import('./components/NotebookLMStudioTab').then(m => ({ default: m.NotebookLMStudioTab })));
const FlashcardStudioTab = lazyRetry(() => import('./components/FlashcardStudioTab').then(m => ({ default: m.FlashcardStudioTab })));
const CanvaStudioTab = lazyRetry(() => import('./components/CanvaStudioTab').then(m => ({ default: m.CanvaStudioTab })));
const GoogleClassroomPanel = lazyRetry(() => import('./components/GoogleClassroomPanel').then(m => ({ default: m.GoogleClassroomPanel })));
const MoodlePanel = lazyRetry(() => import('./components/MoodlePanel').then(m => ({ default: m.MoodlePanel })));
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
import confetti from 'canvas-confetti';
import { WorkspaceId, AgentAction } from './types';
import { loadSRSDecks, saveSRSDecks, createNewSRSCard, SRSDeck } from './services/srsEngine';
import { usePomodoroStore } from './stores/pomodoroStore';
import { trackEvent } from './services/analytics';
import { db } from './services/db';

import {
  signInWithGoogle,
  signInWithGoogleBasic,
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
  requestOfflineGrant,
  isOfflineGrantSupported,
  hydrateRefreshGrant,
  clearGoogleGrant,
} from './services/googleAuth';
import type { SignInDiagnosis } from './services/firebase';
import {
  fetchTodayCalendarEvents,
  insertCalendarEvent,
  fetchAcademicEmails,
  FetchEmailOptions,
  createGmailDraft,
  getOrCreateMasterSheet,
  fetchSheetAssignments,
  appendAssignmentToSheet,
  updateAssignmentInSheet,
  syncAllAssignmentsToSheet,
  fetchRecentSchoolFiles,
  shareGoogleDriveFile,
} from './services/googleWorkspace';
import { fetchAllClassroomAssignments, fetchRecentClassroomAnnouncements } from './services/googleClassroom';
import {
  loadCanvasSettings,
  saveCanvasSettings,
  hydrateCanvasSettingsForUser,
  setActiveCanvasUid,
  fetchCanvasAssignmentsFromFeed,
  fetchCanvasAssignmentsFromApi,
  crossReferenceCanvasWithSheet,
  submitCanvasAssignment,
  loadCompletedCanvasIds,
  normalizeCanvasDomain,
} from './services/canvas';
import {
  summarizeEmailsWithGemini,
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
    try {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v ? '#252320' : '#F8F6F0');
    } catch {}
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
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkNow ? '#252320' : '#F8F6F0');
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

  // 5-Workspace Student OS Active Workspace
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>(() => {
    try {
      const saved = localStorage.getItem('scc_active_workspace_v1');
      return (saved as WorkspaceId) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const handleWorkspaceTransition = useCallback((newWorkspace: WorkspaceId) => {
    setAiChatOpen(false);
    if (typeof document !== 'undefined' && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setActiveWorkspace(newWorkspace);
      });
    } else {
      setActiveWorkspace(newWorkspace);
    }
    try {
      localStorage.setItem('scc_active_workspace_v1', newWorkspace);
    } catch {}
  }, []);

  // Active Tab - Dashboard Home is default entry point
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [aiSuiteOpen, setAiSuiteOpen] = useState(false);
  const [aiSuiteTab, setAiSuiteTab] = useState<'planner' | 'syllabus' | 'quiz' | 'grades'>('planner');
  const [clearedTabBadges, setClearedTabBadges] = useState<Set<string>>(new Set());
  const [isWikipediaModalOpen, setIsWikipediaModalOpen] = useState(false);
  const [wikipediaInitialQuery, setWikipediaInitialQuery] = useState('');
  const [isStudyCardOpen, setIsStudyCardOpen] = useState(false);
  const [isPortfolioExportOpen, setIsPortfolioExportOpen] = useState(false);
  const [isMorningCheckInOpen, setIsMorningCheckInOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isStudyPlanOpen, setIsStudyPlanOpen] = useState(false);
  const [isIntroTourOpen, setIsIntroTourOpen] = useState(false);
  const [showChangelogDot, setShowChangelogDot] = useState(false);
  const onboardingDialogRef = useRef<HTMLDialogElement | null>(null);

  // Dynamic title for SEO per workspace — MUST be after activeTab declaration to avoid TDZ
  useEffect(() => {
    const labelMap: Record<string,string> = { dashboard:'Dashboard', canvas:'Canvas LMS', radar:'Daily Schedule', tracker:'Assignment Tracker', gmail:'Gmail AI', drive:'Google Drive', splitscreen:'Split Screen' };
    const label = labelMap[activeTab] || activeTab || 'Dashboard';
    document.title = `StudentOS — ${label} | Canvas + Workspace Academic OS`;
  }, [activeTab]);

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
    // streak + confetti on 7-day
    try {
      const raw = localStorage.getItem('scc_streak_history');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (!arr.includes(todayStr)) { arr.push(todayStr); localStorage.setItem('scc_streak_history', JSON.stringify(arr.slice(-30))); }
      if (arr.length % 7 === 0 && arr.length>0 && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#C96442','#10b981','#7C3AED'] });
      }
    } catch {}
    addToast({
      type: 'success',
      title: 'Daily Intention Set',
      message: `Locked in ${targetHours}h deep work target for today.`,
    });
  };

  // Smooth View Transitions for workspace switching — now unified with workspaceStore + recent + usage tracking
  const handleTabTransition = useCallback((newTab: string) => {
    // Legacy mapping: academic workspace no longer exists (now Pinned)
    if (newTab === 'academic') newTab = 'canvas';
    if (newTab === 'ws-academic') newTab = 'canvas';
    if (newTab === 'ai-suite') {
      setAiSuiteTab('planner');
      setAiSuiteOpen(true);
      return;
    }

    setClearedTabBadges((prev) => new Set(prev).add(newTab));
    setAiChatOpen(false);

    // IA: Recent:3 + Most Used tracking for dynamic Top8
    try {
      const recentRaw = localStorage.getItem('scc_recent_tabs_v1');
      const recent: string[] = recentRaw ? JSON.parse(recentRaw) : [];
      const nextRecent = [newTab, ...recent.filter((x:string)=> x!==newTab)].slice(0,10);
      localStorage.setItem('scc_recent_tabs_v1', JSON.stringify(nextRecent));
      const usageRaw = localStorage.getItem('scc_app_usage_v1');
      const usage: Record<string, number> = usageRaw ? JSON.parse(usageRaw) : {};
      usage[newTab] = (usage[newTab]||0)+1;
      localStorage.setItem('scc_app_usage_v1', JSON.stringify(usage));
      // also sync to workspaceStore for single source of truth
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
  const [focusTimerSeconds, setFocusTimerSeconds] = useState<number>(25 * 60);
  const [isFocusTimerRunning, setIsFocusTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    let interval: any;
    if (isFocusTimerRunning && focusTimerSeconds > 0) {
      interval = setInterval(() => {
        setFocusTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isFocusTimerRunning, focusTimerSeconds]);

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
  // Connected = a FRESH access token or a permanent offline grant. A raw
  // (possibly expired) token string alone must NOT count — otherwise the
  // expired state could never surface its one-click Reconnect banner.
  const isGoogleConnected = Boolean(getValidGoogleToken() || hasRefreshToken()) || isDemoMode;

  // API Disabled Info (for Google Cloud Console Enablement)
  const [driveApiInfo, setDriveApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [calendarApiInfo, setCalendarApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [gmailApiInfo, setGmailApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [sheetApiInfo, setSheetApiInfo] = useState<ApiEnablementInfo | null>(null);
  const [apiActivationModalInfo, setApiActivationModalInfo] = useState<ApiEnablementInfo | null>(null);
  const [apiActivationModalOpen, setApiActivationModalOpen] = useState(false);

  // Sync Timestamp & Status
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const isSyncingRef = useRef(false);

  // Master Sheet metadata
  const [masterSheetId, setMasterSheetId] = useState<string | undefined>();
  const [masterSheetUrl, setMasterSheetUrl] = useState<string | undefined>();

  // Loading States
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
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
                title: `Deadline: ${c.name || 'Assignment'} is due soon!`,
                description: `Subject: ${c.courseName || 'Course'} • Due in ${Math.round(diff / 3600000)} hours.`,
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
            title: `Grade Posted: ${c.name || 'Assignment'}`,
            description: `Score details parsed. Click to open and read feedback directly in your Google Doc.`,
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
        title: `Announcement: ${c.name || 'Course Update'}`,
        description: `Course post published in ${c.courseName || 'Canvas'}.`,
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
        title: `Updated File: ${f.name || 'Drive File'}`,
        description: `Modified recently in your Google Drive.`,
        link: f.webViewLink || '#',
        source: 'Google Drive',
      });
    });

    // 3. Activity Tier (Discussion replies) — gated behind isDemoMode
    if (isDemoMode) {
      list.push({
        id: 'activity-discussion-demo',
        tier: 'activity',
        title: '[Demo] Discussion Reply: Peer feedback in AP Chemistry Group',
        description: 'Minh Nguyen replied to your comment on Lab 3 topic.',
        link: '#',
        source: 'Canvas',
      });
    }

    return list;
  }, [canvasAssignments, recentFiles, assignments, isDemoMode]);

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

  // Deep-link ?demo=1 → Enable demo mode; Share target handling
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1') {
        setIsDemoMode(true);
        addToast({ type: 'info', title: 'Demo Mode enabled', message: 'Exploring with sample Canvas + emails + files' });
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
            handleTabTransition('pdf-reader');
            addToast({ type: 'info', title: 'Shared file opened', message: isPdf ? 'PDF opened in Reader' : 'Image shared' });
          }, 500);
        } else {
          const name = title || text.slice(0, 80) || url || 'Shared note';
          const assignmentName = name.slice(0, 120);
          const notes = [text, url].filter(Boolean).join('\n');
          setTimeout(() => {
            setAssignments(prev => [...prev, { id: `share-${Date.now()}`, assignmentName, subject: 'General', dueDate: new Date(Date.now()+86400000*3).toISOString().split('T')[0], priority: 'Med', status: 'Not Started', source: 'Manual', notes }]);
            addToast({ type: 'success', title: 'Shared content saved', message: `Created task from share: "${assignmentName}"` });
          }, 800);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
      // also handle file share via POST (if service worker forwards)
      if (params.get('fileShared') === '1') {
        handleTabTransition('pdf-reader');
      }
    } catch {}
  }, [addToast]);

  // Offline queue retry with exponential backoff via Dexie + navigator.onLine + Background Sync
  useEffect(() => {
    const retryQueue = async () => {
      if (!navigator.onLine) return;
      try {
        const queued = await db.assignmentsQueue.toArray();
        if (!queued.length) return;
        const token = await ensureFreshGoogleToken();
        if (!token || !masterSheetId) return;
        for (const item of queued) {
          try {
            const anyItem: any = item;
            if (anyItem._op === 'update' && anyItem.sheetRowIndex) {
              await updateAssignmentInSheet(token, masterSheetId, anyItem.sheetRowIndex, anyItem);
            } else if (anyItem._op === 'delete' && anyItem.sheetRowIndex) {
              // delete not yet implemented on server — fallback to syncAll
              await syncAllAssignmentsToSheet(token, masterSheetId, assignments);
            } else {
              await appendAssignmentToSheet(token, masterSheetId, item);
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
        const splitConfig = {
          leftTool: action.payload.leftPane,
          rightTool: action.payload.rightPane,
          ratio: action.payload.ratio || '50/50',
          activeFullscreenPane: null,
        };
        try {
          localStorage.setItem('scc_splitscreen_config_v1', JSON.stringify(splitConfig));
        } catch {}
        handleWorkspaceTransition('splitscreen');
        break;
      }

      case 'injectDesmosEquation': {
        handleWorkspaceTransition('stem');
        addToast({
          type: 'success',
          title: 'Equations Injected',
          message: `Desmos ready with ${action.payload.expressions.length} equations plotted!`,
        });
        break;
      }

      case 'createCalendarMilestones': {
        const newEvents: Assignment[] = action.payload.events.map((evt, i) => ({
          id: `milestone-${Date.now()}-${i}`,
          assignmentName: evt.title,
          subject: 'Academic Milestone',
          dueDate: evt.date,
          status: 'Not Started',
          weight: evt.weight || 10,
          source: 'Manual',
          priority: 'High',
          notes: `Scheduled by StudentOS Agent (${evt.type})`,
        }));
        setAssignments((prev) => [...prev, ...newEvents]);
        addToast({
          type: 'success',
          title: 'Milestones Scheduled',
          message: `Created ${newEvents.length} calendar study milestones!`,
        });
        break;
      }

      case 'createSRSDeck': {
        const currentDecks = loadSRSDecks();
        const newDeck: SRSDeck = {
          id: `deck-${Date.now()}`,
          title: action.payload.deckTitle,
          subject: action.payload.subject || 'General',
          createdAt: new Date().toLocaleDateString(),
          updatedAt: new Date().toLocaleDateString(),
          cards: action.payload.cards.map((c) =>
            createNewSRSCard({ front: c.front, back: c.back, tags: c.tags })
          ),
        };
        saveSRSDecks([newDeck, ...currentDecks]);
        handleWorkspaceTransition('retention');
        addToast({
          type: 'success',
          title: 'SRS Deck Created',
          message: `Created "${action.payload.deckTitle}" with ${action.payload.cards.length} cards!`,
        });
        break;
      }

      case 'generateMermaidDiagram': {
        handleWorkspaceTransition('creation');
        addToast({
          type: 'info',
          title: 'Diagram Synthesized',
          message: `Rendered "${action.payload.title}" in Visual Studio!`,
        });
        break;
      }

      // Division A safe previews (student-approved only — never auto-delete/submit/send)
      case 'createStudyFlashcardsPreview': {
        const currentDecks = loadSRSDecks();
        const count = action.payload.count || 5;
        const newDeck: SRSDeck = {
          id: `deck-${Date.now()}`,
          title: `Preview: ${action.payload.topic}`,
          subject: 'General',
          createdAt: new Date().toLocaleDateString(),
          updatedAt: new Date().toLocaleDateString(),
          cards: Array.from({ length: Math.min(8, Math.max(3, count)) }).map((_, i) =>
            createNewSRSCard({ front: `${action.payload.topic} — key idea ${i + 1}`, back: `Explain in your own words (edit me).`, tags: ['agent-preview'] })
          ),
        };
        saveSRSDecks([newDeck, ...currentDecks]);
        handleWorkspaceTransition('retention');
        addToast({
          type: 'success',
          title: 'Flashcard Preview Ready',
          message: `Preview deck for "${action.payload.topic}" — edit before studying!`,
        });
        break;
      }

      case 'draftPresentationOutline': {
        try {
          localStorage.setItem('scc_agent_outline_v1', JSON.stringify({ topic: action.payload.topic, minutes: action.payload.minutes || 5, at: new Date().toISOString() }));
        } catch {}
        handleWorkspaceTransition('creation');
        addToast({
          type: 'info',
          title: 'Outline Drafted',
          message: `A ${action.payload.minutes || 5}-minute outline for "${action.payload.topic}" is ready to edit!`,
        });
        break;
      }
    }
  }, [handleWorkspaceTransition, addToast]);

  // Save assignments locally whenever state changes
  useEffect(() => {
    saveSavedAssignments(assignments);
  }, [assignments]);

  // Show Onboarding Tour dialog on initial visit
  useEffect(() => {
    try {
      const tourSeen = localStorage.getItem('scc_tour_seen');
      if (!tourSeen && onboardingDialogRef.current) {
        const timer = setTimeout(() => {
          onboardingDialogRef.current?.showModal();
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

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
          categoryLabel: 'Lịch thi / Kiểm tra',
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
          categoryLabel: 'Bài tập & Hạn nộp',
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
          categoryLabel: 'Thư rác / Quảng cáo',
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
          categoryLabel: 'Thư rác / Quảng cáo',
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
    }
  }, [isDemoMode, user]);

  // Listen to Auth State + restore this account's connection bundle.
  // Token/Canvas settings live in per-uid vaults: relogin restores them,
  // switching accounts swaps bundles instead of mixing them.
  const authUidRef = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((currentUser) => {
      setUser(currentUser);
      const uid = currentUser?.uid || null;
      const uidChanged = authUidRef.current !== uid;
      authUidRef.current = uid;
      if (uid) {
        setActiveGoogleUid(uid);
        // Swap Canvas to this account's bundle immediately (sync layer).
        if (uidChanged) {
          try {
            setCanvasSettings(hydrateCanvasSettingsForUser(uid));
          } catch {}
        }
        // Restore this account's Google token bundle, then cross-device grant.
        hydrateGoogleTokenForUser(uid).then(async (restored) => {
          const cur = restored ?? getStoredGoogleToken();
          setGoogleToken(cur);
          if (!getValidGoogleToken()) {
            try {
              const has = await hydrateRefreshGrant(uid);
              if (has) {
                const t = await ensureFreshGoogleToken();
                if (t) setGoogleToken(t);
              }
            } catch {}
          }
        }).catch(() => {
          setGoogleToken(getStoredGoogleToken());
        });
      } else {
        setActiveGoogleUid(null);
        setActiveCanvasUid(null);
        setGoogleToken(null);
      }
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

  // Fetch Google Calendar Events (access auto-renews silently via refresh grant)
  const loadCalendarEvents = useCallback(async (isSilent = false, _retried = false) => {
    const token = await ensureFreshGoogleToken();
    if (!token) {
      setCalendarEvents([]);
      setCalendarError(null);
      setCalendarApiInfo(null);
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
      const is401 = err?.status === 401 || /401|expired/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true)) {
          return loadCalendarEvents(isSilent, true);
        }
      }
      if (is401) {
        // Grant revoked or unusable — stop quietly, keep cached events.
        await clearGoogleGrant();
        setGoogleToken(null);
        setCalendarError('Google disconnected. Reconnect to resume Calendar sync — your events are kept.');
      } else {
        if (err?.isServiceDisabled) {
          setCalendarApiInfo({
            serviceName: err.serviceName || 'Google Calendar API',
            serviceId: err.serviceId || 'calendar-json.googleapis.com',
            activationUrl: err.activationUrl,
            projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
          });
        } else {
          setCalendarApiInfo(null);
        }
        setCalendarError(err.message || 'Could not fetch live Calendar events.');
        if (!isSilent) {
          addToast({
            type: 'warning',
            title: err?.isServiceDisabled ? 'Calendar API Disabled' : 'Google Calendar Sync',
            message: err.message || 'Could not fetch live Calendar schedule.',
            actionLabel: err?.activationUrl ? 'Enable in Cloud' : undefined,
            actionUrl: err?.activationUrl,
          });
        }
      }
    } finally {
      if (!isSilent) setIsLoadingEvents(false);
    }
  }, [addToast]);

  // Fetch Academic Emails & Summarize with Gemini (access auto-renews silently)
  const loadEmailsAndAlerts = useCallback(async (isSilent = false, forceResort = false, options?: FetchEmailOptions) => {
    const token = await ensureFreshGoogleToken();
    if (!token) {
      setRawEmails([]);
      setEmailAlerts([]);
      setEmailError(null);
      setGmailApiInfo(null);
      return;
    }

    if (!isSilent) setIsLoadingEmails(true);
    try {
      const emails = await fetchAcademicEmails(token, options);
      setGoogleToken(token);
      setEmailError(null);
      setGmailApiInfo(null);

      // Check if emails match cached emails (same IDs in same order)
      const currentRaw = rawEmailsRef.current;
      const currentAlerts = emailAlertsRef.current;
      const isSameSet =
        !forceResort &&
        currentRaw.length > 0 &&
        currentRaw.length === emails.length &&
        currentRaw.every((re, i) => re.id === emails[i]?.id);

      if (isSameSet && currentAlerts.length > 0) {
        // Cached classification is valid and up to date! Do not re-call Gemini!
        setRawEmails(sanitizeRawEmails(emails));
        return;
      }

      setRawEmails(sanitizeRawEmails(emails));
      saveRawEmails(sanitizeRawEmails(emails));

      if (emails.length > 0) {
        let alerts: EmailAlert[] = [];
        try {
          alerts = await summarizeEmailsWithGemini(emails);
        } catch (geminiErr) {
          console.warn('Gemini email summarizer unavailable, using Gmail-native classification:', geminiErr);
          // Offline: Gmail labels only — no content keywords.
          alerts = emails.map((msg, idx) => {
            const labels = (msg as any).labelIds || [];
            const isPromo = labels.includes('SPAM') || labels.includes('CATEGORY_PROMOTIONS');
            const isSocial = !isPromo && labels.includes('CATEGORY_SOCIAL');
            const summary = msg.snippet ? (msg.snippet.slice(0, 160) + (msg.snippet.length > 160 ? '...' : '')) : msg.subject;

            return {
              id: `alert-${msg.id || idx}`,
              sender: msg.sender,
              subject: msg.subject,
              oneLineSummary: summary,
              urgency: isPromo || isSocial ? 'INFO' as const : 'MEDIUM' as const,
              category: isPromo ? 'PROMOTION' as const : isSocial ? 'SOCIAL' as const : 'GENERAL' as const,
              isSpam: isPromo,
              spamReason: isPromo ? 'Sorted by Gmail' : '',
              gmailLabels: labels,
              detectedAssignment: undefined,
              rawEmail: msg,
              aiStatus: 'failed' as const,
              needsReview: !isPromo,
              reviewReason: 'ai_failed',
            };
          });
        }
        setEmailAlerts(sanitizeEmailAlerts(alerts));
        saveEmailAlerts(sanitizeEmailAlerts(alerts));
      } else {
        setEmailAlerts([]);
        try {
          localStorage.removeItem(LOCAL_EMAIL_ALERTS_KEY);
        } catch {}
      }
    } catch (err: any) {
      console.error('Email fetch error:', err);
      if (err?.isServiceDisabled) {
        setGmailApiInfo({
          serviceName: err.serviceName || 'Gmail API',
          serviceId: err.serviceId || 'gmail.googleapis.com',
          activationUrl: err.activationUrl,
          projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
        });
      } else {
        setGmailApiInfo(null);
      }
      setEmailError(err.message || 'Could not scan live Gmail inbox.');
      if (!isSilent) {
        addToast({
          type: 'warning',
          title: err?.isServiceDisabled ? 'Gmail API Disabled' : 'Gmail Scanner',
          message: err.message || 'Could not scan live Gmail inbox.',
          actionLabel: err?.activationUrl ? 'Enable in Cloud' : undefined,
          actionUrl: err?.activationUrl,
        });
      }
    } finally {
      if (!isSilent) setIsLoadingEmails(false);
    }
  }, [addToast]);

  // Fetch Master Sheet Assignments (access auto-renews silently)
  const loadSheetAssignments = useCallback(async (isSilent = false, _retried = false) => {
    const token = await ensureFreshGoogleToken();
    if (!token) {
      setSheetError(null);
      setSheetApiInfo(null);
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
        if (conflictCount>0) setTimeout(()=> addToast({ type: 'warning', title: 'Resolve conflict', message: `${conflictCount} assignments had concurrent edits — last write wins. Review Tracker.` }), 500);
      } else if (items && items.length === 0) {
        // sheet empty -> do NOT overwrite existing manual tasks
        console.warn('Sheet empty, preserving local assignments');
      }
      setSheetError(null);
      setSheetApiInfo(null);
      setGoogleToken(token);
    } catch (err: any) {
      console.error('Sheet fetch error:', err);
      const is401 = err?.status === 401 || /401|expired/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true)) {
          return loadSheetAssignments(isSilent, true);
        }
      }
      if (is401) {
        // Grant revoked or unusable — stop quietly, keep cached tasks.
        await clearGoogleGrant();
        setGoogleToken(null);
        setSheetError('Google disconnected. Reconnect to resume Sheet sync — your tasks are kept.');
      } else {
        if (err?.isServiceDisabled) {
          setSheetApiInfo({
            serviceName: err.serviceName || 'Google Sheets API',
            serviceId: err.serviceId || 'sheets.googleapis.com',
            activationUrl: err.activationUrl,
            projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
          });
        } else {
          setSheetApiInfo(null);
        }
        setSheetError(err.message || 'Could not sync Master Sheet.');
        if (!isSilent) {
          addToast({
            type: 'warning',
            title: err?.isServiceDisabled ? 'Google Sheets API Disabled' : 'Google Sheet Sync',
            message: err.message || 'Could not sync Master Google Sheet.',
            actionLabel: err?.activationUrl ? 'Enable in Cloud' : undefined,
            actionUrl: err?.activationUrl,
          });
        }
      }
    } finally {
      if (!isSilent) setIsLoadingAssignments(false);
    }
  }, [addToast]);

  // Fetch Recent Files (access auto-renews silently)
  const loadRecentFiles = useCallback(async (isSilent = false, _retried = false) => {
    const token = await ensureFreshGoogleToken();
    if (!token) {
      setRecentFiles([]);
      setDriveError(null);
      setDriveApiInfo(null);
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
      const is401 = err?.status === 401 || /401|expired/i.test(err?.message || '');
      if (is401 && !_retried) {
        // One transparent renewal + retry — the user never sees expiry.
        if (await refreshGoogleAccessToken(true)) {
          return loadRecentFiles(isSilent, true);
        }
      }
      if (is401) {
        // Grant revoked or unusable — stop quietly, keep cached files.
        await clearGoogleGrant();
        setGoogleToken(null);
        setDriveError('Google disconnected. Reconnect to resume Drive sync — your files list is kept.');
      } else {
        const errMsg = err?.message || 'Could not fetch Google Drive files.';
        if (err?.isServiceDisabled) {
          setDriveApiInfo({
            serviceName: err.serviceName || 'Google Drive API',
            serviceId: err.serviceId || 'drive.googleapis.com',
            activationUrl: err.activationUrl,
            projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
          });
        } else {
          setDriveApiInfo(null);
        }
        setDriveError(errMsg);
        if (!isSilent) {
          addToast({
            type: 'warning',
            title: err?.isServiceDisabled ? 'Google Drive API Disabled' : 'Google Drive Sync Failed',
            message: errMsg,
            actionLabel: err?.activationUrl ? 'Enable in Cloud' : undefined,
            actionUrl: err?.activationUrl,
          });
        }
      }
    } finally {
      if (!isSilent) setIsLoadingFiles(false);
    }
  }, [addToast]);

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

  // Fetch Google Classroom coursework (access auto-renews silently)
  const loadClassroomData = useCallback(async (isSilent = false) => {
    const token = await ensureFreshGoogleToken();
    if (!token) {
      setClassroomError(null);
      return;
    }

    if (!isSilent) setIsLoadingClassroom(true);
    try {
      const list = await fetchAllClassroomAssignments(token);
      setClassroomAssignments(list);
      setClassroomError(null);
      setGoogleToken(token);
      void loadClassroomAnnouncements(token);
      try {
        localStorage.setItem('scc_cached_classroom_assignments', JSON.stringify(list));
      } catch {}
    } catch (err: any) {
      console.error('Classroom fetch error:', err);
      const errMsg = err?.message || 'Could not fetch Google Classroom coursework.';
      setClassroomError(errMsg);
      if (!isSilent) {
        addToast({
          type: 'warning',
          title: 'Google Classroom Sync',
          message: errMsg,
        });
      }
    } finally {
      if (!isSilent) setIsLoadingClassroom(false);
    }
  }, [addToast]);

  // Fetch Canvas assignments (Zero fake data)
  // NOTE: accepts an optional settings override so Save & Sync in CanvasSyncTab
  // can fetch with freshly-typed credentials immediately. Without this, the
  // callback closes over the *previous* canvasSettings state, sees empty
  // credentials, hits the early-return below, clears the list and shows no
  // error — the silent "load none, no red flag" bug.
  const loadCanvasData = useCallback(async (isSilent = false, settingsOverride?: CanvasSettings) => {
    const effectiveSettings = settingsOverride ?? canvasSettings;
    const feedUrl = effectiveSettings.calendarFeedUrl?.trim() || '';
    const apiToken = effectiveSettings.apiToken?.trim() || '';
    const apiDomain = effectiveSettings.apiDomain?.trim()
      ? normalizeCanvasDomain(effectiveSettings.apiDomain)
      : '';
    const isApiConfigured = Boolean(apiToken && apiDomain);
    if (!feedUrl && !isApiConfigured) {
      setCanvasAssignments([]);
      // If user saved a custom URL but no token yet, explain what's missing
      // instead of silently showing an empty tab.
      if (effectiveSettings.apiDomain?.trim() && !apiToken && !feedUrl) {
        setCanvasError(
          'Canvas URL saved, but no API token yet — open Settings and add your token (Canvas → Account → Settings → New Access Token), or paste a Calendar Feed URL.'
        );
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
          apiError = { message: e?.message || 'Canvas API request failed.', kind: (e as any)?.kind, code: (e as any)?.code };
        }
      }

      // 2. Fetch via Calendar Feed if configured
      if (feedUrl) {
        try {
          feedFetched = await fetchCanvasAssignmentsFromFeed(feedUrl);
        } catch (e: any) {
          console.warn('Canvas Calendar Feed query error:', e);
          feedError = { message: e?.message || 'Canvas feed request failed.', kind: (e as any)?.kind, code: (e as any)?.code };
        }
      }

      // 3. Intelligent Union Merge so all courses (KHTN, Ngữ Văn, etc.) are captured.
      // Malformed items are normalized, never allowed to throw and wipe the whole sync.
      // Keyed by name + course + due date so same-named work across courses never collapses.
      const mergedMap = new Map<string, CanvasAssignment>();
      const mergeKey = (item: any): string =>
        [item?.name ?? item?.title ?? 'Canvas Assignment', item?.courseName ?? item?.course ?? '', item?.dueAt ?? item?.dueDate ?? '']
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

      const crossRef = crossReferenceCanvasWithSheet(fetched, assignments);
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
              errMsg = 'Canvas rejected the API token (401). Regenerate a token at Canvas → Account → Settings → New Access Token, save it here, then retry.';
              break;
            case 'host': {
              // Allowlist blocks carry code + detail from the service: the token
              // is fine, the deployment refuses the host — name that exact fix.
              const blockedByAllowlist =
                apiError.code === 'host-not-allowlisted' || /allowlist/i.test(apiError.message || '');
              errMsg = blockedByAllowlist
                ? `Canvas sync is blocked: ${cleanTail(apiError.message || '')}. Your token is fine — the app server refuses this Canvas host. Fix: redeploy with your host added to CANVAS_ALLOWED_HOSTS, then retry.`
                : `Canvas host did not answer (${apiError.message}). Check the URL is exactly your school host, then retry.`;
              break;
            }
            case 'network':
              errMsg = 'Could not reach Canvas — network error or timed out after 20s. Check your connection, then retry.';
              break;
            case 'backend':
              errMsg = `Canvas sync is blocked: ${apiError.message}. This is a deployment issue, not your token — the app's /api functions are not serving JSON. Redeploy the latest main, then retry.`;
              break;
            default: {
              const reason = cleanTail(apiError.message || '');
              errMsg = hasHint(reason)
                ? `Canvas sync failed: ${reason}.`
                : `Canvas sync failed: ${reason}. Check your Canvas URL and token, then retry.`;
              break;
            }
          }
        } else {
          if (feedError?.kind === 'backend') {
            errMsg = `Canvas sync is blocked: ${feedError.message}. This is a deployment issue, not your feed URL — the app's /api functions are not serving JSON. Redeploy the latest main, then retry.`;
          } else {
            const combined = cleanTail([apiError?.message, feedError?.message].filter(Boolean).join(' ').trim());
            errMsg = hasHint(combined)
              ? `Canvas sync failed: ${combined}.`
              : `Canvas sync failed: ${combined}. Check your Canvas URL and token, then retry.`;
          }
        }
        setCanvasError(errMsg);
        return;
      }
      // Configured but zero assignments and zero errors (e.g. all sources quietly
      // empty): say so explicitly instead of a misleading "all caught up".
      if (fetched.length === 0 && (isApiConfigured || feedUrl)) {
        setCanvasError(
          'Connected, but Canvas returned 0 assignments. If you expect coursework here, re-copy your Calendar Feed link (Canvas → Calendar → Calendar Feed) or regenerate your API token (Canvas → Account → Settings → New Access Token), save, and sync again.'
        );
        return;
      }
      setCanvasAssignments(crossRef);
      try { localStorage.setItem('scc_cached_canvas_assignments', JSON.stringify(crossRef)); } catch {}
      setCanvasError(null);
      setLastSyncedAt(new Date());

      // Auto-Sync Canvas Completion to Master Sheet Tracker
      const token = await ensureFreshGoogleToken();
      let updatedSheetCount = 0;

      const updatedAssignments = assignments.map((sheetItem) => {
        const sName = String(sheetItem?.assignmentName ?? '').toLowerCase().trim();
        const sSub = String(sheetItem?.subject ?? '').toLowerCase().trim();

        const matchingCanvas = crossRef.find((c) => {
          const cName = String(c?.name ?? '').toLowerCase().trim();
          const cCourse = String(c?.courseName ?? '').toLowerCase().trim();

          const exactName = sName === cName;
          const substringMatch =
            (sName.length >= 3 && cName.includes(sName)) ||
            (cName.length >= 3 && sName.includes(cName));
          const courseMatch =
            (sSub.length >= 2 && cCourse.includes(sSub)) ||
            (cCourse.length >= 2 && sSub.includes(cCourse));

          return exactName || (substringMatch && (courseMatch || !sSub || sSub === 'general'));
        });

        if (matchingCanvas && matchingCanvas.isCompleted && sheetItem.status !== 'Done') {
          updatedSheetCount++;
          const doneItem = { ...sheetItem, status: 'Done' as const };
          if (token && masterSheetId && sheetItem.sheetRowIndex) {
            updateAssignmentInSheet(token, masterSheetId, doneItem).catch((e) =>
              console.warn('Auto-sync status to sheet error:', e)
            );
          }
          return doneItem;
        }
        return sheetItem;
      });

      if (updatedSheetCount > 0) {
        setAssignments(updatedAssignments);
      }

      if (!isSilent) {
        addToast({
          type: 'success',
          title: 'Canvas LMS Synced Live',
          message: `Loaded ${crossRef.length} real assignments from your Canvas feed.${
            updatedSheetCount > 0 ? ` Marked ${updatedSheetCount} completed tasks as Done in Tracker.` : ''
          }`,
        });
      }
    } catch (err: any) {
      console.error('Canvas load error:', err);
      const errMsg = err.message || 'Failed to fetch Canvas feed. Please verify the URL.';
      setCanvasError(errMsg);
      // Keep previously loaded assignments so the tab never goes blank on a transient failure.
      // Banner-only (no duplicate toast) per single-channel error policy.
    } finally {
      if (!isSilent) setIsLoadingCanvas(false);
    }
  }, [canvasSettings, assignments, addToast]);

  // Comprehensive Auto-Sync Routine — debounced + AbortController + isSyncing guard
  const syncAbortRef = useRef<AbortController | null>(null);
  const runFullSync = useCallback(
    async (isSilent = true, externalSignal?: AbortSignal) => {
      if (isSyncingRef.current) return;
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
        setUser(resumed.user);
        setIsDemoMode(false);
        setOauthGuideModalOpen(false);
        if (resumed.accessToken) {
          setGoogleToken(resumed.accessToken);
          await runFullSync(false);
          addToast({
            type: 'success',
            title: 'Google Workspace Connected',
            message: `Signed in as ${resumed.user.displayName || resumed.user.email || 'User'}. Live Workspace data active.`,
          });
        } else {
          addToast({
            type: 'info',
            title: 'Signed in with Google',
            message: `Signed in as ${resumed.user.displayName || resumed.user.email || 'User'}.`,
          });
        }
      } catch {}
    })();
  }, [runFullSync, addToast]);

  // Manual Refresh All Data Button
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    try {
      // cancel any pending debounced sync and force immediate
      syncAbortRef.current?.abort();
      await runFullSync(false);
      addToast({
        type: 'info',
        title: 'All Channels Synced',
        message: 'Canvas LMS and Google Workspace data updated.',
      });
    } finally {
      setIsRefreshingAll(false);
    }
  }, [runFullSync, addToast]);

  // 1. Auto-Sync on App Startup and when User Auth resolves or changes
  useEffect(() => {
    runFullSync(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 1b. Real-Time Auto-Sync on Google Token Acquisition or Refresh
  useEffect(() => {
    const handleTokenUpdated = (e: any) => {
      const updated = e.detail?.token ?? getStoredGoogleToken();
      setGoogleToken(updated);
      if (updated) {
        runFullSync(false);
      }
    };
    window.addEventListener('scc-google-token-updated', handleTokenUpdated);
    return () => window.removeEventListener('scc-google-token-updated', handleTokenUpdated);
  }, [runFullSync]);

  // 2. Real-Time Background Auto-Sync (every 60s, debounced)
  useEffect(() => {
    const interval = setInterval(() => debouncedSync(), 60000);
    return () => clearInterval(interval);
  }, [debouncedSync]);

  // 3. Real-Time Auto-Sync on Tab Focus / Document Visibility Change — debounced to prevent 4x firestorm
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') debouncedSync();
    };
    const handleWindowFocus = () => debouncedSync();
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
        title: context === 'gmail' ? 'Gmail Connection Failed' : 'Sign In Failed',
        message: `${diagnosis.detail} ${diagnosis.fix}`,
      });
    }
  }, [addToast]);

  // Popup-hostile browsers: full-page redirect to Google and back (no popup needed)
  const handleRedirectSignIn = useCallback(async (requestWorkspace = true) => {
    setIsLoggingIn(true);
    try {
      addToast({ type: 'info', title: 'Redirecting to Google…', message: 'Grant access and you will come right back to the app.' });
      await signInWithRedirectFlow({ requestWorkspace });
    } catch (err: any) {
      handleSignInFailure(err, 'workspace');
    } finally {
      setIsLoggingIn(false);
    }
  }, [addToast, handleSignInFailure]);

  const handleGoogleSignIn = async (requestWorkspace = true) => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogle({ requestWorkspace });
      if (!result) {
        // User closed or dismissed the popup - clean exit
        if (requestWorkspace) {
          addToast({
            type: 'info',
            title: 'Sign-In Cancelled',
            message: 'If Google displayed "Access blocked", your account must be in Test Users in Google Cloud Console, or use Basic Sign-In.',
            duration: 6000,
          });
        }
        return;
      }
      setUser(result.user);
      setIsDemoMode(false);
      setOauthGuideModalOpen(false);
      setOauthDiagnosis(null);
      // Fresh sign-in: clear stale sync errors so reconnect visibly heals every tab
      setCalendarError(null);
      setEmailError(null);
      setSheetError(null);
      setDriveError(null);
      setCanvasError(null);
      setClassroomError(null);

      if (result.accessToken) {
        setGoogleToken(result.accessToken);
        // One-time upgrade: trade the 1-hour popup token for a permanent
        // offline grant (silent refresh forever). Dismiss = keep hourly token.
        let permanent = false;
        try {
          if (isOfflineGrantSupported()) {
            const offlineToken = await requestOfflineGrant();
            if (offlineToken) {
              setGoogleToken(offlineToken);
              permanent = true;
              try { await hydrateRefreshGrant(result.user?.uid); } catch {}
            }
          }
        } catch (grantErr) {
          console.warn('Offline grant unavailable, keeping hourly token:', grantErr);
        }
        await runFullSync(false);
        addToast({
          type: 'success',
          title: 'Google Workspace Connected',
          message: permanent
            ? `Signed in as ${result.user.displayName || result.user.email || 'User'}. Permanent sync enabled — no more hourly reconnects.`
            : `Signed in as ${result.user.displayName || result.user.email || 'User'}. Live Workspace data active.`,
        });
      } else {
        addToast({
          type: 'info',
          title: 'Signed in with Google',
          message: `Signed in as ${result.user.displayName || result.user.email || 'User'}. Connect Google Workspace inside to sync Calendar & Drive.`,
          duration: 6000,
        });
      }
    } catch (err: any) {
      handleSignInFailure(err, 'workspace');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogle({ requestWorkspace: true, includeGmail: true });
      if (result?.accessToken) {
        setGoogleToken(result.accessToken);
        let permanent = false;
        try {
          if (isOfflineGrantSupported()) {
            const offlineToken = await requestOfflineGrant({ gmail: true });
            if (offlineToken) {
              setGoogleToken(offlineToken);
              permanent = true;
            }
          }
        } catch (grantErr) {
          console.warn('Offline grant unavailable, keeping hourly token:', grantErr);
        }
        await loadEmailsAndAlerts(false);
        addToast({
          type: 'success',
          title: 'Gmail Academic Connected',
          message: permanent
            ? 'Academic email scanning is now active — permanently, no hourly reconnects.'
            : 'Academic email scanning is now active.',
        });
      }
    } catch (err: any) {
      handleSignInFailure(err, 'gmail');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBasicSignIn = async () => {
    await handleGoogleSignIn(false);
  };

  const handleDisconnectGoogle = useCallback(async () => {
    // Explicit disconnect: forget THIS account's grant + token vault entirely.
    // (Unlike logout, the next sign-in starts blank for this account.)
    await clearGoogleGrant(user?.uid || null);
    setGoogleToken(null);
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
      title: 'Google Workspace Disconnected',
      message: 'Google Workspace token cleared. You can reconnect anytime.',
    });
  }, [addToast, user?.uid]);

  // Logout Handler — sign out but KEEP this account's connection bundle
  // (Canvas settings + Google token vault + offline grant). The next login
  // with the same account restores everything instantly, no re-connect needed.
  const handleLogout = async () => {
    setConfirmationModal({
      isOpen: true,
      title: 'Sign out?',
      description:
        'This signs you out. Your Canvas connection and Google Workspace grant stay saved for this account, so signing back in restores everything instantly. Use Disconnect inside the Google tabs to fully forget an account.',
      isDestructive: false,
      confirmLabel: 'Sign out',
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
          title: 'Signed out',
          message: 'Connections stay saved for this account — sign back in to restore instantly.',
        });
      },
    });
  };

  // Add Assignment
  const handleAddAssignment = async (newAssign: Omit<Assignment, 'id'>) => {
    const token = await ensureFreshGoogleToken();
    const tempId = `assign-${Date.now()}`;
    const fullAssign: Assignment = { ...newAssign, id: tempId };

    if (token && masterSheetId) {
      try {
        const added = await appendAssignmentToSheet(token, masterSheetId, fullAssign);
        setAssignments((prev) => [...prev, added]);
        addToast({
          type: 'success',
          title: 'Saved to Master Sheet',
          message: `Added "${fullAssign.assignmentName}" to Google Sheets.`,
          actionLabel: 'Open Sheet',
          actionUrl: masterSheetUrl,
        });
      } catch (err: any) {
        console.error('Error appending to sheet:', err);
        setAssignments((prev) => [...prev, fullAssign]);
        addToast({
          type: 'warning',
          title: 'Saved Locally',
          message: 'Could not append to Google Sheet. Saved locally in tracker.',
        });
      }
    } else {
      setAssignments((prev) => [...prev, fullAssign]);
      addToast({
        type: 'success',
        title: 'Assignment Added',
        message: `Added "${fullAssign.assignmentName}" to Master Tracker.`,
      });
    }
  };

  // Update Status
  const handleUpdateStatus = async (assignment: Assignment, newStatus: AssignmentStatus) => {
    const updated = { ...assignment, status: newStatus };
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? updated : a)));

    const token = await ensureFreshGoogleToken();
    if (token && masterSheetId && assignment.sheetRowIndex) {
      try {
        await updateAssignmentInSheet(token, masterSheetId, updated);
        addToast({
          type: 'info',
          title: 'Status Updated in Sheet',
          message: `Marked "${assignment.assignmentName}" as ${newStatus}.`,
        });
      } catch (err) {
        console.error('Error updating status in sheet:', err);
      }
    } else {
      addToast({
        type: 'info',
        title: 'Status Updated',
        message: `Marked "${assignment.assignmentName}" as ${newStatus}.`,
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
    const token = await ensureFreshGoogleToken();

    if (token && masterSheetId) {
      try {
        const synced = await syncAllAssignmentsToSheet(token, masterSheetId, activeOnly);
        setAssignments(synced);
        addToast({
          type: 'success',
          title: 'Completed Tasks Cleared',
          message: 'Cleaned finished assignments from your Master Google Sheet.',
        });
      } catch (err: any) {
        console.error('Error clearing completed from sheet:', err);
        setAssignments(activeOnly);
        addToast({
          type: 'info',
          title: 'Cleared Locally',
          message: 'Removed finished tasks from local view.',
        });
      }
    } else {
      setAssignments(activeOnly);
      addToast({
        type: 'success',
        title: 'Completed Tasks Cleared',
        message: 'Removed finished tasks from Master Tracker.',
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
    const edited = result.assignmentName !== d.assignmentName || result.subject !== (d.subject || 'General') || result.dueDate !== d.dueDate || result.priority !== d.priority;
    logPilot(dueStatus === 'missing' ? 'ai_no_date' : dueStatus === 'unconfirmed' ? 'ai_later' : edited ? 'ai_edited' : 'ai_confirmed');
    setAiDraft(null);
  };

  // Student tapped "Hạn chưa xác nhận" in the tracker → the date is now theirs.
  const handleConfirmDue = async (target: Assignment) => {
    const next = assignments.map((a) => (a.id === target.id ? { ...a, dueStatus: 'confirmed' as const, updatedAt: new Date().toISOString() } : a));
    setAssignments(next);
    logPilot('due_confirmed');
    addToast({ type: 'success', title: 'Đã xác nhận hạn nộp', message: `${target.assignmentName} · ${target.dueDate}` });
    try {
      const token = await ensureFreshGoogleToken();
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
    addToast({ type: 'info', title: 'Đã ghi nhận', message: 'Không lưu — thư vẫn còn trong hộp thư nếu bạn cần xem lại.' });
  };

  // Schedule Study Block in Google Calendar
  const handleScheduleStudyBlock = async (eventData: {
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
  }) => {
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
          title: 'Study Block Scheduled in Google Calendar!',
          message: `Added focus session: "${eventData.title}"`,
          actionLabel: 'Open Calendar',
          actionUrl: createdEvent.htmlLink || 'https://calendar.google.com',
        });
      } else {
        addToast({
          type: 'warning',
          title: 'Connect Google Account',
          message: 'Sign in to Google Calendar to schedule live calendar events.',
        });
      }
    } catch (err: any) {
      console.error('Error adding study block:', err);
      if (err?.isServiceDisabled) {
        setApiActivationModalInfo({
          serviceName: err.serviceName || 'Google Calendar API',
          serviceId: err.serviceId || 'calendar-json.googleapis.com',
          activationUrl: err.activationUrl,
          projectId: err.projectId || (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID || '',
        });
        setApiActivationModalOpen(true);
      }
      addToast({
        type: 'error',
        title: err?.isServiceDisabled ? 'Calendar API Disabled' : 'Scheduling Failed',
        message: err.message || 'Could not insert event into Google Calendar.',
        actionLabel: err?.activationUrl ? 'Enable in Cloud' : undefined,
        actionUrl: err?.activationUrl,
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
        title: 'Đã mở Gmail',
        message: `Thư gửi ${to || 'thầy cô'} đã điền sẵn — kiểm tra rồi bấm Gửi trong Gmail.`,
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

  // Sync single Canvas assignment to Google Sheet
  const handleSyncCanvasToSheet = async (canvasItem: CanvasAssignment) => {
    await handleAddAssignment({
      assignmentName: canvasItem.name,
      subject: canvasItem.courseName,
      dueDate: canvasItem.dueAt,
      priority: canvasItem.pointsPossible && canvasItem.pointsPossible >= 50 ? 'High' : 'Med',
      status: 'Not Started',
      source: 'Canvas',
      notes: canvasItem.description || `Canvas Assignment (${canvasItem.pointsPossible || 0} pts)`,
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
      title: 'Canvas Batch Sync Complete',
      message: `Added ${pending.length} pending Canvas tasks to your Master Google Sheet!`,
      actionLabel: masterSheetUrl ? 'Open Sheet' : undefined,
      actionUrl: masterSheetUrl,
    });
  };

  // Google Drive & Canvas direct submission workflow
  // Public link sharing only after the student agrees (it used to happen silently).
  const handleSubmitAssignment = async (assignment: CanvasAssignment, fileId: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Chia sẻ bài cho thầy cô?',
      description:
        'Để thầy cô mở được bài trên Canvas, file sẽ được đặt "Ai có đường liên kết đều xem được". Bạn có thể tắt lại trong Google Drive bất cứ lúc nào. Không đồng ý thì hãy tự chia sẻ file với email của thầy cô.',
      confirmLabel: 'Đồng ý & nộp bài',
      isDestructive: false,
      onConfirm: async () => {
        await submitAssignmentWithShare(assignment, fileId);
      },
    });
  };

  const submitAssignmentWithShare = async (assignment: CanvasAssignment, fileId: string) => {
    const token = await ensureFreshGoogleToken();
    if (!token && !isDemoMode) {
      addToast({
        type: 'error',
        title: 'Google Connection Required',
        message: 'Please connect your Google Account to submit files from Google Drive.',
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
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.65 },
          colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'],
        });
      }

      addToast({
        type: 'success',
        title: 'Assignment Submitted!',
        message: `Successfully shared and submitted "${assignment.name}" to Canvas.`,
      });
    } catch (err: any) {
      console.error('Canvas submit workflow error:', err);
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Failed to complete Canvas submission.',
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
      else if (e.key === '6') handleTabTransition('splitscreen');
      else if ((e.key === 'r' || e.key === 'R') && shortcutSettings.keys.sync) handleRefreshAll();
      else if (e.key === '?' && shortcutSettings.keys.help) setAccountSettingsOpen(true);
      else if (e.key === 'Escape') { if (zenFocusMode) setZenFocusMode(false); setAccountSettingsOpen(false); setAiChatOpen(false); setCommandPaletteOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefreshAll, shortcutSettings, handleWorkspaceTransition, zenFocusMode]);

  if (!user && !isDemoMode) {
    return (
      <>
        <LandingPage
          onSignIn={() => handleGoogleSignIn(false)}
          onSignInWorkspace={() => handleGoogleSignIn(true)}
          onExploreDemo={() => setIsDemoMode(true)}
          isLoggingIn={isLoggingIn}
          darkMode={darkMode}
          setDarkMode={applyDarkMode}
        />
        {oauthGuideModalOpen && (
        <OAuthGuideModal
          isOpen={oauthGuideModalOpen}
          onClose={() => { setOauthGuideModalOpen(false); setOauthDiagnosis(null); }}
          onRetryWorkspaceSignIn={() => handleGoogleSignIn(true)}
          onBasicSignIn={() => handleGoogleSignIn(false)}
          isLoggingIn={isLoggingIn}
          projectId="studentcommandcenter-39cdc"
          userEmail="buianhuy2009@gmail.com"
          diagnosis={oauthDiagnosis}
          onRunDiagnostics={diagnoseSignInEnvironment}
          onRedirectSignIn={() => handleRedirectSignIn(true)}
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
              try { await clearGoogleGrant(user?.uid || null); } catch {}
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
            if (t?.reconnectGoogle) handleGoogleSignIn(true);
          }}
        />
      </>
    );
  }

  // reducedMotion already handled via CSS prefers-reduced-motion + index.css; MotionConfig not required (motion 12 export issue avoided)
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#F8F6F0] dark:bg-[#252320] text-[#2B2621] dark:text-[#F5F4ED] transition-colors duration-300 ease-[cubic-bezier(.22,1,.36,1)] flex flex-col font-sans selection:bg-[#E05D38] selection:text-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white dark:focus:bg-[#1A1917] focus:border focus:rounded-xl">Skip to content</a>
      {/* Demo Mode Top Alert */}
      {!user && isDemoMode && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs z-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            <span>You are viewing in <strong>Live Demo Mode</strong>. Connect Google to sync live Canvas & Google Workspace.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGoogleSignIn(false)}
              disabled={isLoggingIn}
              className="px-3 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Sign In with Google
            </button>
            <button
              onClick={() => setIsDemoMode(false)}
              className="px-2 py-1 text-indigo-100 hover:text-white text-xs cursor-pointer"
            >
              Exit Demo
            </button>
          </div>
        </div>
      )}
      {/* Left Navigation Rail (Desktop + Mobile drawer) */}
      <div className="flex-1 flex overflow-hidden h-full">
        {/* Mobile hamburger — visible only <768px */}
        {!zenFocusMode && activeTab !== 'dashboard' && (
          <button onClick={()=>setMobileNavOpen(v=>!v)} className="md:hidden fixed top-2 left-2 z-40 p-2 rounded-xl bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] shadow-md" aria-label="Toggle navigation" aria-expanded={mobileNavOpen}>
            <span className="text-sm font-bold">☰</span>
          </button>
        )}
        {/* Desktop sidebar */}
        {!zenFocusMode && activeTab !== 'dashboard' && (
          <div className="hidden md:flex shrink-0">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(t)=>{ handleTabTransition(t); setMobileNavOpen(false); }}
              isExpanded={isSidebarExpanded}
              onToggleExpand={toggleSidebar}
              user={user}
              onSignIn={() => handleGoogleSignIn(false)}
              onSignOut={handleLogout}
              onOpenSettings={() => setAccountSettingsOpen(true)}
              onOpenAppStore={() => setAppStoreOpen(true)}
              onOpenShortcuts={() => setShortcutsModalOpen(true)}
              onToggleDarkMode={toggleDarkMode}
              darkMode={darkMode}
              pinnedAppIds={pinnedAppIds}
              onUnpinApp={handleUnpinApp}
              badges={{
                canvas: clearedTabBadges.has('canvas') ? 0 : canvasUnfinishedCount,
                schedule: clearedTabBadges.has('radar') ? 0 : calendarEvents.length,
                tracker: clearedTabBadges.has('tracker') ? 0 : pendingAssignmentCount,
                gmail: clearedTabBadges.has('gmail') ? 0 : urgentEmailCount,
                flashcards: clearedTabBadges.has('flashcards') ? 0 : flashcardDueCount,
                pomodoro: 0,
              }}
            />
          </div>
        )}
        {/* Mobile drawer overlay with swipe to close + Esc */}
        {mobileNavOpen && !zenFocusMode && activeTab !== 'dashboard' && (
          <div className="md:hidden fixed inset-0 z-30 flex" onTouchStart={(e)=>{ (e.currentTarget as any)._sx = e.touches[0].clientX; }} onTouchEnd={(e)=>{ const sx=(e.currentTarget as any)._sx||0; const dx=e.changedTouches[0].clientX - sx; if(dx < -60 || dx > 60) setMobileNavOpen(false); }} onKeyDown={(e)=>{ if(e.key==='Escape') setMobileNavOpen(false); }}>
            <div className="w-64 shrink-0 bg-[#F5F4ED] dark:bg-[#1A1917] border-r border-[#E8E6DC] dark:border-[#2C2B27] overflow-y-auto">
              <Sidebar
                activeTab={activeTab}
                onSelectTab={(t)=>{ handleTabTransition(t); setMobileNavOpen(false); }}
                isExpanded={true}
                onToggleExpand={()=>setMobileNavOpen(false)}
                user={user}
                onSignIn={() => handleGoogleSignIn(false)}
                onSignOut={handleLogout}
                onOpenSettings={() => setAccountSettingsOpen(true)}
                onOpenAppStore={() => setAppStoreOpen(true)}
                onOpenShortcuts={() => setShortcutsModalOpen(true)}
                onToggleDarkMode={toggleDarkMode}
                darkMode={darkMode}
                pinnedAppIds={pinnedAppIds}
                onUnpinApp={handleUnpinApp}
                badges={{
                  canvas: clearedTabBadges.has('canvas') ? 0 : canvasUnfinishedCount,
                  schedule: clearedTabBadges.has('radar') ? 0 : calendarEvents.length,
                  tracker: clearedTabBadges.has('tracker') ? 0 : pendingAssignmentCount,
                  gmail: clearedTabBadges.has('gmail') ? 0 : urgentEmailCount,
                  flashcards: clearedTabBadges.has('flashcards') ? 0 : flashcardDueCount,
                  pomodoro: 0,
                }}
              />
            </div>
            <button className="flex-1 bg-black/40 backdrop-blur-sm" onClick={()=>setMobileNavOpen(false)} aria-label="Close navigation" />
          </div>
        )}

        {/* Right Main Column with Top Header, Scrollable Content, and Bottom Status Bar */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F8F6F0] dark:bg-[#252320]">
          {/* Top Header — simplified & error-guarded */}
          {activeTab !== 'dashboard' && (
            <ErrorBoundary fallback={<header className="h-12 bg-white dark:bg-[#141413] border-b border-[#E8E6DC] dark:border-[#2C2B27] px-4 sm:px-6 flex items-center justify-between z-20 text-xs font-semibold text-[#5E5D59]"><button onClick={() => window.dispatchEvent(new CustomEvent('scc-navigate', { detail: 'dashboard' }))} className="hover:text-[#C96442]">StudentOS / Dashboard</button></header>}>
            <Navbar
              activeTabLabel={
                {
                  canvas: 'Canvas LMS',
                  radar: 'Daily Schedule',
                  tracker: 'Assignment Tracker',
                  gmail: 'Gmail AI Scanner',
                  drive: 'Google Drive',
                  classroom: 'Google Classroom',
                  moodle: 'Moodle LMS',
                  notebooklm: 'Google NotebookLM',
                  flashcards: 'Quizlet & Anki Flashcards',
                  quizlet: 'Quizlet & Anki Flashcards',
                  anki: 'Quizlet & Anki Flashcards',
                  canva: 'Canva',
                  'desmos-graphing': 'Desmos Graphing',
                  'desmos-scientific': 'Desmos Scientific',
                  geogebra: 'GeoGebra Math Suite',
                  phet: 'PhET Simulations',
                  'scribble-latex': 'Photo Math OCR',
                  'wolfram-symbolab': 'Wolfram Alpha & Symbolab',
                  wolfram: 'Wolfram Alpha & Symbolab',
                  excalidraw: 'Excalidraw Whiteboard',
                  mermaid: 'Mermaid Flowcharts',
                  viva: 'Oral Exam Practice',
                  pomodoro: 'Focus Station',
                  'notes-markdown': 'Markdown Notes',
                  'pdf-reader': 'PDF Reader & Annotator',
                  'quiz-generator': 'AI Practice Quiz Generator',
                  'periodic-table': 'Interactive Periodic Table',
                  'unit-converter': 'Scientific Unit Converter',
                  arxiv: 'arXiv Research Papers',
                  'open-library': 'Open Library & Textbooks',
                  rubric: 'Essay Rubric Checker',
                  feynman: 'Feynman Concept Explainer',
                  splitscreen: 'Dual Split Screen',
                  dashboard: 'Academic Dashboard',
                }[activeTab] || 'Workspace'
              }
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onToggleAiChat={() => setAiChatOpen(!aiChatOpen)}
              notifications={notifications}
              isAiChatOpen={aiChatOpen}
              onOpenGoogleSync={() => setGoogleSyncHubOpen(true)}
              isGoogleConnected={isGoogleConnected}
              isSyncingGoogle={isRefreshingAll}
              onNotificationClick={(n)=>{
                if (n.source==='Canvas' || n.title?.includes('Canvas') || n.title?.includes('Deadline')) handleTabTransition('canvas');
                else if (n.source==='Google Drive') handleTabTransition('drive');
                else if (n.source==='Gmail' || n.title?.includes('Email')) handleTabTransition('gmail');
                else if (n.tier==='urgent') handleTabTransition('tracker');
                else handleTabTransition('radar');
                // pulse highlight after nav
                setTimeout(()=>{ window.dispatchEvent(new CustomEvent('scc-highlight-tracker')); }, 300);
              }}
            />
            </ErrorBoundary>
          )}

          {/* PWA Install Banner — simplified */}
          {showInstallBtn && !zenFocusMode && activeTab !== 'dashboard' && (
            <div className="mx-4 mt-2 p-3 bg-[#F5F4ED] dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-2xl flex items-center justify-between text-xs shadow-sm">
              <div className="flex items-center gap-2"><span>📲</span><span className="font-semibold">Install app for offline access</span></div>
              <div className="flex items-center gap-2">
                <button onClick={handleInstallPwa} className="px-3 py-1.5 bg-[#C96442] text-white rounded-xl font-bold hover:bg-[#A94E33]">Install</button>
                <button onClick={handleDismissPwa} className="px-2 py-1 text-[#5E5D59] hover:text-[#141413] dark:hover:text-[#F5F4ED]">Later</button>
              </div>
            </div>
          )}

          {/* Main Area: Full-Screen AI Coach View OR Tab Workspaces — lazy + suspense + error boundary */}
          {aiChatOpen ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><div className="w-6 h-6 border-2 border-[#C96442] border-t-transparent rounded-full animate-spin" /><span className="ml-2 text-xs text-[#5E5D59]">Loading AI Coach…</span></div>}>
              <StudyAssistantChat
                isOpen={true}
                onClose={() => setAiChatOpen(false)}
                assignments={assignments}
                events={calendarEvents}
                alerts={emailAlerts}
                isFullScreen={true}
              />
            </Suspense>
          ) : (
            <main id="main-content" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 min-h-0" aria-label="Workspace content">
              <ErrorBoundary fallback={<div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-sm">Workspace failed to load. Try refreshing or switching tabs.</div>}>
              <Suspense fallback={<div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" /><span className="ml-2 text-xs text-[#8C897F]">Loading workspace…</span></div>}>
              <div className="max-w-7xl mx-auto space-y-6 enter">
                {/* Google Workspace Connection Banner: only when no usable grant
                    exists. Access renews silently via the offline grant, so no
                    expiry state is ever surfaced — reconnecting once upgrades
                    legacy hourly tokens to permanent automatically. */}
                {user && !isGoogleConnected && !isDemoMode && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-[#141413] dark:text-[#F5F4ED] text-sm">
                          Google Workspace Sync Paused
                        </p>
                        <p className="text-[11px] text-[#5E5D59] dark:text-[#B5B2A8]">
                          {`Signed in as ${user.email}. Connect Google Workspace with one click to enable live sync across Calendar, Drive, Sheets & Classroom — it stays connected automatically.`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleGoogleSignIn(true)}
                        disabled={isLoggingIn}
                        className="px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                        <span>{isLoggingIn ? 'Connecting...' : 'Connect Workspace'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'canvas' && (
                  <CanvasSyncTab
                    settings={canvasSettings}
                    onSaveSettings={(newSettings) => {
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
                    isGoogleConnected={isGoogleConnected}
                    onSubmitAssignment={handleSubmitAssignment}
                    googleToken={googleToken || undefined}
                    onConnectGoogle={() => handleGoogleSignIn(true)}
                  />
                )}

                {activeTab === 'radar' && (
                  <DailyRadarTab
                    events={calendarEvents}
                    isLoadingEvents={isLoadingEvents}
                    onRefreshEvents={loadCalendarEvents}
                    onOpenScheduleModal={(evt) => {
                      setSelectedEventForSchedule(evt || null);
                      setSelectedAssignmentForSchedule(null);
                      setScheduleModalOpen(true);
                    }}
                    onNavigateToTab={handleTabTransition}
                    urgentCanvasItems={canvasAssignments.filter((c) => !c.isSynced).slice(0, 3)}
                    allCanvasAssignments={canvasAssignments}
                    isGoogleConnected={isGoogleConnected}
                    onConnectGoogle={() => handleGoogleSignIn(true)}
                    calendarError={calendarError}
                    calendarApiInfo={calendarApiInfo}
                    pendingAssignments={assignments.filter((a) => a.status !== 'Done')}
                    onAddStudyBlock={handleScheduleStudyBlock}
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
                    onScheduleStudyBlock={(assignment) => {
                      setSelectedAssignmentForSchedule(assignment);
                      setSelectedEventForSchedule(null);
                      setScheduleModalOpen(true);
                    }}
                    onParseNaturalText={handleParseNaturalText}
                    isParsingAI={isParsingAI}
                    isGoogleConnected={isGoogleConnected}
                    onConnectGoogle={() => handleGoogleSignIn(true)}
                    onClearCompleted={handleClearCompletedAssignments}
                    onConfirmDue={handleConfirmDue}
                    sheetError={sheetError}
                    sheetApiInfo={sheetApiInfo}
                    onOpenLibrarySearch={(q) => {
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
                    onRefreshEmails={(forceResort, options) => loadEmailsAndAlerts(false, forceResort ?? true, options)}
                    onOpenQuickDraft={(email, alert) => {
                      setDraftInitialEmail(email || null);
                      setDraftInitialAlert(alert || null);
                      setQuickDraftModalOpen(true);
                    }}
                    onExtractAssignment={handleExtractAssignment}
                    isGoogleConnected={isGoogleConnected}
                    onConnectGoogle={handleConnectGmail}
                    emailError={emailError}
                    gmailApiInfo={gmailApiInfo}
                  />
                )}

                {activeTab === 'drive' && (
                  <GoogleDriveTab
                    recentFiles={recentFiles}
                    isLoadingFiles={isLoadingFiles}
                    onRefreshFiles={() => loadRecentFiles(false)}
                    isGoogleConnected={isGoogleConnected}
                    onConnectGoogle={() => handleGoogleSignIn(true)}
                    driveError={driveError}
                    driveApiInfo={driveApiInfo}
                    googleToken={googleToken || undefined}
                  />
                )}

                {activeTab === 'classroom' && (
                  <GoogleClassroomPanel
                    googleToken={googleToken || undefined}
                    isGoogleConnected={isGoogleConnected}
                    onConnectGoogle={() => handleGoogleSignIn(true)}
                    onSyncToSheet={handleSyncCanvasToSheet}
                    classroomAssignments={classroomAssignments}
                    isLoading={isLoadingClassroom}
                    errorMessage={classroomError}
                    onRefresh={() => loadClassroomData(false)}
                  />
                )}

                {activeTab === 'moodle' && (
                  <MoodlePanel
                    onSyncToSheet={handleSyncCanvasToSheet}
                  />
                )}

                {activeTab === 'notebooklm' && (
                  <NotebookLMStudioTab />
                )}

                {(activeTab === 'flashcards' || activeTab === 'quizlet' || activeTab === 'anki') && (
                  <FlashcardStudioTab />
                )}

                {activeTab === 'canva' && (
                  <CanvaStudioTab />
                )}

                {activeTab === 'desmos-graphing' && (
                  <DesmosWorkspace mode="graphing" />
                )}

                {activeTab === 'desmos-scientific' && (
                  <DesmosWorkspace mode="scientific" />
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

                {activeTab === 'mermaid' && (
                  <MermaidWorkspace />
                )}

                {(activeTab === 'wolfram' || activeTab === 'wolfram-symbolab') && (
                  <WolframWorkspace />
                )}

                {activeTab === 'scribble-latex' && (
                  <PhotoMathWorkspace />
                )}

                {activeTab === 'rubric' && (
                  <RubricCheckerWorkspace />
                )}

                {activeTab === 'feynman' && (
                  <FeynmanWorkspace />
                )}

                {activeTab === 'pdf-reader' && (
                  <PdfReaderWorkspace />
                )}

                {activeTab === 'quiz-generator' && (
                  <QuizGeneratorWorkspace />
                )}

                {activeTab === 'pomodoro' && (
                  <PomodoroWorkspace />
                )}

                {activeTab === 'periodic-table' && (
                  <PeriodicTableWorkspace />
                )}

                {activeTab === 'unit-converter' && (
                  <UnitConverterWorkspace />
                )}

                {activeTab === 'arxiv' && (
                  <ArxivWorkspace />
                )}

                {activeTab === 'open-library' && (
                  <OpenLibraryWorkspace />
                )}

                {activeTab === 'citation-vault' && (
                  <CitationVaultWorkspace />
                )}

                {activeTab === 'timetable' && (
                  <TimetableWorkspace />
                )}

                {activeTab === 'scholarship-tracker' && (
                  <ScholarshipTrackerWorkspace />
                )}

                {activeTab === 'group-project' && (
                  <GroupProjectWorkspace />
                )}

                {activeTab === 'peer-qa' && (
                  <PeerQAWorkspace />
                )}

                {activeTab === 'notion-import' && (
                  <NotionImportWorkspace />
                )}

                {activeTab === 'deadline-gantt' && (
                  <DeadlineGanttWorkspace assignments={assignments} canvasAssignments={canvasAssignments} />
                )}

                {activeTab === 'ai-planner' && (
                  <AIPlannerWorkspace assignments={assignments} canvasAssignments={canvasAssignments} classroomAssignments={classroomAssignments} emailAlerts={allAlerts} meetings={calendarEvents} />
                )}

                {activeTab === 'grade-forecaster' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading Grade Forecaster…</div>}>
                    <GradeForecasterWorkspace />
                  </Suspense>
                )}
                {activeTab === 'exam-mode' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading Exam Mode…</div>}>
                    <ExamModeWorkspace />
                  </Suspense>
                )}
                {activeTab === 'internship-tracker' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <InternshipTrackerWorkspace />
                  </Suspense>
                )}
                {activeTab === 'budget-tracker' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <BudgetWorkspace />
                  </Suspense>
                )}
                {activeTab === 'habit-sleep' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <HabitSleepWorkspace />
                  </Suspense>
                )}
                {activeTab === 'timetable-optimizer' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <TimetableOptimizerWorkspace />
                  </Suspense>
                )}
                {activeTab === 'code-runner' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <CodeRunnerWorkspace />
                  </Suspense>
                )}
                {activeTab === 'resume-builder' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <ResumeBuilderWorkspace />
                  </Suspense>
                )}
                {activeTab === 'presentation-coach' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <PresentationCoachWorkspace />
                  </Suspense>
                )}
                {activeTab === 'lab-report' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <LabReportWorkspace />
                  </Suspense>
                )}
                {activeTab === 'essay-outliner' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <EssayOutlinerWorkspace />
                  </Suspense>
                )}
                {activeTab === 'image-occlusion' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <ImageOcclusionWorkspace />
                  </Suspense>
                )}
                {activeTab === 'fsrs' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <FSRSSchedulerInfo />
                  </Suspense>
                )}
                {activeTab === 'viva-voice' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <VivaWorkspace />
                  </Suspense>
                )}
                {activeTab === 'language-lab' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <LanguageLabWorkspace />
                  </Suspense>
                )}
                {activeTab === 'zotero-import' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <ZoteroImportWorkspace />
                  </Suspense>
                )}
                {activeTab === 'paper-chat' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <PaperChatWorkspace />
                  </Suspense>
                )}
                {activeTab === 'dataset-finder' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <DatasetFinderWorkspace />
                  </Suspense>
                )}
                {activeTab === 'study-rooms' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <div className="max-w-2xl mx-auto"><StudyRoomPanel /></div>
                  </Suspense>
                )}
                {activeTab === 'teacher-view' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <div className="max-w-2xl mx-auto"><TeacherShareView upcoming={assignments.slice(0,5).map((a:any)=>`${a.assignmentName} — due ${a.dueDate}`)} focusMin={120} streak={3} /></div>
                  </Suspense>
                )}
                {activeTab === 'lecture-copilot' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <div className="max-w-2xl mx-auto"><LectureCopilot /></div>
                  </Suspense>
                )}
                {activeTab === 'api-docs' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <div className="max-w-2xl mx-auto"><ApiDocsPanel /></div>
                  </Suspense>
                )}
                {activeTab === 'extension' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading…</div>}>
                    <div className="max-w-2xl mx-auto"><ExtensionHelper /></div>
                  </Suspense>
                )}
                {activeTab === 'model-training' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading Model Lab…</div>}>
                    <ModelTrainingWorkspace />
                  </Suspense>
                )}
                {activeTab === 'few-shot-lab' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading Few-Shot Lab…</div>}>
                    <FewShotLabWorkspace />
                  </Suspense>
                )}
                {activeTab === 'competition-dossier' && (
                  <Suspense fallback={<div className="p-6 text-xs">Loading Dossier…</div>}>
                    <CompetitionDossierWorkspace />
                  </Suspense>
                )}

                {activeTab === 'stem' && (
                  <StemLabWorkspace />
                )}

                {activeTab === 'creation' && (
                  <CreationStudioWorkspace />
                )}

                {(activeTab === 'viva' || activeTab === 'retention') && (
                  <RetentionVaultWorkspace
                    googleToken={googleToken || undefined}
                    isGoogleConnected={isGoogleConnected}
                    onStartFocus={() => setZenFocusMode(true)}
                  />
                )}

                {(activeTab === 'notes-markdown' || activeTab === 'documents') && (
                  <DocumentHubWorkspace
                    recentFiles={recentFiles}
                    isLoadingFiles={isLoadingFiles}
                    onRefreshFiles={() => loadRecentFiles(false)}
                    isGoogleConnected={isGoogleConnected}
                    googleToken={googleToken || undefined}
                  />
                )}

                {activeTab === 'splitscreen' && (
                  <SplitScreenStudio />
                )}

                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    {/* Home hierarchy fix (v2.5.0): greeting + Today Plan stay above the fold — checklist demoted below DashboardHome */}
                    <DashboardHome
                      assignments={assignments}
                      onToggleAssignment={handleToggleAssignmentById}
                      onNavigateWorkspace={(ws) => handleTabTransition(ws)}
                      onOpenQuickDraft={(emailAlert) => {
                        if (emailAlert) {
                          setDraftInitialEmail(emailAlert.rawEmail || null);
                          setDraftInitialAlert(emailAlert);
                        } else {
                          setDraftInitialEmail(null);
                          setDraftInitialAlert(null);
                        }
                        setQuickDraftModalOpen(true);
                      }}
                      onOpenAiSuite={(tab) => {
                        setAiSuiteTab(tab || 'planner');
                        setAiSuiteOpen(true);
                      }}
                      onOpenAppStore={() => setAppStoreOpen(true)}
                      user={user}
                      isGoogleConnected={isGoogleConnected}
                      onConnectGoogle={() => handleGoogleSignIn(true)}
                      onOpenStudyPlan={() => setIsStudyPlanOpen(true)}
                      calendarEvents={calendarEvents}
                      emailAlerts={allAlerts}
                      isLoadingEvents={isLoadingEvents}
                      canvasCount={canvasAssignments.filter((c) => !c.isCompleted).length}
                      classroomCount={classroomAssignments.filter((c) => !c.isCompleted).length}
                    />
                    {/* Demoted secondary card: collapsible + dismissible, never blocks greeting/Today Plan */}
                    <OnboardingChecklist
                      onConnectCanvas={()=>handleTabTransition('canvas')}
                      onConnectGoogle={()=>handleGoogleSignIn(true)}
                      onCreateTask={()=>handleTabTransition('tracker')}
                      onStartPomodoro={()=>{ handleTabTransition('pomodoro'); setZenFocusMode(true); }}
                    />
                  </div>
                )}
              </div>
              </Suspense>
              </ErrorBoundary>
            </main>
          )}
        </div>
      </div>

      {/* Unified 2-Column Account & Settings Modal — gated so its chunk only loads when opened */}
      {accountSettingsOpen && (
      <Suspense fallback={null}>
      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        user={user}
        onGoogleSignIn={() => handleGoogleSignIn()}
        onLogout={handleLogout}
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

      {/* Google Workspace Sync Hub Modal */}
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
            onConnectGoogle={() => handleGoogleSignIn(true)}
            onDisconnectGoogle={handleDisconnectGoogle}
            onConnectGmail={handleConnectGmail}
            isConnectingGmail={isLoggingIn}
            calendarEventsCount={calendarEvents.length}
            emailCount={rawEmails.length}
            schoolFilesCount={recentFiles.length}
            classroomCount={classroomAssignments.length}
            sheetUrl={masterSheetUrl}
            onSyncSheet={async () => {
              await loadSheetAssignments(false);
            }}
            isSyncingSheet={isLoadingAssignments}
            onSyncClassroom={async () => {
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
        onSelectWorkspace={handleWorkspaceTransition}
        onOpenQuickDraft={() => {
          setDraftInitialEmail(null);
          setDraftInitialAlert(null);
          setQuickDraftModalOpen(true);
        }}
        onOpenNewAssignment={() => {
          handleWorkspaceTransition('academic');
        }}
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

      {/* Google OAuth & Test Users Setup Guide Modal — gated so its chunk only loads when opened */}
      {oauthGuideModalOpen && (
      <OAuthGuideModal
        isOpen={oauthGuideModalOpen}
        onClose={() => { setOauthGuideModalOpen(false); setOauthDiagnosis(null); }}
        onRetryWorkspaceSignIn={() => handleGoogleSignIn(true)}
        onBasicSignIn={handleBasicSignIn}
        isLoggingIn={isLoggingIn}
        projectId="studentcommandcenter-39cdc"
        userEmail="buianhuy2009@gmail.com"
        diagnosis={oauthDiagnosis}
        onRunDiagnostics={diagnoseSignInEnvironment}
        onRedirectSignIn={() => handleRedirectSignIn(true)}
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
        onAddAssignments={(newItems) => {
          newItems.forEach((item) => {
            handleAddAssignment({
              assignmentName: item.assignmentName || 'Assignment',
              subject: item.subject || 'General',
              dueDate: item.dueDate || 'Upcoming',
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

      {/* Declarative Native <dialog> Onboarding Tour */}
      <dialog
        ref={onboardingDialogRef}
        id="onboarding-tour-dialog"
        className="backdrop:bg-black/60 backdrop:backdrop-blur-xs rounded-2xl p-0 border border-[#E8E6DC] dark:border-[#2C2B27] shadow-2xl bg-[#F5F4ED] dark:bg-[#1A1917] text-[#141413] dark:text-[#F5F4ED] max-w-lg w-full m-auto overflow-hidden"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E6DC] dark:border-[#2C2B27]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-[#C96442] rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-[#C96442]/30">
                S
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">Welcome to Student Command Center</h3>
                <p className="text-xs text-[#5E5D59]">Eye-friendly, distraction-free academic workspace</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('scc_tour_seen', 'true');
                onboardingDialogRef.current?.close();
              }}
              className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-[#C96442]/15 text-[#C96442] shrink-0 font-bold">1</span>
              <div>
                <strong className="text-[#141413] dark:text-[#F5F4ED] block font-semibold">Canvas LMS Direct Sync</strong>
                <p className="text-[#5E5D59] mt-0.5">Filter unfinished vs. completed homework, open quizzes directly in Canvas, or submit files from Google Drive.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-[#C96442]/15 text-[#C96442] shrink-0 font-bold">2</span>
              <div>
                <strong className="text-[#141413] dark:text-[#F5F4ED] block font-semibold">Unified Daily Timeline</strong>
                <p className="text-[#5E5D59] mt-0.5">Your Google Calendar classes, study focus blocks, and today's Canvas deadlines merged in chronological order.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0 font-bold">3</span>
              <div>
                <strong className="text-[#141413] dark:text-[#F5F4ED] block font-semibold">Anti-Eyestrain Linen Theme</strong>
                <p className="text-[#5E5D59] mt-0.5">Warm cream #F5F4ED light and charcoal #141413 dark with terracotta accent eliminate glare during late study sessions.</p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#8C897F] font-mono">Press 1-5 for fast keyboard switching</span>
            <button
              onClick={() => {
                localStorage.setItem('scc_tour_seen', 'true');
                onboardingDialogRef.current?.close();
              }}
              className="px-5 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </dialog>

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
        userName={user?.displayName || 'Student'}
        completedTasksCount={assignments.filter((a) => a.status === 'Done').length}
      />
      )}

      {/* 1-Page Academic Portfolio Export Modal — gated so its chunk only loads when opened */}
      {isPortfolioExportOpen && (
      <PortfolioExportModal
        isOpen={isPortfolioExportOpen}
        onClose={() => setIsPortfolioExportOpen(false)}
        userName={user?.displayName || 'Student'}
        completedAssignments={assignments.filter((a) => a.status === 'Done')}
      />
      )}

      {/* Daily Morning Check-in Modal — gated so its chunk only loads when opened */}
      {isMorningCheckInOpen && (
      <MorningCheckInModal
        isOpen={isMorningCheckInOpen}
        onClose={() => setIsMorningCheckInOpen(false)}
        userName={user?.displayName || 'Student'}
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
        onStartFocusSession={(mins) => {
          setActiveTab('pomodoro');
          setZenFocusMode(true);
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
          const t = toasts.find((x) => x.id === id) as any;
          if (t?.reconnectGoogle) {
            dismissToast(id);
            handleGoogleSignIn(true);
            return;
          }
          if (typeof t?.onRetry === 'function') t.onRetry();
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
            addToast({ type:'success', title:'Restored', message: a?.assignmentName ?? 'Task' });
          }
        } catch {}
        dismissToast(id);
      }} />
    </div>
  );
}
