import { GoogleGenAI } from "@google/genai";
import { t } from "../i18n";
import { rateLimiter } from "./rateLimiter";
import {
  checkDailyQuota,
  incrementQuota,
  getClientGeminiApiKey,
  callGroqDirect,
  getClientGroqApiKey,
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  GEMINI_SAFETY_MODELS,
} from "./providers";

const CLIENT_MODEL_COOLDOWN_MS = 90_000;
const clientModelCooldowns = new Map<string, number>();

function isClientRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const msg = String(err?.message || err?.error?.message || err || '');
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg);
}

function markClientModelLimited(model: string): void {
  if (!model) return;
  clientModelCooldowns.set(model, Date.now() + CLIENT_MODEL_COOLDOWN_MS);
}

function prioritizeClientModels(models: string[]): string[] {
  const now = Date.now();
  const ready: string[] = [];
  const cooled: string[] = [];
  for (const m of models) {
    const until = clientModelCooldowns.get(m) || 0;
    if (until > now) cooled.push(m);
    else {
      if (until) clientModelCooldowns.delete(m);
      ready.push(m);
    }
  }
  return [...ready, ...cooled];
}

function extractErrorText(err: any): string {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const rawMsg: string = err?.message || err?.error?.message || String(err ?? t('gclient_unknown_err'));
  const msg = rawMsg.slice(0, 500);
  if (status === 400 || /API key not valid|API_KEY_INVALID|invalid/i.test(msg)) {
    return t('gclient_err_400', { msg });
  }
  if (status === 403 || /PERMISSION_DENIED|forbidden/i.test(msg)) {
    return t('gclient_err_403', { msg });
  }
  if (status === 404 || /NOT_FOUND|not found|Retired|deprecated|model/i.test(msg)) {
    return t('gclient_err_404', { defaultModel: GEMINI_DEFAULT_MODEL, fallbackModel: GEMINI_FALLBACK_MODEL, msg });
  }
  if (status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate/i.test(msg)) {
    return t('gclient_err_429', { msg });
  }
  return status ? t('gclient_err_status', { status, msg }) : t('gclient_err_plain', { msg });
}

export async function testGeminiApiKeyDetailed(key: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  const trimmed = (key || '').trim();
  if (!trimmed) return { ok: false, error: t('gclient_enter_key') };
  const candidates = Array.from(new Set([GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL]));
  let lastError = '';
  for (const model of candidates) {
    try {
      const ai = new GoogleGenAI({ apiKey: trimmed });
      const response = await ai.models.generateContent({ model, contents: 'Respond with "pong".' });
      if ((response.text || '').toLowerCase().includes('pong')) return { ok: true, model };
      lastError = t('gclient_no_pong', { model });
    } catch (err) {
      lastError = extractErrorText(err);
      const isModelNotFound =
        (err as any)?.status === 404 || /NOT_FOUND|not found|Retired|deprecated/i.test(String((err as any)?.message || ''));
      if (!isModelNotFound) return { ok: false, error: lastError, model };
    }
  }
  return { ok: false, error: lastError || t('gclient_conn_failed'), model: candidates[0] };
}

export async function testGroqApiKeyDetailed(key: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (key || '').trim();
  if (!trimmed) return { ok: false, error: t('gclient_enter_groq_key') };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${trimmed}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Respond with "pong".' }], temperature: 0 }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { const data = await res.json(); detail = data?.error?.message || detail; } catch {}
      if (res.status === 401) return { ok: false, error: t('gclient_groq_401', { detail }).slice(0, 500) };
      if (res.status === 429) return { ok: false, error: t('gclient_groq_429', { detail }).slice(0, 500) };
      return { ok: false, error: t('gclient_groq_err', { status: res.status, detail }).slice(0, 500) };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: t('gclient_groq_test_failed', { msg: (err?.message || String(err)).slice(0, 500) }) };
  }
}

export async function callGemini(params: {
  contents: any;
  config?: any;
  model?: string;
  candidateModels?: string[];
  skipGroqFallback?: boolean;
}): Promise<string> {
  if (!checkDailyQuota()) throw new Error(t('gclient_daily_limit'));
  return rateLimiter.execute(async () => {
    incrementQuota();
    const clientKey = getClientGeminiApiKey();
    const targetModel = params.model || params.candidateModels?.[0] || GEMINI_DEFAULT_MODEL;
    let lastErrorMessage = '';

    if (clientKey) {
      const baseAttempts = params.candidateModels?.length
        ? params.candidateModels
        : [targetModel, GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, ...GEMINI_SAFETY_MODELS];
      const attempts = prioritizeClientModels(Array.from(new Set(baseAttempts)));
      for (const m of attempts) {
        try {
          const ai = new GoogleGenAI({ apiKey: clientKey });
          const res = await ai.models.generateContent({ model: m, contents: params.contents, config: params.config });
          if (!res.text || !res.text.trim()) throw new Error(t('gclient_empty_model', { model: m }));
          return res.text;
        } catch (e: any) {
          lastErrorMessage = extractErrorText(e);
          if (isClientRateLimitError(e)) {
            markClientModelLimited(m);
            continue;
          }
          const isModelNotFound = e?.status === 404 || /NOT_FOUND|not found|Retired|deprecated/i.test(String(e?.message || ''));
          if (isModelNotFound) continue;
          const isBadRequest = e?.status === 400 && /API key not valid|API_KEY_INVALID/i.test(String(e?.message || ''));
          if (isBadRequest) break;
        }
      }
      console.warn('Client Gemini failed, trying server proxy:', lastErrorMessage);
    }

    try {
      const serverRes = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: params.contents,
          config: params.config,
          model: targetModel,
          candidateModels: params.candidateModels,
        }),
      });
      const contentType = serverRes.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(t('airouter_unexpected_res', { status: serverRes.status, contentType: contentType || t('airouter_unknown_type') }));
      }
      const data = await serverRes.json();
      if (serverRes.ok) {
        if (!data?.text || !String(data.text).trim()) {
          throw new Error(t('gclient_empty_server'));
        }
        return String(data.text);
      }
      lastErrorMessage = data?.error || t('gclient_server_err', { status: serverRes.status });
      if (serverRes.status === 429) {
        throw new Error(lastErrorMessage);
      }
    } catch (e: any) {
      if (!lastErrorMessage) lastErrorMessage = e?.message || String(e);
      console.warn('Server proxy failed:', lastErrorMessage);
    }

    if (!params.skipGroqFallback && getClientGroqApiKey()) {
      try {
        let promptText = '';
        if (typeof params.contents === 'string') promptText = params.contents;
        else if (Array.isArray(params.contents)) promptText = params.contents.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('\n');
        else if (params.contents?.text) promptText = params.contents.text;
        const isJson = params.config?.responseMimeType === 'application/json';
        return await callGroqDirect(promptText || 'Summarize academic task', isJson);
      } catch (e: any) {
        lastErrorMessage = e?.message || lastErrorMessage;
      }
    }

    throw new Error(lastErrorMessage || t('gclient_unavailable'));
  });
}

export function repairJsonString<T=any>(raw:string):T{
  let cleaned=raw.trim().replace(/^```(?:json)?/i,'').replace(/```$/i,'').trim();
  try{ return JSON.parse(cleaned); }catch{
    const firstBrace=cleaned.indexOf('{'); const firstBracket=cleaned.indexOf('[');
    let start=0, end=cleaned.length;
    if(firstBrace!==-1 && (firstBracket===-1 || firstBrace<firstBracket)){ start=firstBrace; end=cleaned.lastIndexOf('}')+1; }
    else if(firstBracket!==-1){ start=firstBracket; end=cleaned.lastIndexOf(']')+1; }
    const sliced=cleaned.slice(start,end);
    try{ return JSON.parse(sliced); }catch{ throw new Error(t('gclient_parse_failed', { preview: raw.slice(0, 100) })); }
  }
}

export async function testGeminiApiKey(key:string):Promise<boolean>{
  // Backward-compatible boolean wrapper; use testGeminiApiKeyDetailed for real error text.
  const r = await testGeminiApiKeyDetailed(key);
  return r.ok;
}
