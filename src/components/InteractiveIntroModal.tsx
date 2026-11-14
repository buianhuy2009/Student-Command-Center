import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, MapPin, MousePointerClick } from 'lucide-react';
import { useLang } from '../services/i18n';

interface TourStop {
  id: string;
  tag: { en: string; vi: string };
  title: { en: string; vi: string };
  body: { en: string; vi: string };
  /** Navigate to this tab when the stop activates (Next/Back/jump auto-move). */
  tab?: string;
  /** Anchor candidates in priority order — first visible match wins. */
  selectors: string[];
  /** Optional "Try it" action: finishes the tour, then opens the real UI. */
  tryIt?: 'search' | 'sync' | 'coach';
  tryItLabel?: { en: string; vi: string };
  tip?: 'SHORTCUT_TIP';
}

function isMac(): boolean {
  try {
    const uaData = (navigator as any).userAgentData;
    const platform = uaData?.platform || (navigator as any).platform || navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/.test(platform);
  } catch { return true; }
}

const TOUR_STOPS: TourStop[] = [
  {
    id: 'sidebar',
    tag: { en: 'Stop 1 of 6 · Sidebar', vi: 'Điểm 1/6 · Thanh bên' },
    title: { en: 'Your 5 home bases live here', vi: 'Các mục chính của bạn ở ngay đây' },
    body: {
      en: 'Canvas, Schedule, Tracker, Gmail and Drive are always one click away. Badges tell you what is urgent — no need to open every app.',
      vi: 'Canvas, Lịch học, Bài tập, Gmail và Drive luôn sẵn sàng chỉ với một chạm. Nhãn báo hạn giúp bạn thấy ngay việc gấp.',
    },
    selectors: ['aside[aria-label="Primary navigation"]'],
  },
  {
    id: 'search',
    tag: { en: 'Stop 2 of 6 · Search', vi: 'Điểm 2/6 · Tìm kiếm' },
    title: { en: 'One search for everything', vi: 'Một ô tìm kiếm cho mọi thứ' },
    body: {
      en: 'Assignments, files, emails and tools live behind the top-bar search box — with quick actions right inside. Typing math copies the answer.',
      vi: 'Bài tập, tệp, email và công cụ đều tìm thấy từ thanh tìm kiếm phía trên. Gõ phép tính sẽ tự sao chép kết quả.',
    },
    selectors: ['[data-tour="search"]'],
    tryIt: 'search',
    tryItLabel: { en: 'Try search', vi: 'Thử tìm kiếm' },
    tip: 'SHORTCUT_TIP',
  },
  {
    id: 'sync',
    tag: { en: 'Stop 3 of 6 · Google Apps', vi: 'Điểm 3/6 · Ứng dụng Google' },
    title: { en: 'Connect only what you use', vi: 'Chỉ kết nối những gì bạn cần' },
    body: {
      en: 'Calendar, Gmail, Drive, Sheets, and Classroom each ask for permission separately only when you turn them on. StudentOS never sends email for you, and you can disconnect anytime in Settings.',
      vi: 'Calendar, Gmail, Drive, Sheets và Classroom sẽ xin quyền riêng khi bạn mở dùng. StudentOS không bao giờ tự gửi email thay bạn và bạn có thể tắt bất cứ lúc nào trong Cài đặt.',
    },
    selectors: ['[data-tour="sync"]', '#btn-nav-google-sync'],
    tryIt: 'sync',
    tryItLabel: { en: 'View Google Connections', vi: 'Xem Kết nối Google' },
  },
  {
    id: 'tracker',
    tag: { en: 'Stop 4 of 6 · Assignment Tracker', vi: 'Điểm 4/6 · Theo dõi bài tập' },
    title: { en: 'All deadlines, one list', vi: 'Mọi hạn nộp trong một danh sách' },
    body: {
      en: 'Paste your Canvas calendar link once, test it, then save. Overdue and due-today badges keep today clear.',
      vi: 'Dán liên kết lịch Canvas một lần, kiểm tra rồi lưu. Nhãn Quá hạn và Hạn hôm nay giúp bạn luôn nắm rõ việc cần làm.',
    },
    tab: 'tracker',
    selectors: ['[data-tour-tab="tracker"]', 'aside[aria-label="Primary navigation"]'],
  },
  {
    id: 'coach',
    tag: { en: 'Stop 5 of 6 · AI Coach', vi: 'Điểm 5/6 · Trợ lý AI' },
    title: { en: 'Stuck? Ask the AI Coach', vi: 'Bí bài? Hỏi Trợ lý học tập AI' },
    body: {
      en: 'Study plans, essay feedback and email drafts — grounded in your real work, with sources shown under every answer.',
      vi: 'Lập kế hoạch học, góp ý bài viết và soạn nháp email — bám sát bài học thật của bạn.',
    },
    selectors: ['[data-tour="coach"]', '#btn-nav-ai-coach'],
    tryIt: 'coach',
    tryItLabel: { en: 'Open AI Coach', vi: 'Mở Trợ lý AI' },
  },
  {
    id: 'focus',
    tag: { en: 'Stop 6 of 6 · Focus', vi: 'Điểm 6/6 · Tập trung' },
    title: { en: 'Focus without distractions', vi: 'Học tập trung không xao nhãng' },
    body: {
      en: 'Start a 25-minute Pomodoro from the Focus tab. Press Esc to exit — your streak is saved. Rain and soft background sounds are built in.',
      vi: 'Bắt đầu phiên tập trung 25 phút từ mục Tập trung. Nhấn Esc để thoát bất cứ lúc nào — chuỗi ngày học của bạn vẫn được lưu.',
    },
    tab: 'pomodoro',
    selectors: ['[data-tour-tab="pomodoro"]', 'aside[aria-label="Primary navigation"]'],
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

function resolveTarget(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el && el.offsetParent !== null) return el;
    } catch {}
  }
  return null;
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

interface InteractiveIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenAiCoach?: () => void;
  onOpenGoogleSync?: () => void;
}

export const InteractiveIntroModal: React.FC<InteractiveIntroModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSearch,
  onOpenAiCoach,
  onOpenGoogleSync,
}) => {
  const [lang] = useLang();
  const isVi = lang === 'vi';
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [macPlatform, setMacPlatform] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    setMacPlatform(isMac());
  }, []);

  const stop = TOUR_STOPS[currentStep];
  const isLast = currentStep === TOUR_STOPS.length - 1;
  const shortcutTip = isVi
    ? macPlatform
      ? 'Nhấn ⌘K để tìm kiếm từ mọi nơi'
      : 'Nhấn Ctrl+K để tìm kiếm từ mọi nơi'
    : macPlatform
    ? 'Press ⌘K to search from anywhere'
    : 'Press Ctrl+K to search from anywhere';

  const measure = useCallback((selectors: string[]) => {
    const el = resolveTarget(selectors);
    if (!el) { setRect(null); return; }
    try {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    } catch {}
    setTimeout(() => {
      const live = resolveTarget(selectors);
      if (!live) { setRect(null); return; }
      const r = live.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, prefersReducedMotion() ? 50 : 350);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (stop.tab && onNavigate) {
      try { onNavigate(stop.tab); } catch {}
    }
    let tries = 0;
    const tick = () => {
      tries += 1;
      const el = resolveTarget(stop.selectors);
      if (el || tries >= 14) {
        measure(stop.selectors);
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 150);
    const onRepos = () => measure(stop.selectors);
    window.addEventListener('resize', onRepos);
    window.addEventListener('scroll', onRepos, true);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      window.removeEventListener('resize', onRepos);
      window.removeEventListener('scroll', onRepos, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const markSeen = () => {
    try { localStorage.setItem('scc_tour_seen_v2', 'true'); } catch {}
  };

  const handleSkip = () => { markSeen(); onClose(); };
  const handleNext = () => {
    if (isLast) { markSeen(); onClose(); }
    else setCurrentStep((p) => p + 1);
  };
  const handlePrev = () => setCurrentStep((p) => Math.max(0, p - 1));

  const handleTryIt = () => {
    markSeen();
    onClose();
    setTimeout(() => {
      try {
        if (stop.tryIt === 'search' && onOpenSearch) onOpenSearch();
        else if (stop.tryIt === 'sync' && onOpenGoogleSync) onOpenGoogleSync();
        else if (stop.tryIt === 'coach' && onOpenAiCoach) onOpenAiCoach();
      } catch {}
    }, 80);
  };

  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const isMobile = vw < 640;
  const cardW = Math.min(330, vw - 16);

  let cardStyle: React.CSSProperties;
  if (!rect || isMobile) {
    cardStyle = isMobile
      ? { left: 8, right: 8, bottom: 8, position: 'fixed' as const }
      : { left: Math.max(8, (vw - cardW) / 2), bottom: 24, position: 'fixed' as const, width: cardW };
  } else {
    const belowFits = rect.top + rect.height + 16 + 260 < vh;
    const top = belowFits ? rect.top + rect.height + 12 : Math.max(8, rect.top - 12 - 260);
    const left = Math.max(8, Math.min(rect.left, vw - cardW - 8));
    cardStyle = { top, left, width: cardW, position: 'fixed' as const };
  }

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none select-none" role="dialog" aria-modal="true" aria-label={isVi ? 'Hướng dẫn nhanh StudentOS' : 'StudentOS guided tour'}>
      {/* Dim layer */}
      <div className="absolute inset-0 bg-[#141413]/55" />
      {/* Spotlight cutout */}
      {rect && (
        <div
          className="scc-tour-spotlight absolute rounded-2xl"
          style={{
            top: Math.max(0, rect.top - pad),
            left: Math.max(0, rect.left - pad),
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(20,20,19,0.55), 0 0 0 3px #D97757, 0 0 24px rgba(217,119,87,0.55)',
          }}
        />
      )}

      {/* Popover card */}
      <div
        className="pointer-events-auto absolute bg-[#FAF9F5] dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl p-4 space-y-3 animate-in zoom-in-95 duration-150"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D97757]/15 text-[#D97757]">
            {isVi ? stop.tag.vi : stop.tag.en}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1.5 rounded-lg text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] hover:bg-[#EFECE2] dark:hover:bg-[#252422] transition-colors cursor-pointer"
            title={isVi ? 'Bỏ qua hướng dẫn' : 'Skip tour'}
            aria-label={isVi ? 'Bỏ qua hướng dẫn' : 'Skip tour'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-[#141413] dark:text-[#FAF9F5] leading-snug flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>{isVi ? stop.title.vi : stop.title.en}</span>
          </h3>
          <p className="text-xs text-[#5C5A54] dark:text-[#B5B2A8] mt-1 leading-relaxed">
            {isVi ? stop.body.vi : stop.body.en}
          </p>
          {stop.tip === 'SHORTCUT_TIP' && (
            <p className="text-[11px] font-semibold text-[#D97757] mt-1.5">{shortcutTip}</p>
          )}
        </div>

        {stop.tryIt && stop.tryItLabel && (
          <button
            type="button"
            onClick={handleTryIt}
            className="w-full px-3 py-2 bg-white dark:bg-[#252422] border border-[#D97757]/40 hover:border-[#D97757] text-[#D97757] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              {isVi
                ? `${stop.tryItLabel.vi} — đóng hướng dẫn & mở ngay`
                : `${stop.tryItLabel.en} — end tour & open it`}
            </span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {TOUR_STOPS.map((s, idx) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentStep === idx ? 'w-6 bg-[#D97757]' : 'w-2 bg-[#DFDACB] dark:bg-[#2C2B27]'
                }`}
                aria-label={isVi ? `Chuyển đến ${s.id}` : `Jump to ${s.id}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isVi ? 'Quay lại' : 'Back'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>
                {isLast ? (isVi ? 'Bắt đầu học' : 'Start studying') : (isVi ? 'Tiếp' : 'Next')}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
