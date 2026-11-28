/**
 * SuperMemo SM-2 Spaced Repetition Algorithm Implementation
 * Reference: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

import { t } from './i18n';

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

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export const QUALITY_LABELS: Record<ReviewQuality, { label: string; desc: string; color: string }> = {
  0: { label: 'Blackout (0)', desc: 'Complete memory lapse', color: 'bg-rose-800 text-white' },
  1: { label: 'Wrong (1)', desc: 'Remembered upon reveal', color: 'bg-rose-700 text-white' },
  2: { label: 'Hard (2)', desc: 'Incorrect, but familiar', color: 'bg-amber-800 text-white' },
  3: { label: 'Difficult (3)', desc: 'Correct with serious effort', color: 'bg-amber-700 text-white' },
  4: { label: 'Good (4)', desc: 'Correct after hesitation', color: 'bg-blue-700 text-white' },
  5: { label: 'Perfect (5)', desc: 'Instant, confident recall', color: 'bg-emerald-700 text-white' },
};

export function getQualityLabels(): Record<ReviewQuality, { label: string; desc: string; color: string }> {
  return {
    0: { label: t('srs_q0_label'), desc: t('srs_q0_desc'), color: QUALITY_LABELS[0].color },
    1: { label: t('srs_q1_label'), desc: t('srs_q1_desc'), color: QUALITY_LABELS[1].color },
    2: { label: t('srs_q2_label'), desc: t('srs_q2_desc'), color: QUALITY_LABELS[2].color },
    3: { label: t('srs_q3_label'), desc: t('srs_q3_desc'), color: QUALITY_LABELS[3].color },
    4: { label: t('srs_q4_label'), desc: t('srs_q4_desc'), color: QUALITY_LABELS[4].color },
    5: { label: t('srs_q5_label'), desc: t('srs_q5_desc'), color: QUALITY_LABELS[5].color },
  };
}

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
