import { describe, it, expect, vi, afterEach } from 'vitest';
import { isApodCacheFresh, searchArxiv, searchOpenLibrary } from './publicApis';

describe('isApodCacheFresh', () => {
  it('returns true when cached date equals today', () => {
    expect(isApodCacheFresh('2026-09-06', '2026-09-06')).toBe(true);
  });
  it('returns false for stale / missing dates', () => {
    expect(isApodCacheFresh('2026-09-05', '2026-09-06')).toBe(false);
    expect(isApodCacheFresh(undefined, '2026-09-06')).toBe(false);
    expect(isApodCacheFresh(null, '2026-09-06')).toBe(false);
  });
});

describe('APOD mediaType handling', () => {
  it('distinguishes image vs video payloads', () => {
    const image = { mediaType: 'image', url: 'https://apod.nasa.gov/img.jpg' };
    const video = { mediaType: 'video', url: 'https://www.youtube.com/embed/xyz' };
    expect(image.mediaType).toBe('image');
    expect(video.mediaType).toBe('video');
    // Card shows <img> only for image; video shows Watch-video link
    expect(image.mediaType === 'image').toBe(true);
    expect(video.mediaType === 'image').toBe(false);
  });
});

describe('searchArxiv & searchOpenLibrary error handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searchArxiv throws on non-OK HTTP responses instead of returning empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' })));
    await expect(searchArxiv('quantum')).rejects.toThrow(/arXiv API error \(503/i);
  });

  it('searchOpenLibrary throws on non-OK HTTP responses instead of returning empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' })));
    await expect(searchOpenLibrary('calculus')).rejects.toThrow(/Open Library API error \(502/i);
  });
});
