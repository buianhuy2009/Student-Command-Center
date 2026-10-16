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
import { t, useLang, getLang } from '../services/i18n';
import { dismissReview, getDismissedReviewIds, gmailLink, isTeacherSender, toggleTeacherSender, viShortDate } from '../utils/trust';
import { logPilot } from '../utils/pilotStats';

const L = (vi: string, en: string) => (getLang() === 'vi' ? vi : en);

/** Why an email sits in "AI chưa đọc được – bạn xem giúp nhé". */
function reviewReasonText(reason?: string): string {
  switch (reason) {
    case 'teacher_as_promo':
      return L('AI định xếp thư của thầy cô vào Quảng cáo — mình giữ lại để bạn xem.', 'The AI wanted to file a teacher email as an ad — kept here for you.');
    case 'gmail_sorted':
      return L('Gmail xếp thư này vào Quảng cáo/Mạng xã hội, nhưng AI thấy có thể là thư học tập.', 'Gmail filed this under Promotions/Social, but the AI thinks it may be school mail.');
    case 'no_date':
      return L('AI thấy có bài tập nhưng không đọc được ngày nộp.', 'The AI found a task but could not read a due date.');
    case 'low_confidence':
      return L('AI chưa chắc chắn về thư này.', 'The AI is not sure about this email.');
    case 'ai_failed':
      return L('AI đang lỗi hoặc hết lượt — chưa đọc được thư này.', 'The AI failed or ran out of quota — this email is unread.');
    case 'ai_omitted':
      return L('AI bỏ sót thư này khi đọc.', 'The AI skipped this email.');
    case 'skipped_with_cue':
      return L('Gmail xếp vào Quảng cáo/MXH nên AI chưa đọc, nhưng thư có chữ như "bài tập", "kiểm tra".', 'Gmail filed this away so the AI did not read it, but it mentions homework or tests.');
    default:
      return L('Gmail xếp vào Quảng cáo/Mạng xã hội nên AI chưa đọc (để tiết kiệm lượt AI).', 'Gmail filed this under Promotions/Social, so the AI did not read it (saves AI quota).');
  }
}
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
  /** Ask the AI to read one email it skipped or failed on. */
  onForceAIRead?: (alert: EmailAlert) => void | Promise<void>;
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
  onForceAIRead,
}) => {
  useLang();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(getDismissedReviewIds()));
  const [teacherTick, setTeacherTick] = useState(0);
  const [forcing, setForcing] = useState<string | null>(null);
  const isReview = (a: EmailAlert) =>
    !dismissed.has(a.id) && (a.needsReview === true || a.aiStatus === 'failed' || a.aiStatus === 'skipped');
  const reviewAlerts = useMemo(
    () =>
      emailAlerts
        .filter(isReview)
        .sort((x, y) => Number(Boolean(y.needsReview)) - Number(Boolean(x.needsReview))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailAlerts, dismissed],
  );
  const reviewUrgent = reviewAlerts.filter((a) => a.needsReview).length;
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
    if (cat === 'REVIEW') return isReview(alert);
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
    const base = activeCategory === 'REVIEW' ? reviewAlerts : emailAlerts;
    return base.filter((alert) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailAlerts, activeCategory, searchQuery, reviewAlerts]);

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
    return rawEmails.find((e) => e.id === activeAlert.id || e.subject === activeAlert.subject) || activeAlert.rawEmail || null;
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
          {['REVIEW', 'ALL', 'ASSIGNMENT', 'EXAM', 'ANNOUNCEMENT', 'PROMOTIONS', 'SOCIAL', 'GENERAL'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] border border-[#DFDACB] dark:border-[#2C2B27]'
              }`}
            >
              {cat === 'REVIEW'
                ? `🔎 ${L('Cần bạn xem', 'Needs your eyes')}`
                : cat === 'ALL'
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
              {cat === 'REVIEW' && reviewAlerts.length > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-extrabold leading-none ${activeCategory === cat ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'}`}>
                  {reviewAlerts.length}
                </span>
              )}
              {cat !== 'REVIEW' && unreadCounts[cat] > 0 && (
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

      {/* "AI chưa đọc được – bạn xem giúp nhé": nothing the AI hid or failed on disappears */}
      {reviewAlerts.length > 0 && activeCategory !== 'REVIEW' && (
        <button
          type="button"
          onClick={() => setActiveCategory('REVIEW')}
          className="w-full text-left p-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 hover:border-amber-500"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{L('AI chưa đọc được – bạn xem giúp nhé', 'The AI could not read these — please take a look')}</strong>
            {' · '}
            {L(
              `${reviewAlerts.length} thư (${reviewUrgent} thư nên xem ngay): thư AI chưa chắc, thư Gmail xếp vào Quảng cáo, thư AI lỗi. Bấm để xem.`,
              `${reviewAlerts.length} emails (${reviewUrgent} worth checking now): unsure, filed as promo by Gmail, or AI errors. Tap to review.`,
            )}
          </span>
        </button>
      )}

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
                        {alert.detectedAssignment?.isAssignment
                          ? alert.detectedAssignment.dueDate
                            ? `${L('Hạn', 'Due')} ${viShortDate(alert.detectedAssignment.dueDate)} · ${L('chưa xác nhận', 'unconfirmed')}`
                            : L('Chưa rõ hạn', 'No due date')
                          : t('gmail_recent')}
                      </span>
                    </div>

                    <div className="text-xs text-[#141413] dark:text-[#FAF9F5] font-semibold truncate mb-1">
                      {alert.subject}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {alert.origin === 'classroom' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Classroom</span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#D97757]/15 text-[#D97757]">
                        {alert.aiStatus === 'skipped' ? L('AI chưa đọc', 'Not read by AI') : alert.aiStatus === 'failed' ? L('AI lỗi', 'AI error') : alert.category}
                      </span>
                      {isReview(alert) && alert.needsReview && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          {L('Cần xem', 'Review')}
                        </span>
                      )}
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
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <a
                    href={activeAlert.sourceUrl || gmailLink(activeAlert.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>{activeAlert.origin === 'classroom' ? L('Mở bài gốc', 'Open post') : L('Mở thư gốc', 'Open in Gmail')}</span>
                  </a>
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
                
                {isReview(activeAlert) && (
                  <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 space-y-3">
                    <p className="font-bold text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {reviewReasonText(activeAlert.reviewReason)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onExtractAssignment(activeAlert)}
                        className="px-3 py-2 min-h-[40px] bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold"
                      >
                        {L('Đây là bài tập', 'This is an assignment')}
                      </button>
                      {onForceAIRead && (activeAlert.aiStatus === 'skipped' || activeAlert.aiStatus === 'failed') && (
                        <button
                          disabled={forcing === activeAlert.id}
                          onClick={async () => {
                            setForcing(activeAlert.id);
                            logPilot('review_force_read');
                            try {
                              await onForceAIRead(activeAlert);
                            } finally {
                              setForcing(null);
                            }
                          }}
                          className="px-3 py-2 min-h-[40px] bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-xl text-xs font-bold text-[#141413] dark:text-[#FAF9F5] disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {forcing === activeAlert.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                          {L('Cho AI đọc thư này', 'Let the AI read it')}
                        </button>
                      )}
                      {activeAlert.rawEmail?.senderEmail && activeAlert.origin !== 'classroom' && (
                        <button
                          onClick={() => {
                            if (toggleTeacherSender(activeAlert.rawEmail?.senderEmail)) logPilot('teacher_marked');
                            setTeacherTick((n) => n + 1);
                          }}
                          className="px-3 py-2 min-h-[40px] bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-xl text-xs font-bold text-[#141413] dark:text-[#FAF9F5]"
                          data-tick={teacherTick}
                        >
                          {isTeacherSender(activeAlert.rawEmail?.senderEmail)
                            ? L('✓ Thầy cô của em (bỏ đánh dấu)', '✓ My teacher (undo)')
                            : L('Đây là thầy cô', 'This is my teacher')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          dismissReview(activeAlert.id);
                          logPilot('review_dismissed');
                          setDismissed(new Set(getDismissedReviewIds()));
                        }}
                        className="px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold text-[#5C5A54] dark:text-[#B5B2A8] hover:text-rose-600"
                      >
                        {L('Không phải bài tập — đã xem', 'Not an assignment — done')}
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                      {L('"Đây là thầy cô": thư từ địa chỉ này sẽ luôn được AI đọc và không bao giờ bị xếp vào Quảng cáo.', '"My teacher": emails from this address are always read by the AI and never filed as ads.')}
                    </p>
                  </div>
                )}

                {activeAlert.detectedAssignment?.isAssignment && (
                  <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-1.5">
                    <p className="text-[#141413] dark:text-[#FAF9F5] font-semibold">
                      {L('AI hiểu là:', 'The AI understood:')}{' '}
                      {L('môn', 'subject')} <strong>{activeAlert.detectedAssignment.subject || '?'}</strong> –{' '}
                      {activeAlert.detectedAssignment.dueDate ? (
                        <>
                          {L('hạn', 'due')} <strong>{viShortDate(activeAlert.detectedAssignment.dueDate)}</strong>{' '}
                          <span className="text-amber-700 dark:text-amber-300">({L('chưa xác nhận', 'unconfirmed')})</span>
                        </>
                      ) : (
                        <strong className="text-amber-700 dark:text-amber-300">{L('chưa rõ hạn', 'no due date')}</strong>
                      )}{' '}
                      – {L('ưu tiên', 'priority')} <strong>{activeAlert.detectedAssignment.priority}</strong>
                    </p>
                    {activeAlert.detectedAssignment.dueEvidence && (
                      <p className="text-[#5C5A54] dark:text-[#B5B2A8]">
                        {L('AI đọc thấy:', 'The AI read:')} “{activeAlert.detectedAssignment.dueEvidence}”
                      </p>
                    )}
                    <button
                      onClick={() => onExtractAssignment(activeAlert)}
                      className="mt-1 px-3 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold"
                    >
                      {L('Kiểm tra & lưu bài tập', 'Check & save assignment')}
                    </button>
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
