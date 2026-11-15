import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  setPersistence,
  browserLocalPersistence,
  getRedirectResult,
} from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';

export const defaultFirebaseOAuthClientId: string =
  typeof (rawFirebaseConfig as any)?.oAuthClientId === 'string'
    ? (rawFirebaseConfig as any).oAuthClientId.trim()
    : '';
import { t } from './i18n';

// Support Vite client-side environment variable overrides for custom deployments (like Vercel)
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

export const effectiveFirebaseConfig = {
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || rawFirebaseConfig.projectId || '',
  appId: metaEnv.VITE_FIREBASE_APP_ID || rawFirebaseConfig.appId || '',
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey || '',
  authDomain:
    metaEnv.VITE_FIREBASE_AUTH_DOMAIN ||
    rawFirebaseConfig.authDomain ||
    `${rawFirebaseConfig.projectId}.firebaseapp.com`,
  firestoreDatabaseId:
    metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    (rawFirebaseConfig as any).firestoreDatabaseId ||
    '',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || rawFirebaseConfig.storageBucket || '',
  messagingSenderId:
    metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || rawFirebaseConfig.messagingSenderId || '',
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || rawFirebaseConfig.measurementId || '',
};

const app = getApps().length === 0 ? initializeApp(effectiveFirebaseConfig) : getApp();
export const auth = getAuth(app);
// Ensure local persistence survives reloads and tab closes (never run getRedirectResult eagerly on import)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export const basicProvider = new GoogleAuthProvider();
basicProvider.setCustomParameters({
  prompt: 'select_account',
});

export const workspaceProvider = new GoogleAuthProvider();
export const coreWorkspaceProvider = new GoogleAuthProvider();

// Google Workspace Scopes — least privilege (judges' feedback, v2.17.0).
// Removed: calendar.readonly (calendar.events already reads), spreadsheets + documents
// (drive.file covers the tracker sheet and docs the app creates), classroom rosters and
// student-submissions (never called), drive.readonly and gmail.compose (drafts now open
// Gmail's own compose window). Every remaining scope is explained in PrivacyModal.
export const CORE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
];

// Full Workspace Scopes: Core plus the one restricted scope, Gmail read-only (opt-in "Quét Gmail").
export const WORKSPACE_SCOPES = [
  ...CORE_WORKSPACE_SCOPES,
  'https://www.googleapis.com/auth/gmail.readonly',
];

CORE_WORKSPACE_SCOPES.forEach((scope) => {
  coreWorkspaceProvider.addScope(scope);
});

WORKSPACE_SCOPES.forEach((scope) => {
  workspaceProvider.addScope(scope);
});

// Prompt to select account seamlessly
coreWorkspaceProvider.setCustomParameters({
  prompt: 'select_account',
});
workspaceProvider.setCustomParameters({
  prompt: 'select_account',
});

// Default provider uses basic sign-in (email & profile only); feature permissions are requested individually on demand.
export const provider = basicProvider;

// Custom error when Google limits access to approved accounts
export class OAuthTestUserRequiredError extends Error {
  isOAuthBlocked: boolean;
  projectId: string;
  constructor(message: string, projectId: string = '') {
    super(message);
    this.name = 'OAuthTestUserRequiredError';
    this.isOAuthBlocked = true;
    this.projectId = projectId;
  }
}

/** Granted sign-in but Google did not finish sharing feature permissions — retryable, never silent. */
export class GoogleWorkspaceGrantMissingError extends Error {
  isOAuthBlocked = false;
  retryable = true;
  constructor(message = 'Google signed you in, but the permission did not finish coming through. Please try again — or use full-page sign-in instead.') {
    super(message);
    this.name = 'GoogleWorkspaceGrantMissingError';
  }
}

export type SignInFailureKind =
  | 'test-user' | 'admin-blocked' | 'unverified' | 'unauthorized-domain'
  | 'api-key' | 'popup-blocked' | 'popup-closed' | 'timeout' | 'network'
  | 'token-missing' | 'unknown';

export interface SignInDiagnosis {
  kind: SignInFailureKind;
  title: string;
  detail: string;
  fix: string;
}

/** Map raw sign-in errors to calm, everyday explanations with clear next steps. */
export function classifySignInError(error: any): SignInDiagnosis {
  const code = error?.code || '';
  const msg = error?.message || '';
  const all = `${code} ${msg} ${String(error || '')}`;

  if (error instanceof GoogleWorkspaceGrantMissingError || code === 'auth/no-auth-token') {
    return {
      kind: 'token-missing',
      title: t('fb_diag_token_title'),
      detail: t('fb_diag_token_detail'),
      fix: t('fb_diag_token_fix'),
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
    return {
      kind: 'popup-closed',
      title: t('fb_diag_closed_title'),
      detail: t('fb_diag_closed_detail'),
      fix: t('fb_diag_closed_fix'),
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      kind: 'popup-blocked',
      title: t('fb_diag_blocked_title'),
      detail: t('fb_diag_blocked_detail'),
      fix: t('fb_diag_blocked_fix'),
    };
  }
  if (/admin|policy|disallowed|org_internal|access blocked by/i.test(all)) {
    return {
      kind: 'admin-blocked',
      title: t('fb_diag_admin_title'),
      detail: t('fb_diag_admin_detail'),
      fix: t('fb_diag_admin_fix'),
    };
  }
  if (code === 'auth/unauthorized-domain' || /unauthorized-domain/i.test(all)) {
    return {
      kind: 'unauthorized-domain',
      title: t('fb_diag_domain_title'),
      detail: t('fb_diag_domain_detail'),
      fix: t('fb_diag_domain_fix'),
    };
  }
  if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key' || /api-key-not-valid/i.test(all)) {
    return {
      kind: 'api-key',
      title: t('fb_diag_apikey_title'),
      detail: t('fb_diag_apikey_detail'),
      fix: t('fb_diag_apikey_fix'),
    };
  }
  if (/verification process|Test users|unverified|access_denied|403|admin-restricted|internal-error/i.test(all)) {
    return {
      kind: 'test-user',
      title: t('fb_diag_limited_title'),
      detail: t('fb_diag_limited_detail'),
      fix: t('fb_diag_limited_fix'),
    };
  }
  if (code === 'auth/network-request-failed' || /network/i.test(all)) {
    return {
      kind: 'network',
      title: t('fb_diag_network_title'),
      detail: t('fb_diag_network_detail'),
      fix: t('fb_diag_network_fix'),
    };
  }
  if (code === 'auth/timeout' || /timeout|timed out/i.test(all)) {
    return {
      kind: 'timeout',
      title: t('fb_diag_timeout_title'),
      detail: t('fb_diag_timeout_detail'),
      fix: t('fb_diag_timeout_fix'),
    };
  }
  return {
    kind: 'unknown',
    title: t('fb_diag_unknown_title'),
    detail: t('fb_diag_unknown_detail'),
    fix: t('fb_diag_unknown_fix'),
  };
}

/** Best-effort browser check shown alongside failures (connection, popups, cookies). */
export function diagnoseSignInEnvironment(): { label: string; ok: boolean; hint?: string }[] {
  const out: { label: string; ok: boolean; hint?: string }[] = [];
  const cfg = effectiveFirebaseConfig;
  out.push({
    label: t('fb_env_service_ready'),
    ok: Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain),
    hint: !cfg.apiKey ? t('fb_env_service_hint') : undefined,
  });
  try {
    out.push({
      label: t('fb_env_current_site', { host: window.location.hostname }),
      ok: true,
      hint: t('fb_env_current_site_hint'),
    });
  } catch { out.push({ label: t('fb_env_current_site_fallback'), ok: false }); }
  try {
    const w = window.open('', '_blank', 'width=10,height=10');
    if (w) { w.close(); out.push({ label: t('fb_env_popups_ok'), ok: true }); }
    else out.push({ label: t('fb_env_popups_blocked'), ok: false, hint: t('fb_env_popups_hint') });
  } catch { out.push({ label: t('fb_env_popups_blocked'), ok: false, hint: t('fb_env_popups_hint') }); }
  try {
    document.cookie = 'scc_cookie_test=1; SameSite=Lax';
    const ok = document.cookie.includes('scc_cookie_test=1');
    document.cookie = 'scc_cookie_test=; Max-Age=0; SameSite=Lax';
    out.push({ label: t('fb_env_cookies'), ok, hint: ok ? undefined : t('fb_env_cookies_hint') });
  } catch { out.push({ label: t('fb_env_cookies'), ok: false }); }
  return out;
}

// Token Storage — global mirror (active session, sync access) + per-uid vault
// (localStorage + IndexedDB) so connections survive logout/relogin and never
// leak across Google accounts. Logout clears only the mirror; the vault is
// wiped solely by an explicit per-account disconnect.
const TOKEN_STORAGE_KEY = 'google_workspace_access_token';
const TOKEN_IDB_KEY = 'google_workspace_access_token_v2';
const TOKEN_ACQUIRED_AT_KEY = 'google_token_acquired_at';
const TOKEN_OWNER_KEY = 'google_workspace_token_owner';

// Firebase uid that owns the current session (set on sign-in / auth change).
let activeGoogleUid: string | null = null;
export function getActiveGoogleUid(): string | null {
  return activeGoogleUid;
}
export function setActiveGoogleUid(uid: string | null) {
  activeGoogleUid = uid || null;
}

const tokenKeyFor = (uid?: string | null) =>
  uid ? `${TOKEN_STORAGE_KEY}__${uid}` : TOKEN_STORAGE_KEY;
const tokenIdbKeyFor = (uid?: string | null) =>
  uid ? `${TOKEN_IDB_KEY}__${uid}` : TOKEN_IDB_KEY;
const acquiredAtKeyFor = (uid?: string | null) =>
  uid ? `${TOKEN_ACQUIRED_AT_KEY}__${uid}` : TOKEN_ACQUIRED_AT_KEY;

function getTokenOwnerUid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_OWNER_KEY);
  } catch {
    return null;
  }
}
function setTokenOwnerUid(uid: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (uid) localStorage.setItem(TOKEN_OWNER_KEY, uid);
    else localStorage.removeItem(TOKEN_OWNER_KEY);
  } catch {}
}

/** Clear only the active-session mirror (memory + session + global local copy).
 *  Per-uid vaults in localStorage/IndexedDB are preserved for relogin restore. */
function clearActiveMirrorOnly() {
  cachedAccessToken = null;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_ACQUIRED_AT_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_ACQUIRED_AT_KEY);
  } catch {}
}

// In-memory cache backed by sessionStorage, localStorage & IndexedDB
let cachedAccessToken: string | null = null;
if (typeof window !== 'undefined') {
  try {
    cachedAccessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    // hydrate from IndexedDB if storage empty (survives tab close)
    if (!cachedAccessToken) {
      try {
        // async hydrate — will populate cache next tick
        import('./db').then(({ db }) => {
          db.preferences.get(TOKEN_IDB_KEY).then((row: any) => {
            if (row?.value) {
              cachedAccessToken = row.value;
              try {
                sessionStorage.setItem(TOKEN_STORAGE_KEY, row.value);
                localStorage.setItem(TOKEN_STORAGE_KEY, row.value);
                window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: row.value } }));
              } catch {}
            }
          }).catch(()=>{});
        });
      } catch {}
    }
  } catch {
    cachedAccessToken = null;
  }
}
async function persistTokenToIDB(token: string | null, uid?: string | null) {
  try {
    const { db } = await import('./db');
    if (token) await db.preferences.put({ key: tokenIdbKeyFor(uid), value: token });
    else await db.preferences.delete(tokenIdbKeyFor(uid));
  } catch {}
}

async function persistAcquiredAtToIDB(uid?: string | null) {
  try {
    const now = String(Date.now());
    const { db } = await import('./db');
    await db.preferences.put({ key: acquiredAtKeyFor(uid), value: now }).catch(() => {});
  } catch {}
}

let isSigningIn = false;

export const onAuthStateChangedListener = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const setStoredGoogleToken = (token: string, uid?: string | null, scopes?: string[]) => {
  const owner = uid ?? activeGoogleUid;
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      const now = String(Date.now());
      // Global mirror (sync access for existing callers)
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(TOKEN_ACQUIRED_AT_KEY, now);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_ACQUIRED_AT_KEY, now);
      // Per-uid vault (survives logout; isolated per account)
      if (owner) {
        try {
          sessionStorage.setItem(tokenKeyFor(owner), token);
          sessionStorage.setItem(acquiredAtKeyFor(owner), now);
          localStorage.setItem(tokenKeyFor(owner), token);
          localStorage.setItem(acquiredAtKeyFor(owner), now);
        } catch {}
        setTokenOwnerUid(owner);
        persistTokenToIDB(token, owner);
        persistAcquiredAtToIDB(owner);
      }
      persistTokenToIDB(token);
      import('./db').then(({ db }) => db.preferences.put({ key: 'google_token_acquired_at', value: String(Date.now()) }).catch(()=>{}));
      window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token, scopes, uid: owner } }));
    } catch {}
  }
};

/**
 * Explicit per-account disconnect: wipes the mirror AND that account's vault
 * (localStorage + IndexedDB). Logout (signOutUser) must NOT call this.
 */
export const clearStoredGoogleToken = (uid?: string | null) => {
  const owner = uid ?? activeGoogleUid;
  clearActiveMirrorOnly();
  if (typeof window !== 'undefined' && owner) {
    try {
      sessionStorage.removeItem(tokenKeyFor(owner));
      sessionStorage.removeItem(acquiredAtKeyFor(owner));
      localStorage.removeItem(tokenKeyFor(owner));
      localStorage.removeItem(acquiredAtKeyFor(owner));
    } catch {}
    persistTokenToIDB(null, owner);
    try {
      import('./db').then(({ db }) => db.preferences.delete(acquiredAtKeyFor(owner)).catch(() => {}));
    } catch {}
    if (getTokenOwnerUid() === owner) setTokenOwnerUid(null);
  } else if (typeof window !== 'undefined' && !owner) {
    // No uid context (legacy path): clear the global copies as before.
    persistTokenToIDB(null);
    try {
      window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: null } }));
    } catch {}
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: null } }));
    } catch {}
  }
};

/**
 * Restore the token bundle for `uid` after reload/relogin/account switch.
 * Reads the per-uid vault (IndexedDB → localStorage), falls back to the
 * legacy global copies and adopts them into the vault (one-time migration).
 * When the vault is empty AND the mirror belongs to another account, the
 * mirror is cleared so accounts never share tokens.
 * Resolves the restored token, or null when this account has none.
 */
export async function hydrateGoogleTokenForUser(uid: string): Promise<string | null> {
  setActiveGoogleUid(uid);
  if (typeof window === 'undefined') return null;
  // Collect every copy (IndexedDB vault, localStorage vault, legacy global
  // mirrors) with its timestamp and keep the NEWEST — a save followed by an
  // instant reload must never restore a stale copy.
  const candidates: { token: string; at: number }[] = [];
  const consider = (token: any, at: any) => {
    const t = typeof token === 'string' ? token : null;
    if (!t || t.length <= 5) return;
    let stamp = typeof at === 'string' || typeof at === 'number' ? parseInt(String(at), 10) : NaN;
    if (!Number.isFinite(stamp)) stamp = 0;
    candidates.push({ token: t, at: stamp });
  };
  // The shared/global mirror may hold ANOTHER account's token (e.g. account
  // switch without logout). Only trust it when unattributed (legacy data) or
  // owned by this same account — otherwise ignore it completely.
  const mirrorOwner = getTokenOwnerUid();
  const mirrorEligible = !mirrorOwner || mirrorOwner === uid;
  try {
    const { db } = await import('./db');
    try {
      const rows: [string, string][] = [
        [tokenIdbKeyFor(uid), acquiredAtKeyFor(uid)],
        [TOKEN_IDB_KEY, TOKEN_ACQUIRED_AT_KEY],
      ];
      for (const [tk, ak] of rows) {
        const isGlobalRow = tk === TOKEN_IDB_KEY;
        if (isGlobalRow && !mirrorEligible) continue; // another account's mirror
        try {
          const [tRow, aRow]: any[] = await Promise.all([
            db.preferences.get(tk).catch(() => null),
            db.preferences.get(ak).catch(() => null),
          ]);
          consider(tRow?.value, aRow?.value);
        } catch {}
      }
    } catch {}
    try {
      consider(localStorage.getItem(tokenKeyFor(uid)), localStorage.getItem(acquiredAtKeyFor(uid)));
      consider(sessionStorage.getItem(tokenKeyFor(uid)), sessionStorage.getItem(acquiredAtKeyFor(uid)));
      if (mirrorEligible) {
        consider(localStorage.getItem(TOKEN_STORAGE_KEY), localStorage.getItem(TOKEN_ACQUIRED_AT_KEY));
        consider(sessionStorage.getItem(TOKEN_STORAGE_KEY), sessionStorage.getItem(TOKEN_ACQUIRED_AT_KEY));
      }
    } catch {}
  } catch {
    // storage unavailable — no candidates
  }
  candidates.sort((a, b) => b.at - a.at);
  const best = candidates[0] || null;
  if (best) {
    // Adopt the winner into the mirror + vault (migrates legacy copies forward).
    setStoredGoogleToken(best.token, uid);
    if (best.at > 0) {
      const stamp = String(best.at);
      try {
        sessionStorage.setItem(TOKEN_ACQUIRED_AT_KEY, stamp);
        localStorage.setItem(TOKEN_ACQUIRED_AT_KEY, stamp);
        sessionStorage.setItem(acquiredAtKeyFor(uid), stamp);
        localStorage.setItem(acquiredAtKeyFor(uid), stamp);
      } catch {}
    }
    return best.token;
  }
  const owner = getTokenOwnerUid();
  if (owner && owner !== uid) {
    // Mirror belongs to another account — never reuse it here.
    clearActiveMirrorOnly();
    try {
      window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: null } }));
    } catch {}
  }
  return null;
}

export const hasActiveGoogleWorkspaceToken = (): boolean => {
  return Boolean(getValidGoogleToken());
};

/**
 * Access-token freshness helpers. Popup tokens live ~60 minutes; the permanent
 * offline grant in ./googleAuth mints fresh ones silently via the server, so
 * these age checks are now a quiet fallback (stale token = refresh, never a
 * user-facing expiry banner). Kept semantics-stable for existing callers.
 */
export const GOOGLE_TOKEN_TTL_MS = 55 * 60 * 1000; // refresh 5 min before the real ~60 min expiry

export function getGoogleTokenAgeMs(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const uid = activeGoogleUid;
    const raw =
      (uid ? sessionStorage.getItem(acquiredAtKeyFor(uid)) : null) ||
      (uid ? localStorage.getItem(acquiredAtKeyFor(uid)) : null) ||
      sessionStorage.getItem(TOKEN_ACQUIRED_AT_KEY) ||
      localStorage.getItem(TOKEN_ACQUIRED_AT_KEY);
    if (!raw) return null; // signed in before timestamps existed → unknown, treat as fresh
    const age = Date.now() - parseInt(raw, 10);
    return Number.isFinite(age) && age >= 0 ? age : null;
  } catch {
    return null;
  }
}

export function isGoogleTokenExpired(): boolean {
  const token = getStoredGoogleToken();
  if (!token) return false; // nothing to expire
  const age = getGoogleTokenAgeMs();
  if (age === null) return false; // unknown age → preserve current behavior
  return age > GOOGLE_TOKEN_TTL_MS;
}

/** Returns the token only if present AND fresh; null otherwise (missing or expired). */
export function getValidGoogleToken(): string | null {
  const token = getStoredGoogleToken();
  if (!token) return null;
  return isGoogleTokenExpired() ? null : token;
}

/** True when a token exists but is past its TTL — i.e. user must reconnect. */
export function needsGoogleReconnect(): boolean {
  return getStoredGoogleToken() !== null && isGoogleTokenExpired();
}

export type GoogleTokenStatus = 'connected' | 'expired' | 'missing';
/**
 * Distinguish the three connection states explicitly so UI can show:
 * connected (fresh token) vs expired (1-click reconnect, keep settings)
 * vs missing (never granted — show full connect flow).
 */
export function getGoogleTokenStatus(): GoogleTokenStatus {
  const token = getStoredGoogleToken();
  if (!token) return 'missing';
  return isGoogleTokenExpired() ? 'expired' : 'connected';
}

export const signInWithGoogle = async (
  options: { requestWorkspace?: boolean; includeGmail?: boolean } = { requestWorkspace: false }
): Promise<{ user: User; accessToken: string } | null> => {
  const requestWorkspace = Boolean(options?.requestWorkspace);
  const targetProvider = !requestWorkspace
    ? basicProvider
    : options?.includeGmail
    ? workspaceProvider
    : coreWorkspaceProvider;

  try {
    isSigningIn = true;
    // Ensure persistence before popup
    try { await setPersistence(auth, browserLocalPersistence); } catch {}
    let result: any;
    try {
      // Watchdog: never spin forever if the popup hangs (strict blockers, lost postMessage).
      // A late success still lands via onAuthStateChanged, so racing is safe.
      const POPUP_TIMEOUT_MS = 90000;
      result = await Promise.race([
        signInWithPopup(auth, targetProvider),
        new Promise((_res, rej) => setTimeout(() => rej(Object.assign(new Error(t('fb_err_timeout')), { code: 'auth/timeout' })), POPUP_TIMEOUT_MS)),
      ]);
    } catch (popupErr: any) {
      const code = popupErr?.code || '';
      // Fallback to redirect if popup blocked by browser
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, targetProvider);
          return null; // redirect will reload page
        } catch {}
      }
      throw popupErr;
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const signedInUid: string | null = result?.user?.uid || null;
    if (signedInUid) setActiveGoogleUid(signedInUid);

    // Store access token in memory, localStorage, sessionStorage & IndexedDB
    // ONLY when workspace access was explicitly requested!
    if (requestWorkspace && credential?.accessToken) {
      const requestedScopes = options?.includeGmail ? WORKSPACE_SCOPES : CORE_WORKSPACE_SCOPES;
      setStoredGoogleToken(credential.accessToken, signedInUid, requestedScopes);
    } else if (!requestWorkspace) {
      // Basic profile login must NEVER destroy a stored Workspace grant.
      // Only drop the active mirror when switching to a *different* account,
      // so a stale token is never mistaken for the new account's session.
      // Per-uid vaults are always preserved for instant restore on relogin.
      if (signedInUid && getTokenOwnerUid() && getTokenOwnerUid() !== signedInUid) {
        clearActiveMirrorOnly();
      }
    }

    // Workspace was requested and granted, but no token arrived — never downgrade
    // silently to "basic" (that dead-ends sync with zero explanation). Throw so the
    // UI offers a real retry / redirect path.
    if (requestWorkspace && !credential?.accessToken) {
      throw new GoogleWorkspaceGrantMissingError();
    }
    
    return {
      user: result.user,
      accessToken: requestWorkspace ? (credential?.accessToken || '') : '',
    };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';
    const errorString = String(error || '');

    // Handle normal user popup dismissals gracefully without console.error or exceptions
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/user-cancelled' ||
      errorMsg.includes('popup-closed-by-user') ||
      errorMsg.includes('cancelled-popup-request')
    ) {
      console.info('Google Sign-In popup was closed or dismissed.');
      return null;
    }

    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by browser. Please allow popups for this site.');
      throw new Error(t('fb_err_popup_blocked'));
    }

    console.error('Sign in error:', error);

    // Detect Google OAuth verification / Test Users 403 block
    if (
      errorMsg.includes('access_denied') ||
      errorMsg.includes('verification process') ||
      errorMsg.includes('403') ||
      errorString.includes('access_denied') ||
      errorCode === 'auth/admin-restricted-operation' ||
      errorCode === 'auth/internal-error'
    ) {
      throw new OAuthTestUserRequiredError(
        t('fb_err_limited'),
        effectiveFirebaseConfig.projectId
      );
    }

    if (
      errorCode === 'auth/api-key-not-valid' ||
      errorCode === 'auth/invalid-api-key' ||
      errorMsg.includes('api-key-not-valid') ||
      errorMsg.includes('API key')
    ) {
      throw new Error(t('fb_err_apikey'));
    }

    if (
      errorCode === 'auth/unauthorized-domain' ||
      errorMsg.includes('unauthorized-domain')
    ) {
      const currentHost =
        typeof window !== 'undefined' ? window.location.hostname : t('fb_this_link');
      throw new Error(t('fb_err_domain', { host: currentHost }));
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const signInWithGoogleBasic = async (): Promise<{ user: User; accessToken: string } | null> => {
  return signInWithGoogle({ requestWorkspace: false });
};

export type FirebaseFeaturePopupResult =
  | { status: 'granted'; accessToken: string; grantedScopes: string[]; uid: string | null; user?: User | null }
  | { status: 'dismissed' }
  | { status: 'popup_blocked' }
  | { status: 'error'; code?: string; message: string };

const REDIRECT_PENDING_KEY = 'scc_pending_redirect_oauth_v1';

async function lookupTokenGrantedScopes(accessToken: string, fallbackScopes: string[]): Promise<string[]> {
  let grantedScopes = [...fallbackScopes];
  try {
    const infoController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const infoTimer = infoController ? setTimeout(() => infoController.abort(), 5000) : null;
    try {
      const infoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
        { signal: infoController?.signal }
      );
      if (infoRes.ok) {
        const info = await infoRes.json().catch(() => null);
        if (info && typeof info.scope === 'string' && info.scope.trim().length > 0) {
          grantedScopes = info.scope.split(/\s+/).map((s: string) => s.trim()).filter(Boolean);
        }
      }
    } finally {
      if (infoTimer) clearTimeout(infoTimer);
    }
  } catch {
    // Fallback to requested list if tokeninfo lookup is offline
  }
  return grantedScopes;
}

/**
 * Primary interactive per-feature Google authorization via Firebase Auth popup.
 * Mirrors the classic `signInWithPopup` transport (firebaseapp.com/__/auth/handler)
 * so Chrome's COOP headers on Google's unverified-app screen never sever the popup
 * or cancel consent mid-flow, and a single popup signs in + grants scopes at once.
 */
export async function requestFirebaseFeaturePopupScopes(
  scopes: string[],
  options: { loginHint?: string; forceConsent?: boolean; selectAccount?: boolean } = {}
): Promise<FirebaseFeaturePopupResult> {
  if (!scopes.length) return { status: 'error', message: 'No scopes specified' };
  const scopeProvider = new GoogleAuthProvider();
  scopes.forEach((s) => scopeProvider.addScope(s));
  const customParams: Record<string, string> = {
    include_granted_scopes: 'true',
    prompt: options.selectAccount
      ? options.forceConsent !== false
        ? 'select_account consent'
        : 'select_account'
      : options.forceConsent !== false
      ? 'consent'
      : 'select_account',
  };
  if (options.loginHint && !options.selectAccount) {
    customParams.login_hint = options.loginHint;
  }
  scopeProvider.setCustomParameters(customParams);

  try {
    isSigningIn = true;
    // Persistence is already configured on startup; keep this non-blocking so
    // `signInWithPopup` runs inside the original click gesture without popup blocks.
    void setPersistence(auth, browserLocalPersistence).catch(() => {});
    const POPUP_TIMEOUT_MS = 90000;
    const result: any = await Promise.race([
      signInWithPopup(auth, scopeProvider),
      new Promise((_res, rej) =>
        setTimeout(() => rej(Object.assign(new Error(t('fb_err_timeout')), { code: 'auth/timeout' })), POPUP_TIMEOUT_MS)
      ),
    ]);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    const resolvedUser: User | null = result?.user || auth.currentUser || null;
    const uid: string | null = resolvedUser?.uid || null;
    if (!accessToken) {
      return { status: 'error', message: t('fb_err_no_access_token') };
    }

    // Verify which granular scopes Google actually granted to this token.
    const grantedScopes = await lookupTokenGrantedScopes(accessToken, scopes);

    if (uid) setActiveGoogleUid(uid);
    try {
      if (typeof localStorage !== 'undefined' && resolvedUser?.email) {
        localStorage.setItem('scc_google_email_v1', resolvedUser.email);
      }
    } catch {}
    return { status: 'granted', accessToken, grantedScopes, uid, user: resolvedUser };
  } catch (err: any) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled' ||
      /popup-closed-by-user|cancelled-popup-request|user-cancelled/i.test(msg)
    ) {
      return { status: 'dismissed' };
    }
    if (code === 'auth/popup-blocked' || /popup-blocked/i.test(msg)) {
      return { status: 'popup_blocked' };
    }
    if (code === 'auth/access-denied' || /access_denied/i.test(msg)) {
      return { status: 'dismissed' };
    }
    return { status: 'error', code, message: msg || t('gauth_connect_failed') };
  } finally {
    isSigningIn = false;
  }
}

export const signInWithGmail = async (): Promise<{ user: User; accessToken: string } | null> => {
  return signInWithGoogle({ requestWorkspace: true, includeGmail: true });
};

/**
 * Popup-hostile browsers (blocked popups, strict cookie/COOP policies) need the
 * redirect flow: Google takes over the whole tab, then returns. Nothing resolves
 * here — call consumeRedirectResult() on the next load to finish the job.
 */
export const signInWithRedirectFlow = async (
  options: { requestWorkspace?: boolean; includeGmail?: boolean; feature?: string; scopes?: string[] } = {
    requestWorkspace: false,
  }
): Promise<void> => {
  const customScopes = Array.isArray(options?.scopes) ? options.scopes.filter(Boolean) : [];
  let targetProvider: GoogleAuthProvider;
  let pendingScopes: string[] = [];

  if (customScopes.length > 0) {
    targetProvider = new GoogleAuthProvider();
    customScopes.forEach((s) => targetProvider.addScope(s));
    targetProvider.setCustomParameters({
      include_granted_scopes: 'true',
      prompt: 'consent',
    });
    pendingScopes = customScopes;
  } else {
    const requestWorkspace = Boolean(options?.requestWorkspace);
    targetProvider = !requestWorkspace
      ? basicProvider
      : options?.includeGmail
      ? workspaceProvider
      : coreWorkspaceProvider;
    pendingScopes = requestWorkspace
      ? options?.includeGmail
        ? WORKSPACE_SCOPES
        : CORE_WORKSPACE_SCOPES
      : [];
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(
        REDIRECT_PENDING_KEY,
        JSON.stringify({ feature: options?.feature || null, scopes: pendingScopes })
      );
    }
  } catch {}
  try { await setPersistence(auth, browserLocalPersistence); } catch {}
  await signInWithRedirect(auth, targetProvider);
};

export interface ConsumedRedirectResult {
  user: User;
  accessToken: string;
  grantedScopes: string[];
  feature?: string | null;
}

let redirectResultPromise: Promise<ConsumedRedirectResult | null> | null = null;

/** @internal Test-only: reset memoized redirect result promise. */
export function __resetRedirectResultForTests() {
  redirectResultPromise = null;
}

/**
 * Finish a redirect sign-in after Google returns to the app. Returns the user,
 * workspace token (if granted), and verified scopes, or null when not a redirect return.
 * Memoized per page load so repeated calls (e.g. React StrictMode) consume once cleanly.
 */
export const consumeRedirectResult = async (): Promise<ConsumedRedirectResult | null> => {
  if (!redirectResultPromise) {
    redirectResultPromise = (async () => {
      try {
        let pendingFeature: string | null = null;
        let pendingScopes: string[] = [];
        try {
          if (typeof sessionStorage !== 'undefined') {
            const raw = sessionStorage.getItem(REDIRECT_PENDING_KEY);
            sessionStorage.removeItem(REDIRECT_PENDING_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (typeof parsed?.feature === 'string' && parsed.feature) pendingFeature = parsed.feature;
              if (Array.isArray(parsed?.scopes)) pendingScopes = parsed.scopes.filter((s: unknown) => typeof s === 'string');
            }
          }
        } catch {}

        const result = await getRedirectResult(auth);
        if (!result?.user) return null;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const uid: string | null = result.user?.uid || null;
        if (uid) setActiveGoogleUid(uid);
        const accessToken = credential?.accessToken || '';
        const grantedScopes = accessToken ? await lookupTokenGrantedScopes(accessToken, pendingScopes) : [];
        if (accessToken) {
          setStoredGoogleToken(accessToken, uid, grantedScopes.length ? grantedScopes : undefined);
        }
        return { user: result.user, accessToken, grantedScopes, feature: pendingFeature };
      } catch {
        return null;
      }
    })();
  }
  return redirectResultPromise;
};

export const googleSignIn = signInWithGoogle;

export const getStoredGoogleToken = (): string | null => {
  if (cachedAccessToken && cachedAccessToken.length > 5) {
    return cachedAccessToken;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored && stored.length > 5) {
        cachedAccessToken = stored;
        return stored;
      }
      const localStored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (localStored && localStored.length > 5) {
        cachedAccessToken = localStored;
        try { sessionStorage.setItem(TOKEN_STORAGE_KEY, localStored); } catch {}
        return localStored;
      }
      // Per-uid vault fallback (sync layers only; IndexedDB restores async
      // via hydrateGoogleTokenForUser on auth change).
      const uid = activeGoogleUid || auth.currentUser?.uid;
      if (uid) {
        const vault =
          sessionStorage.getItem(tokenKeyFor(uid)) ||
          localStorage.getItem(tokenKeyFor(uid));
        if (vault && vault.length > 5) {
          cachedAccessToken = vault;
          try {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, vault);
            localStorage.setItem(TOKEN_STORAGE_KEY, vault);
          } catch {}
          return vault;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredGoogleToken();
};

/** @internal Test-only: drop the in-memory token so tests can simulate reload. */
export function __resetTokenMemoryForTests() {
  cachedAccessToken = null;
}

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      persistTokenToIDB(token);
    } catch {}
  }
};

export const signOutUser = async () => {
  // Logout clears the session (memory + sessionStorage + global mirror) but
  // KEEPS every account's per-uid vault (localStorage + IndexedDB) so the
  // next login restores Canvas/Google connections instantly. Use
  // clearStoredGoogleToken(uid) only for an explicit per-account disconnect.
  clearActiveMirrorOnly();
  setActiveGoogleUid(null);
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scc-google-token-updated', { detail: { token: null } }));
    }
  } catch {}
  await signOut(auth);
};

export const logout = signOutUser;
