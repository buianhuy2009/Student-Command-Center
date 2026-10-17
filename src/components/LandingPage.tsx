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
import { t, useLang, getLang } from '../services/i18n';
import { LanguageToggle } from './LanguageToggle';

interface LandingPageProps {
  onSignIn: () => void;
  onSignInWorkspace?: () => void;
  onExploreDemo: () => void;
  isLoggingIn: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

// Honest product cards — real capabilities from the codebase, NOT user testimonials.
const WHY_CARDS = [
  { icon: Star, titleKey: 'landing_why_oss_t', descKey: 'landing_why_oss_d', uni: 'GitHub — MIT Licensed', avatar: '★' },
  { icon: WifiOff, titleKey: 'landing_why_offline_t', descKey: 'landing_why_offline_d', uni: 'Dexie • PWA', avatar: '◆' },
  { icon: Bot, titleKey: 'landing_why_ai_t', descKey: 'landing_why_ai_d', uni: 'Gemini 2.0 Flash + Groq 70B', avatar: '✦' },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onSignInWorkspace,
  onExploreDemo,
  isLoggingIn,
  darkMode,
  setDarkMode,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useLang();

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
                Student Command Center
              </span>
            </div>
          </div>

          {/* Section nav — anchor links to real page sections */}
          <nav aria-label="Sections" className="hidden md:flex items-center gap-1 text-xs font-semibold text-[#5E5D59] dark:text-[#B5B2A8]">
            <a href="#features" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_features')}</a>
            <a href="#how" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_how')}</a>
            <a href="#faq" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_faq')}</a>
            <a href="#privacy" className="px-2.5 py-1.5 rounded-lg hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] hover:text-[#141413] dark:hover:text-[#F5F4ED]">{t('landing_nav_privacy')}</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://github.com/buianhuy2009/Sutdent-Command-Center" target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] text-xs font-semibold" title="Star on GitHub">
              <span>★</span> GitHub
            </a>
            <LanguageToggle compact className="hidden sm:inline-flex" />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#E8E6DC] dark:hover:bg-[#1F1E1B] transition-colors cursor-pointer"
              title="Toggle Dark / Light Theme"
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

            {onSignInWorkspace && (
              <p className="mt-3 max-w-full overflow-hidden px-4 sm:px-0 text-center text-xs leading-relaxed text-[#5E5D59] dark:text-[#B5B2A8]">
                <span className="break-words">{t('landing_need_sync')}{' '}</span>
                <button
                  type="button"
                  onClick={onSignInWorkspace}
                  disabled={isLoggingIn}
                  className="inline-block max-w-full truncate align-baseline text-[#C96442] hover:text-[#A94E33] hover:underline font-semibold cursor-pointer underline-offset-2 disabled:opacity-50"
                >
                  {t('landing_workspace_signin')}
                </button>
              </p>
            )}

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
              <img src="/screenshot-dashboard.png" alt="Student Command Center dashboard — Canvas + Workspace unified" width={1280} height={720} fetchPriority="high" loading="eager" decoding="async" className="w-full rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] shadow-xl transition-transform duration-500 hover:scale-[1.01] hover:shadow-2xl" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            </div>

            {/* Trust Badges */}
            <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-6 text-[11px] sm:text-xs text-[#5E5D59] dark:text-[#B5B2A8] max-w-xl mx-auto px-4 sm:px-0">
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">Free &amp; OSS</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">Canvas Feed</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">Workspace Sync</span>
              </div>
            </div>

            {/* Trusted integrations */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-6 opacity-60 px-4 sm:px-0">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#5E5D59] shrink-0">Trusted integrations</span>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-full text-xs font-bold text-[#5E5D59]">
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl shrink-0">Canvas / Instructure</span>
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl inline-flex min-w-0 items-center gap-1.5 shrink-0"><GoogleIcon className="w-3.5 h-3.5 shrink-0" /><span className="truncate">Workspace</span></span>
                <span className="max-w-full truncate px-3 py-1.5 bg-white dark:bg-[#1A1917] border border-[#E8E6DC] dark:border-[#2C2B27] rounded-xl shrink-0">Dexie • PWA</span>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations at a glance */}
        <section aria-label="Integrations at a glance" className="border-t border-[#E8E6DC] dark:border-[#2C2B27] bg-white/60 dark:bg-[#1A1917]/40">
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
        <section aria-label="Why StudentOS" className="py-10 bg-[#E8E6DC]/40 dark:bg-[#1A1917]/60 border-b border-[#E8E6DC] dark:border-[#2C2B27]">
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
                      <div><div className="text-xs font-bold">{t(c.titleKey)}</div><div className="text-[10px] text-[#5E5D59]">{c.uni}</div></div>
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
                    Filter assignments into <strong>Unfinished</strong> and <strong>Finished</strong> views, filter by course subject, and jump directly to quizzes with one-click Canvas redirect buttons.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>Zero Manual Data Entry</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 2: AI Study Coach */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">AI Study Coach (Gemini 2.0 Flash)</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    Ask questions, plan 45-minute focus blocks, break down complex essays, and get personalized study recommendations aware of your real assignments and schedule.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>Powered by Gemini 2.0 Flash</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 3: Gmail Scanner */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">Gmail Scanner &amp; Spam Filter</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    Intelligently categorizes teacher emails, isolates exam alerts, and filters out shopping &amp; newsletter spam with bilingual (EN/VI) support and one-click quick draft replies.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>Smart Spam Shield</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 4: Assignment Tracker */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <CheckSquare className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">Master Assignment Tracker</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    Add tasks with natural language &quot;Smart Add&quot; (e.g. <em>&apos;Physics lab due next Friday&apos;</em>), track priority matrices, and sync two-way with Google Sheets.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>Google Sheets Integration</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 5: Google Drive Organizer */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">Drive File Categorizer</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    Automatically sorts school files into Google Docs, Sheets, Slides, and PDFs with quick-search so you never lose lecture slides or homework sheets.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>Categorized Files</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Feature 6: Doc Starter Studio */}
              <div className="bg-[#E8E6DC] dark:bg-[#1A1917] p-6 rounded-2xl border border-[#E8E6DC] dark:border-[#2C2B27] hover:border-[#C96442] dark:hover:border-[#C96442] transition-all shadow-card flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#C96442]/15 text-[#C96442] flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[#141413] dark:text-[#F5F4ED]">Doc Starter Studio</h3>
                  <p className="text-xs text-[#5E5D59] dark:text-[#B5B2A8] mt-2 leading-relaxed">
                    Generate professionally formatted MLA 9th or APA 7th edition Google Docs directly in your Google Drive with customizable action milestones.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8E6DC] dark:border-[#2C2B27] text-[11px] font-semibold text-[#C96442] flex items-center gap-1">
                  <span>MLA &amp; APA Formatted</span>
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
                <thead className="sticky top-0 z-10"><tr className="bg-[#E8E6DC] dark:bg-[#1F1E1B] text-left"><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Feature</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">StudentOS</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Notion</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Canvas</th><th className="p-2 border bg-[#E8E6DC] dark:bg-[#1F1E1B]">Motion</th></tr></thead>
                <tbody className="bg-white dark:bg-[#1A1917]">
                  <tr><td className="p-2 border font-semibold">Canvas LMS sync</td><td className="p-2 border text-emerald-600">✓ Live REST + iCal</td><td className="p-2 border">—</td><td className="p-2 border">Native only</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">Gmail AI scanner</td><td className="p-2 border text-emerald-600">✓ Bilingual EN/VI</td><td className="p-2 border">—</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">Sheets 2-way</td><td className="p-2 border text-emerald-600">✓ Master tracker</td><td className="p-2 border">Manual</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">Offline PWA</td><td className="p-2 border text-emerald-600">✓ Dexie + Workbox</td><td className="p-2 border">Partial</td><td className="p-2 border">—</td><td className="p-2 border">—</td></tr>
                  <tr><td className="p-2 border font-semibold">Price</td><td className="p-2 border font-bold">Free &amp; OSS</td><td className="p-2 border">Freemium</td><td className="p-2 border">Institution</td><td className="p-2 border">$19/mo</td></tr>
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
              {getLang() === 'vi'
                ? 'StudentOS chỉ xin 6 quyền Google (trước đây là 13), và chỉ Gmail là quyền nhạy cảm — chỉ xin khi bạn bật "Quét Gmail". Mọi bài tập AI tìm thấy đều chờ bạn xác nhận. Thu hồi quyền bất cứ lúc nào trong Tài khoản Google.'
                : 'StudentOS asks Google for 6 permissions (down from 13); only Gmail is sensitive, and it is requested only when you turn on "Scan Gmail". Every assignment the AI finds waits for your confirmation. Revoke anytime in your Google Account.'}
            </p>
            <div className="overflow-x-auto text-left">
              <table className="w-full text-[11px] border-collapse mt-2">
                <thead>
                  <tr className="bg-[#E8E6DC] dark:bg-[#1F1E1B]">
                    <th className="p-1.5 border">{getLang() === 'vi' ? 'Quyền' : 'Scope'}</th>
                    <th className="p-1.5 border">{getLang() === 'vi' ? 'Để làm gì' : 'Purpose'}</th>
                    <th className="p-1.5 border">{getLang() === 'vi' ? 'Gửi cho AI?' : 'Sent to AI?'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['classroom.courses.readonly', 'Tên các lớp của bạn', 'Your class names', 'Không', 'No'],
                    ['classroom.coursework.me.readonly', 'Bài tập & hạn nộp của bạn', 'Your coursework & due dates', 'Không (đã có sẵn ngày)', 'No (dates are structured)'],
                    ['classroom.announcements.readonly', 'Thông báo của thầy cô', 'Teacher announcements', 'Có — nội dung thông báo, cho Gemini (Groq nếu Gemini lỗi)', 'Yes — post text, to Gemini (Groq if Gemini fails)'],
                    ['calendar.events', 'Lịch học để không xếp trùng; thêm buổi học khi bạn bấm', 'Class times; add study sessions when you tap', 'Không', 'No'],
                    ['drive.file', 'Chỉ file StudentOS tạo hoặc bạn chọn', 'Only files StudentOS creates or you pick', 'Không', 'No'],
                    ['gmail.readonly', 'Chỉ khi bật "Quét Gmail": tìm bài tập trong thư', 'Only with "Scan Gmail": find homework in mail', 'Có — người gửi, tiêu đề, ≤1.500 ký tự nội dung, cho Gemini (Groq nếu Gemini lỗi)', 'Yes — sender, subject, ≤1,500 chars, to Gemini (Groq if Gemini fails)'],
                  ].map(([scope, vi, en, aiVi, aiEn]) => (
                    <tr key={scope}>
                      <td className="p-1.5 border font-mono">{scope}</td>
                      <td className="p-1.5 border">{getLang() === 'vi' ? vi : en}</td>
                      <td className="p-1.5 border">{getLang() === 'vi' ? aiVi : aiEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="text-xs font-bold text-[#C96442] underline cursor-pointer">
                {getLang() === 'vi' ? 'Xem đầy đủ: dữ liệu nào gửi cho AI, lưu ở đâu, dành cho phụ huynh' : 'Full details: what goes to the AI, where data lives, for parents'}
              </button>
              <span className="text-xs text-[#5E5D59]">•</span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#C96442] underline">
                {getLang() === 'vi' ? 'Điều khoản dịch vụ' : 'Terms of Service'}
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
              <h3 className="text-lg font-bold flex items-center gap-2"><Play className="w-5 h-5 text-[#C96442]" /> 60s Demo — Student Command Center</h3>
              <button onClick={()=>setDemoOpen(false)} className="p-2 hover:bg-[#E8E6DC] dark:hover:bg-[#252422] rounded-xl"><X className="w-4 h-4" /></button>
            </div>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-[#E8E6DC] dark:border-[#2C2B27] relative">
              <video src="/demo.mp4" poster="/screenshot-dashboard.png" controls autoPlay muted playsInline className="w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLVideoElement).style.display='none'; const fb=document.getElementById('demo-fallback'); if(fb) fb.style.display='flex'; }}>
                Your browser does not support video.
              </video>
              <div id="demo-fallback" style={{display:'none'}} className="absolute inset-0 flex-col items-center justify-center text-center p-6 space-y-3 bg-[#E8E6DC] dark:bg-[#1F1E1B]">
                <div className="w-14 h-14 rounded-2xl bg-[#C96442] text-white flex items-center justify-center"><Play className="w-6 h-6" /></div>
                <p className="text-sm font-bold">{t('demo_video_missing')}</p>
                <p className="text-xs text-[#5E5D59] max-w-md">Connect Canvas → Sync Google Workspace → AI Study Coach plans your day. Replace public/demo.mp4 with your Loom embed.</p>
                <div className="w-full aspect-video rounded-xl bg-[#E8E6DC] dark:bg-[#252422] border border-dashed border-[#E8E6DC] dark:border-[#2C2B27] flex items-center justify-center text-xs text-[#5E5D59]">Add your Loom link: update public/demo.mp4 or set LOOM_URL env</div>
                <button onClick={onExploreDemo} className="mt-2 px-4 py-2 bg-[#C96442] hover:bg-[#A94E33] text-white rounded-xl text-xs font-bold">{t('landing_explore')}</button>
              </div>
            </div>
            <div className="text-[11px] text-[#5E5D59]">Tip: Replace <code className="font-mono bg-[#E8E6DC] dark:bg-[#252422] px-1 rounded">public/demo.mp4</code> with your 60s Loom recording. YouTube fallback shown if missing.</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-[#141413] border-t border-[#E8E6DC] dark:border-[#2C2B27] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col gap-4 text-xs text-[#5E5D59] dark:text-[#B5B2A8]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#C96442]" aria-hidden="true" />
              <span className="font-semibold text-[#141413] dark:text-[#F5F4ED]">Student Command Center</span>
              <span>• Open Source Academic Hub</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))}
                className="hover:text-[#C96442] font-medium cursor-pointer"
              >
                Privacy
              </button>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#C96442] font-medium">Terms</a>
              <a href="mailto:buianhuy2009@gmail.com" className="hover:text-[#C96442] font-medium">Contact</a>
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
              © 2026 Student Command Center — MIT Licensed. <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scc-open-privacy'))} className="underline hover:text-[#C96442] cursor-pointer">Privacy</button> • <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C96442]">Terms</a> • <a href="#pricing" className="underline">Pricing</a> • <a href="#faq" className="underline">FAQ</a> • <a href="#comparison" className="underline">Comparison</a> • OG 1200×630
            </div>
            <LanguageToggle />
          </div>
        </div>
      </footer>
    </div>
  );
};
