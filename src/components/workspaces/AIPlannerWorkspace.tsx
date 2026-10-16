import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  CalendarCheck,
  RefreshCw,
  Send,
  Clock,
  BookOpen,
  Coffee,
  TriangleAlert,
  CalendarX2,
  Loader2,
  ListPlus,
  KeyRound,
  MessageSquareText,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ListTodo,
  Lock,
  LockOpen,
  History,
  Undo2,
  CalendarClock,
  GitCompare,
} from 'lucide-react';
import type { Assignment, CalendarEvent, CanvasAssignment, EmailAlert } from '../../types';
import { callGemini, GEMINI_DEFAULT_MODEL } from '../../services/gemini';
import { getLang, useLang } from '../../services/i18n';
import {
  applyOps,
  buildCommandPrompt,
  describeBlock,
  diffPlans,
  enforceLocks,
  fallbackParse,
  fold,
  hhmm,
  parseOpsResponse,
  weekdayVi,
  type BusyLite,
  type PlanBlockLite,
  type PlanDiffEntry,
  type PlanOp,
} from '../../services/planCommands';

/** Vietnamese-first UI copy; re-renders via useLang() in the component. */
const L = (vi: string, en: string) => (getLang() === 'vi' ? vi : en);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface AIPlannerWorkspaceProps {
  assignments: Assignment[];
  canvasAssignments: CanvasAssignment[];
  /** Classroom coursework (same shape as Canvas). Optional for backward compat. */
  classroomAssignments?: CanvasAssignment[];
  /** Gmail radar alerts with detectedAssignment. Optional. */
  emailAlerts?: EmailAlert[];
  /** Read-only Google Calendar events (optional). Prefer 7-day upcoming feed. */
  meetings?: CalendarEvent[];
}

/** Same shape as the pure engine's block (taskKey links back to the source; locked/manual/tentative flags). */
type PlanBlock = PlanBlockLite;

interface PlannerConstraints {
  avoidMornings: boolean;
  preferEvenings: boolean;
  moreBreaks: boolean;
  blockedDays: string[]; // YYYY-MM-DD
  notes: string[];
  /** From chat: nothing ends after this minute ("ngủ trước 22h"). */
  latestEndMin?: number;
  /** From chat: no session longer than this ("tối đa 45 phút"). */
  maxSessionMin?: number;
}

interface PersistedPlan {
  blocks: PlanBlock[];
  generatedAt: string;
  mode: 'ai' | 'local';
  constraints: PlannerConstraints;
}

interface ChatMsg {
  role: 'user' | 'planner';
  text: string;
}

/** One saved version of the plan (newest first in storage). */
interface PlanVersion {
  id: string;
  savedAt: string;
  /** What replaced this version ("Tạo lại", "Sửa tay", the chat command…). */
  label: string;
  blocks: PlanBlock[];
  mode: 'ai' | 'local';
  constraints: PlannerConstraints;
}

/** A candidate plan waiting for the student's "Áp dụng" / "Giữ lịch cũ". */
interface PendingChange {
  blocks: PlanBlock[];
  mode: 'ai' | 'local';
  constraints: PlannerConstraints;
  label: string;
  diff: PlanDiffEntry[];
  origin: 'chat' | 'regen';
  reply?: string;
}

const STORAGE_KEY = 'scc_ai_planner_v1';
const HISTORY_KEY = 'scc_ai_planner_history_v1';
const HISTORY_MAX = 15;

function loadHistory(): PlanVersion[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => v && Array.isArray(v.blocks)).slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: PlanVersion[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* storage full or blocked — history still lives in memory */
  }
}
const DEFAULT_CONSTRAINTS: PlannerConstraints = {
  avoidMornings: false,
  preferEvenings: false,
  moreBreaks: false,
  blockedDays: [],
  notes: [],
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/* ------------------------------------------------------------------ */
/* Date helpers (local time, YYYY-MM-DD)                               */
/* ------------------------------------------------------------------ */

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function next7Days(): string[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(now, i)));
}

function parseDueToISO(due?: string): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return toISODate(d);
}

function fmtTime(min: number): string {
  if (getLang() === 'vi') return hhmm(min);
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${`${m}`.padStart(2, '0')} ${ampm}`;
}

function minToInput(min: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(min / 60)));
  const m = Math.max(0, Math.min(59, Math.round(min % 60)));
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`;
}

function inputToMin(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** Short weekday for the day tabs: T2…T7, CN in Vietnamese. */
function shortWeekday(iso: string): string {
  if (getLang() === 'vi') {
    const w = weekdayVi(iso);
    return w === 'Chủ nhật' ? 'CN' : w.replace('Thứ ', 'T');
  }
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  if (getLang() === 'vi') {
    const dm = `${d.getDate()}/${d.getMonth() + 1}`;
    if (iso === today) return `Hôm nay · ${weekdayVi(iso)} ${dm}`;
    if (iso === tomorrow) return `Ngày mai · ${weekdayVi(iso)} ${dm}`;
    return `${weekdayVi(iso)} · ${dm}`;
  }
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (iso === today) return `Today · ${md}`;
  if (iso === tomorrow) return `Tomorrow · ${md}`;
  return `${weekday} · ${md}`;
}

function daysUntil(iso: string): number {
  const today = new Date(toISODate(new Date()) + 'T12:00:00').getTime();
  const target = new Date(`${iso}T12:00:00`).getTime();
  return Math.round((target - today) / 86400000);
}

/* ------------------------------------------------------------------ */
/* Input harvesting (read-only)                                        */
/* ------------------------------------------------------------------ */

interface DatedTask {
  key: string;
  title: string;
  subject: string;
  dueISO: string;
  priority: 'High' | 'Med' | 'Low';
  minutes: number;
  origin: 'assignment' | 'canvas' | 'classroom' | 'gmail' | 'moodle';
  /** Deep link back to the source (tracker doc, Canvas/Classroom URL) when known. */
  url?: string;
  /** Deadline read by AI / from Gmail and not confirmed by the student yet. */
  tentative?: boolean;
}

/** Work with no readable deadline: shown to the student, never scheduled on an invented date. */
interface UndatedTask {
  key: string;
  title: string;
  subject: string;
  origin: DatedTask['origin'];
  url?: string;
}

const normName = (s: string) => fold(s || '').replace(/[^a-z0-9]+/g, ' ').trim();

function readCachedArray(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function harvestTasks(
  assignments: Assignment[],
  canvas: CanvasAssignment[],
  classroom?: CanvasAssignment[],
  emailAlerts?: EmailAlert[],
): { tasks: DatedTask[]; undated: UndatedTask[] } {
  const out: DatedTask[] = [];
  const undated: UndatedTask[] = [];
  // No invented deadlines: anything without a readable date goes to `undated`, never to "end of week".
  for (const a of assignments || []) {
    if (!a || a.status === 'Done' || (a as any).trashedAt) continue;
    const dueStatus = (a as any).dueStatus as string | undefined;
    const dueISO = dueStatus === 'missing' ? null : parseDueToISO(a.dueDate);
    const url = a.docUrl || (a as any).sourceUrl;
    if (!dueISO) {
      undated.push({ key: `a-${a.id}`, title: a.assignmentName || 'Untitled assignment', subject: a.subject || 'General', origin: 'assignment', url });
      continue;
    }
    const subMin = Array.isArray(a.subtasks)
      ? a.subtasks.reduce((s, st: any) => s + (Number(st?.estimatedMinutes) || 0), 0)
      : 0;
    out.push({
      key: `a-${a.id}`,
      title: a.assignmentName || 'Untitled assignment',
      subject: a.subject || 'General',
      dueISO,
      priority: a.priority || 'Med',
      minutes: Math.max(30, Math.min(240, Math.max(a.estimatedMinutes || 90, subMin || 0))),
      origin: 'assignment',
      url,
      tentative: dueStatus === 'unconfirmed' || undefined,
    });
  }
  const pushLms = (c: CanvasAssignment, prefix: string, origin: DatedTask['origin'], fallbackSubject: string) => {
    if (!c || c.isCompleted || c.isInformational) return;
    const dueISO = parseDueToISO((c as any).dueAt);
    if (!dueISO) return;
    out.push({
      key: `${prefix}-${c.id}`,
      title: c.name || 'Untitled item',
      subject: c.courseName || fallbackSubject,
      dueISO,
      priority: 'Med',
      minutes: 60,
      origin,
      url: (c as any).htmlUrl || (c as any).url,
    });
  };
  for (const c of canvas || []) pushLms(c, 'c', 'canvas', 'Canvas');
  for (const c of classroom || []) pushLms(c, 'gclass', 'classroom', 'Classroom');
  for (const m of readCachedArray('scc_cached_moodle_assignments')) {
    pushLms(
      { id: String(m?.id || m?.name || Math.random()), name: m?.name || m?.title, courseName: m?.courseName || m?.course || 'Moodle', dueAt: m?.dueAt || m?.dueDate, htmlUrl: m?.htmlUrl || m?.url } as CanvasAssignment,
      'm',
      'moodle',
      'Moodle',
    );
  }
  // Gmail detections are never confirmed by the student → tentative; skip ones already in the tracker.
  const trackerNames = new Set((assignments || []).filter(Boolean).map((a) => normName(a.assignmentName)).filter(Boolean));
  const seenGmail = new Set<string>();
  for (const alert of emailAlerts || []) {
    const det = alert?.detectedAssignment;
    if (!det?.isAssignment) continue;
    const title = (det.name || alert.subject || '').trim();
    const norm = normName(title);
    if (!title || !norm || seenGmail.has(norm) || trackerNames.has(norm)) continue;
    seenGmail.add(norm);
    const url = (alert as any).sourceUrl || (alert.rawEmail?.threadId ? `https://mail.google.com/mail/u/0/#all/${alert.rawEmail.threadId}` : undefined);
    const dueISO = det.dueConfidence === 'none' ? null : parseDueToISO(det.dueDate);
    if (!dueISO) {
      undated.push({ key: `g-${alert.id}`, title, subject: det.subject || 'Gmail', origin: 'gmail', url });
      continue;
    }
    out.push({
      key: `g-${alert.id}`,
      title,
      subject: det.subject || 'Gmail',
      dueISO,
      priority: det.priority || 'Med',
      minutes: 60,
      origin: 'gmail',
      url,
      tentative: true,
    });
  }
  const weight = { High: 0, Med: 1, Low: 2 } as const;
  out.sort((x, y) => x.dueISO.localeCompare(y.dueISO) || weight[x.priority] - weight[y.priority]);
  return { tasks: out, undated };
}

type BusySpan = BusyLite;

function meetingsToBusy(meetings?: CalendarEvent[]): BusySpan[] {
  if (!meetings) return [];
  const spans: BusySpan[] = [];
  for (const m of meetings) {
    try {
      const rawStart = m?.start?.dateTime || m?.start?.date;
      if (!rawStart) continue;
      const s = new Date(rawStart);
      if (Number.isNaN(s.getTime())) continue;
      const rawEnd = m?.end?.dateTime || m?.end?.date;
      const e = rawEnd ? new Date(rawEnd) : new Date(s.getTime() + 60 * 60000);
      const dayISO = toISODate(s);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = Number.isNaN(e.getTime())
        ? startMin + 60
        : e.getHours() * 60 + e.getMinutes();
      spans.push({
        dayISO,
        startMin: Math.max(0, startMin),
        endMin: Math.max(startMin + 15, Math.min(1440, endMin)),
        label: m.summary || 'Meeting',
      });
    } catch {
      /* ignore malformed events */
    }
  }
  return spans;
}

/** Weekly timetable (scc_timetable_v1 {day:Mon..Sun,hour:8..19,title}) → busy spans for this 7-day window. */
function timetableToBusy(days: string[]): BusySpan[] {
  const rows = readCachedArray('scc_timetable_v1');
  if (rows.length === 0) return [];
  const idx: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const spans: BusySpan[] = [];
  for (const dayISO of days) {
    const dow = new Date(`${dayISO}T12:00:00`).getDay();
    for (const r of rows) {
      const key = String(r?.day || '').slice(0, 3);
      if (idx[key] !== dow) continue;
      const h = Number(r?.hour);
      if (!Number.isFinite(h)) continue;
      spans.push({ dayISO, startMin: h * 60, endMin: Math.min(1440, h * 60 + 60), label: String(r?.title || 'Class') });
    }
  }
  return spans;
}

/* ------------------------------------------------------------------ */
/* Deterministic local planner — always works offline.                 */
/* Exclusive: no two blocks (study or meeting) ever overlap.           */
/* ------------------------------------------------------------------ */

function windowsFor(constraints: PlannerConstraints): Array<[number, number]> {
  const base: Array<[number, number]> = constraints.avoidMornings
    ? [[780, 1020], [1140, 1290]] // 1pm-5pm, 7pm-9:30pm
    : constraints.preferEvenings
      ? [[540, 720], [1140, 1320]] // 9am-12pm, 7pm-10pm
      : [[540, 720], [780, 1020], [1140, 1260]]; // 9-12, 1-5, 7-9
  const cap = constraints.latestEndMin;
  if (!cap) return base;
  return base.map(([s, e]) => [s, Math.min(e, cap)] as [number, number]).filter(([s, e]) => e - s >= 30);
}

/**
 * `fixed` = locked / hand-edited blocks: treated as busy, kept verbatim in the result,
 * and they count toward their task's sessions so the planner does not double-book it.
 */
function buildLocalPlan(
  tasks: DatedTask[],
  busy: BusySpan[],
  days: string[],
  constraints: PlannerConstraints,
  fixed: PlanBlock[] = [],
): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const occupied: Record<string, Array<[number, number]>> = {};
  for (const d of days) occupied[d] = [];
  for (const b of busy) {
    if (occupied[b.dayISO]) occupied[b.dayISO].push([b.startMin, b.endMin]);
  }
  const fixedPerTask: Record<string, number> = {};
  for (const f of fixed) {
    if (occupied[f.dayISO]) occupied[f.dayISO].push([f.startMin, f.endMin]);
    if (f.taskKey && f.kind !== 'break') fixedPerTask[f.taskKey] = (fixedPerTask[f.taskKey] || 0) + 1;
  }

  const overlaps = (day: string, s: number, e: number) =>
    (occupied[day] || []).some(([a, b]) => s < b && a < e);

  const claim = (day: string, s: number, e: number) => {
    occupied[day].push([s, e]);
  };

  const sessionLen = Math.max(15, Math.min(constraints.moreBreaks ? 45 : 75, constraints.maxSessionMin || 180));
  const gap = constraints.moreBreaks ? 15 : 10;
  let seq = 0;

  const placeSession = (
    task: DatedTask,
    dayISO: string,
    reason: string,
    kind: PlanBlock['kind'],
  ): boolean => {
    if (constraints.blockedDays.includes(dayISO)) return false;
    for (const [ws, we] of windowsFor(constraints)) {
      for (let s = ws; s + sessionLen <= we; s += 15) {
        const e = s + sessionLen;
        if (!overlaps(dayISO, s, e)) {
          claim(dayISO, s, e);
          seq += 1;
          blocks.push({
            id: `${task.key}-s${seq}`,
            taskKey: task.key,
            title: task.title,
            subject: task.subject,
            dayISO,
            startMin: s,
            endMin: e,
            reason,
            kind,
            ...(task.tentative ? { tentative: true } : {}),
          });
          if (constraints.moreBreaks) {
            // A short breather right after — still exclusive, still claimed.
            const bs = e;
            const be = Math.min(e + 10, we);
            if (be - bs >= 5 && !overlaps(dayISO, bs, be)) {
              claim(dayISO, bs, be);
              blocks.push({
                id: `${task.key}-b${seq}`,
                title: 'Break',
                subject: 'Recharge',
                dayISO,
                startMin: bs,
                endMin: be,
                reason: 'Short breather so focus stays sharp.',
                kind: 'break',
              });
            }
          }
          return true;
        }
      }
    }
    return false;
  };

  for (const task of tasks) {
    const left = daysUntil(task.dueISO);
    const sessionsNeeded = (task.minutes > 120 ? 3 : task.minutes > 60 ? 2 : 1) - (fixedPerTask[task.key] || 0);
    if (sessionsNeeded <= 0) continue;
    // Eligible days: today → due date within the 7-day window.
    // Overdue (due < today) front-loads across the whole week instead of vanishing.
    const eligible = task.dueISO < days[0] ? [...days] : days.filter((d) => d <= task.dueISO);
    const ordered = [...eligible].sort((a, b) => {
      // Urgent items first, then earliest slot — spreads load across free days.
      if (left <= 2) return a.localeCompare(b);
      return b.localeCompare(a);
    });
    let placed = 0;
    for (const day of ordered) {
      if (placed >= sessionsNeeded) break;
      const leftForDay = daysUntil(task.dueISO) - days.indexOf(day);
      const reason =
        task.priority === 'High'
          ? `High priority · due ${task.dueISO} — placed early so it never slips.`
          : left <= 1
            ? `Due ${left <= 0 ? 'today' : 'tomorrow'} — front-loaded before the deadline.`
            : `Due ${task.dueISO} (${leftForDay} day${leftForDay === 1 ? '' : 's'} out) — steady progress, no cramming.`;
      const kind: PlanBlock['kind'] = placed === sessionsNeeded - 1 && sessionsNeeded > 1 ? 'review' : 'study';
      if (placeSession(task, day, reason, kind)) placed += 1;
      void gap;
    }
  }

  for (const f of fixed) blocks.push({ ...f });
  blocks.sort((a, b) => a.dayISO.localeCompare(b.dayISO) || a.startMin - b.startMin);
  return blocks;
}

/* ------------------------------------------------------------------ */
/* AI enhancement (server chain: gemini-flash-latest → … → Groq).  */
/* Uses shared callGemini so BYOK, server proxy, and Groq all work.   */
/* Any failure → null, caller falls back to the local plan.           */
/* ------------------------------------------------------------------ */

async function tryGeminiPlan(
  tasks: DatedTask[],
  days: string[],
  constraints: PlannerConstraints,
  signal: AbortSignal,
  fixed: PlanBlock[] = [],
  busy: BusySpan[] = [],
): Promise<PlanBlock[] | null> {
  if (signal.aborted) return null;

  const fixedList = fixed
    .filter((b) => b.kind !== 'break')
    .map((b) => `${b.dayISO} ${hhmm(b.startMin)}-${hhmm(b.endMin)} ${b.subject}: ${b.title}`);
  const busyList = busy.slice(0, 40).map((b) => `${b.dayISO} ${hhmm(b.startMin)}-${hhmm(b.endMin)} ${b.label}`);
  const prompt = [
    'You are a student timetable planner. Return ONLY valid JSON: an array of blocks.',
    'Each block: {"taskKey": string (the task\'s key), "title": string, "subject": string, "dayISO": "YYYY-MM-DD", "startMin": number (minutes since midnight), "endMin": number, "reason": string (one short sentence why this slot)}.',
    `Week days (use only these): ${days.join(', ')}.`,
    `Constraints: avoidMornings=${constraints.avoidMornings}, preferEvenings=${constraints.preferEvenings}, moreBreaks=${constraints.moreBreaks}, blockedDays=${constraints.blockedDays.join('|') || 'none'}${constraints.latestEndMin ? `, nothing ends after ${hhmm(constraints.latestEndMin)}` : ''}${constraints.maxSessionMin ? `, sessions at most ${constraints.maxSessionMin} min` : ''}.`,
    'Rules: exclusive timetable — no overlapping blocks. 45-75 minute sessions. Put urgent due dates first.',
    `FIXED sessions the student locked (do NOT output, move or overlap them; they already count for their task): ${fixedList.join('; ') || 'none'}.`,
    `Busy (classes/meetings, never overlap): ${busyList.join('; ') || 'none'}.`,
    `Tasks: ${JSON.stringify(tasks.slice(0, 40))}`,
  ].join('\n');
  const taskByKey = new Map(tasks.map((t) => [t.key, t]));
  const taskByTitle = new Map(tasks.map((t) => [t.title.trim().toLowerCase(), t]));

  try {
    const text = await callGemini({
      contents: prompt.slice(0, 12000),
      config: { responseMimeType: 'application/json' },
      model: GEMINI_DEFAULT_MODEL,
    });
    if (!text || signal.aborted) return null;
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const daySet = new Set(days);
    const blocks: PlanBlock[] = [];
    const taken: Array<[string, number, number]> = [];
    parsed.slice(0, 30).forEach((b, i) => {
      const dayISO = String(b?.dayISO || '');
      const s = Number(b?.startMin);
      const e = Number(b?.endMin);
      if (!daySet.has(dayISO) || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
      if (e - s > 180 || e - s < 15) return;
      if (taken.some(([d, a, c]) => d === dayISO && s < c && a < e)) return; // keep exclusive
      if (busy.some((x) => x.dayISO === dayISO && s < x.endMin && x.startMin < e)) return; // never on a class/meeting
      if (constraints.blockedDays.includes(dayISO)) return;
      taken.push([dayISO, s, e]);
      const title = String(b?.title || 'Study session').slice(0, 80);
      const task = taskByKey.get(String(b?.taskKey || '')) || taskByTitle.get(title.trim().toLowerCase());
      blocks.push({
        id: `ai-${i}-${s}`,
        ...(task ? { taskKey: task.key } : {}),
        title,
        subject: String(b?.subject || 'Study').slice(0, 40),
        dayISO,
        startMin: Math.max(0, Math.min(1439, Math.round(s))),
        endMin: Math.max(1, Math.min(1440, Math.round(e))),
        reason: String(b?.reason || 'Placed by AI around your deadlines.').slice(0, 140),
        kind: 'study',
        ...(task?.tentative ? { tentative: true } : {}),
      });
    });
    blocks.sort((a, b) => a.dayISO.localeCompare(b.dayISO) || a.startMin - b.startMin);
    return blocks.length > 0 ? blocks : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Constraint parsing for chat re-plans                                */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseConstraintsFromText(
  text: string,
  days: string[],
  prev: PlannerConstraints,
): { next: PlannerConstraints; changes: string[] } {
  const lower = text.toLowerCase();
  const next: PlannerConstraints = {
    ...prev,
    blockedDays: [...prev.blockedDays],
    notes: [...prev.notes],
  };
  const changes: string[] = [];

  if (/(avoid|no|skip)\s+(morning|mornings)/.test(lower) || /not\s+a\s+morning\s+person/.test(lower)) {
    if (!next.avoidMornings) {
      next.avoidMornings = true;
      changes.push('Avoiding mornings — sessions move to afternoons and evenings.');
    }
  }
  if (/(evening|night)/.test(lower) && /(prefer|after|pm)/.test(lower)) {
    if (!next.preferEvenings) {
      next.preferEvenings = true;
      changes.push('Preferring evening slots where the day is free.');
    }
  }
  if (/more\s+breaks?/.test(lower) || /burn(ed|t)?\s*out/.test(lower) || /shorter\s+sessions?/.test(lower)) {
    if (!next.moreBreaks) {
      next.moreBreaks = true;
      changes.push('Shorter 45-minute sessions with breathers between them.');
    }
  }
  // Explicit "keep X clear / busy Friday / no time Monday" blocks that day — same rule every weekday.
  const dayBusy = /(busy|meeting|reschedul|avoid|off|unavailable|no\s*time|booked|clear|keep|move)/.test(lower);
  WEEKDAYS.forEach((wd, idx) => {
    if (!lower.includes(wd) && !lower.includes(wd.slice(0, 3))) return;
    if (!dayBusy) return;
    const match = days.find((iso) => new Date(`${iso}T12:00:00`).getDay() === idx);
    if (match && !next.blockedDays.includes(match)) {
      next.blockedDays.push(match);
      changes.push(`Keeping ${wd[0].toUpperCase()}${wd.slice(1)} (${match}) clear — sessions moved to other days.`);
    }
  });
  if (changes.length === 0) {
    const snippet = text.trim().slice(0, 60);
    next.notes.push(snippet);
    changes.push(`Noted (“${snippet}”) — rebalanced the week with your deadlines first.`);
  }
  return { next, changes };
}

/* ------------------------------------------------------------------ */
/* Origin badges for the in-panel resource list                       */
/* ------------------------------------------------------------------ */

const ORIGIN_META: Record<DatedTask['origin'], { label: string; chip: string }> = {
  assignment: { label: 'Tracker', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  canvas: { label: 'Canvas', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  classroom: { label: 'Classroom', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  gmail: { label: 'Gmail', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  moodle: { label: 'Moodle', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

function dueNote(dueISO: string): string {
  const left = daysUntil(dueISO);
  if (left < 0) return L(`Hạn ${dueISO} · quá hạn`, `Due ${dueISO} · overdue`);
  if (left === 0) return L('Hạn hôm nay', 'Due today');
  if (left === 1) return L('Hạn ngày mai', 'Due tomorrow');
  return L(`Hạn ${dueISO} · còn ${left} ngày`, `Due ${dueISO} · ${left}d left`);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const AIPlannerWorkspace: React.FC<AIPlannerWorkspaceProps> = ({
  assignments,
  canvasAssignments,
  classroomAssignments,
  emailAlerts,
  meetings,
}) => {
  useLang(); // re-render on language toggle
  const days = useMemo(() => next7Days(), []);
  const harvested = useMemo(
    () => harvestTasks(assignments || [], canvasAssignments || [], classroomAssignments, emailAlerts),
    [assignments, canvasAssignments, classroomAssignments, emailAlerts],
  );
  const tasks = harvested.tasks;
  const undated = harvested.undated;
  const busySpans = useMemo(
    () => [...meetingsToBusy(meetings), ...timetableToBusy(days)],
    [meetings, days],
  );
  const busyByDay = useMemo(() => {
    const map: Record<string, BusySpan[]> = {};
    for (const b of busySpans) (map[b.dayISO] ||= []).push(b);
    return map;
  }, [busySpans]);
  const hasMeetingFeed = meetings !== undefined;

  const [plan, setPlan] = useState<PersistedPlan | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedPlan;
      if (!parsed || !Array.isArray(parsed.blocks)) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  const [constraints, setConstraints] = useState<PlannerConstraints>(
    () => plan?.constraints || DEFAULT_CONSTRAINTS,
  );
  const [phase, setPhase] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<PlanVersion[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const planLiveRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<PersistedPlan | null>(plan);
  planRef.current = plan;

  const persist = useCallback((p: PersistedPlan) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage full or blocked — plan still shows in memory */
    }
  }, []);

  const say = useCallback((text: string) => {
    if (text.trim()) setChat((prev) => [...prev.slice(-9), { role: 'planner', text }]);
  }, []);

  /** Save the plan that is about to be replaced (never lose a version). */
  const pushHistory = useCallback((old: PersistedPlan | null, label: string) => {
    if (!old || !Array.isArray(old.blocks)) return;
    setHistory((prev) => {
      const entry: PlanVersion = {
        id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: new Date().toISOString(),
        label: label.slice(0, 80),
        blocks: old.blocks,
        mode: old.mode,
        constraints: old.constraints,
      };
      const next = [entry, ...prev].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  }, []);

  /** Replace the current plan, archiving the old one under `label`. */
  const commitPlan = useCallback(
    (next: PersistedPlan, label: string) => {
      pushHistory(planRef.current, label);
      planRef.current = next;
      setPlan(next);
      persist(next);
    },
    [persist, pushHistory],
  );

  /** Locked / hand-edited blocks still inside this week — the planner and the AI must keep them. */
  const lockedNow = useCallback(
    (p: PersistedPlan | null) => (p?.blocks || []).filter((b) => b.locked && days.includes(b.dayISO)),
    [days],
  );

  /** First plan applies directly; later ones become a diff the student approves. */
  const offerOrApply = useCallback(
    (candidate: PlanBlock[], mode: 'ai' | 'local', active: PlannerConstraints, label: string, origin: 'chat' | 'regen' | 'auto', reply?: string) => {
      const current = planRef.current;
      if (!current || origin === 'auto') {
        commitPlan({ blocks: candidate, generatedAt: new Date().toISOString(), mode, constraints: active }, label);
        setConstraints(active);
        if (reply) say(reply);
        return;
      }
      const diff = diffPlans(current.blocks, candidate);
      setPending({ blocks: candidate, mode, constraints: active, label, diff, origin: origin === 'chat' ? 'chat' : 'regen', reply });
      if (reply) say(reply);
    },
    [commitPlan, say],
  );

  const runPlanning = useCallback(
    async (active: PlannerConstraints, announcement?: string, opts?: { label?: string; origin?: 'chat' | 'regen' | 'auto' }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setAiError(null);
      setPending(null);
      const origin = opts?.origin || 'regen';
      const label = opts?.label || L('Tạo lại', 'Regenerate');
      try {
        setPhase(L(`Đang đọc ${tasks.length} bài tập…`, `Scanning ${tasks.length} assignment${tasks.length === 1 ? '' : 's'}…`));
        await delay(380);
        if (ctrl.signal.aborted) return;
        setPhase(
          hasMeetingFeed
            ? L(`Chặn ${busySpans.length} lịch bận…`, `Blocking ${busySpans.length} calendar event${busySpans.length === 1 ? '' : 's'}…`)
            : L('Đang xem tuần tới…', 'Checking the week ahead…'),
        );
        await delay(340);
        if (ctrl.signal.aborted) return;

        setPhase(L('Đang hỏi AI cách xếp hợp lý (Gemini → Groq)…', 'Asking AI for a smart layout (Gemini → Groq)…'));
        await delay(300);
        if (ctrl.signal.aborted) return;

        // Locked blocks are fixed: busy for the local planner, FIXED for the AI, then enforced again.
        const fixed = lockedNow(planRef.current);
        const local = buildLocalPlan(tasks, busySpans, days, active, fixed);
        let blocks = local;
        let mode: 'ai' | 'local' = 'local';
        {
          setPhase(L('AI đang tinh chỉnh các buổi…', 'Refining slots with AI…'));
          const ai = await tryGeminiPlan(tasks, days, active, ctrl.signal, fixed, busySpans);
          if (ai && ai.length > 0) {
            blocks = ai;
            mode = 'ai';
          } else {
            setAiError(
              L(
                'AI chưa trả về lịch dùng được (thiếu khoá hoặc hết lượt) — đang hiện lịch offline. Thêm khoá trong Cài đặt → AI (BYOK).',
                'AI did not return a usable plan (keys missing or quota reached) — showing the offline plan instead. Add a key in Settings → AI (BYOK).',
              ),
            );
          }
        }
        blocks = enforceLocks(fixed, blocks, { days, busy: busySpans });
        if (ctrl.signal.aborted) return;
        setPhase(L('Đang xếp các buổi không trùng nhau…', 'Laying out exclusive blocks…'));
        await delay(280);
        if (ctrl.signal.aborted) return;

        offerOrApply(blocks, mode, active, label, origin, announcement);
      } finally {
        if (!ctrl.signal.aborted) setPhase(null);
      }
    },
    [tasks, busySpans, days, hasMeetingFeed, lockedNow, offerOrApply],
  );

  const applyPending = () => {
    if (!pending) return;
    commitPlan({ blocks: pending.blocks, generatedAt: new Date().toISOString(), mode: pending.mode, constraints: pending.constraints }, pending.label);
    setConstraints(pending.constraints);
    setPending(null);
    say(L('Đã áp dụng. Bấm "Hoàn tác" nếu muốn quay lại lịch cũ.', 'Applied. Tap "Undo" to go back to the previous plan.'));
  };

  const discardPending = () => {
    if (!pending) return;
    const hadChanges = pending.diff.length > 0;
    setPending(null);
    if (hadChanges) say(L('Đã giữ lịch cũ — không có gì thay đổi.', 'Kept your current plan — nothing changed.'));
  };

  /** Restore a saved version; the current plan is archived first so nothing is lost. */
  const restoreVersion = (v: PlanVersion, label: string) => {
    const current = planRef.current;
    setPending(null);
    setHistory((prev) => {
      const rest = prev.filter((x) => x.id !== v.id);
      const next = current
        ? [
            {
              id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              savedAt: new Date().toISOString(),
              label,
              blocks: current.blocks,
              mode: current.mode,
              constraints: current.constraints,
            },
            ...rest,
          ].slice(0, HISTORY_MAX)
        : rest;
      saveHistory(next);
      return next;
    });
    const restored: PersistedPlan = { blocks: v.blocks, generatedAt: new Date().toISOString(), mode: v.mode, constraints: v.constraints || DEFAULT_CONSTRAINTS };
    planRef.current = restored;
    setPlan(restored);
    persist(restored);
    setConstraints(restored.constraints);
    say(L(`Đã quay lại bản lúc ${new Date(v.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`, `Restored the version from ${new Date(v.savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`));
  };

  const undoLast = () => {
    if (history.length > 0) restoreVersion(history[0], L('Hoàn tác', 'Undo'));
  };

  // Auto-plan on first mount when real dated work exists.
  useEffect(() => {
    if (plan || tasks.length === 0 || phase) return;
    void runPlanning(DEFAULT_CONSTRAINTS, undefined, { origin: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const blocksByDay = useMemo(() => {
    const map: Record<string, PlanBlock[]> = {};
    for (const d of days) map[d] = [];
    for (const b of plan?.blocks || []) {
      if (map[b.dayISO]) map[b.dayISO].push(b);
      else map[b.dayISO] = [b];
    }
    return map;
  }, [plan, days]);

  const totalStudyMin = useMemo(
    () => (plan?.blocks || []).filter((b) => b.kind !== 'break').reduce((s, b) => s + (b.endMin - b.startMin), 0),
    [plan],
  );

  const handleRegenerate = () => void runPlanning(constraints, undefined, { label: L('Tạo lại', 'Regenerate'), origin: 'regen' });

  /* ------------------------- day focus + manual times ------------------------- */

  const [selectedDay, setSelectedDay] = useState<string>(() => days[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDay, setEditDay] = useState('');
  const [showSources, setShowSources] = useState(true);

  const beginEdit = (b: PlanBlock) => {
    setEditingId(b.id);
    setEditStart(minToInput(b.startMin));
    setEditEnd(minToInput(b.endMin));
    setEditDay(days.includes(b.dayISO) ? b.dayISO : days[0]);
  };

  /** Manual day/time change — saved, archived as "Sửa tay", and locked so the AI never moves it. */
  const saveEdit = (b: PlanBlock) => {
    const s = inputToMin(editStart);
    const e = inputToMin(editEnd);
    const current = planRef.current;
    if (!current || s === null || e === null || e - s < 15 || s < 0 || e > 1440) return;
    const day = days.includes(editDay) ? editDay : b.dayISO;
    const blocks = current.blocks.map((x) => (x.id === b.id ? { ...x, dayISO: day, startMin: s, endMin: e, manual: true, locked: true } : x));
    blocks.sort((x, y) => x.dayISO.localeCompare(y.dayISO) || x.startMin - y.startMin);
    commitPlan({ ...current, blocks }, L('Sửa tay', 'Manual edit'));
    setPending(null);
    setEditingId(null);
    setSelectedDay(day);
  };

  /** Lock pins a block: Regenerate, chat ops and the AI must leave it exactly where it is. */
  const toggleLock = (b: PlanBlock) => {
    const current = planRef.current;
    if (!current) return;
    const blocks = current.blocks.map((x) => (x.id === b.id ? { ...x, locked: !x.locked } : x));
    const next = { ...current, blocks };
    planRef.current = next;
    setPlan(next);
    persist(next);
    // A candidate built before this lock could move the block: re-enforce and re-diff it.
    setPending((p) => {
      if (!p) return p;
      const candidate = enforceLocks(lockedNow(next), p.blocks, { days, busy: busySpans });
      return { ...p, blocks: candidate, diff: diffPlans(next.blocks, candidate) };
    });
  };

  const placedByKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of plan?.blocks || []) {
      if (b.kind === 'break') continue;
      const key = b.taskKey || (tasks.some((t) => b.id.startsWith(`${t.key}-`)) ? b.id.slice(0, b.id.lastIndexOf('-s')) : null);
      if (key) map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [plan, tasks]);

  const stepDay = (dir: 1 | -1) => {
    const i = days.indexOf(selectedDay);
    const n = Math.min(days.length - 1, Math.max(0, i + dir));
    setSelectedDay(days[n]);
  };

  /** Old path: keyword constraints + full re-plan (still shown as a diff when a plan exists). */
  const replanFromText = (text: string) => {
    const { next, changes } = parseConstraintsFromText(text, days, constraints);
    void runPlanning(next, changes.join(' '), { label: text, origin: 'chat' });
  };

  /** Chat command → AI interpreter → ops (or offline rules) → applyOps → enforceLocks → diff to approve. */
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || phase) return;
    setChat((prev) => [...prev.slice(-9), { role: 'user', text }]);
    setDraft('');
    setPending(null);
    const current = planRef.current;
    if (!current) {
      replanFromText(text);
      return;
    }

    setPhase(L('Đang đọc yêu cầu của bạn…', 'Reading your request…'));
    let parsed: ReturnType<typeof parseOpsResponse> = null;
    try {
      const raw = await callGemini({
        contents: buildCommandPrompt(text, current.blocks, days, days[0], busySpans).slice(0, 14000),
        config: { responseMimeType: 'application/json' },
        model: GEMINI_DEFAULT_MODEL,
      });
      parsed = parseOpsResponse(raw);
    } catch {
      parsed = null;
    } finally {
      setPhase(null);
    }
    // The plan may have changed while the AI was thinking.
    const base = planRef.current || current;

    if (parsed?.unclear) {
      say(parsed.question || L('Bạn nói rõ hơn giúp mình được không — buổi nào, ngày nào?', 'Could you say which session and which day?'));
      return;
    }
    let ops: PlanOp[] = parsed?.ops || [];
    let reply = parsed?.reply || '';
    let offline = false;
    if (ops.length === 0) {
      ops = fallbackParse(text, base.blocks, days);
      if (ops.length > 0) {
        reply = '';
        offline = parsed === null;
      }
    }
    if (ops.length === 0) {
      if (parsed === null) {
        replanFromText(text); // AI unavailable and no rule matched: old keyword re-plan
      } else {
        say(reply || L('Mình chưa thấy cần đổi gì. Thử: "Dời Toán tối thứ 3 sang sáng thứ 7".', 'Nothing to change yet. Try: "Move math from Tuesday evening to Saturday morning".'));
      }
      return;
    }

    const res = applyOps(base.blocks, ops, { days, busy: busySpans });
    const candidate = enforceLocks(lockedNow(base), res.blocks, { days, busy: busySpans });
    // Remember standing preferences so a later "Tạo lại" keeps them.
    const nextConstraints: PlannerConstraints = { ...constraints, blockedDays: [...constraints.blockedDays], notes: [...constraints.notes] };
    for (const op of ops) {
      if (op.op === 'no_mornings') nextConstraints.avoidMornings = true;
      else if (op.op === 'prefer_evenings') nextConstraints.preferEvenings = true;
      else if (op.op === 'more_breaks') nextConstraints.moreBreaks = true;
      else if (op.op === 'cap_session') nextConstraints.maxSessionMin = op.maxMinutes;
      else if (op.op === 'latest_end') nextConstraints.latestEndMin = op.minute;
      else if (op.op === 'clear_day' && !op.period && !nextConstraints.blockedDays.includes(op.dayISO)) nextConstraints.blockedDays.push(op.dayISO);
    }
    const lines = [
      offline ? L('(AI chưa sẵn sàng — mình hiểu theo từ khoá.)', '(AI unavailable — understood by keywords.)') : '',
      reply,
      ...res.applied,
      ...res.refused,
    ].filter(Boolean);
    offerOrApply(candidate, base.mode, nextConstraints, text, 'chat', lines.join('\n'));
  };

  /* ------------------------------ panels ------------------------------ */

  const diffLine = (d: PlanDiffEntry): string => {
    if (d.type === 'added' && d.after) return `+ ${describeBlock(d.after)}`;
    if (d.type === 'removed' && d.before) return `− ${describeBlock(d.before)}`;
    if (d.before && d.after) return `${describeBlock(d.before)} → ${weekdayVi(d.after.dayISO)} ${hhmm(d.after.startMin)}–${hhmm(d.after.endMin)}`;
    return '';
  };

  /** "AI muốn đổi N buổi" — nothing changes until the student taps Áp dụng. */
  const renderPending = (where: 'chat' | 'regen') => {
    if (!pending || pending.origin !== where || phase) return null;
    const n = pending.diff.length;
    return (
      <div
        role="region"
        aria-label={L('Thay đổi AI đề xuất', 'Changes the AI proposes')}
        className="rounded-2xl border-2 border-[#D97757]/60 bg-[#FDF5F1] p-4 dark:border-[#D97757]/50 dark:bg-[#2A1E19]"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-[#1A1917] dark:text-[#F5F2EA]">
          <GitCompare className="h-4 w-4 shrink-0 text-[#D97757]" aria-hidden="true" />
          {n === 0 ? L('Không có gì thay đổi', 'Nothing changes') : L(`AI muốn đổi ${n} buổi`, `AI wants to change ${n} session${n === 1 ? '' : 's'}`)}
        </p>
        {n > 0 && (
          <ul className="mt-2 space-y-1">
            {pending.diff.slice(0, 12).map((d, i) => (
              <li
                key={i}
                className={`break-words text-xs leading-relaxed ${
                  d.type === 'added'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : d.type === 'removed'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-[#3A3835] dark:text-[#D6D2C7]'
                }`}
              >
                {diffLine(d)}
              </li>
            ))}
            {n > 12 && <li className="text-xs text-[#6B6860] dark:text-[#A8A49A]">{L(`…và ${n - 12} thay đổi khác`, `…and ${n - 12} more`)}</li>}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
          {L('Buổi đã khoá luôn giữ nguyên. Lịch hiện tại được lưu vào Lịch sử trước khi đổi.', 'Locked sessions never move. Your current plan is saved to History first.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {n > 0 && (
            <button
              type="button"
              onClick={applyPending}
              className="rounded-xl bg-[#D97757] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C86646]"
            >
              {L('Áp dụng', 'Apply')}
            </button>
          )}
          <button
            type="button"
            onClick={discardPending}
            className="rounded-xl border border-[#DFDACB] bg-white px-4 py-2 text-xs font-bold text-[#6B6860] transition hover:border-[#D97757] dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#A8A49A]"
          >
            {n > 0 ? L('Giữ lịch cũ', 'Keep current plan') : L('Đóng', 'Close')}
          </button>
        </div>
      </div>
    );
  };

  /** Work with no readable deadline — listed, never scheduled on a guessed date. */
  const renderUndated = () => {
    if (undated.length === 0) return null;
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-card dark:border-amber-800 dark:bg-amber-950/30">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {L('Chưa có hạn nộp — AI không tự đặt hạn', 'No due date yet — the AI does not invent one')} ({undated.length})
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {L(
            'Hãy đặt ngày nộp trong Assignment Tracker để AI xếp lịch cho những bài này.',
            'Set the due date in Assignment Tracker so the AI can plan these.',
          )}
        </p>
        <ul className="mt-3 space-y-2">
          {undated.slice(0, 10).map((u) => {
            const meta = ORIGIN_META[u.origin];
            return (
              <li
                key={u.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-[#1F1E1B]"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>{meta.label}</span>
                    <span className="min-w-0 break-words text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">{u.title}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">{u.subject}</p>
                </div>
                {u.url && (
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#DFDACB] px-2 py-1 text-[11px] font-bold text-[#6B6860] transition hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#A8A49A]"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {L('Mở', 'Open')}
                  </a>
                )}
              </li>
            );
          })}
          {undated.length > 10 && (
            <li className="px-1 text-[11px] text-amber-800 dark:text-amber-200">{L(`…và ${undated.length - 10} bài khác`, `…and ${undated.length - 10} more`)}</li>
          )}
        </ul>
      </div>
    );
  };

  /** Saved versions, newest first. */
  const renderHistory = () => {
    if (history.length === 0) return null;
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[#DFDACB] bg-white shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917]">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between gap-2 p-5 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#1A1917] dark:text-[#F5F2EA]">
            <History className="h-4 w-4 shrink-0 text-[#D97757]" aria-hidden="true" />
            <span className="truncate">{L(`Lịch sử lịch học (${history.length})`, `Plan history (${history.length})`)}</span>
          </span>
          <ChevronRight className={`h-4 w-4 shrink-0 text-[#6B6860] transition-transform dark:text-[#A8A49A] ${showHistory ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>
        {showHistory && (
          <ul className="space-y-2 px-5 pb-5">
            {history.map((v) => {
              const sessions = v.blocks.filter((b) => b.kind !== 'break').length;
              const when = new Date(v.savedAt).toLocaleString(getLang() === 'vi' ? 'vi-VN' : 'en-US', {
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li
                  key={v.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[#DFDACB] bg-[#FAF9F5] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#2C2B27] dark:bg-[#1F1E1B]"
                >
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">
                      {L('Trước khi', 'Before')}: “{v.label}”
                    </p>
                    <p className="text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
                      {when} · {L(`${sessions} buổi`, `${sessions} session${sessions === 1 ? '' : 's'}`)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreVersion(v, L('Khôi phục', 'Restore'))}
                    disabled={phase !== null}
                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[#DFDACB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#6B6860] transition hover:border-[#D97757] hover:text-[#D97757] disabled:opacity-50 dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#A8A49A]"
                  >
                    <Undo2 className="h-3 w-3" aria-hidden="true" />
                    {L('Quay lại bản này', 'Restore this version')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  /* ------------------------------ states ------------------------------ */

  if (tasks.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 overflow-x-hidden px-1">
        <div className="rounded-3xl border border-[#DFDACB] bg-white p-6 shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917] sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#1A1917] dark:text-[#F5F2EA]">AI Planner</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
                I turn your real assignments and Canvas deadlines into one exclusive 7-day timetable —
                no overlaps, urgent work first.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#DFDACB] px-4 py-10 text-center dark:border-[#2C2B27]">
            <ListPlus className="h-8 w-8 text-[#A8A49A]" aria-hidden="true" />
            <p className="mt-3 max-w-sm text-sm font-semibold text-[#1A1917] dark:text-[#F5F2EA]">
              {L('Chưa có bài nào có hạn nộp để xếp lịch', 'Nothing dated to plan yet')}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
              {L(
                'Thêm bài tập có ngày nộp trong Assignment Tracker hoặc đồng bộ Canvas — rồi quay lại, mình sẽ xếp cả tuần chỉ với một chạm.',
                'Add an assignment with a due date in Assignment Tracker, or sync Canvas — then come back and I will lay out your week in one tap.',
              )}
            </p>
          </div>
          {!hasMeetingFeed && (
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
              <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {L('Kết nối Google Calendar trong Cài đặt để lịch học tránh các cuộc họp.', 'Connect Google Calendar in Settings to include meetings around your study blocks.')}
            </p>
          )}
        </div>
        {renderUndated()}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 overflow-x-hidden px-1">
      {/* Header */}
      <div className="rounded-3xl border border-[#DFDACB] bg-white p-5 shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#1A1917] dark:text-[#F5F2EA]">AI Planner</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
                {L(`Lịch từng ngày từ ${tasks.length} bài có hạn nộp`, `Day-by-day plan from ${tasks.length} dated item${tasks.length === 1 ? '' : 's'}`)}
                {hasMeetingFeed ? L(` · tránh ${busySpans.length} lịch bận`, ` · working around ${busySpans.length} meeting${busySpans.length === 1 ? '' : 's'}`) : ''}
                {plan ? L(` · ${Math.round(totalStudyMin / 60)} giờ đã xếp`, ` · ${Math.round(totalStudyMin / 60)}h planned`) : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={undoLast}
                disabled={phase !== null}
                aria-label={L('Hoàn tác: quay lại bản lịch trước', 'Undo: go back to the previous plan')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DFDACB] bg-white px-3 py-2 text-xs font-bold text-[#6B6860] transition hover:border-[#D97757] hover:text-[#D97757] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#A8A49A]"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                {L('↶ Hoàn tác', '↶ Undo')}
              </button>
            )}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={phase !== null}
              aria-label={L('Tạo lại lịch học', 'Regenerate timetable')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D97757] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C86646] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              {phase ? L('Đang xếp…', 'Planning…') : L('Tạo lại', 'Regenerate')}
            </button>
          </div>
        </div>

        {plan && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                plan.mode === 'ai'
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {plan.mode === 'ai'
                ? L('Lịch do AI tinh chỉnh (Gemini → Groq)', 'AI-tuned plan (Gemini → Groq)')
                : L('Lịch offline — không cần khoá', 'Offline plan — no key needed')}
            </span>
            <span className="text-[#6B6860] dark:text-[#A8A49A]">
              {L('Cập nhật', 'Built')}{' '}
              {new Date(plan.generatedAt).toLocaleString(getLang() === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            {constraints.avoidMornings && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {L('Không học sáng', 'No mornings')}
              </span>
            )}
            {constraints.moreBreaks && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {L('Thêm giờ nghỉ', 'Extra breaks')}
              </span>
            )}
            {constraints.maxSessionMin && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {L(`Tối đa ${constraints.maxSessionMin} phút/buổi`, `Max ${constraints.maxSessionMin} min/session`)}
              </span>
            )}
            {constraints.latestEndMin && (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {L(`Xong trước ${hhmm(constraints.latestEndMin)}`, `Done by ${hhmm(constraints.latestEndMin)}`)}
              </span>
            )}
            {constraints.blockedDays.length > 0 && (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                {L(`Để trống ${constraints.blockedDays.length} ngày`, `${constraints.blockedDays.length} day${constraints.blockedDays.length === 1 ? '' : 's'} kept clear`)}
              </span>
            )}
          </div>
        )}

        {aiError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {aiError}
            </p>
          </div>
        )}
        {!hasMeetingFeed && tasks.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
            <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {L(
              'Kết nối Google Calendar trong Cài đặt — các buổi học sẽ tự tránh lịch họp.',
              'Connect Google Calendar in Settings to include meetings — study blocks will work around them automatically.',
            )}
          </p>
        )}
        {pending?.origin === 'regen' && <div className="mt-3">{renderPending('regen')}</div>}
      </div>

      {/* Loading skeleton */}
      {phase && (
        <div aria-busy="true" aria-label="Planning your week" className="rounded-3xl border border-[#DFDACB] bg-white p-5 shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917]">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1A1917] dark:text-[#F5F2EA]">
            <Loader2 className="h-4 w-4 animate-spin text-[#D97757]" aria-hidden="true" />
            {phase}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#DFDACB] p-3 dark:border-[#2C2B27]">
                <div className="h-3 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="mt-2 h-2 w-1/2 rounded bg-stone-100 dark:bg-stone-800" />
                <div className="mt-2 h-2 w-full rounded bg-stone-100 dark:bg-stone-800" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day focus — one roomy day at a time, times editable */}
      {plan && !phase && (() => {
        const dayBlocks = (blocksByDay[selectedDay] || []).filter((b) => b.kind !== 'break');
        const breaks = (blocksByDay[selectedDay] || []).filter((b) => b.kind === 'break');
        const meetingsToday = busyByDay[selectedDay] || [];
        const dayMin = dayBlocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);
        const isEmpty = dayBlocks.length === 0 && meetingsToday.length === 0;
        return (
          <div ref={planLiveRef} aria-live="polite" className="mx-auto w-full max-w-3xl space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Pick a day">
              {days.map((day) => {
                const n = (blocksByDay[day] || []).filter((b) => b.kind !== 'break').length;
                const active = day === selectedDay;
                const d = new Date(`${day}T12:00:00`);
                return (
                  <button
                    key={day}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedDay(day)}
                    className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 text-xs font-bold transition ${
                      active
                        ? 'border-[#D97757] bg-[#D97757] text-white shadow-sm'
                        : 'border-[#DFDACB] bg-white text-[#6B6860] hover:border-[#D97757]/50 dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#A8A49A]'
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      {shortWeekday(day)}
                    </span>
                    <span className="text-sm">{d.getDate()}</span>
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-[#D97757]/10 text-[#D97757]'}`}>
                      {n === 0 ? '·' : L(`${n} buổi`, `${n} block${n === 1 ? '' : 's'}`)}
                    </span>
                  </button>
                );
              })}
            </div>

            <section
              aria-label={dayLabel(selectedDay)}
              className="rounded-3xl border border-[#DFDACB] bg-white p-5 shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917]"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#1A1917] dark:text-[#F5F2EA]">{dayLabel(selectedDay)}</h3>
                  <p className="text-xs text-[#6B6860] dark:text-[#A8A49A]">
                    {dayBlocks.length === 0 && meetingsToday.length === 0
                      ? L('Chưa có lịch', 'Nothing scheduled')
                      : L(
                          `${dayBlocks.length} buổi học · ${Math.floor(dayMin / 60)} giờ ${dayMin % 60} phút`,
                          `${dayBlocks.length} study block${dayBlocks.length === 1 ? '' : 's'} · ${Math.floor(dayMin / 60)}h ${dayMin % 60}m`,
                        )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => stepDay(-1)} disabled={days.indexOf(selectedDay) === 0} aria-label="Previous day" className="rounded-xl border border-[#DFDACB] p-2 text-[#6B6860] transition hover:border-[#D97757] disabled:opacity-40 dark:border-[#2C2B27] dark:text-[#A8A49A]">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => stepDay(1)} disabled={days.indexOf(selectedDay) === days.length - 1} aria-label="Next day" className="rounded-xl border border-[#DFDACB] p-2 text-[#6B6860] transition hover:border-[#D97757] disabled:opacity-40 dark:border-[#2C2B27] dark:text-[#A8A49A]">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {meetingsToday.map((m, i) => (
                  <div
                    key={`m-${i}`}
                    className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40"
                  >
                    <p className="flex items-center gap-1.5 text-sm font-bold text-sky-800 dark:text-sky-200">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {fmtTime(m.startMin)} – {fmtTime(m.endMin)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-sky-900 dark:text-sky-100">{m.label}</p>
                    <p className="text-xs text-sky-600 dark:text-sky-400">{L('Bận — giữ trống', 'Busy — kept clear')}</p>
                  </div>
                ))}
                {dayBlocks.map((b) => {
                  const dur = b.endMin - b.startMin;
                  const s = inputToMin(editStart);
                  const e = inputToMin(editEnd);
                  const valid = editingId === b.id && s !== null && e !== null && e - s >= 15 && s >= 0 && e <= 1440;
                  const targetDay = editingId === b.id && editDay ? editDay : selectedDay;
                  const clash =
                    valid &&
                    ((blocksByDay[targetDay] || []).some(
                      (o) => o.id !== b.id && o.kind !== 'break' && (s as number) < o.endMin && o.startMin < (e as number),
                    ) ||
                      (busyByDay[targetDay] || []).some((o) => (s as number) < o.endMin && o.startMin < (e as number)));
                  return (
                    <article
                      key={b.id}
                      className={`rounded-2xl border p-4 ${b.tentative ? 'border-dashed border-2' : ''} ${
                        b.kind === 'review'
                          ? `${b.tentative ? 'border-amber-400 dark:border-amber-700' : 'border-emerald-200 dark:border-emerald-900'} bg-emerald-50 dark:bg-emerald-950/40`
                          : `${b.tentative ? 'border-amber-400 dark:border-amber-700' : 'border-violet-200 dark:border-violet-900'} bg-violet-50 dark:bg-violet-950/30`
                      } ${b.locked ? 'ring-2 ring-[#D97757]/40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-sm font-bold text-[#1A1917] dark:text-[#F5F2EA]">
                          {b.kind === 'review'
                            ? <BookOpen className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            : <CalendarCheck className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />}
                          {fmtTime(b.startMin)} – {fmtTime(b.endMin)}
                          <span className="text-xs font-semibold text-[#6B6860] dark:text-[#A8A49A]">({dur} min)</span>
                        </p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggleLock(b)}
                            aria-pressed={!!b.locked}
                            aria-label={b.locked ? L(`Mở khoá ${b.title}`, `Unlock ${b.title}`) : L(`Khoá ${b.title}`, `Lock ${b.title}`)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                              b.locked
                                ? 'border-[#D97757] bg-[#D97757] text-white hover:bg-[#C86646]'
                                : 'border-[#DFDACB] text-[#6B6860] hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#A8A49A]'
                            }`}
                          >
                            {b.locked ? <LockOpen className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
                            {b.locked ? L('Mở khoá', 'Unlock') : L('Khoá', 'Lock')}
                          </button>
                          {editingId !== b.id && (
                            <button
                              type="button"
                              onClick={() => beginEdit(b)}
                              aria-label={L(`Đổi giờ ${b.title}`, `Change time for ${b.title}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#DFDACB] px-2 py-1 text-[11px] font-bold text-[#6B6860] transition hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#A8A49A]"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                              {L('Sửa giờ', 'Edit time')}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-sm font-bold leading-snug text-[#1A1917] dark:text-[#F5F2EA]">
                        {b.title}
                      </p>
                      <p className="text-xs font-medium text-[#6B6860] dark:text-[#A8A49A]">{b.subject}</p>
                      {(b.locked || b.tentative) && (
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                          {b.locked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#D97757]/15 px-2 py-0.5 text-[10px] font-bold text-[#B85C38] dark:text-[#F0A385]">
                              🔒 {L('Đã khoá — AI không dời', 'Locked — the AI will not move it')}
                            </span>
                          )}
                          {b.tentative && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                              {L('Hạn chưa xác nhận', 'Due date not confirmed')}
                            </span>
                          )}
                        </p>
                      )}
                      {b.manual && b.locked && (
                        <p className="mt-1 text-[11px] font-semibold text-[#B85C38] dark:text-[#F0A385]">
                          {L('Đã khoá vì bạn tự sửa — bấm Mở khoá để AI được dời', 'Locked because you edited it — tap Unlock to let the AI move it')}
                        </p>
                      )}
                      <p className="mt-1 text-xs italic leading-snug text-[#6B6860] dark:text-[#A8A49A]">
                        {b.reason}
                      </p>
                      {editingId === b.id && (
                        <div className="mt-3 rounded-xl border border-[#DFDACB] bg-white p-3 dark:border-[#2C2B27] dark:bg-[#1F1E1B]">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor={`day-${b.id}`}>{L('Ngày', 'Day')}</label>
                            <select
                              id={`day-${b.id}`}
                              value={editDay}
                              onChange={(ev) => setEditDay(ev.target.value)}
                              className="rounded-lg border border-[#DFDACB] bg-white px-2 py-1.5 text-xs font-bold text-[#1A1917] dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#F5F2EA]"
                            >
                              {days.map((d) => (
                                <option key={d} value={d}>
                                  {dayLabel(d)}
                                </option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`start-${b.id}`}>{L('Giờ bắt đầu', 'Start time')}</label>
                            <input
                              id={`start-${b.id}`}
                              type="time"
                              value={editStart}
                              onChange={(ev) => setEditStart(ev.target.value)}
                              className="rounded-lg border border-[#DFDACB] bg-white px-2 py-1.5 text-xs font-bold text-[#1A1917] dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#F5F2EA]"
                            />
                            <span className="text-xs font-bold text-[#6B6860] dark:text-[#A8A49A]">–</span>
                            <label className="sr-only" htmlFor={`end-${b.id}`}>{L('Giờ kết thúc', 'End time')}</label>
                            <input
                              id={`end-${b.id}`}
                              type="time"
                              value={editEnd}
                              onChange={(ev) => setEditEnd(ev.target.value)}
                              className="rounded-lg border border-[#DFDACB] bg-white px-2 py-1.5 text-xs font-bold text-[#1A1917] dark:border-[#2C2B27] dark:bg-[#1A1917] dark:text-[#F5F2EA]"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit(b)}
                              disabled={!valid}
                              className="rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#B85C38] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {L('Lưu', 'Save')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-[#DFDACB] px-3 py-1.5 text-xs font-bold text-[#6B6860] dark:border-[#2C2B27] dark:text-[#A8A49A]"
                            >
                              {L('Huỷ', 'Cancel')}
                            </button>
                          </div>
                          {!valid && (
                            <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              {L('Mỗi buổi cần ít nhất 15 phút, trong khoảng 00:00 đến 24:00.', 'Sessions need at least 15 minutes between 12:00 AM and midnight.')}
                            </p>
                          )}
                          {valid && clash && (
                            <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              {L('Lưu ý — giờ này trùng với buổi khác hoặc lịch bận vào', 'Heads up — this overlaps another block on')} {dayLabel(targetDay).split('·')[0].trim()}.
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
                            {L('Lưu xong buổi này sẽ được khoá để AI không dời.', 'Saving locks this session so the AI will not move it.')}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
                {breaks.length > 0 && (
                  <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-[#6B6860] dark:text-[#A8A49A]">
                    <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {L(`${breaks.length} quãng nghỉ ngắn xen giữa`, `${breaks.length} breather${breaks.length === 1 ? '' : 's'} tucked in`)}
                  </p>
                )}
                {isEmpty && (
                  <p className="rounded-2xl border border-dashed border-[#DFDACB] p-6 text-center text-xs text-[#A8A49A] dark:border-[#2C2B27]">
                    {L(
                      'Ngày trống — chưa có lịch. Chọn ngày khác ở trên, hoặc bấm "Sửa giờ" ở một buổi và chọn ngày này để dời sang.',
                      "Open day — nothing scheduled. Pick another day above, or edit any block and choose this day to move it here.",
                    )}
                  </p>
                )}
              </div>
            </section>
          </div>
        );
      })()}

      {/* Connected resources — the todo lists behind this plan, no tab-hopping */}
      {plan && !phase && (
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[#DFDACB] bg-white shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917]">
          <button
            type="button"
            onClick={() => setShowSources((v) => !v)}
            aria-expanded={showSources}
            className="flex w-full items-center justify-between gap-2 p-5 text-left"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#1A1917] dark:text-[#F5F2EA]">
              <ListTodo className="h-4 w-4 shrink-0 text-[#D97757]" aria-hidden="true" />
              <span className="truncate">{L(`Xếp từ — ${tasks.length} mục đã kết nối`, `Planned from — ${tasks.length} connected item${tasks.length === 1 ? '' : 's'}`)}</span>
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 text-[#6B6860] transition-transform dark:text-[#A8A49A] ${showSources ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>
          {showSources && (
            <ul className="space-y-2 px-5 pb-5">
              {tasks.map((t) => {
                const placed = placedByKey[t.key] || 0;
                const meta = ORIGIN_META[t.origin];
                return (
                  <li
                    key={t.key}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[#DFDACB] bg-[#FAF9F5] p-3 dark:border-[#2C2B27] dark:bg-[#1F1E1B]"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>{meta.label}</span>
                        <span className="min-w-0 break-words text-xs font-bold text-[#1A1917] dark:text-[#F5F2EA]">{t.title}</span>
                        {t.tentative && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {L('Hạn chưa xác nhận', 'Due date not confirmed')}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-[#6B6860] dark:text-[#A8A49A]">
                        {t.subject} · {dueNote(t.dueISO)} · ~{t.minutes} {L('phút', 'min')}
                      </p>
                      <p className={`mt-0.5 text-[11px] font-semibold ${placed > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {placed > 0
                          ? L(`${placed} buổi trong lịch này`, `${placed} session${placed === 1 ? '' : 's'} in this plan`)
                          : L('Chưa xếp được — tuần này hết chỗ trống', 'Not placed — no free slot this week')}
                      </p>
                    </div>
                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#DFDACB] px-2 py-1 text-[11px] font-bold text-[#6B6860] transition hover:border-[#D97757] hover:text-[#D97757] dark:border-[#2C2B27] dark:text-[#A8A49A]"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        {L('Mở', 'Open')}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {renderUndated()}
      {renderHistory()}

      {/* Chat re-plan */}
      <div className="rounded-3xl border border-[#DFDACB] bg-white p-5 shadow-card dark:border-[#2C2B27] dark:bg-[#1A1917] sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#1A1917] dark:text-[#F5F2EA]">
          <MessageSquareText className="h-4 w-4 text-[#D97757]" aria-hidden="true" />
          {L('Đổi lịch bằng lời nói', 'Reschedule in plain words')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#6B6860] dark:text-[#A8A49A]">
          {L(
            'Thử: “Dời Toán tối thứ 3 sang sáng thứ 7”, “Tuần này em bận tối thứ 5”, “Mỗi buổi tối đa 45 phút”. AI chỉ đổi đúng buổi bạn nhắc, bạn xem trước rồi mới áp dụng.',
            'Try “Dời Toán tối thứ 3 sang sáng thứ 7”, “Tuần này em bận tối thứ 5”, “Mỗi buổi tối đa 45 phút” — or English like “keep Friday clear”. Only what you ask changes, and you review it first.',
          )}
        </p>
        <div aria-live="polite" className="mt-3 space-y-2">
          {chat.length === 0 && (
            <p className="rounded-2xl bg-[#FAF9F5] p-3 text-xs text-[#6B6860] dark:bg-[#1F1E1B] dark:text-[#A8A49A]">
              {L(
                'Chưa có yêu cầu đổi lịch — lịch mới nhất ở phía trên. Nói cho mình biết điều gì thay đổi, mình sẽ chỉ dời đúng những buổi cần dời.',
                'No reschedule notes yet — your latest plan is shown above. Tell me what changed and I will move only the sessions that need it.',
              )}
            </p>
          )}
          {chat.slice(-10).map((m, i) => (
            <div
              key={i}
              className={`max-w-full whitespace-pre-line break-words rounded-2xl p-3 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto w-fit max-w-[90%] bg-[#D97757] font-medium text-white'
                  : 'mr-auto w-fit max-w-[90%] border border-[#DFDACB] bg-[#FAF9F5] text-[#3A3835] dark:border-[#2C2B27] dark:bg-[#1F1E1B] dark:text-[#D6D2C7]'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        {pending?.origin === 'chat' && <div className="mt-3">{renderPending('chat')}</div>}
        <form onSubmit={handleChatSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="ai-planner-chat" className="sr-only">
            {L('Mô tả thay đổi lịch', 'Describe a schedule change')}
          </label>
          <input
            id="ai-planner-chat"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={L('VD: Dời Toán tối thứ 3 sang sáng thứ 7', 'e.g. Move math from Tuesday evening to Saturday morning')}
            autoComplete="off"
            disabled={phase !== null}
            className="min-w-0 flex-1 rounded-xl border border-[#DFDACB] bg-white px-3 py-2.5 text-sm text-[#1A1917] outline-none placeholder:text-[#A8A49A] focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/30 dark:border-[#2C2B27] dark:bg-[#1F1E1B] dark:text-[#F5F2EA]"
          />
          <button
            type="submit"
            disabled={phase !== null || !draft.trim()}
            aria-label={L('Gửi yêu cầu đổi lịch', 'Send reschedule request')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1A1917] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#F5F2EA] dark:text-[#1A1917]"
          >
            {phase ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {L('Đổi lịch', 'Re-plan')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPlannerWorkspace;
