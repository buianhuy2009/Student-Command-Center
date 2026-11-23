import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailMessage } from '../types';

const runLocalLlmClassifyMock = vi.fn();

vi.mock('./localAi', () => ({
  runLocalLlmClassify: (...args: any[]) => runLocalLlmClassifyMock(...args),
}));

import { classifyEmailsLocally } from './localEmailClassifier';

describe('localEmailClassifier', () => {
  beforeEach(() => {
    runLocalLlmClassifyMock.mockReset();
  });

  it('counts Gmail pre-sorted items first and updates progress after every local email with zero cloud calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    runLocalLlmClassifyMock
      .mockResolvedValueOnce(
        JSON.stringify({
          category: 'ASSIGNMENT',
          urgency: 'HIGH',
          oneLineSummary: 'Nộp bài tập Toán trước thứ 6.',
          isAssignment: true,
          assignmentName: 'Bài tập Chương 3',
          subject: 'Toán',
        })
      )
      .mockResolvedValueOnce('not valid json at all');

    const emails: EmailMessage[] = [
      {
        id: 'promo-1',
        sender: 'Shopee',
        senderEmail: 'promo@shopee.vn',
        subject: 'Flash sale 50%',
        date: 'Today',
        snippet: 'Mua ngay hôm nay',
        labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
      },
      {
        id: 'hw-1',
        sender: 'Thầy Nam',
        senderEmail: 'nam@school.edu.vn',
        subject: 'Bài tập Chương 3',
        date: 'Today',
        dateISO: '2026-11-23T07:00:00.000Z',
        snippet: 'Nộp vào thứ 6 tuần này.',
        body: 'Các em nộp bài tập Chương 3 vào thứ 6 tuần này nhé.',
        labelIds: ['INBOX'],
      },
      {
        id: 'bad-json-1',
        sender: 'Cô Lan',
        senderEmail: 'lan@school.edu.vn',
        subject: 'Thông báo lịch học',
        date: 'Today',
        snippet: 'Ngày mai nghỉ học.',
        labelIds: ['INBOX'],
      },
    ];

    const progressEvents: { completed: number; total: number }[] = [];
    const alerts = await classifyEmailsLocally(emails, {
      onProgress: (p) => progressEvents.push({ completed: p.completed, total: p.total }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runLocalLlmClassifyMock).toHaveBeenCalledTimes(2);
    expect(progressEvents).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);

    expect(alerts).toHaveLength(3);
    expect(alerts[0].aiStatus).toBe('skipped');
    expect(alerts[1].category).toBe('ASSIGNMENT');
    expect(alerts[1].detectedAssignment?.dueDate).toBe('2026-11-27');
    expect(alerts[2].needsReview).toBe(true);
    expect(alerts[2].reviewReason).toBe('low_confidence');

    fetchSpy.mockRestore();
  });

  it('aborts cleanly when AbortSignal triggers', async () => {
    const ac = new AbortController();
    runLocalLlmClassifyMock.mockImplementation(async () => {
      ac.abort();
      return JSON.stringify({ category: 'GENERAL', urgency: 'LOW', isAssignment: false });
    });

    const emails: EmailMessage[] = [
      { id: '1', sender: 'A', subject: 'S1', date: 'Today', snippet: 'Body 1', labelIds: ['INBOX'] },
      { id: '2', sender: 'B', subject: 'S2', date: 'Today', snippet: 'Body 2', labelIds: ['INBOX'] },
    ];

    await expect(classifyEmailsLocally(emails, { signal: ac.signal })).rejects.toThrow('ABORTED');
  });
});
