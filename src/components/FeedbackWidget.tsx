import React, { useState } from 'react';
import { MessageCircle, X, ExternalLink } from 'lucide-react';
import { useT } from '../services/i18n';

export const FeedbackWidget: React.FC = () => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={()=>setOpen(v=>!v)} className="fixed bottom-4 left-4 z-40 p-3 rounded-2xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white shadow-lg flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer">
        <MessageCircle className="w-4 h-4" /> {t('feedback_btn')}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t('feedback_dialog_aria')} className="fixed bottom-16 left-4 z-40 w-80 bg-[var(--bg-raised)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-default)] shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('feedback_title')}</h4>
            <button onClick={()=>setOpen(false)} aria-label={t('feedback_close_aria')} className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{t('feedback_desc')}</p>
          <div className="space-y-2">
            <a href="https://github.com/buianhuy2009/Sutdent-Command-Center/issues/new" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-xs font-bold text-[var(--text-primary)] transition-colors">{t('feedback_github')} <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" /></a>
            <a href="https://tally.so" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-xs font-bold text-[var(--text-primary)] transition-colors">{t('feedback_tally')} <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" /></a>
            <a href="https://twitter.com/intent/tweet?text=Check%20out%20Student%20Command%20Center%20—%20my%20unified%20academic%20OS%20https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer" className="w-full flex items-center justify-center p-2.5 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-colors">{t('feedback_share_x')}</a>
          </div>
        </div>
      )}
    </>
  );
};
