/**
 * The decks the Flashcards app shows. Everything that creates a deck goes through here.
 */
import type { SRSCard } from './srsEngine';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  mastered?: boolean;
  repetitions?: number;
  interval?: number;
  easeFactor?: number;
  dueDate?: string;
  history?: SRSCard['history'];
}

export interface CardDeck {
  id: string;
  title: string;
  subject: string;
  cards: Flashcard[];
  createdAt: string;
}

export const FLASHCARD_DECKS_EVENT = 'scc-flashcard-decks-updated';
const DECKS_KEY = 'scc_flashcard_decks_v1';
const FOCUS_KEY = 'scc_flashcard_focus_deck_v1';
// Lecture and coach decks were once written here, which the Flashcards app never read.
const STRANDED_KEY = 'scc_srs_decks_v2';
const STRANDED_RECOVERED_KEY = 'scc_srs_decks_recovered_v1';
const BUILTIN_SAMPLE_DECK_ID = 'deck-sample-neuro';

function readDecks(key: string): CardDeck[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (deck): deck is CardDeck =>
        Boolean(deck) && typeof deck.id === 'string' && Array.isArray(deck.cards),
    );
  } catch (err) {
    console.error('Error loading card decks:', err);
    return [];
  }
}

export function saveFlashcardDecks(decks: CardDeck[]): boolean {
  try {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    return true;
  } catch (err) {
    console.error('Error saving card decks:', err);
    return false;
  }
}

/** Runs once. The old copy is left in place; the flag stops deleted decks coming back. */
function recoverStrandedDecks(): void {
  try {
    if (localStorage.getItem(STRANDED_RECOVERED_KEY)) return;
    const stranded = readDecks(STRANDED_KEY).filter((deck) => deck.id !== BUILTIN_SAMPLE_DECK_ID);
    if (stranded.length > 0) {
      const current = readDecks(DECKS_KEY);
      const known = new Set(current.map((deck) => deck.id));
      if (!saveFlashcardDecks([...stranded.filter((deck) => !known.has(deck.id)), ...current])) return;
    }
    localStorage.setItem(STRANDED_RECOVERED_KEY, '1');
  } catch (err) {
    console.error('Error recovering saved decks:', err);
  }
}

export function loadFlashcardDecks(): CardDeck[] {
  recoverStrandedDecks();
  return readDecks(DECKS_KEY);
}

/** Add a deck unless one with the same ID is already there, so review progress is never overwritten. */
export function addFlashcardDeck(deck: CardDeck): 'added' | 'exists' | 'failed' {
  const decks = loadFlashcardDecks();
  if (decks.some((existing) => existing.id === deck.id)) return 'exists';
  if (!saveFlashcardDecks([deck, ...decks])) return 'failed';
  window.dispatchEvent(new CustomEvent(FLASHCARD_DECKS_EVENT));
  return 'added';
}

/** Ask the Flashcards app to open on this deck next time it renders. */
export function focusFlashcardDeck(deckId: string): void {
  try {
    sessionStorage.setItem(FOCUS_KEY, deckId);
  } catch {}
}

export function peekFocusedDeckId(): string | null {
  try {
    return sessionStorage.getItem(FOCUS_KEY);
  } catch {
    return null;
  }
}

export function clearFocusedDeckId(): void {
  try {
    sessionStorage.removeItem(FOCUS_KEY);
  } catch {}
}
