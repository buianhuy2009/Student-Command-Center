import React from 'react';
import {
  Layers,
  Compass,
  CheckSquare,
  BookOpen,
  Palette,
  Calculator,
  PenTool,
  Network,
  FileText,
  Timer,
  Columns2,
  Sparkles,
  Atom,
  Mic,
  Search,
  Zap,
  Bookmark,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  ArrowRightLeft,
  Calendar,
  Quote,
  Award,
  Users,
  BarChart3,
  DollarSign,
  Briefcase,
  Moon,
  FlaskConical,
  Eye,
  Activity,
  Globe,
  Database,
  Puzzle,
  Code2,
  Brain,
  Trophy,
  LayoutDashboard,
  GraduationCap,
  History,
  FolderOpen,
  Presentation,
  ClipboardList,
} from 'lucide-react';

interface AppLogoProps {
  id: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ id, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-3xl',
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-10 h-10',
  }[size];

  // Cohesive icon system: identical shape + border + shadow for every app.
  // Brand tiles (Drive/Gmail/Python/Notion) stay crisp white in BOTH modes —
  // like iOS: authentic Google artwork never goes muddy-black on dark cards.
  // Gradient tiles keep brand color with the same border width + shadow so
  // everything reads as one set.
  const tileBase = 'flex items-center justify-center shrink-0 border shadow-sm';
  const tileLight = 'bg-white border-[#E3DDCC]';
  const tileGradientBorder = 'border-black/10 shadow-sm';

  switch (id) {
    // 1. Google Drive — official triangle on unified tile
    case 'drive':
    case 'google-drive':
      return (
        <div aria-label="Google Drive" className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 87.3 78" aria-hidden="true">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
            <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.4z" fill="#00AC47" />
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l9.25-16c.8-1.4 1.2-2.95 1.2-4.5H59.9l13.65 23.8z" fill="#EA4335" />
            <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2z" fill="#00832D" />
            <path d="M59.9 53H27.45L13.7 76.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.4 4.5-1.2z" fill="#2684FC" />
            <path d="M73.4 26.5L60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.25 28h27.4c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
          </svg>
        </div>
      );

    // 2. Gmail — bold flat envelope, readable at 16px (brand colors, no muddy overlaps)
    case 'gmail':
    case 'google-mail':
      return (
        <div aria-label="Gmail" className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="4.5" width="20" height="15" rx="2.5" fill="#4285F4" />
            <path d="M2.8 6.2 12 13l9.2-6.8c-.2-.9-1-1.7-2-1.7H4.8c-1 0-1.8.8-2 1.7z" fill="#EA4335" />
            <path d="M2.8 6.2 12 13l9.2-6.8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 9.5v7.2l3.5 1.6V8.1l-3.5 1.4z" fill="#34A853" />
            <path d="M5.5 9.5v7.2L2 18.3V8.1l3.5 1.4z" fill="#188038" opacity=".8" />
          </svg>
        </div>
      );

    // 3. Google Classroom — green chalkboard, same tile size (no outer padding hack)
    case 'classroom':
    case 'google-classroom':
      return (
        <div aria-label="Google Classroom" className={`${sizeClasses} ${tileBase} bg-[#137333] border-[#0E5A28] ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8.5" r="2.2" fill="#FFFFFF" />
            <path d="M8 15c0-2.2 1.8-4 4-4s4 1.8 4 4H8z" fill="#FFFFFF" />
            <circle cx="6.5" cy="9.5" r="1.5" fill="#F9AB00" />
            <path d="M3.8 15c0-1.5 1.2-2.7 2.7-2.7.7 0 1.3.3 1.8.7-.6.6-.9 1.3-.9 2H3.8z" fill="#F9AB00" />
            <circle cx="17.5" cy="9.5" r="1.5" fill="#F9AB00" />
            <path d="M20.2 15c0-1.5-1.2-2.7-2.7-2.7-.7 0-1.3.3-1.8.7.6.6.9 1.3.9 2h3.6z" fill="#F9AB00" />
          </svg>
        </div>
      );

    // 4. Instructure Canvas LMS — Authentic Circular Asterism Flower
    case 'canvas':
      return (
        <div aria-label="Canvas LMS" className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#E72429] to-[#C91A1E] text-white font-bold ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="3.5" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="20.5" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="12" cy="20.5" r="2" />
            <circle cx="6" cy="18" r="2" />
            <circle cx="3.5" cy="12" r="2" />
            <circle cx="6" cy="6" r="2" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </div>
      );

    // 5. Moodle LMS — Authentic Orange Mortarboard Cap + 'm'
    case 'moodle':
      return (
        <div aria-label="Moodle LMS" className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#F98012] to-[#E06000] text-white flex-col font-bold relative ${className}`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
            <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" opacity="0.8" />
          </svg>
          <span className="font-extrabold text-[10px] leading-none mt-0.5 tracking-tighter">m</span>
        </div>
      );

    // 6. Google NotebookLM — Stylized Dark Notebook + Gemini Star
    case 'notebooklm':
      return (
        <div aria-label="Google NotebookLM" className={`${sizeClasses} bg-gradient-to-br from-[#1E1B2E] via-[#2A2542] to-[#161426] border border-violet-500/30 text-white flex items-center justify-center font-bold shadow-sm shadow-violet-500/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="#A78BFA" strokeWidth="1.8" />
            <line x1="8" y1="3" x2="8" y2="21" stroke="#A78BFA" strokeWidth="1.5" strokeDasharray="2 2" />
            <path d="M14 7l.9 2.1L17 10l-2.1.9L14 13l-.9-2.1L11 10l2.1-.9L14 7z" fill="#F472B6" />
          </svg>
        </div>
      );

    // 7. Canva — Authentic Turquoise Gradient with script 'C'
    case 'canva':
      return (
        <div aria-label="Canva" className={`${sizeClasses} bg-gradient-to-br from-[#00C4CC] via-[#5C52E5] to-[#7D2AE8] text-white flex items-center justify-center font-bold shadow-sm shadow-cyan-500/20 shrink-0 ${className}`}>
          <span className="font-serif italic font-black text-lg select-none leading-none">C</span>
        </div>
      );

    // 8. Desmos 2D Graphing — Authentic Desmos Green with 'd'
    case 'desmos-graphing':
      return (
        <div aria-label="Desmos Graphing" className={`${sizeClasses} bg-[#0b864a] text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-700/20 shrink-0 ${className}`}>
          <span className="font-serif italic font-black text-lg lowercase select-none leading-none">d</span>
        </div>
      );

    // 9. Desmos Scientific Calculator
    case 'desmos-scientific':
      return (
        <div aria-label="Desmos Scientific" className={`${sizeClasses} bg-gradient-to-br from-[#1B5E20] to-[#004D40] text-white flex items-center justify-center font-bold shadow-sm shadow-teal-900/20 shrink-0 ${className}`}>
          <Calculator className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 10. Wolfram Alpha & Symbolab — Authentic Wolfram Red Star
    case 'wolfram':
    case 'wolfram-symbolab':
      return (
        <div aria-label="Wolfram Alpha" className={`${sizeClasses} bg-gradient-to-br from-[#DD1100] to-[#B30000] text-white flex items-center justify-center font-bold shadow-sm shadow-red-600/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 2z" />
            <circle cx="12" cy="12" r="3.2" fill="#FFE57F" />
          </svg>
        </div>
      );

    // 11. GeoGebra Math Suite — Authentic 5-Circle Orbit
    case 'geogebra':
      return (
        <div aria-label="GeoGebra" className={`${sizeClasses} bg-gradient-to-br from-[#1565C0] to-[#0D47A1] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-600/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="8.5" ry="5.5" stroke="white" strokeWidth="1.8" fill="none" transform="rotate(-25 12 12)" />
            <circle cx="7" cy="8" r="2" fill="white" />
            <circle cx="16" cy="7" r="2" fill="white" />
            <circle cx="18" cy="14" r="2" fill="white" />
            <circle cx="11" cy="17" r="2" fill="white" />
          </svg>
        </div>
      );

    // 12. PhET Interactive Simulations — Authentic Atom Orbit
    case 'phet':
      return (
        <div aria-label="PhET" className={`${sizeClasses} bg-[#1E398B] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-900/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#EE7321" strokeWidth="1.8" transform="rotate(30 12 12)" />
            <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#4FC3F7" strokeWidth="1.8" transform="rotate(-30 12 12)" />
            <circle cx="12" cy="12" r="2.2" fill="#EE7321" />
          </svg>
        </div>
      );

    // 13. Python Code Runner — Authentic Blue & Yellow Interlocking Snakes
    case 'code-runner':
    case 'python':
      return (
        <div aria-label="Python Code Runner" className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11.9 2c-3.1 0-2.9 1.3-2.9 1.3l.01 1.4h2.9v.4H4.7S2 4.8 2 7.9c0 3.2 2.4 3.1 2.4 3.1h1.4V9.6c0-1.6 1.4-1.6 1.4-1.6h5c1.5 0 1.4-1.4 1.4-1.4V3.4S14.1 2 11.9 2zm-1.6 1a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z" fill="#3776AB" />
            <path d="M12.1 22c3.1 0 2.9-1.3 2.9-1.3l-.01-1.4h-2.9v-.4h7.2s2.7.3 2.7-2.8c0-3.2-2.4-3.1-2.4-3.1h-1.4v1.4c0 1.6-1.4 1.6-1.4 1.6h-5c-1.5 0-1.4 1.4-1.4 1.4v3.2s-.5 1.4 1.7 1.4zm1.6-1a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z" fill="#FFD43B" />
          </svg>
        </div>
      );

    // 14. Notion Import — Authentic Notion Cube & 'N'
    case 'notion-import':
    case 'notion':
      return (
        <div aria-label="Notion" className={`${sizeClasses} ${tileBase} ${tileLight} text-black dark:text-white font-bold ${className}`}>
          <span className="font-serif font-black text-sm tracking-tighter select-none">N</span>
        </div>
      );

    // 15. Quizlet & Anki Flashcards
    case 'flashcards':
    case 'quizlet':
      return (
        <div aria-label="Quizlet" className={`${sizeClasses} bg-gradient-to-br from-[#4257B2] to-[#2E3E85] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-700/20 shrink-0 ${className}`}>
          <span className="font-sans font-black text-base tracking-tight select-none">Q</span>
        </div>
      );

    case 'anki':
      return (
        <div aria-label="Anki" className={`${sizeClasses} bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Layers className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 16. Excalidraw Whiteboard
    case 'excalidraw':
      return (
        <div aria-label="Excalidraw" className={`${sizeClasses} bg-gradient-to-br from-[#6965DB] to-[#5046E5] text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-500/20 shrink-0 ${className}`}>
          <PenTool className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 17. Mermaid Flowcharts
    case 'mermaid':
      return (
        <div aria-label="Mermaid" className={`${sizeClasses} bg-gradient-to-br from-[#EC4899] to-[#BE185D] text-white flex items-center justify-center font-bold shadow-sm shadow-pink-500/20 shrink-0 ${className}`}>
          <Network className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 18. Daily Schedule & Radar
    case 'radar':
      return (
        <div aria-label="Daily Schedule" className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#10B981] to-[#059669] text-white font-bold ${className}`}>
          <Compass className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 19. Assignment Tracker
    case 'tracker':
      return (
        <div aria-label="Assignment Tracker" className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#6366F1] to-[#4F46E5] text-white font-bold ${className}`}>
          <CheckSquare className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 20. Weekly Timetable
    case 'timetable':
    case 'timetable-optimizer':
      return (
        <div aria-label="Weekly Timetable" className={`${sizeClasses} bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] text-white flex items-center justify-center font-bold shadow-sm shadow-sky-500/20 shrink-0 ${className}`}>
          <Calendar className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 21. Citation Vault
    case 'citation-vault':
    case 'zotero-import':
    case 'zotero':
    case 'scholar':
    case 'google-scholar':
      return (
        <div aria-label="Citation Vault" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#B85638] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Quote className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 22. Scholarship Tracker
    case 'scholarship-tracker':
    case 'internship-tracker':
      return (
        <div aria-label="Scholarship Tracker" className={`${sizeClasses} bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/20 shrink-0 ${className}`}>
          <Award className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 23. Group Project Hub
    case 'group-project':
      return (
        <div aria-label="Group Project Hub" className={`${sizeClasses} bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center font-bold shadow-sm shadow-purple-500/20 shrink-0 ${className}`}>
          <Users className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 24. Peer Q&A
    case 'peer-qa':
      return (
        <div aria-label="Peer Q&A" className={`${sizeClasses} bg-gradient-to-br from-[#14B8A6] to-[#0F766E] text-white flex items-center justify-center font-bold shadow-sm shadow-teal-500/20 shrink-0 ${className}`}>
          <MessageSquare className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 25. Deadline Gantt
    case 'deadline-gantt':
      return (
        <div aria-label="Deadline Gantt" className={`${sizeClasses} bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20 shrink-0 ${className}`}>
          <BarChart3 className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 25b. AI Planner — study timetable
    case 'ai-planner':
      return (
        <div aria-label="AI Planner" className={`${sizeClasses} bg-gradient-to-br from-[#8B5CF6] to-[#4C1D95] text-white flex items-center justify-center font-bold shadow-sm shadow-violet-500/20 shrink-0 ${className}`}>
          <Sparkles className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 26. Grade Forecaster
    case 'grade-forecaster':
      return (
        <div aria-label="Grade Forecaster" className={`${sizeClasses} bg-gradient-to-br from-[#10B981] to-[#047857] text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-500/20 shrink-0 ${className}`}>
          <TrendingUp className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 27. Budget Tracker
    case 'budget-tracker':
      return (
        <div aria-label="Budget Tracker" className={`${sizeClasses} bg-gradient-to-br from-[#059669] to-[#065F46] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <DollarSign className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 28. Resume Builder
    case 'resume-builder':
      return (
        <div aria-label="Resume Builder" className={`${sizeClasses} bg-gradient-to-br from-[#475569] to-[#334155] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Briefcase className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 29. Pomodoro Focus Station
    case 'pomodoro':
      return (
        <div aria-label="Pomodoro Focus" className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#EF4444] to-[#DC2626] text-white font-bold ${className}`}>
          <Timer className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 30. Photo Math OCR
    case 'scribble-latex':
      return (
        <div aria-label="Photo Math OCR" className={`${sizeClasses} bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Zap className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 31. Periodic Table
    case 'periodic-table':
      return (
        <div aria-label="Periodic Table" className={`${sizeClasses} bg-gradient-to-br from-[#06B6D4] to-[#0891B2] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Atom className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 32. Scientific Unit Converter
    case 'unit-converter':
      return (
        <div aria-label="Unit Converter" className={`${sizeClasses} bg-gradient-to-br from-[#10B981] to-[#0D9488] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <ArrowRightLeft className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 33. arXiv Papers
    case 'arxiv':
      return (
        <div aria-label="arXiv Papers" className={`${sizeClasses} bg-gradient-to-br from-[#B91C1C] to-[#991B1B] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <BookOpen className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 34. Open Library
    case 'open-library':
      return (
        <div aria-label="Open Library" className={`${sizeClasses} bg-gradient-to-br from-[#1E40AF] to-[#1E3A8A] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Bookmark className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 35. Dual Split Screen
    case 'splitscreen':
      return (
        <div aria-label="Split Screen" className={`${sizeClasses} bg-gradient-to-br from-[#475569] to-[#1E293B] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Columns2 className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 36. Viva Exam Practice
    case 'viva':
    case 'viva-voice':
      return (
        <div aria-label="Viva Exam" className={`${sizeClasses} bg-gradient-to-br from-[#D946EF] to-[#A21CAF] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Mic className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 37. Markdown Notes
    case 'notes-markdown':
    case 'essay-outliner':
      return (
        <div aria-label="Markdown Notes" className={`${sizeClasses} bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FileText className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 38. Rubric Checker
    case 'rubric':
    case 'turnitin':
    case 'gradescope':
      return (
        <div aria-label="Rubric Checker" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#9A3412] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <ShieldCheck className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 39. Feynman & AI Academic Suite
    case 'feynman':
    case 'ai-suite':
      return (
        <div aria-label="Feynman AI" className={`${sizeClasses} bg-gradient-to-br from-[#E11D48] to-[#9F1239] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Sparkles className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 40. PDF Reader
    case 'pdf-reader':
      return (
        <div aria-label="PDF Reader" className={`${sizeClasses} bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FileText className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 41. Quiz Generator
    case 'quiz-generator':
      return (
        <div aria-label="Quiz Generator" className={`${sizeClasses} bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <CheckSquare className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 42. Habit & Sleep
    case 'habit-sleep':
      return (
        <div aria-label="Habit & Sleep" className={`${sizeClasses} bg-gradient-to-br from-[#312E81] to-[#1E1B4B] text-indigo-200 flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Moon className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 43. Lab Report
    case 'lab-report':
      return (
        <div aria-label="Lab Report" className={`${sizeClasses} bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FlaskConical className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 44. Image Occlusion
    case 'image-occlusion':
      return (
        <div aria-label="Image Occlusion" className={`${sizeClasses} bg-gradient-to-br from-[#64748B] to-[#334155] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Eye className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 45. FSRS Scheduler
    case 'fsrs':
      return (
        <div aria-label="FSRS Algorithm" className={`${sizeClasses} bg-gradient-to-br from-[#0D9488] to-[#115E59] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Activity className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 46. Language Lab
    case 'language-lab':
      return (
        <div aria-label="Language Lab" className={`${sizeClasses} bg-gradient-to-br from-[#2563EB] to-[#1E40AF] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Globe className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 47. Dataset Finder
    case 'dataset-finder':
      return (
        <div aria-label="Dataset Finder" className={`${sizeClasses} bg-gradient-to-br from-[#4F46E5] to-[#3730A3] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Database className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 48. Extension Helper
    case 'extension':
      return (
        <div aria-label="Extension" className={`${sizeClasses} bg-gradient-to-br from-[#EA580C] to-[#C2410C] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Puzzle className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 49. API Docs
    case 'api-docs':
      return (
        <div aria-label="API Docs" className={`${sizeClasses} bg-gradient-to-br from-[#334155] to-[#1E293B] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Code2 className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 50. Dashboard Home — distinct glyph so it never duplicates the fallback
    case 'dashboard':
      return (
        <div aria-label="Dashboard Home" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#B85638] text-white flex items-center justify-center font-bold shadow-sm shadow-[#D97757]/20 shrink-0 ${className}`}>
          <LayoutDashboard className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 51. Workspace groups (routable via sidebar Recent)
    case 'stem':
      return (
        <div aria-label="STEM Lab" className={`${sizeClasses} bg-gradient-to-br from-[#10B981] to-[#047857] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Atom className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'creation':
      return (
        <div aria-label="Creation Studio" className={`${sizeClasses} bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Palette className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'retention':
      return (
        <div aria-label="Retention Vault" className={`${sizeClasses} bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <History className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'documents':
      return (
        <div aria-label="Documents" className={`${sizeClasses} bg-gradient-to-br from-[#0284C7] to-[#075985] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FolderOpen className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 52. Division A labs — each gets a unique glyph (previously all fell into the identical fallback)
    case 'model-training':
      return (
        <div aria-label="Train My Model Lab" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#7C3AED] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Brain className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'few-shot-lab':
      return (
        <div aria-label="Few-Shot Calibration Lab" className={`${sizeClasses} bg-gradient-to-br from-[#06B6D4] to-[#0E7490] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FlaskConical className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'competition-dossier':
      return (
        <div aria-label="Competition Dossier" className={`${sizeClasses} bg-gradient-to-br from-[#EAB308] to-[#A16207] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Trophy className={iconSizes} aria-hidden="true" />
        </div>
      );

    // 53. Remaining routable apps
    case 'paper-chat':
      return (
        <div aria-label="Paper Chat" className={`${sizeClasses} bg-gradient-to-br from-[#2563EB] to-[#1E40AF] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <MessageSquare className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'study-rooms':
      return (
        <div aria-label="Study Rooms" className={`${sizeClasses} bg-gradient-to-br from-[#10B981] to-[#065F46] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Users className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'teacher-view':
      return (
        <div aria-label="Teacher View" className={`${sizeClasses} bg-gradient-to-br from-[#F43F5E] to-[#BE123C] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <GraduationCap className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'lecture-copilot':
      return (
        <div aria-label="Lecture Copilot" className={`${sizeClasses} bg-gradient-to-br from-[#0EA5E9] to-[#1D4ED8] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Presentation className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'presentation-coach':
      return (
        <div aria-label="Presentation Coach" className={`${sizeClasses} bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <ClipboardList className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'exam-mode':
      return (
        <div aria-label="Exam Mode" className={`${sizeClasses} bg-gradient-to-br from-[#6366F1] to-[#4338CA] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Timer className={iconSizes} aria-hidden="true" />
        </div>
      );

    // Fallback Default
    default:
      return (
        <div aria-hidden="true" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#C86646] text-white flex items-center justify-center font-bold shrink-0 ${className}`}>
          <Sparkles className={iconSizes} aria-hidden="true" />
        </div>
      );
  }
};
