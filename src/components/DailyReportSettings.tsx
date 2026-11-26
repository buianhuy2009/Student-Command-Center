import React, { useState, useEffect } from 'react';
import { Mail, Clock, Send, Eye, CheckCircle2, ExternalLink } from 'lucide-react';
import { Assignment, CalendarEvent } from '../types';
import {
  DAILY_REPORT_SENDER,
  DailyReportConfig,
  loadDailyReportConfig,
  saveDailyReportConfig,
  buildDailyReportContent,
  sendDailyReport,
  getGmt7NowParts,
} from '../services/dailyReport';
import { useT } from '../services/i18n';

interface DailyReportSettingsProps {
  defaultEmail?: string;
  assignments?: Assignment[];
  events?: CalendarEvent[];
  googleAccessToken?: string | null;
}

export const DailyReportSettings: React.FC<DailyReportSettingsProps> = ({
  defaultEmail = '',
  assignments = [],
  events = [],
  googleAccessToken,
}) => {
  const { t } = useT();
  const [config, setConfig] = useState<DailyReportConfig>(() => loadDailyReportConfig(defaultEmail));
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mailtoHref, setMailtoHref] = useState<string | null>(null);

  useEffect(() => {
    if (defaultEmail && !config.email) {
      setConfig((prev) => {
        const next = { ...prev, email: defaultEmail };
        saveDailyReportConfig(next);
        return next;
      });
    }
  }, [defaultEmail, config.email]);

  const updateConfig = (patch: Partial<DailyReportConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveDailyReportConfig(next);
      return next;
    });
  };

  const previewContent = buildDailyReportContent({ assignments, events, config });
  const nowGmt7 = getGmt7NowParts();

  const handleSendTest = async () => {
    if (!config.email.trim()) {
      setStatusMsg({ ok: false, text: t('daily_report_err_email') });
      return;
    }
    setIsSending(true);
    setStatusMsg(null);
    setMailtoHref(null);
    try {
      const res = await sendDailyReport({
        config,
        assignments,
        events,
        googleAccessToken,
      });
      if (res.delivered) {
        updateConfig({ lastSentDateGmt7: res.dateStrGmt7 });
        setStatusMsg({
          ok: true,
          text: t('daily_report_sent_ok', { transport: res.transport === 'gmail' ? 'Gmail' : 'Email' }),
        });
      } else {
        setShowPreview(true);
        const mailUrl = `mailto:${encodeURIComponent(config.email.trim())}?subject=${encodeURIComponent(previewContent.subject)}&body=${encodeURIComponent(previewContent.text)}`;
        setMailtoHref(mailUrl);
        setStatusMsg({ ok: true, text: t('daily_report_preview_ready') });
      }
    } catch (err: any) {
      setStatusMsg({ ok: false, text: err?.message || t('daily_report_err_send') });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-hairline)] space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0 mt-0.5">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              {t('daily_report_title')}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {t('daily_report_sub')}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
              {t('daily_report_sender_label')}: <span className="text-[var(--text-secondary)] font-semibold">{DAILY_REPORT_SENDER}</span>
            </div>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            aria-label={t('daily_report_title')}
            className="w-4 h-4 rounded text-[var(--accent-fill)] focus:ring-[var(--accent-fill)] cursor-pointer"
          />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {config.enabled ? t('daily_report_on') : t('daily_report_off')}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            {t('daily_report_email_label')}
          </span>
          <input
            type="email"
            value={config.email}
            onChange={(e) => updateConfig({ email: e.target.value })}
            placeholder="student@example.com"
            className="w-full px-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{t('daily_report_hour_label')}</span>
          </span>
          <select
            value={config.hourGmt7}
            onChange={(e) => updateConfig({ hourGmt7: Number(e.target.value) })}
            className="w-full px-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {`${String(h).padStart(2, '0')}:00 (GMT+7)`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeHomework}
            onChange={(e) => updateConfig({ includeHomework: e.target.checked })}
            className="w-3.5 h-3.5 rounded text-[var(--accent-fill)]"
          />
          <span>{t('daily_report_inc_hw')}</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeSchedule}
            onChange={(e) => updateConfig({ includeSchedule: e.target.checked })}
            className="w-3.5 h-3.5 rounded text-[var(--accent-fill)]"
          />
          <span>{t('daily_report_inc_sched')}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-[10px] text-[var(--text-muted)]">
          {t('daily_report_now_gmt7', {
            time: `${String(nowGmt7.hour).padStart(2, '0')}:${String(nowGmt7.minute).padStart(2, '0')} GMT+7`,
          })}
          {config.lastSentDateGmt7 ? ` · ${t('daily_report_last_sent', { date: config.lastSentDateGmt7 })}` : ''}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            <span>{t('daily_report_preview_btn')}</span>
          </button>

          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSending}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3 h-3" />
            <span>{isSending ? t('daily_report_sending') : t('daily_report_send_now')}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`px-3 py-2 rounded-lg text-[11px] font-medium flex flex-wrap items-center justify-between gap-2 border ${
            statusMsg.ok
              ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border-[var(--status-ok-border)]'
              : 'bg-[var(--status-err-bg)] text-[var(--status-err-text)] border-[var(--status-err-border)]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {statusMsg.ok && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            <span>{statusMsg.text}</span>
          </span>
          {mailtoHref && (
            <a
              href={mailtoHref}
              className="underline font-semibold inline-flex items-center gap-1 shrink-0"
            >
              <span>{t('daily_report_open_mail')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {showPreview && (
        <pre className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap max-h-48 overflow-y-auto">
          {`From: StudentOS <${DAILY_REPORT_SENDER}>\nTo: ${config.email.trim() || 'student@example.com'}\nSubject: ${previewContent.subject}\n\n${previewContent.text}`}
        </pre>
      )}
    </div>
  );
};
