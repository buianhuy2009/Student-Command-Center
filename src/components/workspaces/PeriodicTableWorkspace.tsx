import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Info,
  Layers,
  Sparkles,
  Zap,
  Atom,
  X,
  BookOpen,
} from 'lucide-react';

import { ELEMENTS_DATA, ChemicalElement } from '../../data/elementsData';
import { t, useLang } from '../../services/i18n';


const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'diatomic-nonmetal': { bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', label: t('ptab_cat_reactive') },
  'polyatomic-nonmetal': { bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', label: t('ptab_cat_poly') },
  'noble-gas': { bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', label: t('ptab_cat_noble') },
  'alkali-metal': { bg: 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-300', label: t('ptab_cat_alkali') },
  'alkaline-earth': { bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', label: t('ptab_cat_alkaline') },
  'metalloid': { bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-300 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', label: t('ptab_cat_metalloid') },
  'halogen': { bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', label: t('ptab_cat_halogen') },
  'post-transition-metal': { bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', label: t('ptab_cat_post') },
  'transition-metal': { bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', label: t('ptab_cat_trans') },
  'actinide': { bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', label: t('ptab_cat_act') },
  'lanthanide': { bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', label: 'Lanthanides' },
};

// Short display mass so the value fits inside the cell.
// Rounds to max 2 decimals and trims trailing zeros ("4.0026022" -> "4", "55.8452" -> "55.85").
function formatMass(mass: string): string {
  const n = Number.parseFloat(mass);
  if (!Number.isFinite(n)) return mass;
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// Static element subdivisions lifted out of component scope to eliminate redundant array filtering on mount/render
const MAIN_ELEMENTS = ELEMENTS_DATA.filter(
  (el) => el.number <= 118 &&
    !(el.number >= 57 && el.number <= 71) &&
    !(el.number >= 89 && el.number <= 103)
);

const LANTHANIDES = ELEMENTS_DATA.filter((el) => el.number >= 57 && el.number <= 71);

const ACTINIDES = ELEMENTS_DATA.filter((el) => el.number >= 89 && el.number <= 103);

// Legend groups requested by design, mapped onto the file's existing color system.
// Note: element data stores lanthanides as "transition-metal" and has no
// "halogen"-category rows, so Lanthanides reuses the orange family color and
// Halogens keeps its indigo system color. Nonmetals covers both rendered
// nonmetal colors (diatomic + polyatomic) so every rendered color appears.
const GROUP_LEGEND: { label: string; categories: string[] }[] = [
  { label: 'Alkali metals', categories: ['alkali-metal'] },
  { label: 'Alkaline earth', categories: ['alkaline-earth'] },
  { label: 'Transition metals', categories: ['transition-metal'] },
  { label: 'Post-transition metals', categories: ['post-transition-metal'] },
  { label: 'Metalloids', categories: ['metalloid'] },
  { label: 'Nonmetals', categories: ['diatomic-nonmetal', 'polyatomic-nonmetal'] },
  { label: 'Halogens', categories: ['halogen'] },
  { label: 'Noble gases', categories: ['noble-gas'] },
  { label: 'Lanthanides', categories: ['lanthanide'] },
  { label: 'Actinides', categories: ['actinide'] },
];

export const PeriodicTableWorkspace: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeElement, setActiveElement] = useState<ChemicalElement | null>(null);

  // Detail panel opens only on click; Esc closes it.
  useEffect(() => {
    if (!activeElement) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveElement(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeElement]);

  // Memoize search query & category matches into an O(1) Set lookup
  // Optimization: Prevents re-executing string lowercasing and trimming ~570 times per render frame
  // (118 elements rendered across main grid, lanthanides, and actinides rows)
  const matchingElementNumbers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const set = new Set<number>();
    for (let i = 0; i < ELEMENTS_DATA.length; i++) {
      const el = ELEMENTS_DATA[i];
      const matchesQuery = !query ||
        el.name.toLowerCase().includes(query) ||
        el.symbol.toLowerCase().includes(query) ||
        el.number.toString().includes(query);
      const matchesCategory = selectedCategory === 'all' || el.category === selectedCategory;
      if (matchesQuery && matchesCategory) {
        set.add(el.number);
      }
    }
    return set;
  }, [searchQuery, selectedCategory]);

  const isSearchActive = searchQuery.trim().length > 0 || selectedCategory !== 'all';

  const hasMatchingLanthanide = useMemo(() => {
    return LANTHANIDES.some((el) => matchingElementNumbers.has(el.number));
  }, [matchingElementNumbers]);

  const hasMatchingActinide = useMemo(() => {
    return ACTINIDES.some((el) => matchingElementNumbers.has(el.number));
  }, [matchingElementNumbers]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FAF9F5] dark:bg-[#141413] p-4 sm:p-6 space-y-5 animate-in fade-in select-none">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xs">
            <Atom className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
              Interactive Periodic Table &amp; Science Suite
            </h2>
            <p className="text-xs text-[#8C897F]">
              Atomic masses, electron shells, electronegativities, and chemical classifications
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol, name, or number..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757] w-64"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] focus:outline-none cursor-pointer"
          >
            <option value="all">All Element Families</option>
            <option value="alkali-metal">Alkali Metals</option>
            <option value="alkaline-earth">Alkaline Earth</option>
            <option value="transition-metal">Transition Metals</option>
            <option value="metalloid">Metalloids</option>
            <option value="diatomic-nonmetal">Reactive Nonmetals</option>
            <option value="halogen">Halogens</option>
            <option value="noble-gas">Noble Gases</option>
            <option value="post-transition-metal">Post-Transition</option>
            <option value="actinide">Actinides</option>
          </select>
        </div>
      </div>

      {/* Main Grid & Detail Split */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left: Element Cards Grid */}
        <div className="lg:col-span-8 overflow-x-auto overflow-y-auto pr-1">
          <div className="min-w-[1220px] grid gap-2 pb-4 pr-1" style={{ gridTemplateColumns: 'repeat(18, minmax(64px, 1fr))' }}>
            {MAIN_ELEMENTS.map((el) => {
              const cat = CATEGORY_COLORS[el.category] || {
                bg: 'bg-stone-50 border-stone-200',
                text: 'text-stone-700',
                label: 'Element',
              };
              const isSelected = activeElement?.number === el.number;
              const matches = !isSearchActive || matchingElementNumbers.has(el.number);

              return (
                <button
                  key={el.number}
                  onClick={() => setActiveElement(el)}
                  title={`${el.name} (${el.symbol})`}
                  aria-label={`${el.name} (${el.symbol}), atomic number ${el.number}`}
                  style={{
                    gridColumnStart: el.group,
                    gridRowStart: el.period,
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[76px] lg:h-[84px] min-w-[64px] overflow-hidden ${
                    cat.bg
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#D97757] scale-[1.03] shadow-md z-10'
                      : 'hover:scale-[1.02] hover:shadow-xs'
                  } ${!matches ? 'opacity-20 grayscale' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[#8C897F]">
                    <span className="shrink-0">{el.number}</span>
                    <span className="truncate text-right" title={el.mass}>{formatMass(el.mass)}</span>
                  </div>
                  <div>
                    <div className={`text-base lg:text-lg font-extrabold leading-tight ${cat.text}`}>
                      {el.symbol}
                    </div>
                    <div className="text-[10px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate" title={el.name}>
                      {el.name}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Lanthanides Placeholder in main grid */}
            <button
              onClick={() => {
                const la = ELEMENTS_DATA.find((e) => e.number === 57);
                if (la) setActiveElement(la);
              }}
              title="Lanthanides (La-Lu)"
              aria-label="Lanthanides, elements 57 to 71"
              style={{
                gridColumnStart: 3,
                gridRowStart: 6,
              }}
              className={`p-2 rounded-xl border border-dashed text-left transition-all cursor-pointer flex flex-col justify-between h-[76px] lg:h-[84px] min-w-[64px] overflow-hidden bg-orange-50/30 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800 ${
                activeElement && activeElement.number >= 57 && activeElement.number <= 71
                  ? 'ring-2 ring-[#D97757] scale-[1.03] shadow-md z-10'
                  : 'hover:scale-[1.02]'
              } ${isSearchActive && !hasMatchingLanthanide ? 'opacity-20 grayscale' : ''}`}
            >
              <div className="text-[10px] font-mono text-[#8C897F]">57-71</div>
              <div>
                <div className="text-base lg:text-lg font-extrabold leading-tight text-orange-700 dark:text-orange-300">La-Lu</div>
                <div className="text-[10px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate" title="Lanthanides">Lanthanides</div>
              </div>
            </button>

            {/* Actinides Placeholder in main grid */}
            <button
              onClick={() => {
                const ac = ELEMENTS_DATA.find((e) => e.number === 89);
                if (ac) setActiveElement(ac);
              }}
              title="Actinides (Ac-Lr)"
              aria-label="Actinides, elements 89 to 103"
              style={{
                gridColumnStart: 3,
                gridRowStart: 7,
              }}
              className={`p-2 rounded-xl border border-dashed text-left transition-all cursor-pointer flex flex-col justify-between h-[76px] lg:h-[84px] min-w-[64px] overflow-hidden bg-rose-50/30 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 ${
                activeElement && activeElement.number >= 89 && activeElement.number <= 103
                  ? 'ring-2 ring-[#D97757] scale-[1.03] shadow-md z-10'
                  : 'hover:scale-[1.02]'
              } ${isSearchActive && !hasMatchingActinide ? 'opacity-20 grayscale' : ''}`}
            >
              <div className="text-[10px] font-mono text-[#8C897F]">89-103</div>
              <div>
                <div className="text-base lg:text-lg font-extrabold leading-tight text-rose-700 dark:text-rose-300">Ac-Lr</div>
                <div className="text-[10px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate" title="Actinides">Actinides</div>
              </div>
            </button>

            {/* Spacers for row 8 (divider row) */}
            <div style={{ gridColumnStart: 1, gridRowStart: 8, height: '16px' }} />

            {/* Row Labels for Lanthanides/Actinides */}
            <div
              style={{
                gridColumnStart: 1,
                gridColumnEnd: 4,
                gridRowStart: 9,
              }}
              className="flex items-center justify-end pr-2 text-[9px] font-bold uppercase tracking-wider text-[#8C897F] select-none font-mono"
            >
              Lanthanides
            </div>
            <div
              style={{
                gridColumnStart: 1,
                gridColumnEnd: 4,
                gridRowStart: 10,
              }}
              className="flex items-center justify-end pr-2 text-[9px] font-bold uppercase tracking-wider text-[#8C897F] select-none font-mono"
            >
              Actinides
            </div>

            {/* Lanthanides Row (Period 9) */}
            {LANTHANIDES.map((el, idx) => {
              const cat = CATEGORY_COLORS[el.category] || {
                bg: 'bg-stone-50 border-stone-200',
                text: 'text-stone-700',
                label: 'Element',
              };
              const isSelected = activeElement?.number === el.number;
              const matches = !isSearchActive || matchingElementNumbers.has(el.number);

              return (
                <button
                  key={el.number}
                  onClick={() => setActiveElement(el)}
                  title={`${el.name} (${el.symbol})`}
                  aria-label={`${el.name} (${el.symbol}), atomic number ${el.number}`}
                  style={{
                    gridColumnStart: 4 + idx,
                    gridRowStart: 9,
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[76px] lg:h-[84px] min-w-[64px] overflow-hidden ${
                    cat.bg
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#D97757] scale-[1.03] shadow-md z-10'
                      : 'hover:scale-[1.02] hover:shadow-xs'
                  } ${!matches ? 'opacity-20 grayscale' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[#8C897F]">
                    <span className="shrink-0">{el.number}</span>
                    <span className="truncate text-right" title={el.mass}>{formatMass(el.mass)}</span>
                  </div>
                  <div>
                    <div className={`text-base lg:text-lg font-extrabold leading-tight ${cat.text}`}>
                      {el.symbol}
                    </div>
                    <div className="text-[10px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate" title={el.name}>
                      {el.name}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Actinides Row (Period 10) */}
            {ACTINIDES.map((el, idx) => {
              const cat = CATEGORY_COLORS[el.category] || {
                bg: 'bg-stone-50 border-stone-200',
                text: 'text-stone-700',
                label: 'Element',
              };
              const isSelected = activeElement?.number === el.number;
              const matches = !isSearchActive || matchingElementNumbers.has(el.number);

              return (
                <button
                  key={el.number}
                  onClick={() => setActiveElement(el)}
                  title={`${el.name} (${el.symbol})`}
                  aria-label={`${el.name} (${el.symbol}), atomic number ${el.number}`}
                  style={{
                    gridColumnStart: 4 + idx,
                    gridRowStart: 10,
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[76px] lg:h-[84px] min-w-[64px] overflow-hidden ${
                    cat.bg
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#D97757] scale-[1.03] shadow-md z-10'
                      : 'hover:scale-[1.02] hover:shadow-xs'
                  } ${!matches ? 'opacity-20 grayscale' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[#8C897F]">
                    <span className="shrink-0">{el.number}</span>
                    <span className="truncate text-right" title={el.mass}>{formatMass(el.mass)}</span>
                  </div>
                  <div>
                    <div className={`text-base lg:text-lg font-extrabold leading-tight ${cat.text}`}>
                      {el.symbol}
                    </div>
                    <div className="text-[10px] font-bold text-[#141413] dark:text-[#FAF9F5] truncate" title={el.name}>
                      {el.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Element Inspector Drawer */}
        <div className="lg:col-span-4 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col justify-between overflow-y-auto">
          {activeElement ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between pb-4 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-extrabold text-[#D97757]">
                      {activeElement.symbol}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
                        {activeElement.name}
                      </h3>
                      <span className="text-xs text-[#8C897F] font-mono">
                        Atomic #{activeElement.number}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F]">
                    {CATEGORY_COLORS[activeElement.category]?.label || 'Element'}
                  </span>
                  <button
                    onClick={() => setActiveElement(null)}
                    title="Close element details (Esc)"
                    aria-label="Close element details"
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Atomic Details Table */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[#DFDACB]/30 dark:border-[#2C2B27]/30">
                  <span className="text-[#8C897F]">Standard Atomic Mass</span>
                  <span className="font-mono font-bold text-[#141413] dark:text-[#FAF9F5]">
                    {activeElement.mass} u
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#DFDACB]/30 dark:border-[#2C2B27]/30">
                  <span className="text-[#8C897F]">Electron Configuration</span>
                  <span className="font-mono font-bold text-[#D97757]">
                    {activeElement.electronConfig}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#DFDACB]/30 dark:border-[#2C2B27]/30">
                  <span className="text-[#8C897F]">Group &amp; Period</span>
                  <span className="font-mono font-bold text-[#141413] dark:text-[#FAF9F5]">
                    Group {activeElement.group}, Period {activeElement.period}
                  </span>
                </div>

                {activeElement.electronegativity && (
                  <div className="flex items-center justify-between py-1.5 border-b border-[#DFDACB]/30 dark:border-[#2C2B27]/30">
                    <span className="text-[#8C897F]">Pauling Electronegativity</span>
                    <span className="font-mono font-bold text-[#141413] dark:text-[#FAF9F5]">
                      {activeElement.electronegativity}
                    </span>
                  </div>
                )}
              </div>

              {/* Scientific Summary */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F] block">
                  Scientific Properties &amp; Uses
                </span>
                <p className="text-xs text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed bg-[#FAF9F5] dark:bg-[#1F1E1B] p-3.5 rounded-2xl border border-[#DFDACB]/40 dark:border-[#2C2B27]/40">
                  {activeElement.summary}
                </p>
              </div>
            </div>
          ) : (
            <div className="my-auto text-center text-[#8C897F] text-xs">
              <Atom className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>Select an element to view detailed properties</span>
            </div>
          )}

          <div className="pt-4 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-[10px] text-[#8C897F] flex items-center justify-between">
            <span>Verified IUPAC Chemical Standards</span>
            <span className="font-mono">100% In-Browser</span>
          </div>
        </div>

      </div>

      {/* Group color legend: one chip per requested group, reusing the existing
          category color system. Nonmetals shows both rendered nonmetal colors. */}
      <div className="pt-2.5 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 shrink-0">
        <div className="flex flex-wrap gap-2 text-[10px] font-bold text-[#8C897F] uppercase tracking-wider justify-center">
          {GROUP_LEGEND.map((group) => (
            <div key={group.label} title={group.label} className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-full shadow-2xs">
              <span className="flex items-center gap-1">
                {group.categories.map((catKey) => (
                  <span
                    key={catKey}
                    className={`w-2 h-2 rounded-full ${(CATEGORY_COLORS[catKey]?.bg || '').split(' ')[0]} border border-current`}
                  />
                ))}
              </span>
              <span>{group.label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
