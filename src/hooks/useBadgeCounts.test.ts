import { describe, it, expect } from 'vitest';
import { countUnfinishedCanvas } from './useBadgeCounts';
import type { CanvasAssignment } from '../types';

const item = (id: string, isCompleted: boolean): CanvasAssignment => ({
  id,
  name: id,
  courseName: 'Biology',
  dueAt: '',
  isCompleted,
});

describe('countUnfinishedCanvas', () => {
  it('ignores assignments already submitted on Canvas', () => {
    const submitted = Array.from({ length: 120 }, (_, i) => item(`done-${i}`, true));
    const open = Array.from({ length: 5 }, (_, i) => item(`open-${i}`, false));
    expect(countUnfinishedCanvas([...submitted, ...open], new Set())).toBe(5);
  });

  it('ignores assignments ticked off inside StudentOS', () => {
    expect(countUnfinishedCanvas([item('a', false), item('b', false)], new Set(['a']))).toBe(1);
  });
});
