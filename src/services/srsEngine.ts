/**
 * SuperMemo SM-2 Spaced Repetition Algorithm Implementation
 * Reference: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

export interface SRSCard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  repetitions: number;
  interval: number; // in days
  easeFactor: number; // default 2.5, minimum 1.3
  dueDate: string; // ISO date YYYY-MM-DD
  lastReviewed?: string;
  history?: Array<{
    date: string;
    quality: number;
    interval: number;
  }>;
}

export interface SRSDeck {
  id: string;
  title: string;
  subject?: string;
  cards: SRSCard[];
  createdAt: string;
  updatedAt: string;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export const QUALITY_LABELS: Record<ReviewQuality, { label: string; desc: string; color: string }> = {
  0: { label: 'Blackout (0)', desc: 'Complete memory lapse', color: 'bg-rose-600 text-white' },
  1: { label: 'Wrong (1)', desc: 'Remembered upon reveal', color: 'bg-rose-500 text-white' },
  2: { label: 'Hard (2)', desc: 'Incorrect, but familiar', color: 'bg-amber-600 text-white' },
  3: { label: 'Difficult (3)', desc: 'Correct with serious effort', color: 'bg-amber-500 text-white' },
  4: { label: 'Good (4)', desc: 'Correct after hesitation', color: 'bg-blue-600 text-white' },
  5: { label: 'Perfect (5)', desc: 'Instant, confident recall', color: 'bg-emerald-600 text-white' },
};

/**
 * Calculates next SM-2 review parameters for a card given student's response quality (0-5)
 */
export function calculateSM2(card: SRSCard, quality: ReviewQuality): SRSCard {
  let { repetitions, interval, easeFactor } = card;

  // 1. Calculate new Ease Factor (EF)
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // 2. Calculate interval and repetitions
  let newInterval: number;
  let newRepetitions: number;

  if (quality < 3) {
    // Failed recall: reset repetitions to 0 and repeat tomorrow
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
    newRepetitions = repetitions + 1;
  }

  const today = new Date();
  const nextDate = new Date(today.getTime() + newInterval * 24 * 60 * 60 * 1000);
  const nextDueDate = nextDate.toISOString().split('T')[0];

  const reviewRecord = {
    date: today.toISOString().split('T')[0],
    quality,
    interval: newInterval,
  };

  return {
    ...card,
    repetitions: newRepetitions,
    interval: newInterval,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    dueDate: nextDueDate,
    lastReviewed: reviewRecord.date,
    history: [...(card.history || []), reviewRecord],
  };
}

export function createNewSRSCard(params: {
  front: string;
  back: string;
  tags?: string[];
}): SRSCard {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    front: params.front,
    back: params.back,
    tags: params.tags || [],
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: today,
  };
}

const LOCAL_DECKS_STORAGE_KEY = 'scc_srs_decks_v2';

export function loadSRSDecks(): SRSDeck[] {
  try {
    const raw = localStorage.getItem(LOCAL_DECKS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load SRS decks:', err);
  }

  // Default baseline sample deck
  const sampleDeck: SRSDeck = {
    id: 'deck-sample-neuro',
    title: 'Cognitive Science & Memory (SM-2 Primer)',
    subject: 'Psychology',
    createdAt: new Date().toLocaleDateString(),
    updatedAt: new Date().toLocaleDateString(),
    cards: [
      {
        id: 'card-sm2-1',
        front: 'What is the Testing Effect (Retrieval Practice)?',
        back: 'The finding that actively retrieving information from memory produces stronger and longer-lasting retention than passive re-reading.',
        tags: ['Memory', 'Cognition'],
        repetitions: 1,
        interval: 1,
        easeFactor: 2.5,
        dueDate: new Date().toISOString().split('T')[0],
      },
      {
        id: 'card-sm2-2',
        front: 'What does the Ease Factor (EF) determine in the SM-2 algorithm?',
        back: 'It reflects card difficulty. It starts at 2.5 (min 1.3). It multiplies previous interval when recall is successful.',
        tags: ['Algorithms', 'Spaced Repetition'],
        repetitions: 2,
        interval: 6,
        easeFactor: 2.6,
        dueDate: new Date().toISOString().split('T')[0],
      },
      {
        id: 'card-sm2-3',
        front: 'What is the Feynman Technique formula for conceptual mastery?',
        back: '1. Select concept -> 2. Teach it to a 12-year-old -> 3. Identify knowledge gaps -> 4. Review source material & create analogy.',
        tags: ['Learning Methods'],
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: new Date().toISOString().split('T')[0],
      },
    ],
  };

  return [sampleDeck];
}

export function saveSRSDecks(decks: SRSDeck[]): void {
  try {
    localStorage.setItem(LOCAL_DECKS_STORAGE_KEY, JSON.stringify(decks));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scc:flashcards_updated'));
    }
  } catch (err) {
    console.error('Failed to save SRS decks to localStorage:', err);
  }
}
