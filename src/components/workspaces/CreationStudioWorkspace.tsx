import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  PenTool,
  Share2,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  X,
  Network,
  Download,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { IframeErrorBoundary } from '../IframeErrorBoundary';
import { CanvaStudioTab } from '../CanvaStudioTab';
import { generateMermaidDiagram } from '../../services/gemini';
import { MermaidDiagramResult } from '../../types';

type CreationTab = 'excalidraw' | 'mermaid' | 'canva' | 'board';

interface SharedBoard {
  id: string;
  title: string;
  url: string;
  platform: 'Padlet' | 'FigJam' | 'Miro' | 'Custom';
  createdAt: string;
}

const LOCAL_BOARDS_KEY = 'scc_shared_boards_v1';

function loadSavedBoards(): SharedBoard[] {
  try {
    const saved = localStorage.getItem(LOCAL_BOARDS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading shared boards:', e);
  }
  return [];
}

function saveBoards(boards: SharedBoard[]) {
  try {
    localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
  } catch (e) {
    console.error('Error saving shared boards:', e);
  }
}

export const CreationStudioWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CreationTab>('excalidraw');
  const [boards, setBoards] = useState<SharedBoard[]>(loadSavedBoards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => {
    const saved = loadSavedBoards();
    return saved.length > 0 ? saved[0].id : null;
  });

  // --- Mermaid State ---
  const [mermaidTopic, setMermaidTopic] = useState('');
  const [diagramType, setDiagramType] = useState<'mindmap' | 'flowchart' | 'sequence'>('mindmap');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [diagramResult, setDiagramResult] = useState<MermaidDiagramResult | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isAddBoardOpen, setIsAddBoardOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardUrl, setNewBoardUrl] = useState('');
  const [newBoardPlatform, setNewBoardPlatform] = useState<SharedBoard['platform']>('Padlet');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
    });
  }, []);

  // Render Mermaid code to SVG whenever diagramResult changes
  useEffect(() => {
    if (!diagramResult?.code) {
      setSvgContent('');
      return;
    }

    const renderDiagram = async () => {
      try {
        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagramResult.code);
        // KEEP: sanitize-then-render (order 002 SVG profile) — never innerHTML raw SVG.
        setSvgContent(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }));
      } catch (err) {
        console.error('Mermaid render error:', err);
        setSvgContent(`<div class="p-4 text-xs text-rose-500 font-mono">Syntax parsing error. Click Copy Code to inspect.</div>`);
      }
    };

    renderDiagram();
  }, [diagramResult]);

  const handleGenerateMindmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mermaidTopic.trim()) return;

    setIsGeneratingDiagram(true);
    try {
      const res = await generateMermaidDiagram(mermaidTopic.trim(), diagramType);
      setDiagramResult(res);
    } catch (err) {
      console.error('Failed to generate diagram:', err);
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const handleCopyMermaidCode = () => {
    if (!diagramResult?.code) return;
    navigator.clipboard.writeText(diagramResult.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleExportSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(diagramResult?.title || 'diagram').replace(/\s+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim() || !newBoardUrl.trim()) return;

    const newBoard: SharedBoard = {
      id: `board-${Date.now()}`,
      title: newBoardTitle.trim(),
      url: newBoardUrl.trim(),
      platform: newBoardPlatform,
      createdAt: new Date().toLocaleDateString(),
    };

    const updated = [newBoard, ...boards];
    setBoards(updated);
    saveBoards(updated);
    setActiveBoardId(newBoard.id);

    setNewBoardTitle('');
    setNewBoardUrl('');
    setIsAddBoardOpen(false);
  };

  const handleDeleteBoard = (id: string) => {
    const updated = boards.filter((b) => b.id !== id);
    setBoards(updated);
    saveBoards(updated);
    if (activeBoardId === id) {
      setActiveBoardId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header & Sub-Tab Bar */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-4 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] tracking-tight">
              Creation &amp; Collaboration Studio
            </h2>
            <p className="text-xs text-[#8C897F] mt-0.5">
              Excalidraw whiteboard, Mermaid.js mindmaps, Canva design bridge, and group boards
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-xl border border-[#DFDACB] dark:border-[#2C2B27]">
          {[
            { id: 'excalidraw', label: 'Excalidraw Whiteboard', icon: PenTool },
            { id: 'mermaid', label: 'AI Mindmap & Diagrams', icon: Network },
            { id: 'canva', label: 'Canva Design Studio', icon: Palette },
            { id: 'board', label: 'Padlet / FigJam Boards', icon: Share2 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as CreationTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D97757] text-white shadow-xs'
                    : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Excalidraw Whiteboard Canvas */}
      {activeTab === 'excalidraw' && (
        <IframeErrorBoundary
          title="Excalidraw Infinite Whiteboard"
          src="https://excalidraw.com"
          className="h-[calc(85vh-160px)] min-h-[550px]"
        />
      )}

      {/* 2. AI Mindmap & Diagram Studio (Mermaid.js) */}
      {activeTab === 'mermaid' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-5 border border-[#DFDACB] dark:border-[#2C2B27] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D97757]" />
              <span className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
                AI Prompt-to-Mindmap &amp; Architecture (Gemini 2.5 Flash + Mermaid.js)
              </span>
            </div>

            <form onSubmit={handleGenerateMindmap} className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={mermaidTopic}
                onChange={(e) => setMermaidTopic(e.target.value)}
                placeholder="Type a topic or concept (e.g. 'Cellular Respiration stages', 'TCP/IP Model', 'World War 1 Alliances')..."
                className="flex-1 w-full px-3.5 py-2.5 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />

              <select
                value={diagramType}
                onChange={(e) => setDiagramType(e.target.value as any)}
                className="px-3 py-2.5 text-xs font-bold bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-[#141413] dark:text-[#FAF9F5] cursor-pointer"
              >
                <option value="mindmap">Mindmap</option>
                <option value="flowchart">Process Flowchart</option>
                <option value="sequence">Sequence / Interaction</option>
              </select>

              <button
                type="submit"
                disabled={isGeneratingDiagram || !mermaidTopic.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingDiagram ? 'animate-spin' : ''}`} />
                <span>{isGeneratingDiagram ? 'Synthesizing...' : 'Generate Mindmap'}</span>
              </button>
            </form>
          </div>

          {/* Rendered Diagram Viewer */}
          {diagramResult && (
            <div className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
                    {diagramResult.title}
                  </h3>
                  {diagramResult.description && (
                    <p className="text-[11px] text-[#8C897F]">{diagramResult.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMermaidCode}
                    className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleExportSvg}
                    className="px-3 py-1.5 text-xs font-bold bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export SVG</span>
                  </button>
                </div>
              </div>

              {/* Rendered SVG Preview */}
              <div
                ref={mermaidContainerRef}
                className="p-8 flex items-center justify-center min-h-[450px] overflow-auto bg-slate-50/50 dark:bg-[#141413]/50"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. Canva Creative Studio */}
      {activeTab === 'canva' && <CanvaStudioTab />}

      {/* 4. Padlet / FigJam Group Project Boards */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-4 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto flex-1">
              <span className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] uppercase tracking-wider mr-2">
                Boards:
              </span>
              {boards.length === 0 ? (
                <span className="text-xs text-[#8C897F]">No shared boards linked yet.</span>
              ) : (
                boards.map((b) => (
                  <div
                    key={b.id}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      activeBoardId === b.id
                        ? 'bg-[#D97757] text-white border-[#D97757]'
                        : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] text-[#5C5A54] dark:text-[#B5B2A8] border-[#DFDACB] dark:border-[#2C2B27]'
                    }`}
                    onClick={() => setActiveBoardId(b.id)}
                  >
                    <span>{b.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBoard(b.id);
                      }}
                      className="p-0.5 hover:text-rose-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsAddBoardOpen(true)}
              className="px-3.5 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Board</span>
            </button>
          </div>

          {activeBoard ? (
            <IframeErrorBoundary
              title={`${activeBoard.platform}: ${activeBoard.title}`}
              src={activeBoard.url}
              className="h-[calc(85vh-220px)] min-h-[500px]"
            />
          ) : (
            <div className="py-20 px-4 text-center bg-white dark:bg-[#1A1917] rounded-2xl border border-dashed border-[#DFDACB] dark:border-[#2C2B27]">
              <Share2 className="w-10 h-10 mx-auto text-[#D97757] mb-2 opacity-80" />
              <h4 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                Link a Padlet, FigJam, or Miro Board
              </h4>
              <p className="text-xs text-[#8C897F] mt-1 max-w-sm mx-auto">
                Paste your class or group project board link to collaborate inside your workspace without context-switching tabs.
              </p>
              <button
                onClick={() => setIsAddBoardOpen(true)}
                className="mt-3.5 px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Link Project Board
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Board Modal */}
      {isAddBoardOpen && (
        <div className="fixed inset-0 bg-[#141413]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1917] rounded-2xl w-full max-w-md p-6 border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFDACB] dark:border-[#2C2B27]">
              <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5] flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#D97757]" />
                <span>Link Group Project Board</span>
              </h3>
              <button
                onClick={() => setIsAddBoardOpen(false)}
                className="p-1 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBoard} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Board Title *
                </label>
                <input
                  type="text"
                  required
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  placeholder="e.g. AP English Hamlet Group Analysis"
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Platform
                </label>
                <select
                  value={newBoardPlatform}
                  onChange={(e) => setNewBoardPlatform(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                >
                  <option value="Padlet">Padlet</option>
                  <option value="FigJam">FigJam / Figma</option>
                  <option value="Miro">Miro</option>
                  <option value="Custom">Custom Web Board</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Board Share URL *
                </label>
                <input
                  type="url"
                  required
                  value={newBoardUrl}
                  onChange={(e) => setNewBoardUrl(e.target.value)}
                  placeholder="https://padlet.com/... or https://www.figma.com/board/..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBoardOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Link Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
