import { beforeEach, describe, expect, it } from 'vitest';
import { buildPilotExport, isoWeek, logPilot, recordMissedDeadlines } from './pilotStats';

const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = String(v);
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
  };
});

describe('pilot stats', () => {
  it('labels ISO weeks from Monday', () => {
    expect(isoWeek(new Date('2026-10-19T08:00:00'))).toBe('2026-W43');
    expect(isoWeek(new Date('2026-10-25T20:00:00'))).toBe('2026-W43');
  });

  it('counts events and each missed deadline once, with no names', () => {
    logPilot('ai_confirmed', new Date('2026-10-19T08:00:00'));
    logPilot('ai_confirmed', new Date('2026-10-20T08:00:00'));
    const a = { id: 'x', subject: 'Toán', assignmentName: 'BT bí mật', dueDate: '2026-10-20', priority: 'Med' as const, status: 'Not Started' as const };
    recordMissedDeadlines([a], new Date('2026-10-22T08:00:00'));
    recordMissedDeadlines([a], new Date('2026-10-23T08:00:00'));
    const out = buildPilotExport();
    expect(out.weeks['2026-W43'].ai_confirmed).toBe(2);
    expect(out.weeks['2026-W43'].missed_deadlines).toBe(1);
    expect(JSON.stringify(out)).not.toContain('bí mật');
  });
});
