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

// Honest product cards — real capabilities from the codebase, NOT user testimonials.
const WHY_CARDS = [
  { icon: Star, titleKey: 'landing_why_oss_t', descKey: 'landing_why_oss_d', uniKey: 'landing_why_oss_sub', avatar: '★' },
  { icon: WifiOff, titleKey: 'landing_why_offline_t', descKey: 'landing_why_offline_d', uniKey: 'landing_why_offline_sub', avatar: '◆' },
  { icon: Bot, titleKey: 'landing_why_ai_t', descKey: 'landing_why_ai_d', uniKey: 'landing_why_ai_sub', avatar: '✦' },
] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onExploreDemo,
  isLoggingIn,
  darkMode,
  setDarkMode,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  // Scroll reveal: fade/slide sections and stagger grids in once via IntersectionObserver.
  // Elements below the fold start hidden (.reveal/.reveal-stagger) and get .is-visible
  // on first intersect; above-fold hero keeps its own entrance animation.
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    const els = root.querySelectorAll('.reveal, .reveal-lift, .reveal-stagger');
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[#FAF3E4] dark:bg-[#141413] text-[#141413] dark:text-[#F5F4ED] transition-colors flex flex-col font-sans selection:bg-[#C96442] selection:text-white landing-smooth">
      {/* Top Header — semantic role=banner */}
      <header role="banner" className="sticky top-0 z-40 bg-[#FAF3E4]/85 dark:bg-[#141413]/90 backdrop-blur-md border-b border-[#E8E6DC] dark:border-[#2C2B27]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C96442] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#C96442]/20" aria-hidden="true">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-[#141413] dark:text-[#F5F4ED]">
                {t('landing_brand_name')}
              </span>
            </div>
          </div>

          {/* Section nav — anchor links to real page sections */}
          <nav aria-label={t('landing_nav_sections_aria')} className="hidden md:flex items-center gap-1 text-xs font-semibold text-[#5E5D59] dark:text-[#B5B2A8]">
            <a href="#features" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_features')}</a>
            <a href="#how" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_how')}</a>
            <a href="#faq" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_faq')}</a>
            <a href="#privacy" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_privacy')}</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://github.com/buianhuy2009/Sutdent-Command-Center" target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-xs font-semibold" title={t('landing_star_github')}>
              <span>★</span> GitHub
            </a>
            <LanguageToggle compact className="hidden sm:inline-flex" />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer"
              title={t('landing_toggle_theme')}
              aria-label={t('landing_toggle_theme')}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#C96442]" />}
            </button>

            <button
              onClick={onExploreDemo}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] rounded-xl transition-colors cursor-pointer"
            >
              {t('landing_explore')}
            </button>

            <button
              onClick={onSignIn}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-transparent border border-[#E8E6DC] dark:border-[#2C2B27] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] disabled:opacity-50 text-[#141413] dark:text-[#F5F4ED] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{isLoggingIn ? t('landing_connecting') : t('landing_signin')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
          {/* Background Glow + drifting warm blobs */}
          <div className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,120vw)] h-[min(600px,120vw)] max-w-none bg-[#C96442]/10 dark:bg-[#C96442]/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="landing-blob-a absolute -top-24 -left-24 w-[min(420px,80vw)] h-[min(420px,80vw)] bg-gradient-to-br from-[#E8A07E]/30 via-[#C96442]/15 to-transparent rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="landing-blob-b absolute top-1/3 -right-28 w-[min(460px,85vw)] h-[min(460px,85vw)] bg-gradient-to-bl from-[#F2C94C]/20 via-[#E8A07E]/15 to-transparent rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C96442]/10 dark:bg-[#C96442]/15 border border-[#C96442]/20 text-[#A94E33] dark:text-[#E8A07E] text-xs font-semibold mb-6 shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
              <Sparkles className="w-3.5 h-3.5 text-[#C96442]" />
              <span>{t('landing_badge')}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold text-[#141413] dark:text-[#F5F4ED] tracking-tight leading-[1.15] max-w-4xl mx-auto text-balance break-words" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui' }}>
              {t('landing_h1_a')}{' '}
              <span className="text-[#C96442]">
                {t('landing_h1_b')}
              </span>
            </h1>

            {/* Subcopy */}
            <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg text-[#5E5D59] dark:text-[#B5B2A8] max-w-2xl mx-auto leading-relaxed text-balance break-words">{t('landing_sub')}</p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0 max-w-full">
              <button
                id="btn-landing-primary-signup"
                onClick={onSignIn}
                disabled={isLoggingIn}
                className="w-full sm:w-auto max-w-full min-h-[48px] px-8 py-4 bg-[#C96442] hover:bg-[#A94E33] disabled:opacity-50 text-white rounded-2xl text-base font-bold shadow-lg shadow-[#C96442]/25 flex items-center justify-center gap-3 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.99]"
              >
                <GoogleIcon className="w-5 h-5 shrink-0" />
                <span className="truncate">{isLoggingIn ? t('landing_connecting') : t('landing_signup')}</span>
                <ArrowRight className="w-4 h-4 ml-1 shrink-0" />
              </button>

              <button
                id="btn-landing-explore-demo"
                onClick={onExploreDemo}
                className="w-full sm:w-auto max-w-full min-h-[48px] px-6 py-4 bg-white dark:bg-[#1A1917] hover:bg-[#E8E6DC] dark:hover:bg-[#252422] text-[#141413] dark:text-[#F5F4ED] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-2xl text-base font-semibold transition-all cursor-pointer shadow-xs inline-flex items-center justify-center"
              >
                <span className="truncate">{t('landing_explore')}</span>
              </button>
            </div>

            <p className="mt-3 max-w-lg mx-auto px-4 sm:px-0 text-center text-xs leading-relaxed text-[#5E5D59] dark:text-[#B5B2A8]">
              {t('landing_incremental_note')}
            </p>

            {/* Social-proof stats strip */}
            <div className="mt-6 mx-4 sm:mx-auto max-w-xl backdrop-blur-md rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] bg-white/60 dark:bg-[#1A1917]/60 px-4 py-3.5 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 sm:gap-6 text-xs sm:text-[13px] font-semibold text-[#141413] dark:text-[#F5F4ED] shadow-sm">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('landing_free_oss')}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C96442] shrink-0" aria-hidden="true" />
                <span className="truncate">{t('landing_offline')}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C96442] shrink-0" aria-hidden="true" />
                <span className="truncate">{t('landing_ai_coach')}</span>
              </span>
            </div>

            {/* LCP hero image */}
            <div className="mt-8 max-w-3xl mx-auto">
              <img src="/screenshot-dashboard.png" alt={t('landing_hero_img_alt')} width={1280} height={720} fetchPriority="high" loading="eager" decoding="async" className="w-full rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] shadow-xl transition-transform duration-500 hover:scale-[1.01] hover:shadow-2xl" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            </div>

            {/* Trust Badges */}
            <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-6 text-[11px] sm:text-xs text-[#5E5D59] dark:text-[#B5B2A8] max-w-xl mx-auto px-4 sm:px-0">
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">{t('landing_trust_oss')}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">{t('landing_trust_canvas')}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">{t('landing_trust_google')}</span>
              </div>
            </div>

            {/* Trusted integrations */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-6 opacity-60 px-4 sm:px-0">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#5E5D59] shrink-0">{t('landing_works_with')}</span>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-full text-xs font-bold text-[#5E5D59]">
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl shrink-0">{t('landing_tool_canvas')}</span>
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl inline-flex min-w-0 items-center gap-1.5 shrink-0"><GoogleIcon className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{t('landing_tool_google')}</span></span>
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl shrink-0">{t('landing_tool_offline')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations at a glance */}
        <section aria-label={t('landing_integrations_aria')} className="border-t border-[#E8E6DC] dark:border-[#2C2B27] bg-white/60 dark:bg-[#1A1917]/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center max-w-full reveal">
            <p className="text-[11px] font-bold tracking-widest uppercase text-[#5E5D59] dark:text-[#B5B2A8]">{t('landing_strip_title')}</p>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-left reveal-stagger">
              <div className="min-w-0 px-4 py-3 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl">
                <dt className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_card_canvas_t')}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('landing_card_canvas_d')}</dd>
              </div>
              <div className="min-w-0 px-4 py-3 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl">
                <dt className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_card_gmail_t')}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('landing_card_gmail_d')}</dd>
              </div>
              <div className="min-w-0 px-4 py-3 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl">
                <dt className="text-xs font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_card_offline_t')}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('landing_card_offline_d')}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Why — honest product facts, not testimonials */}
        <section aria-label={t('landing_why_aria')} className="py-10 bg-[#E8E6DC]/40 dark:bg-[#1A1917]/60 border-b border-[#E8E6DC] dark:border-[#2C2B27]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 reveal">
            <h2 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight mb-8">{t('landing_why_title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 reveal-stagger">
              {WHY_CARDS.map((c, i)=>{
                const Icon = c.icon;
                return (
                  <div key={i} className="p-5 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] shadow-card space-y-3">
                    <Icon className="w-4 h-4 text-[#C96442]" />
                    <p className="text-xs leading-relaxed text-[#141413] dark:text-[#F5F4ED]">{t(c.descKey)}</p>
                    <div className="flex items-center gap-2 pt-2 border-t border-[#E8E6DC]/40">
                      <div className="w-7 h-7 rounded-full bg-[#C96442] text-white flex items-center justify-center text-xs font-bold">{c.avatar}</div>
                      <div><div className="text-xs font-bold">{t(c.titleKey)}</div><div className="text-[10px] text-[#5E5D59]">{t(c.uniKey)}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="py-12 bg-white dark:bg-[#141413] border-y border-[#E8E6DC] dark:border-[#2C2B27] scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 reveal">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#141413] dark:text-[#F5F4ED] tracking-tight">
                {t('landing_features_title')}
              </h2>
              <p className="mt-3 text-sm text-[#5E5D59] dark:text-[#B5B2A8]">
                {t('landing_features_sub')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 reveal-stagger">
              {/* Feature 1: Canvas LMS */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <Layers className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_card_canvas_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_canvas_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_canvas_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 2: AI Study Coach */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_feat_coach_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_coach_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_coach_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 3: Gmail Scanner */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_feat_gmail_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_gmail_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_gmail_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 4: Assignment Tracker */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <CheckSquare className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_feat_tracker_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_tracker_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_tracker_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 5: Google Drive Organizer */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_feat_drive_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_drive_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_drive_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 6: Doc Starter Studio */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">{t('landing_feat_docs_t')}</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    {t('landing_feat_docs_d')}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>{t('landing_feat_docs_foot')}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — real setup flow, no fiction */}
        <section id="how" className="py-12 bg-[#E8E6DC] dark:bg-[#141413] border-b border-[#E8E6DC] dark:border-[#2C2B27] scroll-mt-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 reveal">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center tracking-tight">{t('landing_how_title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 reveal-stagger">
              <div className="p-5 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-2">
                <h3 className="text-sm font-bold">{t('landing_how_1t')}</h3>
                <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] leading-relaxed">{t('landing_how_1d')}</p>
              </div>
              <div className="p-5 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-2">
                <h3 className="text-sm font-bold">{t('landing_how_2t')}</h3>
                <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] leading-relaxed">{t('landing_how_2d')}</p>
              </div>
              <div className="p-5 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] space-y-2">
                <h3 className="text-sm font-bold">{t('landing_how_3t')}</h3>
                <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] leading-relaxed">{t('landing_how_3d')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison vs Notion/Canvas/Motion + Pricing anchor */}
        <section id="comparison" className="py-12 bg-[#E8E6DC] dark:bg-[#141413] border-b border-[#E8E6DC] dark:border-[#2C2B27] scroll-mt-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 reveal">
            <h2 className="text-lg font-extrabold text-center">{t('landing_compare_title')}</h2>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10"><tr className="bg-[#E8E6DC] dark:bg-[#1F1E1B] text-left"><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">{t('landing_cmp_col_feature')}</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">StudentOS</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Notion</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Canvas</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Motion</th></tr></thead>
                <tbody className="bg-white dark:bg-[#1A1917]">
                  <tr><td className="p-2 border font-semibold">{t('landing_cmp_r1_f')}</td><td className="p-2 border text-emerald-600">{t('landing_cmp_r1_s')}</td><td className="p-2 border">—</td><td className="p-2 border">{t('landing_cmp_r1_c')}</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">{t('landing_cmp_r2_f')}</td><td className="p-2 border text-emerald-600">{t('landing_cmp_r2_s')}</td><td className="p-2 border">—</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">{t('landing_cmp_r3_f')}</td><td className="p-2 border text-emerald-600">{t('landing_cmp_r3_s')}</td><td className="p-2 border">{t('landing_cmp_r3_n')}</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">{t('landing_cmp_r4_f')}</td><td className="p-2 border text-emerald-600">{t('landing_cmp_r4_s')}</td><td className="p-2 border">{t('landing_cmp_r4_n')}</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">{t('landing_cmp_r5_f')}</td><td className="p-2 border font-bold">{t('landing_cmp_r5_s')}</td><td className="p-2 border">{t('landing_cmp_r5_n')}</td><td className="p-2 border">{t('landing_cmp_r5_c')}</td><td className="p-2 border">{t('landing_cmp_r5_m')}</td></tr>
                </tbody>
              </table>
            </div>
            <div id="pricing" className="text-center p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] scroll-mt-16">
              <div className="text-lg font-extrabold">{t('landing_pricing_t')}</div>
              <div className="text-xs text-[#5E5D59]">{t('landing_pricing_d')}</div>
            </div>
            <div id="faq" className="space-y-2 scroll-mt-16">
              <h3 className="font-bold text-sm">{t('landing_faq_title')}</h3>
              <details className="p-3 bg-white dark:bg-[#1A1917] rounded-xl border text-xs"><summary className="font-semibold cursor-pointer">{t('landing_faq_1q')}</summary><p className="mt-2 text-[#5E5D59]">{t('landing_faq_1a')}</p></details>
              <details className="p-3 bg-white dark:bg-[#1A1917] rounded-xl border text-xs"><summary className="font-semibold cursor-pointer">{t('landing_faq_2q')}</summary><p className="mt-2 text-[#5E5D59]">{t('landing_faq_2a')}</p></details>
              <details className="p-3 bg-white dark:bg-[#1A1917] rounded-xl border text-xs"><summary className="font-semibold cursor-pointer">{t('landing_faq_3q')}</summary><p className="mt-2 text-[#5E5D59]">{t('landing_faq_3a')}</p></details>
            </div>
          </div>
        </section>
        {/* Privacy & Scopes Transparency — consolidated single disclosure */}
        <section id="privacy" className="py-10 bg-white dark:bg-[#141413] border-b border-[#E8E6DC] dark:border-[#2C2B27] scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3 reveal">
            <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F4ED] flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4 text-[#C96442]" /> {t('landing_privacy_title')}</h3>
            <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] leading-relaxed">
              {t('landing_priv_intro')}
            </p>
            <div className="overflow-x-auto text-left">
              <table className="w-full text-[11px] border-collapse mt-2">
                <thead>
                  <tr className="bg-[#E8E6DC] dark:bg-[#1F1E1B]">
                    <th className="p-1.5 border">{t('landing_priv_col_tool')}</th>
                    <th className="p-1.5 border">{t('landing_priv_col_why')}</th>
                    <th className="p-1.5 border">{t('landing_priv_col_ai')}</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['classroom', 'landing_priv_t_classroom', 'landing_priv_w_classroom', 'landing_priv_a_classroom'],
                    ['calendar', 'landing_priv_t_calendar', 'landing_priv_w_calendar', 'landing_priv_a_calendar'],
                    ['drive_sheets', 'landing_priv_t_drive', 'landing_priv_w_drive', 'landing_priv_a_drive'],
                    ['gmail', 'landing_priv_t_gmail', 'landing_priv_w_gmail', 'landing_priv_a_gmail'],
                  ] as const).map(([id, toolKey, whyKey, aiKey]) => (
                    <tr key={id}>
                      <td className="p-1.5 border font-semibold">{t(toolKey)}</td>
                      <td className="p-1.5 border">{t(whyKey)}</td>
                      <td className="p-1.5 border">{t(aiKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="text-xs font-bold text-[#C96442] underline cursor-pointer">
                {t('landing_priv_full_link')}
              </button>
              <span className="text-xs text-[#5E5D59]">•</span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#C96442] underline">
                {t('landing_terms_link')}
              </a>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="py-16 sm:py-20 bg-[#C96442] text-white text-center relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 space-y-6 reveal">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {t('landing_cta_title')}
            </h2>
            <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto">
              {t('landing_cta_sub')}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onSignIn}
                disabled={isLoggingIn}
                className="px-8 py-4 bg-white text-[#C96442] hover:bg-[#E8E6DC] disabled:opacity-50 rounded-2xl text-base font-extrabold shadow-xl inline-flex items-center gap-3 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <GraduationCap className="w-5 h-5 text-[#C96442]" />
                <span>{t('landing_cta_btn')}</span>
              </button>
              <button onClick={()=>setDemoOpen(true)} className="px-6 py-4 bg-transparent border-2 border-white/40 hover:bg-white/10 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 transition-colors">
                <Play className="w-4 h-4" /> {t('landing_watch')}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Demo Modal */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setDemoOpen(false)}>
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Play className="w-5 h-5 text-[#C96442]" /> {t('landing_demo_title')}</h3>
              <button onClick={()=>setDemoOpen(false)} aria-label={t('common_close')} className="p-2 hover:bg-[#E8E6DC] dark:hover:bg-[#252422] rounded-xl"><X className="w-4 h-4" /></button>
            </div>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-[#E8E6DC] dark:border-[#2C2B27] relative">
              <video src="/demo.mp4" poster="/screenshot-dashboard.png" controls autoPlay muted playsInline className="w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLVideoElement).style.display='none'; const fb=document.getElementById('demo-fallback'); if(fb) fb.style.display='flex'; }}>
                {t('landing_demo_unsupported')}
              </video>
              <div id="demo-fallback" style={{display:'none'}} className="absolute inset-0 flex-col items-center justify-center text-center p-6 space-y-3 bg-[#E8E6DC] dark:bg-[#1F1E1B]">
                <div className="w-14 h-14 rounded-2xl bg-[#C96442] text-white flex items-center justify-center"><Play className="w-6 h-6" /></div>
                <p className="text-sm font-bold">{t('demo_video_missing')}</p>
                <p className="text-xs text-[#5E5D59] max-w-md">{t('landing_demo_fallback_desc')}</p>
                <button onClick={onExploreDemo} className="mt-2 px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold">{t('landing_explore')}</button>
              </div>
            </div>
            <div className="text-[11px] text-[#5E5D59]">{t('landing_demo_note')}</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-[#141413] border-t border-[#E8E6DC] dark:border-[#2C2B27] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col gap-4 text-xs text-[#5E5D59] dark:text-[#B5B2A8]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#C96442]" aria-hidden="true" />
              <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">{t('landing_brand_name')}</span>
              <span>{t('landing_footer_tagline')}</span>
            </div>

            <div className="flex items-center gap-4">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#C96442] font-medium">{t('landing_footer_privacy')}</a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#C96442] font-medium">{t('landing_footer_terms')}</a>
              <a href="mailto:buianhuy2009@gmail.com" className="hover:text-[#C96442] font-medium">{t('landing_footer_contact')}</a>
              <button
                onClick={onExploreDemo}
                className="hover:text-[#C96442] font-medium cursor-pointer"
              >
                {t('landing_explore')}
              </button>
              <a
                href="https://github.com/buianhuy2009/Sutdent-Command-Center"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#C96442] font-medium flex items-center gap-1"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] pt-4">
            <div className="text-[11px] text-center sm:text-left text-[#5E5D59]">
              {t('landing_footer_copyright')} <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C96442]">{t('landing_footer_privacy')}</a> • <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C96442]">{t('landing_footer_terms')}</a> • <a href="#pricing" className="underline">{t('landing_footer_pricing')}</a> • <a href="#faq" className="underline">{t('landing_nav_faq')}</a> • <a href="#comparison" className="underline">{t('landing_footer_comparison')}</a>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </footer>
    </div>
  );
};
