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
  Sparkles,
  ScanText,
  ArrowRight,
  Package,
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
    name: 'Weekly Plan',
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
    id: 'geogebra',
    name: 'GeoGebra',
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
    name: 'Desmos',
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
    name: 'PhET',
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
    name: 'Flashcards',
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
    name: 'Pomodoro',
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
    id: 'note-scanner',
    name: 'Note Scanner',
    nameKey: 'store_app_scanner_n',
    category: 'Research',
    description: 'Extract handwritten or whiteboard notes and equations into Markdown.',
    descKey: 'store_app_scanner_d',
    longOverview: 'Upload or paste photos of handwritten notebook pages, whiteboards, or lecture slides to extract clean Markdown text, math equations, and key terms in seconds.',
    overviewKey: 'store_app_scanner_o',
    features: ['Handwritten & whiteboard OCR extraction', 'Preserves KaTeX math formulas & headings', 'Multi-page batch scanning & clipboard paste', '1-click save to Markdown Notes'],
    featureKeys: ['store_app_scanner_f1', 'store_app_scanner_f2', 'store_app_scanner_f3', 'store_app_scanner_f4'],
    badge: 'New · Vision AI',
    badgeKey: 'store_app_scanner_b',
    developer: 'StudentOS Vision',
    rating: 5.0,
  },
  {
    id: 'lecture-studio',
    name: 'Lectures',
    nameKey: 'store_app_lecture_n',
    category: 'Research',
    description: 'Turn 1-hour lecture recordings into timestamped transcripts, summaries, and flashcards.',
    descKey: 'store_app_lecture_d',
    longOverview: 'Upload MP3/M4A/WAV lecture recordings. On-device silence trimming keeps audio compact while fast online or offline speech models transcribe and synthesize clean study notes.',
    overviewKey: 'store_app_lecture_o',
    features: ['On-device silence trimming before transcription', 'Fast Gemini audio mode or 100% offline transcription', 'Clickable [mm:ss] outline & transcript player', '1-click save to Notes, Flashcards, or AI Coach'],
    featureKeys: ['store_app_lecture_f1', 'store_app_lecture_f2', 'store_app_lecture_f3', 'store_app_lecture_f4'],
    badge: 'New · Audio AI',
    badgeKey: 'store_app_lecture_b',
    developer: 'StudentOS Audio',
    rating: 5.0,
  },
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
    name: 'Notes',
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
    name: 'arXiv',
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
    name: 'Open Library',
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
  'note-scanner',
  'radar',
  'canvas',
  'tracker',
  'gmail',
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
        const merged = [...defaults.filter((id) => !normalized.includes(id)), ...normalized];
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

interface AppVisualStyle {
  gradient: string;
  accentHex: string;
  preview: React.ReactNode;
}

const APP_VISUALS: Record<string, AppVisualStyle> = {
  'note-scanner': {
    gradient: 'from-teal-500/20 via-cyan-500/10 to-emerald-500/15',
    accentHex: '#0D9488',
    preview: (
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <div className="px-2 py-1 rounded-md bg-white/80 dark:bg-black/35 border border-teal-500/30 text-teal-800 dark:text-teal-200 shadow-2xs">
          ∫ eˣ dx → Markdown
        </div>
        <span className="px-1.5 py-0.5 rounded bg-teal-600 text-white font-bold">OCR</span>
      </div>
    ),
  },
  'lecture-studio': {
    gradient: 'from-indigo-500/20 via-violet-500/10 to-purple-500/15',
    accentHex: '#6366F1',
    preview: (
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <div className="px-2 py-1 rounded-md bg-white/80 dark:bg-black/35 border border-indigo-500/30 text-indigo-800 dark:text-indigo-200 shadow-2xs">
          [04:12] → Outline & Cards
        </div>
        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">VAD</span>
      </div>
    ),
  },
  canvas: {
    gradient: 'from-rose-500/20 via-red-500/10 to-orange-500/15',
    accentHex: '#E72429',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-semibold">
        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white">Due Fri</span>
        <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/35 text-rose-800 dark:text-rose-200 border border-rose-500/30">Rubric Synced</span>
      </div>
    ),
  },
  radar: {
    gradient: 'from-emerald-500/20 via-teal-500/10 to-green-500/15',
    accentHex: '#059669',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">19:00</span>
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30">45m Focus</span>
      </div>
    ),
  },
  tracker: {
    gradient: 'from-indigo-500/20 via-violet-500/10 to-blue-500/15',
    accentHex: '#4F46E5',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-semibold">
        <span className="px-2 py-0.5 rounded bg-indigo-600 text-white">2-Way Sheet</span>
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30">Risk 8/10</span>
      </div>
    ),
  },
  gmail: {
    gradient: 'from-blue-500/20 via-rose-500/10 to-amber-500/15',
    accentHex: '#2563EB',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-semibold">
        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white">Exam Alert</span>
        <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/35 text-slate-700 dark:text-slate-200 border border-blue-500/30">Spam Filtered</span>
      </div>
    ),
  },
  classroom: {
    gradient: 'from-green-600/20 via-emerald-500/10 to-amber-500/15',
    accentHex: '#137333',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-semibold">
        <span className="px-2 py-0.5 rounded bg-[#137333] text-white">Stream</span>
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-green-900 dark:text-green-200 border border-green-600/30">Coursework</span>
      </div>
    ),
  },
  geogebra: {
    gradient: 'from-blue-600/20 via-sky-500/10 to-indigo-500/15',
    accentHex: '#1565C0',
    preview: (
      <svg className="w-24 h-7 opacity-85" viewBox="0 0 120 32" fill="none" aria-hidden="true">
        <ellipse cx="60" cy="16" rx="34" ry="11" stroke="#1565C0" strokeWidth="1.8" transform="rotate(-14 60 16)" />
        <circle cx="34" cy="18" r="3" fill="#1565C0" />
        <circle cx="62" cy="6" r="3" fill="#0EA5E9" />
        <circle cx="88" cy="15" r="3" fill="#1565C0" />
      </svg>
    ),
  },
  'desmos-graphing': {
    gradient: 'from-emerald-600/20 via-green-500/10 to-teal-500/15',
    accentHex: '#0b864a',
    preview: (
      <svg className="w-28 h-7 opacity-90" viewBox="0 0 120 32" fill="none" aria-hidden="true">
        <line x1="0" y1="16" x2="120" y2="16" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        <path d="M4 16 Q 22 2, 40 16 T 76 16 T 112 16" stroke="#0b864a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  phet: {
    gradient: 'from-blue-700/20 via-cyan-500/10 to-orange-500/15',
    accentHex: '#1E398B',
    preview: (
      <svg className="w-24 h-7 opacity-90" viewBox="0 0 100 32" fill="none" aria-hidden="true">
        <ellipse cx="50" cy="16" rx="22" ry="8" stroke="#EE7321" strokeWidth="1.8" transform="rotate(24 50 16)" />
        <ellipse cx="50" cy="16" rx="22" ry="8" stroke="#0284C7" strokeWidth="1.8" transform="rotate(-24 50 16)" />
        <circle cx="50" cy="16" r="3.5" fill="#EE7321" />
      </svg>
    ),
  },
  flashcards: {
    gradient: 'from-indigo-600/20 via-blue-500/10 to-purple-500/15',
    accentHex: '#4257B2',
    preview: (
      <div className="flex items-center gap-1">
        {['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-600', 'bg-indigo-500', 'bg-emerald-500'].map((c, idx) => (
          <span key={idx} className={`w-3 h-3 rounded-xs ${c} opacity-85`} />
        ))}
        <span className="ml-1 text-[10px] font-bold text-indigo-800 dark:text-indigo-200">SM-2</span>
      </div>
    ),
  },
  pomodoro: {
    gradient: 'from-rose-500/20 via-orange-500/10 to-red-500/15',
    accentHex: '#EF4444',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold">25:00</span>
        <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/35 text-rose-900 dark:text-rose-200 border border-rose-500/30">Lo-fi Rain</span>
      </div>
    ),
  },
  drive: {
    gradient: 'from-sky-500/20 via-emerald-500/10 to-amber-500/15',
    accentHex: '#2684FC',
    preview: (
      <div className="flex items-center gap-1 text-[10px] font-semibold">
        <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white">Docs</span>
        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">Sheets</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white">Slides</span>
      </div>
    ),
  },
  'notes-markdown': {
    gradient: 'from-blue-600/20 via-indigo-500/10 to-sky-500/15',
    accentHex: '#2563EB',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-blue-800 dark:text-blue-200 border border-blue-500/30">
          # Notes · $f(x)$
        </span>
      </div>
    ),
  },
  arxiv: {
    gradient: 'from-red-700/20 via-rose-500/10 to-stone-500/15',
    accentHex: '#B91C1C',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-red-700 text-white font-bold">PDF</span>
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-red-900 dark:text-red-200 border border-red-500/30">BibTeX</span>
      </div>
    ),
  },
  'open-library': {
    gradient: 'from-blue-800/20 via-amber-500/10 to-indigo-500/15',
    accentHex: '#1E40AF',
    preview: (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-2 py-0.5 rounded bg-blue-800 text-white font-bold">ISBN</span>
        <span className="px-2 py-0.5 rounded bg-white/80 dark:bg-black/35 text-blue-900 dark:text-blue-200 border border-blue-500/30">Borrow</span>
      </div>
    ),
  },
};

const STARTER_PACKS = [
  {
    id: 'stem',
    titleKey: 'store_pack_stem_t' as const,
    descKey: 'store_pack_stem_d' as const,
    gradient: 'from-emerald-500/15 to-blue-500/15 border-emerald-500/25',
    appIds: ['desmos-graphing', 'geogebra', 'phet', 'note-scanner'],
  },
  {
    id: 'crunch',
    titleKey: 'store_pack_crunch_t' as const,
    descKey: 'store_pack_crunch_d' as const,
    gradient: 'from-rose-500/15 to-amber-500/15 border-rose-500/25',
    appIds: ['flashcards', 'pomodoro', 'radar', 'tracker'],
  },
  {
    id: 'research',
    titleKey: 'store_pack_research_t' as const,
    descKey: 'store_pack_research_d' as const,
    gradient: 'from-teal-500/15 to-indigo-500/15 border-teal-500/25',
    appIds: ['note-scanner', 'lecture-studio', 'notes-markdown', 'arxiv', 'open-library'],
  },
] as const;

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

  const top8Highlights = useMemo(() => {
    try {
      const usageRaw = localStorage.getItem('scc_app_usage_v1');
      const usage: Record<string, number> = usageRaw ? JSON.parse(usageRaw) : {};
      const coursesRaw = localStorage.getItem('scc_canvas_courses_v1');
      const courses: string[] = coursesRaw ? JSON.parse(coursesRaw) : [];
      const mostUsed = Object.entries(usage)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => LEGACY_APP_MAP[id] || id)
        .filter((id) => VALID_APP_IDS.has(id))
        .slice(0, 4);
      const tokens = courses.join(' ').toLowerCase().split(/[^a-z]+/).filter(Boolean);
      const tokenSet = new Set(tokens);
      const has = (...keys: string[]) => keys.some((k) => tokenSet.has(k));
      const recommended: string[] = ['note-scanner'];
      if (has('math', 'calculus', 'algebra', 'physics', 'geometry', 'trigonometry')) recommended.push('desmos-graphing', 'geogebra');
      if (has('history', 'english', 'literature', 'writing', 'essay')) recommended.push('notes-markdown', 'drive', 'open-library');
      if (has('chemistry', 'chem', 'biology', 'bio', 'organic')) recommended.push('phet', 'arxiv');
      if (has('computer', 'cs', 'programming', 'code')) recommended.push('arxiv', 'notes-markdown');
      if (recommended.length <= 1) {
        try {
          const picks = JSON.parse(localStorage.getItem('scc_onboarding_picks') || '[]');
          if (Array.isArray(picks) && picks.length) {
            recommended.push(...picks.map((id: string) => LEGACY_APP_MAP[id] || id).filter((id: string) => VALID_APP_IDS.has(id)).slice(0, 2));
          }
        } catch {}
        if (recommended.length <= 1) recommended.push('flashcards', 'pomodoro');
      }
      const dynamicIds = [...new Set([...mostUsed, ...recommended, ...TOP_8_HIGHLIGHT_IDS])].slice(0, 8);
      const ids = dynamicIds.length >= 8 ? dynamicIds : [...new Set([...TOP_8_HIGHLIGHT_IDS, ...dynamicIds])].slice(0, 8);
      return ids.map((id) => APP_CATALOG.find((a) => a.id === id)!).filter(Boolean);
    } catch {
      return TOP_8_HIGHLIGHT_IDS.map((id) => APP_CATALOG.find((a) => a.id === id)!).filter(Boolean);
    }
  }, []);

  const categoryApps = useMemo(() => {
    if (selectedCategory === 'All Apps') return APP_CATALOG;
    return APP_CATALOG.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

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
        a.features.some((f) => f.toLowerCase().includes(q)) ||
        a.developer.toLowerCase().includes(q) ||
        (a.badge && a.badge.toLowerCase().includes(q))
    );
  }, [searchQuery, t]);

  if (!isOpen) return null;

  const spotlightApp = APP_CATALOG.find((a) => a.id === 'note-scanner') || APP_CATALOG[0];

  const handlePinPack = (appIds: readonly string[]) => {
    appIds.forEach((id) => {
      if (!pinnedAppIds.includes(id)) {
        onTogglePinApp(id);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden select-none animate-in fade-in duration-150">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('store_aria_dialog')}
        className="w-full h-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden outline-none"
      >
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-8 border-b border-[var(--border-hairline)] flex items-center justify-between gap-4 bg-[var(--bg-surface)]/80 backdrop-blur-xs shrink-0">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-fill)] to-amber-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs" aria-hidden="true">
                  <Sparkles className="w-4 h-4" />
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
          {viewingApp ? (
            /* VIEW 1: RICH APP DETAIL PAGE */
            <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 space-y-6 animate-in fade-in duration-150">
              <div
                className={`rounded-3xl border border-[var(--border-default)] overflow-hidden shadow-card bg-gradient-to-br ${
                  APP_VISUALS[viewingApp.id]?.gradient || 'from-[var(--accent-soft)] to-[var(--bg-surface)]'
                }`}
              >
                <div className="p-6 sm:p-8 bg-[var(--bg-surface)]/80 backdrop-blur-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5 min-w-0">
                    <AppLogo id={viewingApp.id} size="xl" />
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                          {t(viewingApp.nameKey)}
                        </h2>
                        {viewingApp.badgeKey && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]/50">
                            {t(viewingApp.badgeKey)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {viewingApp.developer} • {t(CATEGORY_KEY_MAP[viewingApp.category])}
                      </p>
                      <div className="pt-1">{APP_VISUALS[viewingApp.id]?.preview}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => onTogglePinApp(viewingApp.id)}
                      className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border min-h-[42px] ${
                        pinnedAppIds.includes(viewingApp.id)
                          ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border-[var(--status-ok-border)] hover:opacity-90'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-default)]'
                      }`}
                    >
                      {pinnedAppIds.includes(viewingApp.id) ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
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
              </div>

              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 sm:p-8 shadow-card space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    {t('store_about_app')}
                  </h3>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {t(viewingApp.overviewKey)}
                  </p>
                </div>

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
            /* VIEW 2: EXCITING STOREFRONT CATALOG */
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 space-y-8">
              {/* Mobile search input */}
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

              {/* Sticky Category Filter Pills */}
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
                          isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>

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
                <div className="space-y-10 animate-in fade-in duration-150">
                  {/* HERO SPOTLIGHT BANNER */}
                  <section className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-gradient-to-br from-teal-600/15 via-[var(--bg-surface)] to-cyan-500/15 shadow-card p-6 sm:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      <div className="lg:col-span-7 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-600 text-white shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{t('store_spotlight_badge')}</span>
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                            {t('store_spotlight_title')}
                          </h2>
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                            {t('store_spotlight_desc')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onLaunchApp(spotlightApp.id);
                              onClose();
                            }}
                            className="px-5 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                          >
                            <ScanText className="w-4 h-4" />
                            <span>{t('store_spotlight_cta')}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePinApp(spotlightApp.id)}
                            className="px-4 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {pinnedAppIds.includes(spotlightApp.id) ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)]" />
                                <span>{t('store_installed')}</span>
                              </>
                            ) : (
                              <>
                                <Pin className="w-4 h-4 text-[var(--accent-text)]" />
                                <span>{t('store_install_sidebar')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Visual Mockup Card inside Spotlight */}
                      <div className="lg:col-span-5">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/95 p-4 shadow-md space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                              <ScanText className="w-3.5 h-3.5" />
                              {t('store_app_scanner_n')}
                            </span>
                            <span>Markdown + KaTeX</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-dashed border-teal-500/40 flex flex-col justify-between min-h-[92px]">
                              <span className="text-[10px] font-semibold text-[var(--text-muted)]">{t('store_spotlight_mock_in')}</span>
                              <div className="font-serif italic text-xs text-[var(--text-primary)] leading-snug">
                                y' + 2y = e⁻ˣ
                                <br />
                                μ(x) = e²ˣ
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 flex flex-col justify-between min-h-[92px]">
                              <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">{t('store_spotlight_mock_out')}</span>
                              <div className="font-mono text-[10px] text-[var(--text-primary)] leading-snug">
                                ## ODE Solution
                                <br />
                                $y' + 2y = e^{'{-x}'}$
                                <br />• $\mu = e^{'{2x}'}$
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* CURATED STARTER PACKS */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--accent-text)]" />
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">
                          {t('store_packs_title')}
                        </h2>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">{t('store_packs_sub')}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {STARTER_PACKS.map((pack) => {
                        const allPinned = pack.appIds.every((id) => pinnedAppIds.includes(id));
                        return (
                          <div
                            key={pack.id}
                            className={`rounded-2xl border p-4 bg-gradient-to-br ${pack.gradient} flex flex-col justify-between gap-4`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center -space-x-1.5">
                                {pack.appIds.map((id) => (
                                  <div key={id} className="ring-2 ring-[var(--bg-canvas)] rounded-lg">
                                    <AppLogo id={id} size="sm" />
                                  </div>
                                ))}
                              </div>
                              <h3 className="text-xs font-extrabold text-[var(--text-primary)]">
                                {t(pack.titleKey)}
                              </h3>
                              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                {t(pack.descKey)}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={allPinned}
                              onClick={() => handlePinPack(pack.appIds)}
                              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                allPinned
                                  ? 'bg-[var(--bg-surface)]/80 text-[var(--status-ok-text)] border border-[var(--status-ok-border)]/40 cursor-default'
                                  : 'bg-[var(--bg-surface)] hover:bg-[var(--accent-fill)] hover:text-white text-[var(--text-primary)] border border-[var(--border-default)] shadow-2xs'
                              }`}
                            >
                              {allPinned ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{t('store_pack_added')}</span>
                                </>
                              ) : (
                                <>
                                  <Pin className="w-3.5 h-3.5" />
                                  <span>{t('store_pack_add_all')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* TOP 8 HIGHLIGHT SECTION */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
                          <Award className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-[var(--text-primary)]">
                              {t('store_top8_title')}
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] uppercase tracking-wider">
                              {t('store_featured')}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t('store_top8_sub')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {top8Highlights.map((app) => renderAppCard(app))}
                    </div>
                  </section>

                  {/* PLAN SECTION */}
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

                  {/* CREATE SECTION */}
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

                  {/* LEARN SECTION */}
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

                  {/* RESEARCH SECTION */}
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
    const visual = APP_VISUALS[app.id];

    return (
      <div
        key={app.id}
        style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '210px' } as any}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] hover:border-[var(--accent-border)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group flex flex-col justify-between"
      >
        <button
          type="button"
          onClick={() => setViewingApp(app)}
          className={`text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent-fill)] block w-full p-5 bg-gradient-to-br ${
            visual?.gradient || 'from-[var(--bg-subtle)]/60 to-[var(--bg-surface)]'
          } flex-1`}
        >
          <div className="flex items-center gap-4">
            <AppLogo id={app.id} size="xl" className="w-16 h-16 shrink-0 rounded-2xl ring-2 ring-[var(--bg-surface)] shadow-md" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t(CATEGORY_KEY_MAP[app.category])}
                </span>
                {app.badgeKey && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--bg-surface)]/90 text-[var(--text-primary)] border border-[var(--border-hairline)]">
                    {t(app.badgeKey)}
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate leading-tight tracking-tight">
                {t(app.nameKey)}
              </h3>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-[var(--text-muted)] line-clamp-2 leading-snug">
            {t(app.descKey)}
          </p>
        </button>

        {/* Open & Pin Controls */}
        <div className="px-4 py-2.5 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onTogglePinApp(app.id)}
            className={`text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
              isPinned
                ? 'bg-[var(--bg-subtle)] text-[var(--status-ok-text)] border-[var(--status-ok-border)]/40 hover:opacity-85'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isPinned ? (
              <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('store_installed')}</>
            ) : (
              <><Pin className="w-3.5 h-3.5" aria-hidden="true" /> {t('store_install')}</>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onLaunchApp(app.id);
              onClose();
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer min-w-[76px] min-h-[32px] ${
              isPinned
                ? 'bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white shadow-2xs'
                : 'bg-[var(--bg-subtle)] hover:bg-[var(--accent-fill)] text-[var(--text-primary)] hover:text-white border border-[var(--border-default)]'
            }`}
          >
            {isPinned ? t('store_open_btn') : t('store_get_btn')}
          </button>
        </div>
      </div>
    );
  }
};
