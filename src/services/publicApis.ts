// Genuine Public APIs Services for StudentOS
import { formatDate, t } from './i18n';

// 1. arXiv Research Paper Search
export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  pdfUrl: string;
  arxivUrl: string;
  primaryCategory: string;
}

/** Why a catalog search failed, so the UI can say something more useful than "Search failed". */
export class CatalogError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) {
    super(message);
    this.name = 'CatalogError';
  }
}

async function catalogFailure(res: Response, messageKey: 'pub_arxiv_err' | 'pub_openlib_err'): Promise<CatalogError> {
  let code = 'upstream_error';
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'code' in data) code = String(data.code);
  } catch {}
  return new CatalogError(
    t(messageKey, { status: res.status, detail: res.statusText || t('pub_req_failed') }),
    code,
    res.status,
  );
}

export async function searchArxiv(query: string, category = 'all'): Promise<ArxivPaper[]> {
  try {
    // arXiv sends no CORS header, so the browser can only reach it through our server.
    const params = new URLSearchParams({ q: query.trim(), category });
    const res = await fetch(`/api/catalog/arxiv?${params}`);
    if (!res.ok) throw await catalogFailure(res, 'pub_arxiv_err');
    const xmlText = await res.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');

    const papers: ArxivPaper[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const id = entry.getElementsByTagName('id')[0]?.textContent || `arxiv-${i}`;
      const title = entry.getElementsByTagName('title')[0]?.textContent?.replace(/\s+/g, ' ').trim() || t('pub_untitled_paper');
      const summary = entry.getElementsByTagName('summary')[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const published = entry.getElementsByTagName('published')[0]?.textContent || '';
      const updated = entry.getElementsByTagName('updated')[0]?.textContent || '';
      
      const authorNodes = entry.getElementsByTagName('author');
      const authors: string[] = [];
      for (let j = 0; j < authorNodes.length; j++) {
        const name = authorNodes[j].getElementsByTagName('name')[0]?.textContent;
        if (name) authors.push(name.trim());
      }

      let pdfUrl = '';
      let arxivUrl = id;
      const linkNodes = entry.getElementsByTagName('link');
      for (let j = 0; j < linkNodes.length; j++) {
        const link = linkNodes[j];
        if (link.getAttribute('title') === 'pdf') {
          pdfUrl = link.getAttribute('href') || '';
        }
      }
      if (!pdfUrl) {
        pdfUrl = id.replace('/abs/', '/pdf/') + '.pdf';
      }

      const primCatNode = entry.getElementsByTagName('arxiv:primary_category')[0] || entry.getElementsByTagName('category')[0];
      const primaryCategory = primCatNode?.getAttribute('term') || t('pub_general_cat');

      papers.push({
        id,
        title,
        summary,
        authors: authors.slice(0, 5),
        published: published ? formatDate(published, { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        updated,
        pdfUrl,
        arxivUrl,
        primaryCategory,
      });
    }
    return papers;
  } catch (err) {
    console.error('arXiv API fetch error:', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// 2. Open Library Textbook & Book Search
export interface OpenLibraryBook {
  key: string;
  title: string;
  authorNames: string[];
  firstPublishYear?: number;
  isbn?: string[];
  coverUrl?: string;
  editionCount?: number;
  openLibraryUrl: string;
  subjects?: string[];
}

/** Open Library rejects anything shorter with HTTP 422. */
export const OPEN_LIBRARY_MIN_QUERY = 3;

export async function searchOpenLibrary(query: string): Promise<OpenLibraryBook[]> {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (trimmed.length < OPEN_LIBRARY_MIN_QUERY) {
      throw new CatalogError(t('openlib_err_too_short'), 'query_too_short');
    }
    const params = new URLSearchParams({ q: trimmed });
    const res = await fetch(`/api/catalog/open-library?${params}`);
    if (!res.ok) throw await catalogFailure(res, 'pub_openlib_err');
    const data = await res.json();

    if (!data.docs) return [];

    return data.docs.map((doc: any) => {
      const coverId = doc.cover_i;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
      return {
        key: doc.key,
        title: doc.title,
        authorNames: doc.author_name || [t('openlib_unknown_author')],
        firstPublishYear: doc.first_publish_year,
        isbn: doc.isbn?.slice(0, 3),
        coverUrl,
        editionCount: doc.edition_count,
        openLibraryUrl: `https://openlibrary.org${doc.key}`,
        subjects: doc.subject?.slice(0, 4) || [],
      };
    });
  } catch (err) {
    console.error('Open Library API fetch error:', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// 3. Wikipedia Quick Look Summary
export interface WikipediaSummary {
  title: string;
  displayTitle: string;
  extract: string;
  description?: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

export async function fetchWikipediaSummary(term: string): Promise<WikipediaSummary | null> {
  try {
    if (!term.trim()) return null;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.trim().replace(/\s+/g, '_'))}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.type === 'disambiguation' || !data.extract) return null;

    return {
      title: data.title,
      displayTitle: data.displaytitle || data.title,
      extract: data.extract,
      description: data.description,
      thumbnailUrl: data.thumbnail?.source,
      pageUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
    };
  } catch (err) {
    console.error('Wikipedia API fetch error:', err);
    return null;
  }
}

// 4. NASA Astronomy Picture of the Day (APOD)
export interface NasaApod {
  title: string;
  date: string;
  explanation: string;
  url: string;
  hdurl?: string;
  mediaType: string;
  copyright?: string;
  thumbnailUrl?: string;
}

export const NASA_APOD_CACHE_KEY = 'scc_nasa_apod_cache';
export const NASA_APOD_ENABLED_KEY = 'scc_enable_nasa_apod';
export const NASA_APOD_TOGGLE_EVENT = 'scc:apod-toggle';
// Sec 5.2 Step 3: last successful fetch timestamp (Appendix B new key, documented).
export const APOD_LAST_FETCH_KEY = 'scc_apod_last_fetch';

function getNasaApiKey(): string {
  try {
    const envKey = (import.meta as any)?.env?.VITE_NASA_API_KEY;
    if (envKey && String(envKey).trim()) return String(envKey).trim();
  } catch {}
  return 'DEMO_KEY';
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pure helper — true when cached entry is for today (exported for Vitest). */
export function isApodCacheFresh(cachedDate: string | undefined | null, today = todayDateStr()): boolean {
  return cachedDate === today;
}

export function getApodCache(): { date: string; data: NasaApod } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NASA_APOD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date && parsed.data && typeof parsed.data.url === 'string' && parsed.data.url.trim()) return parsed;
    return null;
  } catch { return null; }
}

export function setApodCache(data: NasaApod): void {
  if (typeof localStorage === 'undefined') return;
  if (!data || typeof data.url !== 'string' || !data.url.trim()) return;
  try {
    localStorage.setItem(NASA_APOD_CACHE_KEY, JSON.stringify({ date: todayDateStr(), data }));
    localStorage.setItem(APOD_LAST_FETCH_KEY, new Date().toISOString());
  } catch {}
}

export function clearApodCache(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(NASA_APOD_CACHE_KEY); } catch {}
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally { clearTimeout(t); }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Robust APOD fetch v2: env-overridable key, 8s timeout, exponential backoff
 * (1s/2s/4s) on 429/5xx, supports video media_type via thumbs=true, falls back to cached
 * yesterday image (handled by caller) — returns null only when all retries fail.
 * DEMO_KEY rate-limits quickly; caller shows stale cache + Retry affordance.
 */
export async function fetchNasaApodV2(): Promise<NasaApod | null> {
  const key = getNasaApiKey();
  const url = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`;
  const delays = [0, 1000, 2000, 4000];
  let lastStatus = 0;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetchWithTimeout(url, 8000);
      lastStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || t('pub_nasa_default_title'),
          date: data.date || todayDateStr(),
          explanation: data.explanation || '',
          url: data.url || '',
          hdurl: data.hdurl,
          mediaType: data.media_type || 'image',
          copyright: data.copyright,
          thumbnailUrl: data.thumbnail_url,
        };
      }
      // Retry only on rate-limit / server errors; 4xx client errors (except 429) break early
      if (res.status !== 429 && res.status < 500) break;
      console.warn(`[NASA APOD] attempt ${attempt + 1} failed with HTTP ${res.status}, retrying…`);
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      console.warn(`[NASA APOD] attempt ${attempt + 1} ${isAbort ? 'timed out after 8s' : 'network error'}, retrying…`);
    }
  }
  console.warn(`[NASA APOD] all retries failed (last HTTP ${lastStatus}). Using cached image if available.`);
  return null;
}

export async function fetchNasaApod(): Promise<NasaApod | null> {
  // Backwards-compatible wrapper: fresh-cache check lives in the hook; keep simple fetch here.
  return fetchNasaApodV2();
}
