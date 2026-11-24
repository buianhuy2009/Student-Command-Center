import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { LanguageToggle } from './LanguageToggle';
import {
  AmbientParticleCanvas,
  HeroInteractivePreview,
  StickyWorkflowExplorer,
} from './LandingShowcase';
import { useT } from '../services/i18n';

interface LandingPageProps {
  onSignIn: () => void;
  onExploreDemo: () => void;
  isLoggingIn: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

const HOW_STEPS = [
  { num: '01', titleKey: 'landing_how_1t', descKey: 'landing_how_1d' },
  { num: '02', titleKey: 'landing_how_2t', descKey: 'landing_how_2d' },
  { num: '03', titleKey: 'landing_how_3t', descKey: 'landing_how_3d' },
] as const;

const FAQ_ITEMS = [
  { qKey: 'landing_faq_1q', aKey: 'landing_faq_1a' },
  { qKey: 'landing_faq_2q', aKey: 'landing_faq_2a' },
  { qKey: 'landing_faq_3q', aKey: 'landing_faq_3a' },
] as const;

const COMPARISON_ROWS = [
  { fKey: 'landing_cmp_r1_f', sKey: 'landing_cmp_r1_s', nKey: null, cKey: 'landing_cmp_r1_c', mKey: null, highlight: true },
  { fKey: 'landing_cmp_r2_f', sKey: 'landing_cmp_r2_s', nKey: null, cKey: null, mKey: null, highlight: true },
  { fKey: 'landing_cmp_r3_f', sKey: 'landing_cmp_r3_s', nKey: 'landing_cmp_r3_n', cKey: null, mKey: null, highlight: true },
  { fKey: 'landing_cmp_r4_f', sKey: 'landing_cmp_r4_s', nKey: 'landing_cmp_r4_n', cKey: null, mKey: null, highlight: true },
  { fKey: 'landing_cmp_r5_f', sKey: 'landing_cmp_r5_s', nKey: 'landing_cmp_r5_n', cKey: 'landing_cmp_r5_c', mKey: 'landing_cmp_r5_m', highlight: false },
] as const;

const PRIVACY_ROWS = [
  ['classroom', 'landing_priv_t_classroom', 'landing_priv_w_classroom', 'landing_priv_a_classroom'],
  ['calendar', 'landing_priv_t_calendar', 'landing_priv_w_calendar', 'landing_priv_a_calendar'],
  ['drive_sheets', 'landing_priv_t_drive', 'landing_priv_w_drive', 'landing_priv_a_drive'],
  ['gmail', 'landing_priv_t_gmail', 'landing_priv_w_gmail', 'landing_priv_a_gmail'],
] as const;

const INTEGRATIONS = [
  'Canvas LMS',
  'Google Calendar',
  'Gmail AI',
  'Google Classroom',
  'Drive & Sheets',
  'Gemini Flash',
  'Desmos & GeoGebra',
  'Offline PWA',
] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onExploreDemo,
  isLoggingIn,
  darkMode,
  setDarkMode,
}) => {
  const { t } = useT();
  const [motionPaused, setMotionPaused] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const demoDialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const openDemoModal = () => {
    setDemoModalOpen(true);
    const dlg = demoDialogRef.current;
    if (dlg && !dlg.open) {
      dlg.showModal();
    }
  };

  const closeDemoModal = () => {
    const dlg = demoDialogRef.current;
    if (dlg?.open) dlg.close();
    videoRef.current?.pause();
    setDemoModalOpen(false);
  };

  // Light-dismiss fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dlg = demoDialogRef.current;
    if (!dlg) return;
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      if (dlg.open) pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (dlg.open && pressedOutside && isOutside(e)) closeDemoModal();
      pressedOutside = false;
    };
    const onClose = () => {
      videoRef.current?.pause();
      setDemoModalOpen(false);
    };
    dlg.addEventListener('pointerdown', onDown);
    dlg.addEventListener('pointerup', onUp);
    dlg.addEventListener('close', onClose);
    return () => {
      dlg.removeEventListener('pointerdown', onDown);
      dlg.removeEventListener('pointerup', onUp);
      dlg.removeEventListener('close', onClose);
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans landing-smooth">
      {/* Top Sticky Glass Header */}
      <header
        role="banner"
        className="sticky top-0 z-40 bg-[var(--bg-canvas)]/88 backdrop-blur-md border-b border-[var(--border-hairline)]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <a href="#" className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-8 h-8 bg-[var(--accent-fill)] rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
              aria-hidden="true"
            >
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
              {t('landing_brand_name')}
            </span>
          </a>

          <nav
            aria-label={t('landing_nav_sections_aria')}
            className="hidden md:flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap"
          >
            <a
              href="#workflow"
              className="px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {t('landing_nav_features')}
            </a>
            <a
              href="#how"
              className="px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {t('landing_nav_how')}
            </a>
            <a
              href="#faq"
              className="px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {t('landing_nav_faq')}
            </a>
            <a
              href="/privacy"
              className="px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {t('landing_nav_privacy')}
            </a>
            <a
              href="/terms"
              className="px-3 py-1.5 rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {t('landing_nav_terms')}
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageToggle compact className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title={t('landing_toggle_theme')}
              aria-label={t('landing_toggle_theme')}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[var(--status-warn-text)]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--accent-text)]" />
              )}
            </button>

            <button
              type="button"
              onClick={onExploreDemo}
              className="hidden lg:inline-flex px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('landing_explore')}
            </button>

            <button
              type="button"
              onClick={onSignIn}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-[var(--text-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--bg-surface)] rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{isLoggingIn ? t('landing_connecting') : t('landing_signin')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — Atmospheric Dot Canvas + Centered Editorial Headline + Interactive Showcase */}
        <section className="relative overflow-hidden pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-24">
          <AmbientParticleCanvas
            darkMode={darkMode}
            paused={motionPaused}
            onTogglePause={() => setMotionPaused((p) => !p)}
          />

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* Editorial Header Block */}
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-xs border border-[var(--border-hairline)] text-[var(--accent-text)] text-xs font-semibold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{t('landing_hero_eyebrow')}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.06] text-balance">
                {t('landing_h1_a')}{' '}
                <span className="font-serif italic font-semibold text-[var(--accent-text)]">
                  {t('landing_h1_b')}
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed text-balance">
                {t('landing_sub')}
              </p>

              {/* Pill CTA Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
                <button
                  id="btn-landing-primary-signup"
                  type="button"
                  onClick={onSignIn}
                  disabled={isLoggingIn}
                  className="min-h-[48px] px-7 py-3.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-full text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-sm"
                >
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span>{isLoggingIn ? t('landing_connecting') : t('landing_signup')}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>

                <button
                  id="btn-landing-explore-demo"
                  type="button"
                  onClick={onExploreDemo}
                  className="min-h-[48px] px-6 py-3.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-full text-sm sm:text-base font-semibold transition-colors cursor-pointer inline-flex items-center justify-center"
                >
                  <span>{t('landing_explore')}</span>
                </button>

                <button
                  type="button"
                  onClick={openDemoModal}
                  className="min-h-[48px] px-5 py-3.5 bg-transparent hover:bg-[var(--bg-surface)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-hairline)] rounded-full text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                  <span>{t('landing_watch_short')}</span>
                </button>
              </div>

              <p className="text-xs leading-relaxed text-[var(--text-muted)] max-w-xl mx-auto">
                {t('landing_incremental_note')}
              </p>
            </div>

            {/* Interactive Tabbed Product Showcase */}
            <div className="max-w-5xl mx-auto">
              <HeroInteractivePreview darkMode={darkMode} onExploreDemo={onExploreDemo} />
            </div>
          </div>
        </section>

        {/* Borderless Integration Ribbon + Two-Tone Thesis */}
        <section className="py-12 sm:py-16 border-t border-[var(--border-hairline)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-center">
            <div
              aria-label={t('landing_integrations_aria')}
              className="flex flex-wrap items-center justify-center gap-2.5"
            >
              {INTEGRATIONS.map((tool) => (
                <span
                  key={tool}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                >
                  {tool}
                </span>
              ))}
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.14] text-balance max-w-4xl mx-auto">
              <span className="text-[var(--text-primary)]">{t('landing_thesis_a')} </span>
              <span className="text-[var(--text-muted)] font-semibold">{t('landing_thesis_b')}</span>
            </h2>
          </div>
        </section>

        {/* Sticky 2-Column Interactive Workflow Explorer */}
        <StickyWorkflowExplorer />

        {/* 3-Step Quickstart (Architectural Columns) */}
        <section id="how" className="py-16 sm:py-20 border-t border-[var(--border-hairline)] scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-2xl space-y-2">
              <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-[var(--accent-text)]">
                QUICKSTART
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                {t('landing_how_title')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="landing-scroll-reveal p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--accent-text)]">
                      STEP {step.num}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-fill)]/70" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t(step.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing, Comparison, FAQ & Privacy (Clean Consolidated Disclosure) */}
        <section className="py-16 sm:py-20 border-t border-[var(--border-hairline)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
            <div
              id="pricing"
              className="p-6 sm:p-8 rounded-3xl landing-aura-sage border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 scroll-mt-20"
            >
              <div className="space-y-1">
                <div className="text-lg font-extrabold text-[var(--text-primary)]">{t('landing_pricing_t')}</div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('landing_pricing_d')}</p>
              </div>
              <a
                href="https://github.com/buianhuy2009/Student-Command-Center"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 px-4 py-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors self-start sm:self-center"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>

            {/* FAQ */}
            <div id="faq" className="space-y-3 scroll-mt-20">
              <h2 className="text-xl font-extrabold text-[var(--text-primary)]">{t('landing_faq_title')}</h2>
              <div className="space-y-2.5">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.qKey}
                    className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] open:border-[var(--border-default)]"
                  >
                    <summary className="flex items-center justify-between gap-3 px-5 py-4 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span>{t(item.qKey)}</span>
                      <ChevronDown
                        className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="px-5 pb-4 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-hairline)] pt-3">
                      {t(item.aKey)}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Comparison Disclosure */}
            <details
              id="comparison"
              className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] open:border-[var(--border-default)] scroll-mt-20"
            >
              <summary className="flex items-center justify-between gap-3 px-5 py-4 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span>{t('landing_compare_title')}</span>
                <ChevronDown
                  className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-5 pb-5 pt-3 border-t border-[var(--border-hairline)] overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] text-left text-[var(--text-primary)]">
                      <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">
                        {t('landing_cmp_col_feature')}
                      </th>
                      <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">StudentOS</th>
                      <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">Notion</th>
                      <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">Canvas</th>
                      <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">Motion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.fKey}>
                        <td className="p-2.5 border border-[var(--border-hairline)] font-semibold text-[var(--text-primary)]">
                          {t(row.fKey)}
                        </td>
                        <td
                          className={`p-2.5 border border-[var(--border-hairline)] ${
                            row.highlight ? 'text-[var(--status-ok-text)] font-medium' : 'font-bold text-[var(--text-primary)]'
                          }`}
                        >
                          {t(row.sKey)}
                        </td>
                        <td className="p-2.5 border border-[var(--border-hairline)]">{row.nKey ? t(row.nKey) : '—'}</td>
                        <td className="p-2.5 border border-[var(--border-hairline)]">{row.cKey ? t(row.cKey) : '—'}</td>
                        <td className="p-2.5 border border-[var(--border-hairline)]">{row.mKey ? t(row.mKey) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {/* Privacy & Google Scopes */}
            <div id="privacy" className="space-y-3 pt-2 scroll-mt-20">
              <div className="flex items-center gap-2 text-base font-extrabold text-[var(--text-primary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <h2>{t('landing_privacy_title')}</h2>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {t('landing_priv_intro')}
              </p>

              <details className="group rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] open:border-[var(--border-default)]">
                <summary className="flex items-center justify-between gap-3 px-5 py-4 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span>{t('landing_priv_table_summary')}</span>
                  <ChevronDown
                    className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="px-5 pb-5 pt-3 border-t border-[var(--border-hairline)] overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)] text-left text-[var(--text-primary)]">
                        <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">
                          {t('landing_priv_col_tool')}
                        </th>
                        <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">
                          {t('landing_priv_col_why')}
                        </th>
                        <th className="p-2.5 border border-[var(--border-hairline)] font-semibold">
                          {t('landing_priv_col_ai')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                      {PRIVACY_ROWS.map(([id, toolKey, whyKey, aiKey]) => (
                        <tr key={id}>
                          <td className="p-2.5 border border-[var(--border-hairline)] font-semibold text-[var(--text-primary)]">
                            {t(toolKey)}
                          </td>
                          <td className="p-2.5 border border-[var(--border-hairline)]">{t(whyKey)}</td>
                          <td className="p-2.5 border border-[var(--border-hairline)]">{t(aiKey)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))}
                  className="text-xs font-bold text-[var(--accent-text)] underline cursor-pointer"
                >
                  {t('landing_priv_full_link')}
                </button>
                <span className="text-xs text-[var(--text-muted)]" aria-hidden="true">•</span>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[var(--accent-text)] underline"
                >
                  {t('landing_terms_link')}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Atmospheric Rounded Dark Showcase CTA */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
          <div className="max-w-6xl mx-auto rounded-3xl bg-[#11141B] text-white border border-white/10 p-8 sm:p-14 lg:p-16 relative overflow-hidden text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  'radial-gradient(circle at 25% 20%, rgba(181, 75, 39, 0.32), transparent 55%), radial-gradient(circle at 80% 80%, rgba(96, 165, 250, 0.16), transparent 50%)',
              }}
            />
            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">
                {t('landing_cta_title')}
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {t('landing_cta_sub')}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto px-7 py-3.5 bg-white text-[#11141B] hover:bg-[#F7F6F2] disabled:opacity-50 rounded-full text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <GraduationCap className="w-5 h-5 text-[#B54B27] shrink-0" aria-hidden="true" />
                  <span>{t('landing_cta_btn')}</span>
                </button>
                <button
                  type="button"
                  onClick={openDemoModal}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/15 border border-white/25 text-white rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t('landing_watch_short')}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Native Top-Layer <dialog> Demo Video Modal */}
      <dialog
        ref={demoDialogRef}
        aria-labelledby="demo-modal-title"
        {...({ closedby: 'any' } as Record<string, string>)}
        className="landing-dialog w-[calc(100%-2rem)] max-w-3xl rounded-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] p-5 sm:p-6 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 id="demo-modal-title" className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Play className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>{t('landing_demo_title')}</span>
            </h3>
            <button
              type="button"
              onClick={closeDemoModal}
              aria-label={t('common_close')}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-[var(--border-hairline)]">
            {demoModalOpen && (
              <video
                ref={videoRef}
                src="/demo.mp4"
                poster="/screenshot-dashboard.png"
                controls
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                {t('landing_demo_unsupported')}
              </video>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">{t('landing_demo_note')}</p>
            <button
              type="button"
              onClick={() => {
                closeDemoModal();
                onExploreDemo();
              }}
              className="px-4 py-2 rounded-full bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold cursor-pointer"
            >
              {t('landing_explore')}
            </button>
          </div>
        </div>
      </dialog>

      {/* Clean Directory Footer + Editorial Wordmark */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] pt-12 pb-6 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-xs text-[var(--text-secondary)]">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span className="font-extrabold text-sm text-[var(--text-primary)]">{t('landing_brand_name')}</span>
                <span className="text-[var(--text-muted)]">{t('landing_footer_tagline')}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-sm leading-relaxed">
                {t('landing_sub')}
              </p>
              <LanguageToggle />
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <div className="font-bold text-[var(--text-primary)]">{t('landing_footer_col_product')}</div>
              <ul className="space-y-2">
                <li><a href="#workflow" className="hover:text-[var(--accent-text)]">{t('landing_nav_features')}</a></li>
                <li><a href="#how" className="hover:text-[var(--accent-text)]">{t('landing_nav_how')}</a></li>
                <li><button type="button" onClick={onExploreDemo} className="hover:text-[var(--accent-text)] cursor-pointer">{t('landing_explore')}</button></li>
                <li><button type="button" onClick={openDemoModal} className="hover:text-[var(--accent-text)] cursor-pointer">{t('landing_watch_short')}</button></li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <div className="font-bold text-[var(--text-primary)]">{t('landing_footer_col_resources')}</div>
              <ul className="space-y-2">
                <li><a href="#pricing" className="hover:text-[var(--accent-text)]">{t('landing_footer_pricing')}</a></li>
                <li><a href="#faq" className="hover:text-[var(--accent-text)]">{t('landing_nav_faq')}</a></li>
                <li><a href="#comparison" className="hover:text-[var(--accent-text)]">{t('landing_footer_comparison')}</a></li>
                <li>
                  <a
                    href="https://github.com/buianhuy2009/Student-Command-Center"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[var(--accent-text)] inline-flex items-center gap-1"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2.5">
              <div className="font-bold text-[var(--text-primary)]">{t('landing_footer_col_legal')}</div>
              <ul className="space-y-2">
                <li><a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-text)]">{t('landing_footer_privacy')}</a></li>
                <li><a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-text)]">{t('landing_footer_terms')}</a></li>
                <li><a href="mailto:buianhuy2009@gmail.com" className="hover:text-[var(--accent-text)]">{t('landing_footer_contact')}</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
            <span>{t('landing_footer_copyright')}</span>
            <span>Canvas LMS • Google Workspace • Gemini AI</span>
          </div>

          {/* Oversized Editorial Wordmark */}
          <div aria-hidden="true" className="pt-2 select-none text-center">
            <div className="text-[clamp(3.5rem,13vw,9.5rem)] font-serif italic font-semibold leading-none tracking-tight text-[var(--text-primary)]/10">
              StudentOS
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
