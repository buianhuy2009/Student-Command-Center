import { create } from 'zustand';
import {
  normalizeAiCoachMode,
  sendStudyAssistantMessage,
  type AiCoachMode,
} from '../services/gemini';
import { t } from '../services/i18n';
import { getPrivacyPrefs } from '../services/privacyPrefs';
import { deleteCoachChat, getCoachChat, saveCoachChat } from '../services/coachHistory';
import type { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useAiJobsStore } from './aiJobsStore';

const COACH_MODE_STORAGE_KEY = 'scc_ai_coach_mode_v1';
const CHAT_STORAGE_KEY = 'scc_chat_messages_v2';
const COACH_JOB_ID = 'coach-chat';
const ACTIVE_CHAT_KEY = 'scc_chat_active_id_v1';

const newChatId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function rememberActiveChatId(id: string) {
  try {
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
  } catch {}
}

function loadActiveChatId(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_CHAT_KEY);
    if (saved) return saved;
  } catch {}
  const id = newChatId();
  rememberActiveChatId(id);
  return id;
}

export interface CoachImageAttachment {
  dataUrl: string;
  base64: string;
  mimeType: string;
  name?: string;
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  content?: string;
  contentKey?: 'coach_welcome' | 'coach_cleared_full' | 'coach_cleared_drawer';
  images?: { dataUrl: string; mimeType: string; name?: string }[];
}

function loadInitialCoachMode(): AiCoachMode {
  try {
    const raw = localStorage.getItem(COACH_MODE_STORAGE_KEY);
    return normalizeAiCoachMode(raw);
  } catch {
    return 'balanced';
  }
}

function loadInitialMessages(): CoachMessage[] {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    const dexieRaw = localStorage.getItem('scc_chat_dexie_synced');
    if (dexieRaw) return JSON.parse(dexieRaw);
  } catch {
    // Ignore parse errors.
  }
  return [{ role: 'assistant', contentKey: 'coach_welcome' }];
}

function persistMessages(messages: CoachMessage[]) {
  try {
    // Strip heavy base64 dataUrl payloads before saving to localStorage so storage quota stays healthy.
    const slim = messages.map((m) =>
      m.images?.length
        ? {
            role: m.role,
            content:
              m.content ||
              (m.images.length > 0 ? `[${m.images.length} attached image(s)]` : ''),
            ...(m.contentKey ? { contentKey: m.contentKey } : {}),
          }
        : m
    );
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // Ignore storage quota errors.
  }
}

let activeChatController: AbortController | null = null;

function bumpHistory() {
  useCoachChatStore.setState((state) => ({ historyVersion: state.historyVersion + 1 }));
}

/** The on-screen chat is cached for instant reload and also filed in history. */
function persist(messages: CoachMessage[]) {
  const { activeChatId } = useCoachChatStore.getState();
  // Written together, so another open tab cannot pair these messages with its own chat ID.
  rememberActiveChatId(activeChatId);
  persistMessages(messages);
  void saveCoachChat(activeChatId, messages).then((saved) => {
    if (saved) bumpHistory();
  });
}

interface CoachChatState {
  messages: CoachMessage[];
  isSending: boolean;
  streamingContent: string;
  coachMode: AiCoachMode;
  startedAt: number | null;
  /** The conversation on screen, as saved in history. */
  activeChatId: string;
  /** Bumped after history changes so an open list reloads. */
  historyVersion: number;
  setCoachMode: (mode: AiCoachMode) => void;
  /** Start a new chat. The previous one stays in history. */
  clearMessages: (variant?: 'full' | 'drawer') => void;
  openChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  cancelSending: () => void;
  sendMessage: (params: {
    text: string;
    images?: CoachImageAttachment[];
    assignments: Assignment[];
    events: CalendarEvent[];
    alerts: EmailAlert[];
    extraContext?: Record<string, unknown>;
  }) => Promise<void>;
}

export const useCoachChatStore = create<CoachChatState>((set, get) => ({
  messages: loadInitialMessages(),
  activeChatId: loadActiveChatId(),
  historyVersion: 0,
  isSending: false,
  streamingContent: '',
  coachMode: loadInitialCoachMode(),
  startedAt: null,

  setCoachMode: (mode) => {
    try {
      localStorage.setItem(COACH_MODE_STORAGE_KEY, mode);
    } catch {}
    set({ coachMode: mode });
  },

  clearMessages: () => {
    if (get().isSending) get().cancelSending();
    const next: CoachMessage[] = [{ role: 'assistant', contentKey: 'coach_welcome' }];
    const activeChatId = newChatId();
    rememberActiveChatId(activeChatId);
    persistMessages(next);
    set({ messages: next, activeChatId, streamingContent: '' });
  },

  openChat: async (id) => {
    if (get().isSending || id === get().activeChatId) return;
    const record = await getCoachChat(id);
    // A message may have been sent while the record was loading.
    if (!record || get().isSending) return;
    rememberActiveChatId(id);
    persistMessages(record.messages);
    set({ messages: record.messages, activeChatId: id, streamingContent: '' });
  },

  deleteChat: async (id) => {
    if (id === get().activeChatId) get().clearMessages();
    await deleteCoachChat(id);
    bumpHistory();
  },

  cancelSending: () => {
    if (activeChatController) {
      activeChatController.abort();
      activeChatController = null;
    }
    set({ isSending: false, streamingContent: '', startedAt: null });
  },

  sendMessage: async ({ text, images, assignments, events, alerts, extraContext }) => {
    const attached = Array.isArray(images) ? images.slice(0, 4) : [];
    const trimmed = text.trim() || (attached.length > 0 ? t('coach_image_default_prompt') : '');
    if ((!trimmed && attached.length === 0) || get().isSending) return;

    const controller = new AbortController();
    activeChatController = controller;

    const userMessage: CoachMessage = {
      role: 'user',
      content: trimmed,
      ...(attached.length > 0
        ? {
            images: attached.map((img) => ({
              dataUrl: img.dataUrl,
              mimeType: img.mimeType,
              name: img.name,
            })),
          }
        : {}),
    };
    const prevMessages = get().messages;
    const withUser = [...prevMessages, userMessage];
    persist(withUser);

    const startedAt = Date.now();
    set({
      messages: withUser,
      isSending: true,
      streamingContent: '',
      startedAt,
    });

    useAiJobsStore.getState().startJob({
      id: COACH_JOB_ID,
      kind: 'chat',
      title: t('coach_title'),
      label: t('coach_analyzing'),
      detail: trimmed.slice(0, 60),
      indeterminate: true,
      targetTab: 'coach',
      cancel: () => get().cancelSending(),
    });

    try {
      const { shareAcademicContextWithTutor } = getPrivacyPrefs();
      const contextPayload = shareAcademicContextWithTutor
        ? (() => {
            const cappedAssignments = assignments.slice(0, 30).map((a) => {
              const { rawEmail: _rawEmail, senderEmail: _senderEmail, ...rest } = a as Assignment & {
                rawEmail?: unknown;
                senderEmail?: unknown;
              };
              return { ...rest, notes: (a.notes || '').slice(0, 300) };
            });
            const cappedAlerts = alerts.slice(0, 15).map((a) => {
              const { rawEmail: _rawEmail, senderEmail: _senderEmail, ...rest } = a as EmailAlert & {
                senderEmail?: unknown;
              };
              return { ...rest, oneLineSummary: (a.oneLineSummary || '').slice(0, 300) };
            });
            const cappedEvents = events.slice(0, 20).map((ev) => {
              const { rawEmail: _rawEmail, senderEmail: _senderEmail, ...rest } = ev as CalendarEvent & {
                rawEmail?: unknown;
                senderEmail?: unknown;
              };
              return {
                ...rest,
                ...(ev.description ? { description: ev.description.slice(0, 300) } : {}),
              };
            });
            return {
              assignments: cappedAssignments,
              events: cappedEvents,
              alerts: cappedAlerts,
              sources: cappedAssignments.map((a) => ({ type: 'canvas', id: a.id })),
              ...(extraContext || {}),
            };
          })()
        : {};

      // Only send raw base64 images for the 2 most recent image-bearing user messages to stay under body limits.
      const imageMsgIndices = withUser
        .map((m, idx) => (m.role === 'user' && m.images?.length ? idx : -1))
        .filter((idx) => idx >= 0);
      const keepImageIdx = new Set(imageMsgIndices.slice(-2));

      const response = await sendStudyAssistantMessage(
        withUser.map((m, idx) => ({
          role: m.role,
          content: m.content ?? (m.contentKey ? t(m.contentKey) : ''),
          ...(m.role === 'user' && keepImageIdx.has(idx) && m.images?.length
            ? {
                images: m.images
                  .map((img) => {
                    const comma = img.dataUrl.indexOf(',');
                    const base64 = comma >= 0 ? img.dataUrl.slice(comma + 1) : img.dataUrl;
                    return base64 ? { base64, mimeType: img.mimeType } : null;
                  })
                  .filter((x): x is { base64: string; mimeType: string } => Boolean(x)),
              }
            : {}),
        })),
        contextPayload,
        get().coachMode
      );

      if (controller.signal.aborted) return;

      useAiJobsStore.getState().updateJob(COACH_JOB_ID, {
        label: t('coach_streaming'),
      });

      for (let i = 0; i < response.length; i += 18) {
        if (controller.signal.aborted) return;
        set({ streamingContent: response.slice(0, i + 18) });
        await new Promise((r) => setTimeout(r, 8));
      }

      const assistantMessage: CoachMessage = {
        role: 'assistant',
        content: response,
      };
      const finalMessages = [...get().messages, assistantMessage];
      persist(finalMessages);
      set({
        messages: finalMessages,
        streamingContent: '',
        isSending: false,
        startedAt: null,
      });

      useAiJobsStore.getState().completeJob(COACH_JOB_ID, {
        label: t('coach_reply_ready'),
        detail: response.slice(0, 72).replace(/\s+/g, ' '),
      });

      try {
        const { db } = await import('../services/db');
        await db.briefs?.add?.({
          id: `chat-${Date.now()}`,
          topic: trimmed.slice(0, 40),
          subject: 'chat',
          brief: response.slice(0, 500),
          createdAt: new Date().toISOString(),
        } as any);
      } catch {}
    } catch (err) {
      if (controller.signal.aborted) return;
      const errorDetail =
        err instanceof Error && err.message ? err.message : t('coach_error_fallback');
      const finalMessages = [
        ...get().messages,
        {
          role: 'assistant' as const,
          content: t('coach_error_msg', { detail: errorDetail }),
        },
      ];
      persist(finalMessages);
      set({
        messages: finalMessages,
        streamingContent: '',
        isSending: false,
        startedAt: null,
      });
      useAiJobsStore.getState().failJob(COACH_JOB_ID, errorDetail);
    } finally {
      if (activeChatController === controller) {
        activeChatController = null;
      }
    }
  },
}));

// File the conversation that was already on this device before history existed.
void saveCoachChat(useCoachChatStore.getState().activeChatId, useCoachChatStore.getState().messages);
