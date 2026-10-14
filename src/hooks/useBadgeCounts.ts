import { useEffect, useState, useMemo } from 'react';
import { Assignment, CanvasAssignment, EmailAlert } from '../types';
import { loadCompletedCanvasIds } from '../services/canvas';

export interface BadgeCounts {
  canvasUnfinished: number;
  urgentEmail: number;
  pendingAssignment: number;
  flashcardDue: number;
}

// Module-level string cache to eliminate redundant JSON.parse calls on 4s polling intervals
let cachedFlashcardRaw: string | null = null;
let cachedSrsRaw: string | null = null;
let cachedToday: string | null = null;
let cachedDueCount = 0;

/**
 * Calculates due flashcards for badges.
 * Performance: Memoized against raw localStorage strings & today's date string.
 * Avoids re-parsing JSON and array allocations when storage/date hasn't changed.
 */
function countFlashcardsDue(): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem('scc_flashcard_decks_v1');
    const srsRaw = raw ? null : localStorage.getItem('scc_srs_decks_v2');

    if (raw === cachedFlashcardRaw && srsRaw === cachedSrsRaw && today === cachedToday) {
      return cachedDueCount;
    }

    let calculated = 0;
    if (raw) {
      const decks = JSON.parse(raw);
      calculated = decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
    } else if (srsRaw) {
      const decks = JSON.parse(srsRaw);
      calculated = decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
    }

    cachedFlashcardRaw = raw;
    cachedSrsRaw = srsRaw;
    cachedToday = today;
    cachedDueCount = calculated;
    return calculated;
  } catch {
    cachedDueCount = 0;
    return 0;
  }
}

export function useBadgeCounts(canvasAssignments: CanvasAssignment[], assignments: Assignment[], emailAlerts: EmailAlert[]): BadgeCounts {
  const completedIds = useMemo(() => { try { return new Set(loadCompletedCanvasIds()); } catch { return new Set<string>(); } }, [canvasAssignments]);
  // Null-safe: malformed records must never throw in App's render body (white screen)
  const safeCanvas = Array.isArray(canvasAssignments) ? canvasAssignments : [];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeAlerts = Array.isArray(emailAlerts) ? emailAlerts : [];
  const canvasUnfinished = useMemo(() => safeCanvas.filter(a => a && !completedIds.has((a as any).id)).length, [canvasAssignments, completedIds]);
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
