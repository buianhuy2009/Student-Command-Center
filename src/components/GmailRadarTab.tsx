import React, { useState, useMemo, useEffect } from 'react';
import {
  Mail,
  Sparkles,
  RefreshCw,
  Send,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Bot,
  MoreHorizontal,
  ArrowLeft,
  FlaskConical,
  Clock,
} from 'lucide-react';
import { EmailAlert, EmailMessage, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { AiProgressBar } from './ui/AiProgressBar';
import { useAiJobsStore } from '../store/aiJobsStore';
import { useT } from '../services/i18n';
import { dismissReview, getDismissedReviewIds, gmailLink, isTeacherSender, toggleTeacherSender } from '../utils/trust';
import { logPilot } from '../utils/pilotStats';
import {
  trySilentRestore,
  signInWithAccountSelect,
  requestFeaturePermission,
  hasFeatureAccess,
  hasScope,
  isConnected,
  clearGoogleGrant,
  googleFetch,
} from '../services/googleAuth';
import { auth } from '../services/firebase';

function formatShortDueDate(
  iso: string,
  formatDate: ReturnType<typeof useT>['formatDate'],
): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const localDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return formatDate(localDate, { day: 'numeric', month: 'numeric' }) || iso;
  }
  return formatDate(iso, { day: 'numeric', month: 'numeric' }) || iso;
}

/** Why an email sits in "The AI could not read these — please take a look". */
function reviewReasonText(reason: string | undefined, t: ReturnType<typeof useT>['t']): string {
  switch (reason) {
    case 'teacher_as_promo':
      return t('gmail_reason_teacher_as_promo');
    case 'gmail_sorted':
      return t('gmail_reason_gmail_sorted');
    case 'no_date':
      return t('gmail_reason_no_date');
    case 'low_confidence':
      return t('gmail_reason_low_confidence');
    case 'ai_failed':
      return t('gmail_reason_ai_failed');
    case 'ai_omitted':
      return t('gmail_reason_ai_omitted');
    case 'skipped_with_cue':
      return t('gmail_reason_skipped_with_cue');
    default:
      return t('gmail_reason_default');
  }
}

const DEMO_SAMPLE_ALERTS: EmailAlert[] = [
  {
    id: 'demo-err-date',
    sender: 'Thầy Minh (Hoá học)',
    subject: '[Hoá 9] Báo cáo thí nghiệm phản ứng oxi hoá - khử',
    oneLineSummary: 'AI trích xuất hạn nộp (tạm): 2026-11-24 — hãy đối chiếu lại câu gốc trong thư trước khi lưu.',
    urgency: 'HIGH',
    category: 'ASSIGNMENT',
    aiStatus: 'ok',
    needsReview: true,
    reviewReason: 'low_confidence',
    detectedAssignment: {
      isAssignment: true,
      name: 'Báo cáo thí nghiệm oxi hoá - khử',
      subject: 'Hoá học',
      dueDate: '2026-11-24',
      priority: 'Med',
      dueEvidence: 'Các em hoàn thành báo cáo và nộp lại vào thứ 6 tuần tới (27/11) trước 20h nhé.',
      dueConfidence: 'relative',
    },
    rawEmail: {
      id: 'demo-err-date',
      threadId: 'demo-err-date',
      sender: 'Thầy Minh (Hoá học)',
      senderEmail: 'thayminh.hoa@school.edu.vn',
      subject: '[Hoá 9] Báo cáo thí nghiệm phản ứng oxi hoá - khử',
      date: 'Hôm nay',
      snippet: 'Các em hoàn thành báo cáo và nộp lại vào thứ 6 tuần tới (27/11) trước 20h nhé.',
      body: 'Chào cả lớp,\n\nSau buổi thực hành sáng nay, các em hoàn thành báo cáo và nộp lại vào thứ 6 tuần tới (27/11) trước 20h nhé.\nLưu ý ghi rõ phương trình phản ứng và nhận xét hiện tượng.\n\nThầy Minh',
      unread: true,
      labelIds: ['INBOX', 'UNREAD'],
    },
  },
  {
    id: 'demo-no-date',
    sender: 'Cô Hương (Ngữ Văn)',
    subject: 'Bài viết phân tích đoạn trích Truyện Kiều',
    oneLineSummary: 'Thư có nhắc bài tập nhưng không ghi rõ ngày nộp — AI không tự đặt hạn nộp.',
    urgency: 'MEDIUM',
    category: 'ASSIGNMENT',
    aiStatus: 'ok',
    needsReview: true,
    reviewReason: 'no_date',
    detectedAssignment: {
      isAssignment: true,
      name: 'Phân tích đoạn trích Truyện Kiều',
      subject: 'Ngữ Văn',
      dueDate: '',
      priority: 'Med',
      dueEvidence: 'Các em chuẩn bị dàn ý bài viết ở nhà, tiết sau cô sẽ báo lịch thu bài.',
      dueConfidence: 'none',
    },
    rawEmail: {
      id: 'demo-no-date',
      threadId: 'demo-no-date',
      sender: 'Cô Hương (Ngữ Văn)',
      senderEmail: 'cohuong.van@gmail.com',
      subject: 'Bài viết phân tích đoạn trích Truyện Kiều',
      date: 'Hôm qua',
      snippet: 'Các em chuẩn bị dàn ý bài viết ở nhà, tiết sau cô sẽ báo lịch thu bài.',
      body: 'Các em thân mến,\n\nCác em chuẩn bị dàn ý bài viết ở nhà, tiết sau cô sẽ báo lịch thu bài.\nKhông cần nộp bản cứng hôm nay.\n\nCô Hương',
      unread: true,
      labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
    },
  },
];

interface GmailRadarTabProps {
  emailAlerts: EmailAlert[];
  rawEmails: EmailMessage[];
  isLoadingEmails: boolean;
  emailLoadStage?: 'idle' | 'fetching' | 'analyzing';
  emailsLastSyncedAt?: string | null;
  emailsAreCachedOnly?: boolean;
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
  emailLoadStage = 'idle',
  emailsLastSyncedAt = null,
  emailsAreCachedOnly = false,
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
  const { t, formatDate, formatTime } = useT();
  const gmailJob = useAiJobsStore((s) => s.jobs['gmail-scan']);
  const cancelJob = useAiJobsStore((s) => s.cancelJob);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(getDismissedReviewIds()));
  const [teacherTick, setTeacherTick] = useState(0);
  const [forcing, setForcing] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const effectiveAlerts = useMemo(
    () => (demoMode ? [...DEMO_SAMPLE_ALERTS, ...emailAlerts] : emailAlerts),
    [demoMode, emailAlerts]
  );

  const isReview = (a: EmailAlert) =>
    !dismissed.has(a.id) && (a.needsReview === true || a.aiStatus === 'failed' || a.aiStatus === 'skipped');

  const reviewAlerts = useMemo(
    () =>
      effectiveAlerts
        .filter(isReview)
        .sort((x, y) => Number(Boolean(y.needsReview)) - Number(Boolean(x.needsReview))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveAlerts, dismissed],
  );
  const reviewUrgent = reviewAlerts.filter((a) => a.needsReview).length;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [mobileShowReader, setMobileShowReader] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [isArchivingSpam, setIsArchivingSpam] = useState(false);
  const [spamActionError, setSpamActionError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(connectedEmail);
  const [liveConnected, setLiveConnected] = useState<boolean>(isGoogleConnected);
  const autoTriedRef = React.useRef(false);

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

  useEffect(() => {
    if (!showMoreMenu) return;
    const onOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-gmail-more-menu]')) setShowMoreMenu(false);
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [showMoreMenu]);

  useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    let cancelled = false;
    (async () => {
      const uid = auth?.currentUser?.uid || null;
      try {
        if (!hasFeatureAccess('gmail', uid)) return;
      } catch {
        return;
      }
      setRestoring(true);
      try {
        const token = await trySilentRestore({ feature: 'gmail', uid });
        if (cancelled) return;
        if (token) {
          setLiveConnected(true);
          try {
            const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile');
            if (res?.ok) {
              const data = await res.json().catch(() => ({}));
              const gmail = typeof data?.emailAddress === 'string' ? data.emailAddress : null;
              if (gmail && !cancelled) {
                setAccountEmail(gmail);
                try { localStorage.setItem('scc_google_email_v1', gmail); } catch {}
              }
            }
          } catch {}
          const isStale =
            !emailsLastSyncedAt ||
            !Number.isFinite(Date.parse(emailsLastSyncedAt)) ||
            Date.now() - Date.parse(emailsLastSyncedAt) > 5 * 60 * 1000;
          if (rawEmails.length === 0 || isStale) {
            try { onRefreshEmails(false); } catch {}
          }
        } else {
          setLiveConnected(false);
          if (rawEmails.length === 0) {
            try { onRefreshEmails(false); } catch {}
          }
        }
      } catch {
        if (!cancelled) {
          setLiveConnected(false);
          if (rawEmails.length === 0) {
            try { onRefreshEmails(false); } catch {}
          }
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectClick = async () => {
    if (onConnectGoogle) {
      await onConnectGoogle();
      try {
        setLiveConnected(hasFeatureAccess('gmail', auth?.currentUser?.uid || null) || isConnected());
      } catch {}
      return;
    }
    setRestoring(true);
    try {
      const uid = auth?.currentUser?.uid || undefined;
      const loginHint = auth?.currentUser?.email || undefined;
      const fresh = await requestFeaturePermission('gmail', { loginHint, uid });
      if (fresh) {
        setLiveConnected(true);
        try { onRefreshEmails(true); } catch {}
      }
    } catch {
    } finally {
      setRestoring(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    setShowMoreMenu(false);
    if (onUseAnotherAccount) {
      await onUseAnotherAccount();
      return;
    }
    setSwitching(true);
    setSpamActionError(null);
    try {
      const token = await signInWithAccountSelect({ feature: 'gmail' });
      if (token) {
        setLiveConnected(true);
        try {
          const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile');
          if (res?.ok) {
            const data = await res.json().catch(() => ({}));
            const gmail = typeof data?.emailAddress === 'string' ? data.emailAddress : null;
            if (gmail) {
              setAccountEmail(gmail);
              try { localStorage.setItem('scc_google_email_v1', gmail); } catch {}
            }
          }
        } catch {}
        try { onRefreshEmails(true); } catch {}
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg && !/dismiss|cancel|closed/i.test(msg)) {
        setSpamActionError(msg);
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleDisconnectClick = async () => {
    setShowMoreMenu(false);
    if (onDisconnectGoogle) {
      await onDisconnectGoogle();
      setLiveConnected(false);
      return;
    }
    try { await clearGoogleGrant(auth?.currentUser?.uid || null); } catch {}
    try { localStorage.removeItem('scc_google_email_v1'); } catch {}
    setAccountEmail(null);
    setLiveConnected(false);
  };

  const showConnected = liveConnected || isGoogleConnected;

  const matchesCategory = (alert: EmailAlert, cat: string) => {
    if (cat === 'ALL') return true;
    if (cat === 'REVIEW') return isReview(alert);
    if (cat === 'TASKS') return alert.category === 'ASSIGNMENT' || alert.category === 'EXAM';
    if (cat === 'OTHER') {
      const labels = alert.gmailLabels || alert.rawEmail?.labelIds || [];
      return (
        alert.category === 'PROMOTION' ||
        alert.category === 'SPAM' ||
        alert.category === 'SOCIAL' ||
        alert.category === 'GENERAL' ||
        labels.includes('SPAM') ||
        labels.includes('CATEGORY_PROMOTIONS') ||
        labels.includes('CATEGORY_SOCIAL')
      );
    }
    return alert.category === cat;
  };

  const filteredAlerts = useMemo(() => {
    const base = activeCategory === 'REVIEW' ? reviewAlerts : effectiveAlerts;
    return base.filter((alert) => {
      if (archivedIds.includes(alert.id)) return false;
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
  }, [effectiveAlerts, activeCategory, searchQuery, reviewAlerts, archivedIds]);

  const unreadCounts = useMemo(() => {
    const rawById = new Map(rawEmails.map((e) => [e.id, e]));
    const rawBySubject = new Map(rawEmails.map((e) => [e.subject, e]));
    const isUnread = (alert: EmailAlert) => {
      if (alert.rawEmail?.unread !== undefined) return alert.rawEmail.unread;
      const raw = rawById.get(alert.id) ?? rawBySubject.get(alert.subject);
      return raw?.unread ?? false;
    };
    const counts: Record<string, number> = {};
    for (const cat of ['ALL', 'TASKS', 'ANNOUNCEMENT', 'OTHER']) {
      counts[cat] = effectiveAlerts.filter(
        (a) => !archivedIds.includes(a.id) && matchesCategory(a, cat) && isUnread(a)
      ).length;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAlerts, rawEmails, archivedIds]);

  const canModifyGmail = hasScope('gmail.modify', auth?.currentUser?.uid || null);

  const handleBulkArchiveSpam = async () => {
    setShowMoreMenu(false);
    const spamIds = filteredAlerts.filter((a) => a.isSpam && a.id).map((a) => a.id);
    if (spamIds.length === 0 || isArchivingSpam) return;

    if (!canModifyGmail) {
      setArchivedIds((prev) => Array.from(new Set([...prev, ...spamIds])));
      window.dispatchEvent(
        new CustomEvent('scc-toast', {
          detail: {
            title: t('gmail_hidden_title'),
            message: t('gmail_hidden_msg', { count: spamIds.length }),
          },
        })
      );
      return;
    }

    setIsArchivingSpam(true);
    setSpamActionError(null);
    try {
      const rawMessageIds = spamIds.map((id) => id.replace(/^alert-/, ''));
      const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: rawMessageIds, removeLabelIds: ['INBOX'] }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as any));
        const apiMessage = errData?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403 || /scope|permission|insufficient/i.test(apiMessage)) {
          setSpamActionError(t('gmail_readonly_archive_err'));
        } else {
          setSpamActionError(t('gmail_archive_err', { error: apiMessage }));
        }
        return;
      }
      setArchivedIds((prev) => Array.from(new Set([...prev, ...spamIds])));
      window.dispatchEvent(
        new CustomEvent('scc-toast', {
          detail: {
            title: t('gmail_spam_archived'),
            message: `${t('gmail_archived')} ${spamIds.length} ${t('gmail_spam_msgs')}`,
          },
        })
      );
    } catch (err: any) {
      setSpamActionError(err?.message || t('gmail_archive_net_err'));
    } finally {
      setIsArchivingSpam(false);
    }
  };

  const activeAlert = useMemo(() => {
    if (selectedAlertId) {
      const found = filteredAlerts.find((a) => a.id === selectedAlertId);
      if (found) return found;
    }
    return filteredAlerts[0] || null;
  }, [selectedAlertId, filteredAlerts]);

  const activeRawEmail = useMemo(() => {
    if (!activeAlert) return null;
    return rawEmails.find((e) => e.id === activeAlert.id || e.subject === activeAlert.subject) || activeAlert.rawEmail || null;
  }, [activeAlert, rawEmails]);

  const syncFreshnessText = useMemo(() => {
    if (emailsLastSyncedAt && !emailsAreCachedOnly) {
      return t('gmail_synced_at', { time: formatTime(emailsLastSyncedAt) || formatDate(emailsLastSyncedAt) });
    }
    if (effectiveAlerts.length > 0 && (!showConnected || emailsAreCachedOnly)) {
      const dateStr = emailsLastSyncedAt
        ? formatDate(emailsLastSyncedAt)
        : activeRawEmail?.date || 'saved';
      return t('gmail_cached_notice', { date: dateStr });
    }
    return null;
  }, [emailsLastSyncedAt, emailsAreCachedOnly, effectiveAlerts.length, showConnected, activeRawEmail?.date, formatDate, formatTime, t]);

  const loadingBannerText =
    emailLoadStage === 'analyzing'
      ? t('gmail_stage_analyzing')
      : emailLoadStage === 'fetching' || restoring
      ? t('gmail_stage_fetching')
      : t('gmail_scanning');

  const spamCount = filteredAlerts.filter((a) => a.isSpam).length;

  return (
    <div className="space-y-3.5">
      {/* Row 1: Calm Connection & Sync Freshness Header */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {restoring || isLoadingEmails ? (
            <span className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)] shrink-0" />
              <span className="truncate">{loadingBannerText}</span>
            </span>
          ) : showConnected ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)] truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{accountEmail ? t('gmail_connected_as', { email: accountEmail }) : t('gmail_connected_fallback')}</span>
              </span>
              {syncFreshnessText && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    emailsAreCachedOnly
                      ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{syncFreshnessText}</span>
                </span>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--text-secondary)]">{t('gmail_not_connected')}</span>
              {syncFreshnessText && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                  {syncFreshnessText}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDemoMode((v) => !v);
              if (!demoMode) setActiveCategory('REVIEW');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              demoMode
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--border-default)]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{demoMode ? t('gmail_demo_exit') : t('gmail_demo_btn')}</span>
          </button>

          {showConnected ? (
            <button
              type="button"
              onClick={() => onRefreshEmails(true)}
              disabled={isLoadingEmails}
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              title={t('gmail_refresh_inbox')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEmails ? 'animate-spin' : ''}`} />
              <span>{t('gmail_refresh_inbox')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectClick}
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-semibold cursor-pointer"
            >
              {t('gmail_connect')}
            </button>
          )}

          <div className="relative" data-gmail-more-menu>
            <button
              type="button"
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label={t('gmail_more_actions')}
              aria-expanded={showMoreMenu}
              className="p-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-[var(--text-secondary)] cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-[var(--bg-raised)] rounded-xl border border-[var(--border-default)] shadow-lg py-1.5 z-30 text-xs">
                <button
                  type="button"
                  onClick={handleUseAnotherAccount}
                  disabled={switching}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium cursor-pointer"
                >
                  {switching ? t('gmail_switching') : t('gmail_use_another')}
                </button>
                {spamCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkArchiveSpam}
                    disabled={isArchivingSpam}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium cursor-pointer"
                  >
                    {canModifyGmail
                      ? `${t('gmail_archive_spam')} (${spamCount})`
                      : `${t('gmail_hide_in_app')} (${spamCount})`}
                  </button>
                )}
                <a
                  href="https://mail.google.com/mail/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowMoreMenu(false)}
                  className="block px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                >
                  {t('gmail_open_in_gmail')}
                </a>
                {showConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnectClick}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--status-err-bg)] text-[var(--status-err-text)] font-medium cursor-pointer border-t border-[var(--border-hairline)] mt-1 pt-2"
                  >
                    {t('gmail_disconnect')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit multi-step loading progress notice */}
      {(isLoadingEmails || restoring || gmailJob?.status === 'running') && (
        <AiProgressBar
          percent={gmailJob?.status === 'running' ? gmailJob.percent : emailLoadStage === 'analyzing' ? 60 : 20}
          label={gmailJob?.status === 'running' ? gmailJob.label : loadingBannerText}
          detail={t('ai_bg_switch_safe')}
          currentItem={gmailJob?.currentItem}
          totalItems={gmailJob?.totalItems}
          onCancel={gmailJob?.cancel ? () => cancelJob('gmail-scan') : undefined}
        />
      )}

      {/* Demo mode banner */}
      {demoMode && (
        <div className="px-4 py-2.5 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-xs text-[var(--accent-text)] flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{t('gmail_demo_banner')}</span>
          <button
            type="button"
            onClick={() => setDemoMode(false)}
            className="font-bold underline cursor-pointer shrink-0"
          >
            {t('gmail_demo_exit')}
          </button>
        </div>
      )}

      {/* Row 2: Focused 5-Tab Filter Strip + Search */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 md:pb-0">
          {[
            { id: 'ALL', label: t('gmail_all') },
            { id: 'TASKS', label: t('gmail_tab_tasks') },
            { id: 'REVIEW', label: t('gmail_needs_eyes') },
            { id: 'ANNOUNCEMENT', label: t('gmail_announcement') },
            { id: 'OTHER', label: t('gmail_tab_other') },
          ].map((tab) => {
            const isActive = activeCategory === tab.id;
            const countBadge =
              tab.id === 'REVIEW'
                ? reviewAlerts.length
                : unreadCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[var(--accent-fill)] text-white'
                    : 'bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{tab.label}</span>
                {countBadge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.id === 'REVIEW'
                        ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    {countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('gmail_search_ph')}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Spam Archive Error Banner */}
      {spamActionError && (
        <div className="p-3 bg-[var(--status-err-bg)] border border-[var(--status-err-border)] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--status-err-text)]" role="alert">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="break-words">{spamActionError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleConnectClick} className="px-2.5 py-1 bg-[var(--accent-fill)] text-white rounded-lg font-semibold cursor-pointer">
              {t('gmail_connect')}
            </button>
            <button onClick={() => setSpamActionError(null)} className="px-2 py-1 border border-current rounded-lg font-semibold cursor-pointer">
              {t('common_dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {gmailApiInfo ? (
        <ApiActivationBanner info={gmailApiInfo} onRetry={() => onRefreshEmails(true)} isRetrying={isLoadingEmails} />
      ) : emailError ? (
        <div className="p-3 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--status-warn-text)]">
          <span>{emailError}</span>
          <button onClick={handleConnectClick} className="px-2.5 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold cursor-pointer">
            {t('gmail_connect')}
          </button>
        </div>
      ) : null}

      {/* Review banner: nothing the AI hid or failed on disappears */}
      {reviewAlerts.length > 0 && activeCategory !== 'REVIEW' && (
        <button
          type="button"
          onClick={() => setActiveCategory('REVIEW')}
          className="w-full text-left px-3.5 py-2.5 rounded-2xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-xs text-[var(--status-warn-text)] flex items-start gap-2 hover:opacity-95 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{t('gmail_review_banner_title')}</strong>
            {' · '}
            {t('gmail_review_banner_desc', { total: reviewAlerts.length, urgent: reviewUrgent })}
          </span>
        </button>
      )}

      {/* RESPONSIVE TWO-PANE MASTER-DETAIL READER */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden flex flex-col md:flex-row min-h-[440px] md:h-[calc(100dvh-16rem)] md:max-h-[720px]">
        {/* LEFT MASTER PANE */}
        <div
          className={`w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-[var(--border-hairline)] flex-col bg-[var(--bg-subtle)]/40 overflow-hidden ${
            mobileShowReader && activeAlert ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--border-hairline)] flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
            <span>{t('gmail_inbox_items')}</span>
            <span className="tabular-nums">{filteredAlerts.length} {t('gmail_messages')}</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs space-y-3">
                <p>{!showConnected ? t('gmail_connect_empty') : t('gmail_empty')}</p>
                {!showConnected && (
                  <button
                    type="button"
                    onClick={handleConnectClick}
                    className="px-3.5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{t('gmail_connect')}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = activeAlert?.id === alert.id;
                const isHigh = alert.urgency === 'HIGH' || alert.category === 'EXAM';

                return (
                  <button
                    type="button"
                    key={alert.id}
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      setMobileShowReader(true);
                    }}
                    className={`w-full p-3.5 hover:bg-[var(--bg-hover)]/70 transition-colors cursor-pointer text-left block ${
                      isSelected ? 'bg-[var(--bg-surface)] border-l-3 border-[var(--accent-fill)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                        {alert.sender}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">
                        {alert.detectedAssignment?.isAssignment
                          ? alert.detectedAssignment.dueDate
                            ? t('gmail_due_unconfirmed', { date: formatShortDueDate(alert.detectedAssignment.dueDate, formatDate) })
                            : t('gmail_no_due')
                          : t('gmail_recent')}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text-primary)] font-semibold truncate mb-1.5">
                      {alert.subject}
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5">
                      {alert.origin === 'classroom' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]">{t('gmail_classroom_badge')}</span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                        {alert.aiStatus === 'skipped' ? t('gmail_ai_not_read') : alert.aiStatus === 'failed' ? t('gmail_ai_error') : alert.category}
                      </span>
                      {isReview(alert) && alert.needsReview && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]">
                          {t('gmail_review_badge')}
                        </span>
                      )}
                      {isHigh && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-err-bg)] text-[var(--status-err-text)]">
                          {t('gmail_urgent')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT DETAIL PANE */}
        <div
          className={`flex-1 flex-col min-w-0 bg-[var(--bg-surface)] overflow-hidden ${
            mobileShowReader && activeAlert ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeAlert ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Reader Header */}
              <div className="p-4 sm:p-5 border-b border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-start justify-between gap-3 bg-[var(--bg-subtle)]/25">
                <div className="min-w-0 space-y-1">
                  <button
                    type="button"
                    onClick={() => setMobileShowReader(false)}
                    className="md:hidden inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-text)] mb-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('gmail_back_inbox')}</span>
                  </button>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-snug break-words">
                    {activeAlert.subject}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{t('gmail_from')} <strong className="text-[var(--text-primary)]">{activeAlert.sender}</strong></span>
                    <span>•</span>
                    <span>{activeRawEmail?.date || t('gmail_recent')}</span>
                  </div>
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <a
                    href={activeAlert.sourceUrl || gmailLink(activeAlert.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{activeAlert.origin === 'classroom' ? t('gmail_open_post') : t('gmail_open_email')}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onExtractAssignment(activeAlert)}
                    className="px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] hover:border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{t('gmail_create_task')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenQuickDraft(activeRawEmail || undefined, activeAlert)}
                    className="px-3.5 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('gmail_draft_reply')}</span>
                  </button>
                </div>
              </div>

              {/* Reader Body & AI Insights */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {isReview(activeAlert) && (
                  <div className="p-4 rounded-2xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] space-y-3">
                    <p className="font-bold text-[var(--status-warn-text)] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{reviewReasonText(activeAlert.reviewReason, t)}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onExtractAssignment(activeAlert)}
                        className="px-3 py-1.5 min-h-[36px] bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        {t('gmail_is_assignment')}
                      </button>
                      {onForceAIRead && (activeAlert.aiStatus === 'skipped' || activeAlert.aiStatus === 'failed') && (
                        <button
                          type="button"
                          disabled={forcing === activeAlert.id}
                          onClick={async () => {
                            setForcing(activeAlert.id);
                            logPilot('review_force_read');
                            try { await onForceAIRead(activeAlert); } finally { setForcing(null); }
                          }}
                          className="px-3 py-1.5 min-h-[36px] bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] rounded-xl text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                        >
                          {forcing === activeAlert.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                          {t('gmail_force_ai')}
                        </button>
                      )}
                      {activeAlert.rawEmail?.senderEmail && activeAlert.origin !== 'classroom' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (toggleTeacherSender(activeAlert.rawEmail?.senderEmail)) logPilot('teacher_marked');
                            setTeacherTick((n) => n + 1);
                          }}
                          className="px-3 py-1.5 min-h-[36px] bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] rounded-xl text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                          data-tick={teacherTick}
                        >
                          {isTeacherSender(activeAlert.rawEmail?.senderEmail)
                            ? t('gmail_teacher_undo')
                            : t('gmail_teacher_mark')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          dismissReview(activeAlert.id);
                          logPilot('review_dismissed');
                          setDismissed(new Set(getDismissedReviewIds()));
                        }}
                        className="px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--status-err-text)] cursor-pointer"
                      >
                        {t('gmail_not_assignment_done')}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--status-warn-text)] opacity-90">
                      {t('gmail_teacher_hint')}
                    </p>
                  </div>
                )}

                {activeAlert.detectedAssignment?.isAssignment && (
                  <div className="p-4 bg-[var(--bg-subtle)]/70 rounded-2xl border border-[var(--border-hairline)] space-y-2">
                    <p className="text-[var(--text-primary)] font-semibold leading-relaxed">
                      {t('gmail_ai_understood')}{' '}
                      {t('gmail_subj_label')} <strong>{activeAlert.detectedAssignment.subject || '?'}</strong> –{' '}
                      {activeAlert.detectedAssignment.dueDate ? (
                        <>
                          {t('gmail_due_label')} <strong>{formatShortDueDate(activeAlert.detectedAssignment.dueDate, formatDate)}</strong>{' '}
                          <span className="text-[var(--status-warn-text)]">({t('gmail_unconfirmed')})</span>
                        </>
                      ) : (
                        <strong className="text-[var(--status-warn-text)]">{t('gmail_no_due_lower')}</strong>
                      )}{' '}
                      – {t('gmail_priority_label')} <strong>{activeAlert.detectedAssignment.priority === 'High' ? t('confirm_prio_high') : activeAlert.detectedAssignment.priority === 'Low' ? t('confirm_prio_low') : activeAlert.detectedAssignment.priority === 'Med' ? t('confirm_prio_med') : activeAlert.detectedAssignment.priority}</strong>
                    </p>
                    {activeAlert.detectedAssignment.dueEvidence && (
                      <p className="text-[var(--text-secondary)] italic">
                        {t('gmail_ai_read_label')} “{activeAlert.detectedAssignment.dueEvidence}”
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => onExtractAssignment(activeAlert)}
                      className="px-3.5 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {t('gmail_check_save')}
                    </button>
                  </div>
                )}

                {activeAlert.oneLineSummary && (
                  <div className="p-4 bg-[var(--bg-subtle)]/50 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--accent-text)]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('gmail_ai_rec')}</span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed break-words">
                      {activeAlert.oneLineSummary}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('gmail_original')}
                  </span>
                  <div className="p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-line break-words font-sans">
                    {activeRawEmail?.body || activeRawEmail?.snippet || activeAlert.oneLineSummary || t('gmail_no_preview')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-[var(--text-muted)] text-center space-y-2">
              <Mail className="w-10 h-10 opacity-30" />
              <p className="text-xs font-bold text-[var(--text-primary)]">{t('gmail_select_title')}</p>
              <p className="text-[11px] max-w-xs">{t('gmail_select_hint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
