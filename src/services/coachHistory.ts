/**
 * Every AI Coach conversation, kept on this device in IndexedDB.
 * Failures are swallowed: losing history must never break the chat itself.
 */
import { db, type CoachChatRecord } from './db';
import type { CoachMessage } from '../store/coachChatStore';

export type { CoachChatRecord };

const TITLE_CHARS = 60;

/** Only conversations where the student said something are worth keeping. */
export function hasStudentMessage(messages: CoachMessage[]): boolean {
  return messages.some((message) => message.role === 'user');
}

export function deriveChatTitle(messages: CoachMessage[]): string {
  const first = messages.find((message) => message.role === 'user')?.content || '';
  const text = first.replace(/\s+/g, ' ').trim();
  return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS)}…` : text;
}

/** The quick local copy of a chat drops image data, so keep the images already saved. */
export function keepStoredImages(next: CoachMessage[], stored: CoachMessage[] = []): CoachMessage[] {
  return next.map((message, index) => {
    const previous = stored[index];
    if (message.images?.length || !previous?.images?.length) return message;
    if (previous.role !== message.role) return message;
    return { ...message, images: previous.images };
  });
}

// Writes run one after another so a slow save cannot overwrite a newer one.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  const result = queue.then(task).catch((err) => {
    console.warn('Chat history unavailable:', err);
    return fallback;
  });
  queue = result;
  return result;
}

export function saveCoachChat(id: string, messages: CoachMessage[]): Promise<boolean> {
  if (!hasStudentMessage(messages)) return Promise.resolve(false);
  return enqueue(async () => {
    const existing = await db.coachChats.get(id);
    const merged = keepStoredImages(messages, existing?.messages);
    // Reopening an old chat must not move it to the top; only new messages do.
    const unchanged = existing && existing.messages.length === merged.length;
    const now = new Date().toISOString();
    await db.coachChats.put({
      id,
      title: deriveChatTitle(merged),
      createdAt: existing?.createdAt || now,
      updatedAt: unchanged ? existing.updatedAt : now,
      messages: merged,
    });
    return true;
  }, false);
}

export function listCoachChats(): Promise<CoachChatRecord[]> {
  return enqueue(() => db.coachChats.orderBy('updatedAt').reverse().toArray(), []);
}

export function getCoachChat(id: string): Promise<CoachChatRecord | undefined> {
  return enqueue(() => db.coachChats.get(id), undefined);
}

export function deleteCoachChat(id: string): Promise<boolean> {
  return enqueue(async () => {
    await db.coachChats.delete(id);
    return true;
  }, false);
}
