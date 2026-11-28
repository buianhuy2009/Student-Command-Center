import { formatMmSs } from './audioChunking';

export interface LectureCardSource {
  flashcards: Array<{ front?: string; back?: string }>;
  vocabulary: Array<{ term?: string; definition?: string }>;
  segments: Array<{ startSec: number; text: string; chunkBullets?: string[] }>;
}

export interface LectureCardLabels {
  keyPoint: (num: number) => string;
  atTime: (time: string) => string;
}

const MAX_FALLBACK_CARDS = 8;
const MAX_ANSWER_CHARS = 400;

/**
 * Cards for a lecture, from the best material it has: AI flashcards, then vocabulary,
 * then summary bullets, then the transcript itself. A lecture with any text yields a deck.
 */
export function buildLectureCards(source: LectureCardSource, labels: LectureCardLabels): Array<{ front: string; back: string }> {
  const aiCards = source.flashcards
    .filter((card) => card?.front?.trim() && card?.back?.trim())
    .map((card) => ({ front: String(card.front), back: String(card.back) }));
  if (aiCards.length > 0) return aiCards;

  const vocabulary = source.vocabulary
    .filter((entry) => entry?.term?.trim() && entry?.definition?.trim())
    .map((entry) => ({ front: String(entry.term), back: String(entry.definition) }));
  if (vocabulary.length > 0) return vocabulary;

  const bullets = source.segments
    .flatMap((segment) => segment.chunkBullets || [])
    .filter((bullet) => bullet?.trim())
    .slice(0, MAX_FALLBACK_CARDS)
    .map((bullet, index) => ({ front: labels.keyPoint(index + 1), back: bullet }));
  if (bullets.length > 0) return bullets;

  const spoken = source.segments.filter((segment) => segment.text?.trim());
  const step = Math.max(1, Math.ceil(spoken.length / MAX_FALLBACK_CARDS));
  return spoken
    .filter((_, index) => index % step === 0)
    .map((segment) => ({
      front: labels.atTime(formatMmSs(segment.startSec)),
      back: segment.text.trim().slice(0, MAX_ANSWER_CHARS),
    }));
}
