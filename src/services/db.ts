import Dexie, { type Table } from 'dexie';
import type { MarkdownNote } from '../types';
import type { SRSCard } from '../services/srsEngine';

export interface PersistedBrief { id: string; topic: string; subject: string; brief: string; createdAt: string; }

export interface QueuedAssignment { id: string; assignmentName: string; subject: string; dueDate: string; priority: string; status: string; sheetRowIndex?: number; source?: string; queuedAt?: string; }

export interface StoredAssignment { id: string; data: any; updatedAt: string; }
export class StudentOSDatabase extends Dexie {
  notes!: Table<MarkdownNote, string>;
  srsCards!: Table<SRSCard & { deckId: string }, string>;
  briefs!: Table<PersistedBrief, string>;
  assignmentsQueue!: Table<QueuedAssignment, string>;
  assignments!: Table<StoredAssignment, string>;
  preferences!: Table<{ key: string; value: any }, string>;
  quota!: Table<{ id: string; date: string; count: number }, string>;
  trash!: Table<{ id: string; kind: string; label: string; data: any; deletedAt: string; expiresAt: string }, string>;
  prompts!: Table<{ id: string; title: string; category: string; body: string; shared?: boolean }, string>;
  tokenUsage!: Table<{ id: string; date: string; model: string; tokens: number; task: string }, string>;
  dashboard!: Table<{ id: string; order: string[]; hidden: string[]; sizes?: Record<string, string> }, string>;

  constructor() {
    super('StudentOSDatabase');
    this.version(1).stores({
      notes: 'id, subject, title, updatedAt',
      srsCards: 'id, deckId, dueDate, easeFactor, repetitions',
      briefs: 'id, subject, topic, createdAt',
      assignmentsQueue: 'id, dueDate, status',
    });
    this.version(2).stores({
      notes: 'id, subject, title, updatedAt',
      srsCards: 'id, deckId, dueDate, easeFactor, repetitions',
      briefs: 'id, subject, topic, createdAt',
      assignmentsQueue: 'id, dueDate, status, sheetRowIndex',
      bibliography: 'id, source, year',
    });
    this.version(3).stores({
      notes: 'id, subject, title, updatedAt',
      srsCards: 'id, deckId, dueDate, easeFactor, repetitions',
      briefs: 'id, subject, topic, createdAt',
      assignmentsQueue: 'id, dueDate, status, sheetRowIndex',
      bibliography: 'id, source, year',
      assignments: 'id, updatedAt',
      preferences: 'key',
      quota: 'id, date',
    });
    this.version(4).stores({
      notes: 'id, subject, title, updatedAt',
      srsCards: 'id, deckId, dueDate, easeFactor, repetitions',
      briefs: 'id, subject, topic, createdAt',
      assignmentsQueue: 'id, dueDate, status, sheetRowIndex',
      bibliography: 'id, source, year',
      assignments: 'id, updatedAt',
      preferences: 'key',
      quota: 'id, date',
      trash: 'id, kind, deletedAt, expiresAt',
      prompts: 'id, category',
      tokenUsage: 'id, date, model',
      dashboard: 'id',
    });
    this.version(5).stores({
      notes: 'id, subject, title, updatedAt',
      srsCards: 'id, deckId, dueDate, easeFactor, repetitions',
      briefs: 'id, subject, topic, createdAt',
      assignmentsQueue: 'id, dueDate, status, sheetRowIndex',
      bibliography: 'id, source, year',
      assignments: 'id, updatedAt',
      preferences: 'key',
      quota: 'id, date',
      trash: 'id, kind, deletedAt, expiresAt',
      prompts: 'id, category',
      tokenUsage: 'id, date, model',
      dashboard: 'id',
      promptLogs: 'id, feature, timestamp',
      evidenceSnapshots: 'id, feature, timestamp',
      trainedModels: 'id, type, savedAt',
      vaultIndex: 'docId, title',
    });
    // @ts-ignore extra table for BIB
    (this as any).bibliography = (this as any).table('bibliography');
  }
}

export const db = new StudentOSDatabase();

// Migration helper: hydrate from localStorage once — now covers 15+ keys (was only 2)
export async function migrateLocalStorageToDexie(): Promise<void> {
  try {
    const notesRaw = localStorage.getItem('scc_markdown_notes_v1');
    if (notesRaw) {
      const notes = JSON.parse(notesRaw) as MarkdownNote[];
      if (notes.length) await db.notes.bulkPut(notes).catch(() => {});
    }
    const decksRaw = localStorage.getItem('scc_srs_decks_v2') || localStorage.getItem('scc_flashcard_decks_v1');
    if (decksRaw) {
      const decks = JSON.parse(decksRaw);
      const flat: any[] = [];
      for (const d of decks) {
        for (const c of (d.cards || [])) flat.push({ ...c, deckId: d.id, id: c.id || `card-${Date.now()}-${Math.random()}` });
      }
      if (flat.length) await db.srsCards.bulkPut(flat).catch(() => {});
    }
    // Migrate assignments (scc_user_assignments_v2)
    try {
      const assignRaw = localStorage.getItem('scc_user_assignments_v2');
      if (assignRaw) {
        const arr = JSON.parse(assignRaw);
        if (Array.isArray(arr) && arr.length) {
          await db.assignments.bulkPut(arr.map((a: any) => ({ id: a.id, data: a, updatedAt: a.updatedAt || new Date().toISOString() }))).catch(()=>{});
        }
      }
    } catch {}
    // Migrate preferences (15 keys) to Dexie preferences table
    const prefKeys = ['scc_user_preferred_name','scc_user_daily_intention','scc_user_selected_vibe','scc_user_sprint_goal','scc_canvas_settings_v1','scc_gemini_daily_quota_v1','scc_pinned_apps_v2','scc_recent_tabs_v1','scc_app_usage_v1','scc_sidebar_expanded','scc_theme','scc_color_theme_v1','scc_ui_density_v1','scc_shortcut_settings','scc_dashboard_personalize_open'];
    for (const k of prefKeys) {
      try {
        const v = localStorage.getItem(k);
        if (v !== null) await db.preferences.put({ key: k, value: JSON.parse(v) }).catch(async ()=> { await db.preferences.put({ key: k, value: v }); });
      } catch {}
    }
    // Migrate per-account vaults + token mirrors (any key with these prefixes)
    // so relogin restore works even if localStorage was partially cleared.
    try {
      const vaultPrefixes = [
        'scc_canvas_settings_v1__',
        'google_workspace_access_token',
        'google_token_acquired_at',
        'scc_google_refresh',
      ];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || prefKeys.includes(k)) continue;
        if (!vaultPrefixes.some((p) => k === p || k.startsWith(p))) continue;
        try {
          const v = localStorage.getItem(k);
          if (v === null) continue;
          const existing = await db.preferences.get(k).catch(() => null);
          if (existing) continue; // Dexie copy already authoritative — never overwrite
          try {
            await db.preferences.put({ key: k, value: JSON.parse(v) });
          } catch {
            await db.preferences.put({ key: k, value: v });
          }
        } catch {}
      }
    } catch {}
    // Migrate quota to Dexie quota table
    try {
      const quotaRaw = localStorage.getItem('scc_gemini_daily_quota_v1');
      if (quotaRaw) {
        const q = JSON.parse(quotaRaw);
        if (q.date && typeof q.count === 'number') await db.quota.put({ id: q.date, date: q.date, count: q.count }).catch(()=>{});
      }
    } catch {}
  } catch (e) { console.warn('Dexie migration skipped', e); }
}

export async function getNotesIndexedBySubject(subject: string): Promise<MarkdownNote[]> {
  return db.notes.where('subject').equals(subject).toArray() as any;
}
