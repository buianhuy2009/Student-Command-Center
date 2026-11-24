import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  PinOff,
  Sun,
  Moon,
  User as UserIcon,
  Search,
  Sparkles,
  LogOut,
  LogIn,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { APP_CATALOG } from './AppStoreModal';
import { useT, type TranslationKey } from '../services/i18n';
import { isCanvasHidden } from './MainFlowCard';

// The 5 core workflow apps (always top-level, never unpinnable)
const MAIN_FLOW = [
  { id: 'gmail', labelKey: 'side_flow_gmail_t', descKey: 'side_flow_gmail_d', badgeKey: 'gmail' },
  { id: 'tracker', labelKey: 'side_flow_tracker_t', descKey: 'side_flow_tracker_d', badgeKey: 'tracker' },
  { id: 'radar', labelKey: 'side_flow_radar_t', descKey: 'side_flow_radar_d', badgeKey: 'schedule' },
  { id: 'lecture-studio', labelKey: 'side_flow_lecture_t', descKey: 'side_flow_lecture_d' },
  { id: 'canvas', labelKey: 'side_flow_canvas_t', descKey: 'side_flow_canvas_d', badgeKey: 'canvas' },
] as const;
const MAIN_FLOW_IDS = new Set<string>(MAIN_FLOW.map((m) => m.id));

const NavSection: React.FC<{ title?: string; isExpanded: boolean; children: React.ReactNode }> = ({ title, isExpanded, children }) => (
  <div className="space-y-1">
    {isExpanded && title && (
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </div>
    )}
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
  onOpenSearch?: () => void;
  onToggleAiChat?: () => void;
  isAiChatOpen?: boolean;
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
  onOpenSearch,
  onToggleAiChat,
  isAiChatOpen = false,
  onToggleDarkMode,
  darkMode,
  pinnedAppIds = [],
  onUnpinApp,
  badges = {},
}) => {
  const { t } = useT();
  const [canvasHidden, setCanvasHiddenState] = useState(isCanvasHidden);
  useEffect(() => {
    const on = (e: any) => setCanvasHiddenState(Boolean(e?.detail));
    window.addEventListener('scc-canvas-visibility', on);
    return () => window.removeEventListener('scc-canvas-visibility', on);
  }, []);

  const userMenuRef = useRef<HTMLDivElement>(null);

  const APP_META: Record<string, { labelKey: TranslationKey; descKey: TranslationKey; badgeKey?: string }> = {
    canvas: { labelKey: 'side_meta_canvas_t', descKey: 'side_meta_canvas_d', badgeKey: 'canvas' },
    radar: { labelKey: 'side_meta_radar_t', descKey: 'side_meta_radar_d', badgeKey: 'schedule' },
    tracker: { labelKey: 'side_meta_tracker_t', descKey: 'side_meta_tracker_d', badgeKey: 'tracker' },
    gmail: { labelKey: 'side_meta_gmail_t', descKey: 'side_meta_gmail_d', badgeKey: 'gmail' },
    drive: { labelKey: 'side_meta_drive_t', descKey: 'side_meta_drive_d' },
  };

  const pinnedApps = useMemo(() => {
    return pinnedAppIds
      .filter((id) => !MAIN_FLOW_IDS.has(id))
      .map((id) => APP_CATALOG.find((app) => app.id === id))
      .filter(Boolean) as typeof APP_CATALOG;
  }, [pinnedAppIds]);

  const pinnedSet = useMemo(() => new Set(pinnedApps.map((a) => a.id)), [pinnedApps]);

  // Remaining kept apps out of the 15 in APP_CATALOG so every workspace is 1–2 clicks away
  const otherKeptApps = useMemo(
    () => APP_CATALOG.filter((app) => !MAIN_FLOW_IDS.has(app.id) && !pinnedSet.has(app.id)),
    [pinnedSet]
  );

  const activeIsInOtherTools = useMemo(
    () => otherKeptApps.some((a) => a.id === activeTab),
    [otherKeptApps, activeTab]
  );

  const [showOtherTools, setShowOtherTools] = useState<boolean>(activeIsInOtherTools);
  useEffect(() => {
    if (activeIsInOtherTools) setShowOtherTools(true);
  }, [activeIsInOtherTools]);

  // Calm Linear/Notion-style borderless nav row: subtle hover surface, crisp active fill + left bar
  const navBtnClasses = (isActive: boolean) =>
    `w-full rounded-lg flex items-center transition-colors cursor-pointer relative group ${
      isExpanded ? 'px-2.5 py-1.5 justify-between gap-2.5 min-h-[36px]' : 'w-10 h-10 mx-auto justify-center'
    } ${
      isActive
        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/70 font-medium'
    }`;

  const renderCollapsedTooltip = (label: string) =>
    !isExpanded ? (
      <span
        className="absolute left-14 bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-[var(--border-default)]"
        role="tooltip"
      >
        {label}
      </span>
    ) : null;

  return (
    <aside
      aria-label={t('side_primary_nav')}
      data-tour="sidebar"
      role="navigation"
      className={`h-dvh shrink-0 bg-[var(--bg-subtle)]/65 border-r border-[var(--border-hairline)] flex flex-col transition-all duration-200 z-30 select-none ${
        isExpanded ? 'w-60 px-2.5 py-3' : 'w-16 p-2'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-hairline)] mb-2 shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 min-w-0 px-1.5 py-1 rounded-lg hover:bg-[var(--bg-hover)]/60 transition-colors cursor-pointer text-left"
          title={t('side_go_dashboard')}
        >
          <div
            className="w-7 h-7 bg-[var(--accent-fill)] rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
            aria-hidden="true"
          >
            S
          </div>
          {isExpanded && (
            <div className="min-w-0">
              <h1 className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight truncate leading-tight">
                StudentOS
              </h1>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{t('side_subtitle')}</p>
            </div>
          )}
        </button>

        {isExpanded && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
            title={t('side_collapse')}
            aria-label={t('side_collapse')}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Quick Utilities: Search & AI Coach (always accessible even when top bar is hidden) */}
      {(onOpenSearch || onToggleAiChat) && (
        <div className="mb-2.5 space-y-1 shrink-0">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              data-tour="search"
              title={t('search_or_jump')}
              className={`w-full rounded-lg flex items-center transition-colors cursor-pointer relative group ${
                isExpanded
                  ? 'px-2.5 py-1.5 justify-between gap-2 bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] min-h-[34px]'
                  : 'w-10 h-9 mx-auto justify-center bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                {isExpanded && <span className="text-xs truncate">{t('search_or_jump')}</span>}
              </div>
              {isExpanded && (
                <kbd className="text-[10px] font-mono bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)] text-[var(--text-muted)] shrink-0">
                  ⌘K
                </kbd>
              )}
              {renderCollapsedTooltip(t('search_or_jump'))}
            </button>
          )}

          {onToggleAiChat && (
            <button
              type="button"
              onClick={onToggleAiChat}
              data-tour="coach"
              aria-pressed={isAiChatOpen}
              title={t('nav_ai_coach_title')}
              className={`w-full rounded-lg flex items-center transition-colors cursor-pointer relative group ${
                isExpanded ? 'px-2.5 py-1.5 justify-between gap-2 min-h-[36px]' : 'w-10 h-9 mx-auto justify-center'
              } ${
                isAiChatOpen
                  ? 'bg-[var(--accent-fill)] text-white font-semibold'
                  : 'bg-[var(--accent-soft)]/70 text-[var(--accent-text)] hover:bg-[var(--accent-soft)] font-semibold'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                {isExpanded && <span className="text-xs truncate">{t('nav_ai_coach')}</span>}
              </div>
              {renderCollapsedTooltip(t('nav_ai_coach'))}
            </button>
          )}
        </div>
      )}

      {/* Scrollable Workspace List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-0.5">
        {/* Explicit Home / Dashboard Item (always reachable) */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className={navBtnClasses(activeTab === 'dashboard')}
            title={t('app_tab_dashboard')}
          >
            {activeTab === 'dashboard' && isExpanded && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <AppLogo id="dashboard" size="sm" />
              {isExpanded && (
                <span className="text-[13px] truncate leading-tight">{t('app_tab_dashboard')}</span>
              )}
            </div>
            {renderCollapsedTooltip(t('app_tab_dashboard'))}
          </button>
        </div>

        {/* Core Flow (5 Academic Steps) */}
        <NavSection title={t('side_main_flow')} isExpanded={isExpanded}>
          {MAIN_FLOW.filter((m) => !(m.id === 'canvas' && canvasHidden)).map((m, i) => {
            const isActive = activeTab === m.id;
            const count = ('badgeKey' in m && m.badgeKey && (badges as any)[m.badgeKey]) || 0;
            const itemLabel = t(m.labelKey);
            const itemDesc = t(m.descKey);
            return (
              <button
                type="button"
                key={`flow-${m.id}`}
                onClick={() => onSelectTab(m.id)}
                aria-current={isActive ? 'page' : undefined}
                data-tour-tab={m.id}
                title={`${itemLabel} — ${itemDesc}`}
                className={navBtnClasses(isActive)}
              >
                {isActive && isExpanded && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
                )}
                <div className="flex items-center gap-2.5 min-w-0">
                  {i < 3 ? (
                    <span
                      className={`w-6 h-6 shrink-0 rounded-md text-[11px] font-bold tabular-nums flex items-center justify-center ${
                        isActive
                          ? 'bg-[var(--accent-fill)] text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                      }`}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <AppLogo id={m.id} size="sm" />
                  )}
                  {isExpanded && (
                    <span className="text-[13px] truncate leading-tight">{itemLabel}</span>
                  )}
                </div>
                {count > 0 && (
                  <span
                    className={
                      isExpanded
                        ? 'px-1.5 py-0.5 text-[10px] font-semibold tabular-nums rounded-full bg-[var(--accent-fill)] text-white shrink-0'
                        : 'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent-fill)] ring-2 ring-[var(--bg-subtle)]'
                    }
                  >
                    {isExpanded ? (count > 99 ? '99+' : count) : null}
                  </span>
                )}
                {renderCollapsedTooltip(itemLabel)}
              </button>
            );
          })}
        </NavSection>

        {/* Pinned Apps */}
        <NavSection title={t('side_pinned')} isExpanded={isExpanded}>
          <div className="space-y-0.5">
            {pinnedApps.length === 0 ? (
              isExpanded && (
                <div className="text-[11px] text-[var(--text-muted)] px-2 py-1.5 italic">
                  {t('side_no_pinned')}
                </div>
              )
            ) : (
              pinnedApps.map((app) => {
                const metaEntry = APP_META[app.id];
                const metaLabel = metaEntry ? t(metaEntry.labelKey) : t(app.nameKey);
                const metaDesc = metaEntry ? t(metaEntry.descKey) : t(`store_cat_${app.category.toLowerCase()}` as TranslationKey);
                const badgeKey = metaEntry?.badgeKey || app.id;
                const badgeCount = badges[badgeKey] || badges[app.id] || (badges as any)[app.id.replace('-', '_')] || 0;
                const hasBadge = badgeCount > 0;
                const isActive = activeTab === app.id;
                return (
                  <div key={app.id} className="relative group/item flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectTab(app.id)}
                      aria-current={isActive ? 'page' : undefined}
                      data-tour-tab={app.id}
                      className={navBtnClasses(isActive)}
                      title={`${metaLabel} — ${metaDesc}`}
                    >
                      {isActive && isExpanded && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
                      )}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AppLogo id={app.id} size="sm" />
                        {isExpanded && (
                          <span className="text-[13px] truncate leading-tight">{metaLabel}</span>
                        )}
                      </div>
                      {isExpanded ? (
                        hasBadge ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold tabular-nums rounded-full bg-[var(--accent-fill)] text-white shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        ) : null
                      ) : (
                        <>
                          {hasBadge && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-subtle)] bg-[var(--accent-fill)]" />
                          )}
                          {renderCollapsedTooltip(metaLabel)}
                        </>
                      )}
                    </button>
                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => onUnpinApp(app.id)}
                        className="absolute right-1.5 opacity-0 group-hover/item:opacity-100 focus:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] rounded-md cursor-pointer transition-opacity"
                        title={t('side_unpin')}
                        aria-label={`${t('side_unpin')} ${metaLabel}`}
                      >
                        <PinOff className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </NavSection>

        {/* Remaining Kept Apps Switcher (keeps all 15 apps accessible directly from Sidebar) */}
        {otherKeptApps.length > 0 && (
          <div className="space-y-1">
            {isExpanded ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowOtherTools((v) => !v)}
                  aria-expanded={showOtherTools}
                  className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer rounded-md"
                >
                  <span>{t('store_cat_all')} ({APP_CATALOG.length})</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showOtherTools ? 'rotate-180' : ''}`}
                    strokeWidth={1.75}
                  />
                </button>
                {showOtherTools && (
                  <div className="space-y-1">
                    {otherKeptApps.map((app) => {
                      const isActive = activeTab === app.id;
                      const label = t(app.nameKey);
                      return (
                        <button
                          type="button"
                          key={`kept-${app.id}`}
                          onClick={() => onSelectTab(app.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={navBtnClasses(isActive)}
                          title={label}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
                          )}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AppLogo id={app.id} size="sm" />
                            <span className="text-xs truncate leading-tight">{label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              activeIsInOtherTools &&
              otherKeptApps
                .filter((a) => a.id === activeTab)
                .map((app) => (
                  <button
                    type="button"
                    key={`kept-active-${app.id}`}
                    onClick={() => onSelectTab(app.id)}
                    aria-current="page"
                    className={navBtnClasses(true)}
                    title={t(app.nameKey)}
                  >
                    <AppLogo id={app.id} size="sm" />
                    {renderCollapsedTooltip(t(app.nameKey))}
                  </button>
                ))
            )}
          </div>
        )}

        {/* App Store Launcher */}
        <div className="pt-0.5 relative group/add">
          <button
            type="button"
            onClick={onOpenAppStore}
            className={`w-full rounded-lg flex items-center transition-colors cursor-pointer hover:bg-[var(--bg-hover)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)] ${
              isExpanded ? 'px-2.5 py-1.5 gap-2.5 text-[13px] font-medium min-h-[36px]' : 'w-10 h-10 mx-auto justify-center'
            }`}
            title={t('side_open_store')}
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {isExpanded && <span className="truncate">{t('side_more_tools')}</span>}
          </button>
          {!isExpanded && renderCollapsedTooltip(t('side_app_store'))}
        </div>
      </div>

      {/* Bottom Controls: Theme Toggle, Expand, Account */}
      <div className="pt-2.5 border-t border-[var(--border-hairline)] shrink-0 space-y-1" ref={userMenuRef}>
        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-label={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-pressed={darkMode}
          className={`rounded-lg flex items-center transition-colors cursor-pointer hover:bg-[var(--bg-hover)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] ${
            isExpanded ? 'w-full px-2.5 py-1.5 gap-2.5 text-xs font-medium min-h-[36px]' : 'w-10 h-10 mx-auto justify-center'
          }`}
        >
          {darkMode ? <Sun className="w-4 h-4 shrink-0" strokeWidth={1.75} /> : <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
          {isExpanded && <span>{darkMode ? t('side_dark') : t('side_light')}</span>}
          {isExpanded && (
            <span
              className={`ml-auto w-8 h-[18px] rounded-full p-[2px] border transition-colors shrink-0 ${
                darkMode
                  ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-strong)]'
              }`}
              aria-hidden="true"
            >
              <span
                className={`block w-3 h-3 rounded-full shadow-xs transition-transform ${
                  darkMode ? 'translate-x-[14px] bg-white' : 'bg-[var(--text-muted)]'
                }`}
              />
            </span>
          )}
        </button>

        {!isExpanded && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-10 h-10 mx-auto rounded-lg hover:bg-[var(--bg-hover)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
            title={t('side_expand')}
            aria-label={t('side_expand')}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        <div className={`flex items-center ${isExpanded ? 'gap-1' : 'flex-col gap-1'}`}>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex-1 flex items-center rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]/70 transition-colors min-w-0 ${
              isExpanded ? 'gap-2.5 justify-start px-2 py-1.5 min-h-[42px]' : 'w-10 h-10 mx-auto justify-center p-0'
            }`}
            title={t('side_account')}
          >
            {user ? (
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center text-xs font-bold text-[var(--accent-text)] overflow-hidden shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || t('side_guest')}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (user.displayName || user.email || 'S').slice(0, 2).toUpperCase()
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] flex items-center justify-center text-xs font-bold shrink-0">
                <UserIcon className="w-4 h-4" strokeWidth={1.75} />
              </div>
            )}
            {isExpanded && (
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">
                  {user ? user.displayName || user.email?.split('@')[0] : t('side_guest')}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                  {user ? user.email : t('side_click_settings')}
                </div>
              </div>
            )}
          </button>

          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              title={t('settings_google_signout_btn')}
              aria-label={t('settings_google_signout_btn')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              title={t('settings_google_signin_btn')}
              aria-label={t('settings_google_signin_btn')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--accent-text)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
