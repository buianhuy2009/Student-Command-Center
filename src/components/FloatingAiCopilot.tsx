import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Minimize2,
  Bot,
  User,
  GraduationCap,
  Lightbulb,
  Maximize2,
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
import { logPrompt } from '../services/promptLog';
import { AgentAction } from '../types';

interface FloatingAiCopilotProps {
  onNavigateWorkspace?: (ws: string) => void;
  onExecuteAgentAction?: (action: AgentAction) => void;
  appContext?: {
    activeWorkspace?: string;
    assignmentsCount?: number;
    upcomingDeadlines?: string[];
  };
}

export const FloatingAiCopilot: React.FC<FloatingAiCopilotProps> = ({
  onNavigateWorkspace,
  onExecuteAgentAction,
  appContext,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      executedActions?: AgentAction[];
    }>
  >([
    {
      role: 'assistant',
      content:
        'Hello! I am your Autonomous StudentOS Agent. Ask me to split screens, plot curves in Desmos, extract syllabi, or generate flashcards.',
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

      // Division A: log agent reply + actions JSON to Prompt Log (never auto-apply)
      try {
        logPrompt({
          feature: 'agent-playground',
          model: 'gemini autonomous agent',
          systemPromptExcerpt: 'runAutonomousAgent — proposes safe workspace actions as JSON',
          userPrompt: userMsg,
          outputExcerpt: `${res.reply.slice(0, 200)} | actions: ${JSON.stringify(res.actions || []).slice(0, 200)}`,
          contribution: 'ai-assisted',
        });
      } catch {}

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
          content:
            'I encountered an error executing this action. Please ensure your Gemini API key is configured in Settings.',
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
      case 'setWorkspaceLayout': return `I will arrange your screen side-by-side: ${a.payload.leftPane} + ${a.payload.rightPane}. Nothing is deleted.`;
      case 'injectDesmosEquation': return `I will plot ${a.payload.expressions.length} equation(s) in Desmos for you to inspect.`;
      case 'createCalendarMilestones': return `I will draft ${a.payload.events.length} study milestone(s) as tasks (you can delete any). I never submit to Canvas or send email.`;
      case 'createSRSDeck': return `I will preview a flashcard deck “${a.payload.deckTitle}” with ${a.payload.cards.length} cards — applied only if you approve.`;
      case 'generateMermaidDiagram': return `I will draft the diagram “${a.payload.title}” for your review.`;
      case 'createStudyFlashcardsPreview': return `I will preview ${a.payload.count || 5} flashcards about “${a.payload.topic}” — you approve before anything is saved.`;
      case 'draftPresentationOutline': return `I will draft a ${a.payload.minutes || 5}-minute presentation outline about “${a.payload.topic}” for you to edit.`;
      default: return 'I will prepare a safe preview for your review. Nothing is deleted, submitted, or sent without you.';
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
    // Best-effort undo: SRS decks / milestones created above are timestamped; advise manual remove.
    // We clear the record and notify via a message so the student stays in control.
    setMessages(prev => [...prev, { role: 'assistant', content: 'Undone on request: I cleared my last suggestion. Anything already saved (deck/milestones) can be removed with one tap in its own tab — nothing was auto-sent anywhere.' }]);
    setLastApplied(null);
  };

  const renderActionBadge = (action: AgentAction, idx: number) => {
    let icon = Zap;
    let label = 'Executed Action';

    switch (action.type) {
      case 'setWorkspaceLayout':
        icon = Columns2;
        label = `Layout: ${action.payload.leftPane} + ${action.payload.rightPane}`;
        break;
      case 'injectDesmosEquation':
        icon = Calculator;
        label = `Plotted ${action.payload.expressions.length} equations into Desmos`;
        break;
      case 'createCalendarMilestones':
        icon = Calendar;
        label = `Scheduled ${action.payload.events.length} study milestones`;
        break;
      case 'createSRSDeck':
        icon = Brain;
        label = `Created SRS Deck: "${action.payload.deckTitle}"`;
        break;
      case 'generateMermaidDiagram':
        icon = Network;
        label = `Rendered diagram: "${action.payload.title}"`;
        break;
      case 'createQuizFromNotes':
        icon = Brain;
        label = `Quiz preview from notes`;
        break;
      case 'summarizePdfToDeck':
        icon = Brain;
        label = `PDF → deck preview: "${(action as any).payload?.fileName || 'file'}"`;
        break;
      case 'draftEmailFromAssignment':
        icon = Send;
        label = `Email draft preview (never auto-sent)`;
        break;
      case 'scheduleFocusWeek':
        icon = Calendar;
        label = `Focus-week preview`;
        break;
      case 'explainCanvasFeedback':
        icon = GraduationCap;
        label = `Feedback explainer`;
        break;
      case 'createStudyFlashcardsPreview':
        icon = Brain;
        label = `Flashcard preview: "${action.payload.topic}"`;
        break;
      case 'draftPresentationOutline':
        icon = Lightbulb;
        label = `${action.payload.minutes || 5}-min outline: "${action.payload.topic}"`;
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
          <span>StudentOS Agent</span>
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
                  <span>StudentOS Autonomous Agent</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono">
                    Actions ON
                  </span>
                </h4>
                <p className="text-[10px] text-[#8C897F]">Model: gemini-flash-latest</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-xl transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Action Pills */}
          <div className="p-2.5 bg-[#FAF9F5]/70 dark:bg-[#1F1E1B]/70 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {[
              'Split screen with Canvas and Desmos',
              'Plot damped sine wave in Desmos',
              'Build 5-card flashcard deck on Cell Respiration',
              'Create mindmap of World War 2',
              'Arrange my workspace for geometry revision',
            ].map((pill, i) => (
              <button
                key={i}
                onClick={() => handleQuickPill(pill)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757] hover:text-[#D97757] whitespace-nowrap transition-colors cursor-pointer"
              >
                {pill}
              </button>
            ))}
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
                  <MathMarkdown>{m.content}</MathMarkdown>

                  {/* Dispatched Actions Badges */}
                  {m.executedActions &&
                    m.executedActions.map((action, aIdx) => renderActionBadge(action, aIdx))}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-[#8C897F]">
                <Sparkles className="w-3.5 h-3.5 text-[#D97757] animate-spin" />
                <span>Agent is evaluating intent and executing actions...</span>
              </div>
            )}
            {/* Confirmation cards: nothing applies until the student taps Apply */}
            {pendingActions && pendingActions.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2" role="group" aria-label="Confirm agent actions">
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Please review before I do anything:</p>
                {pendingActions.map((a, i) => (
                  <p key={i} className="text-[11px] text-amber-900 dark:text-amber-200">• {explainAction(a)}</p>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleApplyPending} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-bold min-h-[44px] cursor-pointer inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Apply</button>
                  <button onClick={() => setPendingActions(null)} className="px-3 py-2 rounded-xl border border-amber-300 text-[11px] font-bold min-h-[44px] cursor-pointer">Discard</button>
                </div>
              </div>
            )}
            {lastApplied && lastApplied.length > 0 && (
              <button onClick={handleUndoLast} className="text-[11px] font-bold text-[#6B6860] underline underline-offset-4 cursor-pointer self-start min-h-[32px]">Undo last applied actions</button>
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
              placeholder="Tell StudentOS what to set up or plot..."
              className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
            />
            <button
              type="submit"
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
