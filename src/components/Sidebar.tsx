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
  { id: 'classroom', labelKey: 'side_flow_classroom_t', descKey: 'side_flow_classroom_d' },
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
  onOpenSettings,
  onOpenAppStore,
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

  // Shared active/inactive button class: active state combines fill + border + font weight + left accent indicator
  const navBtnClasses = (isActive: boolean) =>
    `w-full rounded-xl flex items-center transition-colors cursor-pointer relative group border ${
      isExpanded ? 'px-2.5 py-2 justify-between gap-2.5 min-h-[40px]' : 'w-11 h-11 mx-auto justify-center'
    } ${
      isActive
        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold shadow-xs'
        : 'bg-[var(--bg-surface)]/75 hover:bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-medium'
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
      className={`h-screen shrink-0 bg-[var(--bg-subtle)] border-r border-[var(--border-default)] flex flex-col transition-all duration-200 z-30 select-none ${
        isExpanded ? 'w-60 p-3' : 'w-16 p-2'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)] mb-2.5 shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex items-center gap-2.5 min-w-0 p-1 rounded-xl transition-colors cursor-pointer text-left border ${
            activeTab === 'dashboard'
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
              : 'border-transparent hover:bg-[var(--bg-surface)]/70'
          }`}
          title={t('side_go_dashboard')}
        >
          <div
            className="w-8 h-8 bg-[var(--accent-fill)] rounded-lg flex items-center justify-center text-white font-extrabold text-sm shrink-0"
            aria-hidden="true"
          >
            S
          </div>
          {isExpanded && (
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight truncate leading-tight">
                StudentOS
              </h1>
              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{t('side_subtitle')}</p>
            </div>
          )}
        </button>

        {isExpanded && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title={t('side_collapse')}
            aria-label={t('side_collapse')}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Scrollable Workspace List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3.5 pr-0.5">
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
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <AppLogo id="dashboard" size="sm" />
              {isExpanded && (
                <span className="text-xs truncate leading-tight">{t('app_tab_dashboard')}</span>
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
            return (
              <button
                type="button"
                key={`flow-${m.id}`}
                onClick={() => onSelectTab(m.id)}
                aria-current={isActive ? 'page' : undefined}
                data-tour-tab={m.id}
                title={itemLabel}
                className={navBtnClasses(isActive)}
              >
                {isActive && isExpanded && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
                )}
                <div className="flex items-center gap-2.5 min-w-0">
                  {i < 3 ? (
                    <span
                      className={`w-7 h-7 shrink-0 rounded-lg border text-[11px] font-extrabold flex items-center justify-center ${
                        isActive
                          ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)] text-white'
                          : 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                      }`}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <AppLogo id={m.id} size="sm" />
                  )}
                  {isExpanded && (
                    <div className="text-left min-w-0">
                      <div className="text-xs truncate leading-tight">{itemLabel}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-[var(--accent-text)] opacity-85' : 'text-[var(--text-muted)]'}`}>
                        {t(m.descKey)}
                      </div>
                    </div>
                  )}
                </div>
                {count > 0 && (
                  <span
                    className={
                      isExpanded
                        ? 'px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent-fill)] text-white shrink-0'
                        : 'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--accent-fill)] ring-2 ring-[var(--bg-subtle)]'
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
          <div className="space-y-1">
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
                      title={metaLabel}
                    >
                      {isActive && isExpanded && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent-fill)]" aria-hidden="true" />
                      )}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AppLogo id={app.id} size="sm" />
                        {isExpanded && (
                          <div className="text-left min-w-0">
                            <div className="text-xs truncate leading-tight">{metaLabel}</div>
                            <div className={`text-[10px] truncate ${isActive ? 'text-[var(--accent-text)] opacity-85' : 'text-[var(--text-muted)]'}`}>
                              {metaDesc}
                            </div>
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        hasBadge ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent-fill)] text-white shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        ) : null
                      ) : (
                        <>
                          {hasBadge && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-subtle)] bg-[var(--accent-fill)]" />
                          )}
                          {renderCollapsedTooltip(metaLabel)}
                        </>
                      )}
                    </button>
                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => onUnpinApp(app.id)}
                        className="absolute right-2 opacity-0 group-hover/item:opacity-100 focus:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] rounded cursor-pointer transition-opacity"
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
        <div className="pt-1 relative group/add">
          <button
            type="button"
            onClick={onOpenAppStore}
            className={`w-full rounded-xl flex items-center transition-colors cursor-pointer border border-dashed border-[var(--border-strong)] hover:border-[var(--accent-fill)] bg-transparent hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] ${
              isExpanded ? 'px-3 py-2 gap-2 text-xs font-semibold min-h-[40px]' : 'w-11 h-11 mx-auto justify-center'
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
      <div className="pt-2.5 border-t border-[var(--border-default)] shrink-0 space-y-1.5" ref={userMenuRef}>
        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-label={darkMode ? t('side_to_light') : t('side_to_dark')}
          aria-pressed={darkMode}
          className={`rounded-xl flex items-center transition-colors cursor-pointer border border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)]/75 hover:bg-[var(--bg-surface)] text-[var(--text-primary)] ${
            isExpanded ? 'w-full px-3 py-2 gap-2.5 text-xs font-semibold min-h-[40px]' : 'w-11 h-11 mx-auto justify-center'
          }`}
        >
          {darkMode ? <Sun className="w-4 h-4 shrink-0" strokeWidth={1.75} /> : <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
          {isExpanded && <span>{darkMode ? t('side_dark') : t('side_light')}</span>}
          {isExpanded && (
            <span
              className={`ml-auto w-8 h-[18px] rounded-full p-[2px] border transition-colors shrink-0 ${
                darkMode
                  ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)]'
                  : 'bg-[var(--bg-subtle)] border-[var(--border-strong)]'
              }`}
              aria-hidden="true"
            >
              <span
                className={`block w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                  darkMode ? 'translate-x-[14px]' : ''
                }`}
              />
            </span>
          )}
        </button>

        {!isExpanded && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-11 h-11 mx-auto rounded-xl bg-[var(--bg-surface)]/75 hover:bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--border-default)] hover:border-[var(--border-strong)]"
            title={t('side_expand')}
            aria-label={t('side_expand')}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className={`w-full flex items-center rounded-xl cursor-pointer bg-[var(--bg-surface)]/75 hover:bg-[var(--bg-surface)] transition-colors border border-[var(--border-default)] hover:border-[var(--border-strong)] ${
            isExpanded ? 'gap-2.5 justify-start p-2 min-h-[44px]' : 'w-11 h-11 mx-auto justify-center p-0'
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
      </div>
    </aside>
  );
};
