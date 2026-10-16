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
import { getGoogleTokenStatus } from '../services/firebase';
import { t, useLang } from '../services/i18n';
import { LanguageToggle } from './LanguageToggle';
import { setNasaApodEnabled } from '../hooks/useNasaApod';
import { fetchNasaApodV2, NASA_APOD_CACHE_KEY, NASA_APOD_TOGGLE_EVENT } from '../services/publicApis';

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
  useLang();

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
    alert('Semester reset complete. Local records have been cleared for the new term.');
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

  const handleSaveKeys = () => {
    setClientGeminiApiKey(geminiKey);
    setClientGroqApiKey(groqKey);
    try { setGeminiKeyExpiry(geminiExpiry ? geminiExpiry : null); } catch {}
    try { setGroqKeyExpiry(groqExpiry ? groqExpiry : null); } catch {}
    setGeminiStatusMsg('Keys saved locally.');
  };

  const handleSaveCanvasConnection = () => {
    try {
      const current = loadCanvasSettings();
      saveCanvasSettings({ ...current, apiDomain: canvasDomain.trim(), apiToken: canvasToken.trim() });
      setCanvasSaveMsg('Canvas domain + token saved. Press Save & Sync in Canvas tab to apply.');
    } catch {
      setCanvasSaveMsg('Could not save Canvas settings.');
    }
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus('failed');
      setGeminiStatusMsg('Please enter a Gemini API key.');
      return;
    }
    setIsTestingGemini(true);
    setGeminiTestStatus('idle');
    setGeminiStatusMsg('Testing Gemini 2.5 Flash connection...');
    const ok = await testGeminiApiKey(geminiKey);
    setIsTestingGemini(false);
    if (ok) {
      setGeminiTestStatus('success');
      setGeminiStatusMsg('Gemini Connection Verified! Ready for multimodal & schema tasks.');
      setClientGeminiApiKey(geminiKey);
    } else {
      setGeminiTestStatus('failed');
      setGeminiStatusMsg('Connection failed. Please check your key.');
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

  const navItems: Array<{ id: SettingsSection; label: string; icon: any }> = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'models', label: 'Models & AI Keys', icon: Bot },
    { id: 'sync', label: 'Connections', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'integrations', label: 'Integrations & LMS', icon: Layers },
    { id: 'support', label: 'Help & Support', icon: HelpCircle },
  ];

  return (
    <div className="fixed inset-0 bg-[#141413]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-4xl w-full h-[620px] max-h-[90vh] flex border border-[#E8E6DC] dark:border-[#2C2B27] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* LEFT PANE: Categorized Sidebar matching uploaded reference */}
        <div className="w-60 shrink-0 bg-[#E8E6DC] dark:bg-[#1F1E1B] border-r border-[#E8E6DC] dark:border-[#2C2B27] flex flex-col justify-between p-4 select-none">
          <div className="space-y-4">
            <div className="px-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">
                Settings
              </span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#E8E6DC] dark:bg-[#252422] text-[#141413] dark:text-[#F5F4ED] shadow-xs'
                        : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC]/60 dark:hover:bg-[#252422]/60 hover:text-[#141413] dark:hover:text-[#F5F4ED]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C96442]' : 'text-[#8C897F]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Account Card at Bottom of Dialog Sidebar */}
          <div className="pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27]">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27]">
              {user ? (
                <div className="w-8 h-8 rounded-lg bg-[#C96442] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (user.displayName || user.email || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#8C897F]/20 text-[#8C897F] flex items-center justify-center font-bold text-xs shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] truncate leading-tight">
                  {user ? user.displayName || user.email?.split('@')[0] : 'Guest User'}
                </div>
                <div className="text-[10px] text-[#8C897F] truncate">
                  {user ? user.email : 'Local Storage Only'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Detail Settings Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#141413]">
          
          {/* Header with Title and Close X */}
          <div className="px-8 py-6 border-b border-[#E8E6DC]/60 dark:border-[#2C2B27]/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#141413] dark:text-[#F5F4ED]">
                {navItems.find((n) => n.id === activeSection)?.label}
              </h2>
              <p className="text-xs text-[#8C897F] mt-0.5">
                {activeSection === 'general' && 'Configure execution preferences, storage policies, and session controls.'}
                {activeSection === 'models' && 'Manage Google Gemini and Groq API keys with dual-provider failover.'}
                {activeSection === 'sync' && 'All keys + Canvas domain in one place — AI keys, Canvas, and Google.'}
                {activeSection === 'appearance' && 'Customize theme warmth, contrast, and motion reduction.'}
                {activeSection === 'shortcuts' && 'Keyboard navigation and quick action hotkeys.'}
                {activeSection === 'integrations' && 'Connected LMS hubs, Classroom, and external study utilities.'}
                {activeSection === 'support' && 'Download app, report bugs, feedback & share love.'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8C897F] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED] transition-colors cursor-pointer"
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
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">
                    {t('execution_session')}
                  </span>

                  {/* Setting Card: Auto Sync */}
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        {t('bg_refresh_title')}
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        {t('bg_refresh_sub')}
                      </div>
                    </div>
                    <button
                      onClick={onRefreshAll}
                      disabled={isRefreshing}
                      className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#C96442] ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{isRefreshing ? t('syncing') : t('sync_now')}</span>
                    </button>
                  </div>

                  {/* Setting Card: Language — whole-app VI/EN toggle */}
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        {t('language_title')}
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        {t('language_sub')}
                      </div>
                    </div>
                    <LanguageToggle />
                  </div>

                  {/* Setting Card: Help & updates (tour + changelog merged — one row, not two) */}
                  {(onOpenTour || onOpenChangelog) && (
                    <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                          {t('help_updates_title')}
                        </div>
                        <div className="text-[11px] text-[#8C897F]">
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
                            className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                            className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            {t('view_changelog')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Setting Card: User Avatar Selection — Ember neutrals, single terracotta active */}
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        {t('avatar_title')}
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        {t('avatar_sub')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { id: 'grad', label: t('avatar_scholar'), bg: 'bg-[#C96442]', icon: 'GraduationCap' },
                        { id: 'book', label: t('avatar_researcher'), bg: 'bg-[#5E5D59]', icon: 'BookOpen' },
                        { id: 'bot', label: t('avatar_cybernetic'), bg: 'bg-[#141413] dark:bg-[#F5F4ED]', icon: 'Bot' },
                        { id: 'zap', label: t('avatar_polymath'), bg: 'bg-[#A94E33]', icon: 'Zap' },
                      ].map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => handleSelectAvatar(av.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            avatarUrl === av.id
                              ? 'bg-[#C96442] text-white border-[#C96442] shadow-xs'
                              : 'bg-white dark:bg-[#252422] border-[#E8E6DC] dark:border-[#2C2B27] text-[#141413] dark:text-[#F5F4ED]'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${av.bg}`} />
                          <span>{av.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Setting Card: Start Fresh / Semester Reset */}
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        {t('semester_reset_title')}
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        {t('semester_reset_sub')}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSemesterResetModal(true)}
                      className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      {t('semester_reset_btn')}
                    </button>
                  </div>

                  {/* Setting Card: Local Storage Reset */}
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        {t('clear_cache_title')}
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        {t('clear_cache_sub')}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('scc_emails_cache_v3');
                        localStorage.removeItem('scc_email_alerts_v3');
                        alert('Local email and alert cache cleared.');
                      }}
                      className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-rose-500 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Dual-Provider Redundancy Active</span>
                    Requests prioritize your local Gemini key, automatically falling back to Groq LLaMA 3.3 70B if limits are reached.
                  </div>
                </div>

                {/* Gemini Key */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] block">
                        Google Gemini API Key
                      </label>
                      <span className="text-[11px] text-[#8C897F]">
                        Used for multimodal math OCR, structured JSON actions &amp; oral exams.
                      </span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#C96442] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Get Free Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-[#8C897F]">
                      {geminiKey ? `Saved: ${maskApiKey(geminiKey)}` : 'No key saved'}
                      {(() => { const s = getExpiryStatus(geminiExpiry); return s.label ? ` • ${s.label}` : ''; })()}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#8C897F]">
                      <span>Expires</span>
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => setGeminiExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-[#141413] dark:text-[#F5F4ED]"
                      />
                      {geminiExpiry && (
                        <button type="button" onClick={() => setGeminiExpiry('')} className="text-[11px] text-[#C96442] hover:underline font-semibold">Clear</button>
                      )}
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#8C897F]">
                      {geminiStatusMsg || 'Stored locally in browser.'}
                    </span>
                    <button
                      onClick={handleTestGemini}
                      disabled={isTestingGemini || !geminiKey.trim()}
                      className="px-3 py-1 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTestingGemini ? 'animate-spin text-[#C96442]' : ''}`} />
                      <span>{isTestingGemini ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>
                </div>

                {/* Groq Key */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] block">
                        Groq API Key (Failover Engine)
                      </label>
                      <span className="text-[11px] text-[#8C897F]">
                        Instant fallback to LLaMA 3.3 70B if Gemini rate limit is hit.
                      </span>
                    </div>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#C96442] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Get Groq Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-[#8C897F]">
                      {groqKey ? `Saved: ${maskApiKey(groqKey)}` : 'No key saved'}
                      {(() => { const s = getExpiryStatus(groqExpiry); return s.label ? ` • ${s.label}` : ''; })()}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#8C897F]">
                      <span>Expires</span>
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => setGroqExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-[#141413] dark:text-[#F5F4ED]"
                      />
                      {groqExpiry && (
                        <button type="button" onClick={() => setGroqExpiry('')} className="text-[11px] text-[#C96442] hover:underline font-semibold">Clear</button>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveKeys}
                    className="px-5 py-2 bg-[#C96442] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Save API Keys
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 3: CONNECTIONS (unified keys + domains manager) */}
            {activeSection === 'sync' && (
              <div className="space-y-4">
                {/* AI Keys — masked display + edit + expiry (same localStorage keys as Models tab) */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      AI Keys
                    </div>
                    <span className="text-[10px] font-mono text-[#8C897F]">
                      {geminiKey ? `Gemini ${maskApiKey(geminiKey)}` : 'Gemini —'} • {groqKey ? `Groq ${maskApiKey(groqKey)}` : 'Groq —'}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="Gemini key (AIzaSy...)"
                        aria-label="Gemini API key"
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="Groq key (gsk_...)"
                        aria-label="Groq API key"
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKey(!showGroqKey)}
                        className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-[#8C897F]">
                      <span>Gemini expires</span>
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => setGeminiExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-[#141413] dark:text-[#F5F4ED]"
                      />
                      <span className="font-semibold">{getExpiryStatus(geminiExpiry).label}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#8C897F]">
                      <span>Groq expires</span>
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => setGroqExpiry(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-lg text-[#141413] dark:text-[#F5F4ED]"
                      />
                      <span className="font-semibold">{getExpiryStatus(groqExpiry).label}</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#8C897F]">{geminiStatusMsg || 'Stored locally in browser.'}</span>
                    <button
                      onClick={handleSaveKeys}
                      className="px-4 py-1.5 bg-[#C96442] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Save AI Keys
                    </button>
                  </div>
                </div>

                {/* Canvas domain + token — canonical saveCanvasSettings keys */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Canvas LMS
                    </div>
                    <span className="text-[10px] font-mono text-[#8C897F]">
                      {canvasDomain || 'No domain saved'} • {canvasToken ? `Token ${maskApiKey(canvasToken)}` : 'No token'}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <input
                      type="text"
                      value={canvasDomain}
                      onChange={(e) => setCanvasDomain(e.target.value)}
                      placeholder="https://your-school.instructure.com"
                      aria-label="Canvas domain"
                      className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                    />
                    <div className="relative">
                      <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showCanvasToken ? 'text' : 'password'}
                        value={canvasToken}
                        onChange={(e) => setCanvasToken(e.target.value)}
                        placeholder="Canvas API token"
                        aria-label="Canvas API token"
                        className="w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C96442] text-[#141413] dark:text-[#F5F4ED]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCanvasToken(!showCanvasToken)}
                        className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED] absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        {showCanvasToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-[#8C897F]">
                      {canvasSaveMsg || 'Press Save & Sync in Canvas tab to apply.'}
                    </span>
                    <button
                      onClick={handleSaveCanvasConnection}
                      className="px-4 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Save Canvas
                    </button>
                  </div>
                  <div className="text-[11px] text-[#8C897F]">
                    Note: press Save &amp; Sync in Canvas tab to apply.
                  </div>
                </div>

                {/* Google Account (read-only status via existing helpers) */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] flex items-center gap-2">
                      <span>Google Workspace Sync</span>
                      {(() => {
                        let s: string = 'missing';
                        try { s = getGoogleTokenStatus(); } catch {}
                        return (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${s === 'connected' ? 'bg-emerald-500/15 text-emerald-600' : s === 'expired' ? 'bg-amber-500/15 text-amber-600' : 'bg-[#8C897F]/15 text-[#8C897F]'}`}>
                            {s === 'connected' ? 'Connected' : s === 'expired' ? 'Expired — reconnect' : 'Not connected'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      {user ? `Connected as ${user.email}` : 'Not connected (Local Guest Mode)'}
                    </div>
                  </div>
                  {user ? (
                    <button
                      onClick={onLogout}
                      className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-rose-300 dark:border-rose-800 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={onGoogleSignIn}
                      disabled={isLoggingIn}
                      className="px-3.5 py-1.5 bg-[#C96442] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Connect Google
                    </button>
                  )}
                </div>

                {/* Google Sheets URL */}
                {sheetUrl && (
                  <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        Master Assignment Sheet
                      </div>
                      <div className="text-[11px] text-[#8C897F] truncate max-w-xs">
                        {sheetUrl}
                      </div>
                    </div>
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>Open Sheet</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Guides */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {onOpenOAuthGuide && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenOAuthGuide();
                      }}
                      className="p-3 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] text-left hover:border-[#C96442] transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        OAuth &amp; Test Users Guide
                      </div>
                      <div className="text-[10px] text-[#8C897F] mt-0.5">
                        Setup instructions for Google Cloud Console.
                      </div>
                    </button>
                  )}
                  {onOpenDeploymentGuide && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenDeploymentGuide();
                      }}
                      className="p-3 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] text-left hover:border-[#C96442] transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        Vercel Deployment Guide
                      </div>
                      <div className="text-[10px] text-[#8C897F] mt-0.5">
                        Full-stack deployment steps and env vars.
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-4">
                {/* Interface Density Toggle */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Display &amp; Layout Density
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Compact mode fits 35% more content onto 13-inch laptop displays.
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#141413] rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] shrink-0">
                    {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => handleDensityChange(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                          density === d
                            ? 'bg-[#C96442] text-white shadow-xs'
                            : 'text-[#8C897F] hover:text-[#141413] dark:hover:text-[#F5F4ED]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Theme Palette Selector — strict two-mode palette */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                        Atmospheric Color Palette
                      </div>
                      <div className="text-[11px] text-[#8C897F]">
                        Warm cream for day, dark charcoal for night. Terracotta accent in both.
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#C96442] uppercase">
                      {colorTheme}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'linen', name: 'Warm Cream (Light)', color: 'bg-[#E8E6DC] text-[#141413] border-[#E8E6DC]', accent: 'bg-[#C96442]' },
                      { id: 'midnight', name: 'Dark Charcoal (Dark)', color: 'bg-[#141413] text-[#F5F4ED] border-[#2C2B27]', accent: 'bg-[#C96442]' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id as any)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between h-16 ${
                          t.color
                        } ${
                          colorTheme === t.id
                            ? 'ring-2 ring-[#C96442] scale-[1.02] shadow-xs'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${t.accent}`} />
                        <span className="text-[11px] truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dark / Light Toggle */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Dark &amp; Light Mode
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Anti-eyestrain warm cream or low-light dark.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#141413] rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27]">
                    <button
                      onClick={() => setDarkMode(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        !darkMode ? 'bg-[#C96442] text-white shadow-xs' : 'text-[#8C897F]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Cream</span>
                    </button>
                    <button
                      onClick={() => setDarkMode(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        darkMode ? 'bg-[#C96442] text-white shadow-xs' : 'text-[#8C897F]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* Auto-Follow System Theme */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Sync with Operating System
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Automatically switch between Light and Dark mode based on OS preferences.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSystemTheme}
                    onChange={(e) => handleAutoSystemThemeChange(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                  />
                </div>

                {/* Reduced Motion */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Reduced Motion
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Disable heavy transition animations for lower CPU usage.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                  />
                </div>

                {/* High Contrast */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      High Contrast Mode
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Increase border and text contrast for outdoor readability.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                  />
                </div>

                {/* NASA APOD Atmospheric Wallpaper */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Ảnh thiên văn NASA mỗi ngày (APOD)
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Xem ảnh vũ trụ kèm giải thích. Cần mạng. Giới hạn miễn phí. • Display the daily deep-space photo on Home.
                    </div>
                    <div className="text-[10px] text-[#8C897F]">Ảnh: NASA APOD</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableNasaApod}
                    onChange={(e) => handleToggleNasaApod(e.target.checked)}
                    aria-label="Ảnh thiên văn NASA mỗi ngày (APOD) — Toggle NASA Astronomy Picture of the Day"
                    className="w-6 h-6 min-w-[44px] min-h-[44px] rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                  />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestNasa}
                      disabled={nasaTestState === 'testing'}
                      className="px-3 py-2 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-[11px] font-bold text-[#141413] dark:text-[#F5F4ED] hover:border-[#C96442] min-h-[44px] cursor-pointer disabled:opacity-60"
                    >
                      {nasaTestState === 'testing' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối • Test'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearNasaCache}
                      className="px-3 py-2 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-[11px] font-bold text-[#141413] dark:text-[#F5F4ED] hover:border-[#C96442] min-h-[44px] cursor-pointer"
                    >
                      Xóa ảnh đã lưu • Clear cache
                    </button>
                    {nasaTestState === 'ok' && <span className="text-[11px] font-bold text-emerald-600" role="status">Đã kết nối — ảnh tải được. • Connected.</span>}
                    {nasaTestState === 'fail' && <span className="text-[11px] font-bold text-rose-600" role="status">NASA giới hạn hoặc mất mạng. Hiện ảnh cũ — bấm Thử lại.</span>}
                  </div>
                  {enableNasaApod && nasaPreview && nasaPreview.mediaType === 'image' && (
                    <img src={nasaPreview.url} alt={nasaPreview.title || 'NASA preview'} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-24 object-cover rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27]" />
                  )}
                </div>
              </div>
            )}

            {/* SECTION 5: SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                      Master Keyboard Shortcuts Switch
                    </div>
                    <div className="text-[11px] text-[#8C897F]">
                      Enable single-key shortcuts (1-5 for tabs, R to sync, ? for help).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={shortcutSettings.masterEnabled}
                    onChange={(e) => toggleAllShortcuts(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Canvas LMS Tab', key: '1', settingKey: 'tab1' as const },
                    { label: 'Daily Schedule Tab', key: '2', settingKey: 'tab2' as const },
                    { label: 'Assignment Tracker', key: '3', settingKey: 'tab3' as const },
                    { label: 'Gmail AI Scanner', key: '4', settingKey: 'tab4' as const },
                    { label: 'Google Drive Tab', key: '5', settingKey: 'tab5' as const },
                    { label: 'Spotlight Search', key: 'Cmd+K', settingKey: 'search' as const },
                    { label: 'Refresh Data', key: 'R', settingKey: 'sync' as const },
                    { label: 'Exit Zen Focus', key: 'Esc', settingKey: 'esc' as const },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-3 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold block text-[#141413] dark:text-[#F5F4ED]">
                          {s.label}
                        </span>
                        <span className="font-mono text-[10px] text-[#C96442] font-bold">
                          [{s.key}]
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={shortcutSettings.keys[s.settingKey]}
                        onChange={() => toggleIndividualKey(s.settingKey)}
                        className="w-3.5 h-3.5 rounded text-[#C96442] focus:ring-[#C96442] cursor-pointer"
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
                  { name: 'Canvas LMS', desc: 'Sync via iCal calendar URL & token', badge: 'Active', icon: Layers },
                  { name: 'Google Classroom', desc: 'Sync coursework and materials', badge: 'Ready', icon: GraduationCap },
                  { name: 'Moodle LMS', desc: 'Direct iCal and REST endpoints', badge: 'Ready', icon: BookOpen },
                  { name: 'Google NotebookLM', desc: 'AI source binder & study exporter', badge: 'Connected', icon: Bot },
                  { name: 'Canva Studio', desc: 'Direct presentation & slide design bridge', badge: 'Ready', icon: Palette },
                ].map((integ) => {
                  const Icon = integ.icon;
                  return (
                    <div
                      key={integ.name}
                      className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-center text-[#C96442]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">
                            {integ.name}
                          </div>
                          <div className="text-[11px] text-[#8C897F]">{integ.desc}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#C96442]/15 text-[#C96442]">
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
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#C96442] text-white flex items-center justify-center font-bold text-xs">S</div>
                    <div>
                      <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">Install StudentOS App</div>
                      <div className="text-[11px] text-[#8C897F]">Offline + 1-tap home-screen access. No app store needed (PWA).</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pwaInstallAvailable && deferredPrompt ? (
                      <>
                        <button
                          onClick={async () => { if (onInstallPwa) await onInstallPwa(); }}
                          className="flex-1 px-4 py-2 bg-[#C96442] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Install Now</span>
                        </button>
                        {onDismissPwa && (
                          <button onClick={onDismissPwa} className="px-3 py-2 bg-white dark:bg-[#252422] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl text-xs font-bold text-[#6B6860] cursor-pointer">
                            Later
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full p-2.5 rounded-xl bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] text-[#6B6860] leading-relaxed">
                        {typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)')?.matches || (navigator as any).standalone) ? '✓ Already installed — you’re running in standalone mode.' : 'No install prompt available yet. On desktop use Chrome menu → Cast, save and share → Install StudentOS. On iOS use Share → Add to Home Screen.'}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-[#8C897F]">Tip: Installing pins StudentOS to your dock/home screen with offline support (Dexie + Workbox cache).</div>
                </div>

                {/* Help & Feedback */}
                <div className="p-4 bg-[#E8E6DC] dark:bg-[#1F1E1B] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#C96442]" />
                    <span className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">Help & Feedback</span>
                  </div>
                  <p className="text-[11px] text-[#6B6860] leading-relaxed">Report bugs, request features, or share your academic setup — we read every submission.</p>
                  <div className="space-y-2">
                    <a href="https://github.com/buianhuy2009/Sutdent-Command-Center/issues/new" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-xs font-bold text-[#141413] dark:text-[#F5F4ED] transition-colors">
                      <span className="flex items-center gap-2"><Github className="w-3.5 h-3.5" /> Report a Bug — GitHub Issue</span>
                      <ExternalLink className="w-3 h-3 text-[#8C897F]" />
                    </a>
                    <a href="https://tally.so" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#141413] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-xs font-bold text-[#141413] dark:text-[#F5F4ED] transition-colors">
                      <span className="flex items-center gap-2"><Bug className="w-3.5 h-3.5" /> Request Feature — Tally Form</span>
                      <ExternalLink className="w-3 h-3 text-[#8C897F]" />
                    </a>
                    <a href="https://twitter.com/intent/tweet?text=Check%20out%20Student%20Command%20Center%20%E2%80%94%20my%20unified%20academic%20OS%20https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-1.5 p-3 rounded-xl bg-[#C96442] hover:bg-[#C86646] text-white text-xs font-bold shadow-xs transition-colors">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share your setup on X</span>
                    </a>
                  </div>
                </div>

                {/* About + Version */}
                <div className="p-4 bg-white dark:bg-[#141413] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED] flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500" /> StudentOS</div>
                    <div className="text-[11px] text-[#8C897F]">Open-source • Local-first • v2.2.2 • <a href="https://github.com/buianhuy2009/Sutdent-Command-Center" target="_blank" rel="noreferrer" className="underline hover:text-[#C96442]">GitHub</a> • <span className="cursor-pointer underline hover:text-[#C96442]" onClick={() => { onClose(); onOpenChangelog?.(); }}>What’s new?</span></div>
                  </div>
                  <div className="text-[10px] font-mono text-[#8C897F] bg-[#E8E6DC] dark:bg-[#1F1E1B] px-2 py-1 rounded-lg border">v2.2.2</div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Semester Reset Confirmation Modal */}
      {showSemesterResetModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1A1917] max-w-sm w-full rounded-3xl border border-rose-300 dark:border-rose-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Semester Reset</span>
            </div>
            <p className="text-xs text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed">
              This action will reset your active coursework lists, notes, study streaks, and focus stats for the new semester. This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSemesterResetModal(false)}
                className="px-4 py-2 bg-[#E8E6DC] dark:bg-[#1F1E1B] border border-[#E8E6DC] dark:border-[#2C2B27] text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSemesterReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
