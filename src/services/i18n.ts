import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { en, type LocaleSchema, type TranslationKey } from '../locales/en';
import { vi } from '../locales/vi';

export type Lang = 'en' | 'vi';
export type { TranslationKey, LocaleSchema };
export type TranslateVars = Record<string, string | number>;

const STORAGE_KEYS = ['scc_lang', 'studentos_lang', 'scc_lang_v1'] as const;

const DICTIONARIES: Record<Lang, Record<TranslationKey, string>> = {
  en,
  vi,
};

function readStoredLang(): Lang | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    for (const key of STORAGE_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved === 'en' || saved === 'vi') return saved;
    }
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  return null;
}

function detectInitialLang(): Lang {
  const stored = readStoredLang();
  if (stored) return stored;
  try {
    if (typeof navigator !== 'undefined') {
      const nav = (navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en').toLowerCase();
      if (nav.startsWith('vi')) return 'vi';
    }
  } catch {
    // Default to English when navigator is unavailable.
  }
  return 'en';
}

function applyHtmlLang(lang: Lang): void {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
  } catch {
    // Ignore DOM errors in SSR/non-DOM environments.
  }
}

let currentLang: Lang = detectInitialLang();
applyHtmlLang(currentLang);

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (!event.key || !(STORAGE_KEYS as readonly string[]).includes(event.key)) return;
    if (event.newValue === 'en' || event.newValue === 'vi') {
      if (currentLang !== event.newValue) {
        currentLang = event.newValue;
        applyHtmlLang(currentLang);
        notifyListeners();
      }
    }
  });
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang !== 'en' && lang !== 'vi') return;
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of STORAGE_KEYS) {
        localStorage.setItem(key, lang);
      }
    }
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
  if (currentLang === lang) {
    applyHtmlLang(lang);
    return;
  }
  currentLang = lang;
  applyHtmlLang(lang);
  notifyListeners();
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

/**
 * Translate a key using the active language, with optional `{var}` interpolation.
 * Accepts `TranslationKey` (and `string & {}` temporarily while dynamic arrays in
 * unmigrated Wave 3B files are converted to `as const`).
 */
export function t(key: TranslationKey | (string & {}), vars?: TranslateVars, langOverride?: Lang): string {
  const activeLang = langOverride ?? currentLang;
  const dict = DICTIONARIES[activeLang] as Record<string, string>;
  const fallback = DICTIONARIES.en as Record<string, string>;
  const raw = dict[key] ?? fallback[key] ?? key;
  return interpolate(raw, vars);
}

export function getLocaleTag(lang: Lang = currentLang): 'vi-VN' | 'en-US' {
  return lang === 'vi' ? 'vi-VN' : 'en-US';
}

function toValidDate(input: Date | number | string): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  date: Date | number | string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  lang: Lang = currentLang,
): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(getLocaleTag(lang), options).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function formatTime(
  date: Date | number | string,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  lang: Lang = currentLang,
): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(getLocaleTag(lang), options).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function formatRelative(date: Date | number | string, lang: Lang = currentLang): string {
  const d = toValidDate(date);
  if (!d) return '';
  const diffSeconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(getLocaleTag(lang), { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSeconds, 'second');
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, 'day');
}

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey | (string & {}), vars?: TranslateVars) => string;
  formatDate: (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lang = useSyncExternalStore<Lang>(subscribeLang, getLang, getLang);

  const translate = useCallback(
    (key: TranslationKey | (string & {}), vars?: TranslateVars) => t(key, vars, lang),
    [lang],
  );
  const fmtDate = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => formatDate(date, options, lang),
    [lang],
  );
  const fmtTime = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => formatTime(date, options, lang),
    [lang],
  );

  const value: I18nContextValue = {
    lang,
    setLang,
    t: translate,
    formatDate: fmtDate,
    formatTime: fmtTime,
  };

  return React.createElement(I18nContext.Provider, { value }, children);
};

/**
 * Subscribe reactively to the active language via `useSyncExternalStore`.
 */
export function useLang(): [Lang, (l: Lang) => void] {
  const ctx = useContext(I18nContext);
  const storeLang = useSyncExternalStore<Lang>(subscribeLang, getLang, getLang);
  return [ctx?.lang ?? storeLang, ctx?.setLang ?? setLang];
}

/**
 * Reactive translation hook returning `{ t, lang, setLang, formatDate, formatTime }`.
 */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  const storeLang = useSyncExternalStore<Lang>(subscribeLang, getLang, getLang);
  const lang = ctx?.lang ?? storeLang;

  const translate = useCallback(
    (key: TranslationKey | (string & {}), vars?: TranslateVars) => t(key, vars, lang),
    [lang],
  );
  const fmtDate = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => formatDate(date, options, lang),
    [lang],
  );
  const fmtTime = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => formatTime(date, options, lang),
    [lang],
  );

  return ctx ?? {
    lang,
    setLang,
    t: translate,
    formatDate: fmtDate,
    formatTime: fmtTime,
  };
}

export const useI18n = useT;

export const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];
