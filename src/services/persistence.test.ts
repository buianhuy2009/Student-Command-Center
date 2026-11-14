import { describe, it, expect, beforeEach } from 'vitest';

// Per-uid persistence: Canvas settings + Google token vault survive
// logout/relogin/reload and never leak across accounts.

const UID_A = 'test-uid-alice-001';
const UID_B = 'test-uid-bob-002';
const TOKEN_A = 'ya29.test-token-alice-abcdef1234567890';
const TOKEN_B = 'ya29.test-token-bob-abcdef1234567890';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(k: string) { return store.has(k) ? store.get(k)! : null; },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    removeItem(k: string) { store.delete(k); },
    setItem(k: string, v: string) { store.set(k, String(v)); },
  };
}

function ensureWebStorage() {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (typeof (globalThis as any)[name]?.getItem !== 'function') {
      const jsdomStorage = (globalThis as any).jsdom?.window?.[name];
      const impl = jsdomStorage && typeof jsdomStorage.getItem === 'function' ? jsdomStorage : createMemoryStorage();
      Object.defineProperty(globalThis, name, { value: impl, configurable: true, writable: true });
      if (typeof window !== 'undefined' && window !== globalThis) {
        try {
          Object.defineProperty(window, name, { value: impl, configurable: true, writable: true });
        } catch {}
      }
    }
  }
}

function wipeStorage() {
  ensureWebStorage();
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
}

beforeEach(async () => {
  wipeStorage();
  const fb = await import('./firebase');
  fb.__resetTokenMemoryForTests();
  fb.setActiveGoogleUid(null);
  const { setActiveCanvasUid } = await import('./canvas');
  setActiveCanvasUid(null);
  const ga = await import('./googleAuth');
  ga.__resetGrantCacheForTests();
});

describe('canvas per-uid persistence', () => {
  it('reload keeps Canvas (legacy mirror restores after memory reset)', async () => {
    const { saveCanvasSettings, loadCanvasSettings, setActiveCanvasUid } = await import('./canvas');
    saveCanvasSettings(
      { calendarFeedUrl: 'https://x/feed.ics', apiDomain: 'https://4015.instructure.com/login/', apiToken: 'tok', autoSync: true },
      UID_A
    );
    // Simulate reload: drop active uid, read legacy mirror like a fresh boot.
    setActiveCanvasUid(null);
    const restored = loadCanvasSettings();
    expect(restored.apiDomain).toBe('https://4015.instructure.com'); // normalized, kept
    expect(restored.calendarFeedUrl).toBe('https://x/feed.ics');
  });

  it('two accounts never share Canvas settings', async () => {
    const { saveCanvasSettings, loadCanvasSettings } = await import('./canvas');
    saveCanvasSettings(
      { calendarFeedUrl: '', apiDomain: 'https://alice.instructure.com', apiToken: 'alice-tok', autoSync: true },
      UID_A
    );
    saveCanvasSettings(
      { calendarFeedUrl: '', apiDomain: 'https://bob.instructure.com', apiToken: 'bob-tok', autoSync: true },
      UID_B
    );
    expect(loadCanvasSettings(UID_A).apiDomain).toBe('https://alice.instructure.com');
    expect(loadCanvasSettings(UID_B).apiDomain).toBe('https://bob.instructure.com');
    // A third account with no vault must NOT inherit Bob's leftover mirror.
    const stranger = loadCanvasSettings('test-uid-stranger-999');
    expect(stranger.apiDomain).toBe('https://canvas.instructure.com');
    expect(stranger.apiToken).toBe('');
  });

  it('pre-upgrade legacy settings are adopted once by the same account', async () => {
    const { loadCanvasSettings } = await import('./canvas');
    localStorage.setItem(
      'scc_canvas_settings_v1',
      JSON.stringify({ apiDomain: 'https://old.instructure.com', apiToken: 'old-tok', autoSync: true })
    );
    const adopted = loadCanvasSettings(UID_A);
    expect(adopted.apiDomain).toBe('https://old.instructure.com');
    // Adopted into the vault — still there after the mirror is wiped.
    localStorage.removeItem('scc_canvas_settings_v1');
    expect(loadCanvasSettings(UID_A).apiToken).toBe('old-tok');
  });
});

describe('google token per-uid vault', () => {
  it('relogin with the same uid restores the token (logout keeps the vault)', async () => {
    const fb = await import('./firebase');
    fb.setActiveGoogleUid(UID_A);
    fb.setStoredGoogleToken(TOKEN_A, UID_A);
    expect(fb.getStoredGoogleToken()).toBe(TOKEN_A);

    // Simulate logout: mirror cleared (what signOutUser does), vault kept.
    fb.__resetTokenMemoryForTests();
    sessionStorage.clear();
    localStorage.removeItem('google_workspace_access_token');
    localStorage.removeItem('google_token_acquired_at');
    expect(localStorage.getItem(`google_workspace_access_token__${UID_A}`)).toBe(TOKEN_A);

    // Simulate relogin.
    const restored = await fb.hydrateGoogleTokenForUser(UID_A);
    expect(restored).toBe(TOKEN_A);
    expect(fb.getStoredGoogleToken()).toBe(TOKEN_A);
    expect(fb.getGoogleTokenStatus()).toBe('connected');
  });

  it('a different uid never inherits another account token', async () => {
    const fb = await import('./firebase');
    fb.setStoredGoogleToken(TOKEN_A, UID_A);
    // Bob signs in on the same browser: nothing restores, mirror is cleared.
    const restored = await fb.hydrateGoogleTokenForUser(UID_B);
    expect(restored).toBeNull();
    expect(fb.getStoredGoogleToken()).toBeNull();
    expect(fb.getGoogleTokenStatus()).toBe('missing');
    // Alice's vault is untouched for her next login.
    expect(localStorage.getItem(`google_workspace_access_token__${UID_A}`)).toBe(TOKEN_A);
  });

  it('expired token reports reconnect-needed while Canvas settings survive', async () => {
    const fb = await import('./firebase');
    const { saveCanvasSettings, loadCanvasSettings } = await import('./canvas');
    fb.setActiveGoogleUid(UID_A);
    fb.setStoredGoogleToken(TOKEN_A, UID_A);
    saveCanvasSettings(
      { calendarFeedUrl: '', apiDomain: 'https://alice.instructure.com', apiToken: 'c-tok', autoSync: true },
      UID_A
    );
    // Fake the acquisition stamp 2h into the past (both mirror + vault).
    const old = String(Date.now() - 2 * 60 * 60 * 1000);
    for (const k of [
      'google_token_acquired_at',
      `google_token_acquired_at__${UID_A}`,
    ]) {
      try {
        localStorage.setItem(k, old);
        sessionStorage.setItem(k, old);
      } catch {}
    }
    expect(fb.isGoogleTokenExpired()).toBe(true);
    expect(fb.getValidGoogleToken()).toBeNull();
    expect(fb.needsGoogleReconnect()).toBe(true);
    expect(fb.getGoogleTokenStatus()).toBe('expired'); // NOT missing: 1-click reconnect
    expect(loadCanvasSettings(UID_A).apiDomain).toBe('https://alice.instructure.com');
  });

  it('explicit disconnect wipes only that account vault', async () => {
    const fb = await import('./firebase');
    fb.setStoredGoogleToken(TOKEN_A, UID_A);
    fb.setStoredGoogleToken(TOKEN_B, UID_B);
    fb.clearStoredGoogleToken(UID_A);
    expect(localStorage.getItem(`google_workspace_access_token__${UID_A}`)).toBeNull();
    expect(localStorage.getItem(`google_workspace_access_token__${UID_B}`)).toBe(TOKEN_B);
  });
});

describe('refresh grant per-uid isolation', () => {
  it('grants are namespaced per account in localStorage', async () => {
    const ga = await import('./googleAuth');
    const fb = await import('./firebase');
    fb.setActiveGoogleUid(UID_A);
    // Seed two per-uid grants directly (persist path writes these shapes).
    localStorage.setItem(
      `scc_google_refresh_v1__${UID_A}`,
      JSON.stringify({ rt: 'refresh-alice-1234567890', at: Date.now(), scope: 's' })
    );
    localStorage.setItem(
      `scc_google_refresh_v1__${UID_B}`,
      JSON.stringify({ rt: 'refresh-bob-1234567890', at: Date.now(), scope: 's' })
    );
    fb.setActiveGoogleUid(UID_A);
    ga.__resetGrantCacheForTests();
    expect(ga.hasRefreshToken()).toBe(true);
    fb.setActiveGoogleUid(UID_B);
    ga.__resetGrantCacheForTests();
    expect(ga.hasRefreshToken()).toBe(true);
    fb.setActiveGoogleUid('test-uid-nobody-000');
    ga.__resetGrantCacheForTests();
    expect(ga.hasRefreshToken()).toBe(false);
  });
});
