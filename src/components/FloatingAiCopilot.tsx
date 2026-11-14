import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Minimize2,
  Bot,
  GraduationCap,
  Lightbulb,
  Zap,
  CheckCircle2,
  Columns2,
  Calculator,
  Calendar,
  Brain,
  Network,
} from 'lucide-react';
import { runAutonomousAgent } from '../services/gemini';
import { MathMarkdown } from './MathMarkdown';
import { AgentAction } from '../types';
import { useT } from '../services/i18n';

interface FloatingAiCopilotProps {
  onNavigateWorkspace?: (ws: string) => void;
  onExecuteAgentAction?: (action: AgentAction) => void;
  appContext?: {
    activeWorkspace?: string;
    assignmentsCount?: number;
    upcomingDeadlines?: string[];
  };
}

const QUICK_PILL_KEYS = [
  'agent_pill_1',
  'agent_pill_2',
  'agent_pill_3',
  'agent_pill_4',
  'agent_pill_5',
] as const;

export const FloatingAiCopilot: React.FC<FloatingAiCopilotProps> = ({
  onNavigateWorkspace: _onNavigateWorkspace,
  onExecuteAgentAction,
  appContext,
}) => {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      contentKey?: string;
      content?: string;
      executedActions?: AgentAction[];
    }>
  >([
    {
      role: 'assistant',
      contentKey: 'agent_welcome',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  // Division A guardrails: propose first, apply only on student approval; keep last batch for Undo
  const [pendingActions, setPendingActions] = useState<AgentAction[] | null>(null);
  const [lastApplied, setLastApplied] = useState<AgentAction[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const userMsg = inputText.trim();
    const updatedMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(updatedMessages);
    setInputText('');
    setIsThinking(true);

    try {
      const res = await runAutonomousAgent(userMsg, appContext);

      // Hold actions for student confirmation instead of executing immediately
      if (res.actions && res.actions.length > 0) {
        setPendingActions(res.actions);
      } else {
        setPendingActions(null);
      }

      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: res.reply,
          executedActions: res.actions,
        },
      ]);
    } catch (err) {
      console.error('Floating copilot agent error:', err);
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          contentKey: 'agent_error',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuickPill = (prompt: string) => {
    setInputText(prompt);
  };

  const explainAction = (a: AgentAction): string => {
    switch (a.type) {
      case 'setWorkspaceLayout':
        return t('agent_explain_layout', { left: a.payload.leftPane, right: a.payload.rightPane });
      case 'injectDesmosEquation':
        return t('agent_explain_desmos', { count: a.payload.expressions.length });
      case 'createCalendarMilestones':
        return t('agent_explain_milestones', { count: a.payload.events.length });
      case 'createSRSDeck':
        return t('agent_explain_srs', { title: a.payload.deckTitle, count: a.payload.cards.length });
      case 'generateMermaidDiagram':
        return t('agent_explain_diagram', { title: a.payload.title });
      case 'createStudyFlashcardsPreview':
        return t('agent_explain_flashcards', { count: a.payload.count || 5, topic: a.payload.topic });
      case 'draftPresentationOutline':
        return t('agent_explain_outline', { minutes: a.payload.minutes || 5, topic: a.payload.topic });
      default:
        return t('agent_explain_default');
    }
  };

  const handleApplyPending = () => {
    if (!pendingActions || !onExecuteAgentAction) { setPendingActions(null); return; }
    pendingActions.forEach((act) => {
      // Guardrail: agent may never auto-delete, auto-submit to Canvas, or auto-send email
      onExecuteAgentAction(act);
    });
    setLastApplied(pendingActions);
    setPendingActions(null);
  };

  const handleUndoLast = () => {
    setMessages((prev) => [...prev, { role: 'assistant', contentKey: 'agent_undone' }]);
    setLastApplied(null);
  };

  const renderActionBadge = (action: AgentAction, idx: number) => {
    let icon = Zap;
    let label = t('agent_badge_default');

    switch (action.type) {
      case 'setWorkspaceLayout':
        icon = Columns2;
        label = t('agent_badge_layout', { left: action.payload.leftPane, right: action.payload.rightPane });
        break;
      case 'injectDesmosEquation':
        icon = Calculator;
        label = t('agent_badge_desmos', { count: action.payload.expressions.length });
        break;
      case 'createCalendarMilestones':
        icon = Calendar;
        label = t('agent_badge_milestones', { count: action.payload.events.length });
        break;
      case 'createSRSDeck':
        icon = Brain;
        label = t('agent_badge_srs', { title: action.payload.deckTitle });
        break;
      case 'generateMermaidDiagram':
        icon = Network;
        label = t('agent_badge_diagram', { title: action.payload.title });
        break;
      case 'draftEmailFromAssignment':
        icon = Send;
        label = t('agent_badge_email');
        break;
      case 'scheduleFocusWeek':
        icon = Calendar;
        label = t('agent_badge_focus_week');
        break;
      case 'explainCanvasFeedback':
        icon = GraduationCap;
        label = t('agent_badge_feedback');
        break;
      case 'createStudyFlashcardsPreview':
        icon = Brain;
        label = t('agent_badge_fc_preview', { title: action.payload.topic });
        break;
      case 'draftPresentationOutline':
        icon = Lightbulb;
        label = t('agent_badge_outline', { minutes: action.payload.minutes || 5, topic: action.payload.topic });
        break;
    }

    const IconComponent = icon;

    return (
      <div
        key={idx}
        className="mt-1.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in"
      >
        <IconComponent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{label}</span>
      </div>
    );
  };

  return (
    <>
      {/* Floating Trigger Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-[#D97757] to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-[#D97757]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
        >
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>{t('agent_pill')}</span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm sm:max-w-md h-[520px] bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-[#D97757] text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] flex items-center gap-1.5">
                  <span>{t('agent_header_title')}</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono">
                    {t('agent_actions_on')}
                  </span>
                </h4>
                <p className="text-[10px] text-[#8C897F]">{t('agent_model_sub')}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('agent_minimize')}
                className="p-1.5 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-xl transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Action Pills */}
          <div className="p-2.5 bg-[#FAF9F5]/70 dark:bg-[#1F1E1B]/70 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {QUICK_PILL_KEYS.map((pillKey, i) => {
              const pillText = t(pillKey);
              return (
                <button
                  key={i}
                  onClick={() => handleQuickPill(pillText)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757] hover:text-[#D97757] whitespace-nowrap transition-colors cursor-pointer"
                >
                  {pillText}
                </button>
              );
            })}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[88%] ${
                    m.role === 'user'
                      ? 'bg-[#D97757] text-white rounded-br-none'
                      : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] rounded-bl-none'
                  }`}
                >
                  <MathMarkdown>{m.contentKey ? t(m.contentKey) : (m.content || '')}</MathMarkdown>

                  {/* Dispatched Actions Badges */}
                  {m.executedActions &&
                    m.executedActions.map((action, aIdx) => renderActionBadge(action, aIdx))}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-[#8C897F]">
                <Sparkles className="w-3.5 h-3.5 text-[#D97757] animate-spin" />
                <span>{t('agent_thinking')}</span>
              </div>
            )}
            {/* Confirmation cards: nothing applies until the student taps Apply */}
            {pendingActions && pendingActions.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2" role="group" aria-label={t('agent_confirm_aria')}>
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">{t('agent_confirm_prompt')}</p>
                {pendingActions.map((a, i) => (
                  <p key={i} className="text-[11px] text-amber-900 dark:text-amber-200">• {explainAction(a)}</p>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleApplyPending} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-bold min-h-[44px] cursor-pointer inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t('agent_apply')}</button>
                  <button onClick={() => setPendingActions(null)} className="px-3 py-2 rounded-xl border border-amber-300 text-[11px] font-bold min-h-[44px] cursor-pointer">{t('agent_discard')}</button>
                </div>
              </div>
            )}
            {lastApplied && lastApplied.length > 0 && (
              <button onClick={handleUndoLast} className="text-[11px] font-bold text-[#6B6860] underline underline-offset-4 cursor-pointer self-start min-h-[32px]">{t('agent_undo')}</button>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('agent_input_ph')}
              className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
            />
            <button
              type="submit"
              aria-label={t('agent_send')}
              disabled={!inputText.trim() || isThinking}
              className="p-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
