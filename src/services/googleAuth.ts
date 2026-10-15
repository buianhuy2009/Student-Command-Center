// Google OAuth offline-grant engine — permanent Workspace sessions.
//
// Problem it solves: GIS/Firebase popup access tokens die after ~1 hour, which
// used to surface a manual "session expired, reconnect" banner. This module:
//   1. Requests an offline grant via GIS `initCodeClient` (access_type=offline,
//      prompt=consent) so Google issues a long-lived `refresh_token`.
//   2. Exchanges the one-time code server-side (/api/auth/google/exchange) —
//      the client secret never ships to the browser.
//   3. Silently mints fresh access tokens (/api/auth/google/refresh) whenever
//      the current one is within 5 minutes of expiring, plus one retry on 401.
//
// Refresh-token storage: Firestore `users/{uid}/integrations/google` when a
// Firebase user is present (owner-only via security rules), mirrored to
// IndexedDB + localStorage for offline-first boot. Unauthenticated mode
// degrades to the local mirror only. The raw refresh token is never logged.

import {
  getStoredGoogleToken,
  setStoredGoogleToken,
  getValidGoogleToken,
  getGoogleTokenAgeMs,
  getActiveGoogleUid,
  CORE_WORKSPACE_SCOPES,
  WORKSPACE_SCOPES,
} from './firebase';

const REFRESH_LS_KEY = 'scc_google_refresh_v1';
const REFRESH_IDB_KEY = 'google_refresh_grant_v1';
// Which account wrote the legacy (pre-per-uid) grant mirror — a different
// account must never inherit it.
const REFRESH_OWNER_KEY = 'scc_google_refresh_owner';
const refreshLsKeyFor = (uid?: string | null) =>
  uid ? `${REFRESH_LS_KEY}__${uid}` : REFRESH_LS_KEY;
const refreshIdbKeyFor = (uid?: string | null) =>
  uid ? `${REFRESH_IDB_KEY}__${uid}` : REFRESH_IDB_KEY;

/** Resolve the account in scope: explicit uid → active session → null (legacy). */
function resolveGrantUid(explicit?: string | null): string | null {
  if (explicit) return explicit;
  try {
    return getActiveGoogleUid() || null;
  } catch {
    return null;
  }
}
function getRefreshOwner(): string | null {
  try {
    return localStorage.getItem(REFRESH_OWNER_KEY);
  } catch {
    return null;
  }
}
function setRefreshOwner(uid: string | null) {
  try {
    if (uid) localStorage.setItem(REFRESH_OWNER_KEY, uid);
    else localStorage.removeItem(REFRESH_OWNER_KEY);
  } catch {}
}
// Real Google access-token lifetime is 3,600s; start renewing 5 min early.
const REFRESH_EARLY_MS = 55 * 60 * 1000;
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export function getGoogleOAuthClientId(): string {
  try {
    const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
    return metaEnv.VITE_GOOGLE_CLIENT_ID || (typeof process !== 'undefined' ? (process as any).env?.VITE_GOOGLE_CLIENT_ID : '') || '';
  } catch {
    return '';
  }
}

/** Offline grant flow is available when a Web OAuth client id is configured. */
export function isOfflineGrantSupported(): boolean {
  return Boolean(getGoogleOAuthClientId()) && typeof window !== 'undefined';
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const w = window as any;
      if (w?.google?.accounts?.oauth2?.initCodeClient) return resolve();
      if (document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)) {
        // Script tag present but library not ready yet — poll briefly.
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          if (w?.google?.accounts?.oauth2?.initCodeClient) {
            clearInterval(iv);
            resolve();
          } else if (tries > 50) {
            clearInterval(iv);
            reject(new Error('Google sign-in library did not load. Check your connection or ad-blocker, then retry.'));
          }
        }, 100);
        return;
      }
      const s = document.createElement('script');
      s.src = GIS_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google sign-in library. Check your connection or ad-blocker, then retry.'));
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

interface RefreshGrant {
  rt: string;
  at: number;
  scope: string;
}

let grantCache: Record<string, RefreshGrant | null> = {};

/** @internal Test-only: drop cached grants so tests can simulate reload. */
export function __resetGrantCacheForTests() {
  grantCache = {};
}

function parseGrant(raw: string | null): RefreshGrant | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RefreshGrant;
    return parsed && typeof parsed.rt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function readGrantSync(uid?: string | null): RefreshGrant | null {
  const resolved = resolveGrantUid(uid);
  const key = refreshLsKeyFor(resolved);
  if (grantCache[key] !== undefined) return grantCache[key];
  try {
    let grant = parseGrant(localStorage.getItem(key));
    if (!grant && resolved) {
      // One-time adoption of the legacy mirror — only when unattributed or
      // owned by this same account. Never borrow another account's grant.
      const owner = getRefreshOwner();
      if (!owner || owner === resolved) {
        grant = parseGrant(localStorage.getItem(REFRESH_LS_KEY));
        if (grant) {
          try {
            localStorage.setItem(key, JSON.stringify(grant));
            setRefreshOwner(resolved);
          } catch {}
        }
      }
    }
    grantCache[key] = grant;
    return grant;
  } catch {
    grantCache[key] = null;
    return null;
  }
}

async function persistGrant(grant: RefreshGrant | null, uid?: string | null): Promise<void> {
  const resolved = resolveGrantUid(uid);
  const lsKey = refreshLsKeyFor(resolved);
  const idbKey = refreshIdbKeyFor(resolved);
  grantCache[lsKey] = grant;
  try {
    if (grant) {
      localStorage.setItem(lsKey, JSON.stringify(grant));
      // Legacy global mirror (backwards compatible); guarded by owner on read.
      localStorage.setItem(REFRESH_LS_KEY, JSON.stringify(grant));
      if (resolved) setRefreshOwner(resolved);
    } else {
      localStorage.removeItem(lsKey);
      // Only clear the shared mirror when it belongs to this account (or to
      // nobody) — never delete another account's grant.
      const owner = getRefreshOwner();
      if (!resolved || !owner || owner === resolved) {
        localStorage.removeItem(REFRESH_LS_KEY);
        if (resolved && owner === resolved) setRefreshOwner(null);
      }
    }
  } catch {}
  try {
    const { db } = await import('./db');
    if (grant) {
      await db.preferences.put({ key: idbKey, value: JSON.stringify(grant) });
      await db.preferences.put({ key: REFRESH_IDB_KEY, value: JSON.stringify(grant) }).catch(() => {});
    } else {
      await db.preferences.delete(idbKey);
      const owner = getRefreshOwner();
      if (!resolved || !owner || owner === resolved) {
        await db.preferences.delete(REFRESH_IDB_KEY).catch(() => {});
      }
    }
  } catch {}
  // Cross-device home for the grant: owner-only Firestore doc (best effort —
  // offline or restrictive rules fall back to the local mirror silently).
  try {
    if (uid) {
      const [{ getFirestore, doc, setDoc }, { getApps }] = await Promise.all([
        import('firebase/firestore'),
        import('firebase/app'),
      ]);
      const apps = getApps();
      if (apps.length) {
        const dbf = getFirestore(apps[0]);
        if (grant) {
          await setDoc(
            doc(dbf, 'users', uid, 'integrations', 'google'),
            { refresh_token: grant.rt, scope: grant.scope, updated_at: new Date().toISOString() },
            { merge: true }
          );
        }
      }
    }
  } catch {}
}

/** Pull a cross-device grant down (e.g. fresh login on a second laptop). */
export async function hydrateRefreshGrant(uid?: string | null): Promise<boolean> {
  const resolved = resolveGrantUid(uid);
  if (readGrantSync(resolved)) return true;
  try {
    const [{ getFirestore, doc, getDoc }, { getApps }] = await Promise.all([
      import('firebase/firestore'),
      import('firebase/app'),
    ]);
    const apps = getApps();
    const id = resolved || (await import('./firebase')).auth?.currentUser?.uid;
    if (!apps.length || !id) return false;
    const snap = await getDoc(doc(getFirestore(apps[0]), 'users', id, 'integrations', 'google'));
    const rt = snap.exists() ? (snap.data() as any)?.refresh_token : null;
    if (typeof rt === 'string' && rt.length > 10) {
      await persistGrant({ rt, at: Date.now(), scope: (snap.data() as any)?.scope || '' }, id);
      return true;
    }
  } catch {}
  // IndexedDB mirror (survives localStorage clears within the same browser profile)
  try {
    const { db } = await import('./db');
    const keys = resolved
      ? [refreshIdbKeyFor(resolved), REFRESH_IDB_KEY]
      : [REFRESH_IDB_KEY];
    for (const k of keys) {
      const row: any = await db.preferences.get(k).catch(() => null);
      if (row?.value) {
        const parsed = parseGrant(typeof row.value === 'string' ? row.value : JSON.stringify(row.value));
        if (parsed?.rt) {
          // Guard the legacy mirror the same way as the localStorage path:
          // never adopt another account's grant.
          if (k === REFRESH_IDB_KEY && resolved) {
            const owner = getRefreshOwner();
            if (owner && owner !== resolved) continue;
          }
          grantCache[refreshLsKeyFor(resolved)] = parsed;
          try {
            localStorage.setItem(refreshLsKeyFor(resolved), JSON.stringify(parsed));
            if (resolved) setRefreshOwner(resolved);
          } catch {}
          return true;
        }
      }
    }
  } catch {}
  return false;
}

/** Synchronous: is there a stored offline grant that can mint access tokens? */
export function hasRefreshToken(uid?: string | null): boolean {
  const g = readGrantSync(uid);
  return Boolean(g && typeof g.rt === 'string' && g.rt.length > 10);
}

/** Forget the offline grant everywhere (revoked, or user disconnected). */
export async function clearRefreshGrant(uid?: string | null): Promise<void> {
  const resolved = resolveGrantUid(uid);
  await persistGrant(null, resolved);
  try {
    const id = resolved || (await import('./firebase')).auth?.currentUser?.uid;
    if (id) {
      const [{ getFirestore, doc, deleteDoc }, { getApps }] = await Promise.all([
        import('firebase/firestore'),
        import('firebase/app'),
      ]);
      if (getApps().length) {
        await deleteDoc(doc(getFirestore(getApps()[0]), 'users', id, 'integrations', 'google')).catch(() => {});
      }
    }
  } catch {}
}

// ---- Silent refresh (single-flight so parallel syncs share one request) ----

let inflightRefresh: Promise<boolean> | null = null;

/**
 * Mint a fresh access token from the stored refresh token.
 * Returns true when a usable access token is stored afterwards.
 * Revoked/invalid grants are forgotten and report false (caller reconnects).
 */
export function refreshGoogleAccessToken(force = false): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const grant = readGrantSync();
      if (!grant?.rt) return false;
      if (!force) {
        // Skip the network trip when the current token is comfortably fresh.
        const current = getValidGoogleToken();
        const age = getGoogleTokenAgeMs();
        if (current && (age === null || age < REFRESH_EARLY_MS)) return true;
      }
      const res = await fetch('/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: grant.rt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.error === 'refresh_revoked') {
        await clearRefreshGrant();
        return false;
      }
      if (!res.ok || !data?.access_token) return false;
      setStoredGoogleToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

/**
 * Resolve a usable Google access token, refreshing silently when the current
 * one is missing, expired, or within ~5 minutes of expiring. Returns null only
 * when there is no grant at all (or the grant was revoked).
 */
export async function ensureFreshGoogleToken(): Promise<string | null> {
  try {
    const current = getValidGoogleToken();
    const age = getGoogleTokenAgeMs();
    if (current && (age === null || age < REFRESH_EARLY_MS)) return current;
    if (current && age !== null && age >= REFRESH_EARLY_MS) {
      // Aging token: try to renew, but the current one still works meanwhile.
      const ok = await refreshGoogleAccessToken(true);
      return ok ? getStoredGoogleToken() || current : current;
    }
    // Missing/expired: refresh is the only path (no nagging reconnect UI).
    if (hasRefreshToken()) {
      const ok = await refreshGoogleAccessToken(true);
      if (ok) return getStoredGoogleToken();
    }
    return current;
  } catch {
    return getStoredGoogleToken();
  }
}

/** Fetch wrapper for Google APIs: fresh token in, one silent retry on 401. */
export async function googleFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await ensureFreshGoogleToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    const ok = await refreshGoogleAccessToken(true);
    if (ok) {
      const retryToken = getStoredGoogleToken();
      const retryHeaders = new Headers(init.headers || {});
      if (retryToken) retryHeaders.set('Authorization', `Bearer ${retryToken}`);
      res = await fetch(input, { ...init, headers: retryHeaders });
    }
  }
  return res;
}

// ---- Offline consent grant (one-time per device, permanent afterwards) ----

/**
 * Open the Google consent popup requesting OFFLINE access and exchange the
 * returned code server-side. Returns the fresh access token, or null when the
 * user dismisses / the flow is unavailable (caller keeps existing behavior).
 */
export async function requestOfflineGrant(opts: { gmail?: boolean } = {}): Promise<string | null> {
  if (!isOfflineGrantSupported()) return null;
  await loadGisScript();
  const clientId = getGoogleOAuthClientId();
  const scopes = opts.gmail ? WORKSPACE_SCOPES : CORE_WORKSPACE_SCOPES;
  const code: string = await new Promise<string>((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        ux_mode: 'popup',
        callback: (resp: any) => {
          if (resp?.code) resolve(resp.code);
          else reject(new Error(resp?.error || 'Google consent was dismissed.'));
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || err?.type || 'Google consent failed.'));
        },
      });
      client.requestCode();
    } catch (e) {
      reject(e);
    }
  }).catch((e: any) => {
    const msg = String(e?.message || e || '');
    // Dismissals are not errors — stay silent and keep the current session.
    if (/dismiss|closed|popup_closed|cancel/i.test(msg)) return null as unknown as string;
    throw e;
  });
  if (!code) return null;
  const res = await fetch('/api/auth/google/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: 'postmessage' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error || 'Could not complete Google connection.');
  }
  setStoredGoogleToken(data.access_token);
  if (data.refresh_token) {
    let uid: string | null = null;
    try {
      uid = (await import('./firebase')).auth?.currentUser?.uid || null;
    } catch {}
    await persistGrant({ rt: data.refresh_token, at: Date.now(), scope: data.scope || scopes.join(' ') }, uid);
  }
  markGoogleConnected();
  try {
    window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: data.access_token } }));
  } catch {}
  return data.access_token as string;
}

/** Forget everything Google-related for one account (plus server doc). */
export async function clearGoogleGrant(uid?: string | null): Promise<void> {
  const resolved = resolveGrantUid(uid);
  try {
    const { clearStoredGoogleToken } = await import('./firebase');
    clearStoredGoogleToken(resolved);
  } catch {}
  await clearRefreshGrant(resolved);
  try {
    clearGoogleConnectedFlag();
  } catch {}
}

// ---- Instant Workspace restore + explicit account switching (additive) ----

const GOOGLE_CONNECTED_FLAG_KEY = 'scc_google_connected_v1';

/** True when this browser previously completed a Google grant (fast boot hint). */
export function wasPreviouslyConnected(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem(GOOGLE_CONNECTED_FLAG_KEY) === '1') return true;
  } catch {}
  try {
    if (hasRefreshToken()) return true;
  } catch {}
  try {
    // Any cached access token (mirror or vault copy) counts as a prior grant.
    if (typeof localStorage !== 'undefined' && (localStorage.getItem('google_workspace_access_token') || '').length > 5) return true;
    if (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('google_workspace_access_token') || '').length > 5) return true;
  } catch {}
  return false;
}

/** Remember a successful grant so next launch can silent-restore instantly. */
export function markGoogleConnected(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage?.setItem(GOOGLE_CONNECTED_FLAG_KEY, '1');
  } catch {}
}

/** Forget the boot hint (called on explicit disconnect). */
export function clearGoogleConnectedFlag(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage?.removeItem(GOOGLE_CONNECTED_FLAG_KEY);
  } catch {}
}

/**
 * Synchronous liveness check: fresh access token OR a stored offline grant
 * that can mint one. Never throws; safe to call during render/boot.
 */
export function isConnected(uid?: string | null): boolean {
  try {
    if (getValidGoogleToken()) return true;
  } catch {}
  try {
    if (hasRefreshToken(uid)) return true;
  } catch {}
  return false;
}

/**
 * One-shot GIS silent token attempt (prompt 'none'): resolves an access token
 * when the browser still holds a Google session, otherwise null. Never throws
 * and never shows UI — failures stay silent for the caller to fall back.
 */
function requestSilentGisToken(scopes: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const w = window as any;
      const oauth2 = w?.google?.accounts?.oauth2;
      if (!oauth2?.initTokenClient) return resolve(null);
      const clientId = getGoogleOAuthClientId();
      if (!clientId) return resolve(null);
      let settled = false;
      const done = (token: string | null) => {
        if (!settled) {
          settled = true;
          resolve(token);
        }
      };
      const timer = setTimeout(() => done(null), 8000);
      try {
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: scopes.join(' '),
          prompt: 'none',
          callback: (resp: any) => {
            clearTimeout(timer);
            done(typeof resp?.access_token === 'string' && resp.access_token.length > 5 ? resp.access_token : null);
          },
          error_callback: () => {
            clearTimeout(timer);
            done(null);
          },
        });
        client.requestAccessToken({ prompt: 'none' });
      } catch {
        clearTimeout(timer);
        done(null);
      }
    } catch {
      resolve(null);
    }
  });
}

/**
 * Silent session restore for app launch: fresh cached token first, then the
 * stored offline grant (server refresh), then a GIS prompt-'none' attempt.
 * Resolves a usable access token or null. Never throws and never shows UI —
 * callers fall back to the manual Connect button quietly on null.
 */
export async function trySilentRestore(opts: { gmail?: boolean; uid?: string | null } = {}): Promise<string | null> {
  try {
    const fresh = getValidGoogleToken();
    if (fresh) {
      markGoogleConnected();
      return fresh;
    }
  } catch {}
  try {
    const hydrated = await hydrateRefreshGrant(opts.uid);
    void hydrated;
  } catch {}
  try {
    const refreshed = await refreshGoogleAccessToken(true);
    if (refreshed) {
      const token = getStoredGoogleToken();
      if (token) {
        markGoogleConnected();
        return token;
      }
    }
  } catch {}
  // Last resort: GIS silent (prompt 'none') when a Google session persists.
  try {
    if (!isOfflineGrantSupported()) return null;
    await loadGisScript().catch(() => {});
    const scopes = opts.gmail ? WORKSPACE_SCOPES : CORE_WORKSPACE_SCOPES;
    const silent = await requestSilentGisToken(scopes);
    if (silent) {
      setStoredGoogleToken(silent);
      markGoogleConnected();
      try {
        window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: silent } }));
      } catch {}
      return silent;
    }
  } catch {}
  return null;
}

async function requestOfflineGrantWithPrompt(prompt: string, opts: { gmail?: boolean } = {}): Promise<string | null> {
  if (!isOfflineGrantSupported()) return null;
  await loadGisScript();
  const clientId = getGoogleOAuthClientId();
  const scopes = opts.gmail ? WORKSPACE_SCOPES : CORE_WORKSPACE_SCOPES;
  const code: string = await new Promise<string>((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt,
        ux_mode: 'popup',
        callback: (resp: any) => {
          if (resp?.code) resolve(resp.code);
          else reject(new Error(resp?.error || 'Google consent was dismissed.'));
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || err?.type || 'Google consent failed.'));
        },
      });
      client.requestCode();
    } catch (e) {
      reject(e);
    }
  }).catch((e: any) => {
    const msg = String(e?.message || e || '');
    if (/dismiss|closed|popup_closed|cancel/i.test(msg)) return null as unknown as string;
    throw e;
  });
  if (!code) return null;
  const res = await fetch('/api/auth/google/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: 'postmessage' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error || 'Could not complete Google connection.');
  }
  setStoredGoogleToken(data.access_token);
  if (data.refresh_token) {
    let uid: string | null = null;
    try {
      uid = (await import('./firebase')).auth?.currentUser?.uid || null;
    } catch {}
    await persistGrant({ rt: data.refresh_token, at: Date.now(), scope: data.scope || scopes.join(' ') }, uid);
  }
  markGoogleConnected();
  try {
    window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: data.access_token } }));
  } catch {}
  return data.access_token as string;
}

/**
 * Explicit account switching: forces the Google account chooser
 * (prompt 'select_account') and persists the new offline grant. Returns the
 * fresh access token, or null when the user dismisses. Existing sessions are
 * left untouched on dismiss.
 */
export async function signInWithAccountSelect(opts: { gmail?: boolean } = {}): Promise<string | null> {
  return requestOfflineGrantWithPrompt('select_account', opts);
}

/** LocalStorage key for the teacher-allowlist (miscategorized sender rescue). */
export const TEACHER_ALLOWLIST_KEY = 'scc_teacher_allowlist_v1';

/**
 * Allowlist check for miscategorized senders: returns true when the sender
 * email or display name matches an entry in the local teacher allowlist.
 * Never throws; safe to call during render/classify. Additive export.
 */
export function isTeacherAllowlisted(senderEmail?: string | null, senderName?: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(TEACHER_ALLOWLIST_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const entries = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    if (entries.length === 0) return false;
    const candidates = [senderEmail, senderName]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().toLowerCase());
    if (candidates.length === 0) return false;
    return entries.some((entry) => {
      const norm = entry.trim().toLowerCase();
      return candidates.some((c) => c === norm);
    });
  } catch {
    return false;
  }
}
