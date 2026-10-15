import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Mail,
  Sparkles,
  RefreshCw,
  Send,
  Plus,
  Search,
  CheckCircle2,
  Filter,
  Globe,
  Tag,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { EmailAlert, EmailMessage, EmailCategory, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { t, useLang } from '../services/i18n';
import {
  trySilentRestore,
  signInWithAccountSelect,
  isConnected,
  wasPreviouslyConnected,
  clearGoogleGrant,
  googleFetch,
} from '../services/googleAuth';
import { auth } from '../services/firebase';

interface GmailRadarTabProps {
  emailAlerts: EmailAlert[];
  rawEmails: EmailMessage[];
  isLoadingEmails: boolean;
  onRefreshEmails: (forceResort?: boolean, options?: { maxResults?: number; mode?: 'inbox' | 'academic' }) => void;
  onOpenQuickDraft: (email?: EmailMessage, alert?: EmailAlert) => void;
  onExtractAssignment: (alert: EmailAlert) => void;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  emailError?: string | null;
  gmailApiInfo?: ApiEnablementInfo | null;
  connectedEmail?: string | null;
  onDisconnectGoogle?: () => void | Promise<void>;
  onUseAnotherAccount?: () => void | Promise<void>;
}

export const GmailRadarTab: React.FC<GmailRadarTabProps> = ({
  emailAlerts,
  rawEmails,
  isLoadingEmails,
  onRefreshEmails,
  onOpenQuickDraft,
  onExtractAssignment,
  isGoogleConnected = true,
  onConnectGoogle,
  emailError,
  gmailApiInfo,
  connectedEmail = null,
  onDisconnectGoogle,
  onUseAnotherAccount,
}) => {
  useLang();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(connectedEmail);
  const [liveConnected, setLiveConnected] = useState<boolean>(isGoogleConnected);
  const autoTriedRef = useRef(false);

  // Keep the displayed account in sync with the explicit prop + Firebase user.
  useEffect(() => {
    if (connectedEmail) {
      setAccountEmail(connectedEmail);
      return;
    }
    try {
      const fbEmail = auth?.currentUser?.email || null;
      if (fbEmail) {
        setAccountEmail((prev) => prev || fbEmail);
        return;
      }
    } catch {}
    try {
      const cached = localStorage.getItem('scc_google_email_v1');
      if (cached && cached.includes('@')) setAccountEmail((prev) => prev || cached);
    } catch {}
  }, [connectedEmail]);

  useEffect(() => {
    setLiveConnected(isGoogleConnected);
  }, [isGoogleConnected]);

  // Instant Workspace restore: on mount, silently resume a prior grant and
  // load Gmail data without requiring a click. Failures fall back quietly to
  // the manual Connect button (no error spam).
  useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        if (!wasPreviouslyConnected() && !isConnected()) return;
      } catch {
        return;
      }
      setRestoring(true);
      try {
        const token = await trySilentRestore({ gmail: true });
        if (cancelled) return;
        if (token) {
          setLiveConnected(true);
          // Best-effort: resolve the Gmail address for the status line.
          try {
            const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile');
            if (res?.ok) {
              const data = await res.json().catch(() => ({}));
              const gmail = typeof data?.emailAddress === 'string' ? data.emailAddress : null;
              if (gmail && !cancelled) {
                setAccountEmail(gmail);
                try {
                  localStorage.setItem('scc_google_email_v1', gmail);
                } catch {}
              }
            }
          } catch {}
          try {
            onRefreshEmails(true);
          } catch {}
        }
      } catch {
        // Silent fallback to the manual Connect button.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: restore once per view, never loop on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectClick = async () => {
    if (onConnectGoogle) {
      await onConnectGoogle();
      try {
        setLiveConnected(isConnected());
      } catch {}
      return;
    }
    setRestoring(true);
    try {
      const token = await trySilentRestore({ gmail: true });
      if (!token) {
        const fresh = await signInWithAccountSelect({ gmail: true }).catch(() => null);
        if (fresh) {
          setLiveConnected(true);
          try {
            onRefreshEmails(true);
          } catch {}
        }
      } else {
        setLiveConnected(true);
        try {
          onRefreshEmails(true);
        } catch {}
      }
    } catch {
      // Manual fallback stays visible; no toast spam from auto paths.
    } finally {
      setRestoring(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    if (onUseAnotherAccount) {
      await onUseAnotherAccount();
      return;
    }
    setSwitching(true);
    try {
      const token = await signInWithAccountSelect({ gmail: true }).catch(() => null);
      if (token) {
        setLiveConnected(true);
        try {
          const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile');
          if (res?.ok) {
            const data = await res.json().catch(() => ({}));
            const gmail = typeof data?.emailAddress === 'string' ? data.emailAddress : null;
            if (gmail) {
              setAccountEmail(gmail);
              try {
                localStorage.setItem('scc_google_email_v1', gmail);
              } catch {}
            }
          }
        } catch {}
        try {
          onRefreshEmails(true);
        } catch {}
      }
    } catch {
      // Dismissals stay silent; the current session is untouched.
    } finally {
      setSwitching(false);
    }
  };

  const handleDisconnectClick = async () => {
    if (onDisconnectGoogle) {
      await onDisconnectGoogle();
      setLiveConnected(false);
      return;
    }
    try {
      await clearGoogleGrant(auth?.currentUser?.uid || null);
    } catch {}
    try {
      localStorage.removeItem('scc_google_email_v1');
    } catch {}
    setAccountEmail(null);
    setLiveConnected(false);
  };

  const showConnected = liveConnected || isGoogleConnected;

  const matchesCategory = (alert: EmailAlert, cat: string) => {
    if (cat === 'ALL') return true;
    if (cat === 'PROMOTIONS') {
      // Spam + Promotions share one category (Gmail-native, not hidden).
      const labels = alert.gmailLabels || alert.rawEmail?.labelIds || [];
      return (
        alert.category === 'PROMOTION' ||
        alert.category === 'SPAM' ||
        labels.includes('SPAM') ||
        labels.includes('CATEGORY_PROMOTIONS')
      );
    }
    if (cat === 'SOCIAL') {
      const labels = alert.gmailLabels || alert.rawEmail?.labelIds || [];
      return alert.category === 'SOCIAL' || labels.includes('CATEGORY_SOCIAL');
    }
    return alert.category === cat;
  };

  const filteredAlerts = useMemo(() => {
    return emailAlerts.filter((alert) => {
      if (!matchesCategory(alert, activeCategory)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = alert.subject.toLowerCase().includes(q);
        const matchSender = alert.sender.toLowerCase().includes(q);
        const matchAction = (alert.oneLineSummary || '').toLowerCase().includes(q);
        if (!matchSubject && !matchSender && !matchAction) return false;
      }
      return true;
    });
  }, [emailAlerts, activeCategory, searchQuery]);

  // Unread counts per category tab, derived from existing data only.
  // An alert counts as unread via its attached rawEmail flag, falling back
  // to the rawEmails prop joined the same way as activeRawEmail below.
  const unreadCounts = useMemo(() => {
    const rawById = new Map(rawEmails.map((e) => [e.id, e]));
    const rawBySubject = new Map(rawEmails.map((e) => [e.subject, e]));
    const isUnread = (alert: EmailAlert) => {
      if (alert.rawEmail?.unread !== undefined) return alert.rawEmail.unread;
      const raw = rawById.get(alert.id) ?? rawBySubject.get(alert.subject);
      return raw?.unread ?? false;
    };
    const counts: Record<string, number> = {};
    for (const cat of ['ALL', 'ASSIGNMENT', 'EXAM', 'ANNOUNCEMENT', 'PROMOTIONS', 'SOCIAL', 'GENERAL']) {
      counts[cat] = emailAlerts.filter((a) => matchesCategory(a, cat) && isUnread(a)).length;
    }
    return counts;
  }, [emailAlerts, rawEmails]);

  // Set initial selected alert if none selected
  const activeAlert = useMemo(() => {
    if (selectedAlertId) {
      const found = filteredAlerts.find((a) => a.id === selectedAlertId);
      if (found) return found;
    }
    return filteredAlerts[0] || null;
  }, [selectedAlertId, filteredAlerts]);

  // Find corresponding raw email
  const activeRawEmail = useMemo(() => {
    if (!activeAlert) return null;
    return rawEmails.find((e) => e.id === activeAlert.id || e.subject === activeAlert.subject) || null;
  }, [activeAlert, rawEmails]);

  return (
    <div className="space-y-4">
      {/* Gmail connection status: silent auto-restore on mount, manual
          Connect fallback, explicit account switching, email + Disconnect. */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs text-xs">
        {restoring ? (
          <span className="flex items-center gap-2 text-[#5C5A54] dark:text-[#B5B2A8] font-semibold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D97757]" />
            {t('gmail_scanning') === 'gmail_scanning' ? 'Reconnecting Gmail…' : t('gmail_scanning')}
          </span>
        ) : showConnected ? (
          <span className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold text-[#141413] dark:text-[#FAF9F5] truncate">
              {accountEmail ? `Connected as ${accountEmail}` : t('gmail_connected_fallback') === 'gmail_connected_fallback' ? 'Gmail connected' : t('gmail_connected_fallback')}
            </span>
          </span>
        ) : (
          <span className="font-semibold text-[#5C5A54] dark:text-[#B5B2A8]">
            {t('gmail_not_connected') === 'gmail_not_connected' ? 'Gmail is not connected.' : t('gmail_not_connected')}
          </span>
        )}
        <div className="flex items-center gap-2">
          {showConnected && !restoring ? (
            <>
              <button
                onClick={handleUseAnotherAccount}
                disabled={switching}
                className="px-2.5 py-1 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-lg font-semibold cursor-pointer disabled:opacity-60"
              >
                {switching ? 'Switching…' : 'Use another account'}
              </button>
              <button
                onClick={handleDisconnectClick}
                className="px-2.5 py-1 bg-transparent border border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:text-rose-600 hover:border-rose-300 rounded-lg font-semibold cursor-pointer"
              >
                Disconnect
              </button>
            </>
          ) : !restoring ? (
            <>
              <button
                onClick={handleConnectClick}
                className="px-2.5 py-1 bg-[#D97757] hover:bg-[#C86646] text-white rounded-lg font-semibold cursor-pointer"
              >
                {t('gmail_connect')}
              </button>
              <button
                onClick={handleUseAnotherAccount}
                disabled={switching}
                className="px-2.5 py-1 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-lg font-semibold cursor-pointer disabled:opacity-60"
              >
                {switching ? 'Switching…' : 'Use another account'}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        
        {/* Category Filter Pills — ALL default, PROMOTIONS = spam+promo, SOCIAL separate */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'ASSIGNMENT', 'EXAM', 'ANNOUNCEMENT', 'PROMOTIONS', 'SOCIAL', 'GENERAL'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] border border-[#DFDACB] dark:border-[#2C2B27]'
              }`}
            >
              {cat === 'ALL'
                ? t('gmail_all')
                : cat === 'PROMOTIONS'
                ? t('gmail_promos')
                : cat === 'ASSIGNMENT'
                ? t('gmail_assignment')
                : cat === 'EXAM'
                ? t('exam')
                : cat === 'ANNOUNCEMENT'
                ? t('gmail_announcement')
                : cat === 'SOCIAL'
                ? 'Social'
                : t('gmail_general')}
              {unreadCounts[cat] > 0 && (
                <span
                  aria-label={`${unreadCounts[cat]} ${t('gmail_unread')}`}
                  className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-extrabold leading-none ${
                    activeCategory === cat ? 'bg-white text-[#D97757]' : 'bg-[#D97757] text-white'
                  }`}
                >
                  {unreadCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>

          {/* Right Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-[#6B6860] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('gmail_search_ph')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
            />
          </div>

          {/* Bulk archive spam */}
          {filteredAlerts.some(a=>a.isSpam) && (
            <button onClick={()=>{
              const spamIds = filteredAlerts.filter(a=>a.isSpam).map(a=>a.id);
              // dispatch bulk archive — parent will filter via future prop; for now just toast
              window.dispatchEvent(new CustomEvent('scc-toast', { detail: { title: t('gmail_spam_archived'), message: `${t('gmail_archived')} ${spamIds.length} ${t('gmail_spam_msgs')}` }}));
              // also try to call gmail archive via token if available (placeholder)
            }} className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40">
              {t('gmail_archive_spam')} ({filteredAlerts.filter(a=>a.isSpam).length})
            </button>
          )}

          <button
            onClick={() => onRefreshEmails(true)}
            disabled={isLoadingEmails}
            className="p-1.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl transition-colors cursor-pointer"
            title={t('gmail_refresh_inbox')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingEmails ? 'animate-spin text-[#D97757]' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {gmailApiInfo ? (
        <ApiActivationBanner info={gmailApiInfo} onRetry={() => onRefreshEmails(true)} isRetrying={isLoadingEmails} />
      ) : emailError ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <span>{emailError}</span>
          <button onClick={handleConnectClick} className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-semibold cursor-pointer">
            {t('gmail_connect')}
          </button>
        </div>
      ) : null}

      {/* TWO-PANE MASTER-DETAIL LAYOUT */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] overflow-hidden shadow-xs flex flex-col md:flex-row h-[600px]">
        
        {/* LEFT MASTER PANE: Compact Email List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-[#DFDACB] dark:border-[#2C2B27] flex flex-col bg-[#FAF9F5] dark:bg-[#1F1E1B] overflow-hidden">
          <div className="p-3 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60 flex items-center justify-between text-xs font-bold text-[#8C897F]">
            <span>{t('gmail_inbox_items')}</span>
            <span>{filteredAlerts.length} {t('gmail_messages')}</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#DFDACB]/40 dark:divide-[#2C2B27]/40">
            {isLoadingEmails ? (
              <div className="p-12 text-center text-[#8C897F] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#D97757]" />
                <span className="text-xs">{t('gmail_scanning')}</span>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-[#8C897F] text-xs">
                {t('gmail_empty')}
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = activeAlert?.id === alert.id;
                const isHigh = alert.urgency === 'HIGH' || alert.category === 'EXAM';

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    className={`p-3.5 hover:bg-white dark:hover:bg-[#141413] transition-colors cursor-pointer text-left ${
                      isSelected ? 'bg-white dark:bg-[#141413] font-semibold border-l-3 border-[#D97757]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate max-w-[160px]">
                        {alert.sender}
                      </span>
                      <span className="text-[10px] text-[#8C897F] shrink-0">
                        {alert.detectedAssignment?.dueDate || t('gmail_recent')}
                      </span>
                    </div>

                    <div className="text-xs text-[#141413] dark:text-[#FAF9F5] font-semibold truncate mb-1">
                      {alert.subject}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#D97757]/15 text-[#D97757]">
                        {alert.category}
                      </span>
                      {isHigh && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          {t('gmail_urgent')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT DETAIL PANE: Full Email Reader & Action Studio */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#141413] overflow-hidden">
          {activeAlert ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Reader Header */}
              <div className="p-6 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60 flex items-start justify-between gap-4 bg-[#FAF9F5]/40 dark:bg-[#1F1E1B]/40">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5] leading-snug">
                    {activeAlert.subject}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#8C897F]">
                    <span>{t('gmail_from')} <strong className="text-[#141413] dark:text-[#FAF9F5]">{activeAlert.sender}</strong></span>
                    <span>•</span>
                    <span>{activeRawEmail?.date || t('gmail_recent')}</span>
                  </div>
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onExtractAssignment(activeAlert)}
                    className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>{t('gmail_create_task')}</span>
                  </button>

                  <button
                    onClick={() => onOpenQuickDraft(activeRawEmail || undefined, activeAlert)}
                    className="px-3.5 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('gmail_draft_reply')}</span>
                  </button>
                </div>
              </div>

              {/* Reader Body & AI Insights */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">

                {/* Div C: missing-date chip + open-source link (detail pane only) */}
                {!(activeAlert.detectedAssignment as any)?.dueDate && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      <Clock className="w-3 h-3" />
                      Unknown deadline
                    </span>
                    <a
                      href={`https://mail.google.com/mail/u/0/#inbox/${activeRawEmail?.threadId || activeRawEmail?.id || activeAlert.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97757] hover:underline"
                    >
                      Open source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* AI Summary Banner */}
                {activeAlert.oneLineSummary && (
                  <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#D97757]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('gmail_ai_rec')}</span>
                    </div>
                    <p className="text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed">
                      {activeAlert.oneLineSummary}
                    </p>
                  </div>
                )}

                {/* Email Body */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C897F]">
                    {t('gmail_original')}
                  </span>
                  <div className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] text-xs text-[#141413] dark:text-[#FAF9F5] leading-relaxed whitespace-pre-line font-sans">
                    {activeRawEmail?.body || activeRawEmail?.snippet || activeAlert.oneLineSummary || t('gmail_no_preview')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#8C897F] text-center space-y-2">
              <Mail className="w-10 h-10 opacity-30" />
              <p className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">{t('gmail_select_title')}</p>
              <p className="text-[11px] max-w-xs">{t('gmail_select_hint')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
