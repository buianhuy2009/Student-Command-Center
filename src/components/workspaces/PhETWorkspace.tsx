import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Atom, ExternalLink, Maximize2, Minimize2, ArrowLeft, Search, X, RefreshCw } from 'lucide-react';
import { IframeErrorBoundary } from '../IframeErrorBoundary';
import { useT, type TranslationKey } from '../../services/i18n';
import { PHET_BUILTIN_SIMS, phetBuiltinUrl, type PhetSubject } from '../../data/phetBuiltin';
import { fetchPhetCatalog, readCachedPhetCatalog, type PhetCatalogSim } from '../../services/phetCatalog';

type PhetFilter = 'All' | PhetSubject;

interface PhetItem {
  id: string;
  title: string;
  englishTitle: string;
  subjects: PhetSubject[];
  description: string;
  url: string;
  thumbnail?: string;
  isNew: boolean;
}

const PHET_CATEGORIES: readonly { id: PhetFilter; labelKey: TranslationKey }[] = [
  { id: 'All', labelKey: 'phet_cat_all' },
  { id: 'Physics', labelKey: 'phet_cat_physics' },
  { id: 'Chemistry', labelKey: 'phet_cat_chemistry' },
  { id: 'Biology', labelKey: 'phet_cat_biology' },
  { id: 'Math', labelKey: 'phet_cat_math' },
  { id: 'Earth', labelKey: 'phet_cat_earth' },
] as const;

const CATEGORY_KEY: Record<PhetSubject, TranslationKey> = {
  Physics: 'phet_cat_physics',
  Chemistry: 'phet_cat_chemistry',
  Biology: 'phet_cat_biology',
  Math: 'phet_cat_math',
  Earth: 'phet_cat_earth',
};

const BUILTIN_BY_NAME = new Map(PHET_BUILTIN_SIMS.map((s) => [s.name, s]));

export const PhETWorkspace: React.FC = () => {
  const { t, lang } = useT();
  const [activeSim, setActiveSim] = useState<PhetItem | null>(null);
  const [category, setCategory] = useState<PhetFilter>('All');
  const [search, setSearch] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // The catalog comes from phet.colorado.edu; the built-in list is only a fallback.
  const [catalog, setCatalog] = useState<PhetCatalogSim[]>(() => readCachedPhetCatalog(lang));
  const [catalogState, setCatalogState] = useState<'loading' | 'live' | 'cache' | 'builtin'>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCatalogState('loading');
    setCatalog(readCachedPhetCatalog(lang));
    fetchPhetCatalog(lang)
      .then((result) => {
        if (cancelled) return;
        setCatalog(result.sims);
        setCatalogState(result.source);
      })
      .catch((err) => {
        console.warn('PhET catalog unavailable:', err);
        if (!cancelled) setCatalogState('builtin');
      });
    return () => {
      cancelled = true;
    };
  }, [lang, reloadToken]);

  const sims = useMemo<PhetItem[]>(() => {
    const items: PhetItem[] =
      catalog.length > 0
        ? catalog.map((s) => {
            const builtin = BUILTIN_BY_NAME.get(s.name);
            return {
              id: s.name,
              title: s.title,
              englishTitle: s.englishTitle,
              subjects: s.subjects,
              description: builtin ? t(builtin.descKey) : '',
              url: s.url,
              thumbnail: s.thumbnail,
              isNew: s.isNew,
            };
          })
        : PHET_BUILTIN_SIMS.map((s) => ({
            id: s.name,
            title: t(s.titleKey),
            englishTitle: t(s.titleKey),
            subjects: [s.category],
            description: t(s.descKey),
            url: phetBuiltinUrl(s.name),
            isNew: false,
          }));
    return items.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.title.localeCompare(b.title));
  }, [catalog, t]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next && wrapperRef.current?.requestFullscreen) {
        await wrapperRef.current.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  }, [isFullscreen]);

  const filtered = sims.filter((s) => {
    if (category !== 'All' && !s.subjects.includes(category)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [s.title, s.englishTitle, s.description, ...s.subjects.map((subject) => t(CATEGORY_KEY[subject]))];
    return haystack.some((text) => text.toLowerCase().includes(q));
  });

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col flex-1 h-full w-full min-h-0 select-none ${
        isFullscreen ? 'fixed inset-0 z-[80] w-screen h-dvh bg-[var(--bg-canvas)] p-3 sm:p-4' : ''
      }`}
    >
      
      {/* Active Sim Viewer */}
      {activeSim ? (
        <div className="flex flex-col flex-1 h-full min-h-0 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)] text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveSim(null)}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('phet_back')}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)]">{activeSim.title}</span>
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? t('desm_exit') : t('desm_expand')}
                aria-label={isFullscreen ? t('desm_exit') : t('desm_expand')}
                className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <a
                href={activeSim.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] font-bold flex items-center gap-1"
              >
                <span>{t('phet_open_tab')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex-1 w-full h-full min-h-0 rounded-2xl overflow-hidden border border-[var(--border-default)] bg-white shadow-xs flex flex-col">
            <IframeErrorBoundary
              title={activeSim.title}
              src={activeSim.url}
              hideHeader={true}
              className="w-full h-full border-0 rounded-none"
            />
          </div>
        </div>
      ) : (
        /* Catalog View */
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-md shadow-[var(--accent-fill)]/20">
                <Atom className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {t('phet_title')}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                    CU Boulder
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t('phet_sub')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {PHET_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                  }`}
                >
                  {t(cat.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('phet_search_ph')}
                aria-label={t('phet_search_aria')}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] focus:border-[var(--accent-fill)] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label={t('phet_clear_search')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium shrink-0" aria-live="polite">
              {t('phet_count', { filtered: filtered.length, total: sims.length })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] shrink-0" role="status">
            <span>
              {catalogState === 'loading'
                ? t('phet_source_loading')
                : catalogState === 'live'
                  ? t('phet_source_live')
                  : catalogState === 'cache'
                    ? t('phet_source_cache')
                    : t('phet_source_builtin')}
            </span>
            {(catalogState === 'cache' || catalogState === 'builtin') && (
              <button
                type="button"
                onClick={() => setReloadToken((n) => n + 1)}
                className="inline-flex items-center gap-1 font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t('retry')}</span>
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-10 text-center space-y-3">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {t('phet_empty_title', { search })}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {t('phet_empty_sub')}
              </p>
              <button
                onClick={() => { setSearch(''); setCategory('All'); }}
                className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {t('phet_clear_filters')}
              </button>
            </div>
          ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filtered.map((sim) => (
              <div
                key={sim.id}
                onClick={() => setActiveSim(sim)}
                className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-5 shadow-xs hover:border-[var(--accent-border)] transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2">
                  {sim.thumbnail && (
                    <img
                      src={sim.thumbnail}
                      alt=""
                      loading="lazy"
                      className="w-full h-24 object-contain rounded-xl bg-white border border-[var(--border-default)]"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-[var(--accent-text)]">
                      {sim.subjects.map((subject) => t(CATEGORY_KEY[subject])).join(' · ')}
                    </span>
                    {sim.isNew && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]">
                        {t('phet_new_badge')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {sim.title}
                  </h3>
                  {sim.description && (
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                      {sim.description}
                    </p>
                  )}
                </div>

                <button className="w-full py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-fill)] group-hover:text-white rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5">
                  <span>{t('phet_launch')}</span>
                </button>
              </div>
            ))}
          </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
