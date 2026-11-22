import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Pin,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Zap,
  Layers,
  Award,
  BookOpen,
  Palette,
  Timer,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { useT, type TranslationKey } from '../services/i18n';

type Batch3Key = TranslationKey;

export interface AppStoreItem {
  id: string;
  name: string;
  nameKey: Batch3Key;
  category: 'Plan' | 'Create' | 'Learn' | 'Research';
  description: string;
  descKey: Batch3Key;
  longOverview: string;
  overviewKey: Batch3Key;
  features: string[];
  featureKeys: readonly Batch3Key[];
  badge?: string;
  badgeKey?: Batch3Key;
  isDefaultPinned?: boolean;
  developer: string;
  rating: number;
}

const CATEGORY_KEY_MAP = {
  Plan: 'store_cat_plan',
  Create: 'store_cat_create',
  Learn: 'store_cat_learn',
  Research: 'store_cat_research',
} as const;

export const APP_CATALOG: AppStoreItem[] = [
  // 1. Plan & Integrations
  {
    id: 'canvas',
    name: 'Canvas LMS',
    nameKey: 'store_app_canvas_n',
    category: 'Plan',
    description: 'Sync coursework, due dates, course rubrics, and grades.',
    descKey: 'store_app_canvas_d',
    longOverview: 'Synchronize your university and school coursework, course syllabi, assignment rubrics, and submission deadlines into a single workspace.',
    overviewKey: 'store_app_canvas_o',
    features: ['iCal calendar & Canvas REST API syncing', 'AI subtask deconstruction', 'Google Drive submission integration', 'Overdue deadline alerts'],
    featureKeys: ['store_app_canvas_f1', 'store_app_canvas_f2', 'store_app_canvas_f3', 'store_app_canvas_f4'],
    badge: 'Essential',
    badgeKey: 'store_app_canvas_b',
    isDefaultPinned: true,
    developer: 'Instructure',
    rating: 4.9,
  },
  {
    id: 'radar',
    name: 'Daily Schedule & AI Planner',
    nameKey: 'store_app_radar_n',
    category: 'Plan',
    description: 'Chronological agenda and day-by-day AI study planner across Calendar, Canvas, Classroom & Gmail.',
    descKey: 'store_app_radar_d',
    longOverview: 'Unites your Google Calendar events, Canvas and Classroom deadlines, Gmail alerts, and Tracker tasks into both a live Daily Agenda and an editable day-by-day AI study planner.',
    overviewKey: 'store_app_radar_o',
    features: ['Live Google Calendar sync & collision-aware free-slot finder', 'Editable day-by-day AI study planner', 'Visual progress indicator for today', 'Direct Google Meet & Zoom launching'],
    featureKeys: ['store_app_radar_f1', 'store_app_radar_f2', 'store_app_radar_f3', 'store_app_radar_f4'],
    badge: 'Essential',
    badgeKey: 'store_app_radar_b',
    isDefaultPinned: true,
    developer: 'StudentOS Systems',
    rating: 4.9,
  },
  {
    id: 'tracker',
    name: 'Assignment Tracker',
    nameKey: 'store_app_tracker_n',
    category: 'Plan',
    description: 'Master assignment checklist with Google Sheets two-way sync.',
    descKey: 'store_app_tracker_d',
    longOverview: 'The central command center for all coursework. Syncs two-way with your Google Sheets master tracker, offers natural-language task parsing, and calculates effort matrices.',
    overviewKey: 'store_app_tracker_o',
    features: ['Google Sheets spreadsheet two-way sync', 'Natural text AI parser ("Study AP Bio tomorrow high priority")', 'Dynamic AI risk scoring & time estimates', 'Slide-over assignment inspector sheet'],
    featureKeys: ['store_app_tracker_f1', 'store_app_tracker_f2', 'store_app_tracker_f3', 'store_app_tracker_f4'],
    badge: 'Essential',
    badgeKey: 'store_app_tracker_b',
    isDefaultPinned: true,
    developer: 'StudentOS Lab',
    rating: 5.0,
  },
  {
    id: 'gmail',
    name: 'Gmail AI',
    nameKey: 'store_app_gmail_n',
    category: 'Plan',
    description: 'Filter academic emails, catch deadlines, and draft replies.',
    descKey: 'store_app_gmail_d',
    longOverview: 'Scans your inbox, separates spam and promotions from primary announcements, extracts assignment due dates, and drafts respectful email replies.',
    overviewKey: 'store_app_gmail_o',
    features: ['Academic vs Spam classification', '1-click "Create Task from Email" action', 'Context-aware email drafter', 'Master-detail two-pane reader'],
    featureKeys: ['store_app_gmail_f1', 'store_app_gmail_f2', 'store_app_gmail_f3', 'store_app_gmail_f4'],
    badge: 'AI Powered',
    badgeKey: 'store_app_gmail_b',
    isDefaultPinned: true,
    developer: 'Google Workspace',
    rating: 4.9,
  },
  {
    id: 'classroom',
    name: 'Google Classroom',
    nameKey: 'store_app_classroom_n',
    category: 'Plan',
    description: 'Sync assignments, announcements, and files from Google Classroom.',
    descKey: 'store_app_classroom_d',
    longOverview: 'Directly integrates with Google Classroom to pull assignments, classroom announcements, course materials, and attachments into your unified queue.',
    overviewKey: 'store_app_classroom_o',
    features: ['Google Classroom coursework import', 'Course announcements feed', '1-click sync to Master Tracker Sheet', 'Classroom material attachments preview'],
    featureKeys: ['store_app_classroom_f1', 'store_app_classroom_f2', 'store_app_classroom_f3', 'store_app_classroom_f4'],
    badge: 'Integration',
    badgeKey: 'store_app_classroom_b',
    developer: 'Google for Education',
    rating: 4.7,
  },

  // 2. Create — STEM & Visual Thinking
  {
    id: 'excalidraw',
    name: 'Excalidraw Whiteboard',
    nameKey: 'store_app_excalidraw_n',
    category: 'Create',
    description: 'Hand-drawn virtual whiteboard for diagrams, brainstorming, and sketching.',
    descKey: 'store_app_excalidraw_d',
    longOverview: 'A rapid virtual whiteboard for sketching mind maps, diagramming proofs, drawing anatomy models, and visual brainstorms directly in the browser.',
    overviewKey: 'store_app_excalidraw_o',
    features: ['Hand-drawn organic aesthetic', 'Vector shapes, arrows, and text labels', 'Full undo/redo history', 'Local storage autosave & PNG/SVG export'],
    featureKeys: ['store_app_excalidraw_f1', 'store_app_excalidraw_f2', 'store_app_excalidraw_f3', 'store_app_excalidraw_f4'],
    badge: 'Diagramming',
    badgeKey: 'store_app_excalidraw_b',
    developer: 'Excalidraw Open Source',
    rating: 4.9,
  },
  {
    id: 'geogebra',
    name: 'GeoGebra Math Suite',
    nameKey: 'store_app_geogebra_n',
    category: 'Create',
    description: '3D geometry, algebraic graphing, and calculus animations.',
    descKey: 'store_app_geogebra_d',
    longOverview: 'Comprehensive mathematics suite for 3D geometry, dynamic vectors, conic sections, probability distributions, and coordinate geometry.',
    overviewKey: 'store_app_geogebra_o',
    features: ['Interactive 3D geometry & spatial graphs', 'Dynamic vector arithmetic', 'Probability distribution curves', 'Constrained geometric constructions'],
    featureKeys: ['store_app_geogebra_f1', 'store_app_geogebra_f2', 'store_app_geogebra_f3', 'store_app_geogebra_f4'],
    badge: 'Geometry',
    badgeKey: 'store_app_geogebra_b',
    developer: 'GeoGebra',
    rating: 4.8,
  },
  {
    id: 'desmos-graphing',
    name: 'Desmos 2D Graphing',
    nameKey: 'store_app_desmos_n',
    category: 'Create',
    description: 'Plot equations, calculus curves, and functions with live sliders.',
    descKey: 'store_app_desmos_d',
    longOverview: 'The gold-standard 2D graphing calculator. Plot explicit, implicit, parametric, and polar equations with interactive sliders in the embedded Desmos calculator.',
    overviewKey: 'store_app_desmos_o',
    features: ['Interactive sliders & parameter animations', 'Calculus tangent lines & derivatives', 'Table data import & regressions', 'Interactive web calculator powered by Desmos'],
    featureKeys: ['store_app_desmos_f1', 'store_app_desmos_f2', 'store_app_desmos_f3', 'store_app_desmos_f4'],
    badge: 'STEM',
    badgeKey: 'store_app_desmos_b',
    developer: 'Desmos Studio',
    rating: 4.9,
  },
  {
    id: 'phet',
    name: 'PhET Interactive Simulations',
    nameKey: 'store_app_phet_n',
    category: 'Create',
    description: 'Interactive physics, chemistry, and biology laboratory simulations.',
    descKey: 'store_app_phet_d',
    longOverview: 'Curated interactive STEM laboratory simulations from the University of Colorado Boulder. Experiment with circuit construction, optics, projectile motion, and chemical kinetics.',
    overviewKey: 'store_app_phet_o',
    features: ['Circuit construction AC/DC simulator', 'Wave interference & optics sandbox', 'Atomic orbital & molecular geometry models', 'Interactive projectile physics lab'],
    featureKeys: ['store_app_phet_f1', 'store_app_phet_f2', 'store_app_phet_f3', 'store_app_phet_f4'],
    badge: 'Simulations',
    badgeKey: 'store_app_phet_b',
    developer: 'University of Colorado Boulder',
    rating: 5.0,
  },

  // 3. Learn — Study & Focus
  {
    id: 'flashcards',
    name: 'Flashcards (SM-2)',
    nameKey: 'store_app_flashcards_n',
    category: 'Learn',
    description: 'SM-2 active recall flashcards with review heatmap and TSV import/export.',
    descKey: 'store_app_flashcards_d',
    longOverview: 'A high-yield spaced repetition flashcard studio powered by the SuperMemo SM-2 algorithm. Generate decks from notes with AI, review cards daily, track your review heatmap, and import/export TSV decks.',
    overviewKey: 'store_app_flashcards_o',
    features: ['SuperMemo SM-2 spaced repetition engine', 'AI 1-click deck generator from text', 'TSV deck import & export', 'Review heatmap & ease factor tracking'],
    featureKeys: ['store_app_flashcards_f1', 'store_app_flashcards_f2', 'store_app_flashcards_f3', 'store_app_flashcards_f4'],
    badge: 'Spaced Repetition',
    badgeKey: 'store_app_flashcards_b',
    developer: 'StudentOS Cognitive Labs',
    rating: 5.0,
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro Focus Station',
    nameKey: 'store_app_pomodoro_n',
    category: 'Learn',
    description: 'Fullscreen focus timer with ambient soundscapes and session history.',
    descKey: 'store_app_pomodoro_d',
    longOverview: 'Enter deep uninterrupted flow states with a customizable Pomodoro timer, built-in ambient soundscapes, and daily focus streak tracking.',
    overviewKey: 'store_app_pomodoro_o',
    features: ['Customizable focus & break durations', 'Built-in ambient audio soundscapes', 'Daily session streak tracker', 'Distraction-free fullscreen mode'],
    featureKeys: ['store_app_pomodoro_f1', 'store_app_pomodoro_f2', 'store_app_pomodoro_f3', 'store_app_pomodoro_f4'],
    badge: 'Zen Focus',
    badgeKey: 'store_app_pomodoro_b',
    developer: 'StudentOS Focus Station',
    rating: 4.8,
  },

  // 4. Research — Files, Writing & Sources
  {
    id: 'drive',
    name: 'Google Drive',
    nameKey: 'store_app_drive_n',
    category: 'Research',
    description: 'Browse Google Docs, Sheets, Slides, and attach files in 1-click.',
    descKey: 'store_app_drive_d',
    longOverview: 'Browse your recent Google Docs, Sheets, Slides, and PDFs with 1-click peer sharing and instant Canvas assignment attachment.',
    overviewKey: 'store_app_drive_o',
    features: ['Google Drive file index', '1-click peer & professor permission sharing', 'Direct open in Google Docs/Sheets', 'Integrated submission picker'],
    featureKeys: ['store_app_drive_f1', 'store_app_drive_f2', 'store_app_drive_f3', 'store_app_drive_f4'],
    badge: 'Essential',
    badgeKey: 'store_app_drive_b',
    isDefaultPinned: true,
    developer: 'Google Workspace',
    rating: 4.9,
  },
  {
    id: 'notes-markdown',
    name: 'Markdown Notes & LaTeX',
    nameKey: 'store_app_notes_n',
    category: 'Research',
    description: 'Live Markdown and LaTeX math note-taker with 1-click Google Doc export.',
    descKey: 'store_app_notes_d',
    longOverview: 'A rapid lecture note-taker featuring live LaTeX math rendering via KaTeX, version snapshots, and 1-click Google Docs formatted export.',
    overviewKey: 'store_app_notes_o',
    features: ['KaTeX math equation rendering ($..$ & $$..$$)', '1-click Google Docs academic template export', 'Version snapshots & word stats', 'Local storage auto-persistence'],
    featureKeys: ['store_app_notes_f1', 'store_app_notes_f2', 'store_app_notes_f3', 'store_app_notes_f4'],
    badge: 'Writing',
    badgeKey: 'store_app_notes_b',
    isDefaultPinned: true,
    developer: 'StudentOS Notes',
    rating: 4.8,
  },
  {
    id: 'arxiv',
    name: 'arXiv Research Papers',
    nameKey: 'store_app_arxiv_n',
    category: 'Research',
    description: 'Search Cornell arXiv preprints in CS, Math, and Physics with direct PDFs.',
    descKey: 'store_app_arxiv_d',
    longOverview: 'Search the Cornell arXiv preprint repository. Read abstracts, inspect author credits, copy formatted citations, and open official research PDFs.',
    overviewKey: 'store_app_arxiv_o',
    features: ['Live query to export.arxiv.org API', 'Filters across CS, Math, Physics, Biology & Econ', '1-click citation copy', 'Direct PDF access'],
    featureKeys: ['store_app_arxiv_f1', 'store_app_arxiv_f2', 'store_app_arxiv_f3', 'store_app_arxiv_f4'],
    badge: 'Research',
    badgeKey: 'store_app_arxiv_b',
    developer: 'Cornell University (Open Access)',
    rating: 5.0,
  },
  {
    id: 'open-library',
    name: 'Open Library Textbooks',
    nameKey: 'store_app_openlib_n',
    category: 'Research',
    description: 'Search course textbooks with ISBNs and Internet Archive borrow links.',
    descKey: 'store_app_openlib_d',
    longOverview: 'Search textbooks, classic literature, and syllabus readings from the Open Library global catalog. View cover art, publication years, ISBNs, and read links.',
    overviewKey: 'store_app_openlib_o',
    features: ['Live query to openlibrary.org API', 'Textbook and author search', 'ISBN lookup & 1-click copy', 'Direct Internet Archive read/borrow links'],
    featureKeys: ['store_app_openlib_f1', 'store_app_openlib_f2', 'store_app_openlib_f3', 'store_app_openlib_f4'],
    badge: 'Books',
    badgeKey: 'store_app_openlib_b',
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

const CATEGORY_ITEMS = [
  { id: 'Highlights', key: 'store_cat_highlights' },
  { id: 'Plan', key: 'store_cat_plan' },
  { id: 'Create', key: 'store_cat_create' },
  { id: 'Learn', key: 'store_cat_learn' },
  { id: 'Research', key: 'store_cat_research' },
  { id: 'All Apps', key: 'store_cat_all' },
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
    window.dispatchEvent(new CustomEvent('scc-pinned-apps-updated', { detail: ids }));
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
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_ITEMS)[number]['id']>('Highlights');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingApp, setViewingApp] = useState<AppStoreItem | null>(null);
  const { t } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setViewingApp(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, onClose]);

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

  // Search filter — extended to features + developer + badge + localized text
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return APP_CATALOG.filter(
      (a) =>
        t(a.nameKey).toLowerCase().includes(q) ||
        t(a.descKey).toLowerCase().includes(q) ||
        t(CATEGORY_KEY_MAP[a.category]).toLowerCase().includes(q) ||
        a.featureKeys.some((fk) => t(fk).toLowerCase().includes(q)) ||
        (a.badgeKey && t(a.badgeKey).toLowerCase().includes(q)) ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.features.some(f=> f.toLowerCase().includes(q)) ||
        a.developer.toLowerCase().includes(q) ||
        (a.badge && a.badge.toLowerCase().includes(q))
    );
  }, [searchQuery, t]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden select-none animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('store_aria_dialog')}
        className="w-full h-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden outline-none"
      >
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-8 border-b border-[var(--border-hairline)] flex items-center justify-between gap-4 bg-[var(--bg-subtle)]/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {viewingApp ? (
              <button
                type="button"
                onClick={() => setViewingApp(null)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{t('store_back')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs" aria-hidden="true">
                  S
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                    {t('store_title')}
                  </h1>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {t('store_sub')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Center Search Bar */}
          {!viewingApp && (
            <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('store_search_ph')}
                  aria-label={t('store_aria_search')}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-strong)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-fill)]"
                />
              </div>
            </div>
          )}

          {/* Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold min-h-[40px] shrink-0"
            title={t('store_close_title')}
            aria-label={t('store_close_title')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('close')}</span>
          </button>
        </header>

        {/* Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* VIEW 1: DEDICATED APP DETAIL PAGE */}
          {viewingApp ? (
            <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 space-y-6 animate-in fade-in duration-150">
              {/* Hero App Card */}
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 sm:p-8 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0">
                  <AppLogo id={viewingApp.id} size="xl" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                        {t(viewingApp.nameKey)}
                      </h2>
                      {viewingApp.badgeKey && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                          {t(viewingApp.badgeKey)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {viewingApp.developer} • {t(CATEGORY_KEY_MAP[viewingApp.category])}
                    </p>
                  </div>
                </div>

                {/* Hero Action Buttons */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => onTogglePinApp(viewingApp.id)}
                    className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border min-h-[42px] ${
                      pinnedAppIds.includes(viewingApp.id)
                        ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)] hover:opacity-90'
                        : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    {pinnedAppIds.includes(viewingApp.id) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[var(--status-warn-text)]" aria-hidden="true" />
                        <span>{t('store_installed_sidebar')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                        <span>{t('store_install_sidebar')}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLaunchApp(viewingApp.id);
                      onClose();
                    }}
                    className="flex-1 md:flex-initial px-5 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    <span>{t('store_open_app')}</span>
                  </button>
                </div>
              </div>

              {/* About Section */}
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 sm:p-8 shadow-card space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    {t('store_about_app')}
                  </h3>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {t(viewingApp.overviewKey)}
                  </p>
                </div>

                {/* Key Capabilities */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    {t('store_key_capabilities')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingApp.featureKeys.map((featKey, i) => (
                      <div
                        key={i}
                        className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-start gap-2.5 text-xs text-[var(--text-primary)]"
                      >
                        <Zap className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="font-semibold">{t(featKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW 2: STORE CATALOG & CONTINUOUS FLOW */
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 space-y-7">
              {/* Mobile search input (header search bar is md+ only) */}
              <div className="md:hidden relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('store_search_ph_mobile')}
                  aria-label={t('store_aria_search')}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-fill)]"
                />
              </div>

              {/* Category Filter Pills — sticky + count badges */}
              <nav
                aria-label={t('store_cat_all')}
                className="sticky top-0 z-10 bg-[var(--bg-canvas)]/95 backdrop-blur-xs py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-[var(--border-default)] -mx-5 sm:-mx-8 px-5 sm:px-8"
              >
                {CATEGORY_ITEMS.map((cat) => {
                  const count =
                    cat.id === 'Highlights'
                      ? top8Highlights.length
                      : cat.id === 'All Apps'
                        ? APP_CATALOG.length
                        : APP_CATALOG.filter((a) => a.category === cat.id).length;
                  const isActive = selectedCategory === cat.id && !searchQuery.trim();
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchQuery('');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 border min-h-[38px] ${
                        isActive
                          ? 'bg-[var(--accent-fill)] border-[var(--accent-fill)] text-white font-bold shadow-xs'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-default)] hover:border-[var(--border-strong)] font-semibold'
                      }`}
                    >
                      <span>{t(cat.key)}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {/* SEARCH RESULTS VIEW (If Search Active) */}
              {searchQuery.trim() ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      {t('store_search_results', { count: searchResults.length })}
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">{t('store_query_label', { query: searchQuery })}</span>
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="py-16 text-center text-[var(--text-muted)] text-xs space-y-2 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)]">
                      <Search className="w-8 h-8 mx-auto opacity-40" aria-hidden="true" />
                      <p>{t('store_search_empty', { query: searchQuery })}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {searchResults.map((app) => renderAppCard(app))}
                    </div>
                  )}
                </div>
              ) : selectedCategory === 'Highlights' ? (
                /* CONTINUOUS SMOOTH FLOW: HIGHLIGHTS -> CATEGORIES */
                <div className="space-y-10 animate-in fade-in duration-150">
                  {/* 1. TOP 8 HIGHLIGHT SECTION */}
                  <section className="p-6 sm:p-7 rounded-2xl bg-[var(--bg-subtle)]/55 border border-[var(--border-hairline)] space-y-6">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-bold text-[var(--text-primary)]">
                            {t('store_top8_title')}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] uppercase tracking-wider">
                            {t('store_featured')}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {t('store_top8_sub')}
                        </p>
                        {/* Why recommended chip */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(() => {
                            try {
                              const coursesRaw = localStorage.getItem('scc_canvas_courses_v1');
                              const courses: string[] = coursesRaw ? JSON.parse(coursesRaw) : [];
                              const hasCourse = courses.join(' ').toLowerCase();
                              if (hasCourse.includes('calculus') || hasCourse.includes('math')) {
                                return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">{t('store_rec_calc')}</span>;
                              }
                              if (hasCourse.includes('chemistry') || hasCourse.includes('chem')) {
                                return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">{t('store_rec_chem')}</span>;
                              }
                              if (hasCourse) {
                                return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">{t('store_rec_courses', { courses: courses.slice(0, 2).join(', ') })}</span>;
                              }
                              try {
                                const usage = JSON.parse(localStorage.getItem('scc_app_usage_v1') || '{}');
                                const top = Object.entries(usage).sort((a: any, b: any) => b[1] - a[1])[0];
                                if (top) {
                                  const topApp = APP_CATALOG.find((a) => a.id === top[0]);
                                  return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">{t('store_rec_most_used', { app: topApp ? t(topApp.nameKey) : top[0] })}</span>;
                                }
                              } catch {}
                              return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">{t('store_rec_starter')}</span>;
                            } catch { return null; }
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Generous 2/3-Column Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {top8Highlights.map((app) => renderAppCard(app))}
                    </div>
                  </section>

                  {/* 2. PLAN SECTION */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-hairline)]">
                      <Layers className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        {t('store_plan_heading')}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {APP_CATALOG.filter((a) => a.category === 'Plan').map((app) => renderAppCard(app))}
                    </div>
                  </section>

                  {/* 3. CREATE SECTION */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-hairline)]">
                      <Palette className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        {t('store_create_heading')}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {APP_CATALOG.filter((a) => a.category === 'Create').map((app) => renderAppCard(app))}
                    </div>
                  </section>

                  {/* 4. LEARN SECTION */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-hairline)]">
                      <Timer className="w-4 h-4 text-[var(--status-ok-text)]" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        {t('store_learn_heading')}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {APP_CATALOG.filter((a) => a.category === 'Learn').map((app) => renderAppCard(app))}
                    </div>
                  </section>

                  {/* 5. RESEARCH SECTION */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-hairline)]">
                      <BookOpen className="w-4 h-4 text-[var(--status-info-text)]" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        {t('store_research_heading')}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {APP_CATALOG.filter((a) => a.category === 'Research').map((app) => renderAppCard(app))}
                    </div>
                  </section>
                </div>
              ) : (
                /* SPECIFIC CATEGORY VIEW (15-APP CATALOG / CATEGORY GRID) */
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">
                      {t(CATEGORY_ITEMS.find((c) => c.id === selectedCategory)?.key || 'store_cat_all')} ({categoryApps.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {categoryApps.map((app) => renderAppCard(app))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderAppCard(app: AppStoreItem) {
    const isPinned = pinnedAppIds.includes(app.id);

    return (
      <div
        key={app.id}
        style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '124px' } as any}
        className="bg-[var(--bg-subtle)]/45 hover:bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--border-default)] p-5 transition-colors group flex flex-col justify-between gap-4"
      >
        {/* Accessible app details trigger (avoids nested interactive buttons) */}
        <button
          type="button"
          onClick={() => setViewingApp(app)}
          className="flex items-start gap-3.5 text-left cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--accent-fill)]"
        >
          <AppLogo id={app.id} size="md" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate leading-tight">
                {t(app.nameKey)}
              </h3>
              {app.badgeKey && (
                <span className="px-1.5 py-px rounded-md text-[9px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)] shrink-0 whitespace-nowrap">
                  {t(app.badgeKey)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {t(CATEGORY_KEY_MAP[app.category])} • {app.developer}
            </p>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-2 leading-relaxed">
              {t(app.descKey)}
            </p>
          </div>
        </button>

        {/* Calm Open & Pin Controls */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)] shrink-0">
          <button
            type="button"
            onClick={() => onTogglePinApp(app.id)}
            className={`text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
              isPinned
                ? 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isPinned ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-ok-text)]" aria-hidden="true" /> {t('store_installed')}</>
            ) : (
              <><Pin className="w-3.5 h-3.5" aria-hidden="true" /> {t('store_install')}</>
            )}
          </button>

          {isPinned ? (
            <button
              type="button"
              onClick={() => {
                onLaunchApp(app.id);
                onClose();
              }}
              className="px-4 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-full text-xs font-semibold transition-colors cursor-pointer min-w-[76px] min-h-[32px]"
            >
              {t('store_open_btn')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTogglePinApp(app.id)}
              className="px-4 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-full text-xs font-semibold transition-colors cursor-pointer min-w-[76px] min-h-[32px]"
            >
              {t('store_get_btn')}
            </button>
          )}
        </div>
      </div>
    );
  }
};
