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
            <path d="M2 6.8V18.5C2 19.3 2.7 20 3.5 20H6.5V11.8L2 8.4V6.8Z" fill="#4285F4" />
            <path d="M22 6.8V18.5C22 19.3 21.3 20 20.5 20H17.5V11.8L22 8.4V6.8Z" fill="#34A853" />
            <path d="M17.5 11.8V6.3L20.1 4.4C21.1 3.7 22 4.4 22 5.7V8.4L17.5 11.8Z" fill="#FBBC04" />
            <path d="M6.5 11.8V6.3L12 10.4L17.5 6.3V11.8L12 15.9L6.5 11.8Z" fill="#EA4335" />
            <path d="M2 8.4V5.7C2 4.4 2.9 3.7 3.9 4.4L6.5 6.3V11.8L2 8.4Z" fill="#C5221F" />
          </svg>
        </div>
      );

    case 'classroom':
    case 'google-classroom':
      return (
        <div aria-label={t('logo_classroom')} className={`${sizeClasses} ${tileBase} bg-[#0F9D58] border-[#F4B400] border-2 ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8.5" r="2.3" fill="#FFFFFF" />
            <path d="M7.8 15.5c0-2.3 1.9-4.1 4.2-4.1s4.2 1.8 4.2 4.1H7.8z" fill="#FFFFFF" />
            <circle cx="6.2" cy="9.7" r="1.5" fill="#FCE8B2" />
            <path d="M3.5 15.5c0-1.5 1.2-2.7 2.7-2.7.7 0 1.4.3 1.9.8-.6.6-.9 1.2-.9 1.9H3.5z" fill="#FCE8B2" />
            <circle cx="17.8" cy="9.7" r="1.5" fill="#FCE8B2" />
            <path d="M20.5 15.5c0-1.5-1.2-2.7-2.7-2.7-.7 0-1.4.3-1.9.8.6.6.9 1.2.9 1.9h3.7z" fill="#FCE8B2" />
            <rect x="14.5" y="17.5" width="5" height="1.4" rx="0.7" fill="#FFFFFF" opacity="0.9" />
          </svg>
        </div>
      );

    case 'canvas':
      return (
        <div aria-label={t('logo_canvas')} className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="#E13F2B" aria-hidden="true">
            <circle cx="12" cy="3.2" r="2.1" />
            <circle cx="18.2" cy="5.8" r="2.1" />
            <circle cx="20.8" cy="12" r="2.1" />
            <circle cx="18.2" cy="18.2" r="2.1" />
            <circle cx="12" cy="20.8" r="2.1" />
            <circle cx="5.8" cy="18.2" r="2.1" />
            <circle cx="3.2" cy="12" r="2.1" />
            <circle cx="5.8" cy="5.8" r="2.1" />
            <circle cx="12" cy="7.3" r="1.15" />
            <circle cx="15.3" cy="8.7" r="1.15" />
            <circle cx="16.7" cy="12" r="1.15" />
            <circle cx="15.3" cy="15.3" r="1.15" />
            <circle cx="12" cy="16.7" r="1.15" />
            <circle cx="8.7" cy="15.3" r="1.15" />
            <circle cx="7.3" cy="12" r="1.15" />
            <circle cx="8.7" cy="8.7" r="1.15" />
          </svg>
        </div>
      );

    case 'desmos-graphing':
      return (
        <div aria-label={t('logo_desmos')} className={`${sizeClasses} ${tileBase} bg-[#117A37] border-[#0C5E29] text-white ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3.5 16.5C6.5 16.5 7.5 6.5 12 6.5C16.5 6.5 17.5 16.5 20.5 16.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M3 18.5H21" stroke="#A7F3D0" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
            <circle cx="12" cy="6.5" r="2.1" fill="#A7F3D0" />
          </svg>
        </div>
      );

    case 'geogebra':
      return (
        <div aria-label={t('logo_geogebra')} className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="8.6" ry="5.6" stroke="#666666" strokeWidth="1.7" transform="rotate(-24 12 12)" />
            <circle cx="10.2" cy="6.8" r="2.2" fill="#9999FF" stroke="#333333" strokeWidth="1.1" />
            <circle cx="18.2" cy="7.4" r="2.2" fill="#9999FF" stroke="#333333" strokeWidth="1.1" />
            <circle cx="18.5" cy="13.6" r="2.2" fill="#9999FF" stroke="#333333" strokeWidth="1.1" />
            <circle cx="11.4" cy="17.6" r="2.2" fill="#9999FF" stroke="#333333" strokeWidth="1.1" />
            <circle cx="4.8" cy="14.2" r="2.2" fill="#9999FF" stroke="#333333" strokeWidth="1.1" />
          </svg>
        </div>
      );

    case 'phet':
      return (
        <div aria-label={t('logo_phet')} className={`${sizeClasses} ${tileBase} bg-[#003366] border-[#002244] ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="#00AEEF" strokeWidth="1.8" transform="rotate(28 12 12)" />
            <ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="#FFD100" strokeWidth="1.8" transform="rotate(-28 12 12)" />
            <ellipse cx="12" cy="12" rx="3.8" ry="9" stroke="#F26522" strokeWidth="1.5" opacity="0.85" />
            <circle cx="12" cy="12" r="2.4" fill="#F26522" />
          </svg>
        </div>
      );

    case 'flashcards':
      return (
        <div aria-label={t('logo_flashcards')} className={`${sizeClasses} bg-gradient-to-br from-[#4257B2] to-[#2E3E85] text-white flex items-center justify-center font-bold shadow-sm shadow-blue-700/20 shrink-0 ${className}`}>
          <Layers className={iconSizes} aria-hidden="true" />
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
        <div aria-label={t('logo_arxiv')} className={`${sizeClasses} ${tileBase} ${tileLight} ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5.5 4.5L18.5 19.5" stroke="#999999" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M18.5 4.5L5.5 19.5" stroke="#B31B1B" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.2" fill="#B31B1B" />
          </svg>
        </div>
      );

    case 'open-library':
      return (
        <div aria-label={t('logo_open_library')} className={`${sizeClasses} ${tileBase} bg-[#FAF7EE] border-[#D8D0BE] ${className}`}>
          <svg className={iconSizes} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3.5 6.5C6.5 5.2 9.5 5.6 12 7.4V19C9.5 17.5 6.5 17.2 3.5 18.4V6.5Z" fill="#0376B8" />
            <path d="M20.5 6.5C17.5 5.2 14.5 5.6 12 7.4V19C14.5 17.5 17.5 17.2 20.5 18.4V6.5Z" fill="#3B9CD3" />
            <path d="M12 7.4V19" stroke="#FAF7EE" strokeWidth="1.4" />
          </svg>
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

