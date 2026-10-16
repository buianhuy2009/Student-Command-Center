import { describe, expect, it } from 'vitest';
import { cleanEmailForAI, extractPlainBody } from './emailText';
import { ACADEMIC_SENDER_RE, decodeTrustNotes, encodeTrustNotes, viShortDate } from './trust';
// @ts-ignore — plain JS server module
import { postProcessAlerts, buildEmailPrompt } from '../server/api-handlers/gemini/summarize-emails.js';

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('email text for the AI', () => {
  it('decodes the text/plain part of a Gmail payload (Vietnamese intact)', () => {
    const payload = { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('Các em nộp bài trước thứ 6 nhé') } }] };
    expect(extractPlainBody(payload)).toBe('Các em nộp bài trước thứ 6 nhé');
  });

  it('falls back to stripped HTML', () => {
    const payload = { mimeType: 'text/html', body: { data: b64('<p>Hạn nộp: <b>18/9</b></p>') } };
    expect(extractPlainBody(payload)).toContain('Hạn nộp: 18/9');
  });

  it('cuts the quoted older message so old dates do not leak in', () => {
    const body = 'Cô dời hạn sang thứ 2 (21/9) nhé các em.\n\nVào Th 5, 17 thg 9, 2026 lúc 20:00 Cô Lan đã viết:\n> Hạn nộp 18/9';
    const out = cleanEmailForAI(body);
    expect(out).toContain('21/9');
    expect(out).not.toContain('18/9');
  });

  it('caps the text at the promised limit', () => {
    expect(cleanEmailForAI('a'.repeat(5000)).length).toBeLessThanOrEqual(1501);
  });
});

describe('trust state in the Sheet notes column', () => {
  it('round-trips unconfirmed and missing', () => {
    expect(decodeTrustNotes(encodeTrustNotes({ dueStatus: 'unconfirmed', notes: 'Gmail · Cô Lan' }))).toEqual({ dueStatus: 'unconfirmed', notes: 'Gmail · Cô Lan' });
    expect(decodeTrustNotes(encodeTrustNotes({ dueStatus: 'missing', notes: '' })).dueStatus).toBe('missing');
    expect(decodeTrustNotes('plain note')).toEqual({ notes: 'plain note' });
  });

  it('formats Vietnamese short dates', () => {
    expect(viShortDate('2026-09-18')).toBe('18/9');
  });

  it('recognises school senders, not shops', () => {
    expect(ACADEMIC_SENDER_RE.test('no-reply@classroom.google.com')).toBe(true);
    expect(ACADEMIC_SENDER_RE.test('lan.nt@thcs-example.edu.vn')).toBe(true);
    expect(ACADEMIC_SENDER_RE.test('Cô Lan <lan@gmail.com>')).toBe(true);
    expect(ACADEMIC_SENDER_RE.test('Shopee <info@shopee.vn>')).toBe(false);
  });
});

describe('server post-processing never trusts the model alone', () => {
  const email = (over: any = {}) => ({ id: 'e1', sender: 'Thầy Tuấn', senderEmail: 'thaytuan.toan@gmail.com', subject: 'Bài tập', labelIds: ['CATEGORY_PROMOTIONS'], ...over });

  it('keeps a teacher email out of Promotions and flags it for review', () => {
    const [a] = postProcessAlerts([email()], [{ id: 'e1', category: 'PROMOTION', isSpam: true, confidence: 0.9, detectedAssignment: { isAssignment: true, dueDate: '2026-09-18' } }], 'm');
    expect(a.category).toBe('ASSIGNMENT');
    expect(a.isSpam).toBe(false);
    expect(a.needsReview).toBe(true);
    expect(a.reviewReason).toBe('teacher_as_promo');
  });

  it('turns an omitted email into a review item instead of dropping it', () => {
    const [a] = postProcessAlerts([email({ id: 'e2' })], [], 'm');
    expect(a.aiStatus).toBe('failed');
    expect(a.needsReview).toBe(true);
  });

  it('clears a malformed date instead of keeping a guess', () => {
    const [a] = postProcessAlerts([email({ labelIds: ['INBOX'] })], [{ id: 'e1', category: 'ASSIGNMENT', confidence: 0.9, detectedAssignment: { isAssignment: true, dueDate: 'next Friday' } }], 'm');
    expect(a.detectedAssignment.dueDate).toBe('');
    expect(a.detectedAssignment.dueConfidence).toBe('none');
    expect(a.reviewReason).toBe('no_date');
  });

  it('gives the model the sent weekday so "thứ 6 tuần này" can be resolved', () => {
    const prompt = buildEmailPrompt([email({ dateISO: '2026-09-14T00:32:00Z' })], '2026-10-16T15:00:00Z');
    expect(prompt).toContain('2026-09-14 (Thứ 2 / Monday)');
    expect(prompt).toContain('2026-10-16 (Thứ 6 / Friday)');
  });
});
