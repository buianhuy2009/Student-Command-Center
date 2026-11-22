import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { useT } from '../services/i18n';
import { LanguageToggle } from './LanguageToggle';

export interface NotificationItem {
  id: string;
  tier: 'urgent' | 'updates' | 'activity';
  title: string;
  description: string;
  link: string;
  source: string;
}

interface NavbarProps {
  activeTabLabel?: string;
  onOpenCommandPalette: () => void;
  onToggleAiChat: () => void;
  notifications?: NotificationItem[];
  isAiChatOpen?: boolean;
  onNotificationClick?: (n: NotificationItem) => void;
  onOpenGoogleSync?: () => void;
  isGoogleConnected?: boolean;
  isSyncingGoogle?: boolean;
  mobileNavOpen?: boolean;
  onToggleMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTabLabel,
  onOpenCommandPalette,
  onToggleAiChat,
  isAiChatOpen = false,
  onOpenGoogleSync,
  isGoogleConnected = false,
  isSyncingGoogle = false,
  mobileNavOpen = false,
  onToggleMobileNav,
}) => {
  const { t } = useT();
  const [platformKey, setPlatformKey] = useState('⌘K');

  useEffect(() => {
    const uaData = (navigator as any).userAgentData;
    const platform = uaData?.platform || (navigator as any).platform || navigator.userAgent;
    const isMac = /Mac|iPhone|iPad|iPod/.test(platform || '');
    setPlatformKey(isMac ? '⌘K' : 'Ctrl+K');
  }, []);

  const resolvedTabLabel = activeTabLabel ?? t('nav_default_tab');

  return (
    <header
      role="banner"
      className="sticky top-0 h-12 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-hairline)] px-3 sm:px-5 flex items-center justify-between gap-2 z-20 shrink-0 select-none"
    >
      {/* LEFT: Mobile nav trigger + clear active workspace breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={t('app_toggle_nav_aria')}
            aria-expanded={mobileNavOpen}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer shrink-0"
          >
            {mobileNavOpen ? <X className="w-4 h-4" strokeWidth={1.75} /> : <Menu className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        )}

        <nav aria-label={t('nav_breadcrumb_aria')} className="flex items-center gap-1.5 text-xs min-w-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('scc-navigate', { detail: 'dashboard' }))}
            className="hidden sm:inline-flex font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
            aria-label={t('side_go_dashboard')}
          >
            StudentOS
          </button>
          <span className="hidden sm:inline text-[var(--text-muted)]/50" aria-hidden="true">/</span>
          <span
            aria-current="page"
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[var(--text-primary)] font-semibold truncate max-w-[160px] sm:max-w-[240px]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-fill)] shrink-0" aria-hidden="true" />
            <span className="truncate">{resolvedTabLabel}</span>
          </span>
        </nav>
      </div>

      {/* CENTER: Command Palette search trigger */}
      <div className="flex items-center justify-center flex-1 max-w-md px-1 sm:px-3 min-w-0">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-tour="search"
          className="w-full bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] rounded-lg py-1.5 px-2.5 sm:px-3 text-xs flex items-center justify-between gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0" strokeWidth={1.75} />
            <span className="hidden sm:inline truncate">{t('search_or_jump')}</span>
            <span className="sm:hidden truncate">{t('search')}</span>
          </div>
          <kbd className="hidden sm:inline text-[10px] font-mono font-medium bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)] text-[var(--text-muted)] shrink-0">
            {platformKey}
          </kbd>
        </button>
      </div>

      {/* RIGHT: Compact essential controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <LanguageToggle compact className="hidden lg:inline-flex" />

        {onOpenGoogleSync && (
          <button
            type="button"
            id="btn-nav-google-sync"
            data-tour="sync"
            onClick={onOpenGoogleSync}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isGoogleConnected
                ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border-[var(--status-ok-border)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]'
            }`}
            title={t('nav_google_connections')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            <span className="hidden md:inline text-[11px]">
              {isSyncingGoogle ? t('syncing') : isGoogleConnected ? t('nav_google_tools') : t('connect_google')}
            </span>
          </button>
        )}

        <button
          type="button"
          id="btn-nav-ai-coach"
          data-tour="coach"
          onClick={onToggleAiChat}
          aria-pressed={isAiChatOpen}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
            isAiChatOpen
              ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)] text-white'
              : 'bg-[var(--accent-soft)] border-[var(--accent-border)]/70 text-[var(--accent-text)] hover:bg-[var(--accent-fill)] hover:border-[var(--accent-fill)] hover:text-white'
          }`}
          title={t('nav_ai_coach_title')}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span className="hidden sm:inline text-[11px]">{t('nav_ai_coach')}</span>
        </button>
      </div>
    </header>
  );
};
