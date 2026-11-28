import type { EmailAlert, EmailMessage } from '../types';

type Formatter = (date: Date, options?: Intl.DateTimeFormatOptions) => string;

/** The message behind an alert, matched by ID. Subjects repeat across a thread, so they are not used. */
export function findEmailForAlert(alert: EmailAlert, rawEmails: EmailMessage[]): EmailMessage | null {
  const id = alert.rawEmail?.id || alert.id.replace(/^alert-/, '');
  return rawEmails.find((email) => email.id === id) || alert.rawEmail || null;
}

/**
 * When the message was mailed to the student. dateISO is Gmail's receive time.
 * "list" is compact (time only for today); "full" spells out the day.
 * Returns '' when the message carries no time at all.
 */
export function formatEmailReceived(
  email: Pick<EmailMessage, 'date' | 'dateISO'> | null | undefined,
  style: 'list' | 'full',
  formatDate: Formatter,
  formatTime: Formatter,
  now: Date = new Date(),
): string {
  if (!email) return '';
  // Older caches may hold only a formatted day, which must not be shown as midnight.
  const iso = email.dateISO || (/\d{1,2}:\d{2}/.test(email.date || '') ? email.date : '');
  const received = iso ? new Date(iso) : null;
  if (!received || Number.isNaN(received.getTime())) return email.date || '';

  const clock: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  if (style === 'full') {
    return formatDate(received, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', ...clock });
  }
  if (received.toDateString() === now.toDateString()) return formatTime(received);
  const year: Intl.DateTimeFormatOptions = received.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' };
  return formatDate(received, { ...year, month: 'short', day: 'numeric', ...clock });
}
