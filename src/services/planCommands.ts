/* ------------------------------------------------------------------ */
/* Plan commands — pure, framework-free engine for the AI Planner.     */
/* Turns "Dời Toán tối thứ 3 sang sáng thứ 7" into deterministic edit  */
/* ops on the existing timetable. No React, no browser APIs, no AI     */
/* calls: importable from Node (eval scripts) and vitest alike.        */
/* ------------------------------------------------------------------ */

export type Period = 'morning' | 'afternoon' | 'evening';

export interface PlanBlockLite {
  id: string;
  taskKey?: string;
  title: string;
  subject: string;
  dayISO: string; // YYYY-MM-DD
  startMin: number; // minutes since midnight
  endMin: number;
  reason: string;
  kind: 'study' | 'review' | 'break' | 'meeting';
  /** Student pinned it: the AI and every op must leave it exactly where it is. */
  locked?: boolean;
  /** Student edited it by hand (always locked at the moment of the edit). */
  manual?: boolean;
  /** Built from a deadline nobody has confirmed yet (AI-read or Gmail). */
  tentative?: boolean;
}

export interface BusyLite {
  dayISO: string;
  startMin: number;
  endMin: number;
  label: string;
}

export type PlanOp =
  | { op: 'move'; blockId: string; toDayISO?: string; toStartMin?: number; toEndMin?: number; period?: Period }
  | { op: 'swap'; a: string; b: string }
  | { op: 'clear_day'; dayISO: string; /** Optional: only that part of the day ("bận tối thứ 5"). */ period?: Period }
  | { op: 'remove'; blockId: string }
  | { op: 'add'; subject: string; title: string; dayISO: string; startMin: number; endMin: number }
  | { op: 'cap_session'; maxMinutes: number }
  | { op: 'latest_end'; minute: number }
  | { op: 'no_mornings' }
  | { op: 'prefer_evenings' }
  | { op: 'more_breaks' };

export interface OpsResponse {
  ops: PlanOp[];
  reply: string;
  unclear: boolean;
  question: string;
}

export interface ApplyContext {
  days: string[];
  busy: BusyLite[];
}

export interface ApplyResult {
  blocks: PlanBlockLite[];
  applied: string[];
  refused: string[];
}

export interface PlanDiffEntry {
  type: 'moved' | 'added' | 'removed' | 'retimed';
  before?: PlanBlockLite;
  after?: PlanBlockLite;
}

/* ------------------------------------------------------------------ */
/* Constants + small helpers                                           */
/* ------------------------------------------------------------------ */

export const PERIOD_WINDOWS: Record<Period, [number, number]> = {
  morning: [420, 690], // sáng 07:00-11:30
  afternoon: [810, 1050], // chiều 13:30-17:30
  evening: [1140, 1320], // tối 19:00-22:00
};
const PERIOD_ORDER: Period[] = ['morning', 'afternoon', 'evening'];
const PERIOD_VI: Record<Period, string> = { morning: 'sáng', afternoon: 'chiều', evening: 'tối' };
const ALL_WINDOWS: Array<[number, number]> = PERIOD_ORDER.map((p) => PERIOD_WINDOWS[p]);
/** Where a displaced session goes when nothing better is known: evenings are the usual self-study time. */
const RELOCATE_WINDOWS: Array<[number, number]> = [PERIOD_WINDOWS.evening, PERIOD_WINDOWS.afternoon, PERIOD_WINDOWS.morning];

/** The block's own period first, then the usual relocation order. */
function windowsFor(startMin: number): Array<[number, number]> {
  const own = periodOf(startMin);
  if (!own) return RELOCATE_WINDOWS;
  return [PERIOD_WINDOWS[own], ...RELOCATE_WINDOWS.filter((w) => w !== PERIOD_WINDOWS[own])];
}

const fitsWindows = (s: number, e: number, windows: Array<[number, number]>) => windows.some(([ws, we]) => s >= ws && e <= we);
const MIN_SESSION = 15;
const MAX_SESSION = 180;
const STEP = 15;

export const VI_WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Diacritic- and case-insensitive key: NFD + strip combining marks + đ→d + lowercase. */
export function fold(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD string, timezone-proof. -1 when malformed. */
export function dowOf(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return -1;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

export function weekdayVi(iso: string): string {
  const d = dowOf(iso);
  return d < 0 ? iso : VI_WEEKDAYS[d];
}

const pad2 = (n: number) => `${n}`.padStart(2, '0');

/** Minutes since midnight → "HH:MM" (24h). */
export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(Number(min) || 0)));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** Vietnamese short label: `Toán · Thứ 3 19:00–20:00`. */
export function describeBlock(b: PlanBlockLite): string {
  return `${b.subject} · ${weekdayVi(b.dayISO)} ${hhmm(b.startMin)}–${hhmm(b.endMin)}`;
}

function slotLabel(dayISO: string, s: number, e: number): string {
  return `${weekdayVi(dayISO)} ${hhmm(s)}–${hhmm(e)}`;
}

export function lockedMessage(b: PlanBlockLite): string {
  return `Buổi "${b.title}" (${weekdayVi(b.dayISO)} ${hhmm(b.startMin)}) đã khoá nên mình giữ nguyên.`;
}

const overlaps = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && s2 < e1;
const isSession = (b: PlanBlockLite) => b.kind !== 'break' && b.kind !== 'meeting';
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const ceilStep = (n: number) => Math.ceil(n / STEP) * STEP;

function sortBlocks(list: PlanBlockLite[]): PlanBlockLite[] {
  return list.sort((a, b) => a.dayISO.localeCompare(b.dayISO) || a.startMin - b.startMin || a.id.localeCompare(b.id));
}

function periodOf(min: number): Period | null {
  for (const p of PERIOD_ORDER) {
    const [s, e] = PERIOD_WINDOWS[p];
    if (min >= s && min < e) return p;
  }
  return null;
}

/** Other days ordered by distance from `from` (ties → earlier day first, safer for deadlines). */
function daysByDistance(days: string[], from: string, includeSelf: boolean): string[] {
  const idx = days.indexOf(from);
  const list = days.filter((d) => includeSelf || d !== from);
  if (idx < 0) return list;
  return list
    .map((d) => ({ d, i: days.indexOf(d) }))
    .sort((a, b) => Math.abs(a.i - idx) - Math.abs(b.i - idx) || a.i - b.i)
    .map((x) => x.d);
}

/** Session blocks are hard obstacles; breaks are soft (dropped later if something lands on them). */
function isFree(
  blocks: PlanBlockLite[],
  busy: BusyLite[],
  dayISO: string,
  s: number,
  e: number,
  ignore: Set<string>,
): boolean {
  if (s < 0 || e > 1440 || e <= s) return false;
  for (const x of busy) if (x.dayISO === dayISO && overlaps(s, e, x.startMin, x.endMin)) return false;
  for (const b of blocks) {
    if (b.dayISO !== dayISO || b.kind === 'break' || ignore.has(b.id)) continue;
    if (overlaps(s, e, b.startMin, b.endMin)) return false;
  }
  return true;
}

interface SlotOpts {
  avoid?: (dayISO: string, s: number, e: number) => boolean;
  minStart?: number;
  maxEnd?: number;
}

/** First free 15-min-aligned start of `dur` minutes inside `windows`, or null. */
function findSlot(
  blocks: PlanBlockLite[],
  busy: BusyLite[],
  dayISO: string,
  dur: number,
  windows: Array<[number, number]>,
  ignore: Set<string>,
  opts: SlotOpts = {},
): number | null {
  for (const [ws, weRaw] of windows) {
    const we = opts.maxEnd !== undefined ? Math.min(weRaw, opts.maxEnd) : weRaw;
    for (let s = ceilStep(Math.max(ws, opts.minStart ?? 0)); s + dur <= we; s += STEP) {
      const e = s + dur;
      if (opts.avoid && opts.avoid(dayISO, s, e)) continue;
      if (isFree(blocks, busy, dayISO, s, e, ignore)) return s;
    }
  }
  return null;
}

/** Paired breather id of a local-plan session (`a-1-s3` → `a-1-b3`). */
function pairedBreakId(b: PlanBlockLite): string | null {
  return /-s(\d+)$/.test(b.id) ? b.id.replace(/-s(\d+)$/, '-b$1') : null;
}

function dropClashingBreaks(list: PlanBlockLite[], busy: BusyLite[]): PlanBlockLite[] {
  return list.filter((b) => {
    if (b.kind !== 'break' || b.locked) return true;
    const hitBlock = list.some(
      (o) => o !== b && o.kind !== 'break' && o.dayISO === b.dayISO && overlaps(b.startMin, b.endMin, o.startMin, o.endMin),
    );
    const hitBusy = busy.some((x) => x.dayISO === b.dayISO && overlaps(b.startMin, b.endMin, x.startMin, x.endMin));
    return !hitBlock && !hitBusy;
  });
}

/** Keep chat replies short: ≤3 detail lines, else a summary + two examples. */
function pushSummary(out: string[], summary: string, details: string[]) {
  if (details.length === 0) return;
  if (details.length <= 3) {
    out.push(...details);
    return;
  }
  out.push(summary, ...details.slice(0, 2), `…và ${details.length - 2} buổi khác.`);
}

/* ------------------------------------------------------------------ */
/* Prompt for the AI interpreter                                       */
/* ------------------------------------------------------------------ */

export function buildCommandPrompt(
  text: string,
  blocks: PlanBlockLite[],
  days: string[],
  todayISO: string,
  busy: BusyLite[],
): string {
  const sessions = (blocks || []).filter(isSession).slice(0, 60);
  const lines: string[] = [];
  lines.push(
    'You edit a student\'s EXISTING weekly study timetable. Read the student\'s request (Vietnamese or English, with or without diacritics) and turn it into the smallest set of edit operations.',
  );
  lines.push('Return ONLY JSON, no prose, no code fences: {"ops": [...], "reply": string, "unclear": boolean, "question": string}.');
  lines.push(`Today: ${todayISO} (${weekdayVi(todayISO)}).`);
  lines.push(`Week (use only these dates): ${days.map((d) => `${weekdayVi(d)} (${EN_WEEKDAYS[dowOf(d)] || '?'}) = ${d}`).join('; ')}.`);
  lines.push(
    'Vietnamese weekdays: "thứ 2"/"thứ hai"/"T2" = Monday, "thứ 3"/"thứ ba" = Tuesday, "thứ 4"/"thứ tư" = Wednesday, "thứ 5"/"thứ năm" = Thursday, "thứ 6"/"thứ sáu" = Friday, "thứ 7"/"thứ bảy"/"T7" = Saturday, "chủ nhật"/"CN" = Sunday. Without diacritics: "thu 7", "chu nhat".',
  );
  lines.push(
    'Periods: sáng/morning = 07:00-11:30, chiều/afternoon = 13:30-17:30, tối/evening = 19:00-22:00. Careful: "sang" without diacritics usually means "to" ("doi toan sang thu 7" = move Toán to Saturday); "tôi" = I, "tối" = evening, "tới" = to.',
  );
  lines.push('Times in ops are minutes since midnight (08:00 = 480, 19:00 = 1140, 22:00 = 1320).');
  lines.push('Sessions (id | subject | title | weekday | date | start-end | flags):');
  if (sessions.length === 0) lines.push('(no sessions yet)');
  for (const b of sessions) {
    const flags = [b.locked ? 'LOCKED' : '', b.kind === 'review' ? 'review' : ''].filter(Boolean).join(',');
    lines.push(
      `${b.id} | ${b.subject} | ${String(b.title).slice(0, 60)} | ${weekdayVi(b.dayISO)} | ${b.dayISO} | ${hhmm(b.startMin)}-${hhmm(b.endMin)}${flags ? ` | ${flags}` : ''}`,
    );
  }
  const busyList = (busy || []).slice(0, 40).map((x) => `${weekdayVi(x.dayISO)} ${x.dayISO} ${hhmm(x.startMin)}-${hhmm(x.endMin)} ${String(x.label).slice(0, 30)}`);
  lines.push(`Busy (classes/meetings — never overlap): ${busyList.length ? busyList.join('; ') : 'none'}.`);
  lines.push('Operations (use exact session ids from the list):');
  lines.push('- {"op":"move","blockId":"<id>","toDayISO":"YYYY-MM-DD","period":"morning|afternoon|evening"} — or give "toStartMin"/"toEndMin" for an exact time. Omit toDayISO to stay on the same day.');
  lines.push('- {"op":"swap","a":"<id>","b":"<id>"} — exchange the slots of two sessions.');
  lines.push('- {"op":"clear_day","dayISO":"YYYY-MM-DD","period":"evening"} — student is busy/off that day (period optional = whole day); its sessions move elsewhere.');
  lines.push('- {"op":"remove","blockId":"<id>"}');
  lines.push('- {"op":"add","subject":"Toán","title":"Ôn Toán","dayISO":"YYYY-MM-DD","startMin":1140,"endMin":1200}');
  lines.push('- {"op":"cap_session","maxMinutes":45} — no session longer than this.');
  lines.push('- {"op":"latest_end","minute":1320} — nothing ends after this time (e.g. "ngủ trước 22h").');
  lines.push('- {"op":"no_mornings"}, {"op":"prefer_evenings"}, {"op":"more_breaks"}');
  lines.push('Rules:');
  lines.push('1. Change ONLY what the student asked for. Never re-plan the whole week.');
  lines.push('2. NEVER move, swap, resize or remove a LOCKED session. If the request targets one, leave it out of ops and say in reply that it is locked (đã khoá) and stays put.');
  lines.push('3. Sessions stay 15-180 minutes, never overlap busy spans or other sessions, and stay inside the week above.');
  lines.push('4. Match subjects loosely: Toán = math; Văn = Ngữ văn; Anh = Tiếng Anh; KHTN = Khoa học tự nhiên; Sử/Địa = Lịch sử và Địa lí.');
  lines.push('5. "bận"/"nghỉ"/"không học"/"busy"/"off" + a day (and optional period) → clear_day.');
  lines.push('6. If you cannot tell which session or which day is meant, return "ops": [], "unclear": true and ask ONE short question in the student\'s language in "question".');
  lines.push('7. "reply": one short friendly sentence in Vietnamese (English only if the student wrote English) saying what changed.');
  lines.push('Examples:');
  lines.push('"Dời buổi Toán tối thứ 3 sang sáng thứ 7" → {"ops":[{"op":"move","blockId":"<Toán Tuesday-evening id>","toDayISO":"<Saturday date>","period":"morning"}],"reply":"Mình đã dời buổi Toán sang sáng thứ 7 nhé.","unclear":false,"question":""}');
  lines.push('"tuần này em bận tối thứ 5" → {"ops":[{"op":"clear_day","dayISO":"<Thursday date>","period":"evening"}],"reply":"Mình đã để trống tối thứ 5 cho bạn.","unclear":false,"question":""}');
  lines.push('"mỗi buổi tối đa 45 phút" → {"ops":[{"op":"cap_session","maxMinutes":45}],"reply":"Mỗi buổi giờ tối đa 45 phút nhé.","unclear":false,"question":""}');
  lines.push(`Student message: """${String(text || '').slice(0, 500)}"""`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Parse + validate the model's JSON                                   */
/* ------------------------------------------------------------------ */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set<Period>(['morning', 'afternoon', 'evening']);

function toMinute(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const t = v.trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    if (/^\d{1,4}$/.test(t)) return Number(t);
  }
  return undefined;
}

function toPeriod(v: unknown): Period | undefined {
  const f = fold(String(v ?? '')).trim();
  if (PERIODS.has(f as Period)) return f as Period;
  if (f === 'sang') return 'morning';
  if (f === 'chieu') return 'afternoon';
  if (f === 'toi' || f === 'night') return 'evening';
  return undefined;
}

const validMin = (n: number | undefined): n is number => n !== undefined && n >= 0 && n <= 1440;

function normalizeOp(o: any): PlanOp | null {
  if (!o || typeof o !== 'object') return null;
  const t = String(o.op ?? o.type ?? '').trim().toLowerCase();
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  switch (t) {
    case 'move': {
      const blockId = str(o.blockId ?? o.id);
      if (!blockId) return null;
      const op: Extract<PlanOp, { op: 'move' }> = { op: 'move', blockId };
      if (typeof o.toDayISO === 'string' && ISO_RE.test(o.toDayISO)) op.toDayISO = o.toDayISO;
      const s = toMinute(o.toStartMin);
      const e = toMinute(o.toEndMin);
      if (validMin(s)) op.toStartMin = s;
      if (validMin(e) && op.toStartMin !== undefined && e > op.toStartMin) op.toEndMin = e;
      const p = toPeriod(o.period);
      if (p) op.period = p;
      if (!op.toDayISO && op.toStartMin === undefined && !op.period) return null;
      return op;
    }
    case 'swap': {
      const a = str(o.a ?? o.blockA);
      const b = str(o.b ?? o.blockB);
      return a && b && a !== b ? { op: 'swap', a, b } : null;
    }
    case 'clear_day': {
      const dayISO = str(o.dayISO);
      if (!ISO_RE.test(dayISO)) return null;
      const p = toPeriod(o.period);
      return p ? { op: 'clear_day', dayISO, period: p } : { op: 'clear_day', dayISO };
    }
    case 'remove': {
      const blockId = str(o.blockId ?? o.id);
      return blockId ? { op: 'remove', blockId } : null;
    }
    case 'add': {
      const subject = str(o.subject).slice(0, 40);
      const dayISO = str(o.dayISO);
      const s = toMinute(o.startMin);
      let e = toMinute(o.endMin);
      if (!subject || !ISO_RE.test(dayISO) || !validMin(s)) return null;
      if (!validMin(e) || e <= s) e = s + 60;
      return { op: 'add', subject, title: (str(o.title) || subject).slice(0, 80), dayISO, startMin: s, endMin: Math.min(1440, e) };
    }
    case 'cap_session': {
      const n = Number(o.maxMinutes ?? o.minutes ?? o.max);
      return Number.isFinite(n) && n > 0 ? { op: 'cap_session', maxMinutes: clamp(Math.round(n), MIN_SESSION, MAX_SESSION) } : null;
    }
    case 'latest_end': {
      const m = toMinute(o.minute ?? o.minutes ?? o.time);
      return validMin(m) && m >= 60 ? { op: 'latest_end', minute: m } : null;
    }
    case 'no_mornings':
      return { op: 'no_mornings' };
    case 'prefer_evenings':
      return { op: 'prefer_evenings' };
    case 'more_breaks':
      return { op: 'more_breaks' };
    default:
      return null;
  }
}

function tryJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Tolerant of code fences / chatter around the JSON. Invalid ops are dropped; null = unreadable. */
export function parseOpsResponse(raw: string): OpsResponse | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '');
  let obj: any = tryJSON(text);
  if (obj === undefined) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) obj = tryJSON(text.slice(s, e + 1));
  }
  if (obj === undefined) {
    const s = text.indexOf('[');
    const e = text.lastIndexOf(']');
    if (s >= 0 && e > s) obj = tryJSON(text.slice(s, e + 1));
  }
  if (Array.isArray(obj)) obj = { ops: obj };
  if (!obj || typeof obj !== 'object') return null;
  const rawOps: unknown[] = Array.isArray(obj.ops) ? obj.ops : Array.isArray(obj.operations) ? obj.operations : [];
  const ops = rawOps.map(normalizeOp).filter((x): x is PlanOp => x !== null).slice(0, 30);
  return {
    ops,
    reply: typeof obj.reply === 'string' ? obj.reply.trim().slice(0, 400) : '',
    unclear: obj.unclear === true || obj.unclear === 'true',
    question: typeof obj.question === 'string' ? obj.question.trim().slice(0, 300) : '',
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic op application                                        */
/* ------------------------------------------------------------------ */

export function applyOps(blocks: PlanBlockLite[], ops: PlanOp[], ctx: ApplyContext): ApplyResult {
  let work: PlanBlockLite[] = (blocks || []).map((b) => ({ ...b }));
  const applied: string[] = [];
  const refused: string[] = [];
  const days = ctx?.days || [];
  const busy = ctx?.busy || [];
  const daySet = new Set(days);
  let seq = 0;

  const byId = (id: string) => work.find((b) => b.id === id);
  const newId = (prefix: string) => {
    let id = '';
    do {
      seq += 1;
      id = `${prefix}-${seq}`;
    } while (work.some((b) => b.id === id));
    return id;
  };
  const dropPairedBreak = (b: PlanBlockLite) => {
    const bid = pairedBreakId(b);
    if (bid) work = work.filter((x) => x.id !== bid || x.locked);
  };
  const relocate = (b: PlanBlockLite, dayISO: string, s: number, e: number) => {
    dropPairedBreak(b);
    b.dayISO = dayISO;
    b.startMin = s;
    b.endMin = e;
  };
  /** Same day first (if allowed), then nearest other days. */
  /**
   * Pass 1: the same clock time on the nearest other day. Pass 2: the block's own period, nearest day first.
   * Pass 3: any allowed window. `sameDayFirst` lets passes 2-3 try the block's own day before the others.
   */
  const relocateAnywhere = (
    b: PlanBlockLite,
    windows: Array<[number, number]>,
    opts: SlotOpts & { sameDayFirst: boolean },
  ): [string, number] | null => {
    const dur = b.endMin - b.startMin;
    const ignore = new Set([b.id]);
    const order = daysByDistance(days, b.dayISO, opts.sameDayFirst);
    const okSpan = (d: string, s: number, e: number) =>
      fitsWindows(s, e, windows) && (opts.maxEnd === undefined || e <= opts.maxEnd) && !(opts.avoid && opts.avoid(d, s, e));
    for (const d of order) {
      if (d !== b.dayISO && okSpan(d, b.startMin, b.endMin) && isFree(work, busy, d, b.startMin, b.endMin, ignore)) return [d, b.startMin];
    }
    const own = periodOf(b.startMin);
    const ownWindow = own ? windows.filter((w) => w === PERIOD_WINDOWS[own]) : [];
    for (const w of [ownWindow, windows]) {
      if (w.length === 0) continue;
      for (const d of order) {
        const s = findSlot(work, busy, d, dur, w, ignore, opts);
        if (s !== null) return [d, s];
      }
    }
    return null;
  };

  const capSessions = (max: number): { lines: string[]; changed: number } => {
    const lines: string[] = [];
    let changed = 0;
    const longOnes = work.filter((b) => isSession(b) && b.endMin - b.startMin > max);
    for (const b of longOnes) {
      if (b.locked) {
        refused.push(lockedMessage(b));
        continue;
      }
      const before = describeBlock(b);
      const total = b.endMin - b.startMin;
      // Split evenly (60 → 30+30, 75 → 40+35) instead of leaving a 15-minute stub.
      const n = Math.ceil(total / max);
      let pieces: number[] = [];
      let rest = total;
      for (let k = n; k >= 1; k -= 1) {
        const p = Math.min(max, Math.ceil(rest / k / 5) * 5);
        pieces.push(p);
        rest -= p;
      }
      if (pieces.some((p) => p < MIN_SESSION)) pieces = [max, total - max];
      let remainder = total - pieces[0];
      dropPairedBreak(b);
      b.endMin = b.startMin + pieces[0];
      const parts: string[] = [];
      let cursor = b.endMin + STEP;
      let guard = 0;
      while (remainder >= MIN_SESSION && guard < 4) {
        guard += 1;
        const piece = Math.min(max, pieces[guard] ?? remainder, remainder);
        let slot: [string, number] | null = null;
        const same = findSlot(work, busy, b.dayISO, piece, windowsFor(b.startMin), new Set(), { minStart: cursor });
        if (same !== null) slot = [b.dayISO, same];
        if (!slot) {
          const startIdx = days.indexOf(b.dayISO);
          const later = days.filter((_, i) => i > startIdx);
          for (const d of later) {
            const s = findSlot(work, busy, d, piece, windowsFor(b.startMin), new Set());
            if (s !== null) {
              slot = [d, s];
              break;
            }
          }
        }
        if (!slot) break;
        const nb: PlanBlockLite = {
          ...b,
          id: newId(`${b.id}-p`),
          dayISO: slot[0],
          startMin: slot[1],
          endMin: slot[1] + piece,
          locked: false,
          manual: false,
          reason: `Phần tiếp theo của "${b.title}" (mỗi buổi tối đa ${max} phút).`,
        };
        work.push(nb);
        parts.push(slotLabel(nb.dayISO, nb.startMin, nb.endMin));
        remainder -= piece;
        cursor = slot[0] === b.dayISO ? nb.endMin + STEP : cursor;
      }
      changed += 1;
      const tail = parts.length
        ? `; phần còn lại: ${parts.join(', ')}`
        : remainder >= MIN_SESSION
          ? ` (không còn chỗ trống cho ${remainder} phút còn lại)`
          : '';
      lines.push(`Rút ${before} còn ${pieces[0]} phút${tail}.`);
    }
    return { lines, changed };
  };

  // Every span cleared in this batch ("cuối tuần" = Sat + Sun) is off-limits for displaced sessions.
  const cleared: Array<[string, number, number]> = (ops || [])
    .filter((o): o is Extract<PlanOp, { op: 'clear_day' }> => o.op === 'clear_day')
    .map((o) => {
      const [ws, we] = o.period ? PERIOD_WINDOWS[o.period] : [0, 1440];
      return [o.dayISO, ws, we];
    });
  const inCleared = (d: string, s: number, e: number) => cleared.some(([cd, ws, we]) => cd === d && overlaps(s, e, ws, we));

  for (const op of ops || []) {
    switch (op.op) {
      case 'move': {
        const b = byId(op.blockId);
        if (!b || !isSession(b)) {
          refused.push('Mình không tìm thấy buổi học cần dời.');
          break;
        }
        if (b.locked) {
          refused.push(lockedMessage(b));
          break;
        }
        const day = op.toDayISO || b.dayISO;
        if (!daySet.has(day)) {
          refused.push(`Ngày ${day} nằm ngoài tuần đang xếp nên mình chưa dời "${b.title}".`);
          break;
        }
        const dur0 = b.endMin - b.startMin;
        const ignore = new Set([b.id]);
        let start: number | null = null;
        let dur = dur0;
        if (op.toStartMin !== undefined) {
          const s0 = clamp(Math.round(op.toStartMin), 0, 1440 - MIN_SESSION);
          dur = clamp(op.toEndMin !== undefined ? op.toEndMin - s0 : dur0, MIN_SESSION, MAX_SESSION);
          if (isFree(work, busy, day, s0, s0 + dur, ignore)) start = s0;
          else {
            for (let s = ceilStep(s0 + 1); s + dur <= 1440; s += STEP) {
              if (isFree(work, busy, day, s, s + dur, ignore)) {
                start = s;
                break;
              }
            }
          }
        } else if (op.period) {
          start = findSlot(work, busy, day, dur, [PERIOD_WINDOWS[op.period]], ignore);
        } else if (day !== b.dayISO) {
          start = isFree(work, busy, day, b.startMin, b.endMin, ignore)
            ? b.startMin
            : findSlot(work, busy, day, dur, windowsFor(b.startMin), ignore);
        } else {
          refused.push(`Mình chưa rõ muốn dời "${b.title}" đi đâu.`);
          break;
        }
        if (start === null) {
          const where = op.period ? `${PERIOD_VI[op.period]} ${weekdayVi(day)}` : weekdayVi(day);
          refused.push(`Không còn chỗ trống ${where} cho "${b.title}" nên mình giữ nguyên ${describeBlock(b)}.`);
          break;
        }
        if (start === b.startMin && day === b.dayISO && start + dur === b.endMin) {
          applied.push(`"${b.title}" đã ở ${slotLabel(day, start, start + dur)} rồi.`);
          break;
        }
        const before = describeBlock(b);
        relocate(b, day, start, start + dur);
        applied.push(`Đã dời ${before} → ${slotLabel(day, start, start + dur)}.`);
        break;
      }

      case 'swap': {
        const a = byId(op.a);
        const c = byId(op.b);
        if (!a || !c || !isSession(a) || !isSession(c)) {
          refused.push('Mình không tìm thấy đủ hai buổi để đổi chỗ.');
          break;
        }
        if (a.locked || c.locked) {
          if (a.locked) refused.push(lockedMessage(a));
          if (c.locked) refused.push(lockedMessage(c));
          break;
        }
        const da = a.endMin - a.startMin;
        const dc = c.endMin - c.startMin;
        let aNew: [string, number] = [c.dayISO, c.startMin];
        let cNew: [string, number] = [a.dayISO, a.startMin];
        if (aNew[0] === cNew[0] && overlaps(aNew[1], aNew[1] + da, cNew[1], cNew[1] + dc)) {
          // Same day, different lengths: keep them back-to-back in swapped order.
          const first = Math.min(a.startMin, c.startMin);
          if (a.startMin < c.startMin) {
            cNew = [a.dayISO, first];
            aNew = [a.dayISO, first + dc];
          } else {
            aNew = [a.dayISO, first];
            cNew = [a.dayISO, first + da];
          }
        }
        const ignore = new Set([a.id, c.id]);
        if (!isFree(work, busy, aNew[0], aNew[1], aNew[1] + da, ignore) || !isFree(work, busy, cNew[0], cNew[1], cNew[1] + dc, ignore)) {
          refused.push(`Đổi chỗ ${describeBlock(a)} và ${describeBlock(c)} sẽ bị trùng lịch nên mình giữ nguyên.`);
          break;
        }
        const la = describeBlock(a);
        const lc = describeBlock(c);
        relocate(a, aNew[0], aNew[1], aNew[1] + da);
        relocate(c, cNew[0], cNew[1], cNew[1] + dc);
        applied.push(`Đã đổi chỗ ${la} ⇄ ${lc}.`);
        break;
      }

      case 'clear_day': {
        if (!daySet.has(op.dayISO)) {
          refused.push(`Ngày ${op.dayISO} nằm ngoài tuần đang xếp.`);
          break;
        }
        const win: [number, number] = op.period ? PERIOD_WINDOWS[op.period] : [0, 1440];
        const where = op.period ? `${PERIOD_VI[op.period]} ${weekdayVi(op.dayISO)}` : weekdayVi(op.dayISO);
        const inWindow = (b: PlanBlockLite) => b.dayISO === op.dayISO && overlaps(b.startMin, b.endMin, win[0], win[1]);
        // Breathers in the cleared span simply go.
        work = work.filter((b) => !(b.kind === 'break' && !b.locked && inWindow(b)));
        const targets = work.filter((b) => isSession(b) && inWindow(b));
        if (targets.length === 0) {
          applied.push(`${where[0].toUpperCase()}${where.slice(1)} vốn đã trống — không cần dời gì.`);
          break;
        }
        const avoid = (d: string, s: number, e: number) => (d === op.dayISO && overlaps(s, e, win[0], win[1])) || inCleared(d, s, e);
        const details: string[] = [];
        for (const b of targets) {
          if (b.locked) {
            refused.push(lockedMessage(b));
            continue;
          }
          const slot = relocateAnywhere(b, RELOCATE_WINDOWS, { avoid, sameDayFirst: !!op.period });
          if (!slot) {
            refused.push(`Không còn chỗ trống trong tuần cho "${b.title}" — buổi này vẫn ở ${describeBlock(b)}.`);
            continue;
          }
          const before = describeBlock(b);
          relocate(b, slot[0], slot[1], slot[1] + (b.endMin - b.startMin));
          details.push(`Dời ${before} → ${slotLabel(b.dayISO, b.startMin, b.endMin)}.`);
        }
        if (details.length > 0) {
          applied.push(`Đã để trống ${where}.`);
          pushSummary(applied, `Đã dời ${details.length} buổi sang chỗ trống khác:`, details);
        }
        break;
      }

      case 'remove': {
        const b = byId(op.blockId);
        if (!b) {
          refused.push('Mình không tìm thấy buổi học cần bỏ.');
          break;
        }
        if (b.locked) {
          refused.push(lockedMessage(b));
          break;
        }
        dropPairedBreak(b);
        work = work.filter((x) => x.id !== b.id);
        applied.push(`Đã bỏ ${describeBlock(b)}.`);
        break;
      }

      case 'add': {
        if (!daySet.has(op.dayISO)) {
          refused.push(`Ngày ${op.dayISO} nằm ngoài tuần đang xếp.`);
          break;
        }
        const dur = clamp(op.endMin - op.startMin, MIN_SESSION, MAX_SESSION);
        let start: number | null = null;
        const s0 = clamp(Math.round(op.startMin), 0, 1440 - dur);
        if (isFree(work, busy, op.dayISO, s0, s0 + dur, new Set())) start = s0;
        else {
          for (let s = ceilStep(s0 + 1); s + dur <= 1440; s += STEP) {
            if (isFree(work, busy, op.dayISO, s, s + dur, new Set())) {
              start = s;
              break;
            }
          }
          if (start === null) start = findSlot(work, busy, op.dayISO, dur, RELOCATE_WINDOWS, new Set());
        }
        if (start === null) {
          refused.push(`Không còn chỗ trống ${weekdayVi(op.dayISO)} để thêm buổi ${op.subject}.`);
          break;
        }
        const nb: PlanBlockLite = {
          id: newId('add'),
          title: op.title || op.subject,
          subject: op.subject,
          dayISO: op.dayISO,
          startMin: start,
          endMin: start + dur,
          reason: 'Bạn yêu cầu thêm buổi này.',
          kind: 'study',
        };
        work.push(nb);
        applied.push(`Đã thêm ${describeBlock(nb)}.`);
        break;
      }

      case 'cap_session': {
        const max = clamp(Math.round(op.maxMinutes), MIN_SESSION, MAX_SESSION);
        const refusedBefore = refused.length;
        const { lines, changed } = capSessions(max);
        pushSummary(applied, `Đã rút ${changed} buổi còn tối đa ${max} phút:`, lines);
        if (changed === 0 && refused.length === refusedBefore) applied.push(`Mọi buổi đều không dài quá ${max} phút rồi.`);
        break;
      }

      case 'latest_end': {
        const limit = clamp(Math.round(op.minute), 60, 1440);
        const late = work.filter((b) => isSession(b) && b.endMin > limit);
        if (late.length === 0) {
          applied.push(`Không có buổi nào kết thúc sau ${hhmm(limit)}.`);
          break;
        }
        const details: string[] = [];
        for (const b of late) {
          if (b.locked) {
            refused.push(lockedMessage(b));
            continue;
          }
          const slot = relocateAnywhere(b, RELOCATE_WINDOWS, { maxEnd: limit, sameDayFirst: true });
          if (!slot) {
            refused.push(`Không còn chỗ trống trước ${hhmm(limit)} cho "${b.title}" — vẫn giữ ${describeBlock(b)}.`);
            continue;
          }
          const before = describeBlock(b);
          relocate(b, slot[0], slot[1], slot[1] + (b.endMin - b.startMin));
          details.push(`Dời ${before} → ${slotLabel(b.dayISO, b.startMin, b.endMin)}.`);
        }
        if (details.length) applied.push(`Mọi buổi giờ xong trước ${hhmm(limit)}.`);
        pushSummary(applied, `Đã dời ${details.length} buổi:`, details);
        break;
      }

      case 'no_mornings': {
        const targets = work.filter((b) => isSession(b) && b.startMin < 720);
        if (targets.length === 0) {
          applied.push('Không có buổi sáng nào cần dời.');
          break;
        }
        const details: string[] = [];
        for (const b of targets) {
          if (b.locked) {
            refused.push(lockedMessage(b));
            continue;
          }
          const slot = relocateAnywhere(b, [PERIOD_WINDOWS.afternoon, PERIOD_WINDOWS.evening], { sameDayFirst: true });
          if (!slot) {
            refused.push(`Không còn chỗ chiều/tối cho "${b.title}" — vẫn giữ ${describeBlock(b)}.`);
            continue;
          }
          const before = describeBlock(b);
          relocate(b, slot[0], slot[1], slot[1] + (b.endMin - b.startMin));
          details.push(`Dời ${before} → ${slotLabel(b.dayISO, b.startMin, b.endMin)}.`);
        }
        if (details.length) applied.push('Không còn buổi học nào vào buổi sáng.');
        pushSummary(applied, `Đã dời ${details.length} buổi sáng sang chiều/tối:`, details);
        break;
      }

      case 'prefer_evenings': {
        const targets = work.filter((b) => isSession(b) && b.startMin < PERIOD_WINDOWS.evening[0]);
        const details: string[] = [];
        for (const b of targets) {
          if (b.locked) continue; // a preference, not an order: silently keep pinned sessions
          const dur = b.endMin - b.startMin;
          const s = findSlot(work, busy, b.dayISO, dur, [PERIOD_WINDOWS.evening], new Set([b.id]));
          if (s === null) continue;
          const before = describeBlock(b);
          relocate(b, b.dayISO, s, s + dur);
          details.push(`Dời ${before} → ${slotLabel(b.dayISO, s, s + dur)}.`);
        }
        if (details.length === 0) applied.push('Buổi tối đã kín hoặc lịch đã ưu tiên buổi tối — mình giữ nguyên.');
        else pushSummary(applied, `Đã chuyển ${details.length} buổi sang buổi tối:`, details);
        break;
      }

      case 'more_breaks': {
        const { changed } = capSessions(45);
        let added = 0;
        for (const b of work.filter(isSession)) {
          const bs = b.endMin;
          const be = b.endMin + 10;
          if (be > 1440) continue;
          const hasBreak = work.some((x) => x.kind === 'break' && x.dayISO === b.dayISO && overlaps(bs, be, x.startMin, x.endMin));
          if (hasBreak || !isFree(work, busy, b.dayISO, bs, be, new Set())) continue;
          work.push({
            id: newId(`${b.id}-brk`),
            title: 'Break',
            subject: 'Recharge',
            dayISO: b.dayISO,
            startMin: bs,
            endMin: be,
            reason: 'Nghỉ ngắn 10 phút để giữ tập trung.',
            kind: 'break',
          });
          added += 1;
        }
        applied.push(
          `Thêm thời gian nghỉ: ${changed > 0 ? `chia ${changed} buổi dài thành buổi 45 phút, ` : ''}chèn ${added} quãng nghỉ 10 phút.`,
        );
        break;
      }

      default:
        break;
    }
  }

  work = dropClashingBreaks(work, busy);
  return { blocks: sortBlocks(work), applied, refused };
}

/* ------------------------------------------------------------------ */
/* Locks: never trust the model to obey them                           */
/* ------------------------------------------------------------------ */

/**
 * Returns `next` with every locked block of `prev` present and identical.
 * Any `next` block overlapping a locked one is re-slotted (same day first, then nearest days)
 * or dropped when the week is full. Echoes of the locked block itself are dropped.
 */
export function enforceLocks(prev: PlanBlockLite[], next: PlanBlockLite[], ctx?: Partial<ApplyContext>): PlanBlockLite[] {
  const locks = (prev || []).filter((b) => b.locked);
  if (locks.length === 0) return sortBlocks((next || []).map((b) => ({ ...b })));
  const lockIds = new Set(locks.map((b) => b.id));
  const busy = ctx?.busy || [];
  const days =
    ctx?.days && ctx.days.length > 0
      ? ctx.days
      : Array.from(new Set([...(prev || []), ...(next || [])].map((b) => b.dayISO))).sort();
  const out: PlanBlockLite[] = locks.map((b) => ({ ...b }));
  const clashing: PlanBlockLite[] = [];
  for (const b of next || []) {
    if (lockIds.has(b.id)) continue;
    const hit = locks.find((l) => l.dayISO === b.dayISO && overlaps(b.startMin, b.endMin, l.startMin, l.endMin));
    if (!hit) out.push({ ...b });
    else if (b.kind !== 'break' && fold(b.title) !== fold(hit.title)) clashing.push({ ...b });
  }
  for (const b of clashing) {
    const dur = b.endMin - b.startMin;
    for (const d of daysByDistance(days, b.dayISO, true)) {
      const s = findSlot(out, busy, d, dur, windowsFor(b.startMin), new Set());
      if (s !== null) {
        out.push({ ...b, dayISO: d, startMin: s, endMin: s + dur });
        break;
      }
    }
  }
  return sortBlocks(out);
}

/* ------------------------------------------------------------------ */
/* Diff                                                                */
/* ------------------------------------------------------------------ */

/** Study/review changes between two plans (breaks are ignored). Match by id, then taskKey+subject+title, then subject+title. */
export function diffPlans(prev: PlanBlockLite[], next: PlanBlockLite[]): PlanDiffEntry[] {
  const P = sortBlocks((prev || []).filter(isSession).slice());
  const N = sortBlocks((next || []).filter(isSession).slice());
  const changes: PlanDiffEntry[] = [];
  const used = new Set<string>();
  const compare = (p: PlanBlockLite, n: PlanBlockLite) => {
    if (p.dayISO !== n.dayISO) changes.push({ type: 'moved', before: p, after: n });
    else if (p.startMin !== n.startMin || p.endMin !== n.endMin) changes.push({ type: 'retimed', before: p, after: n });
  };
  const nextById = new Map(N.map((b) => [b.id, b]));
  let pending: PlanBlockLite[] = [];
  for (const p of P) {
    const n = nextById.get(p.id);
    if (n && !used.has(n.id)) {
      used.add(n.id);
      compare(p, n);
    } else pending.push(p);
  }
  const passes: Array<(b: PlanBlockLite) => string> = [
    (b) => `${b.taskKey || ''}|${fold(b.subject)}|${fold(b.title)}`,
    (b) => `${fold(b.subject)}|${fold(b.title)}`,
  ];
  for (const key of passes) {
    const queue = new Map<string, PlanBlockLite[]>();
    for (const n of N) {
      if (used.has(n.id)) continue;
      const k = key(n);
      (queue.get(k) || queue.set(k, []).get(k)!).push(n);
    }
    const still: PlanBlockLite[] = [];
    for (const p of pending) {
      const q = queue.get(key(p));
      const n = q && q.shift();
      if (n) {
        used.add(n.id);
        compare(p, n);
      } else still.push(p);
    }
    pending = still;
  }
  for (const p of pending) changes.push({ type: 'removed', before: p });
  for (const n of N) if (!used.has(n.id)) changes.push({ type: 'added', after: n });
  return changes;
}

/* ------------------------------------------------------------------ */
/* Offline command parser (Vietnamese ± diacritics, English)           */
/* ------------------------------------------------------------------ */

interface Tok {
  raw: string; // NFC lowercase original
  f: string; // folded (placeholder for merged day/time tokens)
  kind?: 'day' | 'period' | 'prep' | 'pron' | 'time' | 'skip';
  dows?: number[];
  iso?: string;
  period?: Period;
  hour?: number;
  minute?: number;
  ampm?: 'am' | 'pm';
}

const VI_MARKS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
const THU_NUM: Record<string, number> = { '2': 1, hai: 1, '3': 2, ba: 2, '4': 3, tu: 3, '5': 4, nam: 4, '6': 5, sau: 5, '7': 6, bay: 6 };
const EN_DAY: Record<string, number> = {
  monday: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4,
  friday: 5, fri: 5, saturday: 6, sunday: 0, sun: 0,
};
const PRON_NEXT = new Set([
  'muon', 'can', 'bi', 'ban', 'se', 'da', 'phai', 'co', 'khong', 'ko', 'hoc', 'di', 'thich', 'nghi', 'ngu', 'duoc',
  'moi', 'lam', 'chi', 'van', 'cung', 'dang', 'hay', 'xin', 'nho', 'thay', 'met', 'ranh',
]);
const SKIPPABLE = new Set(['buoi', 'ngay', 'vao', 'luc', 'hom', 'the', 'on', 'in', 'at', 'cai', 'tiet']);
const PERIOD_WORDS = new Set(['sang', 'chieu', 'toi', 'dem', 'trua', 'morning', 'afternoon', 'evening', 'night', 'tonight']);

interface Analysis {
  toks: Tok[];
  marked: boolean;
  prep: number; // token index of the "to" word, -1 when none
  hasMove: boolean;
}

function analyze(text: string, days: string[]): Analysis {
  const low = String(text || '').toLowerCase().normalize('NFC');
  const marked = VI_MARKS.test(low);
  const raws = low.match(/[\p{L}\p{M}\p{N}]+(?::\d{1,2})?|->|→|=>/gu) || [];
  const toks: Tok[] = [];
  for (let i = 0; i < raws.length; i += 1) {
    const raw = raws[i];
    const f = fold(raw);
    const nf = i + 1 < raws.length ? fold(raws[i + 1]) : '';
    // Weekdays.
    if (f === 'thu' && nf in THU_NUM) {
      toks.push({ raw: `${raw} ${raws[i + 1]}`, f: '#day', kind: 'day', dows: [THU_NUM[nf]] });
      i += 1;
      continue;
    }
    const compact = /^(?:thu|t)([2-7])$/.exec(f);
    if (compact) {
      toks.push({ raw, f: '#day', kind: 'day', dows: [Number(compact[1]) - 1] });
      continue;
    }
    if (f === 'cn' || f === 'chunhat') {
      toks.push({ raw, f: '#day', kind: 'day', dows: [0] });
      continue;
    }
    if (f === 'chu' && nf === 'nhat') {
      toks.push({ raw: `${raw} ${raws[i + 1]}`, f: '#day', kind: 'day', dows: [0] });
      i += 1;
      continue;
    }
    if (f in EN_DAY) {
      toks.push({ raw, f: '#day', kind: 'day', dows: [EN_DAY[f]] });
      continue;
    }
    if ((f === 'cuoi' && nf === 'tuan') || f === 'weekend') {
      toks.push({ raw, f: '#day', kind: 'day', dows: [6, 0] });
      if (f === 'cuoi') i += 1;
      continue;
    }
    if ((f === 'hom' && nf === 'nay') || f === 'today' || f === 'tonight') {
      if (days[0]) toks.push({ raw, f: '#day', kind: 'day', iso: days[0] });
      if (f === 'tonight') toks.push({ raw, f: 'toi', kind: 'period', period: 'evening' });
      if (f === 'hom') i += 1;
      continue;
    }
    if ((f === 'ngay' && nf === 'mai' && raws[i + 1] === 'mai') || f === 'tomorrow') {
      if (days[1]) toks.push({ raw, f: '#day', kind: 'day', iso: days[1] });
      if (f === 'ngay') i += 1;
      continue;
    }
    const prevF = toks.length ? toks[toks.length - 1].f : '';
    if (raw === 'mai' && PERIOD_WORDS.has(prevF)) {
      if (days[1]) toks.push({ raw, f: '#day', kind: 'day', iso: days[1] });
      continue;
    }
    if (f === 'nay' && PERIOD_WORDS.has(prevF)) {
      if (days[0]) toks.push({ raw, f: '#day', kind: 'day', iso: days[0] });
      continue;
    }
    // Times: 19h, 19h30, 19:30, 7pm, "8 giờ 30", "8 gio ruoi".
    let tm = /^(\d{1,2})(?:h|g|:)(\d{1,2})?$/.exec(f);
    if (tm) {
      toks.push({ raw, f: '#time', kind: 'time', hour: Number(tm[1]), minute: Number(tm[2] || 0) });
      continue;
    }
    tm = /^(\d{1,2})(am|pm)$/.exec(f);
    if (tm) {
      toks.push({ raw, f: '#time', kind: 'time', hour: Number(tm[1]), minute: 0, ampm: tm[2] as 'am' | 'pm' });
      continue;
    }
    if (/^\d{1,2}$/.test(f) && (nf === 'gio' || nf === 'h' || nf === 'am' || nf === 'pm')) {
      const t: Tok = { raw, f: '#time', kind: 'time', hour: Number(f), minute: 0 };
      if (nf === 'am' || nf === 'pm') t.ampm = nf;
      i += 1;
      const nn = i + 1 < raws.length ? fold(raws[i + 1]) : '';
      if (/^\d{1,2}$/.test(nn)) {
        t.minute = Number(nn);
        i += 1;
      } else if (nn === 'ruoi') {
        t.minute = 30;
        i += 1;
      }
      toks.push(t);
      continue;
    }
    if (/^\d{1,2}$/.test(f) && (prevF === 'luc' || prevF === 'at')) {
      toks.push({ raw, f: '#time', kind: 'time', hour: Number(f), minute: 0 });
      continue;
    }
    toks.push({ raw, f });
  }

  // Unambiguous period words and pronouns.
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.kind) continue;
    const next = toks[i + 1];
    if (t.raw === 'sáng' || t.f === 'morning' || t.f === 'mornings') Object.assign(t, { kind: 'period', period: 'morning' });
    else if (t.f === 'chieu' || t.f === 'trua' || t.f === 'afternoon' || t.f === 'afternoons') Object.assign(t, { kind: 'period', period: 'afternoon' });
    else if (t.raw === 'tối' || t.raw === 'đêm' || t.f === 'evening' || t.f === 'evenings' || t.f === 'night' || t.f === 'nights')
      Object.assign(t, { kind: 'period', period: 'evening' });
    else if (!marked && t.f === 'dem') Object.assign(t, { kind: 'period', period: 'evening' });
    else if (t.raw === 'tôi' || t.raw === 'tớ') t.kind = 'pron';
    if ((t as Tok).kind === 'period' && t.f === 'toi' && next && next.f === 'da') t.kind = 'skip'; // "tối đa" = at most
  }

  const hasMove = toks.some((t, i) => {
    const next = toks[i + 1]?.f || '';
    if (t.f === 'doi') return marked ? t.raw === 'dời' || t.raw === 'đổi' || t.raw === 'doi' : true;
    if (t.f === 'chuyen') return marked ? t.raw === 'chuyển' || t.raw === 'chuyen' : next !== 'gi';
    if (t.f === 'lui') return marked ? t.raw === 'lùi' || t.raw === 'lui' : true;
    if (t.f === 'hoan') return marked ? t.raw === 'hoãn' : next !== 'toan' && next !== 'thanh' && next !== 'tat';
    return ['move', 'moving', 'reschedule', 'shift', 'push', 'put'].includes(t.f);
  });

  const qualifies = (i: number): boolean => {
    for (let j = i + 1; j < toks.length; j += 1) {
      const t = toks[j];
      if (SKIPPABLE.has(t.f)) continue;
      return t.kind === 'day' || t.kind === 'time' || t.kind === 'period' || PERIOD_WORDS.has(t.f);
    }
    return false;
  };

  // Strong "to" words, left to right.
  let prep = -1;
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.kind && t.kind !== 'skip') {
      if (t.kind !== 'period' || t.f !== 'sang') continue;
    }
    if (t.f === 'sang' && t.raw !== 'sáng') {
      const prevF = i > 0 ? toks[i - 1].f : '';
      if (marked) {
        if (prep < 0 && qualifies(i)) {
          prep = i;
          t.kind = 'prep';
        }
      } else if (prevF === 'buoi') Object.assign(t, { kind: 'period', period: 'morning' });
      else if (hasMove && prep < 0 && qualifies(i)) {
        prep = i;
        t.kind = 'prep';
      } else Object.assign(t, { kind: 'period', period: 'morning' });
      continue;
    }
    const strong =
      t.f === 'qua' || t.raw === 'đến' || (!marked && t.f === 'den') || t.raw === 'tới' || t.f === '->' || t.f === '→' || t.f === '=>' ||
      (t.raw === 'to' && !t.kind) || t.f === 'until';
    if (strong && hasMove && prep < 0 && qualifies(i)) {
      prep = i;
      t.kind = 'prep';
    }
  }
  // Weak "to" words: unmarked "toi" (tối/tôi/tới) and "vào".
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.kind) continue;
    const weak = (!marked && t.f === 'toi') || t.f === 'vao';
    if (weak && prep < 0 && hasMove && qualifies(i) && i > 1) {
      prep = i;
      t.kind = 'prep';
    }
  }
  // Leftover unmarked "toi": evening unless it is plainly the pronoun "tôi".
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.kind || t.f !== 'toi' || marked) continue;
    const prevF = i > 0 ? toks[i - 1].f : '';
    const next = toks[i + 1];
    if (next && next.f === 'da') t.kind = 'skip';
    else if (prevF === 'buoi') Object.assign(t, { kind: 'period', period: 'evening' });
    else if ((next && PRON_NEXT.has(next.f)) || (i === 0 && !qualifies(i))) t.kind = 'pron';
    else Object.assign(t, { kind: 'period', period: 'evening' });
  }
  return { toks, marked, prep, hasMove };
}

/*
 * Subject aliases (folded). `raw` = required spelling when the text has diacritics ("toán", not "toàn").
 * `ctx` = always needs a cue word before it ("buổi Anh"); `soft` = in text without diacritics it needs a cue word
 * or the sentence start ("doi toan …" yes, "nghi hoan toan" no). `notNext` = words that turn it into another word.
 */
interface Alias {
  f: string;
  raw?: string[];
  ctx?: boolean;
  soft?: boolean;
  notNext?: string[];
}
const SUBJECT_GROUPS: Array<{ canon: string; keys: string[]; aliases: Alias[] }> = [
  { canon: 'Toán', keys: ['toan', 'math', 'maths', 'mathematics'], aliases: [{ f: 'toan', raw: ['toán'], soft: true, notNext: ['bo', 'the', 'dien', 'cau', 'quoc', 'tap', 'phan', 'luc', 'ven'] }, { f: 'math' }, { f: 'maths' }, { f: 'mathematics' }, { f: 'dai so' }, { f: 'hinh hoc' }] },
  { canon: 'Ngữ văn', keys: ['ngu van', 'van', 'literature'], aliases: [{ f: 'ngu van' }, { f: 'van', raw: ['văn'], soft: true, notNext: ['de', 'con', 'chua', 'la', 'se', 'dang', 'khong', 'muon', 'phai', 'ban'] }, { f: 'literature' }, { f: 'tieng viet' }] },
  { canon: 'Tiếng Anh', keys: ['tieng anh', 'english', 'anh van'], aliases: [{ f: 'tieng anh' }, { f: 'english' }, { f: 'anh van' }, { f: 'anh', ctx: true }] },
  { canon: 'Khoa học tự nhiên', keys: ['khoa hoc tu nhien', 'khtn', 'science'], aliases: [{ f: 'khtn' }, { f: 'khoa hoc tu nhien' }, { f: 'science' }, { f: 'khoa hoc' }] },
  {
    canon: 'Lịch sử và Địa lí',
    keys: ['lich su', 'dia li', 'dia ly', 'history', 'geography'],
    aliases: [{ f: 'lich su' }, { f: 'dia li' }, { f: 'dia ly' }, { f: 'su dia' }, { f: 'lsdl' }, { f: 'su', raw: ['sử'], soft: true }, { f: 'dia', raw: ['địa'], soft: true }, { f: 'history' }, { f: 'geography' }],
  },
  { canon: 'Vật lí', keys: ['vat li', 'vat ly', 'physics'], aliases: [{ f: 'vat li' }, { f: 'vat ly' }, { f: 'physics' }, { f: 'ly', raw: ['lý'], soft: true }, { f: 'li', raw: ['lí'], soft: true }] },
  { canon: 'Hoá học', keys: ['hoa hoc', 'chemistry'], aliases: [{ f: 'hoa hoc' }, { f: 'chemistry' }, { f: 'hoa', raw: ['hoá', 'hóa'], soft: true }] },
  { canon: 'Sinh học', keys: ['sinh hoc', 'biology'], aliases: [{ f: 'sinh hoc' }, { f: 'biology' }, { f: 'sinh', ctx: true }] },
  { canon: 'Tin học', keys: ['tin hoc', 'informatics', 'computer science'], aliases: [{ f: 'tin hoc' }, { f: 'informatics' }, { f: 'computer science' }, { f: 'tin', ctx: true }] },
  { canon: 'Giáo dục công dân', keys: ['gdcd', 'cong dan', 'civics'], aliases: [{ f: 'gdcd' }, { f: 'cong dan' }, { f: 'civics' }] },
  { canon: 'Công nghệ', keys: ['cong nghe', 'technology'], aliases: [{ f: 'cong nghe' }, { f: 'technology' }] },
];
const CTX_PREV = new Set(['mon', 'buoi', 'hoc', 'bai', 'on', 'tiet', 'doi', 'chuyen', 'xoa', 'huy', 'bo', 'them', 'lui', 'move', 'va', 'voi', 'hoan', 'swap', 'and']);

function groupOf(subject: string) {
  const fs = ` ${fold(subject).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return SUBJECT_GROUPS.find((g) => g.keys.some((k) => fs.includes(` ${k} `)));
}

interface Mention {
  pos: number;
  subject?: string; // exact subject string from blocks
  canon?: string; // alias group canon (when no block has it)
  blockIds?: string[]; // title matches
}

/** Token indexes where `al.f` (folded, space-separated) occurs as whole words, honouring the alias guards. */
function findPhrase(toks: Tok[], al: Alias, marked: boolean): number[] {
  const parts = al.f.split(' ');
  const hits: number[] = [];
  for (let i = 0; i + parts.length <= toks.length; i += 1) {
    let ok = true;
    for (let j = 0; j < parts.length; j += 1) {
      if (toks[i + j].kind === 'day' || toks[i + j].kind === 'time' || toks[i + j].f !== parts[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const raw = toks[i].raw;
    const typedPlain = raw === toks[i].f; // this word was typed without diacritics
    const cue = i > 0 && CTX_PREV.has(toks[i - 1].f);
    const next = toks[i + parts.length]?.f || '';
    if (al.notNext && al.notNext.includes(next)) continue;
    if (al.ctx && !cue) continue;
    if (al.raw && marked && !typedPlain && !al.raw.includes(raw)) continue;
    if (al.soft && (!marked || typedPlain) && !(cue || i === 0)) continue;
    hits.push(i);
  }
  return hits;
}

function findSubjects(a: Analysis, blocks: PlanBlockLite[]): Mention[] {
  const out: Mention[] = [];
  const subjects = Array.from(new Set(blocks.filter(isSession).map((b) => b.subject)));
  const seen = new Set<string>();
  for (const subject of subjects) {
    const phrase = fold(subject).replace(/[^a-z0-9]+/g, ' ').trim();
    const g = groupOf(subject);
    // Known subjects are matched through their guarded aliases; custom ones by their full name.
    const hits: number[] = phrase && (!g || phrase.includes(' ')) ? findPhrase(a.toks, { f: phrase }, a.marked) : [];
    if (g) for (const al of g.aliases) hits.push(...findPhrase(a.toks, al, a.marked));
    if (hits.length) {
      out.push({ pos: Math.min(...hits), subject });
      seen.add(subject);
    }
  }
  // Distinctive titles ("bài luận Chí Phèo").
  for (const b of blocks.filter(isSession)) {
    if (seen.has(b.subject)) continue;
    const phrase = fold(b.title).replace(/[^a-z0-9]+/g, ' ').trim();
    if (phrase.length < 5) continue;
    const hits = findPhrase(a.toks, { f: phrase }, a.marked);
    if (hits.length) {
      const existing = out.find((m) => m.blockIds && m.pos === hits[0]);
      if (existing) existing.blockIds!.push(b.id);
      else out.push({ pos: hits[0], blockIds: [b.id] });
    }
  }
  // Known subjects the plan does not have yet (for "thêm buổi Hoá thứ 6").
  for (const g of SUBJECT_GROUPS) {
    if (subjects.some((s) => groupOf(s) === g)) continue;
    const hits: number[] = [];
    for (const al of g.aliases) hits.push(...findPhrase(a.toks, al, a.marked));
    if (hits.length) out.push({ pos: Math.min(...hits), canon: g.canon });
  }
  return out.sort((x, y) => x.pos - y.pos);
}

function resolveDay(t: Tok, days: string[]): string[] {
  if (t.iso) return days.includes(t.iso) ? [t.iso] : [];
  return days.filter((d) => (t.dows || []).includes(dowOf(d)));
}

function resolveTime(t: Tok, period?: Period): number {
  let h = t.hour ?? 0;
  const m = t.minute ?? 0;
  if (t.ampm === 'pm' && h < 12) h += 12;
  else if (t.ampm === 'am' && h === 12) h = 0;
  else if (!t.ampm && (period === 'evening' || period === 'afternoon') && h < 12) h += 12;
  else if (!t.ampm && !period && h <= 6) h += 12;
  return clamp(h * 60 + m, 0, 1440);
}

interface Segment {
  day?: string;
  dayTok?: number;
  period?: Period;
  times: number[];
}

function readSegment(a: Analysis, from: number, to: number, days: string[]): Segment {
  const seg: Segment = { times: [] };
  const timeToks: Tok[] = [];
  for (let i = from; i < to; i += 1) {
    const t = a.toks[i];
    if (t.kind === 'day' && !seg.day) {
      const iso = resolveDay(t, days)[0];
      if (iso) {
        seg.day = iso;
        seg.dayTok = i;
      }
    } else if (t.kind === 'period' && !seg.period) seg.period = t.period;
    else if (t.kind === 'time') timeToks.push(t);
  }
  seg.times = timeToks.slice(0, 2).map((t) => resolveTime(t, seg.period));
  return seg;
}

function blocksFor(mentions: Mention[], sessions: PlanBlockLite[]): PlanBlockLite[] {
  const subjects = new Set(mentions.filter((m) => m.subject).map((m) => m.subject!));
  const ids = new Set(mentions.flatMap((m) => m.blockIds || []));
  return sessions.filter((b) => subjects.has(b.subject) || ids.has(b.id));
}

function filterBySeg(list: PlanBlockLite[], seg: Segment): PlanBlockLite[] {
  return list.filter((b) => {
    if (seg.day && b.dayISO !== seg.day) return false;
    if (seg.period) {
      const [ws, we] = PERIOD_WINDOWS[seg.period];
      if (!overlaps(b.startMin, b.endMin, ws - 60, we + 60)) return false;
    }
    if (seg.times.length && Math.abs(b.startMin - seg.times[0]) > 30) return false;
    return true;
  });
}

function parseCap(plain: string): number | null {
  const unit = (n: number, u: string) => (/^(tieng|gio|h|hours?|hrs?)$/.test(u) ? (n <= 3 ? n * 60 : NaN) : n);
  const res = [
    /\b(?:toi da|nhieu nhat|khong qua|khong dai qua|duoi|max(?:imum)?|at most|no (?:longer|more) than|up to|under|cap(?: sessions?)?(?: at| to)?|limit(?: sessions?)?(?: to)?)\s*(\d{1,3}(?:[.,]\d)?)\s*(phut|p|min|mins|minutes?|tieng|gio|h|hours?|hrs?)\b/,
    /\b(?:moi buoi|mot buoi|1 buoi|each session|sessions?|blocks?)\s*(?:chi\s*)?(?:hoc\s*)?(?:khoang\s*)?(?:of\s*)?(\d{1,3})\s*(phut|p|min|mins|minutes?)\b/,
    /\b(\d{1,3})\s*(phut|p|min|mins|minutes?)\s*(?:moi buoi|mot buoi|1 buoi|per session|each|a session)\b/,
  ];
  for (const re of res) {
    const m = re.exec(plain);
    if (!m) continue;
    const n = unit(Number(m[1].replace(',', '.')), m[2]);
    if (Number.isFinite(n) && n > 0) return clamp(Math.round(n), MIN_SESSION, MAX_SESSION);
  }
  return null;
}

function parseLatestEnd(plain: string): number | null {
  const viTrig =
    '(?:di ngu truoc|di ngu luc|ngu truoc|ngu luc|xong truoc|hoc xong truoc|ket thuc truoc|ket thuc luc|xong luc|nghi truoc|dung hoc luc|dung luc|khong hoc sau|ko hoc sau|k hoc sau|khong hoc qua|truoc)';
  let m = new RegExp(`\\b${viTrig}\\s*(?:luc\\s*)?(\\d{1,2})\\s*(?:h|g|gio|:)\\s*(\\d{2})?\\s*(toi|dem|sang|chieu|pm|am)?\\b`).exec(plain);
  if (!m) m = new RegExp(`\\b${viTrig}\\s*(?:luc\\s*)?(\\d{1,2})\\s*(pm|am)()\\b`).exec(plain);
  let h: number;
  let mm = 0;
  let mark = '';
  if (m) {
    h = Number(m[1]);
    if (m[2] && /^\d+$/.test(m[2])) mm = Number(m[2]);
    else if (m[2]) mark = m[2];
    if (m[3]) mark = m[3];
  } else {
    const e = /\b(?:before|by|no later than|not past|nothing after|no study after|not after|done by|finish by|end by|stop at|bed at|sleep at|sleep by)\s*(\d{1,2})(?::(\d{2}))?\s*(pm|am)?\b/.exec(plain);
    if (!e) return null;
    h = Number(e[1]);
    mm = Number(e[2] || 0);
    mark = e[3] || '';
  }
  if (!Number.isFinite(h) || h > 24 || mm > 59) return null;
  if (h < 5 && mark !== 'pm' && mark !== 'toi' && mark !== 'dem' && mark !== 'chieu') return null; // "trước 2h" is not a bedtime
  if ((mark === 'pm' || mark === 'toi' || mark === 'dem' || mark === 'chieu' || !mark) && h < 12 && mark !== 'am' && mark !== 'sang') h += 12;
  return clamp(h * 60 + mm, 60, 1440);
}

/** Regex/keyword fallback when the AI is unavailable. Returns [] when nothing is understood. */
export function fallbackParse(text: string, blocks: PlanBlockLite[], days: string[]): PlanOp[] {
  const ops: PlanOp[] = [];
  const a = analyze(text, days);
  const sessions = (blocks || []).filter(isSession);
  const plain = ` ${fold(text).replace(/[^a-z0-9:]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const rawJoined = ` ${a.toks.map((t) => t.raw).join(' ')} `;
  const dayToks = a.toks.map((t, i) => ({ t, i })).filter((x) => x.t.kind === 'day');
  const periodToks = a.toks.map((t, i) => ({ t, i })).filter((x) => x.t.kind === 'period');
  const mentions = findSubjects(a, sessions);
  const wantsAll = /\b(tat ca|het|toan bo|cac buoi|moi buoi|all|every)\b/.test(plain);

  const cap = parseCap(plain);
  if (cap !== null) ops.push({ op: 'cap_session', maxMinutes: cap });
  const latest = parseLatestEnd(plain);
  if (latest !== null) ops.push({ op: 'latest_end', minute: latest });
  const moreBreaks =
    /\b(them|nhieu|nhieu hon|tang|can)\s+(gio |thoi gian |luc |quang )?(nghi|giai lao)\b|\bgiai lao\b|\bnghi giua\b|\bmore breaks?\b|\bburn(?:ed|t)? ?out\b|\bshorter sessions?\b|\bngan hon\b/.test(
      plain,
    );
  if (moreBreaks) ops.push({ op: 'more_breaks' });
  // "mệt quá" alone means "go easier"; next to a real command it is just a feeling.
  const tiredOnly = !moreBreaks && /\b(met qua|met moi|cang thang|qua tai|kiet suc|exhausted|tired)\b/.test(plain);

  if (dayToks.length === 0) {
    const noMorning =
      /\b(khong|ko|k|dung|tranh|bot|ne|it)\s+(muon\s+|thich\s+)?(hoc\s+)?(vao\s+)?(buoi\s+)?sang\b/.test(plain) ||
      /\b(no|avoid|skip|hate)\s+(early\s+)?mornings?\b|\bnot a morning person\b|\bday muon\b|\bngu nuong\b|\bmornings? off\b/.test(plain);
    if (noMorning) ops.push({ op: 'no_mornings' });
    const eveningPref =
      /\b(thich|uu tien|muon|chi|hay)\s+(hoc\s+)?(vao\s+)?(buoi\s+)?(toi|dem)\b/.test(plain) ||
      /\bprefer\s+(the\s+)?(evenings?|nights?)\b|\bnight owl\b|\bevening person\b|\bthuc khuya\b|\bhoc khuya\b/.test(plain);
    if (eveningPref && !/\btoi da\b/.test(plain)) ops.push({ op: 'prefer_evenings' });
  }
  const finish = () => (ops.length === 0 && tiredOnly ? [{ op: 'more_breaks' } as PlanOp] : ops);

  // Swap: "đổi Toán và Văn cho nhau", "swap math and english".
  const isSwap = /\b(cho nhau|swap|hoan doi|doi cho\s+(?!em|minh|toi|to|tui)\w+|exchange)\b/.test(plain);
  if (isSwap) {
    const subjMentions = mentions.filter((m) => m.subject || m.blockIds);
    let pair: [PlanBlockLite, PlanBlockLite] | null = null;
    if (subjMentions.length >= 2) {
      const pick = (m: Mention, nextPos: number) => {
        const seg = readSegment(a, m.pos, nextPos, days);
        const list = blocksFor([m], sessions);
        return filterBySeg(list, seg).find((b) => !b.locked) || filterBySeg(list, seg)[0] || list[0];
      };
      const A = pick(subjMentions[0], subjMentions[1].pos);
      const B = pick(subjMentions[1], a.toks.length);
      if (A && B && A.id !== B.id) pair = [A, B];
    } else if (dayToks.length >= 2) {
      const base = subjMentions.length ? blocksFor(subjMentions, sessions) : sessions;
      const segA = readSegment(a, 0, dayToks[1].i, days);
      const segB = readSegment(a, dayToks[1].i, a.toks.length, days);
      const A = filterBySeg(base, segA)[0];
      const B = filterBySeg(base, segB).find((b) => !A || b.id !== A.id);
      if (A && B) pair = [A, B];
    }
    if (pair) ops.push({ op: 'swap', a: pair[0].id, b: pair[1].id });
    return finish();
  }

  // Move: "Dời buổi Toán tối thứ 3 sang sáng thứ 7", "doi toan sang thu 7", "move math to friday 7pm".
  if (a.hasMove) {
    let src: Segment;
    let dst: Segment;
    if (a.prep >= 0) {
      src = readSegment(a, 0, a.prep, days);
      dst = readSegment(a, a.prep + 1, a.toks.length, days);
    } else if (dayToks.length >= 2) {
      src = readSegment(a, 0, dayToks[1].i, days);
      dst = readSegment(a, dayToks[1].i, a.toks.length, days);
    } else {
      src = { times: [] };
      dst = readSegment(a, 0, a.toks.length, days);
    }
    const hasTarget = !!(dst.day || dst.period || dst.times.length);
    const base = mentions.some((m) => m.subject || m.blockIds) ? blocksFor(mentions, sessions) : null;
    const srcHasFilter = !!(src.day || src.period || src.times.length);
    if (hasTarget && (base || srcHasFilter)) {
      let cands = filterBySeg(base || sessions, src);
      if (cands.length === 0 && base) cands = base; // subject is the strongest cue
      if (!wantsAll && cands.length > 1) {
        const better = cands.filter((b) => !b.locked && b.dayISO !== dst.day);
        cands = [better[0] || cands[0]];
      }
      for (const b of cands.slice(0, 8)) {
        const op: Extract<PlanOp, { op: 'move' }> = { op: 'move', blockId: b.id };
        if (dst.day) op.toDayISO = dst.day;
        if (dst.times.length) {
          op.toStartMin = dst.times[0];
          if (dst.times[1] && dst.times[1] > dst.times[0]) op.toEndMin = dst.times[1];
        } else if (dst.period) op.period = dst.period;
        ops.push(op);
      }
      if (cands.length > 0) return ops;
    }
  }

  // Remove: "bỏ buổi Toán thứ 3", "xoá Văn tối nay".
  const removeVerb = a.marked
    ? /\s(xoá|xóa|huỷ|hủy|bỏ|remove|delete|cancel|drop)\s/.test(rawJoined)
    : /\b(xoa|huy|bo|remove|delete|cancel|drop)\b/.test(plain);
  if (removeVerb && !a.hasMove) {
    const seg = readSegment(a, 0, a.toks.length, days);
    const base = mentions.some((m) => m.subject || m.blockIds) ? blocksFor(mentions, sessions) : null;
    // Without a subject ("bỏ lịch tối thứ 5") the student wants the slot free, not the study
    // time deleted — that falls through to clear_day below, which moves the sessions.
    if (base) {
      let cands = filterBySeg(base, seg);
      if (!wantsAll) cands = cands.slice(0, 1);
      for (const b of cands) ops.push({ op: 'remove', blockId: b.id });
      if (cands.length) return ops;
    }
  }

  // Add: "thêm 1 buổi Toán thứ 6 lúc 19h".
  const addVerb = a.marked ? /\s(thêm|bổ sung|add)\s/.test(rawJoined) : /\b(them|bo sung|add)\b/.test(plain);
  if (addVerb && !moreBreaks && dayToks.length > 0) {
    const m = mentions.find((x) => x.subject || x.canon);
    const seg = readSegment(a, 0, a.toks.length, days);
    if (m && seg.day) {
      const subject = m.subject || m.canon!;
      const durM = /\b(\d{2,3})\s*(phut|p|min|mins|minutes?)\b/.exec(plain);
      const dur = durM ? clamp(Number(durM[1]), MIN_SESSION, MAX_SESSION) : 60;
      const start = seg.times[0] ?? (seg.period ? PERIOD_WINDOWS[seg.period][0] : PERIOD_WINDOWS.evening[0]);
      // "ôn KHTN trước bài kiểm tra thứ 6" → the review goes the day BEFORE Friday.
      let dayISO = seg.day;
      const truocIdx = a.toks.findIndex((t) => t.f === 'truoc' || t.f === 'before');
      if (truocIdx >= 0 && dayToks[0] && dayToks[0].i > truocIdx && dayToks[0].i - truocIdx <= 6) {
        const k = days.indexOf(seg.day);
        if (k > 0) dayISO = days[k - 1];
      }
      ops.push({ op: 'add', subject, title: `Ôn ${subject}`, dayISO, startMin: start, endMin: start + dur });
      return ops;
    }
  }

  // Clear: "tuần này em bận tối thứ 5", "chủ nhật em nghỉ hoàn toàn", "keep friday clear".
  const clearSlot = removeVerb && !a.hasMove && dayToks.length > 0 && !mentions.some((m) => m.subject || m.blockIds);
  const busyWord = clearSlot || (() => {
    for (let i = 0; i < a.toks.length; i += 1) {
      const t = a.toks[i];
      const next = a.toks[i + 1]?.f || '';
      const prev = a.toks[i - 1]?.f || '';
      if (a.marked ? t.raw === 'bận' : t.f === 'ban' && !['voi', 'cung', 'cac', 'nhung', 'may', 'cho'].includes(prev)) return true;
      if (a.marked ? t.raw === 'nghỉ' : t.f === 'nghi' && !['la', 'rang', 've', 'sao', 'gi'].includes(next)) {
        if (!moreBreaks) return true;
      }
      if (t.f === 'khong' || t.f === 'ko' || t.f === 'k') {
        if (next === 'hoc' || next === 'ranh' || next === 'the') return true;
      }
    }
    return /\b(di choi|co viec|co chuyen|co hen|di vang|ve que|di du lich|busy|off|unavailable|day off|no study|not studying|cant study|cannot study|keep \w+ clear|clear|free up)\b/.test(plain);
  })();
  if (busyWord && dayToks.length > 0 && !ops.some((o) => o.op === 'move' || o.op === 'swap')) {
    const wholeDay = /\b(hoan toan|ca ngay|het ngay|nguyen ngay|all day|whole day|entire day|full day)\b/.test(plain);
    const seen = new Set<string>();
    for (const { t, i } of dayToks) {
      let period: Period | undefined;
      if (!wholeDay && periodToks.length > 0) {
        if (periodToks.length === 1) period = periodToks[0].t.period;
        else {
          const near = periodToks
            .map((p) => ({ p, d: Math.abs(p.i - i) }))
            .filter((x) => x.d <= 3)
            .sort((x, y) => x.d - y.d)[0];
          period = near?.p.t.period;
        }
      }
      for (const iso of resolveDay(t, days)) {
        const key = `${iso}|${period || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ops.push(period ? { op: 'clear_day', dayISO: iso, period } : { op: 'clear_day', dayISO: iso });
      }
    }
  }
  return finish();
}
