import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  Bot,
  History,
  MessageSquarePlus,
  ArrowLeft,
  ChevronDown,
  Check,
  Zap,
  Compass,
  Brain,
  Copy,
  Lightbulb,
  ImagePlus,
  ShieldCheck,
} from 'lucide-react';
import { MathMarkdown } from './MathMarkdown';
import {
  AiCoachMode,
} from '../services/gemini';
import { useCoachChatStore, type CoachImageAttachment } from '../store/coachChatStore';
import { CoachHistoryPanel } from './CoachHistoryPanel';
import { Assignment, CalendarEvent, EmailAlert } from '../types';
import { useT } from '../services/i18n';

const PROMPT_SUGGESTION_KEYS = [
  'coach_chip_1',
  'coach_chip_2',
  'coach_chip_3',
  'coach_chip_4',
] as const;

const TIER_ORDER: readonly AiCoachMode[] = ['quick', 'balanced', 'reasoning', 'apex'];
const MAX_COACH_IMAGES = 4;

async function resizeImageFileToAttachment(file: File): Promise<CoachImageAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = dataUrl;
    });
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h);
      const jpegUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = jpegUrl.slice(jpegUrl.indexOf(',') + 1);
      return { dataUrl: jpegUrl, base64, mimeType: 'image/jpeg', name: file.name };
    }
  } catch {
    // Fallback to raw dataUrl if canvas is unavailable
  }
  const mimeType = file.type || 'image/png';
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  return { dataUrl, base64, mimeType, name: file.name };
}

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
  const {
    messages,
    isSending,
    streamingContent,
    coachMode,
    startedAt,
    setCoachMode,
    clearMessages,
    cancelSending,
    sendMessage,
  } = useCoachChatStore();

  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  // On a phone the list covers the chat, so close it once a chat is picked.
  const hideHistoryOnNarrow = () => {
    if (window.matchMedia?.('(max-width: 767px)')?.matches) setShowHistory(false);
  };
  const [pendingImages, setPendingImages] = useState<CoachImageAttachment[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useT();

  const translateWithFallback = (key: string, enFallback: string, viFallback: string): string => {
    const val = t(key);
    if (val && val !== key) return val;
    return (lang === 'vi' ? viFallback : enFallback) || enFallback;
  };

  const hintOnlyLabel = translateWithFallback(
    'coach_hint_only_badge',
    'Socratic Hint-Only Mode',
    'Chế độ Gợi ý Socratic'
  );
  const hintOnlyDesc = translateWithFallback(
    'coach_hint_only_title',
    'Guides you step by step with hints and never solves homework directly',
    'Hướng dẫn từng bước bằng gợi ý, không giải hộ bài tập trực tiếp'
  );

  useEffect(() => {
    if (!isSending || !startedAt) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const timer = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSending, startedAt]);

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

  const renderTierSelector = (compact = false, direction: 'up' | 'down' = 'up') => (
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
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menuOpen) {
            e.preventDefault();
            setMenuOpen(true);
            requestAnimationFrame(() => itemRefs.current[0]?.focus());
          }
        }}
        className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/80 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-all cursor-pointer active:scale-[0.98] ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        }`}
      >
        <ActiveTierIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
        <span className="font-bold tracking-tight">{activeTier.label}</span>
        <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeTier.limitClass}`}>
          {activeTier.limit}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
            direction === 'up'
              ? menuOpen
                ? 'rotate-0'
                : 'rotate-180'
              : menuOpen
                ? 'rotate-180'
                : ''
          }`}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label={t('coach_selector_aria')}
          onKeyDown={handleMenuKeyDown}
          className={`absolute z-50 left-0 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 ${
            compact ? 'w-[295px] sm:w-[320px]' : 'w-[310px] sm:w-[340px]'
          } ${
            direction === 'up' ? 'bottom-full mb-2 origin-bottom-left' : 'mt-2 origin-top-left'
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

  const handleAttachFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const remaining = Math.max(0, MAX_COACH_IMAGES - pendingImages.length);
    const picked = files.slice(0, remaining);
    if (picked.length === 0) return;
    const encoded = await Promise.all(picked.map((f) => resizeImageFileToAttachment(f)));
    setPendingImages((prev) => [...prev, ...encoded].slice(0, MAX_COACH_IMAGES));
  };

  const handlePasteImages = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgFiles = items
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => Boolean(f));
    if (imgFiles.length > 0) {
      e.preventDefault();
      await handleAttachFiles(imgFiles);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend ?? inputText;
    const imgs = textToSend ? [] : pendingImages;
    if ((!text.trim() && imgs.length === 0) || isSending) return;
    // The reply has to be visible, so get the list out of the way where it covers the chat.
    if (isFullScreen) hideHistoryOnNarrow();
    else setShowHistory(false);
    if (!textToSend) {
      setInputText('');
      setPendingImages([]);
    }
    await sendMessage({
      text,
      images: imgs,
      assignments,
      events,
      alerts,
    });
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
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                {t('coach_title')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              title={hintOnlyDesc}
              aria-label={hintOnlyDesc}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]/50"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{hintOnlyLabel}</span>
            </span>

            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/50">
              <Lightbulb className="w-3 h-3 shrink-0" />
              <span>{t('coach_banner')}</span>
            </span>

            <button
              type="button"
              onClick={() => setShowHistory((open) => !open)}
              aria-expanded={showHistory}
              className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1.5"
              title={t('coach_history_title')}
              aria-label={t('coach_history_title')}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('coach_history_title')}</span>
            </button>

            <button
              type="button"
              onClick={() => clearMessages()}
              disabled={isSending}
              className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-text)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              title={t('coach_new_chat')}
              aria-label={t('coach_new_chat')}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('coach_new_chat')}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex relative">
        {showHistory && (
          <aside className="absolute md:static inset-y-0 left-0 z-30 w-72 max-w-[85%] shrink-0 border-r border-[var(--border-hairline)] shadow-xl md:shadow-none">
            <CoachHistoryPanel onClose={() => setShowHistory(false)} onPick={hideHistoryOnNarrow} />
          </aside>
        )}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">

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
                        <div className="max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl rounded-br-xs bg-[var(--accent-fill)] text-white text-sm shadow-xs leading-relaxed space-y-2">
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {msg.images.map((img, imgIdx) => (
                                <img
                                  key={imgIdx}
                                  src={img.dataUrl}
                                  alt={img.name || 'Attached image'}
                                  className="max-h-40 rounded-xl border border-white/25 object-cover"
                                />
                              ))}
                            </div>
                          )}
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
                  <div className="flex items-center justify-between gap-3 text-[var(--text-secondary)] text-xs py-2 px-3 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/70 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 animate-pulse" />
                      </div>
                      <span className="animate-pulse font-medium">
                        {t('coach_analyzing')} ({elapsedSec}s · {t('ai_bg_switch_safe')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelSending}
                      className="px-2.5 py-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:text-[var(--status-err-text)] text-[11px] font-semibold cursor-pointer"
                    >
                      {t('ai_job_stop')}
                    </button>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Hidden Shared Image Input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleAttachFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Modern Multi-Line Composer Card (ChatGPT/Claude style) */}
        <div className="px-4 sm:px-8 lg:px-12 pb-4 pt-2 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)] to-transparent shrink-0">
          <div className="w-full max-w-[1160px] mx-auto">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                if (e.dataTransfer.files?.length) {
                  e.preventDefault();
                  void handleAttachFiles(e.dataTransfer.files);
                }
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] focus-within:border-[var(--accent-fill)] focus-within:ring-2 focus-within:ring-[var(--accent-fill)]/15 rounded-2xl shadow-card p-3 transition-all"
            >
              {pendingImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-[var(--border-hairline)]">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-subtle)] shrink-0">
                      <img src={img.dataUrl} alt={img.name || 'Attachment'} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={t('coach_remove_image')}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  <span className="text-[11px] text-[var(--text-muted)] ml-1">{t('coach_attach_limit')}</span>
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={(e) => void handlePasteImages(e)}
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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-1 border-t border-[var(--border-hairline)]">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] min-w-0">
                  {renderTierSelector(false, 'up')}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isSending || pendingImages.length >= MAX_COACH_IMAGES}
                    title={t('coach_attach_image')}
                    aria-label={t('coach_attach_image')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/80 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="hidden sm:inline">{t('coach_attach_image')}</span>
                  </button>
                  <span aria-hidden="true" className="hidden md:inline">•</span>
                  <span className="hidden md:inline truncate">
                    {t('coach_context_summary', {
                      tasks: assignments.length,
                      events: events.length,
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim() && pendingImages.length === 0) || isSending}
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
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-fill)] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold leading-none truncate">{t('coach_title')}</h4>
              <span
                title={hintOnlyDesc}
                aria-label={hintOnlyDesc}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]/50 shrink-0"
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">{hintOnlyLabel}</span>
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{activeTier.label} • {activeTier.limit}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            aria-expanded={showHistory}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
            title={t('coach_history_title')}
            aria-label={t('coach_history_title')}
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => clearMessages()}
            disabled={isSending}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] cursor-pointer disabled:opacity-40"
            title={t('coach_new_chat')}
            aria-label={t('coach_new_chat')}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
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

      {showHistory && (
        <div className="flex-1 min-h-0">
          <CoachHistoryPanel onClose={() => setShowHistory(false)} onPick={() => setShowHistory(false)} />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-3.5 space-y-3 text-xs ${showHistory ? 'hidden' : ''}`}>
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
              className={`max-w-[85%] p-2.5 rounded-xl space-y-1.5 ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-fill)] text-white rounded-br-xs shadow-xs'
                  : 'bg-[var(--bg-subtle)]/60 text-[var(--text-primary)] rounded-bl-xs'
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.images.map((img, imgIdx) => (
                    <img
                      key={imgIdx}
                      src={img.dataUrl}
                      alt={img.name || 'Attached image'}
                      className="max-h-24 rounded-lg border border-white/25 object-cover"
                    />
                  ))}
                </div>
              )}
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

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleAttachFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="p-2.5 border-t border-[var(--border-default)] bg-[var(--bg-surface)] space-y-2">
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-[var(--border-default)] bg-[var(--bg-subtle)] shrink-0">
                <img src={img.dataUrl} alt={img.name || 'Attachment'} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={t('coach_remove_image')}
                  className="absolute top-0 right-0 w-3.5 h-3.5 rounded-bl bg-black/70 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending || pendingImages.length >= MAX_COACH_IMAGES}
            title={t('coach_attach_image')}
            aria-label={t('coach_attach_image')}
            className="p-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-xl cursor-pointer disabled:opacity-40 shrink-0"
          >
            <ImagePlus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={(e) => void handlePasteImages(e)}
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
            disabled={(!inputText.trim() && pendingImages.length === 0) || isSending}
            aria-label={t('coach_send')}
            className="p-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl cursor-pointer disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          {renderTierSelector(true, 'up')}
        </div>
      </div>
    </div>
  );
};
