import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import handleArxiv, { buildArxivSearchQuery } from './arxiv.js';
import handleOpenLibrary from './open-library.js';
import handlePhet, { toPhetCatalog } from './phet.js';
import { resetCatalogStateForTest } from './upstream.js';
import { resolveApiPath, API_ROUTES } from '../router.js';

function mockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers,
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: any) { res.body = payload; return res; },
    send(payload: any) { res.body = payload; return res; },
    end() { return res; },
  };
  return res;
}

const get = (query: Record<string, string>) => ({ method: 'GET', query, headers: {} });

describe('catalog proxies', () => {
  beforeEach(() => resetCatalogStateForTest());
  afterEach(() => vi.unstubAllGlobals());

  it('are registered on the shared router', () => {
    expect(API_ROUTES.has(resolveApiPath({ url: '/api/catalog/arxiv?q=a' }))).toBe(true);
    expect(API_ROUTES.has('/catalog/open-library')).toBe(true);
    expect(API_ROUTES.has('/catalog/phet')).toBe(true);
  });

  it('builds arXiv queries that use wildcard groups and require every word', () => {
    expect(buildArxivSearchQuery('', 'math')).toBe('cat:math.*');
    expect(buildArxivSearchQuery('', 'econ')).toBe('cat:econ.*');
    expect(buildArxivSearchQuery('quantum computing', 'all')).toBe('all:quantum AND all:computing');
    expect(buildArxivSearchQuery('graphs', 'stat')).toBe('(cat:stat.*) AND (all:graphs)');
    expect(buildArxivSearchQuery('ti:"x" (y)', 'nope')).toBe('all:ti AND all:x AND all:y');
  });

  it('returns arXiv XML from the fixed arXiv host', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('<feed/>', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = mockRes();
    await handleArxiv(get({ q: 'electron', category: 'all' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('<feed/>');
    expect(res.headers['content-type']).toContain('atom+xml');
    expect(String(fetchSpy.mock.calls[0][0]).startsWith('https://export.arxiv.org/api/query?')).toBe(true);
  });

  it('reports a busy arXiv as busy without retrying', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('Rate exceeded.', { status: 503 }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = mockRes();
    await handleArxiv(get({ q: 'electron' }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('upstream_busy');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries Open Library once after a 500 and asks for isbn', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [{ key: '/works/1', title: 'A', isbn: ['1', '2', '3', '4'] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = mockRes();
    await handleOpenLibrary(get({ q: 'calculus' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.docs[0].isbn).toHaveLength(3);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('isbn');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('explains queries Open Library refuses instead of failing generically', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 422 }));
    vi.stubGlobal('fetch', fetchSpy);
    const short = mockRes();
    await handleOpenLibrary(get({ q: 'ai' }), short);
    expect(short.body.code).toBe('query_too_short');
    expect(fetchSpy).not.toHaveBeenCalled();

    const stopWord = mockRes();
    await handleOpenLibrary(get({ q: 'the' }), stopWord);
    expect(stopWord.statusCode).toBe(400);
    expect(stopWord.body.code).toBe('query_not_allowed');
  });

  const metadata = {
    projects: [
      { type: 2, name: 'html/band-structure', simulations: [{ name: 'band-structure', subjects: [4, 9, 13], isNew: 1, localizedSimulations: { en: { title: 'Band Structure' } } }] },
      { type: 0, name: 'bound-states', simulations: [{ name: 'covalent-bonds', subjects: [4], localizedSimulations: { en: { title: 'Covalent Bonds' } } }] },
    ],
  };

  it('keeps only runnable HTML5 PhET sims and maps subjects', () => {
    const sims = toPhetCatalog(metadata, null, 'en');
    expect(sims).toHaveLength(1);
    expect(sims[0]).toMatchObject({
      name: 'band-structure',
      title: 'Band Structure',
      subjects: ['Physics', 'Chemistry'],
      isNew: true,
      url: 'https://phet.colorado.edu/sims/html/band-structure/latest/band-structure_en.html',
    });
  });

  it('uses PhET translations when the Vietnamese catalog has them', async () => {
    const vi_ = { projects: [{ type: 2, name: 'html/band-structure', simulations: [{ name: 'band-structure', localizedSimulations: { vi: { title: 'Cau truc vung' } } }] }] };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('locale=vi') ? vi_ : metadata), { status: 200 })));
    const res = mockRes();
    await handlePhet(get({ locale: 'vi' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sims[0].title).toBe('Cau truc vung');
    expect(res.body.sims[0].url.endsWith('band-structure_vi.html')).toBe(true);
  });
});
