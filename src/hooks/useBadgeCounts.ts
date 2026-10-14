import { useEffect, useState, useMemo } from 'react';
import { Assignment, CanvasAssignment, EmailAlert } from '../types';
import { loadCompletedCanvasIds } from '../services/canvas';

export interface BadgeCounts {
  canvasUnfinished: number;
  urgentEmail: number;
  pendingAssignment: number;
  flashcardDue: number;
}

// Memory cache to avoid redundant JSON.parse operations during interval polling when raw localStorage data is unchanged
let cachedRawFlashcards: string | null = null;
let cachedRawSrs: string | null = null;
let cachedToday: string | null = null;
let cachedCount = 0;

function countFlashcardsDue(): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem('scc_flashcard_decks_v1');
    const srsRaw = localStorage.getItem('scc_srs_decks_v2');

    if (raw === cachedRawFlashcards && srsRaw === cachedRawSrs && today === cachedToday) {
      return cachedCount;
    }

    cachedRawFlashcards = raw;
    cachedRawSrs = srsRaw;
    cachedToday = today;

    if (raw) {
      const decks = JSON.parse(raw);
      cachedCount = decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
      return cachedCount;
    }
    if (srsRaw) {
      const decks = JSON.parse(srsRaw);
      cachedCount = decks.reduce((acc: number, d: any) => acc + (d.cards || []).filter((c: any) => !c.mastered && (!c.dueDate || c.dueDate <= today)).length, 0);
      return cachedCount;
    }
  } catch {}
  cachedCount = 0;
  return 0;
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
    // Reduced polling frequency from 4s to 15s since custom event 'scc_flashcards_updated' handles instant updates
    const id = window.setInterval(poll, 15000);
    window.addEventListener('storage', poll);
    window.addEventListener('focus', poll);
    window.addEventListener('scc_flashcards_updated', poll);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', poll);
      window.removeEventListener('focus', poll);
      window.removeEventListener('scc_flashcards_updated', poll);
    };
  }, []);

  return { canvasUnfinished, urgentEmail, pendingAssignment, flashcardDue };
}
