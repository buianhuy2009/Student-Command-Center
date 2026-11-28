import type { CanvasAssignment } from '../types';

export type ClassroomTab = 'UNFINISHED' | 'DONE' | 'ALL';

const localDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Classroom due dates are plain days (YYYY-MM-DD), so work is overdue from the following day. */
export function isClassroomOverdue(dueAt: string, now: Date = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(dueAt || '') && dueAt.slice(0, 10) < localDay(now);
}

export function filterClassroomWork(
  items: CanvasAssignment[],
  doneIds: ReadonlySet<string>,
  tab: ClassroomTab,
  query: string,
): CanvasAssignment[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const done = doneIds.has(item.id);
    if (tab === 'UNFINISHED' && done) return false;
    if (tab === 'DONE' && !done) return false;
    if (!q) return true;
    return [item.name, item.courseName, item.description || ''].some((text) => (text || '').toLowerCase().includes(q));
  });
}
