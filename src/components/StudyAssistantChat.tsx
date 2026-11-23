import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  Bot,
  Trash2,
  ArrowLeft,
  ChevronDown,
  Check,
  Zap,
  Compass,
  Brain,
  Copy,
  Lightbulb,
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import {
  AiCoachMode,
  normalizeAiCoachMode,
  sendStudyAssistantMessage,
} from '../services/gemini';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useT } from '../services/i18n';

const COACH_MODE_STORAGE_KEY = 'scc_ai_coach_mode_v1';

function loadInitialCoachMode(): AiCoachMode {
  try {
    const raw = localStorage.getItem(COACH_MODE_STORAGE_KEY);
    return normalizeAiCoachMode(raw);
  } catch {}
  return 'balanced';
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

const TIER_ORDER: readonly AiCoachMode[] = ['quick', 'balanced', 'reasoning', 'apex'];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useT();

  useEffect(() => {
    try {
      localStorage.setItem(COACH_MODE_STORAGE_KEY, coachMode);
    } catch {}
  }, [coachMode]);

  useEffect(() => {
    try {
      localStorage.setItem('scc_chat_messages_v2', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Close tier menu on outside click or Escape, restoring focus to the trigger on keyboard dismiss.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Auto-resize multi-line composer textarea cleanly up to 160px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
  }, [inputText]);

  const tierMeta: Record<
    AiCoachMode,
    {
      label: string;
      desc: string;
      limit: string;
      limitClass: string;
      Icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    quick: {
      label: t('coach_tier_quick_name'),
      desc: t('coach_tier_quick_desc'),
      limit: t('coach_tier_quick_limit'),
      limitClass: 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border-[var(--status-ok-border)]/50',
      Icon: Zap,
    },
    balanced: {
      label: t('coach_tier_balanced_name'),
      desc: t('coach_tier_balanced_desc'),
      limit: t('coach_tier_balanced_limit'),
      limitClass: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]/50',
      Icon: Compass,
    },
    reasoning: {
      label: t('coach_tier_reasoning_name'),
      desc: t('coach_tier_reasoning_desc'),
      limit: t('coach_tier_reasoning_limit'),
      limitClass: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)]/50',
      Icon: Brain,
    },
    apex: {
      label: t('coach_tier_apex_name'),
      desc: t('coach_tier_apex_desc'),
      limit: t('coach_tier_apex_limit'),
      limitClass: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]/60',
      Icon: Sparkles,
    },
  };

  if (!isOpen) return null;

  const activeTier = tierMeta[coachMode];
  const ActiveTierIcon = activeTier.Icon;
  const isFreshWelcome = messages.length === 1 && messages[0]?.contentKey === 'coach_welcome';

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (currentIndex + 1 + TIER_ORDER.length) % TIER_ORDER.length;
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (currentIndex - 1 + TIER_ORDER.length) % TIER_ORDER.length;
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[TIER_ORDER.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  const renderTierSelector = (compact = false) => (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((prev) => {
            const next = !prev;
            if (next) {
              requestAnimationFrame(() => {
                const activeIdx = TIER_ORDER.indexOf(coachMode);
                itemRefs.current[activeIdx >= 0 ? activeIdx : 0]?.focus();
              });
            }
            return next;
          });
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !menuOpen) {
            e.preventDefault();
            setMenuOpen(true);
            requestAnimationFrame(() => itemRefs.current[0]?.focus());
          }
        }}
        className={`inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/80 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all cursor-pointer active:scale-[0.98] ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
        }`}
      >
        <ActiveTierIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
        <span className="font-bold tracking-tight">{activeTier.label}</span>
        <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeTier.limitClass}`}>
          {activeTier.limit}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label={t('coach_selector_aria')}
          onKeyDown={handleMenuKeyDown}
          className={`absolute z-50 mt-2 w-[310px] sm:w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-2xl p-1.5 origin-top-right animate-in fade-in zoom-in-95 duration-150 ${
            compact ? 'left-0' : 'right-0 sm:left-0 sm:right-auto'
          }`}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('coach_selector_heading')}
          </div>
          <div className="space-y-1">
            {TIER_ORDER.map((modeKey, idx) => {
              const info = tierMeta[modeKey];
              const TierIcon = info.Icon;
              const active = coachMode === modeKey;
              return (
                <button
                  key={modeKey}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setCoachMode(modeKey);
                    setMenuOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer flex items-start gap-3 focus-visible:outline-2 focus-visible:outline-[var(--accent-fill)] ${
                    active
                      ? 'bg-[var(--accent-soft)]/80 text-[var(--text-primary)]'
                      : 'hover:bg-[var(--bg-hover)]/70 text-[var(--text-primary)]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      active
                        ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <TierIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{info.label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${info.limitClass}`}>
                        {info.limit}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                      {info.desc}
                    </p>
                  </div>
                  {active && <Check className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsSending(true);
    setStreamingContent('');

    try {
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
        coachMode
      );

      for (let i = 0; i < response.length; i += 12) {
        setStreamingContent(response.slice(0, i + 12));
        await new Promise((r) => setTimeout(r, 10));
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      try {
        const { db } = await import('../services/db');
        await db.briefs?.add?.({
          id: `chat-${Date.now()}`,
          topic: text.slice(0, 40),
          subject: 'chat',
          brief: response.slice(0, 500),
          createdAt: new Date().toISOString(),
        } as any);
      } catch {}
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

  const handleCopyMessage = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {}
  };

  if (isFullScreen) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden animate-in fade-in duration-200">
        {/* Clean ChatGPT/Claude-inspired Header Bar */}
        <header className="min-h-14 px-4 sm:px-6 py-2 bg-[var(--bg-surface)]/95 backdrop-blur-xs border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title={t('coach_return')}
              aria-label={t('coach_return')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('coach_return')}</span>
            </button>

            <div className="h-5 w-px bg-[var(--border-hairline)] hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-fill)] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight hidden md:inline">
                {t('coach_title')}
              </span>
            </div>

            {renderTierSelector(false)}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/50">
              <Lightbulb className="w-3 h-3 shrink-0" />
              <span>{t('coach_banner')}</span>
            </span>

            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    contentKey: 'coach_cleared_full',
                  },
                ])
              }
              className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1.5"
              title={t('coach_clear_title')}
              aria-label={t('coach_clear_title')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('coach_new_chat')}</span>
            </button>
          </div>
        </header>

        {/* Full-width Scrollable Chat Stream (no cramped narrow gutters) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-6">
          <div className="w-full max-w-[1160px] mx-auto space-y-6">
            {isFreshWelcome ? (
              <div className="py-8 sm:py-14 space-y-8 animate-in fade-in duration-200">
                <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {t('coach_hero_heading')}
                  </h2>
                  <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    <MathMarkdown>{t('coach_welcome')}</MathMarkdown>
                  </div>
                </div>

                {/* Starter Prompt Cards across full width */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PROMPT_SUGGESTION_KEYS.map((key) => {
                    const promptText = t(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSend(promptText)}
                        className="p-4 text-left rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]/80 border border-[var(--border-default)] hover:border-[var(--accent-border)] transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5 flex flex-col justify-between gap-3 group"
                      >
                        <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] leading-snug">
                          {promptText}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--accent-text)] flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>{t('coach_ask_starter')}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const text = msg.contentKey ? t(msg.contentKey) : msg.content || '';
                  if (msg.role === 'user') {
                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl rounded-br-xs bg-[var(--accent-fill)] text-white text-sm shadow-xs leading-relaxed">
                          <div className="prose prose-sm prose-invert max-w-none leading-relaxed">
                            <MathMarkdown>{text}</MathMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start gap-3.5 sm:gap-4 group">
                      <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/70 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-[var(--text-primary)]">
                          <MathMarkdown>{text}</MathMarkdown>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(idx, text)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>{t('copied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{t('scanner_copy_btn')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSending && streamingContent && (
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/70 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none leading-relaxed text-[var(--text-primary)]">
                      <MathMarkdown>{streamingContent}</MathMarkdown>
                    </div>
                  </div>
                )}

                {isSending && !streamingContent && (
                  <div className="flex items-center gap-3 text-[var(--text-secondary)] text-xs py-2">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/70 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 animate-pulse" />
                    </div>
                    <span className="animate-pulse font-medium">{t('coach_analyzing')}</span>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Modern Multi-Line Composer Card (ChatGPT/Claude style) */}
        <div className="px-4 sm:px-8 lg:px-12 pb-4 pt-2 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)] to-transparent shrink-0">
          <div className="w-full max-w-[1160px] mx-auto">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] focus-within:border-[var(--accent-fill)] focus-within:ring-2 focus-within:ring-[var(--accent-fill)]/15 rounded-2xl shadow-card p-3 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
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
                className="w-full px-1.5 py-1 bg-transparent text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[var(--border-hairline)]">
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] min-w-0 truncate">
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)]">
                    <ActiveTierIcon className="w-3 h-3 text-[var(--accent-text)]" />
                    <span>{activeTier.label}</span>
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="truncate">
                    {t('coach_context_summary', {
                      tasks: assignments.length,
                      events: events.length,
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() || isSending}
                  aria-label={t('coach_send')}
                  className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  {isSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>{t('coach_send')}</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Slide-over Drawer Fallback
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-full sm:w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
      id="ai-study-coach-pane"
    >
      <div className="p-3.5 bg-[var(--bg-raised)] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-fill)] text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold leading-none">{t('coach_title')}</h4>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{activeTier.label} • {activeTier.limit}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  role: 'assistant',
                  contentKey: 'coach_cleared_drawer',
                },
              ])
            }
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-hover)] cursor-pointer"
            title={t('coach_clear_title')}
            aria-label={t('coach_clear_title')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
            title={t('coach_close_title')}
            aria-label={t('coach_close_title')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3.5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-2 shrink-0">
        {renderTierSelector(true)}
      </div>

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
              className={`max-w-[85%] p-2.5 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-fill)] text-white rounded-br-xs shadow-xs'
                  : 'bg-[var(--bg-subtle)]/60 text-[var(--text-primary)] rounded-bl-xs'
              }`}
            >
              <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
                <MathMarkdown>{msg.contentKey ? t(msg.contentKey) : (msg.content || '')}</MathMarkdown>
              </div>
            </div>
          </div>
        ))}

        {isSending && streamingContent && (
          <div className="flex items-start gap-2 justify-start">
            <div className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[85%] p-2.5 rounded-xl bg-[var(--bg-subtle)]/60 rounded-bl-xs">
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
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          aria-label={t('coach_send')}
          className="p-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl cursor-pointer disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
