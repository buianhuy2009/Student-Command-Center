import { describe, expect, it } from 'vitest';
import { parseVnEnDeadline } from './vnDateParser';

describe('vnDateParser', () => {
  // Monday, 2026-11-23 14:00 UTC+7 = 2026-11-23T07:00:00Z
  const anchor = '2026-11-23T07:00:00.000Z';

  it('parses explicit Vietnamese DD/MM and DD/MM/YYYY dates in UTC+7', () => {
    const res1 = parseVnEnDeadline('Các em nộp bài trước 20h ngày 27/11 nhé.', anchor);
    expect(res1.dueDate).toBe('2026-11-27');
    expect(res1.dueConfidence).toBe('explicit');
    expect(res1.dueEvidence).toContain('27/11');

    const res2 = parseVnEnDeadline('Hạn chót: 05-12-2026.', anchor);
    expect(res2.dueDate).toBe('2026-12-05');
    expect(res2.dueConfidence).toBe('explicit');
  });

  it('handles UTC+7 midnight boundary accurately', () => {
    // 2026-11-23 23:30 UTC is already 2026-11-24 06:30 UTC+7 (Tuesday)
    const lateUtc = '2026-11-23T23:30:00.000Z';
    const res = parseVnEnDeadline('Nộp bài vào ngày mai nhé.', lateUtc);
    expect(res.dueDate).toBe('2026-11-25');
    expect(res.dueConfidence).toBe('relative');
  });

  it('parses Vietnamese relative weekdays (thứ 6 tuần này / thứ 6 tuần tới / CN)', () => {
    const thisFri = parseVnEnDeadline('Nộp bài vào thứ 6 tuần này.', anchor);
    expect(thisFri.dueDate).toBe('2026-11-27');
    expect(thisFri.dueConfidence).toBe('relative');

    const nextFri = parseVnEnDeadline('Kiểm tra vào thứ 6 tuần sau.', anchor);
    expect(nextFri.dueDate).toBe('2026-12-04');
    expect(nextFri.dueConfidence).toBe('relative');

    const sun = parseVnEnDeadline('Hạn nộp CN tuần này.', anchor);
    expect(sun.dueDate).toBe('2026-11-29');
    expect(sun.dueConfidence).toBe('relative');
  });

  it('prioritizes postponed deadlines over older dates', () => {
    const res = parseVnEnDeadline(
      'Bài tập hạn cũ là 24/11, nay cô dời hạn sang 30/11 để các em ôn thi.',
      anchor
    );
    expect(res.dueDate).toBe('2026-11-30');
    expect(res.dueConfidence).toBe('explicit');
  });

  it('parses English dates and relative weekdays and rolls over year for Jan dates sent in Nov', () => {
    const en1 = parseVnEnDeadline('Lab 4 is due tomorrow at 11:59 PM.', anchor);
    expect(en1.dueDate).toBe('2026-11-24');
    expect(en1.dueConfidence).toBe('relative');

    const en2 = parseVnEnDeadline('Final project due 15/01.', anchor);
    expect(en2.dueDate).toBe('2027-01-15');
    expect(en2.dueConfidence).toBe('explicit');

    const en3 = parseVnEnDeadline('Exam scheduled for Dec 3.', anchor);
    expect(en3.dueDate).toBe('2026-12-03');
    expect(en3.dueConfidence).toBe('explicit');
  });

  it('returns none when no date is present', () => {
    const res = parseVnEnDeadline('Các em đọc trước chương 4 để tiết sau thảo luận nhé.', anchor);
    expect(res.dueDate).toBe('');
    expect(res.dueConfidence).toBe('none');
    expect(res.dueEvidence).toBe('');
  });
});
