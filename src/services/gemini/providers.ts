// Allowed Gemini & Gemma model chain (server + client BYOK).
import { t as tr } from '../i18n';

export const ALLOWED_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
] as const;

export const GEMINI_DEFAULT_MODEL = 'gemini-3-flash-preview';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_SAFETY_MODELS = [
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
];

export const CLIENT_COACH_MODE_MODELS = {
  quick: ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'],
  balanced: ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
  reasoning: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
  apex: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
} as const;

export const VISION_CHEAPEST_MODELS = [
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
] as const;

/** Mask a key for display (never log full keys). e.g. "AIza...****" */
export function maskApiKey(key: string): string {
  try {
    const t = (key || '').trim();
    if (!t) return '';
    if (t.length <= 8) return '****';
    return `${t.slice(0, 4)}...****`;
  } catch { return '****'; }
}

// --- Optional per-key expiration metadata (stored SEPARATELY from key value) ---
const GEMINI_META_KEY = 'scc_gemini_api_key_meta';
export interface ApiKeyMeta { expiresAt?: string }
function readMeta(storageKey: string): ApiKeyMeta {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? { expiresAt: data.expiresAt } : {};
  } catch { return {}; }
}
function writeMeta(storageKey: string, meta: ApiKeyMeta): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!meta.expiresAt) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(meta));
  } catch {}
}
export function getGeminiKeyMeta(): ApiKeyMeta { return readMeta(GEMINI_META_KEY); }
export function setGeminiKeyExpiry(dateStr: string | null): void {
  writeMeta(GEMINI_META_KEY, dateStr ? { expiresAt: dateStr } : {});
}
export function getExpiryStatus(expiresAt?: string): { state: 'none' | 'valid' | 'expiring' | 'expired'; daysLeft: number | null; label: string } {
  if (!expiresAt) return { state: 'none', daysLeft: null, label: '' };
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const exp = new Date(`${expiresAt}T00:00:00`);
    if (isNaN(exp.getTime())) return { state: 'none', daysLeft: null, label: '' };
    const daysLeft = Math.round((exp.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0) return { state: 'expired', daysLeft, label: tr('prov_expired') };
    if (daysLeft <= 7) return { state: 'expiring', daysLeft, label: daysLeft === 0 ? tr('prov_expires_today') : tr(daysLeft === 1 ? 'prov_expires_in_one' : 'prov_expires_in_other', { days: daysLeft }) };
    return { state: 'valid', daysLeft, label: tr('prov_expires_in_other', { days: daysLeft }) };
  } catch { return { state: 'none', daysLeft: null, label: '' }; }
}

export function getClientGeminiApiKey(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sess = sessionStorage.getItem('scc_gemini_api_key_session');
      if (sess) return sess;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('scc_gemini_api_key') || '';
    }
    return '';
  } catch { return ''; }
}
export function setClientGeminiApiKey(key: string, opts?: { sessionOnly?: boolean }): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('scc_gemini_api_key');
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('scc_gemini_api_key_session');
      return;
    }
    if (opts?.sessionOnly) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('scc_gemini_api_key_session', trimmed);
      if (typeof localStorage !== 'undefined') localStorage.removeItem('scc_gemini_api_key');
    } else {
      if (typeof localStorage !== 'undefined') localStorage.setItem('scc_gemini_api_key', trimmed);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('scc_gemini_api_key_session');
    }
  } catch {}
}

// Daily client quota tracking (server also enforces per-IP limits on /api/gemini/*)
const DAILY_QUOTA_KEY='scc_gemini_daily_quota_v1';
export const DAILY_QUOTA_LIMIT=50;
export function checkDailyQuota():boolean{
  if (typeof localStorage === 'undefined') return true;
  try{
    const today=new Date().toISOString().slice(0,10);
    const raw=localStorage.getItem(DAILY_QUOTA_KEY);
    const data=raw?JSON.parse(raw):{date:today,count:0};
    if(data.date!==today) return true;
    return (Number(data.count)||0)<DAILY_QUOTA_LIMIT;
  }catch{return true;}
}
export function incrementQuota():void{
  if (typeof localStorage === 'undefined') return;
  try{
    const today=new Date().toISOString().slice(0,10);
    const raw=localStorage.getItem(DAILY_QUOTA_KEY);
    const data=raw?JSON.parse(raw):{date:today,count:0};
    const nextCount = data.date!==today ? 1 : (Number(data.count)||0)+1;
    localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify({date:today,count:nextCount}));
    if (typeof indexedDB !== 'undefined') {
      import('../db').then(({ db }) => db.quota.put({ id: today, date: today, count: nextCount }).catch(() => {})).catch(() => {});
    }
  }catch{}
}
export function getGeminiQuotaStatus(){
  if (typeof localStorage === 'undefined') return {used:0,limit:DAILY_QUOTA_LIMIT,remaining:DAILY_QUOTA_LIMIT};
  try{
    const today=new Date().toISOString().slice(0,10);
    const raw=localStorage.getItem(DAILY_QUOTA_KEY);
    const data=raw?JSON.parse(raw):{date:today,count:0};
    const used=data.date===today?(Number(data.count)||0):0;
    return {used, limit:DAILY_QUOTA_LIMIT, remaining:Math.max(0,DAILY_QUOTA_LIMIT-used)};
  }catch{return {used:0,limit:DAILY_QUOTA_LIMIT,remaining:DAILY_QUOTA_LIMIT};}
}
