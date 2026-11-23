import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  CheckCircle2,
  Layers,
  Mail,
  Pause,
  Play,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface AmbientParticleCanvasProps {
  darkMode: boolean;
  paused: boolean;
  onTogglePause: () => void;
}

/** Subtle radial dot-field canvas honoring prefers-reduced-motion and providing a pause control. */
export const AmbientParticleCanvas: React.FC<AmbientParticleCanvasProps> = ({
  darkMode,
  paused,
  onTogglePause,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useT();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const shouldAnimate = !paused && !mq.matches;

    let rafId = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles = Array.from({ length: 64 }, (_, idx) => {
      const ring = 0.22 + ((idx * 17) % 72) / 100;
      const angle = (idx / 64) * Math.PI * 2;
      const speed = (0.00018 + (idx % 5) * 0.00004) * (idx % 2 === 0 ? 1 : -1);
      const size = 1.4 + (idx % 3) * 0.85;
      const warm = idx % 3 !== 0;
      return { ring, angle, speed, size, warm };
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.52;
      const cy = height * 0.44;
      const maxR = Math.max(width, height) * 0.56;

      for (const p of particles) {
        const theta = p.angle + (shouldAnimate ? time * p.speed : 0);
        const radius = p.ring * maxR;
        const x = cx + Math.cos(theta) * radius;
        const y = cy + Math.sin(theta) * radius * 0.68;
        const alpha = darkMode ? (p.warm ? 0.32 : 0.22) : p.warm ? 0.24 : 0.14;
        ctx.fillStyle = p.warm
          ? darkMode
            ? `rgba(242, 145, 109, ${alpha})`
            : `rgba(181, 75, 39, ${alpha})`
          : darkMode
            ? `rgba(148, 163, 184, ${alpha})`
            : `rgba(99, 93, 82, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (shouldAnimate) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    resize();
    drawFrame(0);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [darkMode, paused]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-90"
      />
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? t('landing_motion_play') : t('landing_motion_pause')}
        title={paused ? t('landing_motion_play') : t('landing_motion_pause')}
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-[var(--bg-surface)]/80 backdrop-blur-xs border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors absolute bottom-4 right-4 z-20 cursor-pointer"
      >
        {paused ? <Play className="w-3 h-3" aria-hidden="true" /> : <Pause className="w-3 h-3" aria-hidden="true" />}
        <span>{paused ? t('landing_motion_play') : t('landing_motion_pause')}</span>
      </button>
    </>
  );
};

type PreviewTabId = 'workspace' | 'canvas' | 'gmail' | 'coach';

interface HeroInteractivePreviewProps {
  darkMode: boolean;
  onExploreDemo: () => void;
}

/** Tabbed hero product preview blending authentic screenshots and crisp live DOM UI vignettes. */
export const HeroInteractivePreview: React.FC<HeroInteractivePreviewProps> = ({
  darkMode,
  onExploreDemo,
}) => {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<PreviewTabId>('workspace');
  const [imgBroken, setImgBroken] = useState(false);

  const tabs: { id: PreviewTabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'workspace', label: t('landing_tab_preview'), icon: Sparkles },
    { id: 'canvas', label: t('landing_tab_canvas'), icon: Layers },
    { id: 'gmail', label: t('landing_tab_gmail'), icon: Mail },
    { id: 'coach', label: t('landing_tab_coach'), icon: Bot },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((item) => item.id === activeTab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveTab(tabs[(idx + 1) % tabs.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
    }
  };

  const screenshotSrc = darkMode ? '/screenshot-dashboard-dark.png' : '/screenshot-dashboard.png';

  return (
    <div className="rounded-3xl p-3 sm:p-4 landing-aura-warm border border-[var(--border-hairline)] shadow-[var(--shadow-card-hover)]">
      {/* Accessible Single-Row Tablist */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div
          role="tablist"
          aria-label={t('landing_nav_sections_aria')}
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-1 overflow-x-auto pb-0.5"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`hero-tab-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`landing-tab relative shrink-0 px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  selected
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onExploreDemo}
          className="hidden sm:inline-flex shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {t('landing_explore')}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] overflow-hidden">
        {/* Panel 1: Authentic Workspace Screenshot */}
        <div
          role="tabpanel"
          aria-labelledby="hero-tab-workspace"
          hidden={activeTab !== 'workspace'}
          tabIndex={activeTab === 'workspace' ? 0 : -1}
        >
          <div className="relative bg-[var(--bg-canvas)]">
            {!imgBroken ? (
              <img
                src={screenshotSrc}
                alt={t('landing_hero_img_alt')}
                width={1280}
                height={720}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                onError={() => setImgBroken(true)}
                className="w-full h-auto block landing-vignette-mask"
              />
            ) : (
              <div className="aspect-video flex items-center justify-center p-8 text-sm text-[var(--text-muted)]">
                {t('landing_hero_img_alt')}
              </div>
            )}
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <span className="font-semibold text-[var(--text-primary)]">
                StudentOS · Calm Mode &amp; Midnight Palette
              </span>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-[var(--status-ok-text)]" aria-hidden="true" />
                  IndexedDB Offline
                </span>
                <span>·</span>
                <span>15 Study &amp; STEM Tools</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Canvas Live Sync Vignette */}
        <div
          role="tabpanel"
          aria-labelledby="hero-tab-canvas"
          hidden={activeTab !== 'canvas'}
          tabIndex={activeTab === 'canvas' ? 0 : -1}
        >
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">Canvas LMS · Unfinished (3)</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]">
                Auto-Synced
              </span>
            </div>
            <div className="space-y-2">
              {[
                { course: 'Calculus BC', title: 'Problem Set 8: Integration by Parts & Series', due: 'Tomorrow · 10:07 PM', status: 'Synced' },
                { course: 'AP US History', title: 'DBQ Essay: New Deal & Great Depression Policies', due: 'In 2 days · 100 pts', status: 'Synced' },
                { course: 'AP Physics C', title: 'Unit 4 Exam Review & Practice Quiz', due: 'In 4 days · 30 pts', status: 'Pending' },
              ].map((row) => (
                <div
                  key={row.title}
                  className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] mb-1">
                      {row.course}
                    </span>
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{row.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{row.due}</p>
                  </div>
                  <span
                    className={`self-start sm:self-center shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      row.status === 'Synced'
                        ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 3: Gmail Radar Vignette */}
        <div
          role="tabpanel"
          aria-labelledby="hero-tab-gmail"
          hidden={activeTab !== 'gmail'}
          tabIndex={activeTab === 'gmail' ? 0 : -1}
        >
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">School Inbox · EN / VI Triage</span>
              <span className="text-[11px] text-[var(--text-muted)]">Promo noise hidden</span>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Dr. Rebecca Vance · AP Physics</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-fill)] text-white">EXAM · Urgent</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Office Hours &amp; Unit 4 Quiz Prep — Extra help tomorrow 3:30 PM, Room 204.</p>
              </div>
              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Mr. David Miller · AP US History</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)]">ASSIGNMENT</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">DBQ Rubric &amp; Primary Source Packet updated; cite at least 4 documents.</p>
              </div>
              <div className="p-2.5 rounded-xl border border-dashed border-[var(--border-default)] opacity-70 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Shopee Deals · Super Flash Sale 50% Off</span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] font-mono text-[10px]">SPAM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 4: AI Study Coach Vignette */}
        <div
          role="tabpanel"
          aria-labelledby="hero-tab-coach"
          hidden={activeTab !== 'coach'}
          tabIndex={activeTab === 'coach' ? 0 : -1}
        >
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
              <span className="font-bold text-[var(--text-primary)]">AI Study Coach · Socratic Mode</span>
              <div className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-0.5 text-[10px] font-semibold">
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-fill)] text-white">Auto</span>
                <span className="px-2 py-0.5 text-[var(--text-secondary)]">Professor</span>
                <span className="px-2 py-0.5 text-[var(--text-secondary)] inline-flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" aria-hidden="true" />
                  Offline AI
                </span>
              </div>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-[10px] text-[var(--status-warn-text)] font-medium">
              Offline AI runs privately on your device (much less smart than Online AI — double-check math &amp; facts).
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] space-y-2">
              <p className="font-semibold text-[var(--text-primary)]">
                &ldquo;Break down Problem Set 8 &amp; schedule tonight around my 7 PM block.&rdquo;
              </p>
              <div className="pl-3 border-l-2 border-[var(--accent-fill)] space-y-1">
                <p>1. Start with LIATE rule check on #14–18 (25 min focus sprint).</p>
                <p>2. Which part feels stuck—choosing <code className="font-mono text-[11px]">u</code> vs <code className="font-mono text-[11px]">dv</code>, or tabular integration?</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--status-info-bg)] border border-[var(--status-info-border)] flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2 font-semibold text-[var(--status-info-text)]">
                <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                7:00 PM – 7:45 PM · Calc BC Integration Sprint
              </span>
              <CheckCircle2 className="w-4 h-4 text-[var(--status-info-text)] shrink-0" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Sticky 2-column workflow explorer inspired by antigravity.google and linear.app. */
export const StickyWorkflowExplorer: React.FC = () => {
  const { t } = useT();
  const [activeIndex, setActiveIndex] = useState(0);

  const pillars = [
    {
      num: t('landing_pillar_1_num'),
      title: t('landing_pillar_1_t'),
      desc: t('landing_pillar_1_d'),
      aura: 'landing-aura-warm',
      darkCard: false,
      badge: 'Canvas + Classroom',
      preview: (
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
            <span className="font-bold text-[var(--text-primary)]">Coursework Feed</span>
            <span className="font-mono text-[10px] text-[var(--accent-text)]">AUTO-RECONCILED</span>
          </div>
          {[
            ['Calculus BC', 'Problem Set 8', 'Due tomorrow'],
            ['AP US History', 'New Deal DBQ Essay', 'In 2 days'],
            ['AP Physics C', 'Unit 4 Quiz Prep', 'In 4 days'],
          ].map(([subj, name, due]) => (
            <div key={name} className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-[var(--accent-text)]">{subj}</div>
                <div className="font-semibold text-[var(--text-primary)] truncate">{name}</div>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{due}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      num: t('landing_pillar_2_num'),
      title: t('landing_pillar_2_t'),
      desc: t('landing_pillar_2_d'),
      aura: 'landing-aura-sage',
      darkCard: false,
      badge: 'EN / VI Bilingual',
      preview: (
        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-border)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-primary)]">Cô Lan · Toán 11</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-fill)] text-white">EXAM</span>
            </div>
            <p className="text-[var(--text-secondary)]">Dời lịch kiểm tra giữa kỳ sang Thứ 6 (tiết 3).</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between text-[var(--text-muted)]">
            <span className="truncate">Flash Sale Stationery &amp; Newsletters</span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[10px] font-semibold">Filtered</span>
          </div>
        </div>
      ),
    },
    {
      num: t('landing_pillar_3_num'),
      title: t('landing_pillar_3_t'),
      desc: t('landing_pillar_3_d'),
      aura: '',
      darkCard: true,
      badge: 'Auto · Professor · Offline AI',
      preview: (
        <div className="space-y-3 text-xs text-slate-200">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono">AI DAILY PLANNER</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-semibold">Auto Mode</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
            <p className="text-white font-semibold">Today · 3 study sprints scheduled</p>
            <p className="text-slate-300">7:00 PM · Integration by Parts (45m · Locked)</p>
            <p className="text-slate-400">8:00 PM · DBQ Source Annotation (45m)</p>
          </div>
          <div className="text-[11px] text-[#F2916D] font-medium">
            Step-by-step guidance without generating answers for you.
          </div>
        </div>
      ),
    },
    {
      num: t('landing_pillar_4_num'),
      title: t('landing_pillar_4_t'),
      desc: t('landing_pillar_4_d'),
      aura: 'landing-aura-sky',
      darkCard: false,
      badge: 'Offline IndexedDB',
      preview: (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Desmos & GeoGebra', 'Graphing & geometry'],
            ['SM-2 Flashcards', 'Spaced repetition'],
            ['arXiv & OpenLibrary', 'Citations & PDFs'],
            ['Excalidraw & Notes', 'Diagrams + KaTeX'],
          ].map(([name, sub]) => (
            <div key={name} className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
              <div className="font-bold text-[var(--text-primary)]">{name}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="workflow" className="py-16 sm:py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Sticky Left Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div className="space-y-3">
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-[var(--accent-text)]">
              {t('landing_explorer_eyebrow')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.12]">
              {t('landing_explorer_title')}
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              {t('landing_explorer_sub')}
            </p>
          </div>

          <nav aria-label={t('landing_explorer_title')} className="space-y-2">
            {pillars.map((pillar, i) => {
              const active = activeIndex === i;
              return (
                <a
                  key={pillar.num}
                  href={`#pillar-${pillar.num}`}
                  onClick={() => setActiveIndex(i)}
                  className={`block p-3.5 rounded-2xl border transition-colors ${
                    active
                      ? 'bg-[var(--bg-surface)] border-[var(--border-strong)] shadow-xs'
                      : 'border-transparent hover:bg-[var(--bg-surface)]/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`font-mono text-xs font-bold mt-0.5 ${active ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}>
                      {pillar.num}
                    </span>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[var(--text-primary)]">{pillar.title}</div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{pillar.desc}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Scrolling Right Column Vignettes */}
        <div className="lg:col-span-7 space-y-6">
          {pillars.map((pillar, i) => (
            <article
              key={pillar.num}
              id={`pillar-${pillar.num}`}
              onMouseEnter={() => setActiveIndex(i)}
              className={`landing-scroll-reveal rounded-3xl p-6 sm:p-8 border scroll-mt-24 ${
                pillar.darkCard
                  ? 'bg-[#12151D] text-white border-[#272D3A]'
                  : `${pillar.aura} border-[var(--border-hairline)]`
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-5">
                <span className={`font-mono text-xs font-bold ${pillar.darkCard ? 'text-[#F2916D]' : 'text-[var(--accent-text)]'}`}>
                  FIG {pillar.num}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                    pillar.darkCard
                      ? 'bg-white/10 text-slate-200'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  }`}
                >
                  {pillar.badge}
                </span>
              </div>

              <h3 className={`text-xl font-extrabold tracking-tight mb-2 ${pillar.darkCard ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                {pillar.title}
              </h3>
              <p className={`text-sm leading-relaxed mb-6 ${pillar.darkCard ? 'text-slate-300' : 'text-[var(--text-secondary)]'}`}>
                {pillar.desc}
              </p>

              <div
                className={`rounded-2xl p-4 sm:p-5 border ${
                  pillar.darkCard
                    ? 'bg-[#191D28] border-white/10'
                    : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] shadow-xs'
                }`}
              >
                {pillar.preview}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
