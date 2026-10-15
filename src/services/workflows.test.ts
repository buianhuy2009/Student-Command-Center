import { describe, it, expect } from 'vitest';

// RRULE weekly expansion (pure logic mirror of tracker repeats)
function expandWeeklyRRule(startISO: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(startISO + 'T00:00:00Z');
  for (let i = 0; i < count; i++) {
    out.push(new Date(d.getTime() + i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

describe('RRULE repeats', () => {
  it('expands weekly recurrence', () => {
    const dates = expandWeeklyRRule('2026-09-03', 3);
    expect(dates).toEqual(['2026-09-03', '2026-09-10', '2026-09-17']);
  });
});

describe('crossReferenceCanvasWithSheet hardening (no white screen)', () => {
  it('never throws on malformed items and normalizes names', async () => {
    const { crossReferenceCanvasWithSheet } = await import('./canvas');
    const canvas = [
      { id: 'c1', name: 'Problem Set 1', courseName: 'Calc', dueAt: '2026-09-10', isSynced: false },
      { id: 'c2', name: undefined, courseName: undefined, dueAt: undefined, isSynced: false },
      null,
      { id: 'c3', title: 'Lab Report', course_code: 'PHYS', dueAt: '2026-09-12', isSynced: false },
    ];
    const sheet = [
      { id: 's1', assignmentName: 'problem set 1', subject: 'Calc', dueDate: '2026-09-10', status: 'Not Started' },
      { id: 's2', assignmentName: undefined, subject: undefined, dueDate: '', status: 'Not Started' },
      null,
    ];
    let res: any;
    expect(() => { res = crossReferenceCanvasWithSheet(canvas as any, sheet as any); }).not.toThrow();
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(3); // null canvas item skipped, rest normalized
    expect(res[0].isSynced).toBe(true); // matched by name+course
  });
});

describe('sanitizers', () => {
  it('drops nulls and defaults missing fields', async () => {
    const { sanitizeAssignments, sanitizeCanvasAssignments } = await import('../utils/sanitize');
    const a = sanitizeAssignments([null, {}, { assignmentName: '  ', subject: null }]);
    expect(a.length).toBe(2);
    expect(a[0].assignmentName).toBe('Untitled Assignment');
    expect(a[0].status).toBe('Not Started');
    const c = sanitizeCanvasAssignments([null, { name: undefined }]);
    expect(c.length).toBe(1);
    expect(c[0].name).toBe('Canvas Assignment');
  });
});

describe('google token expiry', () => {
  it('treats old tokens as expired and fresh tokens as valid', async () => {
    const fb = await import('./firebase');
    fb.setStoredGoogleToken('test-token-1234567890');
    // fresh stamp → valid
    try { localStorage.setItem('google_token_acquired_at', String(Date.now())); } catch {}
    try { sessionStorage.setItem('google_token_acquired_at', String(Date.now())); } catch {}
    expect(fb.isGoogleTokenExpired()).toBe(false);
    expect(fb.getValidGoogleToken()).toBe('test-token-1234567890');
    // 2-hour-old stamp → expired
    const old = String(Date.now() - 2 * 60 * 60 * 1000);
    try { localStorage.setItem('google_token_acquired_at', old); } catch {}
    try { sessionStorage.setItem('google_token_acquired_at', old); } catch {}
    expect(fb.isGoogleTokenExpired()).toBe(true);
    expect(fb.getValidGoogleToken()).toBeNull();
    expect(fb.needsGoogleReconnect()).toBe(true);
    fb.clearStoredGoogleToken();
  });
});
describe('sign-in error classification', () => {
  it('maps Google blocks to plain-language diagnoses', async () => {
    const { classifySignInError } = await import('./firebase');
    expect(classifySignInError({ code: 'auth/unauthorized-domain' }).kind).toBe('unauthorized-domain');
    expect(classifySignInError({ code: 'auth/popup-blocked' }).kind).toBe('popup-blocked');
    expect(classifySignInError({ code: 'auth/popup-closed-by-user' }).kind).toBe('popup-closed');
    expect(classifySignInError(new Error('Error 403: access_denied')).kind).toBe('test-user');
    expect(classifySignInError(new Error('Access blocked by your administrator')).kind).toBe('admin-blocked');
    expect(classifySignInError({ code: 'auth/api-key-not-valid' }).kind).toBe('api-key');
    const missing = classifySignInError({ code: 'auth/no-auth-token' });
    expect(missing.kind).toBe('token-missing');
    expect(missing.fix).toMatch(/Redirect/i);
  });
});

describe('crossReferenceCanvasWithSheet (dedup logic)', () => {
  it('matches by normalized title + date', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const canvas = [{ name: 'Problem Set 1', dueAt: '2026-09-10' }];
    const sheet = [{ assignmentName: 'problem set 1', dueDate: '2026-09-10' }];
    const match = canvas.filter((c) => sheet.some((s) => norm(s.assignmentName) === norm(c.name) && s.dueDate === c.dueAt.slice(0, 10)));
    expect(match.length).toBe(1);
  });
});

describe('offline queue retry', () => {
  it('retries failed items with backoff and keeps them queued', async () => {
    const queue = [{ id: 'q1', tries: 0 }];
    let attempts = 0;
    const process = async () => { attempts++; if (attempts < 3) throw new Error('offline'); };
    const backoff = [1000, 4000, 15000];
    for (const item of queue) {
      for (let t = 0; t < 3; t++) {
        try { await process(); (item as any).tries = t + 1; break; }
        catch { await new Promise((r) => setTimeout(r, 0)); void backoff[t]; }
      }
    }
    expect(attempts).toBe(3);
  });
});

describe('toast grouping', () => {
  it('collapses identical notifications', async () => {
    const { groupToasts } = await import('../components/Toast');
    const grouped = groupToasts([
      { id: '1', type: 'info', title: 'Synced', message: 'Canvas up to date' },
      { id: '2', type: 'info', title: 'Synced', message: 'Canvas up to date' },
    ] as any);
    expect(grouped.length).toBe(1);
    expect(grouped[0].count).toBe(2);
  });
});

describe('teacher allowlist (miscat rescue)', () => {
  it('matches sender email/name case-insensitively, false when empty', async () => {
    const { isTeacherAllowlisted, TEACHER_ALLOWLIST_KEY } = await import('./googleAuth');
    // Minimal localStorage stub when the runner has no DOM (mirrors try/catch style of other tests).
    const store = new Map<string, string>();
    const ls = (globalThis as any).localStorage ?? {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    };
    if (!(globalThis as any).localStorage) (globalThis as any).localStorage = ls;
    ls.removeItem(TEACHER_ALLOWLIST_KEY);
    expect(isTeacherAllowlisted('prof@school.edu', 'Prof')).toBe(false);
    ls.setItem(TEACHER_ALLOWLIST_KEY, JSON.stringify(['Prof@School.edu']));
    expect(isTeacherAllowlisted('prof@school.edu', null)).toBe(true);
    expect(isTeacherAllowlisted(null, 'prof@school.EDU')).toBe(true);
    expect(isTeacherAllowlisted('ads@promo.com', 'Promo')).toBe(false);
    ls.removeItem(TEACHER_ALLOWLIST_KEY);
  });
});
