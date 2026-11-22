import { describe, it, expect } from 'vitest';
import {
  getGmt7NowParts,
  shouldSendDailyReportNow,
  buildDailyReportContent,
  type DailyReportConfig,
} from './dailyReport';

describe('dailyReport GMT+7 scheduling and formatting', () => {
  it('computes GMT+7 date and hour independently of local timezone', () => {
    // 2026-11-22T00:15:00Z is 2026-11-22 07:15 GMT+7
    const utcMidnightPlus = new Date('2026-11-22T00:15:00Z');
    expect(getGmt7NowParts(utcMidnightPlus)).toEqual({
      dateStr: '2026-11-22',
      hour: 7,
      minute: 15,
    });

    // 2026-11-21T18:30:00Z is 2026-11-22 01:30 GMT+7 (date rolled forward in GMT+7!)
    const rollover = new Date('2026-11-21T18:30:00Z');
    expect(getGmt7NowParts(rollover)).toEqual({
      dateStr: '2026-11-22',
      hour: 1,
      minute: 30,
    });
  });

  it('triggers only when enabled, past selected GMT+7 hour, and not already sent today', () => {
    const baseCfg: DailyReportConfig = {
      enabled: true,
      email: 'student@example.com',
      hourGmt7: 8,
      includeHomework: true,
      includeSchedule: true,
    };
    const at0700Gmt7 = new Date('2026-11-22T00:00:00Z'); // 07:00 GMT+7
    const at0805Gmt7 = new Date('2026-11-22T01:05:00Z'); // 08:05 GMT+7

    expect(shouldSendDailyReportNow(baseCfg, at0700Gmt7)).toBe(false);
    expect(shouldSendDailyReportNow(baseCfg, at0805Gmt7)).toBe(true);
    expect(
      shouldSendDailyReportNow({ ...baseCfg, lastSentDateGmt7: '2026-11-22' }, at0805Gmt7)
    ).toBe(false);
    expect(shouldSendDailyReportNow({ ...baseCfg, enabled: false }, at0805Gmt7)).toBe(false);
  });

  it('builds email content including homework and today schedule', () => {
    const report = buildDailyReportContent({
      config: {
        enabled: true,
        email: 'student@example.com',
        hourGmt7: 7,
        includeHomework: true,
        includeSchedule: true,
      },
      now: new Date('2026-11-22T01:00:00Z'), // 08:00 GMT+7
      assignments: [
        {
          id: '1',
          assignmentName: 'Linear Algebra HW 5',
          subject: 'MATH 201',
          dueDate: '2026-11-22',
          priority: 'High',
          status: 'In Progress',
          notes: '',
        },
      ],
      events: [
        {
          id: 'ev1',
          summary: 'Deep Focus Session',
          start: { dateTime: '2026-11-22T09:00:00+07:00' },
          end: { dateTime: '2026-11-22T10:00:00+07:00' },
        },
      ],
    });

    expect(report.dateStrGmt7).toBe('2026-11-22');
    expect(report.subject).toContain('1 open tasks');
    expect(report.text).toContain('Linear Algebra HW 5');
    expect(report.text).toContain('Deep Focus Session');
    expect(report.html).toContain('Linear Algebra HW 5');
  });
});
