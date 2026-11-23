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
  AlertTriangle,
  Square,
  WifiOff,
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import { AiCoachMode, sendStudyAssistantMessage } from '../services/gemini';
import {
  getOfflineCoachLevel,
  setOfflineCoachLevel,
  type OfflineCoachLevel,
} from '../services/localAiConfig';
import { abortLocalLlm } from '../services/localAi';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useT } from '../services/i18n';

const COACH_MODE_STORAGE_KEY = 'scc_ai_coach_mode_v1';

function loadInitialCoachMode(): AiCoachMode {
  try {
    const raw = localStorage.getItem(COACH_MODE_STORAGE_KEY);
    if (raw === 'professor' || raw === 'offline' || raw === 'auto') return raw;
    if (raw === 'teacher' || raw === 'fast') return 'auto';
  } catch {}
  return 'auto';
}

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
  const [coachMode, setCoachMode] = useState<AiCoachMode>(loadInitialCoachMode);
  const [offlineLevel, setOfflineLevel] = useState<OfflineCoachLevel>(getOfflineCoachLevel);
  const [downloadProgress, setDownloadProgress] = useState<{
    loaded: number;
    total: number;
    percent: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useT();
  const tutorBanner = `💡 ${t('coach_banner')}`;

  useEffect(() => {
    try {
      localStorage.setItem(COACH_MODE_STORAGE_KEY, coachMode);
    } catch {}
  }, [coachMode]);

  useEffect(() => {
    setOfflineCoachLevel(offlineLevel);
  }, [offlineLevel]);

  const modeMeta: Record<AiCoachMode, { label: string; badge: string; hint: string }> = {
    auto: {
      label: t('coach_mode_auto'),
      badge: t('coach_badge_online'),
      hint: t('coach_mode_hint_auto'),
    },
    professor: {
      label: t('coach_mode_professor'),
      badge: t('coach_badge_online'),
      hint: t('coach_mode_hint_professor'),
    },
    offline: {
      label: t('coach_mode_offline'),
      badge: t('coach_badge_offline'),
      hint: t('coach_mode_hint_offline'),
    },
  };

  const renderModeSelector = (compact = false) => (
    <div
      className={`inline-flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-0.5 ${compact ? 'gap-0.5' : 'gap-1'}`}
      role="group"
      aria-label="AI Coach mode"
    >
      {(['auto', 'professor', 'offline'] as AiCoachMode[]).map((modeKey) => {
        const active = coachMode === modeKey;
        const info = modeMeta[modeKey];
        return (
          <button
            key={modeKey}
            type="button"
            onClick={() => setCoachMode(modeKey)}
            title={info.hint}
            aria-pressed={active}
            className={`${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'} rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              active
                ? 'bg-[var(--accent-fill)] text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {modeKey === 'offline' && <WifiOff className="w-3 h-3 shrink-0" />}
            <span>{info.label}</span>
            <span
              className={`text-[9px] font-medium px-1 py-0.2 rounded ${
                active ? 'bg-white/20 text-white' : 'bg-[var(--bg-sunken)] text-[var(--text-muted)]'
              }`}
            >
              {info.badge}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderOfflineControls = (compact = false) => {
    if (coachMode !== 'offline') return null;
    const dlLoadedMb = downloadProgress ? Math.round((downloadProgress.loaded / (1024 * 1024)) * 10) / 10 : 0;
    const dlTotalMb = downloadProgress ? Math.round((downloadProgress.total / (1024 * 1024)) * 10) / 10 : 0;
    return (
      <div
        className={`${compact ? 'px-3.5 py-2' : 'px-4 sm:px-6 py-2.5'} bg-[var(--status-warn-bg)] border-b border-[var(--status-warn-border)] shrink-0`}
      >
        <div className={compact ? 'space-y-1.5' : 'max-w-3xl mx-auto space-y-2'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--status-warn-text)]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t('coach_offline_warn_title')}. </span>
                <span>{t('coach_offline_warn_body')}</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] p-0.5 shrink-0">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] px-1.5">
                {t('coach_offline_level_label')}
              </span>
              {(['quick', 'deeper'] as OfflineCoachLevel[]).map((lvl) => {
                const active = offlineLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setOfflineLevel(lvl)}
                    aria-pressed={active}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-fill)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {lvl === 'quick'
                      ? `${t('coach_offline_quick_label')} (${t('coach_offline_quick_ram')})`
                      : `${t('coach_offline_deeper_label')} (${t('coach_offline_deeper_ram')})`}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {offlineLevel === 'quick' ? t('coach_offline_quick_desc') : t('coach_offline_deeper_desc')}
          </p>
          {downloadProgress && downloadProgress.percent < 100 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-primary)]">
                <span>
                  {dlTotalMb > 1
                    ? t('coach_offline_downloading_mb', {
                        loaded: dlLoadedMb,
                        total: dlTotalMb,
                        percent: downloadProgress.percent,
                      })
                    : t('coach_offline_downloading', { percent: downloadProgress.percent })}
                </span>
                <span>{downloadProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden border border-[var(--border-default)]">
                <div
                  className="h-full bg-[var(--accent-fill)] transition-all duration-200"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleStopOffline = () => {
    abortLocalLlm();
    abortControllerRef.current?.abort();
  };
  // Persist to Dexie + localStorage via useEffect
  useEffect(() => {
    try {
      localStorage.setItem('scc_chat_messages_v2', JSON.stringify(messages));
      // also persist to IndexedDB via db.notes as generic store (or new table if exists)
      // simple Dexie put to assignmentsQueue as chat queue placeholder
    } catch {}
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
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
    setDownloadProgress(null);

    const ac = new AbortController();
    abortControllerRef.current = ac;

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
        },
        coachMode,
        {
          offlineLevel,
          signal: ac.signal,
          onToken: (partial) => setStreamingContent(partial),
          onDownloadProgress: (p) => setDownloadProgress({ loaded: p.loaded, total: p.total, percent: p.percent }),
        }
      );

      setDownloadProgress(null);

      if (coachMode !== 'offline') {
        for (let i = 0; i < response.length; i += 8) {
          setStreamingContent(response.slice(0, i + 8));
          await new Promise((r) => setTimeout(r, 12));
        }
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
      setDownloadProgress(null);
      const errorDetail = err instanceof Error && err.message ? err.message : t('coach_error_fallback');
      if (errorDetail === 'ABORTED') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: streamingContent ? `${streamingContent}\n\n_(${t('coach_offline_stopped')})_` : t('coach_offline_stopped'),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              coachMode === 'offline'
                ? t('coach_offline_err_msg', { detail: errorDetail })
                : t('coach_error_msg', { detail: errorDetail }),
          },
        ]);
      }
      setStreamingContent('');
    } finally {
      abortControllerRef.current = null;
      setIsSending(false);
    }
  };

  if (isFullScreen) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden animate-in fade-in duration-200">
        {/* Top Bar with Prominent Return Button */}
        <div className="min-h-16 px-4 sm:px-6 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent-text)] border border-[var(--accent-border)] rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer  shadow-2xs"
              title={t('coach_return')}
              aria-label={t('coach_return')}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('coach_return')}</span>
            </button>
            <div className="h-5 w-[1px] bg-[var(--border-default)] hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                  {t('coach_title')}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {modeMeta[coachMode].hint}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {renderModeSelector(false)}
            <button
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    contentKey: 'coach_cleared_full',
                  },
                ])
              }
              className="p-2 text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title={t('coach_clear_title')}
              aria-label={t('coach_clear_title')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-2 text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent-text)] border-b border-[var(--accent-border)] shrink-0">
          <div className="max-w-3xl mx-auto">{tutorBanner}</div>
        </div>
        {renderOfflineControls(false)}

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
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-4 rounded-2xl shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent-fill)] text-white rounded-br-xs shadow-xs'
                      : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-bl-xs'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    <MathMarkdown>{msg.contentKey ? t(msg.contentKey) : (msg.content || '')}</MathMarkdown>
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs font-bold text-xs border border-[var(--border-default)]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isSending && streamingContent && (
              <div className="flex items-start gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5 ">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[85%] p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-bl-xs">
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    <MathMarkdown>{streamingContent}</MathMarkdown>
                  </div>
                </div>
              </div>
            )}
            {isSending && !streamingContent && (
              <div className="flex items-center gap-2.5 text-[var(--text-secondary)] text-xs py-2">
                <Bot className="w-5 h-5 text-[var(--accent-text)] animate-pulse" />
                <span className="animate-pulse font-medium">{t('coach_analyzing')}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggested Prompt Chips */}
        {messages.length < 4 && (
          <div className="px-4 sm:px-6 py-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/50">
            <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-none">
              {PROMPT_SUGGESTION_KEYS.map((key) => {
                const promptText = t(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleSend(promptText)}
                    className="text-xs font-medium px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] whitespace-nowrap shrink-0 transition-colors cursor-pointer shadow-2xs"
                  >
                    {promptText}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Input Box */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-default)] bg-[var(--bg-surface)] shrink-0">
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
              className="flex-1 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl text-sm focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/20 outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            {isSending && coachMode === 'offline' ? (
              <button
                type="button"
                onClick={handleStopOffline}
                aria-label={t('coach_offline_stop')}
                className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t('coach_offline_stop')}</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isSending}
                aria-label={t('coach_send')}
                className="px-5 py-3 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
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
            )}
          </div>
        </div>
      </div>
    );
  }

  // Slide-over Drawer Fallback
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-full sm:w-96 max-w-[calc(100vw-2rem)] h-[540px] max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
      id="ai-study-coach-pane"
    >
      <div className="p-3.5 bg-[var(--bg-raised)] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[var(--status-warn-text)]" />
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

      <div className="px-3.5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex items-center justify-between gap-2 shrink-0">
        {renderModeSelector(true)}
      </div>

      <div className="px-3.5 py-1.5 text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-text)] border-b border-[var(--accent-border)] shrink-0">{tutorBanner}</div>
      {renderOfflineControls(true)}

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[82%] p-2.5 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-fill)] text-white rounded-br-xs shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-bl-xs'
              }`}
            >
              <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
                <MathMarkdown>{msg.contentKey ? t(msg.contentKey) : (msg.content || '')}</MathMarkdown>
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)] flex items-center justify-center shrink-0 mt-0.5">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isSending && streamingContent && (
          <div className="flex items-start gap-2 justify-start">
            <div className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[82%] p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-bl-xs">
              <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
                <MathMarkdown>{streamingContent}</MathMarkdown>
              </div>
            </div>
          </div>
        )}
        {isSending && !streamingContent && (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs py-1">
            <Bot className="w-4 h-4 text-[var(--accent-text)] animate-pulse" />
            <span className="animate-pulse font-medium">{t('coach_thinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2.5 border-t border-[var(--border-default)] bg-[var(--bg-surface)] flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder={t('coach_input_ph_drawer')}
          aria-label={t('coach_input_ph_drawer')}
          className="flex-1 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs outline-none text-[var(--text-primary)]"
        />
        {isSending && coachMode === 'offline' ? (
          <button
            type="button"
            onClick={handleStopOffline}
            aria-label={t('coach_offline_stop')}
            className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isSending}
            aria-label={t('coach_send')}
            className="p-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
