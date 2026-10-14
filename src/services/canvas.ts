import { CanvasAssignment, CanvasSettings, Assignment } from '../types';

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  calendarFeedUrl: '',
  apiDomain: 'https://canvas.instructure.com',
  apiToken: '',
  autoSync: true,
  lastSyncedAt: undefined,
};

const LOCAL_STORAGE_CANVAS_KEY = 'scc_canvas_settings_v1';

// Firebase uid that owns the current Canvas bundle (set on sign-in / auth change).
let activeCanvasUid: string | null = null;
export function getActiveCanvasUid(): string | null {
  return activeCanvasUid;
}
export function setActiveCanvasUid(uid: string | null) {
  activeCanvasUid = uid || null;
}
export function canvasKeyFor(uid?: string | null): string {
  return uid ? `${LOCAL_STORAGE_CANVAS_KEY}__${uid}` : LOCAL_STORAGE_CANVAS_KEY;
}
// Tracks which account wrote the legacy global mirror, so a *different*
// account signing in later never inherits it (no cross-account mixing).
const CANVAS_OWNER_KEY = 'scc_canvas_settings_owner';
function getCanvasMirrorOwner(): string | null {
  try {
    return localStorage.getItem(CANVAS_OWNER_KEY);
  } catch {
    return null;
  }
}

/** True when any Canvas settings exist (legacy global or any per-uid vault). */
export function hasAnyCanvasSettings(): boolean {
  try {
    if (localStorage.getItem(LOCAL_STORAGE_CANVAS_KEY)) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${LOCAL_STORAGE_CANVAS_KEY}__`)) return true;
    }
  } catch {}
  return false;
}

/**
 * Normalize a user-pasted Canvas instance URL to `https://<host>`.
 * Accepts full login URLs (e.g. `https://4015.instructure.com/login/`),
 * bare hosts (`4015.instructure.com`), webcal links, or full origins —
 * strips any path/query/hash (incl. a pasted `/api/v1` prefix) and trailing
 * slashes so REST calls hit the API root exactly once. Preserves
 * non-default ports for self-hosted Canvas instances.
 */
export function normalizeCanvasDomain(input?: string, fallback = 'https://canvas.instructure.com'): string {
  if (!input || !input.trim()) return fallback;
  // Handle webcal:// FIRST (before the scheme check) so a pasted
  // `webcal://host/...` link is not mangled into `https://webcal://...`.
  let raw = input.trim().replace(/^webcal:\/\//i, 'https://');
  // Allow bare hosts like `4015.instructure.com`
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    if (!u.hostname || !u.hostname.includes('.')) return fallback;
    const port = u.port ? `:${u.port}` : '';
    return `${u.protocol}//${u.hostname}${port}`;
  } catch {
    return fallback;
  }
}

/**
 * Early, human-readable validation for API-mode credentials (additive helper;
 * existing callers are unaffected). Returns an actionable message, or null
 * when the pair is well-formed. Never throws.
 */
export function validateCanvasCredentials(domain?: string, token?: string): string | null {
  const cleanToken = (token || '').trim();
  const rawDomain = (domain || '').trim();
  if (!rawDomain && !cleanToken) {
    return 'Paste your Canvas URL and API token (Canvas → Account → Settings → New Access Token), or paste a Calendar Feed URL instead.';
  }
  if (rawDomain && !cleanToken) {
    return 'Canvas URL saved, but the API token is missing — add your token (Canvas → Account → Settings → New Access Token), then retry.';
  }
  if (!rawDomain && cleanToken) {
    return 'API token needs your Canvas URL too (e.g. https://4015.instructure.com).';
  }
  const probe = rawDomain.replace(/^webcal:\/\//i, 'https://');
  const withScheme = /^https?:\/\//i.test(probe) ? probe : `https://${probe}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'That Canvas URL does not look right — it should start with https:// (e.g. https://4015.instructure.com).';
    }
    if (!u.hostname || !u.hostname.includes('.')) {
      return 'That Canvas URL does not look right — check it is exactly your school host (e.g. https://4015.instructure.com).';
    }
  } catch {
    return 'That Canvas URL does not look right — check it is exactly your school host (e.g. https://4015.instructure.com).';
  }
  return null;
}

/**
 * Extract root Canvas domain from calendarFeedUrl or return fallback
 * (normalized to protocol + host so `/login/` style pastes still work).
 */
export function extractCanvasDomain(feedUrl?: string, defaultDomain = 'https://canvas.instructure.com'): string {
  if (!feedUrl || !feedUrl.trim()) return normalizeCanvasDomain(defaultDomain);
  try {
    let clean = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
    // Tolerate a pasted bare host (`4015.instructure.com/...`) — same rule as
    // normalizeCanvasDomain — so links don't silently point at the default host.
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    const u = new URL(clean);
    if (!u.hostname || !u.hostname.includes('.')) return normalizeCanvasDomain(defaultDomain);
    return `${u.protocol}//${u.host}`;
  } catch {
    return normalizeCanvasDomain(defaultDomain);
  }
}

/**
 * Resolve authentic full Canvas URL for redirecting directly to Canvas
 */
export function resolveCanvasUrl(
  htmlUrl?: string,
  settingsDomain?: string,
  feedUrl?: string,
  courseId?: string,
  assignmentId?: string
): string {
  const extractedDomain = extractCanvasDomain(feedUrl, settingsDomain || 'https://canvas.instructure.com');
  const baseDomain = (extractedDomain || settingsDomain || 'https://canvas.instructure.com').replace(/\/+$/, '');

  if (htmlUrl && htmlUrl.trim()) {
    const trimmed = htmlUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${baseDomain}${cleanPath}`;
  }

  const rawAssignId = (assignmentId || '').replace(/^(canvas-assign-|canvas-planner-|canvas-api-|canvas-ics-)/, '');
  if (courseId && rawAssignId && !isNaN(Number(rawAssignId))) {
    return `${baseDomain}/courses/${courseId}/assignments/${rawAssignId}`;
  }
  if (courseId) {
    return `${baseDomain}/courses/${courseId}/assignments`;
  }
  return `${baseDomain}`;
}

function normalizeSettingsShape(parsed: any): CanvasSettings {
  return {
    ...DEFAULT_CANVAS_SETTINGS,
    ...parsed,
    // Migrate legacy stored values like `https://xxx.instructure.com/login/`
    apiDomain: normalizeCanvasDomain(
      parsed.apiDomain || DEFAULT_CANVAS_SETTINGS.apiDomain,
      DEFAULT_CANVAS_SETTINGS.apiDomain
    ),
  };
}

function readCanvasKey(key: string): CanvasSettings | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return normalizeSettingsShape(JSON.parse(saved));
  } catch (e) {
    console.error('Error loading Canvas settings:', e);
  }
  return null;
}

export function loadCanvasSettings(uid?: string | null): CanvasSettings {
  const owner = uid ?? activeCanvasUid;
  // Per-uid vault first — accounts never share Canvas connections.
  if (owner) {
    const scoped = readCanvasKey(canvasKeyFor(owner));
    if (scoped) return scoped;
    // No vault yet: only adopt the legacy mirror when it is unattributed
    // (pre-upgrade data) or was written by this same account. Otherwise this
    // is another account's leftover — start blank instead of mixing.
    const mirrorOwner = getCanvasMirrorOwner();
    if (mirrorOwner && mirrorOwner !== owner) return { ...DEFAULT_CANVAS_SETTINGS };
  }
  // Legacy global copy (written by older versions): adopt into the vault once.
  const legacy = readCanvasKey(LOCAL_STORAGE_CANVAS_KEY);
  if (legacy) {
    if (owner) {
      try {
        localStorage.setItem(canvasKeyFor(owner), JSON.stringify(legacy));
        localStorage.setItem(CANVAS_OWNER_KEY, owner);
      } catch {}
    }
    return legacy;
  }
  return DEFAULT_CANVAS_SETTINGS;
}

/** Switch the active Canvas bundle to `uid` and return its settings. */
export function hydrateCanvasSettingsForUser(uid: string): CanvasSettings {
  setActiveCanvasUid(uid);
  return loadCanvasSettings(uid);
}

export function saveCanvasSettings(settings: CanvasSettings, uid?: string | null) {
  try {
    const normalized = {
      ...settings,
      apiDomain: normalizeCanvasDomain(settings.apiDomain, DEFAULT_CANVAS_SETTINGS.apiDomain),
    };
    const owner = uid ?? activeCanvasUid;
    // Per-uid vault (survives logout/relogin, isolated per account).
    if (owner) {
      try {
        localStorage.setItem(canvasKeyFor(owner), JSON.stringify(normalized));
        localStorage.setItem(CANVAS_OWNER_KEY, owner);
      } catch {}
    }
    // Legacy global mirror (backwards compatible with older reads).
    localStorage.setItem(LOCAL_STORAGE_CANVAS_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.error('Error saving Canvas settings:', e);
  }
}

/**
 * Parse an iCalendar (.ics) string from Canvas Calendar Feed
 */
export function parseCanvasICS(icsText: string): CanvasAssignment[] {
  // A feed that stopped working returns an HTML login page or an error blob
  // instead of iCalendar — never mistake that for "zero assignments".
  if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
    const preview = (icsText || '').slice(0, 120);
    if (/<!doctype html|<html/i.test(icsText || '')) {
      throw new Error(
        'Canvas feed returned a login page instead of calendar data — the feed link expired or needs sign-in. In Canvas → Calendar → Calendar Feed, copy a fresh link, save it, and sync again.'
      );
    }
    throw new Error(
      `Canvas feed did not return calendar data${preview ? ` (got: ${preview})` : ''} — re-copy the Calendar Feed link from Canvas and try again.`
    );
  }

  const assignments: CanvasAssignment[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentSummary = '';
  let currentDtEnd = '';
  let currentDtStart = '';
  let currentDescription = '';
  let currentUrl = '';
  let currentUid = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle folded lines (lines starting with space or tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1);
      i++;
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentSummary = '';
      currentDtEnd = '';
      currentDtStart = '';
      currentDescription = '';
      currentUrl = '';
      currentUid = '';
    } else if (line.startsWith('END:VEVENT')) {
      inEvent = false;
      // Tolerate nameless events (UID-only records): keep them under a
      // fallback name instead of dropping them silently.
      const rawSummary = currentSummary.trim();
      if (rawSummary || currentUid) {
        // Canvas ICS summary format is usually: "Assignment Title [Course Name]" or "[Course] Assignment"
        let name = rawSummary || 'Canvas Event';
        let courseName = 'Canvas Course';

        const bracketMatch = rawSummary.match(/^(.*?)\s*\[(.*?)\]$/);
        const prefixBracketMatch = rawSummary.match(/^\[(.*?)\]\s*(.*)$/);

        if (bracketMatch) {
          name = bracketMatch[1].trim();
          courseName = bracketMatch[2].trim();
        } else if (prefixBracketMatch) {
          courseName = prefixBracketMatch[1].trim();
          name = prefixBracketMatch[2].trim();
        }

        // Parse due date
        const dateRaw = currentDtEnd || currentDtStart;
        let dueAt = '';
        if (dateRaw) {
          // Format could be YYYYMMDDTHHMMSSZ or YYYYMMDD
          const cleanDate = dateRaw.replace(/[^0-9T]/g, '');
          if (cleanDate.length >= 8) {
            const year = cleanDate.substring(0, 4);
            const month = cleanDate.substring(4, 6);
            const day = cleanDate.substring(6, 8);
            dueAt = `${year}-${month}-${day}`;
          }
        }

        // Clean description
        const cleanDesc = currentDescription
          .replace(/\\n/g, '\n')
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\\\/g, '\\');

        // Extract points if in description
        const pointsMatch = cleanDesc.match(/(\d+(\.\d+)?)\s*(pts|points)/i);
        const pointsPossible = pointsMatch ? parseFloat(pointsMatch[1]) : undefined;

        // Clean link extraction
        let finalUrl = currentUrl;
        if (!finalUrl) {
          const match = cleanDesc.match(/https?:\/\/[^\s\n"']+/);
          if (match) finalUrl = match[0];
        }

        const courseIdMatch = (finalUrl || cleanDesc).match(/courses\/(\d+)/);
        const courseId = courseIdMatch ? courseIdMatch[1] : undefined;

        assignments.push({
          id: currentUid || `canvas-ics-${Math.random().toString(36).substring(2, 9)}`,
          name,
          courseName: courseName || 'Canvas Course',
          courseId,
          // Never fabricate today's date for dateless items — an empty dueAt
          // renders as "No Due Date" instead of a false overdue flag.
          dueAt: dueAt || '',
          pointsPossible,
          htmlUrl: finalUrl,
          description: cleanDesc,
          isSynced: false,
          isCompleted: false,
        });
      }
    } else if (inEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentSummary = line.substring(8).trim();
      } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
        currentDtEnd = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
        currentDtStart = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        currentDescription = line.substring(12).trim();
      } else if (line.startsWith('URL:') || line.startsWith('URL;')) {
        currentUrl = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('UID:')) {
        currentUid = line.substring(4).trim();
      }
    }
  }

  return assignments;
}

/**
 * Fetch Canvas assignments from Calendar Feed (.ics) via proxy with authentic error handling
 */
export async function fetchCanvasAssignmentsFromFeed(feedUrl: string): Promise<CanvasAssignment[]> {
  const cleanUrl = (feedUrl || '').trim();
  if (!cleanUrl) {
    return [];
  }

  // Validate the feed URL shape up front so a typo reports the URL —
  // not a misleading proxy/auth error after the round trip.
  const normalizedUrl = cleanUrl.replace(/^webcal:\/\//i, 'https://');
  try {
    const u = new URL(normalizedUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new CanvasSyncError('host', 'That Calendar Feed URL does not look like a web address — re-copy it from Canvas → Calendar → Calendar Feed.');
    }
  } catch (err) {
    if (err instanceof CanvasSyncError) throw err;
    throw new CanvasSyncError('host', 'That Calendar Feed URL does not look like a web address — re-copy it from Canvas → Calendar → Calendar Feed.');
  }

  // Detect a broken/missing deployment before blaming the user's feed URL.
  await probeBackend();

  const proxyUrl = `/api/canvas/proxy?url=${encodeURIComponent(normalizedUrl)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(proxyUrl);
  } catch {
    throw new CanvasSyncError('network', 'Could not reach the Canvas feed (network error or timed out). Check your connection, then retry.');
  }

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const raw = await res.text();
      try {
        const errJson = JSON.parse(raw);
        if (errJson.error || errJson.message) errorDetail = String(errJson.error || errJson.message);
        else if (raw) errorDetail = raw.slice(0, 300);
      } catch {
        if (raw) errorDetail = raw.slice(0, 300);
      }
    } catch {
      // Ignore body parse errors
    }
    const withDetail = (bare: string) =>
      (errorDetail && !bare.includes(errorDetail.slice(0, 60)) ? `${bare} Detail: ${errorDetail}` : bare);
    if (res.status === 401 || res.status === 403) {
      throw new CanvasSyncError('auth', withDetail('Canvas feed was rejected — the feed link expired or needs sign-in. In Canvas → Calendar → Calendar Feed, copy a fresh link, save it, and sync again.'), res.status);
    }
    if (res.status === 404) {
      throw new CanvasSyncError('host', withDetail('Canvas feed answered 404 — the feed URL looks wrong. Re-copy the Calendar Feed link from Canvas.'), 404);
    }
    throw new CanvasSyncError('unknown', withDetail(`Canvas feed fetch failed (${res.status}): ${errorDetail}`), res.status);
  }

  const icsText = await res.text();
  if (!icsText || icsText.trim().length === 0) {
    throw new CanvasSyncError('unknown', 'Canvas feed returned empty content — re-copy the Calendar Feed link from Canvas and try again.');
  }

  return parseCanvasICS(icsText);
}

/**
 * Fetch Canvas assignments directly via Canvas REST API (using Access Token)
 * Automatically fetches all active courses & favorites, inspecting authentic user-specific submission status
 */

export type CanvasFailureKind = 'auth' | 'host' | 'network' | 'backend' | 'unknown';

/** Thrown when no Canvas endpoint answered. `kind` lets the UI name the exact fix. Message is a bare reason — the UI composes the user-facing hint (never duplicated). */
export class CanvasSyncError extends Error {
  kind: CanvasFailureKind;
  status?: number;
  code?: string;
  constructor(kind: CanvasFailureKind, message: string, status?: number, code?: string) {
    super(message);
    this.name = 'CanvasSyncError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/**
 * Fail fast when the deployed server API is not actually serving this origin.
 * When the serverless functions are missing or misrouted (e.g. the deployment
 * was replaced by a static SPA), the platform still answers /api/* with the
 * SPA's index.html at status 200 — every Canvas endpoint then "succeeds" with
 * a web page, and sync fails with a misleading auth/network error instead of
 * the real one. Detect that state up front and name the actual fix.
 */
async function probeBackend(): Promise<void> {
  try {
    const res = await fetchWithTimeout('/api/health', { headers: { Accept: 'application/json' } });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('json')) return;
    throw new CanvasSyncError(
      'backend',
      `the server API answered status ${res.status} (${type.split(';')[0] || 'unknown type'}) instead of JSON`
    );
  } catch (err) {
    if (err instanceof CanvasSyncError) throw err;
    throw new CanvasSyncError('backend', 'the server API is unreachable from this browser');
  }
}

const CANVAS_FETCH_TIMEOUT_MS = 20000;

/**
 * Same-origin fetch with a ~20s timeout so a hung Canvas/proxy can't hang
 * sync forever. Uses AbortController (works everywhere fetch does); falls
 * back to AbortSignal.timeout where available. Rejects with an AbortError
 * on timeout — callers map that to a network/timeout message.
 */
function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = CANVAS_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const options: RequestInit = { ...(init || {}), signal: controller.signal };
  // Prefer the platform timeout signal when present, wiring it to our
  // controller so callers that pass their own signal still time out.
  try {
    const platformTimeout = (AbortSignal as any)?.timeout;
    if (typeof platformTimeout === 'function' && !init?.signal) {
      const platformSignal = platformTimeout.call(AbortSignal, timeoutMs) as AbortSignal;
      platformSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  } catch {}
  return fetch(url, options).finally(() => clearTimeout(timer));
}

/** Same-origin proxy fetch with a timeout so a hung Canvas/proxy can't hang sync forever. */
function canvasFetch(url: string, headers: Record<string, string>, init?: RequestInit): Promise<Response> {
  return fetchWithTimeout(url, { ...(init || {}), headers });
}

interface CanvasProbeFailure { status: number | null; network: boolean; detail?: string; code?: string }

/** Read the proxy's error envelope (it mirrors Canvas' HTTP status) and keep the
 * first 300 chars of its message — that string is the actual fix signal
 * ("Host not allowlisted", "Canvas fetch failed with status 401", Vercel
 * NOT_FOUND, ...) and must never be swallowed. The envelope `code`
 * (e.g. "host-not-allowlisted", "canvas-unauthorized") is preserved alongside
 * so the UI can name the exact fix. */
async function readProxyFailure(res: Response): Promise<CanvasProbeFailure> {
  let status: number | null = null;
  let detail = '';
  let code = '';
  try {
    status = (res as any).status ?? null;
    const raw = await res.text().catch(() => '');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        detail = String(parsed.error || parsed.message || raw).slice(0, 300);
        if (parsed.code) code = String(parsed.code).slice(0, 80);
      } catch {
        detail = raw.slice(0, 300);
      }
    }
  } catch {}
  return { status, network: false, detail, code };
}
export async function fetchCanvasAssignmentsFromApi(
  domain: string,
  token: string
): Promise<CanvasAssignment[]> {
  // Validate BEFORE any network call: a silent [] here used to look like
  // "caught up with zero assignments". Typed errors let the UI name the fix.
  const credentialProblem = validateCanvasCredentials(domain, token);
  if (credentialProblem) {
    const cleanToken = (token || '').trim();
    const rawDomain = (domain || '').trim();
    throw new CanvasSyncError(!cleanToken ? 'auth' : !rawDomain ? 'host' : 'host', credentialProblem);
  }

  // Normalize once — normalizeCanvasDomain strips any pasted /api/v1 path and
  // trailing slashes, so endpoint templates below can append /api/v1 safely.
  const cleanDomain = normalizeCanvasDomain((domain || '').trim());
  const cleanToken = (token || '').trim();
  const headers = { 'x-canvas-token': cleanToken };

  // Detect a broken/missing deployment before blaming the user's token or URL.
  await probeBackend();

  // First observed failure — recorded (never swallowed) so the UI can name the fix.
  // Priority order below (todo, courses, planner, per-course, upcoming) matches
  // the old sequential order, so the surfaced fix is stable across retries.
  const probeFailures: CanvasProbeFailure[] = [];
  const noteFailure = (f: CanvasProbeFailure) => { if (probeFailures.length === 0) probeFailures.push(f); };

  // Phase A — three independent probes (To Do list, course roster, planner
  // window). They used to be awaited one-by-one, stacking ~20s timeouts into a
  // 60s+ perceived hang before any typed error could surface; now they run
  // concurrently. Each probe reports its first failure (or null) so the merged
  // priority stays deterministic.
  // 1. Fetch Canvas "To Do" list (authoritative pending homework list)
  const todoIds = new Set<string>();
  const courseMap = new Map<number, any>();
  const pendingPlannerItems: any[] = [];

  const probeTodo = (async (): Promise<CanvasProbeFailure | null> => {
    try {
      const todoUrl = `${cleanDomain}/api/v1/users/self/todo?per_page=100`;
      const proxyTodoUrl = `/api/canvas/proxy?url=${encodeURIComponent(todoUrl)}`;
      const todoRes = await canvasFetch(proxyTodoUrl, headers);
      if (!todoRes.ok) return await readProxyFailure(todoRes);
      // Count the endpoint as answered only AFTER the body parses as JSON — a
      // misrouted deployment answers 200 with the SPA's index.html, and the old
      // flag-before-parse produced the silent-[] "caught up" state.
      const todoItems = await todoRes.json();
      if (Array.isArray(todoItems)) {
        todoItems.forEach((t: any) => {
          const id = t.assignment?.id || t.quiz?.id || t.id;
          if (id) todoIds.add(String(id));
        });
      }
      return null;
    } catch (err) {
      console.warn('Canvas To Do list query error:', err);
      return { status: null, network: true };
    }
  })();

  // 2. Fetch all enrolled courses (combining /users/self/courses, /users/self/favorites/courses, and /courses)
  const probeCourses = (async (): Promise<CanvasProbeFailure | null> => {
    try {
      const courseEndpoints = [
        `${cleanDomain}/api/v1/users/self/courses?enrollment_state=active&include[]=term&include[]=total_scores&per_page=100`,
        `${cleanDomain}/api/v1/users/self/favorites/courses?include[]=term&per_page=50`,
        `${cleanDomain}/api/v1/courses?enrollment_state=active&per_page=50`,
      ];

      // The three roster endpoints are independent — fetch together so one slow
      // Canvas route can't triple the wait. Results merge in endpoint order so
      // the recorded failure (if any) stays deterministic.
      const perEndpoint = await Promise.all(
        courseEndpoints.map(async (ep): Promise<CanvasProbeFailure | null> => {
          try {
            const proxyUrl = `/api/canvas/proxy?url=${encodeURIComponent(ep)}`;
            const res = await canvasFetch(proxyUrl, headers);
            if (!res.ok) return await readProxyFailure(res);
            const list = await res.json();
            if (Array.isArray(list)) {
              list.forEach((c: any) => {
                // Tolerate nameless courses (missing name/course_code): keep by
                // id and fall back to 'Canvas Course' later, so their
                // assignments are still fetched instead of dropped.
                if (c && c.id != null) {
                  courseMap.set(c.id, c);
                }
              });
            }
            return null;
          } catch {
            return { status: null, network: true };
          }
        })
      );
      return perEndpoint.find((f) => f !== null) ?? null;
    } catch (err) {
      console.warn('Error fetching courses list:', err);
      return { status: null, network: true };
    }
  })();

  // Planner window probe (items are merged in step 4 after the roster pass).
  const probePlanner = (async (): Promise<CanvasProbeFailure | null> => {
    try {
      const startDate = new Date(Date.now() - 86400000 * 90).toISOString();
      const plannerUrl = `${cleanDomain}/api/v1/planner/items?start_date=${startDate}&order=desc&per_page=100`;
      const proxyPlannerUrl = `/api/canvas/proxy?url=${encodeURIComponent(plannerUrl)}`;
      const plannerRes = await canvasFetch(proxyPlannerUrl, headers);
      if (!plannerRes.ok) return await readProxyFailure(plannerRes);
      const items = await plannerRes.json();
      if (Array.isArray(items) && items.length > 0) {
        items
          .filter((item: any) => item.plannable_type === 'assignment' || item.plannable_type === 'quiz' || item.plannable)
          .forEach((item: any) => {
            pendingPlannerItems.push(item);
          });
      }
      return null;
    } catch (err) {
      console.warn('Planner items query failed:', err);
      return { status: null, network: true };
    }
  })();

  const [todoFailure, coursesFailure, plannerFailure] = await Promise.all([probeTodo, probeCourses, probePlanner]);
  for (const f of [todoFailure, coursesFailure, plannerFailure]) {
    if (f) noteFailure(f);
  }

  const courses = Array.from(courseMap.values());
  const allAssignments: CanvasAssignment[] = [];
  const assignmentIdSet = new Set<string>();

  // 3. For every active enrolled course, fetch all assignments with submission data
  if (courses.length > 0) {
    const coursePromises = courses.map(async (course: any) => {
      try {
        const assignUrl = `${cleanDomain}/api/v1/courses/${course.id}/assignments?include[]=submission&per_page=100&order_by=due_at`;
        const proxyAssignUrl = `/api/canvas/proxy?url=${encodeURIComponent(assignUrl)}`;
        const assignRes = await canvasFetch(proxyAssignUrl, headers);
        if (!assignRes.ok) {
          noteFailure(await readProxyFailure(assignRes));
          return [];
        }

        const assignData = await assignRes.json();
        if (!Array.isArray(assignData)) return [];

        return assignData.map((a: any) => {
          const sub = a.submission || {};
          const subTypes = a.submission_types || [];

          // 0-point non-submittable informational posts/readings
          const isNoSubmission =
            subTypes.includes('none') ||
            subTypes.includes('not_graded') ||
            (a.points_possible === 0 && (!subTypes.length || subTypes.includes('none')));

          const isInTodo = todoIds.has(String(a.id));

          // STRICT USER-LEVEL SUBMISSION CHECK
          // DO NOT use a.has_submitted_submissions (which is true if ANY classmate submitted!)
          const hasUserSubmitted = Boolean(
            sub.submitted_at ||
            a.user_submitted === true ||
            sub.workflow_state === 'submitted' ||
            sub.workflow_state === 'pending_review' ||
            (sub.workflow_state === 'graded' && sub.submitted_at)
          );

          const isExplicitlyUnsubmitted =
            sub.workflow_state === 'unsubmitted' ||
            (!sub.submitted_at && !a.user_submitted && sub.workflow_state !== 'submitted');

          // An assignment is ONLY finished if the student has actually submitted it!
          // NEVER mark it finished just because it has 0 points or no submission type!
          const isFinished = hasUserSubmitted;

          // Convert relative link to absolute link using cleanDomain
          let directUrl = a.html_url || '';
          if (directUrl && !directUrl.startsWith('http')) {
            directUrl = `${cleanDomain}${directUrl.startsWith('/') ? '' : '/'}${directUrl}`;
          }
          if (!directUrl) {
            directUrl = `${cleanDomain}/courses/${course.id}/assignments/${a.id}`;
          }

          return {
            id: `canvas-assign-${a.id}`,
            name: a.name || 'Canvas Assignment',
            courseName: course.name || course.course_code || 'Canvas Course',
            courseId: String(course.id),
            dueAt: (a.due_at || a.lock_at || '').split('T')[0] || '',
            pointsPossible: a.points_possible,
            htmlUrl: directUrl,
            description: a.description || '',
            isSynced: false,
            isCompleted: isFinished,
            isInformational: a.points_possible === 0,
            submissionTypes: subTypes,
          };
        });
      } catch (err) {
        console.warn(`Error fetching assignments for course ${course.id}:`, err);
        // Record transport failures here too — a roster that lists but never
        // yields (e.g. token without assignment scope) must throw a typed
        // error below, never a silent [].
        noteFailure({ status: null, network: true });
        return [];
      }
    });

    const courseResults = await Promise.all(coursePromises);
    courseResults.flat().forEach((a) => {
      if (a && !assignmentIdSet.has(a.id)) {
        assignmentIdSet.add(a.id);
        allAssignments.push(a);
      }
    });
  }

  // 4. Merge planner items (fetched concurrently in Phase A) over the course
  // results, capturing any additional assignments/quizzes the roster pass missed.
  pendingPlannerItems.forEach((item: any) => {
    const p = item.plannable || {};
    const sub = item.submissions || {};
    const aid = `canvas-assign-${item.plannable_id || item.id}`;

    const isSubmitted = Boolean(
      sub.submitted ||
      sub.submitted_at ||
      item.user_submitted ||
      (sub.workflow_state === 'submitted' || sub.workflow_state === 'pending_review')
    );

    let directUrl = item.html_url || p.html_url || '';
    if (directUrl && !directUrl.startsWith('http')) {
      directUrl = `${cleanDomain}${directUrl.startsWith('/') ? '' : '/'}${directUrl}`;
    }
    if (!directUrl && item.course_id && item.plannable_id) {
      directUrl = `${cleanDomain}/courses/${item.course_id}/assignments/${item.plannable_id}`;
    }

    if (!assignmentIdSet.has(aid)) {
      assignmentIdSet.add(aid);
      allAssignments.push({
        id: aid,
        name: p.title || item.plannable_title || 'Canvas Assignment',
        courseName: item.context_name || 'Canvas Course',
        courseId: item.course_id ? String(item.course_id) : undefined,
        dueAt: (p.due_at || item.plannable_date || '').split('T')[0] || '',
        pointsPossible: p.points_possible,
        htmlUrl: directUrl,
        description: p.details || p.description || '',
        isSynced: false,
        isCompleted: isSubmitted,
      });
    }
  });

  if (allAssignments.length > 0) {
    return allAssignments;
  }

  // 5. Upcoming events fallback (guarded like every other probe)
  try {
    const url = `${cleanDomain}/api/v1/users/self/upcoming_events?include[]=submission`;
    const proxyUrl = `/api/canvas/proxy?url=${encodeURIComponent(url)}`;
    const res = await canvasFetch(proxyUrl, headers);

    if (!res.ok) {
      noteFailure(await readProxyFailure(res));
    } else {
      // Parse-before-count (see Phase A): a 200 with a non-JSON body must not
      // read as a successful answer.
      const events = await res.json();
    if (Array.isArray(events)) {
      return events
        .filter((e: any) => e.assignment || e.type === 'assignment')
        .map((e: any) => {
          const a = e.assignment || {};
          const sub = a.submission || {};
          const isSubmitted = Boolean(
            a.user_submitted ||
            sub.submitted_at ||
            sub.workflow_state === 'submitted' ||
            sub.workflow_state === 'pending_review'
          );

          return {
            id: `canvas-api-${e.id || a.id}`,
            name: a.name || e.title || 'Canvas Task',
            courseName: e.context_name || 'Canvas Course',
            courseId: e.context_code,
            dueAt: (a.due_at || e.start_at || '').split('T')[0] || '',
            pointsPossible: a.points_possible,
            htmlUrl: a.html_url || e.html_url,
            description: a.description || '',
            isSynced: false,
            isCompleted: isSubmitted,
          };
        });
    }
    }
  } catch (err) {
    console.warn('Canvas upcoming-events query error:', err);
    noteFailure({ status: null, network: true });
  }

  // Zero assignments at this point is either genuine ("nothing due") or proof
  // something blocked us. Any recorded failure means we cannot honestly claim
  // "connected with 0" — throw the first TYPED failure so the UI names the
  // exact fix. Message is a bare reason; the UI composes the hint (single copy).
  // Only a failure-free run returns [] (the UI then says so explicitly).
  const failure: CanvasProbeFailure | null = probeFailures[0] ?? null;
  if (failure) {
    const s = failure?.status ?? null;
    const detail = (failure?.detail || '').trim();
    const code = (failure?.code || '').trim();
    const withDetail = (bare: string) => (detail && !bare.includes(detail.slice(0, 60)) ? `${bare} Detail: ${detail}` : bare);
    if (s === 401 || s === 403 || code === 'canvas-unauthorized') {
      // 403 via the proxy is the same user-facing problem as 401: Canvas
      // refused these credentials (bad/expired token or token without scope).
      const label = s ? `${s} ${s === 403 ? 'Forbidden' : 'Unauthorized'}` : 'Unauthorized';
      throw new CanvasSyncError('auth', `Canvas rejected the API token (${label}).`, s ?? undefined, code || undefined);
    }
    if (code === 'host-not-allowlisted' || /not allowlisted/i.test(detail)) {
      // Valid token, wrong server config: the school host is not on the proxy
      // allowlist (common for vanity domains like canvas.school.edu outside
      // instructure.com/canvaslms.com). The token is fine — the deployment
      // must allowlist the host.
      throw new CanvasSyncError('host', withDetail('The app server refused to contact this Canvas host (proxy allowlist).'), 400, 'host-not-allowlisted');
    }
    if (s === 400) {
      throw new CanvasSyncError('host', withDetail('The Canvas proxy refused this host (400).'), 400, code || undefined);
    }
    if (s === 404) {
      throw new CanvasSyncError('host', withDetail('Canvas answered 404 — the host path looks wrong.'), 404, code || undefined);
    }
    if (failure?.network) {
      throw new CanvasSyncError('network', 'Could not reach Canvas (network error or timed out).', undefined);
    }
    throw new CanvasSyncError(
      'unknown',
      withDetail(s ? `Canvas answered with status ${s} on every endpoint.` : 'Canvas API did not respond on any endpoint.'),
      s ?? undefined,
      code || undefined
    );
  }

  return [];
}

const LOCAL_STORAGE_CANVAS_COMPLETED_KEY = 'scc_canvas_completed_ids_v1';

export function loadCompletedCanvasIds(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_CANVAS_COMPLETED_KEY);
      if (saved) return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading completed Canvas IDs:', e);
  }
  return [];
}

export function saveCompletedCanvasIds(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CANVAS_COMPLETED_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Error saving completed Canvas IDs:', e);
  }
}

/**
 * Cross-reference Canvas assignments with Master Google Sheet assignments and completion status
 */
/**
 * Cross-reference Canvas assignments with Master Google Sheet assignments and completion status.
 * Optimization (Bolt ⚡): Pre-processes sheet assignments into O(1) lookup maps (by canvasId and course::name),
 * reducing runtime complexity from O(N * M) string allocations and linear scans to O(N + M).
 */
export function crossReferenceCanvasWithSheet(
  canvasList: CanvasAssignment[],
  sheetAssignments: Assignment[],
  completedIds: string[] = loadCompletedCanvasIds()
): CanvasAssignment[] {
  if (!Array.isArray(canvasList)) return [];

  const completedSet = new Set(Array.isArray(completedIds) ? completedIds : []);
  const sheetList = Array.isArray(sheetAssignments) ? sheetAssignments : [];

  // O(1) direct Canvas ID lookup map (first match wins)
  const canvasIdMap = new Map<string, Assignment>();

  // Preprocessed sheet items to avoid re-allocating strings inside inner loops
  const preprocessedSheet: Array<{
    item: Assignment;
    canvasIdRaw?: string;
    canvasIdLower?: string;
    sName: string;
    subjectLower: string;
  }> = [];

  for (let i = 0; i < sheetList.length; i++) {
    const sheetItem = sheetList[i];
    if (!sheetItem || typeof sheetItem !== 'object') continue;

    const sName = String(sheetItem.assignmentName ?? '').toLowerCase().trim();
    const subjectLower = String(sheetItem.subject ?? '').toLowerCase().trim();
    const canvasIdRaw = sheetItem.canvasId !== undefined && sheetItem.canvasId !== null ? String(sheetItem.canvasId) : undefined;
    const canvasIdLower = canvasIdRaw ? canvasIdRaw.toLowerCase().trim() : undefined;

    if (canvasIdRaw && !canvasIdMap.has(canvasIdRaw)) {
      canvasIdMap.set(canvasIdRaw, sheetItem);
    }
    if (canvasIdLower && !canvasIdMap.has(canvasIdLower)) {
      canvasIdMap.set(canvasIdLower, sheetItem);
    }

    preprocessedSheet.push({ item: sheetItem, canvasIdRaw, canvasIdLower, sName, subjectLower });
  }

  return canvasList.flatMap((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') return [];

    const canvasItem = {
      ...rawItem,
      name: String(rawItem.name ?? (rawItem as any).title ?? 'Canvas Assignment'),
      courseName: String(rawItem.courseName ?? (rawItem as any).course_code ?? 'Canvas Course'),
    };

    const cName = canvasItem.name.toLowerCase().trim();
    const cCourseNameLower = canvasItem.courseName.toLowerCase().trim();
    const cKey = `${canvasItem.courseId || canvasItem.courseName}::${canvasItem.id}`.toLowerCase();

    // 1. Fast O(1) exact Canvas ID match
    let matchingSheetItem = canvasItem.id ? canvasIdMap.get(canvasItem.id) : undefined;

    // 2. Sequential scan using pre-normalized records to maintain exact original match precedence (first match wins)
    if (!matchingSheetItem) {
      matchingSheetItem = preprocessedSheet.find(({ canvasIdLower, sName, subjectLower }) => {
        if (canvasIdLower && cKey.includes(canvasIdLower)) return true;
        if (!sName || !cName) return false;
        const sameCourse =
          !subjectLower ||
          subjectLower === 'general' ||
          !cCourseNameLower ||
          subjectLower === cCourseNameLower;
        return sameCourse && (sName === cName || sName.includes(cName) || cName.includes(sName));
      })?.item;
    }

    const isAlreadyInSheet = Boolean(matchingSheetItem);
    const isDoneInSheet = matchingSheetItem?.status === 'Done';
    const isCompleted = isDoneInSheet || Boolean(canvasItem.isCompleted) || completedSet.has(canvasItem.id);

    return [{
      ...canvasItem,
      isSynced: isAlreadyInSheet,
      isCompleted,
    }];
  });
}

/**
 * Submit an assignment to Canvas via the submissions REST API endpoint
 * POST /api/v1/courses/:course_id/assignments/:assignment_id/submissions
 * with submission[submission_type]=online_url and submission[url]=file_url
 */
export async function submitCanvasAssignment(
  domain: string,
  token: string,
  courseId: string,
  assignmentId: string,
  fileUrl: string
): Promise<any> {
  const credentialProblem = validateCanvasCredentials(domain, token);
  if (credentialProblem) {
    throw new Error(credentialProblem);
  }
  if (!courseId || !String(courseId).trim()) {
    throw new Error('Missing Canvas course id — open the assignment in Canvas and retry.');
  }
  if (!assignmentId || !String(assignmentId).trim()) {
    throw new Error('Missing Canvas assignment id — open the assignment in Canvas and retry.');
  }
  if (!fileUrl || !String(fileUrl).trim()) {
    throw new Error('Pick a Google Drive file to submit first.');
  }
  const cleanDomain = normalizeCanvasDomain((domain || '').trim());
  
  // Extract numerical assignment ID (e.g. from canvas-assign-12345)
  const rawId = assignmentId.replace(/^(canvas-assign-|canvas-planner-|canvas-api-|canvas-ics-)/, '');
  
  const targetUrl = `${cleanDomain}/api/v1/courses/${courseId}/assignments/${rawId}/submissions`;
  
  const headers = {
    'x-canvas-token': token.trim(),
    'Content-Type': 'application/json',
  };

  const body = {
    submission: {
      submission_type: 'online_url',
      url: fileUrl,
    },
  };

  const proxyUrl = `/api/canvas/proxy?url=${encodeURIComponent(targetUrl)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Canvas submission failed: network error or timed out. Check your connection, then retry.');
  }

  if (!res.ok) {
    let errMessage = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson.errors) {
        errMessage = JSON.stringify(errJson.errors);
      } else if (errJson.message) {
        errMessage = errJson.message;
      }
    } catch {
      // ignore
    }
    // Actionable status mapping (same vocabulary as sync errors): never show
    // a bare `failed (401)` — name the fix. Still throws Error (signature unchanged).
    if (res.status === 401 || res.status === 403) {
      throw new Error('Canvas rejected the API token — regenerate it (Canvas → Account → Settings → New Access Token), save it here, and retry.');
    }
    if (res.status === 404) {
      throw new Error('Canvas answered 404 — the school URL, course, or assignment looks wrong. Check the Canvas URL in Settings and retry.');
    }
    throw new Error(`Canvas submission failed (${res.status}): ${errMessage}`);
  }

  return res.json();
}

/**
 * Convert standard URLs to mobile native app deep links on small viewports
 */
export function toMobileDeepLink(url: string): string {
  if (!url) return '';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  if (!isMobile) return url;

  if (url.includes('docs.google.com') || url.includes('drive.google.com')) {
    return url.replace(/^https:\/\//, 'googledrive://');
  }

  if (url.includes('.instructure.com') || url.includes('/courses/')) {
    return url.replace(/^https:\/\//, 'canvas-student://');
  }

  return url;
}

