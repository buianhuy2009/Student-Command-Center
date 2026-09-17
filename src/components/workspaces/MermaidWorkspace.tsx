import React, { useState, useEffect, useRef } from 'react';
import { Network, Sparkles, Copy, Check, Download, RefreshCw } from 'lucide-react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { generateMermaidDiagram, getClientGeminiApiKey, getClientGroqApiKey } from '../../services/gemini';
import { t, useLang } from '../../services/i18n';

const VALID_FIRST_LINE =
  /^(graph|flowchart|mindmap|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|timeline|quadrantChart|requirementDiagram|sankey-beta)\b/i;

function stripCodeFences(code: string): string {
  return code
    .trim()
    .replace(/^```(?:mermaid)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function dropBareVertLines(code: string): string {
  // A bare `vert` line is a task TAG, not a mermaid statement — it blanks the whole diagram.
  return code
    .split(/\r?\n/)
    .filter((line) => line.trim().toLowerCase() !== 'vert')
    .join('\n');
}

function cleanMindmapLabel(raw: string): string {
  const cleaned = raw
    .replace(/[#(){}\[\]"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Idea';
}

// Local fallback: converts indented / plain-text input into a valid `mindmap` block.
// No network, no API key — always produces renderable mermaid.
function buildLocalMindmap(topic: string): string {
  const rawLines = topic
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, '  ').replace(/\s+$/g, ''))
    .filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    return 'mindmap\n  root((New Mindmap))\n    Overview\n    Key points\n    Examples';
  }
  // Single-line prompt: split on list separators when present, else use generic branches.
  if (rawLines.length === 1) {
    const single = rawLines[0].trim();
    const parts = single
      .split(/[,;|]|\s+-\s+|\s*>\s*/)
      .map((p) => cleanMindmapLabel(p))
      .filter(Boolean);
    const root = cleanMindmapLabel(single.slice(0, 60));
    if (parts.length >= 2 && parts.length <= 8) {
      return ['mindmap', `  root((${root}))`, ...parts.map((p) => `    ${p}`)].join('\n');
    }
    return [
      'mindmap',
      `  root((${root}))`,
      '    Definition',
      `      ${cleanMindmapLabel(single.slice(0, 50))}`,
      '    Key points',
      '      Point 1',
      '      Point 2',
      '    Examples',
    ].join('\n');
  }
  const root = cleanMindmapLabel(rawLines[0]);
  const out: string[] = ['mindmap', `  root((${root}))`];
  for (const line of rawLines.slice(1)) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const level = Math.min(3, Math.floor(indent / 2) + 1);
    out.push(`${'  '.repeat(level + 1)}${cleanMindmapLabel(line)}`);
  }
  return dropBareVertLines(out.join('\n'));
}

function ensureValidMermaid(code: string, fallbackTopic: string): string {
  const cleaned = dropBareVertLines(stripCodeFences(code)).trim();
  if (!cleaned) return buildLocalMindmap(fallbackTopic);
  const firstLine = cleaned.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? '';
  if (!VALID_FIRST_LINE.test(firstLine)) {
    // AI returned prose or an unknown block — fall back to a guaranteed-valid mindmap.
    return buildLocalMindmap(fallbackTopic);
  }
  if (/^mindmap/i.test(firstLine) && !/^\s*root\s*\(/im.test(cleaned)) {
    const root = cleanMindmapLabel(fallbackTopic.split(/\r?\n/)[0]?.slice(0, 60) || 'Topic');
    return cleaned.replace(/^mindmap[^\n]*\n/i, `mindmap\n  root((${root}))\n`);
  }
  return cleaned;
}

const DEFAULT_CHART = `graph TD
  A[Start Problem] --> B{Formulate Hypothesis}
  B -->|Valid| C[Run Experiment]
  B -->|Invalid| D[Revise Theory]
  C --> E[Analyze Data]
  E --> F[Conclusion]`;

export const MermaidWorkspace: React.FC = () => {
  useLang();
  const [chartCode, setChartCode] = useState(DEFAULT_CHART);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const renderContainerRef = useRef<HTMLDivElement>(null);
  const renderSeqRef = useRef(0);

  // mermaid v11: initialize once, render via `mermaid.render(id, code) -> { svg }`.
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void renderDiagram(chartCode);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartCode]);

  const renderDiagram = async (code: string) => {
    const seq = ++renderSeqRef.current;
    setRenderError(null);
    const container = renderContainerRef.current;
    if (!container) return;
    if (!code.trim()) {
      container.innerHTML = '';
      return;
    }
    try {
      const id = `mermaid-svg-${Date.now()}-${seq}`;
      // Await the v11 render promise; a unique id avoids collisions across rapid edits.
      const { svg } = await mermaid.render(id, code);
      if (seq !== renderSeqRef.current) return; // stale render — a newer keystroke won
      const el = renderContainerRef.current;
      if (el) {
        // KEEP: sanitize-then-render (order 002) — never innerHTML raw SVG.
        el.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true },
        });
      }
    } catch (err: any) {
      if (seq !== renderSeqRef.current) return;
      const detail = err?.message ? String(err.message) : String(err);
      // Surface the real render error as text so users can fix their syntax.
      setRenderError(`${t('merm_syntax_error')}: ${detail}`);
    }
  };

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setAiError(null);
    const promptText = aiPrompt.trim();
    const hasKey = Boolean(
      getClientGeminiApiKey()?.trim() || getClientGroqApiKey()?.trim()
    );
    try {
      if (hasKey) {
        try {
          const res = await generateMermaidDiagram(promptText);
          if (res?.code?.trim()) {
            setChartCode(ensureValidMermaid(res.code, promptText));
            return;
          }
        } catch (err) {
          console.error('Error generating diagram:', err);
        }
      }
      // No key (or AI failed/empty) — local template always yields a valid mindmap.
      setChartCode(buildLocalMindmap(promptText));
    } catch (err: any) {
      console.error('Error generating diagram:', err);
      setAiError(err?.message ? String(err.message) : 'AI generation failed — used local mindmap instead.');
      setChartCode(buildLocalMindmap(promptText));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(chartCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shadow-md shadow-pink-600/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#141413] dark:text-[#FAF9F5]">
                {t('merm_title')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-300 dark:border-pink-800">
                {t('merm_badge')}
              </span>
            </div>
            <p className="text-xs text-[#8C897F] mt-0.5">
              {t('merm_sub')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-2xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? `${t('copied')}!` : t('merm_copy_code')}</span>
          </button>
        </div>
      </div>

      {/* AI Generator Input */}
      <form onSubmit={handleGenerateAI} className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-4 shadow-xs flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('merm_prompt_ph')}
            className="flex-1 px-4 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
          />
          <button
            type="submit"
            disabled={isGenerating}
            className="px-5 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? t('merm_generating') : t('merm_generate')}</span>
          </button>
        </div>
        {aiError ? (
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl text-xs">
            {aiError}
          </div>
        ) : null}
      </form>

      {/* Side-by-Side Split Editor / Preview */}
      <div className="flex flex-col md:flex-row gap-6 min-h-[520px]">
        {/* Editor - 50% */}
        <div className="flex-1 md:w-1/2 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8C897F]">
            {t('merm_editor')}
          </span>
          <textarea
            rows={16}
            value={chartCode}
            onChange={(e) => setChartCode(e.target.value)}
            className="flex-1 w-full p-3.5 text-xs font-mono bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5] resize-none"
          />
        </div>

        {/* Live Diagram Render - 50% */}
        <div className="flex-1 md:w-1/2 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col overflow-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8C897F] block mb-4">
            {t('merm_preview')}
          </span>
          {renderError ? (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs whitespace-pre-wrap break-words">
              {renderError}
            </div>
          ) : null}
          <div ref={renderContainerRef} className="flex-1 flex justify-center items-center py-6 overflow-auto bg-[#FAF9F5]/50 dark:bg-[#1F1E1B]/50 rounded-xl border border-[#DFDACB]/40 dark:border-[#2C2B27]/40 min-h-[240px]" />
        </div>
      </div>
    </div>
  );
};
