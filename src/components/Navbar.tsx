import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bell,
  Search,
  RefreshCw,
} from 'lucide-react';
import { t, useLang } from '../services/i18n';
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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTabLabel = 'Canvas LMS',
  onOpenCommandPalette,
  onToggleAiChat,
  notifications = [],
  isAiChatOpen = false,
  onNotificationClick,
  onOpenGoogleSync,
  isGoogleConnected = false,
  isSyncingGoogle = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasDismissedBadge, setHasDismissedBadge] = useState(false);
  const [platformKey, setPlatformKey] = useState('⌘K');
  useEffect(() => {
    const uaData = (navigator as any).userAgentData;
    const platform = uaData?.platform || (navigator as any).platform || navigator.userAgent;
    const isMac = /Mac|iPhone|iPad|iPod/.test(platform || '');
    setPlatformKey(isMac ? '⌘K' : 'Ctrl+K');
  }, []);
  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNotifications(false); };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notif-root]')) setShowNotifications(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClickOutside); };
  }, [showNotifications]);

  const unreadCount = hasDismissedBadge ? 0 : notifications.length;
  useLang();

  return (
    <header role="banner" className="h-12 bg-white dark:bg-[#1A1917] border-b border-[#E8E6DC] dark:border-[#2C2B27] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* LEFT: Clean breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <nav aria-label="Breadcrumb" className="flex items-center text-xs font-semibold text-[#5E5D59]">
          <button onClick={() => window.dispatchEvent(new CustomEvent('scc-navigate', { detail: 'dashboard' }))} className="hover:text-[#C96442] hover:underline transition-colors cursor-pointer" aria-label="Go to Dashboard">StudentOS</button>
          <span className="mx-1.5 text-[#E8E6DC] dark:text-[#2C2B27]">/</span>
          <span className="font-bold text-[#141413] dark:text-[#F5F4ED] truncate" aria-current="page">
            {activeTabLabel}
          </span>
        </nav>
      </div>

      {/* CENTER: Search - clean */}
      <div className="flex items-center justify-center flex-1 max-w-md px-4">
        <button
          onClick={onOpenCommandPalette}
          data-tour="search"
          aria-label={t('search_or_jump')}
          className="w-full bg-[#E8E6DC] dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442]/30 rounded-xl py-1.5 px-3 text-xs flex items-center justify-between text-[#5E5D59] hover:text-[#141413] dark:hover:text-[#F5F4ED] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#5E5D59] group-hover:text-[#C96442] transition-colors" strokeWidth={1.75} />
            <span className="hidden sm:inline">{t('search_or_jump')}</span>
            <span className="sm:hidden">{t('search')}</span>
          </div>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-white dark:bg-[#252422] px-1.5 py-0.5 rounded border border-[#E8E6DC] dark:border-[#2C2B27] text-[#5E5D59]">
            {platformKey}
          </kbd>
        </button>
      </div>

      {/* RIGHT: Essentials only — language, sync, AI coach, notifications */}
      <div className="flex items-center gap-1.5 shrink-0">
        <LanguageToggle compact className="hidden lg:inline-flex" />
        {onOpenGoogleSync && (
          <button
            id="btn-nav-google-sync"
            data-tour="sync"
            onClick={onOpenGoogleSync}
            aria-label="Google Workspace Sync Hub"
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              isGoogleConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                : 'bg-[#E8E6DC] dark:bg-[#1F1E1B] text-[#5E5D59] dark:text-[#B5B2A8] border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442]'
            }`}
            title="Google Workspace Sync Hub"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin text-[#C96442]' : isGoogleConnected ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
            <span className="hidden md:inline text-[11px]">{isSyncingGoogle ? t('syncing') : isGoogleConnected ? 'Google Sync' : t('connect_google')}</span>
          </button>
        )}

        <button
          id="btn-nav-ai-coach"
          data-tour="coach"
          onClick={onToggleAiChat}
          aria-label="AI Study Coach"
          aria-expanded={isAiChatOpen}
          className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
            isAiChatOpen
              ? 'bg-[#B85C38] border-[#B85C38] text-white shadow-xs'
              : 'bg-[#F6DDCC] hover:bg-[#E2D8C0] text-[#B85C38] border-[#D97757]/30'
          }`}
          title="AI Study Coach"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span className="hidden sm:inline text-[11px]">AI Coach</span>
        </button>

        <div className="relative" data-notif-root>
          <button
            aria-label={`Notifications ${unreadCount ? `(${unreadCount} new)` : ''}`}
            aria-haspopup="dialog"
            aria-expanded={showNotifications}
            onClick={() => {
              setShowNotifications(!showNotifications);
              setHasDismissedBadge(true);
            }}
            onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); setShowNotifications(!showNotifications); setHasDismissedBadge(true);} if(e.key==='Escape') setShowNotifications(false); }}
            className="p-1.5 text-[#5E5D59] hover:text-[#C96442] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] rounded-xl transition-colors cursor-pointer relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" aria-hidden="true" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#141413]" aria-hidden="true" />
            )}
            {unreadCount > 0 && <span className="sr-only" aria-live="polite">{unreadCount} new</span>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1A1917] rounded-2xl shadow-xl border border-[#E8E6DC] dark:border-[#2C2B27] py-2 z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-[#E8E6DC]/60 dark:border-[#2C2B27]/60 flex items-center justify-between">
                <span className="font-bold text-[#141413] dark:text-[#F5F4ED]">Notifications</span>
                <span className="text-[10px] text-[#5E5D59]">{notifications.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#E8E6DC]/40 dark:divide-[#2C2B27]/40">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-[#5E5D59]">No new notifications</div>
                ) : (
                  notifications.map((n, i) => (
                    <button key={n.id || i} onClick={()=>{ setShowNotifications(false); onNotificationClick?.(n); if(n.link && n.link !== '#'){ window.open(n.link,'_blank'); } }} className="w-full text-left p-3 hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer">
                      <div className="font-semibold text-[#141413] dark:text-[#F5F4ED] flex items-center gap-1.5">{n.title} {n.tier==='urgent' && <span className="px-1 py-0.5 rounded text-[9px] bg-rose-100 text-rose-700">Urgent</span>}</div>
                      <div className="text-[11px] text-[#5E5D59]">{n.description}</div>
                      <span className="text-[10px] text-[#C96442] font-bold">Go → {n.source || 'Tracker'}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
