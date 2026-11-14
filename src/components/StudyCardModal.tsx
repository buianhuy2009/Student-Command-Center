import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Share2,
  Check,
  Trophy,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface StudyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  focusMinutes?: number;
  completedTasksCount?: number;
  streakDays?: number;
  topSubject?: string;
}

export const StudyCardModal: React.FC<StudyCardModalProps> = ({
  isOpen,
  onClose,
  userName,
  focusMinutes = 320,
  completedTasksCount = 12,
  streakDays = 5,
  topSubject,
}) => {
  const { t, formatDate } = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const displayName = userName || t('studycard_default_user');
  const displaySubject = topSubject || t('studycard_default_subject');

  const handleShareLink = async () => {
    const showCopiedFeedback = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const href = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
        showCopiedFeedback();
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = href;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) showCopiedFeedback();
      } catch {
        // silent degrade: clipboard unavailable
      }
    }
  };

  const handleDownloadSvg = () => {
    const svgElement = cardRef.current?.querySelector('svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `StudentOS-StudyCard-${displayName.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-md rounded-3xl border border-[var(--border-default)] shadow-2xl p-6 space-y-5 flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)]">{t('studycard_title')}</h3>
              <p className="text-[10px] text-[var(--text-muted)]">{t('studycard_sub')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Card Canvas / SVG Container */}
        <div ref={cardRef} className="flex justify-center">
          <svg
            width="360"
            height="220"
            viewBox="0 0 360 220"
            className="rounded-2xl shadow-lg border border-[var(--border-default)]"
          >
            <defs>
              <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E1D1A" />
                <stop offset="100%" stopColor="#121110" />
              </linearGradient>
              <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D97757" />
                <stop offset="100%" stopColor="#E28B6E" />
              </linearGradient>
            </defs>

            {/* Card Background */}
            <rect width="360" height="220" rx="16" fill="url(#cardGrad)" />
            
            {/* Header / Brand */}
            <rect x="20" y="20" width="8" height="8" rx="2" fill="url(#accentGrad)" />
            <text x="36" y="28" fill="#FAF9F5" fontSize="11" fontWeight="bold" fontFamily="sans-serif">{t('studycard_svg_header')}</text>
            <text x="340" y="28" fill="#8C897F" fontSize="10" fontFamily="sans-serif" textAnchor="end">{formatDate(new Date())}</text>

            {/* User Name */}
            <text x="20" y="65" fill="#FAF9F5" fontSize="18" fontWeight="bold" fontFamily="sans-serif">{displayName}</text>
            <text x="20" y="82" fill="#8C897F" fontSize="10" fontFamily="sans-serif">{t('studycard_focus_domain', { subject: displaySubject })}</text>

            {/* Metrics Grid Boxes */}
            {/* Box 1: Focus Minutes */}
            <rect x="20" y="105" width="96" height="60" rx="10" fill="#252422" stroke="#33322E" strokeWidth="1" />
            <text x="28" y="123" fill="#8C897F" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{t('studycard_deep_work')}</text>
            <text x="28" y="148" fill="#FAF9F5" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{t('studycard_minutes_short', { mins: focusMinutes })}</text>

            {/* Box 2: Tasks Done */}
            <rect x="132" y="105" width="96" height="60" rx="10" fill="#252422" stroke="#33322E" strokeWidth="1" />
            <text x="140" y="123" fill="#8C897F" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{t('studycard_tasks_done')}</text>
            <text x="140" y="148" fill="#FAF9F5" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{completedTasksCount}</text>

            {/* Box 3: Streak */}
            <rect x="244" y="105" width="96" height="60" rx="10" fill="#252422" stroke="#33322E" strokeWidth="1" />
            <text x="252" y="123" fill="#8C897F" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{t('studycard_day_streak')}</text>
            <text x="252" y="148" fill="#D97757" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{t('studycard_days_count', { days: streakDays })}</text>

            {/* Card Footer */}
            <text x="20" y="195" fill="#5C5A54" fontSize="9" fontFamily="sans-serif">{t('studycard_footer')}</text>
            <text x="340" y="195" fill="#D97757" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="end">student-os.app</text>
          </svg>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownloadSvg}
            className="px-4 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('studycard_download')}</span>
          </button>

          <button
            onClick={handleShareLink}
            className="px-4 py-2.5 bg-[#FAF9F5] dark:bg-[#252422] border border-[var(--border-default)] hover:border-[#D97757] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? t('studycard_copied') : t('studycard_share')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
