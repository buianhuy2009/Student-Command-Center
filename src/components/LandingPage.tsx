import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Layers,
  Sparkles,
  Mail,
  CheckSquare,
  FileText,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
  Zap,
  CheckCircle2,
  Play,
  X,
  Star,
  WifiOff,
  Bot,
  ChevronDown,
} from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { useT } from '../services/i18n';
import { LanguageToggle } from './LanguageToggle';

interface LandingPageProps {
  onSignIn: () => void;
  onExploreDemo: () => void;
  isLoggingIn: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

const WHY_CARDS = [
  { icon: Star, titleKey: 'landing_why_oss_t', descKey: 'landing_why_oss_d', subKey: 'landing_why_oss_sub' },
  { icon: WifiOff, titleKey: 'landing_why_offline_t', descKey: 'landing_why_offline_d', subKey: 'landing_why_offline_sub' },
  { icon: Bot, titleKey: 'landing_why_ai_t', descKey: 'landing_why_ai_d', subKey: 'landing_why_ai_sub' },
] as const;

const FEATURE_CARDS = [
  { icon: Layers, titleKey: 'landing_card_canvas_t', descKey: 'landing_feat_canvas_d', footKey: 'landing_feat_canvas_foot', tone: 'accent' },
  { icon: Sparkles, titleKey: 'landing_feat_coach_t', descKey: 'landing_feat_coach_d', footKey: 'landing_feat_coach_foot', tone: 'accent' },
  { icon: Mail, titleKey: 'landing_feat_gmail_t', descKey: 'landing_feat_gmail_d', footKey: 'landing_feat_gmail_foot', tone: 'ok' },
  { icon: CheckSquare, titleKey: 'landing_feat_tracker_t', descKey: 'landing_feat_tracker_d', footKey: 'landing_feat_tracker_foot', tone: 'ok' },
  { icon: FileText, titleKey: 'landing_feat_drive_t', descKey: 'landing_feat_drive_d', footKey: 'landing_feat_drive_foot', tone: 'accent' },
  { icon: Zap, titleKey: 'landing_feat_docs_t', descKey: 'landing_feat_docs_d', footKey: 'landing_feat_docs_foot', tone: 'accent' },
] as const;

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

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onExploreDemo,
  isLoggingIn,
  darkMode,
  setDarkMode,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') {
      root?.querySelectorAll('.reveal, .reveal-lift, .reveal-stagger').forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    const els = root.querySelectorAll('.reveal, .reveal-lift, .reveal-stagger');
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!demoOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDemoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [demoOpen]);

  return (
    <div
      ref={rootRef}
      className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors flex flex-col font-sans landing-smooth"
    >
      {/* Top Header */}
      <header
        role="banner"
        className="sticky top-0 z-40 bg-[var(--bg-canvas)]/92 backdrop-blur-md border-b border-[var(--border-default)]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 bg-[var(--accent-fill)] rounded-xl flex items-center justify-center text-white shrink-0"
              aria-hidden="true"
            >
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--text-primary)] truncate">
              {t('landing_brand_name')}
            </span>
          </div>

          <nav
            aria-label={t('landing_nav_sections_aria')}
            className="hidden md:flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]"
          >
            <a
              href="#features"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {t('landing_nav_features')}
            </a>
            <a
              href="#how"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {t('landing_nav_how')}
            </a>
            <a
              href="#faq"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {t('landing_nav_faq')}
            </a>
            <a
              href="#privacy"
              className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {t('landing_nav_privacy')}
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle compact className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
              className="hidden sm:inline-flex px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors cursor-pointer"
            >
              {t('landing_explore')}
            </button>

            <button
              type="button"
              onClick={onSignIn}
              disabled={isLoggingIn}
              className="px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span>{isLoggingIn ? t('landing_connecting') : t('landing_signin')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section — Calm 2-column rhythm */}
        <section className="py-12 sm:py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{t('landing_badge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.12] text-balance break-words">
                {t('landing_h1_a')}{' '}
                <span className="text-[var(--accent-text)]">{t('landing_h1_b')}</span>
              </h1>

              <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto lg:mx-0 leading-relaxed text-balance break-words">
                {t('landing_sub')}
              </p>

              {/* Primary + Demo CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
                <button
                  id="btn-landing-primary-signup"
                  type="button"
                  onClick={onSignIn}
                  disabled={isLoggingIn}
                  className="min-h-[48px] px-6 py-3.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isLoggingIn ? t('landing_connecting') : t('landing_signup')}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>

                <button
                  id="btn-landing-explore-demo"
                  type="button"
                  onClick={onExploreDemo}
                  className="min-h-[48px] px-5 py-3.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-xl text-sm sm:text-base font-semibold transition-colors cursor-pointer inline-flex items-center justify-center"
                >
                  <span className="truncate">{t('landing_explore')}</span>
                </button>
              </div>

              <p className="text-xs leading-relaxed text-[var(--text-muted)] max-w-lg mx-auto lg:mx-0">
                {t('landing_incremental_note')}
              </p>

              {/* Single clean inline trust line */}
              <ul className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs font-medium text-[var(--text-secondary)]">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)] shrink-0" aria-hidden="true" />
                  <span>{t('landing_free_oss')}</span>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)] shrink-0" aria-hidden="true" />
                  <span>{t('landing_offline')}</span>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-ok-text)] shrink-0" aria-hidden="true" />
                  <span>{t('landing_ai_coach')}</span>
                </li>
              </ul>
            </div>

            {/* Clean Visual Preview */}
            {!previewBroken && (
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-card)]">
                  <img
                    src="/screenshot-dashboard.png"
                    alt={t('landing_hero_img_alt')}
                    width={1280}
                    height={720}
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    className="w-full rounded-xl border border-[var(--border-default)]"
                    onError={() => setPreviewBroken(true)}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Calm 3-Pillar Strip */}
        <section
          aria-label={t('landing_why_aria')}
          className="py-10 sm:py-12 border-y border-[var(--border-default)] bg-[var(--bg-subtle)]"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 reveal">
            <h2 className="sr-only">{t('landing_why_title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 reveal-stagger">
              {WHY_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.titleKey} className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">{t(card.titleKey)}</h3>
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">· {t(card.subKey)}</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                      {t(card.descKey)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-16 sm:py-20 bg-[var(--bg-surface)] border-b border-[var(--border-default)] scroll-mt-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-12 reveal">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {t('landing_features_title')}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
                {t('landing_features_sub')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 reveal-stagger">
              {FEATURE_CARDS.map((feat) => {
                const Icon = feat.icon;
                const badgeClass =
                  feat.tone === 'ok'
                    ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]'
                    : 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]';
                return (
                  <article
                    key={feat.titleKey}
                    className="bg-[var(--bg-canvas)] p-6 rounded-2xl border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${badgeClass}`}>
                        <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)]">{t(feat.titleKey)}</h3>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                        {t(feat.descKey)}
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-[var(--border-default)] text-xs font-semibold text-[var(--accent-text)] flex items-center gap-1.5">
                      <span>{t(feat.footKey)}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="py-16 sm:py-20 bg-[var(--bg-canvas)] border-b border-[var(--border-default)] scroll-mt-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 reveal">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center tracking-tight text-[var(--text-primary)]">
              {t('landing_how_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal-stagger">
              {HOW_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="p-6 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] space-y-2.5"
                >
                  <span className="inline-block text-xs font-bold tracking-wider text-[var(--accent-text)]">
                    {step.num}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
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

        {/* Pricing, FAQ, Comparison & Privacy Disclosures */}
        <section className="py-16 sm:py-20 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-10 reveal">
            {/* Open-Source Pricing Callout */}
            <div
              id="pricing"
              className="text-center p-6 bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-default)] scroll-mt-16 space-y-1.5"
            >
              <div className="text-lg font-extrabold text-[var(--text-primary)]">{t('landing_pricing_t')}</div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('landing_pricing_d')}</p>
            </div>

            {/* FAQ — Collapsed native <details> disclosures */}
            <div id="faq" className="space-y-3 scroll-mt-16">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">{t('landing_faq_title')}</h2>
              <div className="space-y-2.5">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.qKey}
                    className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] open:border-[var(--border-strong)]"
                  >
                    <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span>{t(item.qKey)}</span>
                      <ChevronDown
                        className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="px-4 pb-4 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-default)] pt-3">
                      {t(item.aKey)}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Secondary Comparison Table — Collapsed native <details> disclosure */}
            <details
              id="comparison"
              className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] open:border-[var(--border-strong)] scroll-mt-16"
            >
              <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span>{t('landing_compare_title')}</span>
                <ChevronDown
                  className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-4 pb-4 pt-3 border-t border-[var(--border-default)] overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] text-left text-[var(--text-primary)]">
                      <th className="p-2.5 border border-[var(--border-default)] font-semibold">
                        {t('landing_cmp_col_feature')}
                      </th>
                      <th className="p-2.5 border border-[var(--border-default)] font-semibold">StudentOS</th>
                      <th className="p-2.5 border border-[var(--border-default)] font-semibold">Notion</th>
                      <th className="p-2.5 border border-[var(--border-default)] font-semibold">Canvas</th>
                      <th className="p-2.5 border border-[var(--border-default)] font-semibold">Motion</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.fKey}>
                        <td className="p-2.5 border border-[var(--border-default)] font-semibold text-[var(--text-primary)]">
                          {t(row.fKey)}
                        </td>
                        <td
                          className={`p-2.5 border border-[var(--border-default)] ${
                            row.highlight ? 'text-[var(--status-ok-text)] font-medium' : 'font-bold text-[var(--text-primary)]'
                          }`}
                        >
                          {t(row.sKey)}
                        </td>
                        <td className="p-2.5 border border-[var(--border-default)]">{row.nKey ? t(row.nKey) : '—'}</td>
                        <td className="p-2.5 border border-[var(--border-default)]">{row.cKey ? t(row.cKey) : '—'}</td>
                        <td className="p-2.5 border border-[var(--border-default)]">{row.mKey ? t(row.mKey) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {/* Privacy & Permissions — Concise summary + collapsed permissions table */}
            <div id="privacy" className="space-y-3 pt-2 scroll-mt-16">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <h2>{t('landing_privacy_title')}</h2>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {t('landing_priv_intro')}
              </p>

              <details className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] open:border-[var(--border-strong)]">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm font-semibold text-[var(--text-primary)] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span>{t('landing_faq_2q')}</span>
                  <ChevronDown
                    className="w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="px-4 pb-4 pt-3 border-t border-[var(--border-default)] overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)] text-left text-[var(--text-primary)]">
                        <th className="p-2 border border-[var(--border-default)] font-semibold">
                          {t('landing_priv_col_tool')}
                        </th>
                        <th className="p-2 border border-[var(--border-default)] font-semibold">
                          {t('landing_priv_col_why')}
                        </th>
                        <th className="p-2 border border-[var(--border-default)] font-semibold">
                          {t('landing_priv_col_ai')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                      {PRIVACY_ROWS.map(([id, toolKey, whyKey, aiKey]) => (
                        <tr key={id}>
                          <td className="p-2 border border-[var(--border-default)] font-semibold text-[var(--text-primary)]">
                            {t(toolKey)}
                          </td>
                          <td className="p-2 border border-[var(--border-default)]">{t(whyKey)}</td>
                          <td className="p-2 border border-[var(--border-default)]">{t(aiKey)}</td>
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

        {/* Bottom CTA Banner */}
        <section className="py-14 sm:py-18 bg-[var(--accent-fill)] text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-5 reveal">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('landing_cta_title')}</h2>
            <p className="text-sm sm:text-base text-white/95 max-w-xl mx-auto leading-relaxed">
              {t('landing_cta_sub')}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onSignIn}
                disabled={isLoggingIn}
                className="px-7 py-3.5 bg-white text-[#993D1E] hover:bg-[#F7F6F2] disabled:opacity-50 rounded-xl text-sm sm:text-base font-extrabold inline-flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <GraduationCap className="w-5 h-5 text-[#993D1E] shrink-0" aria-hidden="true" />
                <span>{t('landing_cta_btn')}</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="px-5 py-3.5 bg-transparent border border-white/80 hover:bg-white/15 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('landing_watch')}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Demo Modal */}
      {demoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDemoOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
        >
          <div
            className="bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-[var(--shadow-card-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 id="demo-modal-title" className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Play className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span>{t('landing_demo_title')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setDemoOpen(false)}
                aria-label={t('common_close')}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-[var(--border-default)] relative">
              <video
                src="/demo.mp4"
                poster="/screenshot-dashboard.png"
                controls
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLVideoElement).style.display = 'none';
                  const fb = document.getElementById('demo-fallback');
                  if (fb) fb.style.display = 'flex';
                }}
              >
                {t('landing_demo_unsupported')}
              </video>
              <div
                id="demo-fallback"
                style={{ display: 'none' }}
                className="absolute inset-0 flex-col items-center justify-center text-center p-6 space-y-3 bg-[var(--bg-subtle)] text-[var(--text-primary)]"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center">
                  <Play className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-bold">{t('demo_video_missing')}</p>
                <p className="text-xs text-[var(--text-secondary)] max-w-md">{t('landing_demo_fallback_desc')}</p>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  className="mt-2 px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {t('landing_explore')}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{t('landing_demo_note')}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[var(--bg-surface)] border-t border-[var(--border-default)] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-4 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span className="font-semibold text-[var(--text-primary)]">{t('landing_brand_name')}</span>
              <span className="text-[var(--text-muted)]">{t('landing_footer_tagline')}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-text)] font-medium">
                {t('landing_footer_privacy')}
              </a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-text)] font-medium">
                {t('landing_footer_terms')}
              </a>
              <a href="mailto:buianhuy2009@gmail.com" className="hover:text-[var(--accent-text)] font-medium">
                {t('landing_footer_contact')}
              </a>
              <button
                type="button"
                onClick={onExploreDemo}
                className="hover:text-[var(--accent-text)] font-medium cursor-pointer"
              >
                {t('landing_explore')}
              </button>
              <a
                href="https://github.com/buianhuy2009/Sutdent-Command-Center"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--accent-text)] font-medium inline-flex items-center gap-1"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4">
            <div className="text-[11px] text-center sm:text-left text-[var(--text-muted)]">
              {t('landing_footer_copyright')}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-text)]">
                {t('landing_footer_privacy')}
              </a>{' '}
              •{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-text)]">
                {t('landing_footer_terms')}
              </a>{' '}
              •{' '}
              <a href="#pricing" className="underline hover:text-[var(--accent-text)]">
                {t('landing_footer_pricing')}
              </a>{' '}
              •{' '}
              <a href="#faq" className="underline hover:text-[var(--accent-text)]">
                {t('landing_nav_faq')}
              </a>{' '}
              •{' '}
              <a href="#comparison" className="underline hover:text-[var(--accent-text)]">
                {t('landing_footer_comparison')}
              </a>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </footer>
    </div>
  );
};
