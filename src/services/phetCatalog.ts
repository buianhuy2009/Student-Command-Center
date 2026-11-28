import type { PhetSubject } from '../data/phetBuiltin';

export interface PhetCatalogSim {
  name: string;
  title: string;
  englishTitle: string;
  subjects: PhetSubject[];
  isNew: boolean;
  url: string;
  thumbnail?: string;
}

export interface PhetCatalogResult {
  sims: PhetCatalogSim[];
  /** live = fetched now; cache = the last list we saw, used when PhET is unreachable. */
  source: 'live' | 'cache';
}

const cacheKey = (locale: string) => `scc_phet_catalog_v1_${locale}`;

function isCatalogSim(value: unknown): value is PhetCatalogSim {
  if (!value || typeof value !== 'object') return false;
  const sim = value as Partial<PhetCatalogSim>;
  return (
    typeof sim.name === 'string' &&
    typeof sim.title === 'string' &&
    Array.isArray(sim.subjects) &&
    typeof sim.url === 'string' &&
    sim.url.startsWith('https://phet.colorado.edu/sims/')
  );
}

export function readCachedPhetCatalog(locale: string): PhetCatalogSim[] {
  try {
    const raw = localStorage.getItem(cacheKey(locale));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCatalogSim) : [];
  } catch {
    return [];
  }
}

/** The current list of runnable simulations, straight from phet.colorado.edu via our server. */
export async function fetchPhetCatalog(locale: 'en' | 'vi'): Promise<PhetCatalogResult> {
  try {
    const res = await fetch(`/api/catalog/phet?locale=${locale}`);
    if (!res.ok) throw new Error(`PhET catalog request failed (HTTP ${res.status})`);
    const data: { sims?: unknown } = await res.json();
    const sims = Array.isArray(data.sims) ? data.sims.filter(isCatalogSim) : [];
    if (sims.length === 0) throw new Error('PhET catalog was empty');
    try {
      localStorage.setItem(cacheKey(locale), JSON.stringify(sims));
    } catch {}
    return { sims, source: 'live' };
  } catch (err) {
    const cached = readCachedPhetCatalog(locale);
    if (cached.length > 0) return { sims: cached, source: 'cache' };
    throw err;
  }
}
