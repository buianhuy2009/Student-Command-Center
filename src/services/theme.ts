// Warm Alabaster Paper (light) & Slate Charcoal (dark) with Terracotta accent
import { t } from './i18n';

export type ThemeId = 'linen' | 'midnight';

const THEME_KEY = 'scc_color_theme_v1';
const LEGACY_THEME_KEY = 'scc_theme';

// Single writer of the canonical theme key — the ONLY localStorage.setItem(THEME_KEY, …) call site.
function writeThemeKey(id: ThemeId) {
  try { localStorage.setItem(THEME_KEY, id); } catch {}
}

let legacyMigrated = false;

// One-time migration: read the legacy key once per page load, map
// dark→midnight / light→linen (else migrateThemeId), write via the single
// writer ONLY if the canonical key is missing, then drop the legacy key.
function migrateLegacyThemeKeyOnce() {
  if (legacyMigrated) return;
  legacyMigrated = true;
  try {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy == null) return;
    let mapped: ThemeId;
    if (legacy === 'dark') mapped = 'midnight';
    else if (legacy === 'light') mapped = 'linen';
    else mapped = migrateThemeId(legacy);
    try {
      if (localStorage.getItem(THEME_KEY) == null) {
        writeThemeKey(mapped);
      }
    } catch {}
    try { localStorage.removeItem(LEGACY_THEME_KEY); } catch {}
  } catch {}
}

export const THEME_META: Record<ThemeId, { label: string; accent: string; bg: string }> = {
  linen: { label: 'Paper (Light)', accent: '#B54B27', bg: '#F7F6F2' },
  midnight: { label: 'Slate (Dark)', accent: '#C2512B', bg: '#14171C' },
};

export function getThemeLabel(id: ThemeId): string {
  return t(id === 'midnight' ? 'theme_midnight_label' : 'theme_linen_label');
}

const LEGACY_DARK_THEMES = ['midnight', 'ocean', 'forest', 'nord', 'dracula', 'catppuccin', 'cyberpunk'];

function migrateThemeId(raw: string | null): ThemeId {
  if (raw === 'midnight') return 'midnight';
  if (raw === 'linen' || raw === 'parchment') return 'linen';
  if (raw && LEGACY_DARK_THEMES.includes(raw)) return 'midnight';
  if (raw === 'dark') return 'midnight';
  if (raw === 'light') return 'linen';
  return 'linen';
}

function applyThemeToDom(theme: ThemeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === 'midnight';
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  try {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_META[theme].bg);
  } catch {}
}

export function getTheme(): ThemeId {
  migrateLegacyThemeKeyOnce();
  try {
    const s = localStorage.getItem(THEME_KEY);
    const migrated = migrateThemeId(s);
    if (s !== migrated) {
      writeThemeKey(migrated);
    }
    return migrated;
  } catch {
    return 'linen';
  }
}

export function setTheme(id: ThemeId) {
  const next = migrateThemeId(id as string);
  writeThemeKey(next);
  applyThemeToDom(next);
}

export function initTheme() {
  migrateLegacyThemeKeyOnce();
  const current = getTheme();
  applyThemeToDom(current);
}

export function syncDarkToTheme(isDark: boolean) {
  setTheme(isDark ? 'midnight' : 'linen');
}
