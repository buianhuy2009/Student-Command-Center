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
  Sun,
  X,
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
} from 'lucide-react';
import { Assignment, AppTab } from '../types';
import { useT } from '../services/i18n';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspace: AppTab) => void;
  onOpenQuickDraft: () => void;
  onOpenNewAssignment: () => void;
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
  onToggleAiChat,
  onToggleDarkMode,
  assignments,
  sheetUrl,
}) => {
  const { t, lang, formatDate } = useT();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [mathCopied, setMathCopied] = useState(false);
  const mathCopyTimer = React.useRef<number | undefined>(undefined);
  const listRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) { setActiveIndex(0); setMathCopied(false); } }, [isOpen, query, lang]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => { if (mathCopyTimer.current !== undefined) window.clearTimeout(mathCopyTimer.current); };
  }, []);

  if (!isOpen) return null;

  // Safe math evaluator — CSP-safe shunting-yard parser, no Function()
  function safeEval(expr: string): number | null {
    try {
      const tokens: string[] = [];
      let i=0;
      while(i<expr.length){
        const c=expr[i];
        if(/\s/.test(c)){i++;continue;}
        if(/[0-9.]/.test(c)){ let n=''; while(i<expr.length && /[0-9.]/.test(expr[i])) n+=expr[i++]; tokens.push(n); continue; }
        if('+-*/()%^'.includes(c)){ tokens.push(c); i++; continue; }
        return null;
      }
      // shunting-yard to RPN
      const prec: Record<string,number> = {'+':1,'-':1,'*':2,'/':2,'%':2,'^':3};
      const output:string[]=[]; const ops:string[]=[];
      for(const t of tokens){
        if(!isNaN(parseFloat(t))) output.push(t);
        else if(t==='(') ops.push(t);
        else if(t===')'){ while(ops.length && ops[ops.length-1]!=='(') output.push(ops.pop()!); ops.pop(); }
        else { while(ops.length && ops[ops.length-1]!=='(' && (prec[ops[ops.length-1]]||0) >= (prec[t]||0)) output.push(ops.pop()!); ops.push(t); }
      }
      while(ops.length) output.push(ops.pop()!);
      const stack:number[]=[];
      for(const t of output){
        if(!isNaN(parseFloat(t))) stack.push(parseFloat(t));
        else {
          const b=stack.pop()!, a=stack.pop()!;
          if(a===undefined||b===undefined) return null;
          if(t==='+') stack.push(a+b);
          else if(t==='-') stack.push(a-b);
          else if(t==='*') stack.push(a*b);
          else if(t==='/') stack.push(b!==0?a/b:NaN);
          else if(t==='%') stack.push(a%b);
          else if(t==='^') stack.push(Math.pow(a,b));
        }
      }
      return stack.length===1 && isFinite(stack[0]) ? stack[0] : null;
    } catch { return null; }
  }
  let mathResult: string | null = null;
  const qTrim = query.trim();
  if (/^[0-9+\-*/().\s^%]+$/.test(qTrim) && /[0-9]/.test(qTrim) && /[+\-*/^%]/.test(qTrim) && qTrim.length < 80) {
    const val = safeEval(qTrim.replace(/\^/g,'^'));
    if (val !== null && !isNaN(val)) mathResult = `${qTrim} = ${val}`;
  }

  // Copy math result to clipboard — degrades silently where clipboard API is unavailable
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
  const isMathActive = !!mathResult && activeIndex === 0;

  const actions = [
    // Workspaces & Kept Apps
    {
      id: 'ws-dashboard',
      title: t('pal_ws_dashboard'),
      category: t('pal_cat_workspaces'),
      icon: CheckSquare,
      run: () => {
        onSelectWorkspace('dashboard');
        onClose();
      },
    },
    {
      id: 'ws-canvas',
      title: t('pal_ws_canvas'),
      category: t('pal_cat_workspaces'),
      icon: Layers,
      run: () => {
        onSelectWorkspace('canvas');
        onClose();
      },
    },
    {
      id: 'ws-radar',
      title: t('pal_ws_radar'),
      category: t('pal_cat_workspaces'),
      icon: Compass,
      run: () => {
        onSelectWorkspace('radar');
        onClose();
      },
    },
    {
      id: 'ws-tracker',
      title: t('pal_ws_tracker'),
      category: t('pal_cat_workspaces'),
      icon: CheckSquare,
      run: () => {
        onSelectWorkspace('tracker');
        onClose();
      },
    },
    {
      id: 'ws-gmail',
      title: t('pal_ws_gmail'),
      category: t('pal_cat_workspaces'),
      icon: Mail,
      run: () => {
        onSelectWorkspace('gmail');
        onClose();
      },
    },
    {
      id: 'ws-classroom',
      title: t('pal_ws_classroom'),
      category: t('pal_cat_workspaces'),
      icon: BookOpen,
      run: () => {
        onSelectWorkspace('classroom');
        onClose();
      },
    },
    {
      id: 'ws-drive',
      title: t('pal_ws_drive'),
      category: t('pal_cat_workspaces'),
      icon: FolderOpen,
      run: () => {
        onSelectWorkspace('drive');
        onClose();
      },
    },
    {
      id: 'ws-notes',
      title: t('pal_ws_notes'),
      category: t('pal_cat_workspaces'),
      icon: FileText,
      run: () => {
        onSelectWorkspace('notes-markdown');
        onClose();
      },
    },
    {
      id: 'ws-flashcards',
      title: t('pal_ws_flashcards'),
      category: t('pal_cat_workspaces'),
      icon: Brain,
      run: () => {
        onSelectWorkspace('flashcards');
        onClose();
      },
    },
    {
      id: 'ws-pomodoro',
      title: t('pal_ws_pomodoro'),
      category: t('pal_cat_workspaces'),
      icon: Timer,
      run: () => {
        onSelectWorkspace('pomodoro');
        onClose();
      },
    },
    {
      id: 'ws-excalidraw',
      title: t('pal_ws_excalidraw'),
      category: t('pal_cat_workspaces'),
      icon: PenTool,
      run: () => {
        onSelectWorkspace('excalidraw');
        onClose();
      },
    },
    {
      id: 'ws-desmos',
      title: t('pal_ws_desmos'),
      category: t('pal_cat_workspaces'),
      icon: Calculator,
      run: () => {
        onSelectWorkspace('desmos-graphing');
        onClose();
      },
    },
    {
      id: 'ws-geogebra',
      title: t('pal_ws_geogebra'),
      category: t('pal_cat_workspaces'),
      icon: Grid2x2,
      run: () => {
        onSelectWorkspace('geogebra');
        onClose();
      },
    },
    {
      id: 'ws-phet',
      title: t('pal_ws_phet'),
      category: t('pal_cat_workspaces'),
      icon: Atom,
      run: () => {
        onSelectWorkspace('phet');
        onClose();
      },
    },
    {
      id: 'ws-arxiv',
      title: t('pal_ws_arxiv'),
      category: t('pal_cat_workspaces'),
      icon: BookOpen,
      run: () => {
        onSelectWorkspace('arxiv');
        onClose();
      },
    },
    {
      id: 'ws-open-library',
      title: t('pal_ws_open_library'),
      category: t('pal_cat_workspaces'),
      icon: BookOpen,
      run: () => {
        onSelectWorkspace('open-library');
        onClose();
      },
    },

    // Quick Actions
    {
      id: 'act-new-assignment',
      title: t('pal_act_new_assignment'),
      category: t('actions'),
      icon: Plus,
      run: () => {
        onSelectWorkspace('tracker');
        onOpenNewAssignment();
        onClose();
      },
    },
    {
      id: 'act-quick-draft',
      title: t('pal_act_quick_draft'),
      category: t('actions'),
      icon: Send,
      run: () => {
        onOpenQuickDraft();
        onClose();
      },
    },
    {
      id: 'act-ai-coach',
      title: t('pal_act_ai_coach'),
      category: t('actions'),
      icon: Sparkles,
      run: () => {
        onToggleAiChat();
        onClose();
      },
    },
    // AI Slash Commands
    {
      id: 'slash-graph',
      title: t('pal_slash_graph'),
      category: t('pal_cat_slash'),
      icon: Calculator,
      run: () => {
        onSelectWorkspace('desmos-graphing');
        onClose();
      },
    },
    {
      id: 'slash-breakdown',
      title: t('pal_slash_breakdown'),
      category: t('pal_cat_slash'),
      icon: Layers,
      run: () => {
        onSelectWorkspace('tracker');
        onClose();
      },
    },
    {
      id: 'slash-focus',
      title: t('pal_slash_focus'),
      category: t('pal_cat_slash'),
      icon: Timer,
      run: () => {
        onSelectWorkspace('pomodoro');
        onClose();
      },
    },
    {
      id: 'slash-quiz',
      title: t('pal_slash_quiz'),
      category: t('pal_cat_slash'),
      icon: Brain,
      run: () => {
        onSelectWorkspace('flashcards');
        onClose();
      },
    },

    // Settings
    {
      id: 'act-theme',
      title: t('pal_act_theme'),
      category: t('settings'),
      icon: Moon,
      run: () => {
        onToggleDarkMode();
        onClose();
      },
    },
  ];

  // --- Action Launcher: t / note / pomo commands ---
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
          try {
            const raw = localStorage.getItem('scc_user_assignments_v2');
            const arr = raw ? JSON.parse(raw) : [];
            const newTask = { id: `assign-${Date.now()}`, assignmentName: title, subject: 'General', dueDate: new Date(Date.now()+86400000*3).toISOString().split('T')[0], priority: 'Med', status: 'Not Started', source: 'Manual' as const };
            localStorage.setItem('scc_user_assignments_v2', JSON.stringify([...arr, newTask]));
          } catch {}
          onSelectWorkspace('dashboard');
          window.dispatchEvent(new CustomEvent('scc-toast', { detail: { title: t('pal_task_created'), message: title }}));
          onClose();
        }
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
            const note = { id: `note-${Date.now()}`, title, subject: 'General', content: `# ${title}\n\n`, updatedAt: formatDate(new Date()) };
            localStorage.setItem('scc_markdown_notes_v1', JSON.stringify([note, ...arr]));
          } catch {}
          onSelectWorkspace('notes-markdown');
          onClose();
        }
      };
    }
    if (q.toLowerCase().startsWith('pomo ')) {
      const minsStr = q.slice(5).trim();
      const mins = parseInt(minsStr,10);
      if (!mins || mins < 1 || mins > 120) return null;
      return {
        id: 'cmd-pomo',
        title: t('pal_cmd_pomo', { mins }),
        category: t('focus'),
        icon: Timer,
        run: () => {
          try { localStorage.setItem('scc_pomo_requested_duration', String(mins)); } catch {}
          onSelectWorkspace('pomodoro');
          onClose();
        }
      };
    }
    return null;
  })();

  // Fuzzy matcher (simple typo tolerance: allow 1-char edit distance via includes + subsequence)
  function fuzzyMatch(hay: string, needle: string): boolean {
    if (!needle) return true;
    const h = hay.toLowerCase(); const n = needle.toLowerCase();
    if (h.includes(n)) return true;
    // subsequence: all chars of needle appear in order in hay (handles calender -> calendar)
    let i=0; for (const c of h){ if(c===n[i]) i++; if(i===n.length) return true; }
    return false;
  }
  const recentIds: string[] = (()=>{ try{ return JSON.parse(localStorage.getItem('scc_recent_palette_v1')||'[]'); }catch{ return []; }})();
  const filteredActions = actions.filter(
    (a) => fuzzyMatch(a.title, query) || fuzzyMatch(a.category, query)
  ).sort((a,b)=>{
    const ar = recentIds.indexOf(a.id); const br = recentIds.indexOf(b.id);
    if (ar!==-1 || br!==-1) return (ar===-1? 999: ar) - (br===-1? 999: br);
    return 0;
  });

  const matchedAssignments = assignments
    .filter(
      (a) => fuzzyMatch(a.assignmentName, query) || fuzzyMatch(a.subject, query)
    )
    .slice(0, 4);

  // focus trap for Tab cycle
  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const root = dialogRef.current;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0], last = els[els.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener('keydown', onKey as any);
    // autofocus input
    const input = root.querySelector<HTMLInputElement>('input');
    input?.focus();
    return () => root.removeEventListener('keydown', onKey as any);
  }, [isOpen]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('pal_dialog_label')}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#DFDACB] dark:border-[#2C2B27]">
          <Search className="w-5 h-5 text-[#8C897F] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            aria-label={t('pal_search_label')}
            aria-activedescendant={filteredActions[activeIndex] ? `palette-item-${filteredActions[activeIndex].id}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={e=>{
              const mathCount = mathResult ? 1 : 0;
              const total = mathCount+(commandAction?1:0)+matchedAssignments.length+filteredActions.length;
              if(e.key==='ArrowDown'){ e.preventDefault(); setActiveIndex(i=> Math.min(i+1, total-1)); }
              else if(e.key==='ArrowUp'){ e.preventDefault(); setActiveIndex(i=> Math.max(i-1, 0)); }
              else if(e.key==='Enter'){
                e.preventDefault();
                // Cmd/Ctrl+Enter copies the math result from anywhere without triggering actions
                if ((e.metaKey || e.ctrlKey) && mathResult) { copyMathResult(); return; }
                const idx=activeIndex;
                let cur=0;
                // Math result row is index 0 when present; Enter copies (it has no other action, so no conflict)
                if (mathResult) {
                  if (idx===0) { copyMathResult(); return; }
                  cur++;
                }
                if(commandAction && idx===cur){ commandAction.run(); return; }
                if(commandAction) cur++;
                if(idx < cur+matchedAssignments.length){ const a=matchedAssignments[idx-cur]; if(a){ onSelectWorkspace('tracker'); onClose(); } return; }
                cur+=matchedAssignments.length;
                const action = filteredActions[idx-cur];
                if(action){ try{ const rec=JSON.parse(localStorage.getItem('scc_recent_palette_v1')||'[]'); const next=[action.id, ...rec.filter((x:string)=>x!==action.id)].slice(0,5); localStorage.setItem('scc_recent_palette_v1', JSON.stringify(next)); }catch{} action.run(); }
                else if(commandAction) commandAction.run();
              }
            }}
            placeholder={t('pal_placeholder')}
            className="w-full text-sm bg-transparent border-none outline-none text-[#141413] dark:text-[#FAF9F5] placeholder:text-[#8C897F]"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#FAF9F5] dark:bg-[#252422] text-[#8C897F] rounded border border-[#DFDACB] dark:border-[#2C2B27]">
            ESC
          </kbd>
        </div>

        {/* Math Calculation Quick Solve */}
        {mathResult && (
          <div className={`p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 ${isMathActive ? 'ring-2 ring-inset ring-amber-400' : ''}`}>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-mono font-bold">{mathResult}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-75">{mathCopied ? `${t('copied')} ✓` : t('pal_calculated')}</span>
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); copyMathResult(); }}
                aria-label={t('pal_copy_label')}
                title={t('pal_copy_title')}
                className="p-1.5 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-800/60 transition-colors"
              >
                {mathCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {commandAction && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[#D97757] uppercase tracking-wider">{t('pal_launcher')}</div>
              <button onClick={commandAction.run} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#D97757] text-white hover:bg-[#C86646] transition-colors text-left">
                <commandAction.icon className="w-4 h-4" />
                <span className="text-xs font-bold">{commandAction.title}</span>
                <span className="ml-auto text-[10px] opacity-80">{t('pal_run')}</span>
              </button>
              <div className="px-2 pt-1 text-[10px] text-[#8C897F]">{t('pal_tip')} <span className="font-mono">t &lt;{t('pal_tip_task')}&gt;</span> • <span className="font-mono">note &lt;{t('pal_tip_title')}&gt;</span> • <span className="font-mono">pomo &lt;{t('pal_tip_mins')}&gt;</span></div>
            </div>
          )}
          {/* Matched Assignments */}
          {matchedAssignments.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[#8C897F] uppercase tracking-wider">
                {t('pal_matching')}
              </div>
              <div className="space-y-1 mt-1">
                {matchedAssignments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onSelectWorkspace('tracker');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#FAF9F5] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckSquare className="w-4 h-4 text-[#D97757] shrink-0" />
                      <span className="text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] truncate">
                        {a.assignmentName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#8C897F]">
                      {a.subject} • {t('tracker_due')} {a.dueDate}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions & Navigation */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-[#8C897F] uppercase tracking-wider">
                {t('pal_workspaces')}
              </div>
              <div className="space-y-1 mt-1">
                {filteredActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.run}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#FAF9F5] dark:hover:bg-[#1F1E1B] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#FAF9F5] dark:bg-[#1F1E1B] text-[#5C5A54] dark:text-[#B5B2A8] flex items-center justify-center group-hover:bg-[#D97757] group-hover:text-white transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] truncate">
                          {action.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8C897F] font-medium shrink-0 ml-2">
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
