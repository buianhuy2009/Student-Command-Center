import { Assignment, CalendarEvent } from '../types';

export interface DailyReportConfig {
  enabled: boolean;
  email: string;
  hourGmt7: number;
  includeHomework: boolean;
  includeSchedule: boolean;
  lastSentDateGmt7?: string;
}

export const DAILY_REPORT_KEY = 'scc_daily_report_v1';
export const DAILY_REPORT_SENDER = 'studentos.service@gmail.com';

export function loadDailyReportConfig(fallbackEmail = ''): DailyReportConfig {
  try {
    const raw = localStorage.getItem(DAILY_REPORT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email.trim() : fallbackEmail,
        hourGmt7: Number.isInteger(parsed.hourGmt7) && parsed.hourGmt7 >= 0 && parsed.hourGmt7 <= 23 ? parsed.hourGmt7 : 7,
        includeHomework: parsed.includeHomework !== false,
        includeSchedule: parsed.includeSchedule !== false,
        lastSentDateGmt7: typeof parsed.lastSentDateGmt7 === 'string' ? parsed.lastSentDateGmt7 : undefined,
      };
    }
  } catch {}
  return {
    enabled: false,
    email: fallbackEmail,
    hourGmt7: 7,
    includeHomework: true,
    includeSchedule: true,
  };
}

export function saveDailyReportConfig(config: DailyReportConfig): void {
  try {
    localStorage.setItem(DAILY_REPORT_KEY, JSON.stringify(config));
  } catch {}
}

export function getGmt7NowParts(now: Date = new Date()): {
  dateStr: string;
  hour: number;
  minute: number;
} {
  const shifted = new Date(now.getTime() + 7 * 3600_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function shouldSendDailyReportNow(
  config: DailyReportConfig,
  now: Date = new Date()
): boolean {
  if (!config.enabled) return false;
  if (!config.email || !config.email.trim()) return false;
  const { dateStr, hour } = getGmt7NowParts(now);
  if (config.lastSentDateGmt7 === dateStr) return false;
  return hour >= config.hourGmt7;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDailyReportContent(params: {
  assignments: Assignment[];
  events: CalendarEvent[];
  config: DailyReportConfig;
  now?: Date;
}): { from: string; subject: string; text: string; html: string; dateStrGmt7: string } {
  const { assignments, events, config, now = new Date() } = params;
  const { dateStr } = getGmt7NowParts(now);

  const pending = assignments.filter((a) => a.status !== 'Done' && !a.trashedAt);
  const dueSoon = pending
    .filter((a) => a.dueDate && a.dueDate <= dateStr)
    .slice(0, 8);
  const upcoming = pending
    .filter((a) => !a.dueDate || a.dueDate > dateStr)
    .slice(0, 8);

  const todayEvents = events
    .filter((ev) => {
      const startStr = ev.start?.dateTime || ev.start?.date || '';
      return startStr.slice(0, 10) === dateStr;
    })
    .sort((a, b) =>
      String(a.start?.dateTime || a.start?.date || '').localeCompare(
        String(b.start?.dateTime || b.start?.date || '')
      )
    )
    .slice(0, 10);

  const lines: string[] = [
    `StudentOS Daily Brief — ${dateStr} (GMT+7)`,
    `Scheduled hour: ${String(config.hourGmt7).padStart(2, '0')}:00 GMT+7`,
    '',
  ];

  const htmlParts: string[] = [
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; max-width: 600px; line-height: 1.55;">`,
    `<h2 style="margin: 0 0 4px;">StudentOS Daily Study Brief</h2>`,
    `<p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">${escapeHtml(dateStr)} · Scheduled ${String(config.hourGmt7).padStart(2, '0')}:00 GMT+7</p>`,
  ];

  if (config.includeHomework) {
    lines.push(`HOMEWORK & DEADLINES (${pending.length} open):`);
    htmlParts.push(`<h3 style="margin: 16px 0 8px; font-size: 15px;">Homework &amp; Deadlines (${pending.length} open)</h3>`);
    if (pending.length === 0) {
      lines.push('  - All caught up! No pending assignments.');
      htmlParts.push(`<p style="font-size: 13px; color: #4b5563;">All caught up! No pending assignments.</p>`);
    } else {
      htmlParts.push(`<ul style="padding-left: 18px; margin: 0 0 12px; font-size: 13px;">`);
      for (const item of [...dueSoon, ...upcoming].slice(0, 10)) {
        const dueLabel = item.dueDate || 'No due date';
        lines.push(`  - [${item.subject || 'General'}] ${item.assignmentName} (Due: ${dueLabel}, Priority: ${item.priority})`);
        htmlParts.push(
          `<li style="margin-bottom: 4px;"><strong>${escapeHtml(item.assignmentName)}</strong> — ${escapeHtml(item.subject || 'General')} · Due ${escapeHtml(dueLabel)}</li>`
        );
      }
      htmlParts.push(`</ul>`);
    }
    lines.push('');
  }

  if (config.includeSchedule) {
    lines.push(`TODAY'S SCHEDULE (${todayEvents.length} items):`);
    htmlParts.push(`<h3 style="margin: 16px 0 8px; font-size: 15px;">Today&apos;s Schedule (${todayEvents.length} items)</h3>`);
    if (todayEvents.length === 0) {
      lines.push('  - No scheduled blocks on your calendar today.');
      htmlParts.push(`<p style="font-size: 13px; color: #4b5563;">No scheduled blocks on your calendar today.</p>`);
    } else {
      htmlParts.push(`<ul style="padding-left: 18px; margin: 0 0 12px; font-size: 13px;">`);
      for (const ev of todayEvents) {
        const timeText = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : 'All day';
        lines.push(`  - ${timeText}: ${ev.summary || 'Study block'}`);
        htmlParts.push(
          `<li style="margin-bottom: 4px;"><code>${escapeHtml(timeText)}</code> — ${escapeHtml(ev.summary || 'Study block')}</li>`
        );
      }
      htmlParts.push(`</ul>`);
    }
  }

  htmlParts.push(`<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;" />`);
  htmlParts.push(`<p style="font-size: 12px; color: #6b7280;">Sent from <strong>${DAILY_REPORT_SENDER}</strong> (StudentOS Daily Email Report).</p></div>`);

  return {
    from: DAILY_REPORT_SENDER,
    subject: `StudentOS Daily Brief (${dateStr}) — ${pending.length} open tasks`,
    text: lines.join('\n'),
    html: htmlParts.join(''),
    dateStrGmt7: dateStr,
  };
}

export async function sendDailyReport(params: {
  config: DailyReportConfig;
  assignments: Assignment[];
  events: CalendarEvent[];
  googleAccessToken?: string | null;
}): Promise<{
  ok: boolean;
  delivered: boolean;
  transport: 'resend' | 'gmail' | 'preview';
  from: string;
  dateStrGmt7: string;
  preview?: { from: string; to: string; subject: string; text: string; html: string };
}> {
  const { config, assignments, events, googleAccessToken } = params;
  const content = buildDailyReportContent({ assignments, events, config });

  const res = await fetch('/api/reports/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromEmail: DAILY_REPORT_SENDER,
      toEmail: config.email.trim(),
      subject: content.subject,
      text: content.text,
      html: content.html,
      googleAccessToken: googleAccessToken || undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Failed to send daily report (${res.status})`);
  }

  const data = await res.json();
  return {
    ok: Boolean(data?.ok),
    delivered: Boolean(data?.delivered),
    transport: data?.transport || 'preview',
    from: data?.from || data?.preview?.from || DAILY_REPORT_SENDER,
    dateStrGmt7: content.dateStrGmt7,
    preview: data?.preview,
  };
}
