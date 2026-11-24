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
import { formatDate as formatI18nDate, getLang, t as tr, useT } from '../../services/i18n';
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
  weekdayLabel,
  weekdayVi,
  type BusyLite,
  type PlanBlockLite,
  type PlanDiffEntry,
  type PlanOp,
} from '../../services/planCommands';

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
  return formatI18nDate(new Date(`${iso}T12:00:00`), { weekday: 'short' });
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
  const weekday = formatI18nDate(d, { weekday: 'short' });
  const md = formatI18nDate(d, { month: 'short', day: 'numeric' });
  if (iso === today) return tr('plan_today_label', { date: md });
  if (iso === tomorrow) return tr('plan_tomorrow_label', { date: md });
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
  origin: 'assignment' | 'canvas' | 'classroom' | 'gmail';
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
      undated.push({ key: `a-${a.id}`, title: a.assignmentName || tr('plan_untitled_assignment'), subject: a.subject || tr('plan_general_subject'), origin: 'assignment', url });
      continue;
    }
    const subMin = Array.isArray(a.subtasks)
      ? a.subtasks.reduce((s, st: any) => s + (Number(st?.estimatedMinutes) || 0), 0)
      : 0;
    out.push({
      key: `a-${a.id}`,
      title: a.assignmentName || tr('plan_untitled_assignment'),
      subject: a.subject || tr('plan_general_subject'),
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
      title: c.name || tr('plan_untitled_item'),
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
        label: m.summary || tr('plan_meeting_fallback'),
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
      spans.push({ dayISO, startMin: h * 60, endMin: Math.min(1440, h * 60 + 60), label: String(r?.title || tr('plan_class_fallback')) });
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
                title: tr('pc_break_title'),
                subject: tr('pc_break_subject'),
                dayISO,
                startMin: bs,
                endMin: be,
                reason: tr('plan_breather_reason'),
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
          ? tr('plan_reason_high', { date: task.dueISO })
          : left <= 1
            ? tr(left <= 0 ? 'plan_reason_due_today' : 'plan_reason_due_tomorrow')
            : tr(leftForDay === 1 ? 'plan_reason_due_in_one' : 'plan_reason_due_in_other', {
                date: task.dueISO,
                days: leftForDay,
              });
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
        subject: String(b?.subject || tr('plan_study_fallback')).slice(0, 40),
        dayISO,
        startMin: Math.max(0, Math.min(1439, Math.round(s))),
        endMin: Math.max(1, Math.min(1440, Math.round(e))),
        reason: String(b?.reason || tr('plan_ai_reason_fallback')).slice(0, 140),
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
      changes.push(tr('plan_c_avoid_mornings'));
    }
  }
  if (/(evening|night)/.test(lower) && /(prefer|after|pm)/.test(lower)) {
    if (!next.preferEvenings) {
      next.preferEvenings = true;
      changes.push(tr('plan_c_prefer_evenings'));
    }
  }
  if (/more\s+breaks?/.test(lower) || /burn(ed|t)?\s*out/.test(lower) || /shorter\s+sessions?/.test(lower)) {
    if (!next.moreBreaks) {
      next.moreBreaks = true;
      changes.push(tr('plan_c_more_breaks'));
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
      changes.push(tr('plan_c_day_clear', { day: weekdayLabel(match, getLang()), date: match }));
    }
  });
  if (changes.length === 0) {
    const snippet = text.trim().slice(0, 60);
    next.notes.push(snippet);
    changes.push(tr('plan_c_noted', { snippet }));
  }
  return { next, changes };
}

/* ------------------------------------------------------------------ */
/* Origin badges for the in-panel resource list                       */
/* ------------------------------------------------------------------ */

const ORIGIN_META: Record<DatedTask['origin'], { labelKey: string; chip: string }> = {
  assignment: { labelKey: 'plan_origin_tracker', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  canvas: { labelKey: 'plan_origin_canvas', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  classroom: { labelKey: 'plan_origin_classroom', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  gmail: { labelKey: 'plan_origin_gmail', chip: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]' },
};

function dueNote(dueISO: string): string {
  const left = daysUntil(dueISO);
  if (left < 0) return tr('plan_due_overdue', { date: dueISO });
  if (left === 0) return tr('plan_due_today');
  if (left === 1) return tr('plan_due_tomorrow');
  return tr('plan_due_left', { date: dueISO, days: left });
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
  const { lang, t, formatDate, formatTime } = useT();
  const [demoActive, setDemoActive] = useState(false);
  const days = useMemo(() => next7Days(), []);
  const harvested = useMemo(() => {
    const effectiveAssignments = demoActive && (!assignments || assignments.length === 0)
      ? [
          { id: 'demo-p1', subject: 'Toán', assignmentName: 'Ôn tập phương trình bậc hai', dueDate: days[3], priority: 'High' as const, status: 'Not Started' as const, estimatedMinutes: 90 },
          { id: 'demo-p2', subject: 'Hoá học', assignmentName: 'Bài tập phản ứng oxi hoá', dueDate: days[4], priority: 'Med' as const, status: 'Not Started' as const, estimatedMinutes: 60 },
          { id: 'demo-p3', subject: 'Tiếng Anh', assignmentName: 'Writing Essay Draft', dueDate: days[5], priority: 'Low' as const, status: 'Not Started' as const, estimatedMinutes: 60 },
        ]
      : assignments || [];
    return harvestTasks(effectiveAssignments, canvasAssignments || [], classroomAssignments, emailAlerts);
  }, [demoActive, assignments, canvasAssignments, classroomAssignments, emailAlerts, days, lang]);
  const tasks = harvested.tasks;
  const undated = harvested.undated;
  const busySpans = useMemo(
    () => [...meetingsToBusy(meetings), ...timetableToBusy(days)],
    [meetings, days, lang],
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
      const label = opts?.label || t('plan_regen');
      try {
        setPhase(t(tasks.length === 1 ? 'plan_phase_scanning_one' : 'plan_phase_scanning_other', { count: tasks.length }));
        await delay(380);
        if (ctrl.signal.aborted) return;
        setPhase(
          hasMeetingFeed
            ? t(busySpans.length === 1 ? 'plan_phase_blocking_one' : 'plan_phase_blocking_other', { count: busySpans.length })
            : t('plan_phase_checking_week'),
        );
        await delay(340);
        if (ctrl.signal.aborted) return;

        setPhase(t('plan_phase_asking_ai'));
        await delay(300);
        if (ctrl.signal.aborted) return;

        // Locked blocks are fixed: busy for the local planner, FIXED for the AI, then enforced again.
        const fixed = lockedNow(planRef.current);
        const local = buildLocalPlan(tasks, busySpans, days, active, fixed);
        let blocks = local;
        let mode: 'ai' | 'local' = 'local';
        {
          setPhase(t('plan_phase_refining'));
          const ai = await tryGeminiPlan(tasks, days, active, ctrl.signal, fixed, busySpans);
          if (ai && ai.length > 0) {
            blocks = ai;
            mode = 'ai';
          } else {
            setAiError(t('plan_ai_fallback_warn'));
          }
        }
        blocks = enforceLocks(fixed, blocks, { days, busy: busySpans });
        if (ctrl.signal.aborted) return;
        setPhase(t('plan_phase_exclusive'));
        await delay(280);
        if (ctrl.signal.aborted) return;

        offerOrApply(blocks, mode, active, label, origin, announcement);
      } finally {
        if (!ctrl.signal.aborted) setPhase(null);
      }
    },
    [tasks, busySpans, days, hasMeetingFeed, lockedNow, offerOrApply, t],
  );

  const applyPending = () => {
    if (!pending) return;
    commitPlan({ blocks: pending.blocks, generatedAt: new Date().toISOString(), mode: pending.mode, constraints: pending.constraints }, pending.label);
    setConstraints(pending.constraints);
    setPending(null);
    say(t('plan_applied_msg'));
  };

  const discardPending = () => {
    if (!pending) return;
    const hadChanges = pending.diff.length > 0;
    setPending(null);
    if (hadChanges) say(t('plan_kept_old_msg'));
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
    say(t('plan_restored_from', { time: formatTime(new Date(v.savedAt), { hour: '2-digit', minute: '2-digit' }) }));
  };

  const undoLast = () => {
    if (history.length > 0) restoreVersion(history[0], t('plan_undo_label'));
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

  const handleRegenerate = () => void runPlanning(constraints, undefined, { label: t('plan_regen'), origin: 'regen' });

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
    commitPlan({ ...current, blocks }, t('plan_manual_edit'));
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

    setPhase(t('plan_phase_reading_req'));
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
      say(parsed.question || t('plan_clarify_fallback'));
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
        say(reply || t('plan_no_change_hint'));
      }
      return;
    }

    const res = applyOps(base.blocks, ops, { days, busy: busySpans, lang });
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
      offline ? t('plan_offline_keywords') : '',
      reply,
      ...res.applied,
      ...res.refused,
    ].filter(Boolean);
    offerOrApply(candidate, base.mode, nextConstraints, text, 'chat', lines.join('\n'));
  };

  /* ------------------------------ panels ------------------------------ */

  const diffLine = (d: PlanDiffEntry): string => {
    if (d.type === 'added' && d.after) return `+ ${describeBlock(d.after, lang)}`;
    if (d.type === 'removed' && d.before) return `− ${describeBlock(d.before, lang)}`;
    if (d.before && d.after) return `${describeBlock(d.before, lang)} → ${weekdayLabel(d.after.dayISO, lang)} ${hhmm(d.after.startMin)}–${hhmm(d.after.endMin)}`;
    return '';
  };

  /** "AI muốn đổi N buổi" — side-by-side Before/After comparison; nothing changes until the student taps Áp dụng. */
  const renderPending = (where: 'chat' | 'regen') => {
    if (!pending || pending.origin !== where || phase) return null;
    const n = pending.diff.length;
    const lockedBlocks = (plan?.blocks || []).filter((b) => b.locked && b.kind !== 'break');
    const lockedCount = lockedBlocks.length;
    return (
      <div
        role="region"
        aria-label={t('plan_pending_aria')}
        className="rounded-2xl border-2 border-[var(--accent-border)] bg-[var(--accent-soft)]/85 p-3.5 sm:p-4 shadow-sm space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--text-primary)]">
            <GitCompare className="h-4 w-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
            {n === 0 ? t('plan_pending_none') : t(n === 1 ? 'plan_pending_one' : 'plan_pending_other', { count: n })}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {lockedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-2-soft,var(--bg-surface))] px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent-2-text,var(--accent-text))] border border-[var(--accent-2-border,var(--accent-border))]">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t('plan_locked_kept', { count: lockedCount })}
              </span>
            )}
          </div>
        </div>

        {(n > 0 || lockedCount > 0) && (
          <div className="max-h-[210px] overflow-y-auto space-y-1.5 pr-1">
            {n > 0 && (
              <div className="hidden sm:grid sm:grid-cols-2 gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>{t('plan_diff_before_col')}</span>
                <span>{t('plan_diff_after_col')}</span>
              </div>
            )}
            {pending.diff.slice(0, 12).map((d, i) => (
              <div
                key={i}
                className="rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-hairline)] px-3 py-2 text-xs leading-relaxed"
              >
                {d.type === 'moved' && d.before && d.after ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 items-center">
                    <div className="text-[var(--text-muted)] line-through decoration-rose-400/70">
                      <span className="inline-block sm:hidden font-semibold no-underline mr-1">{t('plan_before_label')}:</span>
                      {describeBlock(d.before, lang)}
                    </div>
                    <div className="text-[var(--text-primary)] font-semibold flex items-center gap-1.5">
                      <span className="text-[var(--accent-text)] font-bold shrink-0">→</span>
                      <span>
                        {weekdayLabel(d.after.dayISO, lang)} {hhmm(d.after.startMin)}–{hhmm(d.after.endMin)} · {d.after.title}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span
                    className={`break-words font-medium ${
                      d.type === 'added'
                        ? 'text-[var(--status-ok-text)]'
                        : d.type === 'removed'
                          ? 'text-[var(--status-err-text)]'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {diffLine(d)}
                  </span>
                )}
              </div>
            ))}
            {lockedBlocks.slice(0, 4).map((lb) => (
              <div
                key={`locked-${lb.id}`}
                className="rounded-xl bg-[var(--accent-2-soft,var(--bg-surface))]/60 border border-[var(--accent-2-border,var(--border-default))] px-3 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-[var(--accent-2-text,var(--accent-text))]" aria-hidden="true" />
                  <span>{describeBlock(lb, lang)}</span>
                </span>
                <span className="text-[10px] font-bold text-[var(--accent-2-text,var(--accent-text))]">
                  {t('plan_diff_locked_kept')}
                </span>
              </div>
            ))}
            {n > 12 && <p className="text-xs text-[var(--text-muted)] px-1">{t('plan_more_count', { count: n - 12 })}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-[var(--text-muted)]">
            {t('plan_pending_note')}
          </p>
          <div className="flex flex-wrap gap-2">
            {n > 0 && (
              <button
                type="button"
                onClick={applyPending}
                className="rounded-xl bg-[var(--accent-fill)] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] cursor-pointer shadow-xs"
              >
                {t('plan_apply_btn')}
              </button>
            )}
            <button
              type="button"
              onClick={discardPending}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              {n > 0 ? t('plan_keep_current_btn') : t('close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /** Work with no readable deadline — listed, never scheduled on a guessed date. */
  const renderUndated = () => {
    if (undated.length === 0) return null;
    return (
      <div className="w-full rounded-2xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-4 shadow-xs">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--status-warn-text)]">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('plan_undated_title')} ({undated.length})
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--status-warn-text)]">
          {t('plan_undated_sub')}
        </p>
        <ul className="mt-3 space-y-2">
          {undated.slice(0, 10).map((u) => {
            const meta = ORIGIN_META[u.origin];
            return (
              <li
                key={u.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>{t(meta.labelKey)}</span>
                    <span className="min-w-0 break-words text-xs font-bold text-[var(--text-primary)]">{u.title}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{u.subject}</p>
                </div>
                {u.url && (
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-text)]  "
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {t('common_open')}
                  </a>
                )}
              </li>
            );
          })}
          {undated.length > 10 && (
            <li className="px-1 text-[11px] text-[var(--status-warn-text)]">{t('plan_more_items', { count: undated.length - 10 })}</li>
          )}
        </ul>
      </div>
    );
  };

  /** Saved versions, newest first. */
  const renderHistory = () => {
    if (history.length === 0) return null;
    return (
      <div className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between gap-2 p-5 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <History className="h-4 w-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
            <span className="truncate">{t('plan_history_title', { count: history.length })}</span>
          </span>
          <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform  ${showHistory ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>
        {showHistory && (
          <ul className="space-y-2 px-5 pb-5">
            {history.map((v) => {
              const sessions = v.blocks.filter((b) => b.kind !== 'break').length;
              const when = formatDate(new Date(v.savedAt), {
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li
                  key={v.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold text-[var(--text-primary)]">
                      {t('plan_history_before')}: “{v.label}”
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {when} · {t(sessions === 1 ? 'plan_session_one' : 'plan_session_other', { count: sessions })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreVersion(v, t('plan_restore_label'))}
                    disabled={phase !== null}
                    className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] disabled:opacity-50   "
                  >
                    <Undo2 className="h-3 w-3" aria-hidden="true" />
                    {t('plan_restore_btn')}
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
      <div className="flex-1 min-h-0 overflow-y-auto px-1">
        <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-2-fill,var(--accent-fill))] text-white shadow-sm">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{t('plan_title')}</h2>
              <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-[var(--text-muted)]">
                {t('plan_empty_intro')}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-8 text-center ">
            <ListPlus className="h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-2.5 max-w-sm text-sm font-semibold text-[var(--text-primary)]">
              {t('plan_nothing_dated_t')}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
              {t('plan_nothing_dated_s')}
            </p>
            <button
              type="button"
              onClick={() => setDemoActive(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('plan_demo_btn')}</span>
            </button>
          </div>
          {!hasMeetingFeed && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
              <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('plan_connect_gcal_empty')}
            </p>
          )}
        </div>
        {renderUndated()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* Compact Header Strip */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-xs shrink-0">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-2-fill,var(--accent-fill))] text-white shadow-xs">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">{t('plan_title')}</h2>
                {plan && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      plan.mode === 'ai'
                        ? 'bg-[var(--accent-2-soft)] text-[var(--accent-2-text)] border border-[var(--accent-2-border)]/50'
                        : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
                    }`}
                  >
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    {plan.mode === 'ai' ? t('plan_badge_ai') : t('plan_badge_offline')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {t(tasks.length === 1 ? 'plan_hdr_items_one' : 'plan_hdr_items_other', { count: tasks.length })}
                {hasMeetingFeed ? t(busySpans.length === 1 ? 'plan_hdr_busy_one' : 'plan_hdr_busy_other', { count: busySpans.length }) : ''}
                {plan ? t('plan_hdr_hours', { hours: Math.round(totalStudyMin / 60) }) : ''}
                {plan ? ` · ${t('plan_built_at')} ${formatDate(new Date(plan.generatedAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {demoActive && (
              <button
                type="button"
                onClick={() => setDemoActive(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent-text)] cursor-pointer"
              >
                {t('plan_demo_exit')}
              </button>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={undoLast}
                disabled={phase !== null}
                aria-label={t('plan_undo_aria')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('plan_undo_btn')}
              </button>
            )}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={phase !== null}
              aria-label={t('plan_regen_aria')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-fill)] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {phase ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              {phase ? t('plan_planning_btn') : t('plan_regen')}
            </button>
          </div>
        </div>

        {(constraints.avoidMornings || constraints.moreBreaks || constraints.maxSessionMin || constraints.latestEndMin || constraints.blockedDays.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            {constraints.avoidMornings && (
              <span className="rounded-full bg-[var(--status-warn-bg)] px-2 py-0.5 font-semibold text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                {t('plan_chip_no_mornings')}
              </span>
            )}
            {constraints.moreBreaks && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {t('plan_chip_extra_breaks')}
              </span>
            )}
            {constraints.maxSessionMin && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {t('plan_chip_max_min', { min: constraints.maxSessionMin })}
              </span>
            )}
            {constraints.latestEndMin && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {t('plan_chip_done_by', { time: fmtTime(constraints.latestEndMin) })}
              </span>
            )}
            {constraints.blockedDays.length > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                {t(constraints.blockedDays.length === 1 ? 'plan_chip_clear_one' : 'plan_chip_clear_other', {
                  count: constraints.blockedDays.length,
                })}
              </span>
            )}
          </div>
        )}

        {aiError && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-2.5 text-xs leading-relaxed text-[var(--status-warn-text)]"
          >
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              <KeyRound className="mr-1 inline h-3 w-3" aria-hidden="true" />
              {aiError}
            </p>
          </div>
        )}
        {!hasMeetingFeed && tasks.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <CalendarX2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('plan_connect_gcal_tip')}
          </p>
        )}
      </div>

      {/* Prominent Before/After Diff Preview when regenerating */}
      {pending?.origin === 'regen' && <div className="shrink-0">{renderPending('regen')}</div>}

      {/* Loading skeleton */}
      {phase && (
        <div aria-busy="true" aria-label={t('plan_busy_aria')} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs shrink-0">
          <p className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
            {phase}
          </p>
        </div>
      )}

      {/* Single-Page Split Grid: Left = 7-Day Plan, Right = Chat + Collapsible Sources/Undated/History */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Left: Day Focus */}
        <div className="lg:col-span-7 min-h-0 flex flex-col gap-2.5 overflow-hidden">
          {plan && !phase && (() => {
            const dayBlocks = (blocksByDay[selectedDay] || []).filter((b) => b.kind !== 'break');
            const breaks = (blocksByDay[selectedDay] || []).filter((b) => b.kind === 'break');
            const meetingsToday = busyByDay[selectedDay] || [];
            const dayMin = dayBlocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);
            const isEmpty = dayBlocks.length === 0 && meetingsToday.length === 0;
            return (
              <div ref={planLiveRef} aria-live="polite" className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0" role="tablist" aria-label={t('plan_pick_day_aria')}>
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
                        className={`flex min-w-[58px] flex-1 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          active
                            ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)] text-white shadow-xs'
                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                          {shortWeekday(day)}
                        </span>
                        <span className="text-xs sm:text-sm">{d.getDate()}</span>
                        <span className={`rounded-full px-1.5 text-[9px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'}`}>
                          {n === 0 ? '·' : t(n === 1 ? 'plan_block_one' : 'plan_block_other', { count: n })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <section
                  aria-label={dayLabel(selectedDay)}
                  className="flex-1 min-h-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)] shrink-0">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">{dayLabel(selectedDay)}</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {dayBlocks.length === 0 && meetingsToday.length === 0
                          ? t('plan_nothing_scheduled')
                          : t(dayBlocks.length === 1 ? 'plan_day_summary_one' : 'plan_day_summary_other', {
                              count: dayBlocks.length,
                              hours: Math.floor(dayMin / 60),
                              mins: dayMin % 60,
                            })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => stepDay(-1)} disabled={days.indexOf(selectedDay) === 0} aria-label={t('plan_prev_day_aria')} className="rounded-xl border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition hover:border-[var(--accent-border)] disabled:opacity-40 cursor-pointer">
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => stepDay(1)} disabled={days.indexOf(selectedDay) === days.length - 1} aria-label={t('plan_next_day_aria')} className="rounded-xl border border-[var(--border-default)] p-1.5 text-[var(--text-muted)] transition hover:border-[var(--accent-border)] disabled:opacity-40 cursor-pointer">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                    {meetingsToday.map((m, i) => (
                      <div
                        key={`m-${i}`}
                        className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-200">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {fmtTime(m.startMin)} – {fmtTime(m.endMin)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-sky-900 dark:text-sky-100">{m.label}</p>
                        <p className="text-[11px] text-sky-600 dark:text-sky-400">{t('plan_busy_kept_clear')}</p>
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
                          className={`rounded-xl border p-3.5 ${b.tentative ? 'border-dashed border-2' : ''} ${
                            b.kind === 'review'
                              ? `${b.tentative ? 'border-[var(--status-warn-border)]' : 'border-[var(--status-ok-border)]'} bg-[var(--status-ok-bg)]`
                              : `${b.tentative ? 'border-[var(--status-warn-border)]' : 'border-[var(--border-default)]'} bg-[var(--bg-subtle)]`
                          } ${b.locked ? 'ring-2 ring-[var(--accent-fill)]/40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                              {b.kind === 'review'
                                ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                : <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />}
                              {fmtTime(b.startMin)} – {fmtTime(b.endMin)}
                              <span className="text-xs font-semibold text-[var(--text-muted)]">{t('plan_min_short', { count: dur })}</span>
                            </p>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => toggleLock(b)}
                                aria-pressed={!!b.locked}
                                aria-label={b.locked ? t('plan_unlock_aria', { title: b.title }) : t('plan_lock_aria', { title: b.title })}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                                  b.locked
                                    ? 'border-[var(--accent-fill)] bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-hover)]'
                                    : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)]'
                                }`}
                              >
                                {b.locked ? <LockOpen className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
                                {b.locked ? t('plan_unlock_btn') : t('plan_lock_btn')}
                              </button>
                              {editingId !== b.id && (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(b)}
                                  aria-label={t('plan_edit_time_aria', { title: b.title })}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" aria-hidden="true" />
                                  {t('plan_edit_time_btn')}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm font-bold leading-snug text-[var(--text-primary)]">
                            {b.title}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--text-muted)]">{b.subject}</p>
                          {(b.locked || b.tentative) && (
                            <p className="mt-1 flex flex-wrap gap-1.5">
                              {b.locked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-2-soft,var(--accent-soft))] border border-[var(--accent-2-border,var(--accent-border))]/60 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-2-text,var(--accent-text))]">
                                  🔒 {t('plan_locked_badge')}
                                </span>
                              )}
                              {b.tentative && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-warn-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                                  <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                                  {t('plan_tentative_badge')}
                                </span>
                              )}
                            </p>
                          )}
                          {b.manual && b.locked && (
                            <p className="mt-1 text-[11px] font-semibold text-[var(--accent-text)]">
                              {t('plan_manual_locked_note')}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] italic leading-snug text-[var(--text-muted)]">
                            {b.reason}
                          </p>
                          {editingId === b.id && (
                            <div className="mt-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor={`day-${b.id}`}>{t('plan_field_day')}</label>
                                <select
                                  id={`day-${b.id}`}
                                  value={editDay}
                                  onChange={(ev) => setEditDay(ev.target.value)}
                                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
                                >
                                  {days.map((d) => (
                                    <option key={d} value={d}>
                                      {dayLabel(d)}
                                    </option>
                                  ))}
                                </select>
                                <label className="sr-only" htmlFor={`start-${b.id}`}>{t('plan_field_start')}</label>
                                <input
                                  id={`start-${b.id}`}
                                  type="time"
                                  value={editStart}
                                  onChange={(ev) => setEditStart(ev.target.value)}
                                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
                                />
                                <span className="text-xs font-bold text-[var(--text-muted)]">–</span>
                                <label className="sr-only" htmlFor={`end-${b.id}`}>{t('plan_field_end')}</label>
                                <input
                                  id={`end-${b.id}`}
                                  type="time"
                                  value={editEnd}
                                  onChange={(ev) => setEditEnd(ev.target.value)}
                                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveEdit(b)}
                                  disabled={!valid}
                                  className="rounded-lg bg-[var(--accent-fill)] px-3 py-1 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {t('common_save')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded-lg border border-[var(--border-default)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]"
                                >
                                  {t('cancel')}
                                </button>
                              </div>
                              {!valid && (
                                <p className="mt-1.5 text-[11px] font-semibold text-[var(--status-warn-text)]">
                                  {t('plan_edit_invalid')}
                                </p>
                              )}
                              {valid && clash && (
                                <p className="mt-1.5 text-[11px] font-semibold text-[var(--status-warn-text)]">
                                  {t('plan_edit_clash', { day: dayLabel(targetDay).split('·')[0].trim() })}.
                                </p>
                              )}
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                {t('plan_edit_locks_note')}
                              </p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {breaks.length > 0 && (
                      <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-[var(--text-muted)]">
                        <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {t(breaks.length === 1 ? 'plan_breather_one' : 'plan_breather_other', { count: breaks.length })}
                      </p>
                    )}
                    {isEmpty && (
                      <p className="rounded-2xl border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-muted)] ">
                        {t('plan_open_day')}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            );
          })()}
        </div>

        {/* Right: Chat Re-plan + Collapsible Sources/Undated/History */}
        <div className="lg:col-span-5 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Chat re-plan */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs flex flex-col gap-2.5 shrink-0">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                <MessageSquareText className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
                {t('plan_chat_title')}
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                {t('plan_chat_sub')}
              </p>
            </div>
            <div aria-live="polite" className="max-h-44 overflow-y-auto space-y-2 pr-1">
              {chat.length === 0 && (
                <p className="rounded-xl bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--text-muted)]">
                  {t('plan_chat_empty')}
                </p>
              )}
              {chat.slice(-10).map((m, i) => (
                <div
                  key={i}
                  className={`max-w-full whitespace-pre-line break-words rounded-xl p-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-auto w-fit max-w-[90%] bg-[var(--accent-fill)] font-medium text-white'
                      : 'mr-auto w-fit max-w-[90%] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            {pending?.origin === 'chat' && <div>{renderPending('chat')}</div>}
            <form onSubmit={handleChatSubmit} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="ai-planner-chat" className="sr-only">
                {t('plan_chat_input_label')}
              </label>
              <input
                id="ai-planner-chat"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('plan_chat_ph')}
                autoComplete="off"
                disabled={phase !== null}
                className="min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/30"
              />
              <button
                type="submit"
                disabled={phase !== null || !draft.trim()}
                aria-label={t('plan_chat_send_aria')}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3.5 py-2 text-xs font-bold text-[var(--bg-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {phase ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                {t('plan_chat_send_btn')}
              </button>
            </form>
          </div>

          {/* Connected resources */}
          {plan && !phase && (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs shrink-0">
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                aria-expanded={showSources}
                className="flex w-full items-center justify-between gap-2 p-4 text-left cursor-pointer"
              >
                <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                  <ListTodo className="h-4 w-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                  <span className="truncate">{t(tasks.length === 1 ? 'plan_from_items_one' : 'plan_from_items_other', { count: tasks.length })}</span>
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${showSources ? 'rotate-90' : ''}`} aria-hidden="true" />
              </button>
              {showSources && (
                <ul className="space-y-2 px-4 pb-4 max-h-60 overflow-y-auto">
                  {tasks.map((item) => {
                    const placed = placedByKey[item.key] || 0;
                    const meta = ORIGIN_META[item.origin];
                    return (
                      <li
                        key={item.key}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>{t(meta.labelKey)}</span>
                            <span className="min-w-0 break-words text-xs font-bold text-[var(--text-primary)]">{item.title}</span>
                            {item.tentative && (
                              <span className="rounded-full bg-[var(--status-warn-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                                {t('plan_tentative_badge')}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {item.subject} · {dueNote(item.dueISO)} · ~{item.minutes} {t('plan_min_unit')}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-semibold ${placed > 0 ? 'text-[var(--status-ok-text)]' : 'text-[var(--status-warn-text)]'}`}>
                            {placed > 0
                              ? t(placed === 1 ? 'plan_placed_one' : 'plan_placed_other', { count: placed })
                              : t('plan_not_placed')}
                          </p>
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] transition hover:border-[var(--accent-border)] hover:text-[var(--accent-text)]"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            {t('common_open')}
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
        </div>
      </div>
    </div>
  );
};

export default AIPlannerWorkspace;
