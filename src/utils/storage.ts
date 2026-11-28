export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed as T;
    }
  } catch (e) {
    console.error(`loadJson ${key} failed`, e);
  }
  return fallback;
}
export function saveJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(`saveJson ${key} failed`, e); }
}
export const STORAGE_KEYS = {
  assignments: 'scc_user_assignments_v2',
  emailAlerts: 'scc_cached_email_alerts_v2',
  rawEmails: 'scc_cached_raw_emails_v2',
  workspace: 'scc_active_workspace_v1',
  sidebarExpanded: 'scc_sidebar_expanded',
  pinnedApps: 'scc_pinned_apps_v2',
  geminiKey: 'scc_gemini_api_key',
} as const;
