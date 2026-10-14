import { describe, it, expect } from 'vitest';
import { getUrgencyInfo } from './AssignmentTrackerTab';

describe('getUrgencyInfo', () => {
  it('returns null for missing, empty, or completed assignments', () => {
    expect(getUrgencyInfo(undefined, false)).toBeNull();
    expect(getUrgencyInfo('', false)).toBeNull();
    expect(getUrgencyInfo('   ', false)).toBeNull();
    expect(getUrgencyInfo('2025-01-01', true)).toBeNull();
  });

  it('correctly identifies today, tomorrow, and overdue dates for YYYY-MM-DD format', () => {
    const now = new Date();

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const overdue = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const overdueStr = `${overdue.getFullYear()}-${String(overdue.getMonth() + 1).padStart(2, '0')}-${String(overdue.getDate()).padStart(2, '0')}`;

    const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5);
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;

    expect(getUrgencyInfo(todayStr, false)?.state).toBe('today');
    expect(getUrgencyInfo(tomorrowStr, false)?.state).toBe('tomorrow');
    expect(getUrgencyInfo(overdueStr, false)?.state).toBe('overdue');
    expect(getUrgencyInfo(futureStr, false)).toBeNull();
  });

  it('handles non-standard date strings and whitespace correctly', () => {
    const now = new Date();
    const todayStrWithTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} 10:00:00`;
    expect(getUrgencyInfo(todayStrWithTime, false)?.state).toBe('today');

    expect(getUrgencyInfo('invalid-date-string', false)).toBeNull();
    expect(getUrgencyInfo('abcd-ef-gh', false)).toBeNull();
  });
});
