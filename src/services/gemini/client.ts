import { GoogleGenAI } from "@google/genai";
import { rateLimiter } from "./rateLimiter";
import { checkDailyQuota, incrementQuota, getClientGeminiApiKey, callGroqDirect, getClientGroqApiKey, GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_SAFETY_MODELS } from "./providers";

function extractErrorText(err: any): string {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const rawMsg: string = err?.message || err?.error?.message || String(err ?? 'Unknown error');
  const msg = rawMsg.slice(0, 500);
  if (status === 400 || /API key not valid|API_KEY_INVALID|invalid/i.test(msg)) {
    return `Invalid API key (400). Check the key was copied fully from Google AI Studio, no extra spaces. Details: ${msg}`;
  }
  if (status === 403 || /PERMISSION_DENIED|forbidden/i.test(msg)) {
    return `Key forbidden (403): the key lacks Gemini API access or the API is disabled in Google Cloud. Details: ${msg}`;
  }
  if (status === 404 || /NOT_FOUND|not found|Retired|deprecated|model/i.test(msg)) {
    return `Model not found (404): the requested model may be retired. Try ${GEMINI_DEFAULT_MODEL} / ${GEMINI_FALLBACK_MODEL}. Details: ${msg}`;
  }
  if (status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate/i.test(msg)) {
    return `Rate limited / quota exhausted (429). Wait a minute or use your own key. Details: ${msg}`;
  }
  return status ? `Gemini error (${status}): ${msg}` : `Gemini error: ${msg}`;
}

export async function testGeminiApiKeyDetailed(key: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  const trimmed = (key || '').trim();
  if (!trimmed) return { ok: false, error: 'Please enter an API key first.' };
  const candidates = Array.from(new Set([GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL]));
  let lastError = '';
  for (const model of candidates) {
    try {
      const ai = new GoogleGenAI({ apiKey: trimmed });
      const response = await ai.models.generateContent({ model, contents: 'Respond with "pong".' });
      if ((response.text || '').toLowerCase().includes('pong')) return { ok: true, model };
      lastError = `Model ${model} responded but did not return "pong". Check key permissions and model access.`;
    } catch (err) {
      lastError = extractErrorText(err);
      const isModelNotFound =
        (err as any)?.status === 404 || /NOT_FOUND|not found|Retired|deprecated/i.test(String((err as any)?.message || ''));
      if (!isModelNotFound) return { ok: false, error: lastError, model };
    }
  }
  return { ok: false, error: lastError || 'Connection failed. Please check your API key.', model: candidates[0] };
}

export async function testGroqApiKeyDetailed(key: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (key || '').trim();
  if (!trimmed) return { ok: false, error: 'Please enter a Groq API key first.' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${trimmed}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Respond with "pong".' }], temperature: 0 }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { const data = await res.json(); detail = data?.error?.message || detail; } catch {}
      if (res.status === 401) return { ok: false, error: `Invalid Groq key (401). ${detail}`.slice(0, 500) };
      if (res.status === 429) return { ok: false, error: `Groq rate limited (429). ${detail}`.slice(0, 500) };
      return { ok: false, error: `Groq error (${res.status}): ${detail}`.slice(0, 500) };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `Groq test failed: ${(err?.message || String(err)).slice(0, 500)}` };
  }
}

export async function callGemini(params: { contents: any; config?: any; model?: string }): Promise<string> {
  if (!checkDailyQuota()) throw new Error('Daily Gemini quota reached (50/day). Try tomorrow or set your own API key.');
  return rateLimiter.execute(async () => {
    incrementQuota();
    const clientKey = getClientGeminiApiKey();
    const targetModel = params.model || GEMINI_DEFAULT_MODEL;
    let lastErrorMessage = '';

    if (clientKey) {
      const attempts = Array.from(
        new Set([targetModel, GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, ...GEMINI_SAFETY_MODELS])
      );
      for (const m of attempts) {
        try {
          const ai = new GoogleGenAI({ apiKey: clientKey });
          const res = await ai.models.generateContent({ model: m, contents: params.contents, config: params.config });
          if (!res.text || !res.text.trim()) throw new Error(`Empty response returned by ${m}.`);
          return res.text;
        } catch (e: any) {
          lastErrorMessage = extractErrorText(e);
          if (e?.status === 429 || e?.message?.includes('429')) throw e;
          const isModelNotFound = e?.status === 404 || /NOT_FOUND|not found|Retired|deprecated/i.test(String(e?.message || ''));
          if (!isModelNotFound) break;
        }
      }
      console.warn('Client Gemini failed, trying server proxy:', lastErrorMessage);
    }

    try {
      const serverRes = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: params.contents, config: params.config, model: targetModel }),
      });
      const contentType = serverRes.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Unexpected response from /api/gemini/generate (${serverRes.status}, content-type: ${contentType || 'unknown'}).`);
      }
      const data = await serverRes.json();
      if (serverRes.ok) {
        if (!data?.text || !String(data.text).trim()) {
          throw new Error('Server returned an empty AI response.');
        }
        return String(data.text);
      }
      lastErrorMessage = data?.error || `Server AI proxy error (${serverRes.status}).`;
      if (serverRes.status === 429) {
        throw new Error(lastErrorMessage);
      }
    } catch (e: any) {
      if (!lastErrorMessage) lastErrorMessage = e?.message || String(e);
      console.warn('Server proxy failed:', lastErrorMessage);
    }

    if (getClientGroqApiKey()) {
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

    throw new Error(lastErrorMessage || 'AI service unavailable across configured providers. Check your API key or try again.');
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
    try{ return JSON.parse(sliced); }catch{ throw new Error(`Failed parse ${raw.slice(0,100)}`); }
  }
}

export async function testGeminiApiKey(key:string):Promise<boolean>{
  // Backward-compatible boolean wrapper; use testGeminiApiKeyDetailed for real error text.
  const r = await testGeminiApiKeyDetailed(key);
  return r.ok;
}
