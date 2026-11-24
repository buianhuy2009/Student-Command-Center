import { create } from 'zustand';
import {
  normalizeAiCoachMode,
  sendStudyAssistantMessage,
  type AiCoachMode,
} from '../services/gemini';
import { t } from '../services/i18n';
import type { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useAiJobsStore } from './aiJobsStore';

const COACH_MODE_STORAGE_KEY = 'scc_ai_coach_mode_v1';
const CHAT_STORAGE_KEY = 'scc_chat_messages_v2';
const COACH_JOB_ID = 'coach-chat';

export interface CoachMessage {
  role: 'user' | 'assistant';
  content?: string;
  contentKey?: 'coach_welcome' | 'coach_cleared_full' | 'coach_cleared_drawer';
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
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore storage quota errors.
  }
}

let activeChatController: AbortController | null = null;

interface CoachChatState {
  messages: CoachMessage[];
  isSending: boolean;
  streamingContent: string;
  coachMode: AiCoachMode;
  startedAt: number | null;
  setCoachMode: (mode: AiCoachMode) => void;
  clearMessages: (variant: 'full' | 'drawer') => void;
  cancelSending: () => void;
  sendMessage: (params: {
    text: string;
    assignments: Assignment[];
    events: CalendarEvent[];
    alerts: EmailAlert[];
    extraContext?: Record<string, unknown>;
  }) => Promise<void>;
}

export const useCoachChatStore = create<CoachChatState>((set, get) => ({
  messages: loadInitialMessages(),
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

  clearMessages: (variant) => {
    const next: CoachMessage[] = [
      {
        role: 'assistant',
        contentKey: variant === 'full' ? 'coach_cleared_full' : 'coach_cleared_drawer',
      },
    ];
    persistMessages(next);
    set({ messages: next, streamingContent: '' });
  },

  cancelSending: () => {
    if (activeChatController) {
      activeChatController.abort();
      activeChatController = null;
    }
    set({ isSending: false, streamingContent: '', startedAt: null });
  },

  sendMessage: async ({ text, assignments, events, alerts, extraContext }) => {
    const trimmed = text.trim();
    if (!trimmed || get().isSending) return;

    const controller = new AbortController();
    activeChatController = controller;

    const userMessage: CoachMessage = { role: 'user', content: trimmed };
    const prevMessages = get().messages;
    const withUser = [...prevMessages, userMessage];
    persistMessages(withUser);

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
      const cappedAssignments = assignments
        .slice(0, 30)
        .map((a) => ({ ...a, notes: (a.notes || '').slice(0, 300) }));
      const cappedAlerts = alerts
        .slice(0, 15)
        .map((a) => ({ ...a, oneLineSummary: a.oneLineSummary.slice(0, 300) }));
      const cappedEvents = events.slice(0, 20);

      const response = await sendStudyAssistantMessage(
        withUser.map((m) => ({
          role: m.role,
          content: m.content ?? (m.contentKey ? t(m.contentKey) : ''),
        })),
        {
          assignments: cappedAssignments,
          events: cappedEvents,
          alerts: cappedAlerts,
          sources: cappedAssignments.map((a) => ({ type: 'canvas', id: a.id })),
          ...(extraContext || {}),
        },
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
      persistMessages(finalMessages);
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
      persistMessages(finalMessages);
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
