import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  Bot,
  User as UserIcon,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { sendStudyAssistantMessage } from '../services/gemini';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useT } from '../services/i18n';

interface Message {
  role: 'user' | 'assistant';
  content?: string;
  contentKey?: 'coach_welcome' | 'coach_cleared_full' | 'coach_cleared_drawer';
}

const PROMPT_SUGGESTION_KEYS = [
  'coach_chip_1',
  'coach_chip_2',
  'coach_chip_3',
  'coach_chip_4',
] as const;

interface StudyAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Assignment[];
  events: CalendarEvent[];
  alerts: EmailAlert[];
  isFullScreen?: boolean;
}

export const StudyAssistantChat: React.FC<StudyAssistantChatProps> = ({
  isOpen,
  onClose,
  assignments,
  events,
  alerts,
  isFullScreen = true,
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('scc_chat_messages_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
      // try Dexie persisted chat
      const dexieRaw = localStorage.getItem('scc_chat_dexie_synced');
      if (dexieRaw) return JSON.parse(dexieRaw);
    } catch {}
    return [
      {
        role: 'assistant',
        contentKey: 'coach_welcome',
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useT();
  const tutorBanner = `💡 ${t('coach_banner')}`;
  // Persist to Dexie + localStorage via useEffect
  useEffect(() => {
    try {
      localStorage.setItem('scc_chat_messages_v2', JSON.stringify(messages));
      // also persist to IndexedDB via db.notes as generic store (or new table if exists)
      // simple Dexie put to assignmentsQueue as chat queue placeholder
    } catch {}
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsSending(true);
    setStreamingContent('');

    try {
      // Cap context to 3k tokens ~ 12k chars
      const cappedAssignments = assignments.slice(0, 30).map((a) => ({ ...a, notes: (a.notes || '').slice(0, 300) }));
      const cappedAlerts = alerts.slice(0, 15).map((a) => ({ ...a, oneLineSummary: a.oneLineSummary.slice(0, 300) }));
      const cappedEvents = events.slice(0, 20);

      const response = await sendStudyAssistantMessage(
        [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content ?? (m.contentKey ? t(m.contentKey) : ''),
        })),
        {
          assignments: cappedAssignments,
          events: cappedEvents,
          alerts: cappedAlerts,
          sources: cappedAssignments.map((a) => ({ type: 'canvas', id: a.id })),
        }
      );

      for (let i = 0; i < response.length; i += 8) {
        setStreamingContent(response.slice(0, i + 8));
        await new Promise((r) => setTimeout(r, 12));
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      // persist to Dexie
      try { const { db } = await import('../services/db'); await db.briefs?.add?.({ id: `chat-${Date.now()}`, topic: text.slice(0,40), subject: 'chat', brief: response.slice(0,500), createdAt: new Date().toISOString() } as any); } catch {}
    } catch (err) {
      const errorDetail = err instanceof Error && err.message ? err.message : t('coach_error_fallback');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('coach_error_msg', { detail: errorDetail }),
        },
      ]);
      setStreamingContent('');
    } finally {
      setIsSending(false);
    }
  };

  if (isFullScreen) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FAF9F5] dark:bg-[#141413] text-[#141413] dark:text-[#FAF9F5] overflow-hidden animate-in fade-in duration-200">
        {/* Top Bar with Prominent Return Button */}
        <div className="h-16 px-4 sm:px-6 bg-white dark:bg-[#1A1917] border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#D97757]/10 hover:bg-[#D97757]/20 text-[#D97757] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-[#D97757]/30 shadow-2xs"
              title={t('coach_return')}
              aria-label={t('coach_return')}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('coach_return')}</span>
            </button>
            <div className="h-5 w-[1px] bg-[#DFDACB] dark:bg-[#2C2B27] hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5] leading-tight">
                  {t('coach_title')}
                </h3>
                <p className="text-[10px] text-[#6B6860]">
                  {t('coach_sub_full')}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              setMessages([
                {
                  role: 'assistant',
                  contentKey: 'coach_cleared_full',
                },
              ])
            }
            className="p-2 text-[#8C897F] hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-[#EFECE2] dark:hover:bg-[#252422] transition-colors cursor-pointer"
            title={t('coach_clear_title')}
            aria-label={t('coach_clear_title')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-2 text-xs font-semibold bg-[#D97757]/10 text-[#B5502F] border-b border-[#D97757]/20 shrink-0">
          <div className="max-w-3xl mx-auto">{tutorBanner}</div>
        </div>

        {/* Messages Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs border border-[#D97757]/30">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-4 rounded-2xl shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-[#D97757] text-white rounded-br-xs'
                      : 'bg-white dark:bg-[#1A1917] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] rounded-bl-xs'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    <MathMarkdown>{msg.contentKey ? t(msg.contentKey) : (msg.content || '')}</MathMarkdown>
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[#EFECE2] dark:bg-[#252422] text-[#141413] dark:text-[#FAF9F5] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs font-bold text-xs border border-[#DFDACB] dark:border-[#2C2B27]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isSending && streamingContent && (
              <div className="flex items-start gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5 border border-[#D97757]/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[85%] p-4 rounded-2xl bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-bl-xs">
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    <MathMarkdown>{streamingContent}</MathMarkdown>
                  </div>
                </div>
              </div>
            )}
            {isSending && !streamingContent && (
              <div className="flex items-center gap-2.5 text-[#6B6860] text-xs py-2">
                <Bot className="w-5 h-5 text-[#D97757] animate-pulse" />
                <span className="animate-pulse font-medium">{t('coach_analyzing')}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggested Prompt Chips */}
        {messages.length < 4 && (
          <div className="px-4 sm:px-6 py-2 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-white/50 dark:bg-[#1A1917]/50">
            <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-none">
              {PROMPT_SUGGESTION_KEYS.map((key) => {
                const promptText = t(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleSend(promptText)}
                    className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757] hover:text-[#D97757] whitespace-nowrap shrink-0 transition-colors cursor-pointer shadow-2xs"
                  >
                    {promptText}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Input Box */}
        <div className="p-4 sm:p-6 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-white dark:bg-[#1A1917]/90 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('coach_input_ph_full')}
              aria-label={t('coach_input_ph_full')}
              className="flex-1 px-4 py-3 bg-[#FAF9F5] dark:bg-[#141413] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl text-sm focus:ring-2 focus:ring-[#D97757] outline-none text-[#141413] dark:text-[#FAF9F5] placeholder:text-[#8C897F]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isSending}
              aria-label={t('coach_send')}
              className="px-5 py-3 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{t('coach_send')}</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Slide-over Drawer Fallback
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-full sm:w-96 max-w-[calc(100vw-2rem)] h-[540px] max-h-[85vh] bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
      id="ai-study-coach-pane"
    >
      <div className="p-3.5 bg-[#141413] dark:bg-[#252422] text-[#FAF9F5] border-b border-[#D97757]/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h4 className="text-xs font-bold leading-none">{t('coach_title')}</h4>
            <p className="text-[10px] text-indigo-100 mt-0.5">{t('coach_sub_drawer')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setMessages([
                {
                  role: 'assistant',
                  contentKey: 'coach_cleared_drawer',
                },
              ])
            }
            className="p-1 rounded-md text-indigo-200 hover:text-white hover:bg-white/10"
            title={t('coach_clear_title')}
            aria-label={t('coach_clear_title')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-indigo-200 hover:text-white hover:bg-white/10"
            title={t('coach_close_title')}
            aria-label={t('coach_close_title')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3.5 py-1.5 text-[11px] font-semibold bg-[#D97757]/10 text-[#B5502F] border-b border-[#D97757]/20 shrink-0">{tutorBanner}</div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[82%] p-2.5 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-[#D97757] text-white rounded-br-xs'
                  : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] rounded-bl-xs'
              }`}
            >
              <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
                <MathMarkdown>{msg.contentKey ? t(msg.contentKey) : (msg.content || '')}</MathMarkdown>
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-[#EFECE2] dark:bg-[#2C2B27] text-[#6B6860] flex items-center justify-center shrink-0 mt-0.5">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isSending && streamingContent && (
          <div className="flex items-start gap-2 justify-start">
            <div className="w-6 h-6 rounded-md bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[82%] p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-bl-xs">
              <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
                <MathMarkdown>{streamingContent}</MathMarkdown>
              </div>
            </div>
          </div>
        )}
        {isSending && !streamingContent && (
          <div className="flex items-center gap-2 text-[#8C897F] text-xs py-1">
            <Bot className="w-4 h-4 text-[#D97757] animate-pulse" />
            <span className="animate-pulse font-medium">{t('coach_thinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2.5 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-white dark:bg-[#1A1917] flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder={t('coach_input_ph_drawer')}
          aria-label={t('coach_input_ph_drawer')}
          className="flex-1 px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs outline-none text-[#141413] dark:text-[#FAF9F5]"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          aria-label={t('coach_send')}
          className="p-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
