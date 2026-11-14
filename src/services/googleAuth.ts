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
  auth,
  getStoredGoogleToken,
  setStoredGoogleToken,
  getValidGoogleToken,
  getGoogleTokenAgeMs,
  getActiveGoogleUid,
  CORE_WORKSPACE_SCOPES,
  WORKSPACE_SCOPES,
} from './firebase';

export type GoogleFeature = 'calendar' | 'gmail' | 'drive' | 'sheets' | 'classroom';

export const FEATURE_SCOPES: Record<GoogleFeature, string[]> = {
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  drive: ['https://www.googleapis.com/auth/drive.file'],
  sheets: ['https://www.googleapis.com/auth/drive.file'],
  classroom: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
  ],
};

const REFRESH_LS_KEY = 'scc_google_refresh_v1';
const REFRESH_IDB_KEY = 'google_refresh_grant_v1';
const SCOPES_LS_KEY = 'scc_google_scopes_v1';
// Which account wrote the legacy (pre-per-uid) grant mirror — a different
// account must never inherit it.
const REFRESH_OWNER_KEY = 'scc_google_refresh_owner';
const refreshLsKeyFor = (uid?: string | null) =>
  uid ? `${REFRESH_LS_KEY}__${uid}` : REFRESH_LS_KEY;
const refreshIdbKeyFor = (uid?: string | null) =>
  uid ? `${REFRESH_IDB_KEY}__${uid}` : REFRESH_IDB_KEY;
const scopesLsKeyFor = (uid?: string | null) =>
  uid ? `${SCOPES_LS_KEY}__${uid}` : SCOPES_LS_KEY;

/** Normalize a space-separated scope string or array into unique, trimmed scope URLs. */
export function normalizeScopes(input?: string | string[] | null): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(/\s+/)) {
      const s = part.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

/** Resolve the account in scope: explicit uid → active session → Firebase current user → null (legacy). */
function resolveGrantUid(explicit?: string | null): string | null {
  if (explicit) return explicit;
  try {
    return getActiveGoogleUid() || auth?.currentUser?.uid || null;
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
            reject(new Error('Could not open the Google sign-in window. Check your connection or ad-blocker, then try again.'));
          }
        }, 100);
        return;
      }
      const s = document.createElement('script');
      s.src = GIS_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not open the Google sign-in window. Check your connection or ad-blocker, then try again.'));
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

export interface RefreshGrant {
  rt: string;
  at: number;
  scope: string;
  grantedScopes?: string[];
}

let grantCache: Record<string, RefreshGrant | null> = {};
let scopesCache: Record<string, string[]> = {};

/** @internal Test-only: drop cached grants & scopes so tests can simulate reload. */
export function __resetGrantCacheForTests() {
  grantCache = {};
  scopesCache = {};
}

function dispatchScopesUpdated(scopes: string[], uid?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('scc-google-scopes-updated', { detail: { scopes, uid: uid || null } }));
  } catch {}
}

function readScopesSync(uid?: string | null): string[] {
  const resolved = resolveGrantUid(uid);
  const key = scopesLsKeyFor(resolved);
  if (scopesCache[key] !== undefined) return scopesCache[key];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = normalizeScopes(Array.isArray(parsed) ? parsed : String(parsed || ''));
      scopesCache[key] = list;
      return list;
    }
    if (resolved) {
      const owner = getRefreshOwner();
      if (!owner || owner === resolved) {
        const legacyRaw = localStorage.getItem(SCOPES_LS_KEY);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          const list = normalizeScopes(Array.isArray(parsed) ? parsed : String(parsed || ''));
          if (list.length) {
            scopesCache[key] = list;
            try {
              localStorage.setItem(key, JSON.stringify(list));
              setRefreshOwner(resolved);
            } catch {}
            return list;
          }
        }
      }
    }
  } catch {}
  scopesCache[key] = [];
  return [];
}

function saveScopesSync(scopes: string[], uid?: string | null): string[] {
  const resolved = resolveGrantUid(uid);
  const key = scopesLsKeyFor(resolved);
  const normalized = normalizeScopes(scopes);
  scopesCache[key] = normalized;
  try {
    if (normalized.length > 0) {
      localStorage.setItem(key, JSON.stringify(normalized));
      localStorage.setItem(SCOPES_LS_KEY, JSON.stringify(normalized));
      if (resolved) setRefreshOwner(resolved);
    } else {
      localStorage.removeItem(key);
      const owner = getRefreshOwner();
      if (!resolved || !owner || owner === resolved) {
        localStorage.removeItem(SCOPES_LS_KEY);
      }
    }
  } catch {}
  return normalized;
}

function parseGrant(raw: string | null): RefreshGrant | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RefreshGrant;
    if (!parsed || typeof parsed.rt !== 'string') return null;
    const normalized = normalizeScopes(
      Array.isArray(parsed.grantedScopes) && parsed.grantedScopes.length > 0
        ? parsed.grantedScopes
        : parsed.scope
    );
    return {
      ...parsed,
      scope: normalized.join(' '),
      grantedScopes: normalized,
    };
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
  const normalizedScopes = grant
    ? normalizeScopes(grant.grantedScopes?.length ? grant.grantedScopes : grant.scope)
    : [];
  const normalizedGrant: RefreshGrant | null = grant
    ? {
        ...grant,
        scope: normalizedScopes.join(' '),
        grantedScopes: normalizedScopes,
      }
    : null;

  grantCache[lsKey] = normalizedGrant;
  saveScopesSync(normalizedScopes, resolved);

  try {
    if (normalizedGrant) {
      localStorage.setItem(lsKey, JSON.stringify(normalizedGrant));
      // Legacy global mirror (backwards compatible); guarded by owner on read.
      localStorage.setItem(REFRESH_LS_KEY, JSON.stringify(normalizedGrant));
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
    if (normalizedGrant) {
      await db.preferences.put({ key: idbKey, value: JSON.stringify(normalizedGrant) });
      await db.preferences.put({ key: REFRESH_IDB_KEY, value: JSON.stringify(normalizedGrant) }).catch(() => {});
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
    const firestoreUid = uid || resolved;
    if (firestoreUid) {
      const [{ getFirestore, doc, setDoc }, { getApps }] = await Promise.all([
        import('firebase/firestore'),
        import('firebase/app'),
      ]);
      const apps = getApps();
      if (apps.length) {
        const dbf = getFirestore(apps[0]);
        if (normalizedGrant) {
          await setDoc(
            doc(dbf, 'users', firestoreUid, 'integrations', 'google'),
            {
              refresh_token: normalizedGrant.rt,
              scope: normalizedGrant.scope,
              grantedScopes: normalizedScopes,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    }
  } catch {}
  dispatchScopesUpdated(normalizedScopes, resolved);
}

/** Merge newly granted scopes into the active account's scope store (and refresh grant if present). */
export function recordGrantedScopes(scopes: string | string[], uid?: string | null): string[] {
  const resolved = resolveGrantUid(uid);
  const incoming = normalizeScopes(scopes);
  if (!incoming.length) return getGrantedScopes(resolved);
  const existing = getGrantedScopes(resolved);
  const merged = normalizeScopes([...existing, ...incoming]);
  saveScopesSync(merged, resolved);
  const grant = readGrantSync(resolved);
  if (grant) {
    const updated: RefreshGrant = {
      ...grant,
      scope: merged.join(' '),
      grantedScopes: merged,
    };
    grantCache[refreshLsKeyFor(resolved)] = updated;
    try {
      localStorage.setItem(refreshLsKeyFor(resolved), JSON.stringify(updated));
      localStorage.setItem(REFRESH_LS_KEY, JSON.stringify(updated));
    } catch {}
  }
  dispatchScopesUpdated(merged, resolved);
  return merged;
}

/** Remove specific revoked/missing scopes from the cached scope list. */
export function removeGrantedScopes(scopesToRemove: string | string[], uid?: string | null): string[] {
  const resolved = resolveGrantUid(uid);
  const removeSet = new Set(normalizeScopes(scopesToRemove));
  const remaining = getGrantedScopes(resolved).filter((s) => !removeSet.has(s));
  saveScopesSync(remaining, resolved);
  const grant = readGrantSync(resolved);
  if (grant) {
    const updated: RefreshGrant = {
      ...grant,
      scope: remaining.join(' '),
      grantedScopes: remaining,
    };
    grantCache[refreshLsKeyFor(resolved)] = updated;
    try {
      localStorage.setItem(refreshLsKeyFor(resolved), JSON.stringify(updated));
      localStorage.setItem(REFRESH_LS_KEY, JSON.stringify(updated));
    } catch {}
  }
  dispatchScopesUpdated(remaining, resolved);
  return remaining;
}

/** All normalized Google OAuth scopes currently granted for this account. */
export function getGrantedScopes(uid?: string | null): string[] {
  const resolved = resolveGrantUid(uid);
  const grant = readGrantSync(resolved);
  const grantScopes = grant
    ? normalizeScopes(grant.grantedScopes?.length ? grant.grantedScopes : grant.scope)
    : [];
  const storedScopes = readScopesSync(resolved);
  return normalizeScopes([...grantScopes, ...storedScopes]);
}

/** Check whether a full scope URL or short suffix (e.g. 'gmail.readonly') has been granted. */
export function hasScope(scopeOrSuffix: string, uid?: string | null): boolean {
  const target = (scopeOrSuffix || '').trim();
  if (!target) return false;
  const granted = getGrantedScopes(uid);
  if (!granted.length) return false;
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return granted.includes(target);
  }
  const suffix = target.replace(/^\/?(auth\/)?/, '');
  return granted.includes(target) || granted.includes(`https://www.googleapis.com/auth/${suffix}`);
}

/** True when the account has an active/restorable Google connection AND every scope needed for `feature`. */
export function hasFeatureAccess(feature: GoogleFeature, uid?: string | null): boolean {
  const required = FEATURE_SCOPES[feature];
  if (!required?.length) return false;
  if (!isConnected(uid)) return false;
  return required.every((s) => hasScope(s, uid));
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('scc-google-token-updated', (e: any) => {
      const detail = e?.detail;
      if (detail?.token === null) {
        scopesCache = {};
        grantCache = {};
        return;
      }
      if (detail?.scopes) {
        recordGrantedScopes(detail.scopes);
      }
    });
  } catch {}
}

/** Pull a cross-device grant down (e.g. fresh login on a second laptop). */
export async function hydrateRefreshGrant(uid?: string | null): Promise<boolean> {
  const resolved = resolveGrantUid(uid);
  const local = readGrantSync(resolved);
  if (local) {
    saveScopesSync(local.grantedScopes?.length ? local.grantedScopes : normalizeScopes(local.scope), resolved);
    return true;
  }
  try {
    const [{ getFirestore, doc, getDoc }, { getApps }] = await Promise.all([
      import('firebase/firestore'),
      import('firebase/app'),
    ]);
    const apps = getApps();
    const id = resolved || (await import('./firebase')).auth?.currentUser?.uid;
    if (!apps.length || !id) return false;
    const snap = await getDoc(doc(getFirestore(apps[0]), 'users', id, 'integrations', 'google'));
    const data = snap.exists() ? (snap.data() as any) : null;
    const rt = data?.refresh_token;
    if (typeof rt === 'string' && rt.length > 10) {
      const scopes = normalizeScopes(
        Array.isArray(data?.grantedScopes) && data.grantedScopes.length > 0
          ? data.grantedScopes
          : data?.scope || ''
      );
      await persistGrant({ rt, at: Date.now(), scope: scopes.join(' '), grantedScopes: scopes }, id);
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
          const scopes = parsed.grantedScopes?.length ? parsed.grantedScopes : normalizeScopes(parsed.scope);
          saveScopesSync(scopes, resolved);
          try {
            localStorage.setItem(refreshLsKeyFor(resolved), JSON.stringify(parsed));
            if (resolved) setRefreshOwner(resolved);
          } catch {}
          dispatchScopesUpdated(scopes, resolved);
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
      const uid = resolveGrantUid();
      const grant = readGrantSync(uid);
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
        body: JSON.stringify({ refresh_token: grant.rt, scope: grant.scope }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.error === 'refresh_revoked') {
        await clearRefreshGrant(uid);
        return false;
      }
      if (!res.ok || !data?.access_token) return false;
      const incomingScopes = normalizeScopes(data.scopes || data.scope);
      const nextScopes = incomingScopes.length
        ? incomingScopes
        : normalizeScopes(grant.grantedScopes?.length ? grant.grantedScopes : grant.scope);
      const prevScopesStr = normalizeScopes(grant.grantedScopes?.length ? grant.grantedScopes : grant.scope).join(' ');
      if (nextScopes.join(' ') !== prevScopesStr || !grant.grantedScopes?.length) {
        await persistGrant(
          {
            rt: grant.rt,
            at: Date.now(),
            scope: nextScopes.join(' '),
            grantedScopes: nextScopes,
          },
          uid
        );
      } else {
        saveScopesSync(nextScopes, uid);
      }
      setStoredGoogleToken(data.access_token, uid, nextScopes);
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

// ---- Offline consent grant & incremental per-feature authorization ----

export interface OfflineGrantOptions {
  gmail?: boolean;
  feature?: GoogleFeature;
  scopes?: string[];
  loginHint?: string;
  uid?: string | null;
  includeGrantedScopes?: boolean;
  prompt?: string;
}

async function resolveCurrentUserContext(explicitUid?: string | null, explicitLoginHint?: string): Promise<{ uid: string | null; loginHint?: string }> {
  let uid = resolveGrantUid(explicitUid);
  let loginHint = explicitLoginHint;
  if (!uid || !loginHint) {
    try {
      const currentUser = (await import('./firebase')).auth?.currentUser;
      if (!uid && currentUser?.uid) uid = currentUser.uid;
      if (!loginHint && currentUser?.email) loginHint = currentUser.email;
    } catch {}
  }
  return { uid, loginHint };
}

async function runGisCodeExchange(params: {
  scopes: string[];
  prompt?: string;
  loginHint?: string;
  uid?: string | null;
  includeGrantedScopes?: boolean;
}): Promise<{ accessToken: string; scopes: string[] } | null> {
  if (!isOfflineGrantSupported()) return null;
  await loadGisScript();
  const clientId = getGoogleOAuthClientId();
  const { uid, loginHint } = await resolveCurrentUserContext(params.uid, params.loginHint);
  const includeGranted = params.includeGrantedScopes !== false;
  const requestedScopes = normalizeScopes(params.scopes);
  if (!requestedScopes.length) return null;

  let codeCallbackScope = '';
  const code: string = await new Promise<string>((resolve, reject) => {
    try {
      const config: Record<string, any> = {
        client_id: clientId,
        scope: requestedScopes.join(' '),
        access_type: 'offline',
        include_granted_scopes: includeGranted,
        ux_mode: 'popup',
        callback: (resp: any) => {
          if (typeof resp?.scope === 'string') codeCallbackScope = resp.scope;
          if (resp?.code) resolve(resp.code);
          else reject(new Error(resp?.error || 'Google permission window was closed.'));
        },
        error_callback: (err: any) => {
          const type = String(err?.type || '');
          if (type === 'popup_failed_to_open') {
            reject(new Error('Your browser blocked the Google popup window. Please allow popups for this site and try again.'));
            return;
          }
          reject(new Error(err?.message || type || 'Google permission could not be completed.'));
        },
      };
      if (params.prompt) config.prompt = params.prompt;
      if (loginHint) config.login_hint = loginHint;
      const client = (window as any).google.accounts.oauth2.initCodeClient(config);
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

  const existingScopes = includeGranted ? getGrantedScopes(uid) : [];
  const res = await fetch('/api/auth/google/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirect_uri: 'postmessage',
      scope: codeCallbackScope || requestedScopes.join(' '),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error || 'Could not complete Google connection.');
  }

  const responseScopes = normalizeScopes(data.scopes || data.scope || codeCallbackScope);
  const mergedScopes =
    responseScopes.length > 0
      ? responseScopes
      : normalizeScopes([...existingScopes, ...requestedScopes]);

  setStoredGoogleToken(data.access_token, uid, mergedScopes);
  const existingGrant = readGrantSync(uid);
  const rt =
    typeof data.refresh_token === 'string' && data.refresh_token.length > 5
      ? data.refresh_token
      : existingGrant?.rt || '';

  if (rt) {
    await persistGrant(
      {
        rt,
        at: Date.now(),
        scope: mergedScopes.join(' '),
        grantedScopes: mergedScopes,
      },
      uid
    );
  } else {
    saveScopesSync(mergedScopes, uid);
    dispatchScopesUpdated(mergedScopes, uid);
  }

  markGoogleConnected();
  return { accessToken: data.access_token as string, scopes: mergedScopes };
}

/**
 * Incremental per-feature Google authorization using GIS `include_granted_scopes: true`
 * and `login_hint` so signed-in users see ONLY one Google permission popup for the
 * specific feature they chose (never a second Firebase popup).
 */
export async function requestFeaturePermission(
  feature: GoogleFeature,
  opts: { loginHint?: string; uid?: string } = {}
): Promise<string | null> {
  const scopes = FEATURE_SCOPES[feature];
  if (!scopes?.length) return null;
  const { uid, loginHint } = await resolveCurrentUserContext(opts.uid, opts.loginHint);
  const prompt = hasRefreshToken(uid) ? undefined : 'consent';
  const result = await runGisCodeExchange({
    scopes,
    prompt,
    loginHint,
    uid,
    includeGrantedScopes: true,
  });
  if (!result) return null;
  const allRequiredGranted = scopes.every((s) => result.scopes.includes(s));
  return allRequiredGranted ? result.accessToken : null;
}

/**
 * Open the Google consent popup requesting OFFLINE access and exchange the
 * returned code server-side. Supports incremental per-feature grants as well as
 * legacy `{ gmail?: boolean }` callers.
 */
export async function requestOfflineGrant(opts: OfflineGrantOptions = {}): Promise<string | null> {
  if (opts.feature) {
    return requestFeaturePermission(opts.feature, {
      loginHint: opts.loginHint,
      uid: opts.uid || undefined,
    });
  }
  const scopes = opts.scopes?.length
    ? opts.scopes
    : opts.gmail
    ? WORKSPACE_SCOPES
    : CORE_WORKSPACE_SCOPES;
  const { uid, loginHint } = await resolveCurrentUserContext(opts.uid, opts.loginHint);
  const prompt = opts.prompt ?? (hasRefreshToken(uid) ? undefined : 'consent');
  const result = await runGisCodeExchange({
    scopes,
    prompt,
    loginHint,
    uid,
    includeGrantedScopes: opts.includeGrantedScopes !== false,
  });
  return result?.accessToken ?? null;
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
export function requestSilentGisToken(
  scopesOrOpts:
    | string[]
    | { scopes?: string[]; gmail?: boolean; feature?: GoogleFeature; loginHint?: string; uid?: string | null } = []
): Promise<string | null> {
  return new Promise((resolve) => {
    (async () => {
      try {
        const w = window as any;
        const oauth2 = w?.google?.accounts?.oauth2;
        if (!oauth2?.initTokenClient) return resolve(null);
        const clientId = getGoogleOAuthClientId();
        if (!clientId) return resolve(null);

        const optsObj = Array.isArray(scopesOrOpts) ? { scopes: scopesOrOpts } : scopesOrOpts;
        const resolvedScopes = optsObj.feature
          ? FEATURE_SCOPES[optsObj.feature]
          : optsObj.scopes?.length
          ? optsObj.scopes
          : optsObj.gmail
          ? WORKSPACE_SCOPES
          : CORE_WORKSPACE_SCOPES;
        const { uid, loginHint } = await resolveCurrentUserContext(optsObj.uid, optsObj.loginHint);

        let settled = false;
        const done = (token: string | null) => {
          if (!settled) {
            settled = true;
            resolve(token);
          }
        };
        const timer = setTimeout(() => done(null), 8000);
        try {
          const config: Record<string, any> = {
            client_id: clientId,
            scope: resolvedScopes.join(' '),
            include_granted_scopes: true,
            prompt: 'none',
            callback: (resp: any) => {
              clearTimeout(timer);
              const tok = typeof resp?.access_token === 'string' && resp.access_token.length > 5 ? resp.access_token : null;
              if (tok) {
                const granted = normalizeScopes(resp?.scope || resolvedScopes);
                if (granted.length) recordGrantedScopes(granted, uid);
              }
              done(tok);
            },
            error_callback: () => {
              clearTimeout(timer);
              done(null);
            },
          };
          if (loginHint) config.login_hint = loginHint;
          const client = oauth2.initTokenClient(config);
          client.requestAccessToken({ prompt: 'none' });
        } catch {
          clearTimeout(timer);
          done(null);
        }
      } catch {
        resolve(null);
      }
    })();
  });
}

/**
 * Silent session restore for app launch: fresh cached token first, then the
 * stored offline grant (server refresh), then a GIS prompt-'none' attempt.
 * Resolves a usable access token or null. Never throws and never shows UI —
 * callers fall back to the manual Connect button quietly on null.
 */
export async function trySilentRestore(
  opts: { gmail?: boolean; feature?: GoogleFeature; scopes?: string[]; uid?: string | null; loginHint?: string } = {}
): Promise<string | null> {
  try {
    const fresh = getValidGoogleToken();
    if (fresh) {
      if (getGrantedScopes(opts.uid).length === 0) {
        await hydrateRefreshGrant(opts.uid).catch(() => {});
      }
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
    const existingScopes = getGrantedScopes(opts.uid);
    const scopes = opts.feature
      ? FEATURE_SCOPES[opts.feature]
      : opts.scopes?.length
      ? opts.scopes
      : existingScopes.length > 0
      ? existingScopes
      : opts.gmail
      ? WORKSPACE_SCOPES
      : CORE_WORKSPACE_SCOPES;
    const silent = await requestSilentGisToken({
      scopes,
      uid: opts.uid,
      loginHint: opts.loginHint,
    });
    if (silent) {
      const latestScopes = getGrantedScopes(opts.uid);
      setStoredGoogleToken(silent, opts.uid, latestScopes);
      markGoogleConnected();
      return silent;
    }
  } catch {}
  return null;
}

/**
 * Explicit account switching: forces the Google account chooser
 * (prompt 'select_account') and persists the new offline grant. Returns the
 * fresh access token, or null when the user dismisses. Existing sessions are
 * left untouched on dismiss.
 */
export async function signInWithAccountSelect(opts: OfflineGrantOptions = {}): Promise<string | null> {
  const scopes = opts.feature
    ? FEATURE_SCOPES[opts.feature]
    : opts.scopes?.length
    ? opts.scopes
    : opts.gmail
    ? WORKSPACE_SCOPES
    : CORE_WORKSPACE_SCOPES;
  const result = await runGisCodeExchange({
    scopes,
    prompt: 'select_account',
    loginHint: opts.loginHint,
    uid: opts.uid,
    includeGrantedScopes: opts.includeGrantedScopes !== false,
  });
  return result?.accessToken ?? null;
}
