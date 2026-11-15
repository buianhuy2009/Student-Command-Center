import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('Google OAuth consent retry & Tier 2 fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      delete (window as any).google;
    }
  });

  it('resolves fallback Google Client ID from Firebase applet config', async () => {
    const ga = await import('./googleAuth');
    expect(ga.getGoogleOAuthClientId()).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it('always re-prompts consent after user dismissal and falls back cleanly to GIS tokenClient when server OAuth is disabled', async () => {
    const ga = await import('./googleAuth');
    const tokenCalls: Array<{ prompt?: string; scope?: string }> = [];
    let attempt = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: false }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
          initTokenClient: vi.fn((cfg: any) => ({
            requestAccessToken: (override: any) => {
              attempt += 1;
              tokenCalls.push({ prompt: override?.prompt, scope: cfg.scope });
              if (attempt === 1) {
                cfg.error_callback?.({ type: 'popup_closed', message: 'User closed consent popup' });
              } else {
                cfg.callback?.({
                  access_token: 'ya29.retry-granted-token',
                  scope: cfg.scope,
                });
              }
            },
          })),
        },
      },
    };

    await ga.preloadGoogleOAuthReadiness();

    const first = await ga.requestFeaturePermissionDetailed('classroom');
    expect(first.status).toBe('dismissed');

    // Pressing Connect a second time must never lock out the consent prompt
    const second = await ga.requestFeaturePermissionDetailed('classroom');
    expect(second.status).toBe('granted');
    if (second.status === 'granted') {
      expect(second.mode).toBe('gis_token');
    }
    expect(tokenCalls.length).toBe(2);
    expect(tokenCalls[0].prompt).toBe('consent');
    expect(tokenCalls[1].prompt).toBe('consent');
  });
});

describe('Light & Dark theme presets', () => {
  it('stores independent light and dark preset choices across mode switches', async () => {
    const themeSvc = await import('./theme');
    themeSvc.setTheme('sage');
    expect(themeSvc.getTheme()).toBe('sage');

    // Switching to dark uses default dark preset initially
    themeSvc.syncDarkToTheme(true);
    expect(themeSvc.isDarkTheme(themeSvc.getTheme())).toBe(true);

    // Choose obsidian in dark mode, then toggle back to light -> restores sage
    themeSvc.setTheme('obsidian');
    themeSvc.syncDarkToTheme(false);
    expect(themeSvc.getTheme()).toBe('sage');

    // Toggle dark back on -> restores obsidian
    themeSvc.syncDarkToTheme(true);
    expect(themeSvc.getTheme()).toBe('obsidian');
  });
});

describe('Google Workspace & Classroom API error surfacing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces GoogleApiDisabledError on 403 SERVICE_DISABLED instead of returning [] in Classroom', async () => {
    vi.resetModules();
    const { fetchClassroomCourses } = await import('./googleClassroom');
    const { GoogleApiDisabledError } = await import('./googleWorkspace');

    const serviceDisabledPayload = JSON.stringify({
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'Google Classroom API has not been used in project 123456789 before or it is disabled.',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'SERVICE_DISABLED',
            domain: 'googleapis.com',
            metadata: { consumer: 'projects/123456789', service: 'classroom.googleapis.com' },
          },
        ],
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => serviceDisabledPayload,
      }) as Response)
    );

    await expect(fetchClassroomCourses('ya29.test-token')).rejects.toBeInstanceOf(GoogleApiDisabledError);
  });

  it('throws insufficient scope error on Drive 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT instead of returning []', async () => {
    vi.resetModules();
    const { fetchRecentSchoolFiles } = await import('./googleWorkspace');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: {
              code: 403,
              status: 'PERMISSION_DENIED',
              message: 'Request had insufficient authentication scopes.',
              details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
            },
          }),
      }) as Response)
    );

    let caught: any;
    try {
      await fetchRecentSchoolFiles('ya29.test-token');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.status).toBe(403);
    expect(caught.isInsufficientScope).toBe(true);
  });

  it('replaces stale local scopes with authoritative scopes returned by Google on new consent', async () => {
    vi.resetModules();
    localStorage.clear();

    const ga = await import('./googleAuth');
    const fb = await import('./firebase');
    fb.setActiveGoogleUid(null);
    fb.setStoredGoogleToken('ya29.previous-token');
    // Simulate stale local scopes in localStorage that the new token will not carry
    localStorage.setItem('scc_google_scopes_v1', JSON.stringify(ga.FEATURE_SCOPES.classroom));
    expect(ga.hasFeatureAccess('classroom')).toBe(true);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: false }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
          initTokenClient: vi.fn((cfg: any) => ({
            requestAccessToken: () => {
              cfg.callback?.({
                access_token: 'ya29.gmail-only',
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
              });
            },
          })),
        },
      },
    };

    await ga.preloadGoogleOAuthReadiness();
    const res = await ga.requestFeaturePermissionDetailed('gmail');
    expect(res.status).toBe('granted');
    expect(ga.hasFeatureAccess('gmail')).toBe(true);
    // Stale classroom scope must not linger when Google returned only gmail scope
    expect(ga.hasFeatureAccess('classroom')).toBe(false);
  });
});

describe('google oauth multi-service consent & error surfacing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests accumulated scopes across Gmail and Classroom so connecting one keeps the other', async () => {
    const ga = await import('./googleAuth');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: false }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    const requestedScopes: string[] = [];
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
          initTokenClient: vi.fn((cfg: any) => {
            requestedScopes.push(String(cfg.scope || ''));
            return {
              requestAccessToken: () => {
                // Simulate Google echoing back whatever scopes were requested this turn.
                cfg.callback?.({
                  access_token: `ya29.multi-${requestedScopes.length}`,
                  scope: String(cfg.scope || ''),
                });
              },
            };
          }),
        },
      },
    };

    await ga.preloadGoogleOAuthReadiness();
    const gmailRes = await ga.requestFeaturePermissionDetailed('gmail');
    expect(gmailRes.status).toBe('granted');
    expect(ga.hasFeatureAccess('gmail')).toBe(true);

    const clsRes = await ga.requestFeaturePermissionDetailed('classroom');
    expect(clsRes.status).toBe('granted');
    expect(requestedScopes[1]).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(requestedScopes[1]).toContain('https://www.googleapis.com/auth/classroom.courses.readonly');
    expect(ga.hasFeatureAccess('gmail')).toBe(true);
    expect(ga.hasFeatureAccess('classroom')).toBe(true);
  });

  it('falls back cleanly to Tier 2 GIS token client when /api/auth/google/exchange fails with 400', async () => {
    const ga = await import('./googleAuth');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: true }),
          } as Response;
        }
        if (url.includes('/api/auth/google/exchange')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'redirect_uri_mismatch' }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    const tokenCalls: any[] = [];
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn((cfg: any) => ({
            requestCode: () => cfg.callback?.({ code: 'auth-code-fallback' }),
          })),
          initTokenClient: vi.fn((cfg: any) => {
            tokenCalls.push(cfg);
            return {
              requestAccessToken: () =>
                cfg.callback?.({
                  access_token: 'ya29.tier2-fallback',
                  scope: ga.FEATURE_SCOPES.gmail.join(' '),
                }),
            };
          }),
        },
      },
    };

    await ga.preloadGoogleOAuthReadiness();
    const res = await ga.requestFeaturePermissionDetailed('gmail');
    expect(res.status).toBe('granted');
    expect(tokenCalls).toHaveLength(1);
    expect(ga.hasFeatureAccess('gmail')).toBe(true);
  });

  it('clears broken refresh grants on 400/500 refresh failures instead of staying zombie connected', async () => {
    const fb = await import('./firebase');
    const ga = await import('./googleAuth');

    for (const status of [400, 500]) {
      ga.__resetGrantCacheForTests();
      fb.__resetTokenMemoryForTests();
      fb.setActiveGoogleUid(UID_A);
      // Seed an expired access token + broken refresh grant + scopes just like a stale persisted session.
      fb.setStoredGoogleToken('ya29.expired-token', UID_A);
      const staleAt = String(Date.now() - 2 * 60 * 60 * 1000);
      for (const k of ['google_token_acquired_at', `google_token_acquired_at__${UID_A}`]) {
        localStorage.setItem(k, staleAt);
        sessionStorage.setItem(k, staleAt);
      }
      localStorage.setItem(
        `scc_google_refresh_v1__${UID_A}`,
        JSON.stringify({
          rt: '1//broken-refresh-token',
          at: Date.now() - 2 * 60 * 60 * 1000,
          scope: ga.FEATURE_SCOPES.gmail.join(' '),
          grantedScopes: [...ga.FEATURE_SCOPES.gmail],
        })
      );
      localStorage.setItem(`scc_google_scopes_v1__${UID_A}`, JSON.stringify(ga.FEATURE_SCOPES.gmail));
      expect(ga.hasRefreshToken(UID_A)).toBe(true);
      expect(ga.isConnected(UID_A)).toBe(true);

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: any) => {
          const url = String(input);
          if (url.includes('/api/auth/google/refresh')) {
            return {
              ok: false,
              status,
              json: async () => ({
                error: status === 500 ? 'Google OAuth client credentials are not configured' : 'unauthorized_client',
              }),
            } as Response;
          }
          return { ok: false, status: 404, json: async () => ({}) } as Response;
        })
      );

      const token = await ga.ensureFreshGoogleToken(UID_A);
      expect(token).toBeNull();
      expect(ga.hasRefreshToken(UID_A)).toBe(false);
      expect(ga.isConnected(UID_A)).toBe(false);
      expect(ga.hasFeatureAccess('gmail', UID_A)).toBe(false);
    }
  });

  it('detects mixed-case Insufficient Permission and throws when all email detail fetches fail', async () => {
    const gw = await import('./googleWorkspace');
    const err = gw.parseGoogleApiResponseError(
      403,
      JSON.stringify({
        error: {
          message: 'Insufficient Permission',
          errors: [{ reason: 'insufficientPermissions', message: 'Insufficient Permission' }],
        },
      }),
      'Gmail',
      'gmail.googleapis.com'
    );
    expect(err.status).toBe(403);
    expect((err as any).isInsufficientScope).toBe(true);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/messages?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [{ id: 'm1', threadId: 't1' }] }),
          } as unknown as Response;
        }
        return {
          ok: false,
          status: 403,
          text: async () =>
            JSON.stringify({
              error: { message: 'Request had insufficient authentication scopes.' },
            }),
        } as unknown as Response;
      })
    );

    await expect(gw.fetchAcademicEmails('ya29.bad-scope')).rejects.toMatchObject({
      status: 403,
      isInsufficientScope: true,
    });
  });

  it('does not falsely return partial_scopes when silent Tier 2 (prompt="") omits new scopes after /exchange failure, and retries interactively with consent', async () => {
    vi.resetModules();
    localStorage.clear();
    const ga = await import('./googleAuth');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: true }),
          } as Response;
        }
        if (url.includes('/api/auth/google/exchange')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'invalid_client' }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    const promptsSeen: string[] = [];
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn((cfg: any) => ({
            requestCode: () => cfg.callback?.({ code: 'auth-code-1' }),
          })),
          initTokenClient: vi.fn((cfg: any) => ({
            requestAccessToken: (override: any) => {
              const usedPrompt = String(override?.prompt ?? cfg.prompt ?? '');
              promptsSeen.push(usedPrompt);
              if (usedPrompt === '') {
                // Silent Tier 2 returns only basic profile scopes -> must trigger interactive consent retry
                cfg.callback?.({
                  access_token: 'ya29.silent-basic-only',
                  scope: 'openid email profile',
                });
              } else {
                cfg.callback?.({
                  access_token: 'ya29.interactive-classroom',
                  scope: ga.FEATURE_SCOPES.classroom.join(' '),
                });
              }
            },
          })),
        },
      },
    };

    await ga.preloadGoogleOAuthReadiness();
    const res = await ga.requestFeaturePermissionDetailed('classroom');
    expect(res.status).toBe('granted');
    expect(promptsSeen).toEqual(['', 'consent']);
    expect(ga.hasFeatureAccess('classroom')).toBe(true);
  });

  it('recovers background completion via onLateGooglePermissionGranted if Chrome COOP triggers premature popup_closed', async () => {
    vi.resetModules();
    localStorage.clear();
    const ga = await import('./googleAuth');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, hasGoogleOAuth: false }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    let capturedCfg: any = null;
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
          initTokenClient: vi.fn((cfg: any) => ({
            requestAccessToken: () => {
              capturedCfg = cfg;
              cfg.error_callback?.({ type: 'popup_closed', message: 'Popup window closed' });
            },
          })),
        },
      },
    };

    const lateGrants: any[] = [];
    const unsubscribe = ga.onLateGooglePermissionGranted((evt) => lateGrants.push(evt));

    await ga.preloadGoogleOAuthReadiness();
    const initial = await ga.requestFeaturePermissionDetailed('gmail');
    expect(initial.status).toBe('dismissed');

    // User subsequently clicks Continue & Allow inside the still-open popup
    capturedCfg.callback?.({
      access_token: 'ya29.late-recovery-gmail',
      scope: ga.FEATURE_SCOPES.gmail.join(' '),
    });
    await new Promise((r) => setTimeout(r, 20));
    unsubscribe();

    expect(lateGrants).toHaveLength(1);
    expect(lateGrants[0].accessToken).toBe('ya29.late-recovery-gmail');
    expect(ga.hasFeatureAccess('gmail')).toBe(true);
  });
});
