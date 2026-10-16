import type { Assignment } from '../types';

/**
 * Pilot measurement (judges: "thử nghiệm 2-3 tuần … xem số lần quên hạn nộp có giảm không").
 * Counters only — no names, no email text, no subjects — kept on this device and exported
 * by the student when the pilot team asks.
 */

const EVENTS_KEY = 'scc_pilot_events_v1';
const MISSED_KEY = 'scc_pilot_missed_v1';

export type PilotEvent =
  | 'ai_confirmed' // saved exactly what the AI understood
  | 'ai_edited' // saved after fixing a field
  | 'ai_later' // saved, date left unconfirmed
  | 'ai_rejected' // "not an assignment"
  | 'ai_no_date' // saved without a date because the AI found none
  | 'review_dismissed'
  | 'review_force_read'
  | 'teacher_marked'
  | 'due_confirmed';

/** ISO week label like 2026-W42 (weeks start Monday). */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked — the pilot simply has no data from this device */
  }
}

export function logPilot(event: PilotEvent, when = new Date()) {
  const all = read<Record<string, Record<string, number>>>(EVENTS_KEY, {});
  const wk = isoWeek(when);
  all[wk] = all[wk] || {};
  all[wk][event] = (all[wk][event] || 0) + 1;
  write(EVENTS_KEY, all);
}

/** Remember every assignment whose due date passed while it was not done (counted once). */
export function recordMissedDeadlines(assignments: Assignment[], now = new Date()) {
  const missed = read<Record<string, string>>(MISSED_KEY, {});
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let changed = false;
  for (const a of assignments || []) {
    if (!a || a.trashedAt || a.status === 'Done' || !/^\d{4}-\d{2}-\d{2}/.test(a.dueDate || '')) continue;
    const due = a.dueDate.slice(0, 10);
    if (due < today && !missed[a.id]) {
      missed[a.id] = due;
      changed = true;
    }
  }
  if (changed) write(MISSED_KEY, missed);
}

export interface PilotExport {
  exportedAt: string;
  device: string;
  weeks: Record<string, Record<string, number>>;
}

/** Weekly counters + missed deadlines per due week, anonymous. */
export function buildPilotExport(): PilotExport {
  const weeks = read<Record<string, Record<string, number>>>(EVENTS_KEY, {});
  const missed = read<Record<string, string>>(MISSED_KEY, {});
  for (const due of Object.values(missed)) {
    const wk = isoWeek(new Date(`${due}T12:00:00`));
    weeks[wk] = weeks[wk] || {};
    weeks[wk].missed_deadlines = (weeks[wk].missed_deadlines || 0) + 1;
  }
  let device = read<string>('scc_pilot_device_v1', '');
  if (!device) {
    device = Math.random().toString(36).slice(2, 8).toUpperCase();
    write('scc_pilot_device_v1', device);
  }
  return { exportedAt: new Date().toISOString(), device, weeks };
}

export function downloadPilotExport() {
  const data = buildPilotExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studentos-pilot-${data.device}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
