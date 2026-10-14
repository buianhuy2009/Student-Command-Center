import React, { useState } from 'react';
import { MessageCircle, X, ExternalLink } from 'lucide-react';

export const FeedbackWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle help and feedback menu"
        aria-expanded={open}
        className="fixed bottom-4 left-4 z-40 p-3 rounded-2xl bg-[#D97757] hover:bg-[#C86646] text-white shadow-lg flex items-center gap-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2"
      >
        <MessageCircle className="w-4 h-4" /> Help & Feedback
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Feedback" className="fixed bottom-16 left-4 z-40 w-80 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">We love feedback</h4>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close feedback menu"
              className="p-1 hover:bg-[#FAF9F5] dark:hover:bg-[#252422] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#6B6860]">Report bugs, request features, or share your setup.</p>
          <div className="space-y-2">
            <a
              href="https://github.com/buianhuy2009/Sutdent-Command-Center/issues/new"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] text-xs font-bold hover:border-[#D97757] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]"
            >
              GitHub Issue <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://tally.so"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] text-xs font-bold hover:border-[#D97757] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]"
            >
              Tally Feedback Form <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://twitter.com/intent/tweet?text=Check%20out%20Student%20Command%20Center%20—%20my%20unified%20academic%20OS%20https://student-command-center.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center p-2.5 rounded-xl bg-[#D97757] text-white text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] focus-visible:ring-offset-2"
            >
              Share your setup on X
            </a>
          </div>
        </div>
      )}
    </>
  );
};
