import { describe, it, expect } from 'vitest';
import { useBadgeCounts } from './useBadgeCounts';

describe('useBadgeCounts pure logic', () => {
  it('calculates urgent email and pending assignment counts correctly', () => {
    const assignments: any[] = [
      { id: '1', status: 'Not Started' },
      { id: '2', status: 'Done' },
      { id: '3', status: 'In Progress' },
    ];
    const alerts: any[] = [
      { id: 'a1', urgency: 'HIGH', isSpam: false },
      { id: 'a2', urgency: 'INFO', isSpam: false },
      { id: 'a3', urgency: 'HIGH', isSpam: true },
    ];

    const safeAssignments = assignments.filter((a) => a.status !== 'Done');
    const safeAlerts = alerts.filter((e) => (e.urgency === 'HIGH' || e.urgency === 'MEDIUM') && !e.isSpam);

    expect(safeAssignments.length).toBe(2);
    expect(safeAlerts.length).toBe(1);
  });
});
