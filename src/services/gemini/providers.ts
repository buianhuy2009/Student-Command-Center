// Judge-locked chain: 3.5-flash → 3.0-flash → Groq. 2.5/2.0 kept as safety net for 404s.
export const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';
export const GEMINI_SAFETY_MODELS = ['gemini-2.5-flash', 'gemini-flash-lite-latest'];

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
const GROQ_META_KEY = 'scc_groq_api_key_meta';
export interface ApiKeyMeta { expiresAt?: string }
function readMeta(storageKey: string): ApiKeyMeta {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? { expiresAt: data.expiresAt } : {};
  } catch { return {}; }
}
function writeMeta(storageKey: string, meta: ApiKeyMeta): void {
  try {
    if (!meta.expiresAt) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(meta));
  } catch {}
}
export function getGeminiKeyMeta(): ApiKeyMeta { return readMeta(GEMINI_META_KEY); }
export function setGeminiKeyExpiry(dateStr: string | null): void {
  writeMeta(GEMINI_META_KEY, dateStr ? { expiresAt: dateStr } : {});
}
export function getGroqKeyMeta(): ApiKeyMeta { return readMeta(GROQ_META_KEY); }
export function setGroqKeyExpiry(dateStr: string | null): void {
  writeMeta(GROQ_META_KEY, dateStr ? { expiresAt: dateStr } : {});
}
export function getExpiryStatus(expiresAt?: string): { state: 'none' | 'valid' | 'expiring' | 'expired'; daysLeft: number | null; label: string } {
  if (!expiresAt) return { state: 'none', daysLeft: null, label: '' };
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const exp = new Date(`${expiresAt}T00:00:00`);
    if (isNaN(exp.getTime())) return { state: 'none', daysLeft: null, label: '' };
    const daysLeft = Math.round((exp.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0) return { state: 'expired', daysLeft, label: 'Expired' };
    if (daysLeft <= 7) return { state: 'expiring', daysLeft, label: daysLeft === 0 ? 'Expires today' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` };
    return { state: 'valid', daysLeft, label: `Expires in ${daysLeft} days` };
  } catch { return { state: 'none', daysLeft: null, label: '' }; }
}

export function getClientGeminiApiKey(): string {
  try {
    const sess = sessionStorage.getItem('scc_gemini_api_key_session');
    if (sess) return sess;
    return localStorage.getItem('scc_gemini_api_key') || '';
  } catch { return ''; }
}
export function setClientGeminiApiKey(key: string, opts?: { sessionOnly?: boolean }): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) { localStorage.removeItem('scc_gemini_api_key'); sessionStorage.removeItem('scc_gemini_api_key_session'); return; }
    if (opts?.sessionOnly) { sessionStorage.setItem('scc_gemini_api_key_session', trimmed); localStorage.removeItem('scc_gemini_api_key'); }
    else { localStorage.setItem('scc_gemini_api_key', trimmed); sessionStorage.removeItem('scc_gemini_api_key_session'); }
  } catch {}
}
export function getClientGroqApiKey(): string { try { return localStorage.getItem('scc_groq_api_key')||''; } catch { return ''; } }
export function setClientGroqApiKey(key: string): void { try { localStorage.setItem('scc_groq_api_key', key.trim()); } catch {} }

export async function callGroqDirect(promptText: string, jsonMode: boolean=false): Promise<string> {
  const groqKey = getClientGroqApiKey();
  if (!groqKey) throw new Error('No Groq key');
  const tryModel = async (model: string) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST', headers:{ Authorization:`Bearer ${groqKey}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ model, messages:[{role:'user', content:promptText}], temperature:0.3, response_format: jsonMode ? {type:'json_object'}:undefined })
    });
    if(!res.ok) throw new Error(`Groq ${model} error ${res.statusText}`);
    const data=await res.json(); return data.choices?.[0]?.message?.content||'';
  };
  try { return await tryModel('llama-3.3-70b-versatile'); }
  catch(e){ console.warn('Groq 70B failed fallback',e); return await tryModel('llama-3.1-8b-instant'); }
}

// Daily quota — client only, server should enforce via Redis
const DAILY_QUOTA_KEY='scc_gemini_daily_quota_v1';
export const DAILY_QUOTA_LIMIT=50;
export function checkDailyQuota():boolean{ try{ const today=new Date().toISOString().slice(0,10); const raw=localStorage.getItem(DAILY_QUOTA_KEY); const data=raw?JSON.parse(raw):{date:today,count:0}; if(data.date!==today) return true; return data.count<DAILY_QUOTA_LIMIT; }catch{return true;}}
export function incrementQuota():void{ try{ const today=new Date().toISOString().slice(0,10); const raw=localStorage.getItem(DAILY_QUOTA_KEY); const data=raw?JSON.parse(raw):{date:today,count:0}; if(data.date!==today) {localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify({date:today,count:1})); return;} localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify({date:today,count:(data.count||0)+1})); }catch{}}
export function getGeminiQuotaStatus(){ try{ const today=new Date().toISOString().slice(0,10); const raw=localStorage.getItem(DAILY_QUOTA_KEY); const data=raw?JSON.parse(raw):{date:today,count:0}; const used=data.date===today?(data.count||0):0; return {used, limit:DAILY_QUOTA_LIMIT, remaining:Math.max(0,DAILY_QUOTA_LIMIT-used)};}catch{return {used:0,limit:DAILY_QUOTA_LIMIT,remaining:DAILY_QUOTA_LIMIT};}}
