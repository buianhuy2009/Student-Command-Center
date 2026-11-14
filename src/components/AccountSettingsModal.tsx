import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  User as UserIcon,
  Moon,
  Sun,
  RefreshCw,
  ExternalLink,
  Keyboard,
  HelpCircle,
  LogOut,
  LogIn,
  CheckCircle2,
  Palette,
  Sliders,
  Sparkles,
  ChevronRight,
  Globe,
  Shield,
  Layers,
  Compass,
  Mail,
  CheckSquare,
  FileText,
  Bot,
  GraduationCap,
  BookOpen,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  SlidersHorizontal,
  AppWindow,
  Zap,
  AlertTriangle,
  MessageCircle,
  Bug,
  Download,
  Share2,
  Github,
  Heart,
} from 'lucide-react';
import {
  getClientGeminiApiKey,
  setClientGeminiApiKey,
  testGeminiApiKey,
  getClientGroqApiKey,
  setClientGroqApiKey,
} from '../services/gemini';
import { getTheme, setTheme } from '../services/theme';
import {
  maskApiKey,
  getGeminiKeyMeta,
  setGeminiKeyExpiry,
  getGroqKeyMeta,
  setGroqKeyExpiry,
  getExpiryStatus,
} from '../services/gemini/providers';
import { loadCanvasSettings, saveCanvasSettings } from '../services/canvas';
import { hasFeatureAccess, type GoogleFeature } from '../services/googleAuth';
import { useT } from '../services/i18n';
import { LanguageToggle } from './LanguageToggle';
import { CURRENT_VERSION } from './ChangelogModal';
import { setNasaApodEnabled } from '../hooks/useNasaApod';
import { fetchNasaApodV2, NASA_APOD_CACHE_KEY, NASA_APOD_TOGGLE_EVENT } from '../services/publicApis';

const NAV_ITEMS = [
  { id: 'general', labelKey: 'settings_nav_general', subKey: 'settings_sub_general', icon: Sliders },
  { id: 'models', labelKey: 'settings_nav_models', subKey: 'settings_sub_models', icon: Bot },
  { id: 'sync', labelKey: 'settings_nav_sync', subKey: 'settings_sub_sync', icon: Globe },
  { id: 'appearance', labelKey: 'settings_nav_appearance', subKey: 'settings_sub_appearance', icon: Palette },
  { id: 'shortcuts', labelKey: 'settings_nav_shortcuts', subKey: 'settings_sub_shortcuts', icon: Keyboard },
  { id: 'integrations', labelKey: 'settings_nav_integrations', subKey: 'settings_sub_integrations', icon: Layers },
  { id: 'support', labelKey: 'settings_nav_support', subKey: 'settings_sub_support', icon: HelpCircle },
] as const;

const AVATAR_OPTIONS = [
  { id: 'grad', labelKey: 'avatar_scholar', bg: 'bg-[var(--accent-fill)]' },
  { id: 'book', labelKey: 'avatar_researcher', bg: 'bg-[var(--text-secondary)]' },
  { id: 'bot', labelKey: 'avatar_cybernetic', bg: 'bg-[var(--text-primary)]' },
  { id: 'zap', labelKey: 'avatar_polymath', bg: 'bg-[var(--accent-hover)]' },
] as const;

const DENSITY_OPTIONS = [
  { id: 'compact', labelKey: 'settings_density_compact' },
  { id: 'comfortable', labelKey: 'settings_density_comfortable' },
  { id: 'spacious', labelKey: 'settings_density_spacious' },
] as const;

const PALETTE_OPTIONS = [
  { id: 'linen', nameKey: 'settings_palette_light', color: 'bg-[#FAF9F5] text-[#141413] border-[#E8E6DC]', accent: 'bg-[var(--accent-fill)]' },
  { id: 'midnight', nameKey: 'settings_palette_dark', color: 'bg-[#141413] text-[#F5F4ED] border-[#2C2B27]', accent: 'bg-[var(--accent-fill)]' },
] as const;

const SHORTCUT_ITEMS = [
  { labelKey: 'settings_sc_canvas', key: '1', settingKey: 'tab1' },
  { labelKey: 'settings_sc_schedule', key: '2', settingKey: 'tab2' },
  { labelKey: 'settings_sc_tracker', key: '3', settingKey: 'tab3' },
  { labelKey: 'settings_sc_gmail', key: '4', settingKey: 'tab4' },
  { labelKey: 'settings_sc_drive', key: '5', settingKey: 'tab5' },
  { labelKey: 'settings_sc_search', key: 'Cmd+K', settingKey: 'search' },
  { labelKey: 'settings_sc_sync', key: 'R', settingKey: 'sync' },
  { labelKey: 'settings_sc_esc', key: 'Esc', settingKey: 'esc' },
] as const;

const GOOGLE_TOOLS = [
  { id: 'calendar', labelKey: 'settings_tool_cal_label', descKey: 'settings_tool_cal_desc' },
  { id: 'gmail', labelKey: 'settings_tool_gmail_label', descKey: 'settings_tool_gmail_desc' },
  { id: 'drive', labelKey: 'settings_tool_drive_label', descKey: 'settings_tool_drive_desc' },
  { id: 'sheets', labelKey: 'settings_tool_sheets_label', descKey: 'settings_tool_sheets_desc' },
  { id: 'classroom', labelKey: 'settings_tool_classroom_label', descKey: 'settings_tool_classroom_desc' },
] as const satisfies ReadonlyArray<{ id: GoogleFeature; labelKey: string; descKey: string }>;

export interface ShortcutSettings {
  masterEnabled: boolean;
  keys: {
    tab1: boolean;
    tab2: boolean;
    tab3: boolean;
    tab4: boolean;
    tab5: boolean;
    search: boolean;
    sync: boolean;
    help: boolean;
    esc: boolean;
  };
}

export const defaultShortcutSettings: ShortcutSettings = {
  masterEnabled: false,
  keys: {
    tab1: false,
    tab2: false,
    tab3: false,
    tab4: false,
    tab5: false,
    search: false,
    sync: false,
    help: false,
    esc: false,
  },
};

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onGoogleSignIn: () => void;
  onLogout: () => void;
  onConnectFeature?: (feature: GoogleFeature) => void;
  onOpenGoogleSyncHub?: () => void;
  isLoggingIn: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  sheetUrl: string | null;
  onOpenTour?: () => void;
  onOpenOAuthGuide?: () => void;
  onOpenDeploymentGuide?: () => void;
  onOpenChangelog?: () => void;
  shortcutSettings: ShortcutSettings;
  setShortcutSettings: React.Dispatch<React.SetStateAction<ShortcutSettings>>;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  isSidebarExpanded?: boolean;
  toggleSidebar?: () => void;
  pwaInstallAvailable?: boolean;
  deferredPrompt?: any;
  onInstallPwa?: () => Promise<void>;
  onDismissPwa?: () => void;
}

type SettingsSection = 'general' | 'models' | 'sync' | 'appearance' | 'shortcuts' | 'integrations' | 'support';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onGoogleSignIn,
  onLogout,
  onConnectFeature,
  onOpenGoogleSyncHub,
  isLoggingIn,
  darkMode,
  setDarkMode,
  onRefreshAll,
  isRefreshing,
  sheetUrl,
  onOpenTour,
  onOpenOAuthGuide,
  onOpenDeploymentGuide,
  onOpenChangelog,
  shortcutSettings,
  setShortcutSettings,
  reducedMotion,
  setReducedMotion,
  highContrast,
  setHighContrast,
  pwaInstallAvailable,
  deferredPrompt,
  onInstallPwa,
  onDismissPwa,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const { t } = useT();
  const [, setGoogleScopeTick] = useState(0);
  useEffect(() => {
    const bump = () => setGoogleScopeTick((n) => n + 1);
    window.addEventListener('scc-google-scopes-updated', bump);
    window.addEventListener('scc-google-token-updated', bump);
    return () => {
      window.removeEventListener('scc-google-scopes-updated', bump);
      window.removeEventListener('scc-google-token-updated', bump);
    };
  }, []);

  // AI Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [geminiStatusMsg, setGeminiStatusMsg] = useState('');
  // Connections hub: per-key expiry metadata (stored separately from key values)
  const [geminiExpiry, setGeminiExpiry] = useState('');
  const [groqExpiry, setGroqExpiry] = useState('');
  // Connections hub: Canvas domain + token (canonical saveCanvasSettings keys)
  const [canvasDomain, setCanvasDomain] = useState('');
  const [canvasToken, setCanvasToken] = useState('');
  const [showCanvasToken, setShowCanvasToken] = useState(false);
  const [canvasSaveMsg, setCanvasSaveMsg] = useState('');

  // UI Density & Themes — strict two-mode palette: Warm Cream light / Dark Charcoal dark
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    return (localStorage.getItem('scc_ui_density_v1') as any) || 'comfortable';
  });
  const [colorTheme, setColorTheme] = useState<string>(() => {
    const theme = getTheme();
    return theme === 'midnight' ? 'midnight' : 'linen';
  });
  const [autoSystemTheme, setAutoSystemTheme] = useState<boolean>(() => {
    return localStorage.getItem('scc_auto_system_theme_v1') === 'true';
  });

  // Avatar & Personalisation
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem('scc_user_avatar_v1') || '';
  });
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [enableNasaApod, setEnableNasaApod] = useState<boolean>(() => {
    return localStorage.getItem('scc_enable_nasa_apod') === 'true';
  });
  const [nasaTestState, setNasaTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [nasaPreview, setNasaPreview] = useState<{ title: string; url: string; mediaType: string } | null>(null);
  // Sec 5.2 Step 4: Clear cache + reset preview + notify Home instantly so it clears without reload.
  const handleClearNasaCache = () => {
    try { localStorage.removeItem(NASA_APOD_CACHE_KEY); } catch {}
    try { localStorage.removeItem('scc_apod_last_fetch'); } catch {}
    setNasaPreview(null);
    setNasaTestState('idle');
    try { window.dispatchEvent(new CustomEvent(NASA_APOD_TOGGLE_EVENT, { detail: { cleared: true } })); } catch {}
    try { window.dispatchEvent(new Event('storage')); } catch {}
  };
  const [showSemesterResetModal, setShowSemesterResetModal] = useState(false);

  const handleSelectAvatar = (url: string) => {
    setAvatarUrl(url);
    localStorage.setItem('scc_user_avatar_v1', url);
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleNasaApod = (val: boolean) => {
    setEnableNasaApod(val);
    // Reactive wiring: persists + clears stale cache when off + notifies Dashboard instantly
    setNasaApodEnabled(val);
    if (val) {
      // Prefetch preview thumbnail so Settings shows instant feedback
      fetchNasaApodV2().then((d) => {
        if (d && d.url) setNasaPreview({ title: d.title, url: d.url, mediaType: d.mediaType });
      }).catch(() => {});
    } else {
      setNasaPreview(null);
      setNasaTestState('idle');
    }
  };

  const handleTestNasa = async () => {
    setNasaTestState('testing');
    const d = await fetchNasaApodV2();
    if (d && d.url) {
      setNasaTestState('ok');
      if (d.mediaType === 'image') setNasaPreview({ title: d.title, url: d.url, mediaType: d.mediaType });
    } else {
      setNasaTestState('fail');
    }
  };

  const handleExecuteSemesterReset = () => {
    localStorage.removeItem('scc_assignments_v1');
    localStorage.removeItem('scc_markdown_notes_v1');
    localStorage.removeItem('scc_study_streak_v1');
    localStorage.removeItem('scc_total_focus_minutes_v1');
    localStorage.removeItem('scc_emails_cache_v3');
    localStorage.removeItem(NASA_APOD_CACHE_KEY);
    setShowSemesterResetModal(false);
    alert(t('settings_reset_done_alert'));
    window.location.reload();
  };

  const handleDensityChange = (newDensity: 'compact' | 'comfortable' | 'spacious') => {
    setDensity(newDensity);
    localStorage.setItem('scc_ui_density_v1', newDensity);
    document.documentElement.setAttribute('data-density', newDensity);
  };

  const handleThemeChange = (newTheme: string) => {
    const next = newTheme === 'midnight' ? 'midnight' : 'linen';
    setColorTheme(next);
    setTheme(next as any);
    // Keep the Dark/Light toggle in sync — single source of truth
    setDarkMode(next === 'midnight');
  };

  const handleAutoSystemThemeChange = (val: boolean) => {
    setAutoSystemTheme(val);
    localStorage.setItem('scc_auto_system_theme_v1', String(val));
    if (val) {
      // Re-enabling auto-follow clears any explicit choice so the OS applies.
      try { localStorage.removeItem('scc_explicit_theme_v1'); } catch {}
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(isSystemDark);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedGemini = getClientGeminiApiKey();
      setGeminiKey(savedGemini);
      const savedGroq = getClientGroqApiKey();
      setGroqKey(savedGroq);
      try { setGeminiExpiry(getGeminiKeyMeta().expiresAt || ''); } catch {}
      try { setGroqExpiry(getGroqKeyMeta().expiresAt || ''); } catch {}
      try {
        const cs = loadCanvasSettings();
        setCanvasDomain(cs.apiDomain || '');
        setCanvasToken(cs.apiToken || '');
        setCanvasSaveMsg('');
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatExpiryLabel = (s: ReturnType<typeof getExpiryStatus>) => {
    if (s.state === 'none') return '';
    if (s.state === 'expired') return t('ai_key_expired');
    if (s.daysLeft === 0) return t('ai_key_expires_today');
    if (s.daysLeft === 1) return t('ai_key_expires_in_one', { days: 1 });
    return t('ai_key_expires_in_other', { days: s.daysLeft ?? 0 });
  };

  const handleSaveKeys = () => {
    setClientGeminiApiKey(geminiKey);
    setClientGroqApiKey(groqKey);
    try { setGeminiKeyExpiry(geminiExpiry ? geminiExpiry : null); } catch {}
    try { setGroqKeyExpiry(groqExpiry ? groqExpiry : null); } catch {}
    setGeminiStatusMsg(t('settings_keys_saved_msg'));
  };

  const handleSaveCanvasConnection = () => {
    try {
      const current = loadCanvasSettings();
      saveCanvasSettings({ ...current, apiDomain: canvasDomain.trim(), apiToken: canvasToken.trim() });
      setCanvasSaveMsg(t('settings_canvas_saved_msg'));
    } catch {
      setCanvasSaveMsg(t('settings_canvas_save_err'));
    }
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus('failed');
      setGeminiStatusMsg(t('settings_gemini_test_enter'));
      return;
    }
    setIsTestingGemini(true);
    setGeminiTestStatus('idle');
    setGeminiStatusMsg(t('settings_gemini_testing'));
    const ok = await testGeminiApiKey(geminiKey);
    setIsTestingGemini(false);
    if (ok) {
      setGeminiTestStatus('success');
      setGeminiStatusMsg(t('settings_gemini_test_ok'));
      setClientGeminiApiKey(geminiKey);
    } else {
      setGeminiTestStatus('failed');
      setGeminiStatusMsg(t('settings_gemini_test_fail'));
    }
  };

  const toggleAllShortcuts = (enabled: boolean) => {
    setShortcutSettings({
      masterEnabled: enabled,
      keys: {
        tab1: enabled,
        tab2: enabled,
        tab3: enabled,
        tab4: enabled,
        tab5: enabled,
        search: enabled,
        sync: enabled,
        help: enabled,
        esc: enabled,
      },
    });
  };

  const toggleIndividualKey = (keyName: keyof ShortcutSettings['keys']) => {
    setShortcutSettings((prev) => ({
      ...prev,
      keys: {
        ...prev.keys,
        [keyName]: !prev.keys[keyName],
      },
    }));
  };

  const currentNavItem = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-raised)] rounded-3xl max-w-4xl w-full h-[620px] max-h-[90vh] flex border border-[var(--border-default)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* LEFT PANE: Categorized Sidebar matching uploaded reference */}
        <div className="w-60 shrink-0 bg-[var(--bg-subtle)] border-r border-[var(--border-default)] flex flex-col justify-between p-4 select-none">
          <div className="space-y-4">
            <div className="px-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('settings')}
              </span>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-default)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent-fill)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Account Card at Bottom of Dialog Sidebar */}
          <div className="pt-3 border-t border-[var(--border-default)]">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
              {user ? (
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-fill)] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={t('avatar_title')} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (user.displayName || user.email || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center font-bold text-xs shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">
                  {user ? user.displayName || user.email?.split('@')[0] : t('settings_guest_user')}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                  {user ? user.email : t('settings_local_only')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Detail Settings Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-surface)]">
          
          {/* Header with Title and Close X */}
          <div className="px-8 py-6 border-b border-[var(--border-default)] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {t(currentNavItem.labelKey)}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t(currentNavItem.subKey)}
              </p>
            </div>

            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

            {/* SECTION 1: GENERAL */}
            {activeSection === 'general' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('execution_session')}
                  </span>

                  {/* Setting Card: Auto Sync */}
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('bg_refresh_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('bg_refresh_sub')}
                      </div>
                    </div>
                    <button
                      onClick={onRefreshAll}
                      disabled={isRefreshing}
                      className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-fill)] ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? t('syncing') : t('sync_now')}</span>
                    </button>
                  </div>

                  {/* Setting Card: Language — whole-app VI/EN toggle */}
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('language_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('language_sub')}
                      </div>
                    </div>
                    <LanguageToggle />
                  </div>

                  {/* Setting Card: Help & updates (tour + changelog merged — one row, not two) */}
                  {(onOpenTour || onOpenChangelog) && (
                    <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {t('help_updates_title')}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {t('help_updates_sub')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {onOpenTour && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenTour();
                            }}
                            className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            {t('launch_tour')}
                          </button>
                        )}
                        {onOpenChangelog && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChangelog();
                            }}
                            className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            {t('view_changelog')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Setting Card: User Avatar Selection — Ember neutrals, single terracotta active */}
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('avatar_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('avatar_sub')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => handleSelectAvatar(av.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            avatarUrl === av.id
                              ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                              : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--accent-fill)]'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${av.bg}`} />
                          <span>{t(av.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Setting Card: Start Fresh / Semester Reset */}
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('semester_reset_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('semester_reset_sub')}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSemesterResetModal(true)}
                      className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--status-err-border)] text-[var(--status-err-text)] rounded-xl text-xs font-bold hover:bg-[var(--status-err-bg)] transition-colors cursor-pointer"
                    >
                      {t('semester_reset_btn')}
                    </button>
                  </div>

                  {/* Setting Card: Local Storage Reset */}
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('clear_cache_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('clear_cache_sub')}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('scc_emails_cache_v3');
                        localStorage.removeItem('scc_email_alerts_v3');
                        alert(t('settings_cache_cleared_alert'));
                      }}
                      className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--status-err-border)] hover:text-[var(--status-err-text)] text-[var(--text-secondary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      {t('clear_cache_btn')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: MODELS & AI KEYS */}
            {activeSection === 'models' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-[var(--status-ok-bg)] rounded-2xl border border-[var(--status-ok-border)] flex items-start gap-2.5 text-xs text-[var(--status-ok-text)]">
                  <ShieldCheck className="w-4 h-4 text-[var(--status-ok-text)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">{t('settings_backup_banner_title')}</span>
                    {t('settings_backup_banner_sub')}
                  </div>
                </div>

                {/* Gemini Key */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-primary)] block">
                        {t('settings_gemini_label')}
                      </label>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t('settings_gemini_desc')}
                      </span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[var(--accent-fill)] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>{t('settings_gemini_get_free')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      aria-label={t('settings_aria_gemini_key')}
                      className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      aria-label={showGeminiKey ? t('ai_key_hide') : t('ai_key_show')}
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {geminiKey ? t('settings_key_saved_masked', { masked: maskApiKey(geminiKey) }) : t('settings_key_none')}
                      {(() => { const label = formatExpiryLabel(getExpiryStatus(geminiExpiry)); return label ? ` • ${label}` : ''; })()}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>{t('settings_expires_label')}</span>
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => setGeminiExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
                      />
                      {geminiExpiry && (
                        <button type="button" onClick={() => setGeminiExpiry('')} className="text-[11px] text-[var(--accent-fill)] hover:underline font-semibold">{t('settings_clear_btn')}</button>
                      )}
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {geminiStatusMsg || t('settings_keys_stored_hint')}
                    </span>
                    <button
                      onClick={handleTestGemini}
                      disabled={isTestingGemini || !geminiKey.trim()}
                      className="px-3 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTestingGemini ? 'animate-spin text-[var(--accent-fill)]' : ''}`} />
                      <span>{isTestingGemini ? t('settings_gemini_testing') : t('settings_gemini_test_btn')}</span>
                    </button>
                  </div>
                </div>

                {/* Groq Key */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-primary)] block">
                        {t('settings_groq_label')}
                      </label>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t('settings_groq_desc')}
                      </span>
                    </div>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[var(--accent-fill)] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>{t('settings_groq_get_key')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      aria-label={t('settings_aria_groq_key')}
                      className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      aria-label={showGroqKey ? t('ai_key_hide') : t('ai_key_show')}
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {groqKey ? t('settings_key_saved_masked', { masked: maskApiKey(groqKey) }) : t('settings_key_none')}
                      {(() => { const label = formatExpiryLabel(getExpiryStatus(groqExpiry)); return label ? ` • ${label}` : ''; })()}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>{t('settings_expires_label')}</span>
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => setGroqExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
                      />
                      {groqExpiry && (
                        <button type="button" onClick={() => setGroqExpiry('')} className="text-[11px] text-[var(--accent-fill)] hover:underline font-semibold">{t('settings_clear_btn')}</button>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveKeys}
                    className="px-5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {t('settings_save_api_keys')}
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 3: CONNECTIONS (unified keys + domains manager) */}
            {activeSection === 'sync' && (
              <div className="space-y-4">
                {/* AI Keys — masked display + edit + expiry (same localStorage keys as Models tab) */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_keys_title')}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {t('ai_key_gemini_name')} {geminiKey ? maskApiKey(geminiKey) : '—'} • {t('ai_key_groq_name')} {groqKey ? maskApiKey(groqKey) : '—'}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder={t('settings_aria_gemini_key')}
                        aria-label={t('settings_aria_gemini_key')}
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        aria-label={showGeminiKey ? t('ai_key_hide') : t('ai_key_show')}
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder={t('settings_aria_groq_key')}
                        aria-label={t('settings_aria_groq_key')}
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        aria-label={showGroqKey ? t('ai_key_hide') : t('ai_key_show')}
                        onClick={() => setShowGroqKey(!showGroqKey)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>{t('settings_gemini_expires_label')}</span>
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => setGeminiExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
                      />
                      <span className="font-semibold">{formatExpiryLabel(getExpiryStatus(geminiExpiry))}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>{t('settings_groq_expires_label')}</span>
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => setGroqExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
                      />
                      <span className="font-semibold">{formatExpiryLabel(getExpiryStatus(groqExpiry))}</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">{geminiStatusMsg || t('settings_keys_stored_hint')}</span>
                    <button
                      onClick={handleSaveKeys}
                      className="px-4 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {t('settings_save_ai_keys')}
                    </button>
                  </div>
                </div>

                {/* Canvas domain + token — canonical saveCanvasSettings keys */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_canvas_title')}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {canvasDomain || t('settings_canvas_summary_none_domain')} • {canvasToken ? t('settings_canvas_summary_token', { masked: maskApiKey(canvasToken) }) : t('settings_canvas_summary_none_token')}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <input
                      type="text"
                      value={canvasDomain}
                      onChange={(e) => setCanvasDomain(e.target.value)}
                      placeholder={t('settings_canvas_domain_ph')}
                      aria-label={t('settings_aria_canvas_domain')}
                      className="w-full px-3 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                    />
                    <div className="relative">
                      <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showCanvasToken ? 'text' : 'password'}
                        value={canvasToken}
                        onChange={(e) => setCanvasToken(e.target.value)}
                        placeholder={t('settings_canvas_token_ph')}
                        aria-label={t('settings_aria_canvas_token')}
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        aria-label={showCanvasToken ? t('ai_key_hide') : t('ai_key_show')}
                        onClick={() => setShowCanvasToken(!showCanvasToken)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showCanvasToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {canvasSaveMsg || t('settings_canvas_note')}
                    </span>
                    <button
                      onClick={handleSaveCanvasConnection}
                      className="px-4 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      {t('settings_canvas_save_btn')}
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {t('settings_canvas_note')}
                  </div>
                </div>

                {/* Google Sign-In & Per-Feature Tool Connections */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('settings_google_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {user
                          ? t('settings_google_desc_signed_in', { email: user.email || '' })
                          : t('settings_google_desc_guest')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onOpenGoogleSyncHub && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenGoogleSyncHub();
                          }}
                          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {t('settings_manage_connections')}
                        </button>
                      )}
                      {user ? (
                        <button
                          onClick={onLogout}
                          className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--status-err-border)] text-[var(--status-err-text)] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {t('settings_google_signout_btn')}
                        </button>
                      ) : (
                        <button
                          onClick={onGoogleSignIn}
                          disabled={isLoggingIn}
                          className="px-3.5 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                        >
                          {t('settings_google_signin_btn')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-default)] space-y-1.5">
                    <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      {t('settings_google_tools_heading')}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {GOOGLE_TOOLS.map((tool) => {
                        const connected = hasFeatureAccess(tool.id, user?.uid);
                        return (
                          <div
                            key={tool.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {t(tool.labelKey)}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] truncate">{t(tool.descKey)}</div>
                            </div>
                            {connected ? (
                              <span className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]">
                                {t('settings_connected_badge')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  if (onConnectFeature) {
                                    onConnectFeature(tool.id);
                                  } else if (onOpenGoogleSyncHub) {
                                    onOpenGoogleSyncHub();
                                  } else {
                                    onGoogleSignIn();
                                  }
                                }}
                                className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white cursor-pointer transition-colors"
                              >
                                {t('settings_connect_btn')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Google Sheets URL */}
                {sheetUrl && (
                  <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('settings_master_sheet_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">
                        {sheetUrl}
                      </div>
                    </div>
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>{t('settings_open_sheet')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Friendly privacy reassurance */}
                <div className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {t('settings_google_privacy_note')}
                </div>
              </div>
            )}

            {/* SECTION 4: APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-4">
                {/* Interface Density Toggle */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_density_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_density_sub')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shrink-0">
                    {DENSITY_OPTIONS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleDensityChange(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          density === d.id
                            ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {t(d.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Theme Palette Selector — strict two-mode palette */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('settings_palette_title')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('settings_palette_sub')}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[var(--accent-fill)] uppercase">
                      {colorTheme === 'midnight' ? t('settings_dark_btn') : t('settings_light_btn')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PALETTE_OPTIONS.map((palette) => (
                      <button
                        key={palette.id}
                        onClick={() => handleThemeChange(palette.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between h-16 ${
                          palette.color
                        } ${
                          colorTheme === palette.id
                            ? 'ring-2 ring-[var(--accent-fill)] scale-[1.02] shadow-xs'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${palette.accent}`} />
                        <span className="text-[11px] truncate">{t(palette.nameKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dark / Light Toggle */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_mode_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_mode_sub')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)]">
                    <button
                      onClick={() => setDarkMode(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        !darkMode ? 'bg-[var(--accent-fill)] text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>{t('settings_light_btn')}</span>
                    </button>
                    <button
                      onClick={() => setDarkMode(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        darkMode ? 'bg-[var(--accent-fill)] text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>{t('settings_dark_btn')}</span>
                    </button>
                  </div>
                </div>

                {/* Auto-Follow System Theme */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_auto_theme_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_auto_theme_sub')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSystemTheme}
                    aria-label={t('settings_auto_theme_title')}
                    onChange={(e) => handleAutoSystemThemeChange(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                  />
                </div>

                {/* Reduced Motion */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_reduced_motion_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_reduced_motion_sub')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    aria-label={t('settings_reduced_motion_title')}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                  />
                </div>

                {/* High Contrast */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_high_contrast_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_high_contrast_sub')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    aria-label={t('settings_high_contrast_title')}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                  />
                </div>

                {/* NASA APOD Atmospheric Wallpaper */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('nasa_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_nasa_sub')}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{t('dash_image_credit')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableNasaApod}
                    onChange={(e) => handleToggleNasaApod(e.target.checked)}
                    aria-label={t('settings_aria_nasa_toggle')}
                    className="w-6 h-6 min-w-[44px] min-h-[44px] rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                  />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestNasa}
                      disabled={nasaTestState === 'testing'}
                      className="px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-fill)] min-h-[44px] cursor-pointer disabled:opacity-60"
                    >
                      {nasaTestState === 'testing' ? t('settings_nasa_testing') : t('settings_nasa_test')}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearNasaCache}
                      className="px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-fill)] min-h-[44px] cursor-pointer"
                    >
                      {t('settings_nasa_clear_cache')}
                    </button>
                    {nasaTestState === 'ok' && <span className="text-[11px] font-bold text-emerald-600" role="status">{t('settings_nasa_status_ok')}</span>}
                    {nasaTestState === 'fail' && <span className="text-[11px] font-bold text-rose-600" role="status">{t('dash_apod_error')}</span>}
                  </div>
                  {enableNasaApod && nasaPreview && nasaPreview.mediaType === 'image' && (
                    <img src={nasaPreview.url} alt={nasaPreview.title || t('nasa_title')} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-24 object-cover rounded-xl border border-[var(--border-default)]" />
                  )}
                </div>
              </div>
            )}

            {/* SECTION 5: SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('settings_sc_master_title')}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_sc_master_sub')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={shortcutSettings.masterEnabled}
                    aria-label={t('settings_sc_master_title')}
                    onChange={(e) => toggleAllShortcuts(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {SHORTCUT_ITEMS.map((s) => (
                    <div
                      key={s.labelKey}
                      className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold block text-[var(--text-primary)]">
                          {t(s.labelKey)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--accent-fill)] font-bold">
                          [{s.key}]
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={shortcutSettings.keys[s.settingKey]}
                        aria-label={t(s.labelKey)}
                        onChange={() => toggleIndividualKey(s.settingKey)}
                        className="w-3.5 h-3.5 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 6: INTEGRATIONS */}
            {activeSection === 'integrations' && (
              <div className="space-y-3">
                {[
                  { name: t('settings_canvas_title'), desc: t('settings_integ_canvas_desc'), badge: t('settings_integ_available'), icon: Layers },
                  { name: t('settings_tool_classroom_label'), desc: t('settings_integ_classroom_desc'), badge: hasFeatureAccess('classroom', user?.uid) ? t('settings_connected_badge') : t('settings_integ_ready'), icon: GraduationCap },
                ].map((integ) => {
                  const Icon = integ.icon;
                  return (
                    <div
                      key={integ.name}
                      className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--accent-fill)]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)]">
                            {integ.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">{integ.desc}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
                        {integ.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SECTION 7: HELP & SUPPORT — moved from floating FeedbackWidget + PWA Install banner */}
            {activeSection === 'support' && (
              <div className="space-y-4">
                {/* PWA Install */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center font-bold text-xs">S</div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">{t('settings_pwa_title')}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{t('settings_pwa_sub')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pwaInstallAvailable && deferredPrompt ? (
                      <>
                        <button
                          onClick={async () => { if (onInstallPwa) await onInstallPwa(); }}
                          className="flex-1 px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('settings_pwa_install_now')}</span>
                        </button>
                        {onDismissPwa && (
                          <button onClick={onDismissPwa} className="px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                            {t('settings_pwa_later')}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        {typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)')?.matches || (navigator as any).standalone) ? t('settings_pwa_already') : t('settings_pwa_manual')}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">{t('settings_pwa_hint')}</div>
                </div>

                {/* Help & Feedback */}
                <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[var(--accent-fill)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">{t('settings_help_title')}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('settings_help_sub')}</p>
                  <div className="space-y-2">
                    <a href="https://github.com/buianhuy2009/Sutdent-Command-Center/issues/new" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-xs font-bold text-[var(--text-primary)] transition-colors">
                      <span className="flex items-center gap-2"><Github className="w-3.5 h-3.5" /> {t('settings_help_bug')}</span>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                    </a>
                    <a href="https://tally.so" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-xs font-bold text-[var(--text-primary)] transition-colors">
                      <span className="flex items-center gap-2"><Bug className="w-3.5 h-3.5" /> {t('settings_help_feature')}</span>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                    </a>
                    <a href="https://twitter.com/intent/tweet?text=Check%20out%20Student%20Command%20Center%20%E2%80%94%20my%20unified%20academic%20OS%20https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-1.5 p-3 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-xs transition-colors">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{t('settings_help_share')}</span>
                    </a>
                  </div>
                </div>

                {/* About + Version */}
                <div className="p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500" /> StudentOS</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('settings_about_links', { version: CURRENT_VERSION })} <a href="https://github.com/buianhuy2009/Sutdent-Command-Center" target="_blank" rel="noreferrer" className="underline hover:text-[var(--accent-fill)]">{t('settings_about_github')}</a> • <span className="cursor-pointer underline hover:text-[var(--accent-fill)]" onClick={() => { onClose(); onOpenChangelog?.(); }}>{t('settings_about_whats_new')}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-1 rounded-lg border border-[var(--border-default)]">v{CURRENT_VERSION}</div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Semester Reset Confirmation Modal */}
      {showSemesterResetModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--bg-raised)] max-w-sm w-full rounded-3xl border border-[var(--status-err-border)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[var(--status-err-text)] font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>{t('settings_reset_modal_title')}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('settings_reset_modal_desc')}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSemesterResetModal(false)}
                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('common_cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteSemesterReset}
                className="px-4 py-2 bg-[var(--status-err-text)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {t('settings_reset_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
