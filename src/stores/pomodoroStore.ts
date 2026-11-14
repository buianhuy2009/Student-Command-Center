import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STREAK_HISTORY_KEY = 'scc_streak_history';

/** Parse `scc_streak_history`, migrating legacy `string[]` date lists into `Record<string, number>`. */
export function parseStreakHistory(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const item of parsed) {
        if (typeof item === 'string' && item.trim()) {
          out[item] = Math.max(out[item] || 0, 1);
        }
      }
      return out;
    }
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (key.trim() && typeof val === 'number' && Number.isFinite(val) && val > 0) {
          out[key] = val;
        }
      }
      return out;
    }
  } catch {}
  return {};
}

/** Record or increment a date in `scc_streak_history` (`Record<string, number>`), keeping the latest `maxDays` entries. */
export function recordStreakDate(
  dateStr: string,
  opts: { increment?: boolean; maxDays?: number } = {}
): Record<string, number> {
  const { increment = false, maxDays = 30 } = opts;
  const history = parseStreakHistory(
    typeof localStorage !== 'undefined' ? localStorage.getItem(STREAK_HISTORY_KEY) : null
  );
  if (increment) {
    history[dateStr] = (history[dateStr] || 0) + 1;
  } else if (!history[dateStr]) {
    history[dateStr] = 1;
  }
  const trimmed = Object.fromEntries(
    Object.entries(history)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-maxDays)
  );
  try {
    localStorage.setItem(STREAK_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

interface PomodoroState {
  sprintGoal: number;
  completedSessions: number;
  setSprintGoal: (n: number) => void;
  incrementCompleted: () => void;
  setCompleted: (n: number) => void;
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      sprintGoal: (() => { try { const v = localStorage.getItem('scc_user_sprint_goal'); return v ? parseInt(v,10) : 4; } catch { return 4; } })(),
      completedSessions: (() => { try { const v = localStorage.getItem('scc_pomo_completed_v1'); return v ? parseInt(v,10) : 0; } catch { return 0; } })(),
      setSprintGoal: (n) => {
        const next = Math.max(1, Math.min(10, n));
        try { localStorage.setItem('scc_user_sprint_goal', String(next)); } catch {}
        set({ sprintGoal: next });
      },
      incrementCompleted: () => {
        const next = get().completedSessions + 1;
        try { localStorage.setItem('scc_pomo_completed_v1', String(next)); } catch {}
        try {
          const today=new Date().toISOString().slice(0,10);
          const raw=localStorage.getItem('scc_focus_sessions_log');
          const parsedLog=raw? JSON.parse(raw):[];
          const log: {date:string, minutes:number}[] = Array.isArray(parsedLog) ? parsedLog : [];
          log.push({date: today, minutes: 25});
          localStorage.setItem('scc_focus_sessions_log', JSON.stringify(log));
          // also maintain scc_streak_history for compatibility
          recordStreakDate(today, { increment: true });
        } catch {}
        try { new BroadcastChannel('scc-pomo').postMessage({ type: 'increment', value: next }); } catch {}
        set({ completedSessions: next });
      },
      setCompleted: (n) => {
        try { localStorage.setItem('scc_pomo_completed_v1', String(n)); } catch {}
        set({ completedSessions: n });
      },
    }),
    { name: 'scc_pomo_store', storage: createJSONStorage(()=>localStorage) }
  )
);

// Sync across tabs via BroadcastChannel & storage
if (typeof window !== 'undefined') {
  try {
    const bc = new BroadcastChannel('scc-pomo');
    bc.addEventListener('message', () => {
      try { const v = localStorage.getItem('scc_pomo_completed_v1'); const n = v ? parseInt(v,10) : 0; usePomodoroStore.setState({ completedSessions: n }); } catch {}
    });
  } catch {}
  window.addEventListener('storage', (e) => {
    if (e.key === 'scc_pomo_completed_v1') {
      try { const n = e.newValue ? parseInt(e.newValue,10) : 0; usePomodoroStore.setState({ completedSessions: n }); } catch {}
    }
  });
  window.addEventListener('focus', () => {
    try { const v = localStorage.getItem('scc_pomo_completed_v1'); const n = v ? parseInt(v,10) : 0; usePomodoroStore.setState({ completedSessions: n }); } catch {}
  });
}
