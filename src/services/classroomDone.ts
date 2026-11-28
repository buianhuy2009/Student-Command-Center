/**
 * Classroom work the student has marked as done inside StudentOS.
 * Kept apart from the Canvas list (scc_canvas_completed_ids_v1); nothing is sent to Google.
 */
const CLASSROOM_DONE_KEY = 'scc_classroom_done_ids_v1';

export function loadClassroomDoneIds(): string[] {
  try {
    const saved = localStorage.getItem(CLASSROOM_DONE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveClassroomDoneIds(ids: string[]): void {
  try {
    localStorage.setItem(CLASSROOM_DONE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch (err) {
    console.error('Error saving completed Classroom IDs:', err);
  }
}
