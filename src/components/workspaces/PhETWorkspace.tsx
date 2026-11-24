import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Atom, ExternalLink, Maximize2, Minimize2, ArrowLeft, Search, X } from 'lucide-react';
import { IframeErrorBoundary } from '../IframeErrorBoundary';
import { useT } from '../../services/i18n';

type PhetSubject = 'Physics' | 'Chemistry' | 'Biology' | 'Math';
type PhetFilter = 'All' | PhetSubject;

interface PhetSim {
  id: string;
  titleKey: string;
  category: PhetSubject;
  descKey: string;
  url: string;
}

const PHET_CATEGORIES: readonly { id: PhetFilter; labelKey: string }[] = [
  { id: 'All', labelKey: 'phet_cat_all' },
  { id: 'Physics', labelKey: 'phet_cat_physics' },
  { id: 'Chemistry', labelKey: 'phet_cat_chemistry' },
  { id: 'Biology', labelKey: 'phet_cat_biology' },
  { id: 'Math', labelKey: 'phet_cat_math' },
] as const;

const CATEGORY_KEY: Record<PhetSubject, string> = {
  Physics: 'phet_cat_physics',
  Chemistry: 'phet_cat_chemistry',
  Biology: 'phet_cat_biology',
  Math: 'phet_cat_math',
};

const PHET_SIMS: readonly PhetSim[] = [
  {
    id: 'phet-projectile',
    titleKey: 'phet_sim_projectile_t',
    category: 'Physics',
    descKey: 'phet_sim_projectile_d',
    url: 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_en.html',
  },
  {
    id: 'phet-circuit',
    titleKey: 'phet_sim_circuit_t',
    category: 'Physics',
    descKey: 'phet_sim_circuit_d',
    url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html',
  },
  {
    id: 'phet-forces',
    titleKey: 'phet_sim_forces_t',
    category: 'Physics',
    descKey: 'phet_sim_forces_d',
    url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html',
  },
  {
    id: 'phet-balancing',
    titleKey: 'phet_sim_balancing_t',
    category: 'Chemistry',
    descKey: 'phet_sim_balancing_d',
    url: 'https://phet.colorado.edu/sims/html/balancing-chemical-equations/latest/balancing-chemical-equations_en.html',
  },
  {
    id: 'phet-acid-base',
    titleKey: 'phet_sim_acid_base_t',
    category: 'Chemistry',
    descKey: 'phet_sim_acid_base_d',
    url: 'https://phet.colorado.edu/sims/html/acid-base-solutions/latest/acid-base-solutions_en.html',
  },
  {
    id: 'phet-molecule-shapes',
    titleKey: 'phet_sim_molecule_shapes_t',
    category: 'Chemistry',
    descKey: 'phet_sim_molecule_shapes_d',
    url: 'https://phet.colorado.edu/sims/html/molecule-shapes/latest/molecule-shapes_en.html',
  },
  {
    id: 'phet-natural-selection',
    titleKey: 'phet_sim_natural_selection_t',
    category: 'Biology',
    descKey: 'phet_sim_natural_selection_d',
    url: 'https://phet.colorado.edu/sims/html/natural-selection/latest/natural-selection_en.html',
  },
  {
    id: 'phet-gene-expression',
    titleKey: 'phet_sim_gene_expression_t',
    category: 'Biology',
    descKey: 'phet_sim_gene_expression_d',
    url: 'https://phet.colorado.edu/sims/html/gene-expression-essentials/latest/gene-expression-essentials_en.html',
  },
  {
    id: 'phet-wave-string',
    titleKey: 'phet_sim_wave_string_t',
    category: 'Physics',
    descKey: 'phet_sim_wave_string_d',
    url: 'https://phet.colorado.edu/sims/html/wave-on-a-string/latest/wave-on-a-string_en.html',
  },
  {
    id: 'phet-ohms-law',
    titleKey: 'phet_sim_ohms_law_t',
    category: 'Physics',
    descKey: 'phet_sim_ohms_law_d',
    url: 'https://phet.colorado.edu/sims/html/ohms-law/latest/ohms-law_en.html',
  },
  {
    id: 'phet-balloons',
    titleKey: 'phet_sim_balloons_t',
    category: 'Physics',
    descKey: 'phet_sim_balloons_d',
    url: 'https://phet.colorado.edu/sims/html/balloons-and-static-electricity/latest/balloons-and-static-electricity_en.html',
  },
  {
    id: 'phet-bending-light',
    titleKey: 'phet_sim_bending_light_t',
    category: 'Physics',
    descKey: 'phet_sim_bending_light_d',
    url: 'https://phet.colorado.edu/sims/html/bending-light/latest/bending-light_en.html',
  },
  {
    id: 'phet-masses-springs',
    titleKey: 'phet_sim_masses_springs_t',
    category: 'Physics',
    descKey: 'phet_sim_masses_springs_d',
    url: 'https://phet.colorado.edu/sims/html/masses-and-springs/latest/masses-and-springs_en.html',
  },
  {
    id: 'phet-pendulum',
    titleKey: 'phet_sim_pendulum_t',
    category: 'Physics',
    descKey: 'phet_sim_pendulum_d',
    url: 'https://phet.colorado.edu/sims/html/pendulum-lab/latest/pendulum-lab_en.html',
  },
  {
    id: 'phet-skate-basics',
    titleKey: 'phet_sim_skate_basics_t',
    category: 'Physics',
    descKey: 'phet_sim_skate_basics_d',
    url: 'https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics_en.html',
  },
  {
    id: 'phet-color-vision',
    titleKey: 'phet_sim_color_vision_t',
    category: 'Physics',
    descKey: 'phet_sim_color_vision_d',
    url: 'https://phet.colorado.edu/sims/html/color-vision/latest/color-vision_en.html',
  },
  {
    id: 'phet-ph-scale',
    titleKey: 'phet_sim_ph_scale_t',
    category: 'Chemistry',
    descKey: 'phet_sim_ph_scale_d',
    url: 'https://phet.colorado.edu/sims/html/ph-scale/latest/ph-scale_en.html',
  },
  {
    id: 'phet-molarity',
    titleKey: 'phet_sim_molarity_t',
    category: 'Chemistry',
    descKey: 'phet_sim_molarity_d',
    url: 'https://phet.colorado.edu/sims/html/molarity/latest/molarity_en.html',
  },
  {
    id: 'phet-build-atom',
    titleKey: 'phet_sim_build_atom_t',
    category: 'Chemistry',
    descKey: 'phet_sim_build_atom_d',
    url: 'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_en.html',
  },
  {
    id: 'phet-gas-properties',
    titleKey: 'phet_sim_gas_properties_t',
    category: 'Chemistry',
    descKey: 'phet_sim_gas_properties_d',
    url: 'https://phet.colorado.edu/sims/html/gas-properties/latest/gas-properties_en.html',
  },
  {
    id: 'phet-concentration',
    titleKey: 'phet_sim_concentration_t',
    category: 'Chemistry',
    descKey: 'phet_sim_concentration_d',
    url: 'https://phet.colorado.edu/sims/html/concentration/latest/concentration_en.html',
  },
  {
    id: 'phet-beers-law',
    titleKey: 'phet_sim_beers_law_t',
    category: 'Chemistry',
    descKey: 'phet_sim_beers_law_d',
    url: 'https://phet.colorado.edu/sims/html/beers-law-lab/latest/beers-law-lab_en.html',
  },
  {
    id: 'phet-states-matter-basics',
    titleKey: 'phet_sim_states_matter_t',
    category: 'Chemistry',
    descKey: 'phet_sim_states_matter_d',
    url: 'https://phet.colorado.edu/sims/html/states-of-matter-basics/latest/states-of-matter-basics_en.html',
  },
  {
    id: 'phet-neuron',
    titleKey: 'phet_sim_neuron_t',
    category: 'Biology',
    descKey: 'phet_sim_neuron_d',
    url: 'https://phet.colorado.edu/sims/html/neuron/latest/neuron_en.html',
  },
  {
    id: 'phet-membrane-channels',
    titleKey: 'phet_sim_membrane_t',
    category: 'Biology',
    descKey: 'phet_sim_membrane_d',
    url: 'https://phet.colorado.edu/sims/html/membrane-channels/latest/membrane-channels_en.html',
  },
  {
    id: 'phet-area-builder',
    titleKey: 'phet_sim_area_builder_t',
    category: 'Math',
    descKey: 'phet_sim_area_builder_d',
    url: 'https://phet.colorado.edu/sims/html/area-builder/latest/area-builder_en.html',
  },
  {
    id: 'phet-fraction-matcher',
    titleKey: 'phet_sim_fraction_matcher_t',
    category: 'Math',
    descKey: 'phet_sim_fraction_matcher_d',
    url: 'https://phet.colorado.edu/sims/html/fraction-matcher/latest/fraction-matcher_en.html',
  },
  {
    id: 'phet-graphing-lines',
    titleKey: 'phet_sim_graphing_lines_t',
    category: 'Math',
    descKey: 'phet_sim_graphing_lines_d',
    url: 'https://phet.colorado.edu/sims/html/graphing-lines/latest/graphing-lines_en.html',
  },
  {
    id: 'phet-least-squares',
    titleKey: 'phet_sim_least_squares_t',
    category: 'Math',
    descKey: 'phet_sim_least_squares_d',
    url: 'https://phet.colorado.edu/sims/html/least-squares-regression/latest/least-squares-regression_en.html',
  },
] as const;

export const PhETWorkspace: React.FC = () => {
  const { t } = useT();
  const [activeSim, setActiveSim] = useState<PhetSim | null>(null);
  const [category, setCategory] = useState<PhetFilter>('All');
  const [search, setSearch] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const filtered = PHET_SIMS.filter((s) => {
    if (category !== 'All' && s.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t(s.titleKey).toLowerCase().includes(q) || t(s.descKey).toLowerCase().includes(q);
    }
    return true;
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
              <span className="font-bold text-[var(--text-primary)]">{t(activeSim.titleKey)}</span>
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
              title={t(activeSim.titleKey)}
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
              {t('phet_count', { filtered: filtered.length, total: PHET_SIMS.length })}
            </span>
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
                  <span className="text-[10px] font-bold uppercase text-[var(--accent-text)]">
                    {t(CATEGORY_KEY[sim.category])}
                  </span>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {t(sim.titleKey)}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                    {t(sim.descKey)}
                  </p>
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
