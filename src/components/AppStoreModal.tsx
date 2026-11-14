import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Pin,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Star,
  Zap,
  Layers,
  Award,
  BookOpen,
  Palette,
  Timer,
} from 'lucide-react';
import { AppLogo } from './AppLogo';

export interface AppStoreItem {
  id: string;
  name: string;
  category: 'Plan' | 'Create' | 'Learn' | 'Research';
  description: string;
  longOverview: string;
  features: string[];
  badge?: string;
  isDefaultPinned?: boolean;
  developer: string;
  rating: number;
}

export const APP_CATALOG: AppStoreItem[] = [
  // 1. Plan & Integrations
  {
    id: 'canvas',
    name: 'Canvas LMS',
    category: 'Plan',
    description: 'Sync coursework, due dates, course rubrics, and grades.',
    longOverview: 'Synchronize your university and school coursework, course syllabi, assignment rubrics, and submission deadlines into a single workspace.',
    features: ['iCal calendar & Canvas REST API syncing', 'AI subtask deconstruction', 'Google Drive submission integration', 'Overdue deadline alerts'],
    badge: 'Essential',
    isDefaultPinned: true,
    developer: 'Instructure',
    rating: 4.9,
  },
  {
    id: 'radar',
    name: 'Daily Schedule & AI Planner',
    category: 'Plan',
    description: 'Chronological agenda and day-by-day AI study planner across Calendar, Canvas, Classroom & Gmail.',
    longOverview: 'Unites your Google Calendar events, Canvas and Classroom deadlines, Gmail alerts, and Tracker tasks into both a live Daily Agenda and an editable day-by-day AI study planner.',
    features: ['Live Google Calendar sync & collision-aware free-slot finder', 'Editable day-by-day AI study planner', 'Visual progress indicator for today', 'Direct Google Meet & Zoom launching'],
    badge: 'Essential',
    isDefaultPinned: true,
    developer: 'StudentOS Systems',
    rating: 4.9,
  },
  {
    id: 'tracker',
    name: 'Assignment Tracker',
    category: 'Plan',
    description: 'Master assignment checklist with Google Sheets two-way sync.',
    longOverview: 'The central command center for all coursework. Syncs two-way with your Google Sheets master tracker, offers natural-language task parsing, and calculates effort matrices.',
    features: ['Google Sheets spreadsheet two-way sync', 'Natural text AI parser ("Study AP Bio tomorrow high priority")', 'Dynamic AI risk scoring & time estimates', 'Slide-over assignment inspector sheet'],
    badge: 'Essential',
    isDefaultPinned: true,
    developer: 'StudentOS Lab',
    rating: 5.0,
  },
  {
    id: 'gmail',
    name: 'Gmail AI',
    category: 'Plan',
    description: 'Filter academic emails, catch deadlines, and draft replies.',
    longOverview: 'Scans your inbox, separates spam and promotions from primary announcements, extracts assignment due dates, and drafts respectful email replies.',
    features: ['Academic vs Spam classification', '1-click "Create Task from Email" action', 'Context-aware email drafter', 'Master-detail two-pane reader'],
    badge: 'AI Powered',
    isDefaultPinned: true,
    developer: 'Google Workspace',
    rating: 4.9,
  },
  {
    id: 'classroom',
    name: 'Google Classroom',
    category: 'Plan',
    description: 'Sync assignments, announcements, and files from Google Classroom.',
    longOverview: 'Directly integrates with Google Classroom to pull assignments, classroom announcements, course materials, and attachments into your unified queue.',
    features: ['Google Classroom coursework import', 'Course announcements feed', '1-click sync to Master Tracker Sheet', 'Classroom material attachments preview'],
    badge: 'Integration',
    developer: 'Google for Education',
    rating: 4.7,
  },

  // 2. Create — STEM & Visual Thinking
  {
    id: 'excalidraw',
    name: 'Excalidraw Whiteboard',
    category: 'Create',
    description: 'Hand-drawn virtual whiteboard for diagrams, brainstorming, and sketching.',
    longOverview: 'A rapid virtual whiteboard for sketching mind maps, diagramming proofs, drawing anatomy models, and visual brainstorms directly in the browser.',
    features: ['Hand-drawn organic aesthetic', 'Vector shapes, arrows, and text labels', 'Full undo/redo history', 'Local storage autosave & PNG/SVG export'],
    badge: 'Diagramming',
    developer: 'Excalidraw Open Source',
    rating: 4.9,
  },
  {
    id: 'geogebra',
    name: 'GeoGebra Math Suite',
    category: 'Create',
    description: '3D geometry, algebraic graphing, and calculus animations.',
    longOverview: 'Comprehensive mathematics suite for 3D geometry, dynamic vectors, conic sections, probability distributions, and coordinate geometry.',
    features: ['Interactive 3D geometry & spatial graphs', 'Dynamic vector arithmetic', 'Probability distribution curves', 'Constrained geometric constructions'],
    badge: 'Geometry',
    developer: 'GeoGebra',
    rating: 4.8,
  },
  {
    id: 'desmos-graphing',
    name: 'Desmos 2D Graphing',
    category: 'Create',
    description: 'Plot equations, calculus curves, and functions with live sliders.',
    longOverview: 'The gold-standard 2D graphing calculator. Plot explicit, implicit, parametric, and polar equations with interactive sliders in the embedded Desmos calculator.',
    features: ['Interactive sliders & parameter animations', 'Calculus tangent lines & derivatives', 'Table data import & regressions', 'Interactive web calculator powered by Desmos'],
    badge: 'STEM',
    developer: 'Desmos Studio',
    rating: 4.9,
  },
  {
    id: 'phet',
    name: 'PhET Interactive Simulations',
    category: 'Create',
    description: 'Interactive physics, chemistry, and biology laboratory simulations.',
    longOverview: 'Curated interactive STEM laboratory simulations from the University of Colorado Boulder. Experiment with circuit construction, optics, projectile motion, and chemical kinetics.',
    features: ['Circuit construction AC/DC simulator', 'Wave interference & optics sandbox', 'Atomic orbital & molecular geometry models', 'Interactive projectile physics lab'],
    badge: 'Simulations',
    developer: 'University of Colorado Boulder',
    rating: 5.0,
  },

  // 3. Learn — Study & Focus
  {
    id: 'flashcards',
    name: 'Flashcards (SM-2)',
    category: 'Learn',
    description: 'SM-2 active recall flashcards with review heatmap and TSV import/export.',
    longOverview: 'A high-yield spaced repetition flashcard studio powered by the SuperMemo SM-2 algorithm. Generate decks from notes with AI, review cards daily, track your review heatmap, and import/export TSV decks.',
    features: ['SuperMemo SM-2 spaced repetition engine', 'AI 1-click deck generator from text', 'TSV deck import & export', 'Review heatmap & ease factor tracking'],
    badge: 'Spaced Repetition',
    developer: 'StudentOS Cognitive Labs',
    rating: 5.0,
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro Focus Station',
    category: 'Learn',
    description: 'Fullscreen focus timer with ambient soundscapes and session history.',
    longOverview: 'Enter deep uninterrupted flow states with a customizable Pomodoro timer, built-in ambient soundscapes, and daily focus streak tracking.',
    features: ['Customizable focus & break durations', 'Built-in ambient audio soundscapes', 'Daily session streak tracker', 'Distraction-free fullscreen mode'],
    badge: 'Zen Focus',
    developer: 'StudentOS Focus Station',
    rating: 4.8,
  },

  // 4. Research — Files, Writing & Sources
  {
    id: 'drive',
    name: 'Google Drive',
    category: 'Research',
    description: 'Browse Google Docs, Sheets, Slides, and attach files in 1-click.',
    longOverview: 'Browse your recent Google Docs, Sheets, Slides, and PDFs with 1-click peer sharing and instant Canvas assignment attachment.',
    features: ['Google Drive file index', '1-click peer & professor permission sharing', 'Direct open in Google Docs/Sheets', 'Integrated submission picker'],
    badge: 'Essential',
    isDefaultPinned: true,
    developer: 'Google Workspace',
    rating: 4.9,
  },
  {
    id: 'notes-markdown',
    name: 'Markdown Notes & LaTeX',
    category: 'Research',
    description: 'Live Markdown and LaTeX math note-taker with 1-click Google Doc export.',
    longOverview: 'A rapid lecture note-taker featuring live LaTeX math rendering via KaTeX, version snapshots, and 1-click Google Docs formatted export.',
    features: ['KaTeX math equation rendering ($..$ & $$..$$)', '1-click Google Docs academic template export', 'Version snapshots & word stats', 'Local storage auto-persistence'],
    badge: 'Writing',
    isDefaultPinned: true,
    developer: 'StudentOS Notes',
    rating: 4.8,
  },
  {
    id: 'arxiv',
    name: 'arXiv Research Papers',
    category: 'Research',
    description: 'Search Cornell arXiv preprints in CS, Math, and Physics with direct PDFs.',
    longOverview: 'Search the Cornell arXiv preprint repository. Read abstracts, inspect author credits, copy formatted citations, and open official research PDFs.',
    features: ['Live query to export.arxiv.org API', 'Filters across CS, Math, Physics, Biology & Econ', '1-click citation copy', 'Direct PDF access'],
    badge: 'Research',
    developer: 'Cornell University (Open Access)',
    rating: 5.0,
  },
  {
    id: 'open-library',
    name: 'Open Library Textbooks',
    category: 'Research',
    description: 'Search course textbooks with ISBNs and Internet Archive borrow links.',
    longOverview: 'Search textbooks, classic literature, and syllabus readings from the Open Library global catalog. View cover art, publication years, ISBNs, and read links.',
    features: ['Live query to openlibrary.org API', 'Textbook and author search', 'ISBN lookup & 1-click copy', 'Direct Internet Archive read/borrow links'],
    badge: 'Books',
    developer: 'Internet Archive',
    rating: 4.9,
  },
];

// Top 8 Recommended Highlight Apps (Exactly 8)
export const TOP_8_HIGHLIGHT_IDS = [
  'radar',
  'canvas',
  'tracker',
  'gmail',
  'notes-markdown',
  'desmos-graphing',
  'flashcards',
  'pomodoro',
];

const VALID_APP_IDS = new Set(APP_CATALOG.map((a) => a.id));
const LEGACY_APP_MAP: Record<string, string> = {
  'ai-planner': 'radar',
  timetable: 'radar',
  documents: 'notes-markdown',
  quizlet: 'flashcards',
  anki: 'flashcards',
  'desmos-scientific': 'desmos-graphing',
};

const CATEGORIES = [
  'Highlights',
  'Plan',
  'Create',
  'Learn',
  'Research',
  'All Apps',
] as const;

const LOCAL_PINNED_APPS_KEY = 'scc_pinned_apps_v2';

export function loadPinnedAppIds(): string[] {
  const defaults = ['canvas', 'radar', 'tracker', 'gmail', 'drive', 'notes-markdown'];
  try {
    const saved = localStorage.getItem(LOCAL_PINNED_APPS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        const normalized = parsed
          .map((id: string) => LEGACY_APP_MAP[id] || id)
          .filter((id: string) => VALID_APP_IDS.has(id));
        const merged = [...defaults.filter(id => !normalized.includes(id)), ...normalized];
        return [...new Set(merged)];
      }
    }
  } catch {}
  return defaults;
}

export function savePinnedAppIds(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_PINNED_APPS_KEY, JSON.stringify(ids));
  } catch {}
}

interface AppStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchApp: (appId: string) => void;
  pinnedAppIds: string[];
  onTogglePinApp: (appId: string) => void;
}

export const AppStoreModal: React.FC<AppStoreModalProps> = ({
  isOpen,
  onClose,
  onLaunchApp,
  pinnedAppIds,
  onTogglePinApp,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Highlights');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingApp, setViewingApp] = useState<AppStoreItem | null>(null);

  // Top 8 dynamic: Most Used + Recommended via token similarity (more robust than substring)
  const top8Highlights = useMemo(() => {
    try {
      const usageRaw = localStorage.getItem('scc_app_usage_v1');
      const usage: Record<string, number> = usageRaw ? JSON.parse(usageRaw) : {};
      const coursesRaw = localStorage.getItem('scc_canvas_courses_v1');
      const courses: string[] = coursesRaw ? JSON.parse(coursesRaw) : [];
      const mostUsed = Object.entries(usage)
        .sort((a,b)=> b[1]-a[1])
        .map(([id])=> LEGACY_APP_MAP[id] || id)
        .filter((id)=> VALID_APP_IDS.has(id))
        .slice(0,4);
      const tokens = courses.join(' ').toLowerCase().split(/[^a-z]+/).filter(Boolean);
      const tokenSet = new Set(tokens);
      const has = (...keys: string[]) => keys.some(k=> tokenSet.has(k));
      const recommended: string[] = [];
      if (has('math','calculus','algebra','physics','geometry','trigonometry')) recommended.push('desmos-graphing','geogebra');
      if (has('history','english','literature','writing','essay')) recommended.push('notes-markdown','drive','open-library');
      if (has('chemistry','chem','biology','bio','organic')) recommended.push('phet','arxiv');
      if (has('computer','cs','programming','code')) recommended.push('excalidraw','arxiv');
      if (recommended.length===0) {
        // explicit user picking onboarding: check scc_onboarding_picks
        try {
          const picks = JSON.parse(localStorage.getItem('scc_onboarding_picks')||'[]');
          if (Array.isArray(picks) && picks.length) {
            recommended.push(...picks.map((id: string) => LEGACY_APP_MAP[id] || id).filter((id: string) => VALID_APP_IDS.has(id)).slice(0,2));
          }
        } catch {}
        if (recommended.length===0) recommended.push('flashcards','pomodoro');
      }
      const dynamicIds = [...new Set([...mostUsed, ...recommended, ...TOP_8_HIGHLIGHT_IDS])].slice(0,8);
      const ids = dynamicIds.length>=8 ? dynamicIds : [...new Set([...TOP_8_HIGHLIGHT_IDS, ...dynamicIds])].slice(0,8);
      return ids.map((id) => APP_CATALOG.find((a) => a.id === id)!).filter(Boolean);
    } catch {
      return TOP_8_HIGHLIGHT_IDS.map((id) => APP_CATALOG.find((a) => a.id === id)!).filter(Boolean);
    }
  }, []);

  // Filtered Apps when a specific category tab is selected
  const categoryApps = useMemo(() => {
    if (selectedCategory === 'All Apps') return APP_CATALOG;
    return APP_CATALOG.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  // Search filter — extended to features + developer + badge
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return APP_CATALOG.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.features.some(f=> f.toLowerCase().includes(q)) ||
        a.developer.toLowerCase().includes(q) ||
        (a.badge && a.badge.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="App Store" className="fixed inset-0 z-50 bg-[#FAF9F5] dark:bg-[#141413] flex flex-col animate-in fade-in duration-150 select-none">
      
      {/* Top Header Bar */}
      <header className="h-16 px-6 sm:px-10 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between bg-white dark:bg-[#1A1917] shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {viewingApp ? (
            <button
              onClick={() => setViewingApp(null)}
              className="px-3 py-1.5 rounded-xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Store</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#D97757] text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-[#D97757]/20">
                S
              </div>
              <div>
                <h1 className="text-base font-extrabold text-[#141413] dark:text-[#FAF9F5] tracking-tight">
                  StudentOS App Store
                </h1>
                <p className="text-[11px] text-[#8C897F]">
                  Connect and launch all your academic tools &amp; integrations in one place
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center Search Bar */}
        {!viewingApp && (
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#8C897F] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools, Canvas, Desmos, Flashcards, Notes..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />
            </div>
          </div>
        )}

        {/* Right Close Button */}
        <button
          onClick={onClose}
          className="p-2 rounded-2xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="Close App Store (Esc)"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Close</span>
        </button>
      </header>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        
        {/* VIEW 1: DEDICATED APP DETAIL PAGE */}
        {viewingApp ? (
          <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Hero App Card */}
            <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <AppLogo id={viewingApp.id} size="xl" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-2xl font-bold text-[#141413] dark:text-[#FAF9F5]">
                      {viewingApp.name}
                    </h2>
                    {viewingApp.badge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D97757]/15 text-[#D97757]">
                        {viewingApp.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8C897F]">
                    {viewingApp.developer} • {viewingApp.category}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B6860] pt-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-[#141413] dark:text-[#FAF9F5]">{viewingApp.rating.toFixed(1)}</span>
                    <span className="text-[11px] font-medium">• {viewingApp.category} • {viewingApp.developer}</span>
                  </div>
                </div>
              </div>

              {/* Hero Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => onTogglePinApp(viewingApp.id)}
                  className={`flex-1 md:flex-initial px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    pinnedAppIds.includes(viewingApp.id)
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-white dark:bg-[#252422] text-[#141413] dark:text-[#FAF9F5] border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]'
                  }`}
                >
                  {pinnedAppIds.includes(viewingApp.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Installed in Sidebar</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#D97757]" />
                      <span>Install in Sidebar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    onLaunchApp(viewingApp.id);
                    onClose();
                  }}
                  className="flex-1 md:flex-initial px-6 py-2.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open App</span>
                </button>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-8 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8C897F] mb-3">
                  About this App
                </h3>
                <p className="text-sm text-[#141413] dark:text-[#FAF9F5] leading-relaxed">
                  {viewingApp.longOverview}
                </p>
              </div>

              {/* Key Capabilities */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8C897F] mb-3">
                  Key Capabilities
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewingApp.features.map((feat, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] flex items-start gap-2.5 text-xs text-[#141413] dark:text-[#FAF9F5]"
                    >
                      <Zap className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                      <span className="font-semibold">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* VIEW 2: STORE CATALOG & CONTINUOUS FLOW */
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 space-y-8">

            {/* Mobile search input (header search bar is md+ only) */}
            <div className="md:hidden relative">
              <Search className="w-4 h-4 text-[#8C897F] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools, Canvas, Desmos, Flashcards..."
                aria-label="Search apps"
                className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />
            </div>

            {/* Category Filter Pills — sticky + count badges */}
            <div className="sticky top-0 z-10 bg-[#FAF9F5] dark:bg-[#141413] py-2 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#DFDACB]/40 dark:border-[#2C2B27]/40 -mx-6 sm:-mx-10 px-6 sm:px-10">
              {CATEGORIES.map((cat) => {
                const count = cat==='Highlights' ? top8Highlights.length : cat==='All Apps' ? APP_CATALOG.length : APP_CATALOG.filter(a=>a.category===cat).length;
                return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery('');
                  }}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === cat && !searchQuery.trim()
                      ? 'bg-[#D97757] text-white shadow-xs'
                      : 'bg-white dark:bg-[#1A1917] text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27]'
                  }`}
                >
                  <span>{cat}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCategory===cat ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>{count}</span>
                </button>
                );
              })}
            </div>

            {/* SEARCH RESULTS VIEW (If Search Active) */}
            {searchQuery.trim() ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                    Search Results ({searchResults.length})
                  </h2>
                  <span className="text-xs text-[#8C897F]">Query: "{searchQuery}"</span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="py-20 text-center text-[#8C897F] text-xs space-y-2">
                    <Search className="w-8 h-8 mx-auto opacity-30" />
                    <p>No tools match "{searchQuery}". Try a different keyword.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.map((app) => renderAppCard(app))}
                  </div>
                )}
              </div>
            ) : selectedCategory === 'Highlights' ? (
              /* CONTINUOUS SMOOTH FLOW: HIGHLIGHTS -> CATEGORIES */
              <div className="space-y-12 animate-in fade-in duration-200">
                
                {/* 1. TOP 8 HIGHLIGHT SECTION (Visual Highlight Effect) */}
                <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FAF9F5] to-amber-500/5 dark:from-[#1A1917] dark:to-amber-500/10 border-2 border-[#D97757]/40 shadow-md space-y-6 relative overflow-hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#D97757] text-white flex items-center justify-center shadow-sm">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-[#141413] dark:text-[#FAF9F5]">
                            Top 8 Recommended Essentials
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D97757] text-white uppercase tracking-wider">
                            Featured
                          </span>
                        </div>
                        <p className="text-xs text-[#8C897F] mt-0.5">
                          The curated core tools every student needs for daily academic workflow
                        </p>
                        {/* Why recommended chip — explains dynamic logic */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(() => {
                            try {
                              const coursesRaw = localStorage.getItem('scc_canvas_courses_v1');
                              const courses: string[] = coursesRaw ? JSON.parse(coursesRaw) : [];
                              const hasCourse = courses.join(' ').toLowerCase();
                              if (hasCourse.includes('calculus') || hasCourse.includes('math')) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/25">Because you have Calculus — Try Desmos & GeoGebra</span>;
                              if (hasCourse.includes('chemistry') || hasCourse.includes('chem')) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/25">Because you have Chemistry — Try PhET Simulations</span>;
                              if (hasCourse) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/25">Recommended for your courses: {courses.slice(0,2).join(', ')}</span>;
                              try { const usage = JSON.parse(localStorage.getItem('scc_app_usage_v1')||'{}'); const top = Object.entries(usage).sort((a:any,b:any)=>b[1]-a[1])[0]; if (top) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/20">Because you use {top[0]} most</span>; } catch {}
                              return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#141413]/5 dark:bg-[#FAF9F5]/10 text-[#6B6860] dark:text-[#B5B2A8] border border-[#DFDACB] dark:border-[#2C2B27]">Starter essentials — add your courses to personalize</span>;
                            } catch { return null; }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2 Apps Per Row Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {top8Highlights.map((app) => renderAppCard(app, true))}
                  </div>
                </div>

                {/* 2. PLAN SECTION */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                    <Layers className="w-4 h-4 text-[#D97757]" />
                    <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                      Plan — Schedule, Tasks & Deadlines
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {APP_CATALOG.filter((a) => a.category === 'Plan').map((app) => renderAppCard(app))}
                  </div>
                </div>

                {/* 3. CREATE SECTION — STEM + Visual combined */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                    <Palette className="w-4 h-4 text-violet-600" />
                    <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                      Create — STEM, Math & Visual Thinking
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {APP_CATALOG.filter((a) => a.category === 'Create').map((app) => renderAppCard(app))}
                  </div>
                </div>

                {/* 4. LEARN SECTION */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                    <Timer className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                      Learn — Study, Retention & Focus
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {APP_CATALOG.filter((a) => a.category === 'Learn').map((app) => renderAppCard(app))}
                  </div>
                </div>

                {/* 5. RESEARCH SECTION */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                      Research — Writing, PDFs & Library
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {APP_CATALOG.filter((a) => a.category === 'Research').map((app) => renderAppCard(app))}
                  </div>
                </div>

              </div>
            ) : (
              /* SPECIFIC CATEGORY VIEW (2 APPS PER ROW) */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                  <h2 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                    {selectedCategory} ({categoryApps.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryApps.map((app) => renderAppCard(app))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );

  function renderAppCard(app: AppStoreItem, isHighlighted = false) {
    const isPinned = pinnedAppIds.includes(app.id);

    return (
      <div
        key={app.id}
        onClick={() => setViewingApp(app)}
        style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '96px' } as any}
        className={`bg-white dark:bg-[#1A1917] rounded-2xl border p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center gap-3.5 ${
          isHighlighted
            ? 'border-[#D97757]/40 hover:border-[#D97757]'
            : 'border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]/60'
        }`}
      >
        {/* Store-style icon */}
        <AppLogo id={app.id} size="md" className="shrink-0" />

        {/* Store-style middle: name / subtitle / rating */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13px] font-bold text-[#141413] dark:text-[#FAF9F5] group-hover:text-[#D97757] transition-colors truncate leading-tight">
              {app.name}
            </h3>
            {app.badge && (
              <span className="px-1.5 py-px rounded-md text-[9px] font-bold bg-[#D97757]/15 text-[#D97757] shrink-0 whitespace-nowrap">
                {app.badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8C897F] truncate mt-0.5">
            {app.category} • {app.developer}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-[11px] font-bold text-[#141413] dark:text-[#FAF9F5]">{app.rating.toFixed(1)}</span>
            <span className="text-[11px] text-[#8C897F] truncate">— {app.description}</span>
          </div>
        </div>

        {/* Store-style GET / OPEN pill */}
        <div className="flex flex-col items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isPinned ? (
            <button
              onClick={() => {
                onLaunchApp(app.id);
                onClose();
              }}
              className="px-5 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-full text-xs font-extrabold tracking-wide transition-all shadow-xs cursor-pointer min-w-[72px]"
            >
              OPEN
            </button>
          ) : (
            <button
              onClick={() => onTogglePinApp(app.id)}
              className="px-5 py-1.5 bg-[#D97757]/15 hover:bg-[#D97757]/25 text-[#D97757] rounded-full text-xs font-extrabold tracking-wide transition-all cursor-pointer min-w-[72px]"
            >
              GET
            </button>
          )}
          <button
            onClick={() => (isPinned ? (onLaunchApp(app.id), onClose()) : onTogglePinApp(app.id))}
            className="text-[10px] font-semibold text-[#8C897F] hover:text-[#D97757] transition-colors cursor-pointer flex items-center gap-0.5"
          >
            {isPinned ? (
              <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Installed</>
            ) : (
              <><Pin className="w-3 h-3" /> Install</>
            )}
          </button>
        </div>
      </div>
    );
  }
};
