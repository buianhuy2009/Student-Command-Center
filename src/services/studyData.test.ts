// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { addFlashcardDeck, loadFlashcardDecks, saveFlashcardDecks, type CardDeck } from './flashcardDecks';
import { loadClassroomDoneIds, saveClassroomDoneIds } from './classroomDone';
import { deriveChatTitle, hasStudentMessage, keepStoredImages } from './coachHistory';
import { buildLectureCards } from '../utils/lectureDeck';
import { filterClassroomWork, isClassroomOverdue } from '../utils/classroomWork';
import { getDriveDateAdded, readDriveOwnerFields } from '../utils/driveMeta';
import { findEmailForAlert, formatEmailReceived } from '../utils/emailTime';
import { formatDate, formatTime } from './i18n';
import { parseCardCount } from '../components/FlashcardCountField';
import type { CanvasAssignment, EmailAlert, EmailMessage, SchoolFile } from '../types';

const deck = (id: string): CardDeck => ({ id, title: id, subject: 'General', createdAt: 'today', cards: [{ id: `${id}-1`, front: 'Q', back: 'A' }] });

describe('flashcard decks', () => {
  beforeEach(() => localStorage.clear());

  it('shows an added deck in the store the Flashcards app reads, once', () => {
    expect(addFlashcardDeck(deck('deck-lec-1'))).toBe('added');
    expect(addFlashcardDeck(deck('deck-lec-1'))).toBe('exists');
    expect(JSON.parse(localStorage.getItem('scc_flashcard_decks_v1') || '[]')).toHaveLength(1);
  });

  it('recovers decks saved under the old key, skipping the sample, and never resurrects deleted ones', () => {
    localStorage.setItem('scc_srs_decks_v2', JSON.stringify([deck('deck-lec-old'), deck('deck-sample-neuro')]));
    expect(loadFlashcardDecks().map((d) => d.id)).toEqual(['deck-lec-old']);
    saveFlashcardDecks([]);
    expect(loadFlashcardDecks()).toEqual([]);
  });

  it('accepts only whole card counts from 1 to 50', () => {
    expect(parseCardCount('23')).toBe(23);
    expect(parseCardCount('0')).toBeNull();
    expect(parseCardCount('51')).toBeNull();
    expect(parseCardCount('2.5')).toBeNull();
    expect(parseCardCount('')).toBeNull();
  });

  it('builds lecture cards from the transcript when there is nothing better', () => {
    const labels = { keyPoint: (n: number) => `point ${n}`, atTime: (time: string) => `at ${time}` };
    const fromText = buildLectureCards({ flashcards: [], vocabulary: [], segments: [{ startSec: 65, text: 'Cells divide.' }] }, labels);
    expect(fromText).toEqual([{ front: 'at 01:05', back: 'Cells divide.' }]);
    const fromVocab = buildLectureCards({ flashcards: [], vocabulary: [{ term: 'ATP', definition: 'energy' }], segments: [] }, labels);
    expect(fromVocab).toEqual([{ front: 'ATP', back: 'energy' }]);
  });
});

describe('classroom work', () => {
  const work = (id: string, name: string, dueAt: string): CanvasAssignment => ({ id, name, courseName: 'Biology', dueAt, isSynced: false });
  const items = [work('a', 'Cell essay', '2026-11-01'), work('b', 'Lab report', '2026-12-20')];

  beforeEach(() => localStorage.clear());

  it('keeps its own done list, separate from Canvas', () => {
    saveClassroomDoneIds(['a', 'a']);
    expect(loadClassroomDoneIds()).toEqual(['a']);
    expect(localStorage.getItem('scc_canvas_completed_ids_v1')).toBeNull();
  });

  it('filters by tab and search, and flags only past days as overdue', () => {
    const done = new Set(['a']);
    expect(filterClassroomWork(items, done, 'UNFINISHED', '').map((i) => i.id)).toEqual(['b']);
    expect(filterClassroomWork(items, done, 'DONE', '').map((i) => i.id)).toEqual(['a']);
    expect(filterClassroomWork(items, done, 'ALL', 'lab').map((i) => i.id)).toEqual(['b']);
    const now = new Date(2026, 10, 28, 23, 0);
    expect(isClassroomOverdue('2026-11-27', now)).toBe(true);
    expect(isClassroomOverdue('2026-11-28', now)).toBe(false);
    expect(isClassroomOverdue('', now)).toBe(false);
  });
});

describe('drive and inbox details', () => {
  it('reads the owner and picks the date the file arrived', () => {
    expect(readDriveOwnerFields({ owners: [{ displayName: 'Lan', me: false }], createdTime: '2026-01-01T00:00:00Z' })).toMatchObject({ ownerName: 'Lan', ownedByMe: false });
    const base: SchoolFile = { id: 'f', name: 'n', mimeType: 'm', modifiedTime: '', webViewLink: '' };
    expect(getDriveDateAdded({ ...base, createdTime: '2026-01-01T00:00:00Z', sharedWithMeTime: '2026-02-01T00:00:00Z' })).toBe('2026-02-01T00:00:00Z');
    expect(getDriveDateAdded({ ...base, id: 'local-1767225600000-abc', origin: 'local' })).toBe('2026-01-01T00:00:00.000Z');
  });

  const date = (d: Date, o?: Intl.DateTimeFormatOptions) => formatDate(d, o, 'en');
  const time = (d: Date, o?: Intl.DateTimeFormatOptions) => formatTime(d, o, 'en');
  const now = new Date(2026, 10, 28, 15, 0);

  it('shows the received time, with the day for older mail', () => {
    const today = { date: 'Nov 28, 2026', dateISO: new Date(2026, 10, 28, 9, 5).toISOString() };
    expect(formatEmailReceived(today, 'list', date, time, now)).toBe('09:05 AM');
    const older = { date: '', dateISO: new Date(2026, 10, 20, 14, 30).toISOString() };
    expect(formatEmailReceived(older, 'list', date, time, now)).toMatch(/Nov 20.*02:30 PM/);
    expect(formatEmailReceived({ date: 'Nov 20, 2026' }, 'list', date, time, now)).toBe('Nov 20, 2026');
    expect(formatEmailReceived({ date: '' }, 'list', date, time, now)).toBe('');
  });

  it('matches a message by ID even when another has the same subject', () => {
    const mail = (id: string): EmailMessage => ({ id, sender: 's', subject: 'Re: Homework', date: '', snippet: '' });
    const alert = { id: 'second', subject: 'Re: Homework' } as EmailAlert;
    expect(findEmailForAlert(alert, [mail('first'), mail('second')])?.id).toBe('second');
  });
});

describe('coach history', () => {
  it('titles a chat from the first question and ignores empty chats', () => {
    expect(hasStudentMessage([{ role: 'assistant', contentKey: 'coach_welcome' }])).toBe(false);
    expect(deriveChatTitle([{ role: 'user', content: '  How do I\n study?  ' }])).toBe('How do I study?');
  });

  it('keeps images that the quick local copy dropped', () => {
    const images = [{ dataUrl: 'data:image/png;base64,AA', mimeType: 'image/png' }];
    const merged = keepStoredImages([{ role: 'user', content: 'x' }], [{ role: 'user', content: 'x', images }]);
    expect(merged[0].images).toEqual(images);
  });
});
