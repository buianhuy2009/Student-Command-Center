import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckSquare,
  FileText,
  Layers,
  Sparkles,
  Send,
  Plus,
  Moon,
  ExternalLink,
  Mail,
  Calculator,
  Copy,
  Check,
  PenTool,
  Atom,
  Brain,
  FolderOpen,
  Timer,
  BookOpen,
  Compass,
  Grid2x2,
  ScanText,
  AudioLines,
  X,
} from 'lucide-react';
import { Assignment, AppTab } from '../types';
import { useT } from '../services/i18n';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspace: AppTab) => void;
  onOpenQuickDraft: () => void;
  onOpenNewAssignment: () => void;
  onCreateAssignment?: (assignment: Omit<Assignment, 'id'>) => void;
  onToggleAiChat: () => void;
  onToggleDarkMode: () => void;
  assignments: Assignment[];
  sheetUrl?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectWorkspace,
  onOpenQuickDraft,
  onOpenNewAssignment,
  onCreateAssignment,
  onToggleAiChat,
  onToggleDarkMode,
  assignments,
  sheetUrl: _sheetUrl,
}) => {
  const { t, lang, formatDate } = useT();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [mathCopied, setMathCopied] = useState(false);
  const mathCopyTimer = React.useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      setMathCopied(false);
    }
  }, [isOpen, query, lang]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (mathCopyTimer.current !== undefined) window.clearTimeout(mathCopyTimer.current);
    };
  }, []);

  // Safe math evaluator — CSP-safe shunting-yard parser, no Function()
  function safeEval(expr: string): number | null {
    try {
      const tokens: string[] = [];
      let i = 0;
      while (i < expr.length) {
        const c = expr[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) {
          let n = '';
          while (i < expr.length && /[0-9.]/.test(expr[i])) n += expr[i++];
          tokens.push(n);
          continue;
        }
        if ('+-*/()%^'.includes(c)) { tokens.push(c); i++; continue; }
        return null;
      }
      const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
      const output: string[] = [];
      const ops: string[] = [];
      for (const tok of tokens) {
        if (!isNaN(parseFloat(tok))) output.push(tok);
        else if (tok === '(') ops.push(tok);
        else if (tok === ')') {
          while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop()!);
          ops.pop();
        } else {
          while (ops.length && ops[ops.length - 1] !== '(' && (prec[ops[ops.length - 1]] || 0) >= (prec[tok] || 0)) {
            output.push(ops.pop()!);
          }
          ops.push(tok);
        }
      }
      while (ops.length) output.push(ops.pop()!);
      const stack: number[] = [];
      for (const tok of output) {
        if (!isNaN(parseFloat(tok))) stack.push(parseFloat(tok));
        else {
          const b = stack.pop()!;
          const a = stack.pop()!;
          if (a === undefined || b === undefined) return null;
          if (tok === '+') stack.push(a + b);
          else if (tok === '-') stack.push(a - b);
          else if (tok === '*') stack.push(a * b);
          else if (tok === '/') stack.push(b !== 0 ? a / b : NaN);
          else if (tok === '%') stack.push(a % b);
          else if (tok === '^') stack.push(Math.pow(a, b));
        }
      }
      return stack.length === 1 && isFinite(stack[0]) ? stack[0] : null;
    } catch {
      return null;
    }
  }

  let mathResult: string | null = null;
  const qTrim = query.trim();
  if (/^[0-9+\-*/().\s^%]+$/.test(qTrim) && /[0-9]/.test(qTrim) && /[+\-*/^%]/.test(qTrim) && qTrim.length < 80) {
    const val = safeEval(qTrim);
    if (val !== null && !isNaN(val)) mathResult = `${qTrim} = ${val}`;
  }

  const copyMathResult = async () => {
    if (!mathResult) return;
    try {
      const text = mathResult;
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      }
    } catch {}
    setMathCopied(true);
    if (mathCopyTimer.current !== undefined) window.clearTimeout(mathCopyTimer.current);
    mathCopyTimer.current = window.setTimeout(() => setMathCopied(false), 1500);
  };

  const actions = [
    {
      id: 'ws-dashboard',
      title: t('pal_ws_dashboard'),
      category: t('pal_cat_workspaces'),
      icon: CheckSquare,
      run: () => { onSelectWorkspace('dashboard'); onClose(); },
    },
    {
      id: 'ws-canvas',
      title: t('pal_ws_canvas'),
      category: t('pal_cat_workspaces'),
      icon: Layers,
      run: () => { onSelectWorkspace('canvas'); onClose(); },
    },
    {
      id: 'ws-radar',
      title: t('pal_ws_radar'),
      category: t('pal_cat_workspaces'),
      icon: Compass,
      run: () => { onSelectWorkspace('radar'); onClose(); },
    },
    {
      id: 'ws-tracker',
      title: t('pal_ws_tracker'),
      category: t('pal_cat_workspaces'),
      icon: CheckSquare,
      run: () => { onSelectWorkspace('tracker'); onClose(); },
    },
    {
      id: 'ws-gmail',
      title: t('pal_ws_gmail'),
      category: t('pal_cat_workspaces'),
      icon: Mail,
      run: () => { onSelectWorkspace('gmail'); onClose(); },
    },
    {
      id: 'ws-classroom',
      title: t('pal_ws_classroom'),
      category: t('pal_cat_workspaces'),
      icon: BookOpen,
      run: () => { onSelectWorkspace('classroom'); onClose(); },
    },
    {
      id: 'ws-drive',
      title: t('pal_ws_drive'),
      category: t('pal_cat_workspaces'),
      icon: FolderOpen,
      run: () => { onSelectWorkspace('drive'); onClose(); },
    },
    {
      id: 'ws-notes',
      title: t('pal_ws_notes'),
      category: t('pal_cat_workspaces'),
      icon: FileText,
      run: () => { onSelectWorkspace('notes-markdown'); onClose(); },
    },
    {
      id: 'ws-note-scanner',
      title: t('pal_ws_note_scanner'),
      category: t('pal_cat_workspaces'),
      icon: ScanText,
      run: () => { onSelectWorkspace('note-scanner'); onClose(); },
    },
    {
      id: 'ws-lecture-studio',
      title: t('pal_ws_lecture_studio'),
      category: t('pal_cat_workspaces'),
      icon: AudioLines,
      run: () => { onSelectWorkspace('lecture-studio'); onClose(); },
    },
    {
      id: 'ws-flashcards',
      title: t('pal_ws_flashcards'),
      category: t('pal_cat_workspaces'),
      icon: Brain,
      run: () => { onSelectWorkspace('flashcards'); onClose(); },
    },
    {
      id: 'ws-pomodoro',
      title: t('pal_ws_pomodoro'),
      category: t('pal_cat_workspaces'),
      icon: Timer,
      run: () => { onSelectWorkspace('pomodoro'); onClose(); },
    },
    {
      id: 'ws-desmos',
      title: t('pal_ws_desmos'),
      category: t('pal_cat_workspaces'),
      icon: Calculator,
      run: () => { onSelectWorkspace('desmos-graphing'); onClose(); },
    },
    {
      id: 'ws-geogebra',
      title: t('pal_ws_geogebra'),
      category: t('pal_cat_workspaces'),
      icon: Grid2x2,
      run: () => { onSelectWorkspace('geogebra'); onClose(); },
    },
    {
      id: 'ws-phet',
      title: t('pal_ws_phet'),
      category: t('pal_cat_workspaces'),
      icon: Atom,
      run: () => { onSelectWorkspace('phet'); onClose(); },
    },
    {
      id: 'ws-arxiv',
      title: t('pal_ws_arxiv'),
      category: t('pal_cat_workspaces'),
      icon: BookOpen,
      run: () => { onSelectWorkspace('arxiv'); onClose(); },
    },
    {
      id: 'ws-open-library',
      title: t('pal_ws_open_library'),
      category: t('pal_cat_workspaces'),
      icon: ExternalLink,
      run: () => { onSelectWorkspace('open-library'); onClose(); },
    },
    {
      id: 'act-new-assignment',
      title: t('pal_act_new_assignment'),
      category: t('actions'),
      icon: Plus,
      run: () => { onSelectWorkspace('tracker'); onOpenNewAssignment(); onClose(); },
    },
    {
      id: 'act-quick-draft',
      title: t('pal_act_quick_draft'),
      category: t('actions'),
      icon: Send,
      run: () => { onOpenQuickDraft(); onClose(); },
    },
    {
      id: 'act-ai-coach',
      title: t('pal_act_ai_coach'),
      category: t('actions'),
      icon: Sparkles,
      run: () => { onToggleAiChat(); onClose(); },
    },
    {
      id: 'slash-graph',
      title: t('pal_slash_graph'),
      category: t('pal_cat_slash'),
      icon: Calculator,
      run: () => { onSelectWorkspace('desmos-graphing'); onClose(); },
    },
    {
      id: 'slash-breakdown',
      title: t('pal_slash_breakdown'),
      category: t('pal_cat_slash'),
      icon: Layers,
      run: () => { onSelectWorkspace('tracker'); onClose(); },
    },
    {
      id: 'slash-focus',
      title: t('pal_slash_focus'),
      category: t('pal_cat_slash'),
      icon: Timer,
      run: () => { onSelectWorkspace('pomodoro'); onClose(); },
    },
    {
      id: 'slash-quiz',
      title: t('pal_slash_quiz'),
      category: t('pal_cat_slash'),
      icon: Brain,
      run: () => { onSelectWorkspace('flashcards'); onClose(); },
    },
    {
      id: 'act-theme',
      title: t('pal_act_theme'),
      category: t('settings'),
      icon: Moon,
      run: () => { onToggleDarkMode(); onClose(); },
    },
  ];

  const commandAction = (() => {
    const q = query.trim();
    if (q.toLowerCase().startsWith('t ')) {
      const title = q.slice(2).trim();
      if (!title) return null;
      return {
        id: 'cmd-create-task',
        title: t('pal_cmd_create_task', { title }),
        category: t('create'),
        icon: Plus,
        run: () => {
          const newTaskData: Omit<Assignment, 'id'> = {
            assignmentName: title,
            subject: 'General',
            dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            priority: 'Med',
            status: 'Not Started',
            source: 'Manual',
          };
          if (onCreateAssignment) {
            onCreateAssignment(newTaskData);
          } else {
            try {
              const raw = localStorage.getItem('scc_user_assignments_v2');
              const arr = raw ? JSON.parse(raw) : [];
              const newTask = { id: `assign-${Date.now()}`, ...newTaskData };
              localStorage.setItem('scc_user_assignments_v2', JSON.stringify([...arr, newTask]));
            } catch {}
          }
          onSelectWorkspace('dashboard');
          window.dispatchEvent(new CustomEvent('scc-toast', { detail: { type: 'success', title: t('pal_task_created'), message: title } }));
          onClose();
        },
      };
    }
    if (q.toLowerCase().startsWith('note ')) {
      const title = q.slice(5).trim();
      if (!title) return null;
      return {
        id: 'cmd-create-note',
        title: t('pal_cmd_create_note', { title }),
        category: t('create'),
        icon: FileText,
        run: () => {
          try {
            const raw = localStorage.getItem('scc_markdown_notes_v1');
            const arr = raw ? JSON.parse(raw) : [];
            const note = {
              id: `note-${Date.now()}`,
              title,
              subject: 'General',
              content: `# ${title}\n\n`,
              updatedAt: formatDate(new Date()),
            };
            localStorage.setItem('scc_markdown_notes_v1', JSON.stringify([note, ...arr]));
          } catch {}
          onSelectWorkspace('notes-markdown');
          onClose();
        },
      };
    }
    if (q.toLowerCase().startsWith('pomo ')) {
      const minsStr = q.slice(5).trim();
      const mins = parseInt(minsStr, 10);
      if (!mins || mins < 1 || mins > 120) return null;
      return {
        id: 'cmd-pomo',
        title: t('pal_cmd_pomo', { mins }),
        category: t('focus'),
        icon: Timer,
        run: () => {
          try {
            localStorage.setItem('scc_pomo_requested_duration', String(mins));
            window.dispatchEvent(new CustomEvent('scc-pomo-start', { detail: { minutes: mins, autoStart: false } }));
          } catch {}
          onSelectWorkspace('pomodoro');
          onClose();
        },
      };
    }
    return null;
  })();

  function fuzzyMatch(hay: string, needle: string): boolean {
    if (!needle) return true;
    const h = hay.toLowerCase();
    const n = needle.toLowerCase();
    if (h.includes(n)) return true;
    let i = 0;
    for (const c of h) {
      if (c === n[i]) i++;
      if (i === n.length) return true;
    }
    return false;
  }

  const recentIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('scc_recent_palette_v1') || '[]'); } catch { return []; }
  })();

  const filteredActions = actions
    .filter((a) => fuzzyMatch(a.title, query) || fuzzyMatch(a.category, query))
    .sort((a, b) => {
      const ar = recentIds.indexOf(a.id);
      const br = recentIds.indexOf(b.id);
      if (ar !== -1 || br !== -1) return (ar === -1 ? 999 : ar) - (br === -1 ? 999 : br);
      return 0;
    });

  const matchedAssignments = assignments
    .filter((a) => fuzzyMatch(a.assignmentName, query) || fuzzyMatch(a.subject, query))
    .slice(0, 4);

  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const root = dialogRef.current;
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled'));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey as any);
    const input = root.querySelector<HTMLInputElement>('input');
    input?.focus();
    return () => root.removeEventListener('keydown', onKey as any);
  }, [isOpen]);

  if (!isOpen) return null;

  const mathOffset = mathResult ? 1 : 0;
  const cmdOffset = mathOffset + (commandAction ? 1 : 0);
  const assignOffset = cmdOffset + matchedAssignments.length;
  const isMathActive = Boolean(mathResult) && activeIndex === 0;
  const activeActionIndex = activeIndex - assignOffset;
  const activeDescendantId =
    activeActionIndex >= 0 && filteredActions[activeActionIndex]
      ? `palette-item-${filteredActions[activeActionIndex].id}`
      : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('pal_dialog_label')}
      className="fixed inset-x-0 top-0 h-[var(--app-viewport-height,100dvh)] z-50 flex items-start justify-center px-3 pb-3 pt-[min(4rem,8dvh)] sm:px-4 bg-black/55 backdrop-blur-xs"
      id="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-full flex-col bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden"
      >
        {/* Search Input Bar */}
        <div className="flex shrink-0 items-center gap-2 px-3 py-1 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
          <Search className="size-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            autoFocus
            aria-label={t('pal_search_label')}
            aria-activedescendant={activeDescendantId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const total = mathOffset + (commandAction ? 1 : 0) + matchedAssignments.length + filteredActions.length;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if ((e.metaKey || e.ctrlKey) && mathResult) {
                  copyMathResult();
                  return;
                }
                const idx = activeIndex;
                let cur = 0;
                if (mathResult) {
                  if (idx === 0) {
                    copyMathResult();
                    return;
                  }
                  cur++;
                }
                if (commandAction && idx === cur) {
                  commandAction.run();
                  return;
                }
                if (commandAction) cur++;
                if (idx < cur + matchedAssignments.length) {
                  const a = matchedAssignments[idx - cur];
                  if (a) {
                    onSelectWorkspace('tracker');
                    onClose();
                  }
                  return;
                }
                cur += matchedAssignments.length;
                const action = filteredActions[idx - cur];
                if (action) {
                  try {
                    const rec = JSON.parse(localStorage.getItem('scc_recent_palette_v1') || '[]');
                    const next = [action.id, ...rec.filter((x: string) => x !== action.id)].slice(0, 5);
                    localStorage.setItem('scc_recent_palette_v1', JSON.stringify(next));
                  } catch {}
                  action.run();
                } else if (commandAction) {
                  commandAction.run();
                }
              }
            }}
            placeholder={t('pal_placeholder')}
            className="w-full text-sm bg-transparent border-none outline-none shadow-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:shadow-none"
          />
          <kbd className="hidden sm:block pointer-coarse:hidden px-2 py-0.5 text-[10px] font-mono font-semibold bg-[var(--bg-subtle)] text-[var(--text-muted)] rounded border border-[var(--border-default)] shrink-0">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common_close')}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Math Calculation Quick Solve */}
        {mathResult && (
          <div
            className={`px-4 py-2.5 bg-[var(--status-warn-bg)] border-b border-[var(--status-warn-border)] flex items-center justify-between text-xs text-[var(--status-warn-text)] ${
              isMathActive ? 'ring-2 ring-inset ring-[var(--accent-fill)]' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Calculator className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="font-mono font-bold truncate">{mathResult}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium">{mathCopied ? `${t('copied')} ✓` : t('pal_calculated')}</span>
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  copyMathResult();
                }}
                aria-label={t('pal_copy_label')}
                title={t('pal_copy_title')}
                className="p-1.5 rounded-lg border border-[var(--status-warn-border)] bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              >
                {mathCopied ? <Check className="w-3.5 h-3.5 text-[var(--status-ok-text)]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="min-h-0 max-h-96 overflow-y-auto overscroll-contain p-2 space-y-3">
          {commandAction && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--accent-text)] uppercase tracking-wider">
                {t('pal_launcher')}
              </div>
              <button
                type="button"
                onClick={commandAction.run}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-hover)] transition-colors text-left cursor-pointer"
              >
                <commandAction.icon className="w-4 h-4" />
                <span className="text-xs font-bold">{commandAction.title}</span>
                <span className="ml-auto text-[10px] opacity-90">{t('pal_run')}</span>
              </button>
              <div className="px-2 pt-1 text-[10px] text-[var(--text-muted)]">
                {t('pal_tip')} <span className="font-mono">t &lt;{t('pal_tip_task')}&gt;</span> •{' '}
                <span className="font-mono">note &lt;{t('pal_tip_title')}&gt;</span> •{' '}
                <span className="font-mono">pomo &lt;{t('pal_tip_mins')}&gt;</span>
              </div>
            </div>
          )}

          {matchedAssignments.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('pal_matching')}
              </div>
              <div className="space-y-1 mt-1">
                {matchedAssignments.map((a, idx) => {
                  const isRowActive = activeIndex === cmdOffset + idx;
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => {
                        onSelectWorkspace('tracker');
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left border transition-colors cursor-pointer group ${
                        isRowActive
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                          : 'border-transparent hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckSquare className="w-4 h-4 text-[var(--accent-text)] shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-semibold truncate">{a.assignmentName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 ml-2">
                        {a.subject} • {t('tracker_due')} {a.dueDate}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredActions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('pal_workspaces')}
              </div>
              <div className="space-y-1 mt-1">
                {filteredActions.map((action, idx) => {
                  const Icon = action.icon;
                  const isRowActive = activeIndex === assignOffset + idx;
                  return (
                    <button
                      type="button"
                      id={`palette-item-${action.id}`}
                      key={action.id}
                      onClick={action.run}
                      onMouseEnter={() => setActiveIndex(assignOffset + idx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left border transition-colors group cursor-pointer ${
                        isRowActive
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                          : 'border-transparent hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            isRowActive
                              ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)] text-white'
                              : 'bg-[var(--bg-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <span className="text-xs font-semibold truncate">{action.title}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-medium shrink-0 ml-2">
                        {action.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
