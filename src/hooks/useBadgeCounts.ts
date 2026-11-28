import { useEffect, useState, useMemo } from 'react';
import { Assignment, CanvasAssignment, EmailAlert } from '../types';
import { loadCompletedCanvasIds } from '../services/canvas';

export interface BadgeCounts {
  canvasUnfinished: number;
  urgentEmail: number;
  pendingAssignment: number;
  flashcardDue: number;
}

function countFlashcardsDue(): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem('scc_flashcard_decks_v1');
    if (raw) {
      const decks = JSON.parse(raw);
      return decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
    }
    const srsRaw = localStorage.getItem('scc_srs_decks_v2');
    if (srsRaw) {
      const decks = JSON.parse(srsRaw);
      return decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
    }
  } catch {}
  return 0;
}

/** Same "unfinished" rule as the Canvas tab: not submitted on Canvas and not ticked off here. */
export function countUnfinishedCanvas(items: CanvasAssignment[], completedIds: ReadonlySet<string>): number {
  return items.filter((a) => a && !a.isCompleted && !completedIds.has(a.id)).length;
}

export function useBadgeCounts(canvasAssignments: CanvasAssignment[], assignments: Assignment[], emailAlerts: EmailAlert[]): BadgeCounts {
  const completedIds = useMemo(() => { try { return new Set(loadCompletedCanvasIds()); } catch { return new Set<string>(); } }, [canvasAssignments]);
  // Null-safe: malformed records must never throw in App's render body (white screen)
  const safeCanvas = Array.isArray(canvasAssignments) ? canvasAssignments : [];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeAlerts = Array.isArray(emailAlerts) ? emailAlerts : [];
  const canvasUnfinished = useMemo(() => countUnfinishedCanvas(safeCanvas, completedIds), [canvasAssignments, completedIds]);
  const urgentEmail = useMemo(() => safeAlerts.filter(e => e && (e.urgency === 'HIGH' || e.urgency === 'MEDIUM') && !e.isSpam).length, [emailAlerts]);
  const pendingAssignment = useMemo(() => safeAssignments.filter(a => a && a.status !== 'Done').length, [assignments]);
  const [flashcardDue, setFlashcardDue] = useState<number>(() => countFlashcardsDue());

  useEffect(() => {
    const poll = () => setFlashcardDue(countFlashcardsDue());
    const id = window.setInterval(poll, 4000);
    window.addEventListener('storage', poll);
    window.addEventListener('focus', poll);
    return () => { clearInterval(id); window.removeEventListener('storage', poll); window.removeEventListener('focus', poll); };
  }, []);

  return { canvasUnfinished, urgentEmail, pendingAssignment, flashcardDue };
}
