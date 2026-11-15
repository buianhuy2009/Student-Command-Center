// Curated Light (Warm Paper, Nordic Studio, Quiet Botanical) & Dark (Slate, Obsidian, Evergreen) presets
import { t } from './i18n';

export type LightThemeId = 'linen' | 'nordic' | 'sage';
export type DarkThemeId = 'midnight' | 'obsidian' | 'evergreen';
export type ThemeId = LightThemeId | DarkThemeId;

export const LIGHT_THEMES: readonly LightThemeId[] = ['linen', 'nordic', 'sage'];
export const DARK_THEMES: readonly DarkThemeId[] = ['midnight', 'obsidian', 'evergreen'];

const THEME_KEY = 'scc_color_theme_v1';
const LIGHT_PREF_KEY = 'scc_light_preset_v1';
const DARK_PREF_KEY = 'scc_dark_preset_v1';
const LEGACY_THEME_KEY = 'scc_theme';

export function isDarkTheme(id: string | null | undefined): id is DarkThemeId {
  return id === 'midnight' || id === 'obsidian' || id === 'evergreen';
}

// Single writer of the canonical theme key — the ONLY localStorage.setItem(THEME_KEY, …) call site.
function writeThemeKey(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
    if (isDarkTheme(id)) {
      localStorage.setItem(DARK_PREF_KEY, id);
    } else {
      localStorage.setItem(LIGHT_PREF_KEY, id);
    }
  } catch {}
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
    const mapped = migrateThemeId(legacy);
    try {
      if (localStorage.getItem(THEME_KEY) == null) {
        writeThemeKey(mapped);
      }
    } catch {}
    try { localStorage.removeItem(LEGACY_THEME_KEY); } catch {}
  } catch {}
}

export interface ThemeMeta {
  label: string;
  labelKey: 'theme_linen_label' | 'theme_nordic_label' | 'theme_sage_label' | 'theme_midnight_label' | 'theme_obsidian_label' | 'theme_evergreen_label';
  descKey: 'theme_linen_desc' | 'theme_nordic_desc' | 'theme_sage_desc' | 'theme_midnight_desc' | 'theme_obsidian_desc' | 'theme_evergreen_desc';
  mode: 'light' | 'dark';
  accent: string;
  bg: string;
  surface: string;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  linen: {
    label: 'Warm Paper',
    labelKey: 'theme_linen_label',
    descKey: 'theme_linen_desc',
    mode: 'light',
    accent: '#B54B27',
    bg: '#F7F6F2',
    surface: '#FFFFFF',
  },
  nordic: {
    label: 'Nordic Studio',
    labelKey: 'theme_nordic_label',
    descKey: 'theme_nordic_desc',
    mode: 'light',
    accent: '#2563EB',
    bg: '#F6F8FA',
    surface: '#FFFFFF',
  },
  sage: {
    label: 'Quiet Botanical',
    labelKey: 'theme_sage_label',
    descKey: 'theme_sage_desc',
    mode: 'light',
    accent: '#2F6F4E',
    bg: '#F3F6F4',
    surface: '#FFFFFF',
  },
  midnight: {
    label: 'Slate Charcoal',
    labelKey: 'theme_midnight_label',
    descKey: 'theme_midnight_desc',
    mode: 'dark',
    accent: '#C2512B',
    bg: '#14171C',
    surface: '#1C2028',
  },
  obsidian: {
    label: 'Linear Obsidian',
    labelKey: 'theme_obsidian_label',
    descKey: 'theme_obsidian_desc',
    mode: 'dark',
    accent: '#6366F1',
    bg: '#0D0F13',
    surface: '#151921',
  },
  evergreen: {
    label: 'Deep Evergreen',
    labelKey: 'theme_evergreen_label',
    descKey: 'theme_evergreen_desc',
    mode: 'dark',
    accent: '#059669',
    bg: '#0F1614',
    surface: '#16201D',
  },
};

export function getThemeLabel(id: ThemeId): string {
  const meta = THEME_META[id] || THEME_META.linen;
  return t(meta.labelKey);
}

const LEGACY_DARK_THEMES = ['midnight', 'ocean', 'dracula', 'catppuccin', 'cyberpunk'];

function migrateThemeId(raw: string | null): ThemeId {
  if (raw === 'linen' || raw === 'nordic' || raw === 'sage') return raw;
  if (raw === 'midnight' || raw === 'obsidian' || raw === 'evergreen') return raw;
  if (raw === 'forest') return 'evergreen';
  if (raw === 'nord') return 'nordic';
  if (raw === 'parchment' || raw === 'light') return 'linen';
  if (raw === 'dark') return 'midnight';
  if (raw && LEGACY_DARK_THEMES.includes(raw)) return 'midnight';
  return 'linen';
}

export function getPreferredLightTheme(): LightThemeId {
  try {
    const raw = localStorage.getItem(LIGHT_PREF_KEY);
    if (raw === 'linen' || raw === 'nordic' || raw === 'sage') return raw;
  } catch {}
  return 'linen';
}

export function getPreferredDarkTheme(): DarkThemeId {
  try {
    const raw = localStorage.getItem(DARK_PREF_KEY);
    if (raw === 'midnight' || raw === 'obsidian' || raw === 'evergreen') return raw;
  } catch {}
  return 'midnight';
}

function applyThemeToDom(theme: ThemeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = isDarkTheme(theme);
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

export function setTheme(id: ThemeId | string) {
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
  const current = getTheme();
  if (isDark && isDarkTheme(current)) {
    applyThemeToDom(current);
    return;
  }
  if (!isDark && !isDarkTheme(current)) {
    applyThemeToDom(current);
    return;
  }
  setTheme(isDark ? getPreferredDarkTheme() : getPreferredLightTheme());
}
