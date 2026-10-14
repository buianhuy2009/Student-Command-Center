import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  PinOff,
  Sun,
  Moon,
  User as UserIcon,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { APP_CATALOG } from './AppStoreModal';
import { t, useLang } from '../services/i18n';

const NavSection: React.FC<{ title?: string; isExpanded: boolean; children: React.ReactNode }> = ({ title, isExpanded, children }) => (
  <div className="space-y-1">
    {isExpanded && title && <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#70695E] dark:text-[#8C897F]">{title}</div>}
    <div className="space-y-1">{children}</div>
  </div>
);

export interface TabItem {
  id: string;
  label: string;
  icon?: any;
  desc: string;
  badge?: number | string;
  key?: string;
}

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onOpenAppStore: () => void;
  onOpenShortcuts: () => void;
  onToggleDarkMode: () => void;
  darkMode: boolean;
  pinnedAppIds: string[];
  onUnpinApp: (appId: string) => void;
  badges?: {
    canvas?: number;
    schedule?: number;
    tracker?: number;
    gmail?: number;
    flashcards?: number;
    [key: string]: number | undefined;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isExpanded,
  onToggleExpand,
  user,
  onSignIn,
  onSignOut,
  onOpenSettings,
  onOpenAppStore,
  onOpenShortcuts,
  onToggleDarkMode,
  darkMode,
  pinnedAppIds = [],
  onUnpinApp,
  badges = {},
}) => {
  useLang();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const APP_META: Record<string, { label: string; desc: string; key?: string; badgeKey?: string }> = {
    canvas: { label: 'Canvas LMS', desc: 'Assignments & grades', key: '1', badgeKey: 'canvas' },
    radar: { label: 'Daily Schedule', desc: 'Visual schedule & blocks', key: '2', badgeKey: 'schedule' },
    tracker: { label: 'Assignment Tracker', desc: 'Master checklist & sync', key: '3', badgeKey: 'tracker' },
    gmail: { label: 'Gmail AI Scanner', desc: 'Academic inbox & drafter', key: '4', badgeKey: 'gmail' },
    drive: { label: 'Google Drive', desc: 'School docs & slides', key: '5' },
  };

  const pinnedApps = useMemo(() => {
    return pinnedAppIds
      .map((id) => APP_CATALOG.find((app) => app.id === id))
      .filter(Boolean) as typeof APP_CATALOG;
  }, [pinnedAppIds]);

  const recentApps = useMemo(() => {
    try {
      const storeRecent = (() => { try { const w = localStorage.getItem('scc_workspace_store'); if (w) { const j = JSON.parse(w); const state = j.state || j; if (state.recentTabs) return state.recentTabs; } } catch {} return null; })();
      const raw = storeRecent || (() => { try { return JSON.parse(localStorage.getItem('scc_recent_tabs_v1') || '[]'); } catch { return []; } })();
      const ids = Array.isArray(raw) ? raw : [];
      const list: string[] = ids.map((x:any)=> typeof x==='string'? x : x.id).filter(Boolean).slice(0,3) as string[];
      if (list.length < 3) {
        const usageRaw = localStorage.getItem('scc_app_usage_v1');
        if (usageRaw) {
          const usage = JSON.parse(usageRaw);
          const sorted = Object.entries(usage).sort((a:any,b:any)=> b[1]-a[1]).map(([k])=>k).filter(k=> !list.includes(k) && !pinnedAppIds.includes(k));
          list.push(...sorted.slice(0, 3-list.length));
        }
      }
      return list.slice(0,3).map((id:string) => APP_CATALOG.find(a=>a.id===id)).filter(Boolean) as typeof APP_CATALOG;
    } catch { return []; }
  }, [activeTab, pinnedAppIds]);

  return (
    <aside
      aria-label={t('side_primary_nav')}
      data-tour="sidebar"
      role="navigation"
      className={`h-screen shrink-0 bg-[#F1ECE1] dark:bg-[#1A1917] border-r border-[#E7DFD3] dark:border-[#2C2B27] flex flex-col transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] z-30 select-none ${
        isExpanded ? 'w-64 p-4' : 'w-16 p-2'
      }`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD3] dark:border-[#2C2B27] mb-2 shrink-0">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex items-center gap-3 min-w-0 p-0.5 rounded-2xl transition-all duration-200 cursor-pointer text-left ${
            activeTab === 'dashboard'
              ? 'ring-2 ring-[#E05D38]/30 bg-[#FCEEE8] dark:bg-[#252422]/40'
              : 'hover:opacity-90'
          }`}
          title={t('side_go_dashboard')}
        >
          <div className="w-9 h-9 bg-[#E05D38] rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0" aria-hidden="true">
            S
          </div>
          {isExpanded && (
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-[#2B2621] dark:text-[#F5F4ED] tracking-tight truncate leading-tight">
                StudentOS
              </h1>
              <p className="text-[10px] text-[#70695E] dark:text-[#B5B2A8] font-mono truncate">Academic AI Hub</p>
            </div>
          )}
        </button>

        {isExpanded && (
          <button
            onClick={onToggleExpand}
            className="p-2.5 rounded-xl hover:bg-[#FCEEE8] dark:hover:bg-[#252422] text-[#70695E] dark:text-[#B5B2A8] hover:text-[#2B2621] dark:hover:text-[#F5F4ED] transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t('side_collapse')}
            aria-label={t('side_collapse')}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-0.5">
        <NavSection title={t('side_pinned')} isExpanded={isExpanded}>
          <div className="space-y-1">
            {pinnedApps.length === 0 ? (
              <div className="text-[11px] text-[#70695E] dark:text-[#B5B2A8] px-2 py-2 italic">{t('side_no_pinned')}</div>
            ) : pinnedApps.map((app) => {
              const meta = APP_META[app.id] || { label: app.name, desc: app.category };
              const badgeKey = (APP_META[app.id]?.badgeKey) || app.id;
              const badgeCount = badges[badgeKey] || badges[app.id] || (badges as any)[app.id.replace('-', '_')] || 0;
              const hasBadge = badgeCount > 0;
              const isActive = activeTab === app.id;
              const badgeColor = 'bg-[#E05D38]';
              return (
                <div key={app.id} className="relative group/item flex items-center">
                  <button
                    onClick={() => onSelectTab(app.id)}
                    aria-current={isActive ? 'page' : undefined}
                    data-tour-tab={app.id}
                    className={`w-full rounded-xl flex items-center transition-all duration-200 cursor-pointer relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E05D38]/50 ${
                      isExpanded ? 'px-3 py-2.5 justify-between gap-3 min-h-[44px]' : 'w-11 h-11 mx-auto justify-center'
                    } ${
                      isActive
                        ? 'bg-[#FCEEE8] dark:bg-[#252422] text-[#E05D38] dark:text-[#E8A07E] shadow-sm font-bold'
                        : 'bg-white/60 hover:bg-white dark:bg-[#252422]/60 dark:hover:bg-[#252422] text-[#2B2621] dark:text-[#F5F4ED] border border-transparent'
                    }`}
                    title={app.name}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AppLogo id={app.id} size="sm" />
                      {isExpanded && (
                        <div className="text-left min-w-0">
                          <div className="text-xs truncate leading-tight">{meta.label || app.name}</div>
                          <div className={`text-[10px] truncate ${isActive ? 'text-[#E05D38]/70 dark:text-[#E59A7C]/70' : 'text-[#70695E] dark:text-[#B5B2A8]'}`}>
                            {meta.desc || app.category}
                          </div>
                        </div>
                      )}
                    </div>
                    {isExpanded ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasBadge && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${isActive ? 'bg-[#E05D38] text-white' : `${badgeColor} text-white`}`}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        {hasBadge && (
                          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-[#F1ECE1] dark:ring-[#282723] ${badgeColor}`} />
                        )}
                        <span className="absolute left-16 bg-[#141413] dark:bg-[#F5F4ED] text-[#F5F4ED] dark:text-[#141413] text-xs font-semibold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity delay-100 whitespace-nowrap z-50 shadow-md border border-[#E8E6DC] dark:border-[#2C2B27]" role="tooltip">
                          {meta.label || app.name}
                        </span>
                      </>
                    )}
                  </button>
                  {isExpanded && (
                    <button
                      onClick={() => onUnpinApp(app.id)}
                      className="absolute right-2 opacity-0 group-hover/item:opacity-100 p-1 text-[#70695E] dark:text-[#B5B2A8] hover:text-[#2B2621] dark:hover:text-[#F5F4ED] rounded transition-opacity cursor-pointer"
                      title={t('side_unpin')}
                    >
                      <PinOff className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </NavSection>

        {recentApps.length > 0 && (
          <NavSection title={t('side_recent')} isExpanded={isExpanded}>
            <div className="space-y-1">
              {recentApps.map((app) => {
                const isActive = activeTab === app.id;
                return (
                  <button
                    key={`recent-${app.id}`}
                    onClick={() => onSelectTab(app.id)}
                    className={`w-full rounded-xl flex items-center transition-all duration-200 cursor-pointer relative ${isExpanded ? 'px-3 py-2.5 justify-between gap-3 min-h-[44px]' : 'w-11 h-11 mx-auto justify-center'} ${isActive ? 'bg-[#FCEEE8] dark:bg-[#252422] text-[#E05D38] dark:text-[#E8A07E] shadow-sm font-bold' : 'bg-white/60 hover:bg-white dark:bg-[#252422]/60 dark:hover:bg-[#252422] text-[#2B2621] dark:text-[#F5F4ED] border border-transparent'}`}
                    title={app.name}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AppLogo id={app.id} size="sm" />
                      {isExpanded && (
                        <div className="text-left min-w-0">
                          <div className="text-xs truncate leading-tight">{app.name}</div>
                          <div className={`text-[10px] truncate ${isActive ? 'text-[#E05D38]/70 dark:text-[#E59A7C]/70' : 'text-[#70695E] dark:text-[#B5B2A8]'}`}>{app.category}</div>
                        </div>
                      )}
                    </div>
                    {!isExpanded && (
                      <span className="absolute left-16 bg-[#141413] dark:bg-[#F5F4ED] text-[#F5F4ED] dark:text-[#141413] text-xs font-semibold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity delay-100 whitespace-nowrap z-50 shadow-md border border-[#E8E6DC] dark:border-[#2C2B27]" role="tooltip">{app.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </NavSection>
        )}

        <div className="pt-2 relative group/add">
          <button
            onClick={onOpenAppStore}
            className={`w-full rounded-xl flex items-center transition-all cursor-pointer border border-dashed border-[#70695E]/40 dark:border-[#2C2B27] hover:border-[#2B2621] text-[#2B2621] dark:text-[#B5B2A8] hover:text-[#2B2621] dark:hover:text-[#F5F4ED] ${
              isExpanded ? 'px-3 py-2.5 gap-2.5 text-xs font-semibold min-h-[44px]' : 'w-11 h-11 mx-auto justify-center'
            }`}
            title={t('side_open_store')}
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {isExpanded && <span>{t('side_add_tools')}</span>}
          </button>
          {!isExpanded && (
            <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-[#141413] dark:bg-[#F5F4ED] text-[#F5F4ED] dark:text-[#141413] text-xs font-semibold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover/add:opacity-100 transition-opacity delay-100 whitespace-nowrap z-50 shadow-md border border-[#E8E6DC] dark:border-[#2C2B27]">
              {t('side_app_store')}
            </span>
          )}
        </div>
      </div>

      <div className="pt-2.5 border-t border-[#70695E]/20 dark:border-[#2C2B27] shrink-0 space-y-1.5" ref={userMenuRef}>
        <button
          onClick={onToggleDarkMode}
          title={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-label={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-pressed={darkMode}
          className={`rounded-xl flex items-center transition-colors cursor-pointer border border-transparent hover:border-[#70695E]/30 dark:hover:border-[#2C2B27] hover:bg-white/50 dark:hover:bg-[#252422] text-[#2B2621] dark:text-[#F5F4ED] hover:text-[#2B2621] dark:hover:text-[#F5F4ED] ${
            isExpanded ? 'w-full px-3 py-2 gap-2.5 text-xs font-semibold min-h-[44px]' : 'w-11 h-11 mx-auto justify-center'
          }`}
        >
          {darkMode ? <Sun className="w-4 h-4 shrink-0 text-[#F5F4ED]" strokeWidth={1.75} /> : <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
          {isExpanded && <span>{darkMode ? t('side_dark') : t('side_light')}</span>}
          {isExpanded && (
            <span className={`ml-auto w-8 h-[18px] rounded-full p-[2px] transition-colors shrink-0 ${darkMode ? 'bg-[#F5F4ED]' : 'bg-[#70695E]/25 dark:bg-[#2C2B27]'}`}>
              <span className={`block w-3.5 h-3.5 rounded-full bg-[#E05D38] dark:bg-[#F5F4ED] shadow-xs transition-transform ${darkMode ? 'translate-x-[14px]' : ''}`} />
            </span>
          )}
        </button>
        {!isExpanded && (
          <button
            onClick={onToggleExpand}
            aria-label={t('side_expand')}
            className="w-11 h-11 mx-auto rounded-xl bg-white/40 hover:bg-white/70 dark:bg-[#252422]/60 dark:hover:bg-[#252422] text-[#2B2621] dark:text-[#F5F4ED] hover:text-[#2B2621] dark:hover:text-[#F5F4ED] flex items-center justify-center transition-colors cursor-pointer border border-[#70695E]/30 dark:border-[#2C2B27]"
            title={t('side_expand')}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t('side_account')}
          title={t('side_account')}
          className={`flex items-center rounded-xl p-1 cursor-pointer hover:bg-white/50 dark:hover:bg-[#252422] transition-colors border border-transparent hover:border-[#70695E]/30 dark:border-[#2C2B27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E05D38]/50 ${
            isExpanded ? 'w-full gap-3 justify-start p-2 min-h-[44px]' : 'w-11 h-11 mx-auto justify-center p-0'
          }`}
        >
          {user ? (
            <div className="w-9 h-9 rounded-2xl bg-white/60 border-2 border-white flex items-center justify-center text-xs font-bold text-[#E05D38] overflow-hidden shrink-0 shadow-xs">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                (user.displayName || user.email || 'S').slice(0, 2).toUpperCase()
              )}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-2xl bg-[#FDF6E7] text-[#E05D38] flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              <UserIcon className="w-4 h-4" strokeWidth={1.75} />
            </div>
          )}
          {isExpanded && (
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-bold text-[#2B2621] dark:text-[#F5F4ED] truncate leading-tight">
                {user ? user.displayName || user.email?.split('@')[0] : t('side_guest')}
              </div>
              <div className="text-[10px] text-[#70695E] dark:text-[#B5B2A8] truncate">
                {user ? user.email : t('side_click_settings')}
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
