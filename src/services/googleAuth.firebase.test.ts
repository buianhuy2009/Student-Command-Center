import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  auth: { currentUser: null as any },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn(() => () => {}),
  signOut: vi.fn().mockResolvedValue(undefined),
  credentialFromResult: vi.fn((res: any) => res?._cred ?? null),
  providerInstances: [] as Array<{ scopes: string[]; params: Record<string, string> }>,
};

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    scopes: string[] = [];
    params: Record<string, string> = {};
    constructor() {
      mockState.providerInstances.push(this);
    }
    addScope(scope: string) {
      this.scopes.push(scope);
      return this;
    }
    setCustomParameters(p: Record<string, string>) {
      this.params = { ...this.params, ...p };
      return this;
    }
    static credentialFromResult(res: any) {
      return mockState.credentialFromResult(res);
    }
  }
  return {
    getAuth: () => mockState.auth,
    signInWithPopup: (...args: any[]) => mockState.signInWithPopup(...args),
    signInWithRedirect: (...args: any[]) => mockState.signInWithRedirect(...args),
    getRedirectResult: (...args: any[]) => mockState.getRedirectResult(...args),
    setPersistence: (...args: any[]) => mockState.setPersistence(...args),
    browserLocalPersistence: { type: 'LOCAL' },
    onAuthStateChanged: (...args: any[]) => mockState.onAuthStateChanged(...args),
    signOut: (...args: any[]) => mockState.signOut(...args),
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  initializeFirestore: () => ({}),
  doc: (...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

function installTokenInfoFetch(
  scopeByToken: Record<string, string>,
  extraHandler?: (url: string, init?: RequestInit) => Promise<Response> | null
) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (extraHandler) {
      const handled = await extraHandler(url, init);
      if (handled) return handled;
    }
    if (
      url.startsWith('https://oauth2.googleapis.com/tokeninfo') ||
      url.startsWith('https://www.googleapis.com/oauth2/v3/tokeninfo')
    ) {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('access_token') || '';
      const scope = scopeByToken[token] ?? '';
      return new Response(JSON.stringify({ scope }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/health')) {
      return new Response(JSON.stringify({ status: 'ok', hasGoogleOAuth: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

describe('Firebase-first Google OAuth transport', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockState.auth.currentUser = null;
    mockState.providerInstances.length = 0;
    mockState.signInWithPopup.mockReset();
    mockState.signInWithRedirect.mockReset();
    mockState.getRedirectResult.mockReset().mockResolvedValue(null);
    mockState.setPersistence.mockReset().mockResolvedValue(undefined);
    mockState.credentialFromResult.mockImplementation((res: any) => res?._cred ?? null);

    // Ensure GIS never gets invoked when Firebase Auth popup succeeds or explicitly errors.
    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(() => {
            throw new Error('GIS initCodeClient should not run on Firebase-first flow');
          }),
          initTokenClient: vi.fn(() => {
            throw new Error('GIS initTokenClient should not run on Firebase-first flow');
          }),
        },
      },
    };

    const fb = await import('./firebase');
    const ga = await import('./googleAuth');
    fb.__resetTokenMemoryForTests();
    fb.__resetRedirectResultForTests();
    fb.setActiveGoogleUid(null);
    ga.__resetGrantCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).google;
  });

  it('connects Gmail cleanly in a single Firebase signInWithPopup even when initially signed out, then accumulates Classroom scopes', async () => {
    const fb = await import('./firebase');
    const ga = await import('./googleAuth');
    const gmailScope = ga.FEATURE_SCOPES.gmail[0];
    const classroomScopes = ga.FEATURE_SCOPES.classroom;

    installTokenInfoFetch({
      'tok-gmail': `${gmailScope} email profile`,
      'tok-cls': `${gmailScope} ${classroomScopes.join(' ')} email profile`,
    });

    const fakeUser = { uid: 'uid-fb-1', email: 'student@school.edu', displayName: 'Student' };
    mockState.signInWithPopup.mockResolvedValueOnce({
      user: fakeUser,
      _cred: { accessToken: 'tok-gmail' },
    });

    const gmailRes = await ga.requestFeaturePermissionDetailed('gmail');
    expect(gmailRes.status).toBe('granted');
    if (gmailRes.status === 'granted') {
      expect(gmailRes.mode).toBe('firebase_popup');
      expect(gmailRes.accessToken).toBe('tok-gmail');
      expect(gmailRes.user?.uid).toBe('uid-fb-1');
    }
    expect(mockState.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(ga.hasFeatureAccess('gmail', 'uid-fb-1')).toBe(true);
    expect(fb.getValidGoogleToken()).toBe('tok-gmail');

    // Connecting Classroom later keeps Gmail scopes in requested provider AND granted set.
    mockState.auth.currentUser = fakeUser;
    mockState.signInWithPopup.mockResolvedValueOnce({
      user: fakeUser,
      _cred: { accessToken: 'tok-cls' },
    });

    const clsRes = await ga.requestFeaturePermissionDetailed('classroom');
    expect(clsRes.status).toBe('granted');
    const lastProvider = mockState.providerInstances[mockState.providerInstances.length - 1];
    expect(lastProvider.scopes).toContain(gmailScope);
    for (const s of classroomScopes) {
      expect(lastProvider.scopes).toContain(s);
    }
    expect(ga.hasFeatureAccess('gmail', 'uid-fb-1')).toBe(true);
    expect(ga.hasFeatureAccess('classroom', 'uid-fb-1')).toBe(true);
  });

  it('returns partial_scopes, dismissed, and popup_blocked accurately from Firebase popup without falling through to GIS', async () => {
    const ga = await import('./googleAuth');

    installTokenInfoFetch({
      'tok-partial': 'email profile',
    });

    // Partial checkboxes unchecked
    mockState.signInWithPopup.mockResolvedValueOnce({
      user: { uid: 'uid-fb-2', email: 'u2@school.edu' },
      _cred: { accessToken: 'tok-partial' },
    });
    const partialRes = await ga.requestFeaturePermissionDetailed('gmail');
    expect(partialRes.status).toBe('partial_scopes');
    if (partialRes.status === 'partial_scopes') {
      expect(partialRes.missingScopes).toContain(ga.FEATURE_SCOPES.gmail[0]);
    }
    expect(ga.hasFeatureAccess('gmail', 'uid-fb-2')).toBe(false);

    // Dismissed by closing popup
    mockState.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    const dismissedRes = await ga.requestFeaturePermissionDetailed('gmail');
    expect(dismissedRes.status).toBe('dismissed');

    // Popup blocked by browser
    mockState.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked' });
    const blockedRes = await ga.requestFeaturePermissionDetailed('gmail');
    expect(blockedRes.status).toBe('popup_blocked');

    // Ensure GIS was never invoked on any of these outcomes.
    expect((window as any).google.accounts.oauth2.initCodeClient).not.toHaveBeenCalled();
    expect((window as any).google.accounts.oauth2.initTokenClient).not.toHaveBeenCalled();
  });

  it('uses Firebase signInWithPopup with select_account consent for signInWithAccountSelect', async () => {
    const fb = await import('./firebase');
    const ga = await import('./googleAuth');
    const driveScopes = ga.FEATURE_SCOPES.drive;

    installTokenInfoFetch({
      'tok-switch': `${driveScopes.join(' ')} email`,
    });

    const altUser = { uid: 'uid-alt', email: 'alt@school.edu' };
    mockState.signInWithPopup.mockResolvedValueOnce({
      user: altUser,
      _cred: { accessToken: 'tok-switch' },
    });

    const token = await ga.signInWithAccountSelect({ feature: 'drive' });
    expect(token).toBe('tok-switch');
    expect(mockState.signInWithPopup).toHaveBeenCalledTimes(1);
    const providerUsed = mockState.providerInstances[mockState.providerInstances.length - 1];
    expect(providerUsed.params.prompt).toBe('select_account consent');
    for (const s of driveScopes) {
      expect(providerUsed.scopes).toContain(s);
    }
    expect(ga.hasFeatureAccess('drive', 'uid-alt')).toBe(true);
    expect(fb.getValidGoogleToken()).toBe('tok-switch');
  });

  it('preserves pending feature and granted scopes across signInWithRedirectFlow and consumeRedirectResult', async () => {
    const fb = await import('./firebase');
    const ga = await import('./googleAuth');
    const classroomScopes = ga.FEATURE_SCOPES.classroom;

    installTokenInfoFetch({
      'tok-redirect': `${classroomScopes.join(' ')} email`,
    });

    mockState.signInWithRedirect.mockResolvedValueOnce(undefined);
    await fb.signInWithRedirectFlow({
      feature: 'classroom',
      scopes: classroomScopes,
    });
    expect(mockState.signInWithRedirect).toHaveBeenCalledTimes(1);

    const redirectProvider = mockState.providerInstances[mockState.providerInstances.length - 1];
    for (const s of classroomScopes) {
      expect(redirectProvider.scopes).toContain(s);
    }

    const redirectUser = { uid: 'uid-redir', email: 'redir@school.edu' };
    mockState.getRedirectResult.mockResolvedValueOnce({
      user: redirectUser,
      _cred: { accessToken: 'tok-redirect' },
    });

    const resumed = await fb.consumeRedirectResult();
    expect(resumed).not.toBeNull();
    expect(resumed?.feature).toBe('classroom');
    expect(resumed?.accessToken).toBe('tok-redirect');
    expect(resumed?.grantedScopes).toEqual(expect.arrayContaining(classroomScopes));

    if (resumed?.grantedScopes?.length) {
      ga.recordGrantedScopes(resumed.grantedScopes, resumed.user.uid);
    }
    expect(ga.hasFeatureAccess('classroom', 'uid-redir')).toBe(true);
  });

  it('does not let an in-flight /refresh 400 failure wipe a concurrent valid Firebase popup grant', async () => {
    const fb = await import('./firebase');
    const ga = await import('./googleAuth');
    const gmailScope = ga.FEATURE_SCOPES.gmail[0];

    // Seed an existing broken refresh token in localStorage for uid-race.
    const uid = 'uid-race';
    fb.setActiveGoogleUid(uid);
    localStorage.setItem(
      `scc_google_refresh_v1_${uid}`,
      JSON.stringify({
        refreshToken: 'bad-rt',
        scopes: [gmailScope],
        updatedAt: Date.now() - 10_000,
      })
    );
    await ga.hydrateRefreshGrant(uid);

    let resolveRefresh!: (resp: Response) => void;
    const deferredRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    installTokenInfoFetch(
      { 'tok-fresh-popup': `${gmailScope} email` },
      async (url) => {
        if (url.endsWith('/api/auth/google/refresh')) {
          return deferredRefresh;
        }
        return null;
      }
    );

    // Start background refresh that will later return 400 invalid_grant.
    const refreshPromise = ga.refreshGoogleAccessToken(true, uid);

    // Meanwhile, user completes interactive Firebase popup grant cleanly.
    mockState.signInWithPopup.mockResolvedValueOnce({
      user: { uid, email: 'race@school.edu' },
      _cred: { accessToken: 'tok-fresh-popup' },
    });
    const perm = await ga.requestFeaturePermissionDetailed('gmail', { uid });
    expect(perm.status).toBe('granted');
    expect(ga.hasFeatureAccess('gmail', uid)).toBe(true);

    // Now the stale /refresh request finishes with 400 invalid_grant.
    resolveRefresh(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const refreshOk = await refreshPromise;
    expect(refreshOk).toBe(false);

    // New interactive grant scopes and valid session token MUST stay intact!
    expect(ga.hasFeatureAccess('gmail', uid)).toBe(true);
    expect(fb.getValidGoogleToken()).toBe('tok-fresh-popup');
  });
});
