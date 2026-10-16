import type { Assignment } from '../types';

/**
 * Trust layer helpers: AI-read deadlines stay visibly "unconfirmed" until the
 * student checks them, teacher senders are never hidden, and anything the AI
 * skipped or failed on stays reviewable instead of disappearing.
 */

const TEACHERS_KEY = 'scc_teacher_senders_v1';
const DISMISSED_KEY = 'scc_review_dismissed_v1';

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-500)));
  } catch {
    /* storage blocked — in-memory only */
  }
}

export function getTeacherSenders(): string[] {
  return readList(TEACHERS_KEY);
}

export function isTeacherSender(senderEmail?: string): boolean {
  const e = (senderEmail || '').toLowerCase().trim();
  return !!e && getTeacherSenders().includes(e);
}

export function toggleTeacherSender(senderEmail?: string): boolean {
  const e = (senderEmail || '').toLowerCase().trim();
  if (!e) return false;
  const list = getTeacherSenders();
  const has = list.includes(e);
  writeList(TEACHERS_KEY, has ? list.filter((x) => x !== e) : [...list, e]);
  return !has;
}

export function getDismissedReviewIds(): string[] {
  return readList(DISMISSED_KEY);
}

export function dismissReview(id: string) {
  const list = getDismissedReviewIds();
  if (!list.includes(id)) writeList(DISMISSED_KEY, [...list, id]);
}

/** Senders that are clearly school / LMS / Vietnamese EdTech. Teachers on personal Gmail need the teacher list. */
export const ACADEMIC_SENDER_RE =
  /classroom|canvas|instructure|moodle|blackboard|\.edu\b|edu\.vn|school|truong|trường|thcs|thpt|teacher|professor|instructor|phòng đào tạo|giáo viên|azota|olm\.vn|vnedu|smas|k12online|viettelstudy|quizizz|wayground|(^|\s)(thầy|cô)\s+[A-ZĐÂĂÊÔƠƯ]/i;

/** Words that make a Gmail-sorted promo/social email worth a human look. */
export const ACADEMIC_CUE_RE =
  /bài tập|bai tap|hạn nộp|han nop|nộp bài|nop bai|kiểm tra|kiem tra|ôn tập|on tap|deadline|homework|assignment|\bdue\b|quiz|\bexam\b|giáo viên|giao vien|chủ nhiệm|chu nhiem|phụ huynh|phu huynh|học sinh|hoc sinh|thầy|cô giáo|lớp \d/i;

/** Deep link that opens the original email in Gmail (right account when known). */
export function gmailLink(messageId: string): string {
  let account = '';
  try {
    account = localStorage.getItem('scc_google_email_v1') || '';
  } catch {
    /* ignore */
  }
  const id = encodeURIComponent(messageId);
  return account.includes('@')
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${id}`
    : `https://mail.google.com/mail/u/0/#all/${id}`;
}

// Google Sheet has 8 fixed columns; the trust state rides in the Notes column.
const TAG_UNCONFIRMED = '[Hạn chưa xác nhận]';
const TAG_MISSING = '[Chưa có hạn]';

export function encodeTrustNotes(a: Pick<Assignment, 'dueStatus' | 'notes'>): string {
  const notes = a.notes || '';
  const tag = a.dueStatus === 'unconfirmed' ? TAG_UNCONFIRMED : a.dueStatus === 'missing' ? TAG_MISSING : '';
  return tag ? `${tag} ${notes}`.trim() : notes;
}

export function decodeTrustNotes(raw: string): { notes: string; dueStatus?: Assignment['dueStatus'] } {
  const s = raw || '';
  if (s.startsWith(TAG_UNCONFIRMED)) return { notes: s.slice(TAG_UNCONFIRMED.length).trim(), dueStatus: 'unconfirmed' };
  if (s.startsWith(TAG_MISSING)) return { notes: s.slice(TAG_MISSING.length).trim(), dueStatus: 'missing' };
  return { notes: s };
}

/** Vietnamese short date "18/9" from YYYY-MM-DD ('' stays ''). */
export function viShortDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])}/${Number(m[2])}` : '';
}
