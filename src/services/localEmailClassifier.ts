import { runLocalLlmClassify } from './localAi';
import { cleanEmailForAI } from '../utils/emailText';
import { parseVnEnDeadline } from '../utils/vnDateParser';
import { ACADEMIC_CUE_RE, ACADEMIC_SENDER_RE, gmailLink, isTeacherSender } from '../utils/trust';
import { t } from './i18n';
import type { EmailAlert, EmailCategory, EmailMessage, PriorityLevel } from '../types';

export interface EmailSortProgress {
  completed: number;
  total: number;
  stage: 'downloading' | 'sorting';
  downloadPercent?: number;
  downloadLoadedMb?: number;
  downloadTotalMb?: number;
}

export interface LocalClassifyOptions {
  forceAI?: boolean;
  origin?: 'gmail' | 'classroom';
  onProgress?: (progress: EmailSortProgress) => void;
  signal?: AbortSignal;
}

const VALID_CATEGORIES = new Set<EmailCategory>([
  'ASSIGNMENT',
  'EXAM',
  'GRADE',
  'SCHEDULE',
  'ANNOUNCEMENT',
  'SPAM',
  'PROMOTION',
  'SOCIAL',
  'GENERAL',
]);

const VALID_URGENCY = new Set<EmailAlert['urgency']>(['HIGH', 'MEDIUM', 'LOW', 'INFO']);

const SYSTEM_PROMPT = `You classify one school/student email at a time. Reply ONLY with one valid JSON object matching:
{"category":"ASSIGNMENT|EXAM|GRADE|SCHEDULE|ANNOUNCEMENT|SPAM|PROMOTION|SOCIAL|GENERAL","urgency":"HIGH|MEDIUM|LOW|INFO","oneLineSummary":"short summary in same language as email","isAssignment":true|false,"assignmentName":"short task name or empty","subject":"course or subject name or General"}
Rules:
- Be concise. No markdown fences or extra text.
- If knownTeacher is true, never mark SPAM or PROMOTION.`;

interface RawLocalJson {
  category?: string;
  urgency?: string;
  oneLineSummary?: string;
  isAssignment?: boolean;
  assignmentName?: string;
  subject?: string;
}

function parseClassifierJson(raw: string): RawLocalJson | null {
  const cleaned = String(raw || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as RawLocalJson) : null;
  } catch {
    return null;
  }
}

function isAcademicSender(e: EmailMessage): boolean {
  return (
    isTeacherSender(e.senderEmail) ||
    ACADEMIC_SENDER_RE.test(`${e.senderEmail || ''} ${e.sender || ''}`)
  );
}

function bucketOf(e: EmailMessage, forceAI?: boolean): 'PROMOTION' | 'SOCIAL' | 'AI' {
  if (forceAI) return 'AI';
  const labels = e.labelIds || [];
  if (labels.includes('SPAM')) return isAcademicSender(e) ? 'AI' : 'PROMOTION';
  if (labels.includes('CATEGORY_PROMOTIONS')) return isAcademicSender(e) ? 'AI' : 'PROMOTION';
  if (labels.includes('CATEGORY_SOCIAL')) return isAcademicSender(e) ? 'AI' : 'SOCIAL';
  return 'AI';
}

function inferPriority(urgency: EmailAlert['urgency']): PriorityLevel {
  if (urgency === 'HIGH') return 'High';
  if (urgency === 'LOW' || urgency === 'INFO') return 'Low';
  return 'Med';
}

function buildSkippedAlert(
  e: EmailMessage,
  category: 'PROMOTION' | 'SOCIAL',
  origin: 'gmail' | 'classroom'
): EmailAlert {
  const cue = ACADEMIC_CUE_RE.test(`${e.subject || ''} ${e.snippet || ''}`);
  return {
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    oneLineSummary: `${(e.snippet || e.subject || '').slice(0, 90)}…`,
    urgency: 'INFO',
    category,
    categoryLabel: category === 'SOCIAL' ? t('gem_cat_social') : t('gem_cat_promo'),
    isSpam: category === 'PROMOTION',
    spamReason: t('gem_sorted_by_gmail'),
    language: 'other',
    gmailLabels: e.labelIds || [],
    rawEmail: e,
    aiStatus: 'skipped',
    needsReview: cue,
    reviewReason: cue ? 'skipped_with_cue' : 'skipped',
    origin,
    sourceUrl: origin === 'gmail' ? gmailLink(e.id) : (e as any).sourceUrl,
  };
}

function buildFallbackAlert(
  e: EmailMessage,
  origin: 'gmail' | 'classroom',
  reason: string
): EmailAlert {
  return {
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    oneLineSummary: `${(e.snippet || e.subject || '').slice(0, 90)}…`,
    urgency: 'LOW',
    category: 'GENERAL',
    categoryLabel: t('gem_cat_unread'),
    isSpam: false,
    gmailLabels: e.labelIds || [],
    rawEmail: e,
    aiStatus: 'failed',
    needsReview: true,
    reviewReason: reason,
    origin,
    sourceUrl: origin === 'gmail' ? gmailLink(e.id) : (e as any).sourceUrl,
  };
}

/**
 * Classifies emails 100% locally in the browser using the lightweight on-device model +
 * deterministic UTC+7 date parsing. Zero cloud requests are made.
 */
export async function classifyEmailsLocally(
  emails: EmailMessage[],
  opts: LocalClassifyOptions = {}
): Promise<EmailAlert[]> {
  const origin = opts.origin || 'gmail';
  const total = emails.length;
  if (total === 0) return [];

  const alertsById = new Map<string, EmailAlert>();
  const aiQueue: EmailMessage[] = [];

  for (const email of emails) {
    const bucket = bucketOf(email, opts.forceAI);
    if (bucket === 'AI') {
      aiQueue.push(email);
    } else {
      alertsById.set(email.id, buildSkippedAlert(email, bucket, origin));
    }
  }

  let completed = total - aiQueue.length;
  opts.onProgress?.({
    completed,
    total,
    stage: 'sorting',
  });

  for (const email of aiQueue) {
    if (opts.signal?.aborted) {
      throw new Error('ABORTED');
    }

    const knownTeacher = isTeacherSender(email.senderEmail);
    const cleanedBody = cleanEmailForAI(email.body || email.snippet || '', 1000);
    const prompt = JSON.stringify({
      sender: email.sender,
      senderEmail: email.senderEmail || '',
      subject: email.subject,
      knownTeacher,
      body: cleanedBody,
    });

    try {
      const rawReply = await runLocalLlmClassify({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        maxNewTokens: 180,
        signal: opts.signal,
        onProgress: (dl) => {
          if (dl.percent < 100) {
            opts.onProgress?.({
              completed,
              total,
              stage: 'downloading',
              downloadPercent: dl.percent,
              downloadLoadedMb: Math.round((dl.loaded / (1024 * 1024)) * 10) / 10,
              downloadTotalMb: Math.round((dl.total / (1024 * 1024)) * 10) / 10,
            });
          }
        },
      });

      const parsed = parseClassifierJson(rawReply);
      if (!parsed) {
        alertsById.set(email.id, buildFallbackAlert(email, origin, 'low_confidence'));
      } else {
        const rawCat = String(parsed.category || 'GENERAL').toUpperCase() as EmailCategory;
        let category: EmailCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : 'GENERAL';
        if (knownTeacher && (category === 'SPAM' || category === 'PROMOTION')) {
          category = 'ANNOUNCEMENT';
        }

        const rawUrg = String(parsed.urgency || 'MEDIUM').toUpperCase() as EmailAlert['urgency'];
        const urgency: EmailAlert['urgency'] = VALID_URGENCY.has(rawUrg) ? rawUrg : 'MEDIUM';
        const isSpam = !knownTeacher && (category === 'SPAM' || category === 'PROMOTION');
        const isTask =
          Boolean(parsed.isAssignment) || category === 'ASSIGNMENT' || category === 'EXAM';

        const deadline = parseVnEnDeadline(
          `${email.subject || ''}\n${cleanedBody}`,
          email.dateISO
        );

        const summaryText =
          String(parsed.oneLineSummary || '').trim() ||
          `${(email.snippet || email.subject || '').slice(0, 90)}…`;

        const detectedAssignment = isTask
          ? {
              isAssignment: true,
              name: String(parsed.assignmentName || email.subject || 'Assignment').trim(),
              subject: String(parsed.subject || 'General').trim() || 'General',
              dueDate: deadline.dueDate,
              priority: inferPriority(urgency),
              dueEvidence: deadline.dueEvidence,
              dueConfidence: deadline.dueConfidence,
            }
          : undefined;

        const missingDate = Boolean(isTask && !deadline.dueDate);

        alertsById.set(email.id, {
          id: email.id,
          sender: email.sender,
          subject: email.subject,
          oneLineSummary: summaryText,
          urgency,
          category,
          isSpam,
          spamReason: isSpam ? 'Offline AI filter' : undefined,
          detectedAssignment,
          rawEmail: email,
          gmailLabels: email.labelIds || [],
          aiStatus: 'ok',
          confidence: missingDate ? 0.55 : 0.72,
          needsReview: missingDate,
          reviewReason: missingDate ? 'no_date' : undefined,
          origin,
          sourceUrl: origin === 'gmail' ? gmailLink(email.id) : (email as any).sourceUrl,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ABORTED') {
        throw err;
      }
      alertsById.set(email.id, buildFallbackAlert(email, origin, 'ai_failed'));
    }

    completed += 1;
    opts.onProgress?.({
      completed,
      total,
      stage: 'sorting',
    });
  }

  return emails
    .map((e) => alertsById.get(e.id))
    .filter((a): a is EmailAlert => Boolean(a));
}
