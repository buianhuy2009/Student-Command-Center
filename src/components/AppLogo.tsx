import React from 'react';
import {
  Layers,
  Compass,
  CheckSquare,
  BookOpen,
  PenTool,
  FileText,
  Timer,
  Sparkles,
  Bookmark,
  LayoutDashboard,
  ScanText,
  AudioLines,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface AppLogoProps {
  id: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ id, size = 'md', className = '' }) => {
  const { t } = useT();
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

  const tileBase = 'flex items-center justify-center shrink-0 border shadow-sm';
  const tileLight = 'bg-white border-[#E3DDCC]';
  const tileGradientBorder = 'border-black/10 shadow-sm';

  switch (id) {
    case 'drive':
    case 'google-drive':
      return (
        <div aria-label={t('logo_drive')} className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
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

    case 'gmail':
    case 'google-mail':
      return (
        <div aria-label={t('logo_gmail')} className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="4.5" width="20" height="15" rx="2.5" fill="#4285F4" />
            <path d="M2.8 6.2 12 13l9.2-6.8c-.2-.9-1-1.7-2-1.7H4.8c-1 0-1.8.8-2 1.7z" fill="#EA4335" />
            <path d="M2.8 6.2 12 13l9.2-6.8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 9.5v7.2l3.5 1.6V8.1l-3.5 1.4z" fill="#34A853" />
            <path d="M5.5 9.5v7.2L2 18.3V8.1l3.5 1.4z" fill="#188038" opacity=".8" />
          </svg>
        </div>
      );

    case 'classroom':
    case 'google-classroom':
      return (
        <div aria-label={t('logo_classroom')} className={`${sizeClasses} ${tileBase} bg-[#137333] border-[#0E5A28] ${className}`}>
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

    case 'canvas':
      return (
        <div aria-label={t('logo_canvas')} className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#E72429] to-[#C91A1E] text-white font-bold ${className}`}>
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

    case 'desmos-graphing':
      return (
        <div aria-label={t('logo_desmos')} className={`${sizeClasses} bg-[#0b864a] text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-700/20 shrink-0 ${className}`}>
          <span className="font-serif italic font-black text-lg lowercase select-none leading-none">d</span>
        </div>
      );

    case 'geogebra':
      return (
        <div aria-label={t('logo_geogebra')} className={`${sizeClasses} bg-gradient-to-br from-[#1565C0] to-[#0D47A1] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-600/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="8.5" ry="5.5" stroke="white" strokeWidth="1.8" fill="none" transform="rotate(-25 12 12)" />
            <circle cx="7" cy="8" r="2" fill="white" />
            <circle cx="16" cy="7" r="2" fill="white" />
            <circle cx="18" cy="14" r="2" fill="white" />
            <circle cx="11" cy="17" r="2" fill="white" />
          </svg>
        </div>
      );

    case 'phet':
      return (
        <div aria-label={t('logo_phet')} className={`${sizeClasses} bg-[#1E398B] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-900/20 shrink-0 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#EE7321" strokeWidth="1.8" transform="rotate(30 12 12)" />
            <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#4FC3F7" strokeWidth="1.8" transform="rotate(-30 12 12)" />
            <circle cx="12" cy="12" r="2.2" fill="#EE7321" />
          </svg>
        </div>
      );

    case 'flashcards':
      return (
        <div aria-label={t('logo_flashcards')} className={`${sizeClasses} bg-gradient-to-br from-[#4257B2] to-[#2E3E85] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-700/20 shrink-0 ${className}`}>
          <Layers className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'excalidraw':
      return (
        <div aria-label={t('logo_excalidraw')} className={`${sizeClasses} bg-gradient-to-br from-[#6965DB] to-[#5046E5] text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-500/20 shrink-0 ${className}`}>
          <PenTool className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'radar':
      return (
        <div aria-label={t('logo_radar')} className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#10B981] to-[#059669] text-white font-bold ${className}`}>
          <Compass className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'tracker':
      return (
        <div aria-label={t('logo_tracker')} className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#6366F1] to-[#4F46E5] text-white font-bold ${className}`}>
          <CheckSquare className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'pomodoro':
      return (
        <div aria-label={t('logo_pomodoro')} className={`${sizeClasses} ${tileBase} ${tileGradientBorder} bg-gradient-to-br from-[#EF4444] to-[#DC2626] text-white font-bold ${className}`}>
          <Timer className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'arxiv':
      return (
        <div aria-label={t('logo_arxiv')} className={`${sizeClasses} bg-gradient-to-br from-[#B91C1C] to-[#991B1B] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <BookOpen className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'open-library':
      return (
        <div aria-label={t('logo_open_library')} className={`${sizeClasses} bg-gradient-to-br from-[#1E40AF] to-[#1E3A8A] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Bookmark className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'notes-markdown':
      return (
        <div aria-label={t('logo_notes')} className={`${sizeClasses} bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <FileText className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'note-scanner':
      return (
        <div aria-label={t('logo_note_scanner')} className={`${sizeClasses} bg-gradient-to-br from-[#0D9488] to-[#0891B2] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <ScanText className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'lecture-studio':
      return (
        <div aria-label={t('logo_lecture_studio')} className={`${sizeClasses} bg-gradient-to-br from-[#6366F1] to-[#7C3AED] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <AudioLines className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'ai-suite':
      return (
        <div aria-label={t('logo_ai_suite')} className={`${sizeClasses} bg-gradient-to-br from-[#E11D48] to-[#9F1239] text-white flex items-center justify-center font-bold shadow-sm shrink-0 ${className}`}>
          <Sparkles className={iconSizes} aria-hidden="true" />
        </div>
      );

    case 'dashboard':
      return (
        <div aria-label={t('logo_dashboard')} className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#B85638] text-white flex items-center justify-center font-bold shadow-sm shadow-[#D97757]/20 shrink-0 ${className}`}>
          <LayoutDashboard className={iconSizes} aria-hidden="true" />
        </div>
      );

    default:
      return (
        <div aria-hidden="true" className={`${sizeClasses} bg-gradient-to-br from-[#D97757] to-[#C86646] text-white flex items-center justify-center font-bold shrink-0 ${className}`}>
          <Sparkles className={iconSizes} aria-hidden="true" />
        </div>
      );
  }
};

