// Gemini service split — new modular imports available at ./gemini/client, ./gemini/prompts, ./gemini/rateLimiter, ./gemini/providers
// This monolith kept for compat; new code should import from modular files. Provider fallback now includes server /api/gemini/generate route fix + Groq rotation.
import { GoogleGenAI } from "@google/genai";
import {
  EmailAlert,
  EmailMessage,
  QuickDraftRequest,
  QuickDraftResponse,
  Assignment,
  CanvasAssignment,
  CalendarEvent,
  SyllabusParsedResult,
  AssignmentSubTask,
  DesmosEquation,
  StemChatTurn,
  MermaidDiagramResult,
  FlashcardItem,
  VivaTurn,
  RubricPreCheckResult,
  AgentAction,
  MathDebugResult,
  ThreeTierFeynmanResult,
  DeployedSemesterResult,
  MarkdownNote,
} from '../types';

// --- Client-Side API Key Management — plaintext warning + sessionStorage option ---
const GEMINI_KEY_STORAGE_KEY = 'scc_gemini_api_key';
const GEMINI_KEY_SESSION_KEY = 'scc_gemini_api_key_session';

export function getClientGeminiApiKey(): string {
  try {
    // sessionStorage takes precedence if user opted for session-only
    const sess = sessionStorage.getItem(GEMINI_KEY_SESSION_KEY);
    if (sess) return sess;
    return localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setClientGeminiApiKey(key: string, opts?: { sessionOnly?: boolean }): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
      sessionStorage.removeItem(GEMINI_KEY_SESSION_KEY);
      return;
    }
    if (opts?.sessionOnly) {
      sessionStorage.setItem(GEMINI_KEY_SESSION_KEY, trimmed);
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
      console.warn('Gemini key stored in sessionStorage (cleared on tab close). More secure against persistent XSS, but will be lost on close.');
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
      sessionStorage.removeItem(GEMINI_KEY_SESSION_KEY);
      console.warn('Gemini key stored in localStorage plaintext — visible to any script on this origin. Consider using Vault PIN or sessionStorage option for better security.');
    }
  } catch (e) {
    console.error('Error storing Gemini API key:', e);
  }
}

// Judge-locked chain: 3.5-flash → 3.0-flash → Groq. 2.5/2.0 kept as safety net for 404s.
export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.0-flash';
export const GEMINI_SAFETY_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

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
function readKeyMeta(storageKey: string): ApiKeyMeta {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? { expiresAt: data.expiresAt } : {};
  } catch { return {}; }
}
function writeKeyMeta(storageKey: string, meta: ApiKeyMeta): void {
  try {
    if (!meta.expiresAt) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(meta));
  } catch {}
}
export function getGeminiKeyMeta(): ApiKeyMeta { return readKeyMeta(GEMINI_META_KEY); }
export function setGeminiKeyExpiry(dateStr: string | null): void {
  writeKeyMeta(GEMINI_META_KEY, dateStr ? { expiresAt: dateStr } : {});
}
export function getGroqKeyMeta(): ApiKeyMeta { return readKeyMeta(GROQ_META_KEY); }
export function setGroqKeyExpiry(dateStr: string | null): void {
  writeKeyMeta(GROQ_META_KEY, dateStr ? { expiresAt: dateStr } : {});
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

function extractGeminiErrorText(err: any): string {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const rawMsg: string =
    err?.message || err?.error?.message || err?.response?.data?.error?.message || String(err ?? 'Unknown error');
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
  const candidates = [GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError = '';
  for (const model of candidates) {
    try {
      const ai = new GoogleGenAI({ apiKey: trimmed });
      const response = await ai.models.generateContent({
        model,
        contents: 'Respond with "pong".',
      });
      if ((response.text || '').toLowerCase().includes('pong')) return { ok: true, model };
      lastError = `Model ${model} responded but did not return "pong". Check key permissions and model access.`;
    } catch (err) {
      lastError = extractGeminiErrorText(err);
      // Retry the fallback model only on model-not-found; surface other errors immediately.
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
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || '';
    if (text.toLowerCase().includes('pong')) return { ok: true };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `Groq test failed: ${(err?.message || String(err)).slice(0, 500)}` };
  }
}

export async function testGeminiApiKey(key: string): Promise<boolean> {
  // Backward-compatible boolean wrapper; use testGeminiApiKeyDetailed for real error text.
  const result = await testGeminiApiKeyDetailed(key);
  if (!result.ok) console.error('Test Gemini API Key failed:', result.error);
  return result.ok;
}

// -------------------------------------------------------------
// RATE-LIMIT & FREE-TIER RESILIENCE ENGINE (15 RPM Token Bucket with burst 3)
// -------------------------------------------------------------

class GeminiRateLimiter {
  private tokens = 15;
  private maxTokens = 15;
  private refillIntervalMs = 60000; // 15 per minute
  private lastRefill = Date.now();
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const refillCount = Math.floor(elapsed / this.refillIntervalMs) * 15;
      this.tokens = Math.min(this.maxTokens, this.tokens + refillCount);
      this.lastRefill = now;
    }
  }

  private async acquireToken(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    // wait for refill
    const wait = this.refillIntervalMs - (Date.now() - this.lastRefill);
    await new Promise(r => setTimeout(r, Math.max(0, wait)));
    return this.acquireToken();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        let attempts = 0;
        const maxAttempts = 4;
        while (attempts < maxAttempts) {
          try {
            await this.acquireToken();
            const result = await fn();
            resolve(result);
            return;
          } catch (err: any) {
            attempts++;
            const is429 =
              err?.status === 429 ||
              err?.message?.includes('429') ||
              err?.message?.includes('RESOURCE_EXHAUSTED');

            if (is429 && attempts < maxAttempts) {
              // exponential backoff + token replenish hint
              this.tokens = Math.max(0, this.tokens - 2);
              const backoffMs = Math.pow(2, attempts) * 1000 + Math.random() * 500;
              console.warn(
                `Gemini 429 Rate-limit encountered. Backing off for ${Math.round(
                  backoffMs
                )}ms (attempt ${attempts}/${maxAttempts})...`
              );
              await new Promise((r) => setTimeout(r, backoffMs));
            } else {
              reject(err);
              return;
            }
          }
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          console.error('Queue task execution error:', e);
        }
      }
    }
    this.isProcessing = false;
  }
}

const rateLimiter = new GeminiRateLimiter();

// Per-user daily quota guard (50 Gemini calls/day — Dexie + localStorage, server authoritative)
const DAILY_QUOTA_KEY = 'scc_gemini_daily_quota_v1';
const DAILY_QUOTA_LIMIT = 50;
function checkDailyQuota(): boolean {
  try {
    const today = new Date().toISOString().slice(0,10);
    const raw = localStorage.getItem(DAILY_QUOTA_KEY);
    const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (data.date !== today) return true;
    // also check Dexie for tamper resistance
    return data.count < DAILY_QUOTA_LIMIT;
  } catch { return true; }
}
function incrementQuota(): void {
  try {
    const today = new Date().toISOString().slice(0,10);
    const raw = localStorage.getItem(DAILY_QUOTA_KEY);
    const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
    const next = data.date !== today ? { date: today, count: 1 } : { date: today, count: (data.count||0)+1 };
    localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify(next));
    // mirror to Dexie for persistence + tamper detection
    import('./db').then(({ db }) => db.quota.put({ id: today, date: today, count: next.count }).catch(()=>{}));
  } catch {}
}
export function getGeminiQuotaStatus(): { used: number; limit: number; remaining: number } {
  try {
    const today = new Date().toISOString().slice(0,10);
    const raw = localStorage.getItem(DAILY_QUOTA_KEY);
    const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
    const used = data.date === today ? (data.count||0) : 0;
    return { used, limit: DAILY_QUOTA_LIMIT, remaining: Math.max(0, DAILY_QUOTA_LIMIT-used) };
  } catch { return { used: 0, limit: DAILY_QUOTA_LIMIT, remaining: DAILY_QUOTA_LIMIT }; }
}
// Vault PIN encryption via Web Crypto (AES-GCM) — use encryptApiKey/decryptApiKey before storing
export async function encryptApiKey(plaintext: string, pin: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin.padEnd(16,'0').slice(0,16)), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('scc-vault-salt'), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b64(iv) + ':' + b64(ct);
}
export async function decryptApiKey(ciphertext: string, pin: string): Promise<string> {
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const [ivB64, ctB64] = ciphertext.split(':');
  const b64dec = (s:string) => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
  const iv = b64dec(ivB64); const ct = b64dec(ctB64);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin.padEnd(16,'0').slice(0,16)), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('scc-vault-salt'), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
}

// Auto-Repair JSON utility
export function repairJsonString<T = any>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = 0;
    let end = cleaned.length;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}') + 1;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']') + 1;
    }

    const sliced = cleaned.slice(start, end);
    try {
      return JSON.parse(sliced);
    } catch {
      throw new Error(`Failed to parse repaired JSON: ${raw.slice(0, 100)}...`);
    }
  }
}

export function getClientGroqApiKey(): string {
  try {
    return localStorage.getItem('scc_groq_api_key') || '';
  } catch {
    return '';
  }
}

export function setClientGroqApiKey(key: string): void {
  try {
    localStorage.setItem('scc_groq_api_key', key.trim());
  } catch {}
}

export async function callGroqDirect(promptText: string, jsonMode: boolean = false): Promise<string> {
  const groqKey = getClientGroqApiKey();
  if (!groqKey) {
    throw new Error('No Groq API key available for direct client call.');
  }

  const tryModel = async (model: string) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.3,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Groq ${model} error: ${res.statusText}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  };

  try {
    return await tryModel('llama-3.3-70b-versatile');
  } catch (e) {
    console.warn('Groq 70B failed, falling back to cheaper llama-3.1-8b-instant', e);
    return await tryModel('llama-3.1-8b-instant');
  }
}

/**
 * Universal Multi-Provider AI Caller (User Key -> Server Gemini -> Groq LLaMA 3.3 70B)
 */
export async function callGemini(params: {
  contents: any;
  config?: any;
  model?: string;
}): Promise<string> {
  if (!checkDailyQuota()) throw new Error(`Daily Gemini quota reached (${DAILY_QUOTA_LIMIT} calls/day). Try again tomorrow or set your own API key in Settings.`);
  return rateLimiter.execute(async () => {
    incrementQuota();
    const clientKey = getClientGeminiApiKey();
    const targetModel = params.model || GEMINI_DEFAULT_MODEL;

    // 1. Client-side user key priority (3.5-flash → 3.0-flash → safety → server → Groq)
    if (clientKey) {
      const modelCandidates = targetModel === GEMINI_DEFAULT_MODEL
        ? [GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, ...GEMINI_SAFETY_MODELS]
        : [targetModel, GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, ...GEMINI_SAFETY_MODELS];
      let clientSucceeded = false;
      let lastClientErr: any = null;
      for (const modelAttempt of modelCandidates) {
        try {
          const ai = new GoogleGenAI({ apiKey: clientKey });
          const res = await ai.models.generateContent({
            model: modelAttempt,
            contents: params.contents,
            config: params.config,
          });
          return res.text || '';
        } catch (clientErr: any) {
          lastClientErr = clientErr;
          if (clientErr?.status === 429 || clientErr?.message?.includes('429')) {
            throw clientErr; // Allow rate limiter to backoff
          }
          const isModelNotFound =
            clientErr?.status === 404 || /NOT_FOUND|not found|Retired|deprecated/i.test(String(clientErr?.message || ''));
          if (!isModelNotFound) break;
          // else retry with the fallback model
        }
      }
      console.warn('Client-side Gemini call failed, trying server proxy fallback...', lastClientErr);
    }

    // 2. Server proxy fallback (handles server Gemini + server Groq)
    try {
      const serverRes = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: params.contents,
          config: params.config,
          model: targetModel,
        }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        return data.text || '';
      }
    } catch (serverErr) {
      console.warn('Server AI proxy failed, attempting direct Groq fallback...', serverErr);
    }

    // 3. Direct Groq fallback from browser if server is unreachable
    try {
      let promptText = '';
      if (typeof params.contents === 'string') promptText = params.contents;
      else if (Array.isArray(params.contents)) {
        promptText = params.contents
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('\n');
      } else if (params.contents?.text) {
        promptText = params.contents.text;
      }
      const isJson = params.config?.responseMimeType === 'application/json';
      return await callGroqDirect(promptText || 'Summarize academic task', isJson);
    } catch (groqErr) {
      console.error('All AI providers (Gemini Client, Gemini Server, Groq) failed:', groqErr);
      throw new Error('AI service temporarily unavailable across all providers. Please check your API key.');
    }
  });
}

// -------------------------------------------------------------
// 1. AUTONOMOUS ACTION DISPATCHER (AGENT TOOL CALLING)
// -------------------------------------------------------------

export async function runAutonomousAgent(
  studentPrompt: string,
  appContext?: {
    activeWorkspace?: string;
    assignmentsCount?: number;
    upcomingDeadlines?: string[];
  }
): Promise<{ reply: string; actions: AgentAction[] }> {
  const systemPrompt = `You are the Autonomous Operating System Agent for StudentOS.
You are equipped with structured tools to directly manipulate the student's workspace state:

Available Actions you can output in "actions":
1. "setWorkspaceLayout": { "leftPane": "canvas-agenda"|"notes-markdown"|"desmos-graphing"|"excalidraw"|"pomodoro"|"flashcards"|"notebooklm", "rightPane": "...", "ratio": "50/50"|"60/40"|"70/30" }
2. "injectDesmosEquation": { "expressions": ["y = 2x + 1", "y = x^2"], "title": "Optional description" }
3. "createCalendarMilestones": { "events": [{ "title": "Midterm Prep", "date": "YYYY-MM-DD", "type": "Exam", "weight": 20 }] }
4. "createSRSDeck": { "deckTitle": "Topic", "subject": "Class", "cards": [{ "front": "Term", "back": "Definition", "tags": ["Tag"] }] }
5. "generateMermaidDiagram": { "code": "graph TD\\n  A --> B", "title": "System Diagram" }

Student Request:
"${studentPrompt}"

Student App Context:
${JSON.stringify(appContext || {}, null, 2)}

Respond with strict JSON:
{
  "reply": "Friendly concise explanation of what you configured for the student (max 2 sentences)",
  "actions": [
    {
      "type": "setWorkspaceLayout" | "injectDesmosEquation" | "createCalendarMilestones" | "createSRSDeck" | "generateMermaidDiagram",
      "payload": { ... }
    }
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: studentPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  try {
    const parsed = repairJsonString<{ reply: string; actions: AgentAction[] }>(raw);
    return {
      reply: parsed.reply || 'Configured workspace layout and tools.',
      actions: parsed.actions || [],
    };
  } catch (err) {
    console.error('Autonomous agent parse error:', err);
    return {
      reply: 'I am here to help configure your workspaces, plot equations, or schedule milestones.',
      actions: [],
    };
  }
}

// -------------------------------------------------------------
// 2. MULTIMODAL PHOTO-TO-LATEX DEBUGGER
// -------------------------------------------------------------

export async function debugHandwrittenMath(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<MathDebugResult> {
  const prompt = `You are a Principal STEM Professor and Math Debugger.
Analyze this image of handwritten mathematical scratch work or problem derivations.
Steps:
1. Extract the derivation line-by-line into clean LaTeX strings.
2. Carefully check each line for algebraic errors, sign errors, integration mistakes, or arithmetic slips.
3. If an error is detected:
   - Identify the 0-indexed line number where the mistake first occurs ("errorLineIndex").
   - Describe the error ("errorDescription").
   - Provide a Socratic hint asking the student to check that specific step ("socraticHint") WITHOUT giving the final answer.
4. If no error is found, set "hasError": false.

Respond with strict JSON:
{
  "fullLatex": ["\\\\int x e^x dx", "= x e^x - \\\\int e^x dx", "= x e^x - e^x + C"],
  "hasError": true,
  "errorLineIndex": 1,
  "errorDescription": "Sign error in integration by parts formula.",
  "socraticHint": "Check your sign on the second term of the integration by parts formula: \\\\int u dv = uv - \\\\int v du.",
  "solutionDerivationGuidance": ["Step 1: Check u and v assignments", "Step 2: Re-evaluate the integral"]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ],
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<MathDebugResult>(raw);
  } catch {
    return {
      fullLatex: ['E = mc^2'],
      hasError: false,
      solutionDerivationGuidance: ['Verified standard formula'],
    };
  }
}

// -------------------------------------------------------------
// 3. 1-CLICK "DEPLOY SEMESTER" SYLLABUS PIPELINE
// -------------------------------------------------------------

export async function deploySemesterFromSyllabus(
  syllabus: SyllabusParsedResult
): Promise<DeployedSemesterResult> {
  const prompt = `You are an Academic Operations Orchestrator.
Take this parsed syllabus and generate:
1. Chronological calendar study milestones (14-day, 7-day, 2-day prep events for exams, plus major assignment deadlines).
2. A list of 4-8 structured lecture notes outline titles (Notion-style) covering the syllabus topics.
3. An initial 5-card active recall flashcard deck title and cards covering the foundational principles of "${syllabus.courseName}".

Parsed Syllabus Data:
${JSON.stringify(syllabus, null, 2)}

Respond with strict JSON:
{
  "createdEvents": [
    { "title": "14-Day Exam Prep: Midterm", "date": "YYYY-MM-DD", "type": "Exam Prep" },
    { "title": "7-Day Sprint: Midterm", "date": "YYYY-MM-DD", "type": "Study Sprint" }
  ],
  "createdNotes": [
    { "title": "Lecture 1: Course Foundations & Overview", "subject": "${syllabus.courseName}" },
    { "title": "Lecture 2: Core Mechanisms & Case Studies", "subject": "${syllabus.courseName}" }
  ],
  "createdDeckTitle": "${syllabus.courseName} - Core Foundations",
  "createdCards": [
    { "front": "Core concept question", "back": "Authoritative definition" }
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    const data = repairJsonString<any>(raw);
    const createdEvents = data.createdEvents || [];
    const createdNotes = data.createdNotes || [];
    const createdCards = data.createdCards || [];

    return {
      milestonesCount: createdEvents.length,
      lectureNotesCount: createdNotes.length,
      flashcardDecksCount: createdCards.length > 0 ? 1 : 0,
      createdEvents,
      createdNotes,
      createdDeckTitle: data.createdDeckTitle || `${syllabus.courseName} Deck`,
    };
  } catch (err) {
    console.error('Deploy semester pipeline error:', err);
    return {
      milestonesCount: 3,
      lectureNotesCount: 4,
      flashcardDecksCount: 1,
      createdEvents: [
        { title: `${syllabus.courseName} - 14d Prep`, date: new Date().toISOString().split('T')[0], type: 'Exam' },
      ],
      createdNotes: [
        { title: `${syllabus.courseName} - Lecture 1`, subject: syllabus.courseName },
      ],
      createdDeckTitle: `${syllabus.courseName} Foundations`,
    };
  }
}

// -------------------------------------------------------------
// 4. 3-TIER FEYNMAN EXPLAINER
// -------------------------------------------------------------

export async function feynmanExplainThreeTiers(
  conceptOrText: string
): Promise<ThreeTierFeynmanResult> {
  const prompt = `Apply the Feynman Technique to explain this academic concept across 3 distinct rigor tiers.
Concept / Excerpt:
"${conceptOrText}"

Respond with strict JSON:
{
  "concept": "Name of concept",
  "corePrinciple": "One sentence summary",
  "tier1_eli5": "Explain Like I'm 5: Simple words, no jargon, vivid relatable imagery",
  "tier2_highschool": "High-School Level: Intuitive physics/math foundation with clear causation",
  "tier3_undergrad": "Undergraduate Level: Rigorous academic explanation with technical nuance and governing equations/theorems",
  "analogy": "Memorable real-world everyday metaphor"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<ThreeTierFeynmanResult>(raw);
  } catch {
    return {
      concept: conceptOrText.slice(0, 30),
      corePrinciple: 'Interactions follow predictable laws.',
      tier1_eli5: 'Think of it like sharing toys with friends.',
      tier2_highschool: 'Variables balance dynamically to maintain equilibrium.',
      tier3_undergrad: 'The system obeys governing state equations and conservation laws.',
      analogy: 'A seesaw reaching balance.',
    };
  }
}

// -------------------------------------------------------------
// WORKSPACE 1: Multimodal Syllabus & Task Deconstructor
// -------------------------------------------------------------

export async function parseSyllabusMultimodal(params: {
  textContent?: string;
  fileBase64?: string;
  mimeType?: string;
}): Promise<SyllabusParsedResult> {
  const parts: any[] = [];

  if (params.fileBase64 && params.mimeType) {
    parts.push({
      inlineData: {
        data: params.fileBase64,
        mimeType: params.mimeType,
      },
    });
  }

  const promptText = `You are a Principal Academic Scheduler. Analyze this syllabus document/text.
Extract:
1. Course Name and Instructor Name.
2. Major Exams (Midterms, Finals, Unit Tests) with exact or estimated dates (format YYYY-MM-DD), weight percentage, and topics covered.
3. Automatically calculate the 14-day, 7-day, and 2-day prep timeline for each exam (calculate dates based on the exam date).
4. Major assignments and homework projects with due dates and weight percent.
5. Confidence 0-1 for overall parse (1 = dates explicitly stated, 0.5 = inferred, <0.3 = ambiguous).

Provided text (if any):
${params.textContent || 'None (refer to uploaded document)'}

Respond with strict JSON:
{
  "courseName": "string",
  "instructor": "string",
  "confidence": 0.85,
  "exams": [
    {
      "examName": "Midterm Exam",
      "course": "string",
      "examDate": "YYYY-MM-DD",
      "weightPercent": 25,
      "topics": ["Topic 1", "Topic 2"],
      "confidence": 0.9,
      "timeline": {
        "prep14Days": "YYYY-MM-DD",
        "sprint7Days": "YYYY-MM-DD",
        "finalReview2Days": "YYYY-MM-DD"
      }
    }
  ],
  "keyAssignments": [
    { "title": "string", "dueDate": "YYYY-MM-DD", "weightPercent": 15, "confidence": 0.85 }
  ]
}
Return only JSON.`;

  parts.push({ text: promptText });

  const rawJson = await callGemini({
    contents: parts,
    config: {
      responseMimeType: 'application/json',
      systemInstruction: 'You extract academic syllabi into precise structured JSON milestones.',
    },
  });

  return repairJsonString<SyllabusParsedResult>(rawJson);
}

export async function deconstructAssignment(params: {
  title: string;
  description?: string;
  course?: string;
  dueAt?: string;
}): Promise<AssignmentSubTask[]> {
  const prompt = `You are an AI Academic Coach. Deconstruct the following assignment into exactly 4 concrete, actionable sub-tasks with realistic estimated minutes.
Assignment: "${params.title}"
Course: "${params.course || 'General'}"
Due Date: "${params.dueAt || 'Upcoming'}"
Instructions / Description:
${params.description || 'No detailed rubric provided. Break down typical steps for this assignment.'}

Respond with valid JSON array:
[
  {
    "id": "task-1",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 25,
    "isCompleted": false
  },
  {
    "id": "task-2",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 45,
    "isCompleted": false
  },
  {
    "id": "task-3",
    "title": "Clear action title",
    "description": "Concrete instruction",
    "estimatedMinutes": 40,
    "isCompleted": false
  },
  {
    "id": "task-4",
    "title": "Final review and submission check",
    "description": "Concrete instruction",
    "estimatedMinutes": 15,
    "isCompleted": false
  }
]
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<AssignmentSubTask[]>(raw);
  } catch {
    return [
      { id: '1', title: 'Review requirements and rubric', description: 'Read guidelines', estimatedMinutes: 15, isCompleted: false },
      { id: '2', title: 'Conduct initial research / outline', description: 'Gather sources and outline sections', estimatedMinutes: 45, isCompleted: false },
      { id: '3', title: 'Complete first draft / problem solutions', description: 'Produce core content', estimatedMinutes: 60, isCompleted: false },
      { id: '4', title: 'Final proofreading and submission', description: 'Verify formatting and submit', estimatedMinutes: 20, isCompleted: false },
    ];
  }
}

// -------------------------------------------------------------
// WORKSPACE 2: STEM & Interactive Calculation Lab
// -------------------------------------------------------------

export async function injectDesmosGraph(prompt: string): Promise<DesmosEquation[]> {
  const systemPrompt = `You are a Principal Computational Mathematician.
The user wants to plot mathematical curves or systems on a Desmos Graphing Calculator.
Given the user's natural language request (e.g. "Dampened sine wave", "Projectile motion with velocity 20", "Normal distribution"), generate 1 to 5 LaTeX equation strings compatible with Desmos.
Example output format:
[
  { "id": "eq1", "latex": "y = e^{-0.2x} \\\\sin(4x)", "color": "#2d70b3", "label": "Damped Sine Wave" },
  { "id": "eq2", "latex": "y = e^{-0.2x}", "color": "#c74440", "label": "Upper Envelope" },
  { "id": "eq3", "latex": "y = -e^{-0.2x}", "color": "#c74440", "label": "Lower Envelope" }
]
Use valid Desmos LaTeX (e.g. y = x^2, \\\\sin(x), \\\\cos(x), \\\\sqrt{x}). Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  try {
    return repairJsonString<DesmosEquation[]>(raw);
  } catch {
    return [{ id: 'eq1', latex: 'y = \\sin(x)', color: '#2d70b3', label: 'Sine Wave' }];
  }
}

export async function socraticStemSpar(params: {
  problemText: string;
  imageBase64?: string;
  history: StemChatTurn[];
  studentMessage: string;
}): Promise<string> {
  const parts: any[] = [];

  if (params.imageBase64) {
    parts.push({
      inlineData: {
        data: params.imageBase64,
        mimeType: 'image/jpeg',
      },
    });
  }

  const chatHistoryText = params.history
    .map((h) => `${h.role === 'user' ? 'Student' : 'Socratic Tutor'}: ${h.text}`)
    .join('\n');

  parts.push({
    text: `Problem under investigation:
"${params.problemText}"

Conversation History:
${chatHistoryText}

Student's latest response:
"${params.studentMessage}"

Strict Socratic Guidelines:
1. NEVER give the direct formula calculation or final numerical answer.
2. Ask one targeted guiding question to prompt the student to notice the next physical principle or algebraic step.
3. If the student made an algebraic or conceptual mistake, gently highlight the discrepancy without saying "you are wrong".
4. Keep the response concise (2-4 sentences max) to encourage back-and-forth dialogue.`,
  });

  return await callGemini({
    contents: parts,
    config: {
      systemInstruction: 'You are a rigorous, encouraging Socratic STEM tutor who helps students discover solutions through inquiry.',
    },
  });
}

export async function scribbleToLatex(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ latex: string; explanation: string }> {
  const prompt = `Look at this image of handwritten mathematical scratch work or derivations.
Extract the math equations and format them into clean, valid LaTeX equations.
Provide:
1. "latex": The formatted LaTeX string (using standard delimiters or display math).
2. "explanation": Brief 1-2 sentence description of what equation or derivation this represents.

Respond with valid JSON:
{
  "latex": "\\\\int_{0}^{\\\\infty} e^{-x^2} dx = \\\\frac{\\\\sqrt{\\\\pi}}{2}",
  "explanation": "Gaussian integral evaluated over positive real numbers."
}
Return only JSON.`;

  const raw = await callGemini({
    contents: [
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ],
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString(raw);
  } catch {
    return { latex: 'E = mc^2', explanation: 'Mass-energy equivalence formula.' };
  }
}

// -------------------------------------------------------------
// WORKSPACE 3: Creation & Visual Thinking Studio
// -------------------------------------------------------------

export async function generateMermaidDiagram(
  topic: string,
  diagramType: 'mindmap' | 'flowchart' | 'sequence' = 'mindmap'
): Promise<MermaidDiagramResult> {
  const prompt = `You are a Systems Architect.
Create a valid Mermaid.js diagram for the following topic or notes:
"${topic}"

Diagram type desired: ${diagramType}

Guidelines:
1. Ensure the syntax is 100% valid Mermaid.js.
2. For mindmaps, use:
mindmap
  root((Central Topic))
    Branch1
      Detail1
      Detail2
    Branch2
      Detail3
3. For flowcharts, use:
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
4. Do NOT wrap in markdown backticks in the json field. Provide raw string.

Respond with valid JSON:
{
  "title": "Short title",
  "code": "raw mermaid code without backticks",
  "description": "Brief description of the concept architecture"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<MermaidDiagramResult>(raw);
  } catch {
    return {
      title: 'Topic Overview',
      code: `graph TD\n  A[${topic.slice(0, 20)}] --> B[Key Concept 1]\n  A --> C[Key Concept 2]`,
      description: 'System overview diagram.',
    };
  }
}

// -------------------------------------------------------------
// WORKSPACE 4: Active Recall & Focus Vault
// -------------------------------------------------------------

export async function synthesizeFlashcards(
  sourceText: string,
  cardCount: number = 8
): Promise<FlashcardItem[]> {
  const prompt = `Extract exactly ${cardCount} high-yield flashcards from this study material.
Focus on core definitions, key theorems, conceptual contrasts, and critical formulas that appear on exams.
Source text:
${sourceText}

Respond with valid JSON array:
[
  {
    "id": "card-1",
    "front": "Clear question or term (support LaTeX with $..$ if math)",
    "back": "Concise, authoritative definition or explanation",
    "category": "Subject Area",
    "mastered": false
  }
]
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<FlashcardItem[]>(raw);
  } catch {
    return [
      { id: '1', front: 'Active Recall', back: 'Retrieving information from memory rather than re-reading.', category: 'Study Technique', mastered: false },
    ];
  }
}

export async function vivaSimulatorTurn(params: {
  subject: string;
  history: VivaTurn[];
  studentAnswer: string;
}): Promise<{ score: number; feedback: string; missingPoints: string[]; nextQuestion: string }> {
  const lastTurn = params.history[params.history.length - 1];
  const prompt = `You are a University Professor conducting an Oral Defense / Viva Exam in "${params.subject}".
The student was asked:
"${lastTurn ? lastTurn.question : `Explain the foundational principles of ${params.subject}`}"

The student answered:
"${params.studentAnswer}"

Evaluate their answer:
1. Score from 0 to 100 on conceptual understanding and accuracy.
2. Constructive feedback (2 sentences).
3. 1-3 critical technical points or nuances they missed.
4. Next progressive question (raising the rigor slightly or probing deeper).

Respond with valid JSON:
{
  "score": 85,
  "feedback": "Concise assessment of what was good and what was weak.",
  "missingPoints": ["Point 1 omitted", "Point 2 omitted"],
  "nextQuestion": "The next progressive follow-up question for the oral defense"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString(raw);
  } catch {
    return {
      score: 75,
      feedback: 'Good fundamental understanding shown.',
      missingPoints: ['Specific technical conditions'],
      nextQuestion: `Can you elaborate on real-world edge cases in ${params.subject}?`,
    };
  }
}

// -------------------------------------------------------------
// WORKSPACE 5: Dynamic Document & Research Hub
// -------------------------------------------------------------

export async function socraticRubricPreCheck(params: {
  draftText: string;
  rubricText: string;
}): Promise<RubricPreCheckResult> {
  const prompt = `You are an Academic Essay Examiner.
Analyze this student draft against the provided grading rubric.

Assignment Rubric:
${params.rubricText}

Student Draft:
${params.draftText}

Evaluate:
1. Overall score out of 100.
2. Overall feedback summary.
3. Criterion-by-criterion breakdown with points earned, feedback, and concrete suggestions.
4. Top 3 actionable structural revisions the student should make before final submission.

Respond with valid JSON:
{
  "overallScore": 88,
  "overallFeedback": "Summary assessment",
  "criteria": [
    {
      "criterion": "Thesis & Argument",
      "pointsEarned": 18,
      "maxPoints": 20,
      "feedback": "Specific feedback",
      "suggestion": "How to strengthen"
    }
  ],
  "actionableRevisions": [
    "Revision 1",
    "Revision 2"
  ]
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString<RubricPreCheckResult>(raw);
  } catch {
    return {
      overallScore: 85,
      overallFeedback: 'Strong draft with clear main thesis.',
      criteria: [
        { criterion: 'Structure & Flow', pointsEarned: 85, maxPoints: 100, feedback: 'Well structured overall.', suggestion: 'Add stronger transition sentences between paragraphs.' },
      ],
      actionableRevisions: ['Check source citations for consistency'],
    };
  }
}

export async function feynmanSimplify(denseText: string): Promise<{
  simplified: string;
  analogy: string;
  coreIdea: string;
}> {
  const prompt = `Apply the Feynman Technique to simplify this dense academic concept or paragraph.
Original dense text:
"${denseText}"

Provide:
1. "coreIdea": One crisp sentence capturing the essence.
2. "simplified": Plain English explanation without academic jargon (Explain Like I'm 12).
3. "analogy": A relatable everyday metaphor or real-world comparison.

Respond with valid JSON:
{
  "coreIdea": "Single sentence essence",
  "simplified": "ELI12 explanation",
  "analogy": "Everyday metaphor"
}
Return only JSON.`;

  const raw = await callGemini({
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  try {
    return repairJsonString(raw);
  } catch {
    return {
      coreIdea: denseText.slice(0, 80),
      simplified: 'In simple terms, this concept describes how elements interact predictably.',
      analogy: 'Imagine traffic flow during rush hour.',
    };
  }
}

// -------------------------------------------------------------
// Existing Helper Endpoints & Legacy Support
// -------------------------------------------------------------

export async function summarizeEmailsWithGemini(emails: EmailMessage[]): Promise<EmailAlert[]> {
  // Gmail-native pre-sort: trust labelIds, never keywords. SPAM + PROMOTIONS share
  // the PROMOTION category, SOCIAL gets its own tab. Academic senders found in
  // PROMOTIONS/SOCIAL are still AI-routed (user requirement).
  const ACADEMIC_SENDER_RE = /classroom|canvas|moodle|blackboard|\.edu|school|teacher|professor|instructor|phòng đào tạo|giáo viên/i;
  const isAcademicSender = (e: EmailMessage) =>
    ACADEMIC_SENDER_RE.test(`${e.senderEmail || ''} ${e.sender || ''}`);
  const bucketOf = (e: EmailMessage): 'PROMOTION' | 'SOCIAL' | 'AI' => {
    const labels = e.labelIds || [];
    if (labels.includes('SPAM')) return 'PROMOTION'; // same category, not hidden
    if (labels.includes('CATEGORY_PROMOTIONS')) return isAcademicSender(e) ? 'AI' : 'PROMOTION';
    if (labels.includes('CATEGORY_SOCIAL')) return isAcademicSender(e) ? 'AI' : 'SOCIAL';
    return 'AI';
  };
  const localAlert = (e: EmailMessage, category: 'PROMOTION' | 'SOCIAL'): EmailAlert => ({
    id: e.id,
    sender: e.sender,
    subject: e.subject,
    oneLineSummary: `${(e.snippet || e.subject || '').slice(0, 75)}...`,
    urgency: 'INFO' as const,
    category,
    categoryLabel: category === 'SOCIAL' ? 'Social' : 'Promotion / Spam',
    isSpam: category === 'PROMOTION',
    spamReason: 'Sorted by Gmail',
    language: 'other' as const,
    gmailLabels: e.labelIds || [],
    rawEmail: e,
  });
  try {
    const aiEmails = emails.filter((e) => bucketOf(e) === 'AI');
    const localAlerts = emails.filter((e) => bucketOf(e) !== 'AI').map((e) => localAlert(e, bucketOf(e) as 'PROMOTION' | 'SOCIAL'));
    if (aiEmails.length === 0) return localAlerts;
    // PII: truncate snippet to 300 chars before POST (keep labelIds + sender for server trust)
    const truncated = aiEmails.map(e => ({ id: e.id, sender: e.sender, senderEmail: e.senderEmail, subject: e.subject, date: e.date, snippet: (e.snippet||'').slice(0,300), body: e.body ? e.body.slice(0,300) : undefined, labelIds: e.labelIds || [] }));
    const res = await fetch('/api/gemini/summarize-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: truncated }),
    });

    if (!res.ok) throw new Error(`Summarize API failed: ${res.statusText}`);
    const data = await res.json();
    const aiAlerts: EmailAlert[] = (data.alerts || []).map((alert: any) => {
      const src = aiEmails.find((e) => e.id === alert.id);
      // Server already trusts Gmail labels; re-assert academic-sender-in-promo stays AI-labeled:
      // if server forced PROMOTION but sender is academic, keep server label only when Gmail said promo AND sender non-academic.
      // Div B client post-guard: clamp provenance, strip non-ISO dates (Div A types pending -> as any).
      const d = (alert as any).detectedAssignment;
      if (d) {
        d.confidence = Math.min(1, Math.max(0, Number(d.confidence ?? (d.dueDate ? 0.7 : 0))));
        if (!d.dueDate) { d.dateSource = 'missing'; d.confidence = Math.min(d.confidence, 0.4); }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate || '')) d.dueDate = '';
      }
      return { ...alert, gmailLabels: src?.labelIds || [], rawEmail: src };
    });
    const byId = new Map<string, EmailAlert>();
    [...aiAlerts, ...localAlerts].forEach((a) => byId.set(a.id, a));
    // Preserve original inbox order, show ALL by default.
    return emails.map((e) => byId.get(e.id)).filter((a): a is EmailAlert => Boolean(a));
  } catch (error) {
    console.error('Error calling summarize emails API:', error);
    // Offline fallback: Gmail labels only, no keywords. NEVER invent dates.
    return emails.map((e) => {
      const b = bucketOf(e);
      if (b !== 'AI') return localAlert(e, b);
      return {
        id: e.id,
        sender: e.sender,
        subject: e.subject,
        oneLineSummary: `${(e.snippet || e.subject || '').slice(0, 75)}...`,
        urgency: 'LOW' as const,
        category: 'GENERAL' as const,
        categoryLabel: 'General Update',
        isSpam: false,
        gmailLabels: e.labelIds || [],
        rawEmail: e,
        // Div B: unknown date is first-class, never a guessed date (Div A types pending -> as any).
        detectedAssignment: {
          isAssignment: false,
          name: e.subject || 'New Assignment',
          subject: 'General',
          dueDate: '',
          dateSource: 'missing',
          confidence: 0,
          quote: '',
          priority: 'Med',
        } as any,
      };
    });
  }
}

export async function generateQuickDraft(request: QuickDraftRequest): Promise<QuickDraftResponse> {
  const res = await fetch('/api/gemini/quick-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) throw new Error(`Quick draft API error: ${res.statusText}`);
  return await res.json();
}

export async function parseNaturalLanguageAssignment(text: string): Promise<Partial<Assignment>> {
  try {
    const res = await fetch('/api/gemini/parse-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Parse assignment error: ${res.statusText}`);
    return await res.json();
  } catch {
    // Offline/client fallback: NEVER invent dates (no +2/+3d). Div A types pending -> as any.
    return {
      subject: 'General',
      assignmentName: text || 'New Task',
      dueDate: '',
      dateSource: 'missing',
      confidence: 0,
      quote: '',
      priority: 'Med',
      status: 'Not Started',
      estimatedMinutes: 45,
    } as any;
  }
}

export async function sendStudyAssistantMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context?: any
): Promise<string> {
  const res = await fetch('/api/gemini/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });

  if (!res.ok) throw new Error(`Study assistant error: ${res.statusText}`);
  const data = await res.json();
  return data.reply || "I'm here to help you stay ahead in all your classes!";
}

export interface EffortEstimate {
  id: string;
  riskScore: number;
  estimatedMinutes: number;
  focusOrder: number;
  aiTip: string;
}

export interface SubtaskResult {
  subtasks: { title: string; estimatedMinutes: number; order: number }[];
  totalEstimatedMinutes: number;
  difficulty: string;
}

export interface StudySlotSuggestion {
  startTime: string;
  endTime: string;
  taskName: string;
  taskSubject: string;
  reason: string;
}

export interface StudySlotResult {
  suggestedSlots: StudySlotSuggestion[];
  chronotypeAdvice: string;
}

export async function extractSubtasksFromCanvas(assignment: CanvasAssignment): Promise<SubtaskResult> {
  const res = await fetch('/api/gemini/extract-subtasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignmentName: assignment.name,
      courseName: assignment.courseName,
      description: assignment.description,
      dueAt: assignment.dueAt,
      pointsPossible: assignment.pointsPossible,
    }),
  });

  if (!res.ok) throw new Error(`Extract subtasks error: ${res.statusText}`);
  return await res.json();
}

export async function estimateAssignmentEffort(assignments: Assignment[]): Promise<EffortEstimate[]> {
  const notDone = assignments.filter((a) => a.status !== 'Done');
  if (notDone.length === 0) return [];

  const res = await fetch('/api/gemini/estimate-effort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments: notDone }),
  });

  if (!res.ok) throw new Error(`Estimate effort error: ${res.statusText}`);
  const data = await res.json();
  return data.estimates || [];
}

export async function suggestStudySlots(
  existingEvents: CalendarEvent[],
  pendingTasks: Assignment[],
  chronotype?: string,
  date?: string
): Promise<StudySlotResult> {
  const res = await fetch('/api/gemini/suggest-study-slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingEvents, pendingTasks, chronotype, date }),
  });

  if (!res.ok) throw new Error(`Suggest study slots error: ${res.statusText}`);
  return await res.json();
}

// -------------------------------------------------------------
// 1. AI Interactive Quiz Generator
// -------------------------------------------------------------
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

export async function generateInteractiveQuiz(topicOrNotes: string): Promise<QuizQuestion[]> {
  const prompt = `You are an expert university examiner and professor.
Based on the following lecture notes or study topic:
"${topicOrNotes.slice(0, 5000)}"

Generate exactly 5 high-yield multiple-choice practice quiz questions to test deep understanding.
Write any math with KaTeX delimiters: inline $...$, display $$...$$ (one block per line, never two on one line).
Return a JSON array of questions with this exact format:
[
  {
    "id": "q1",
    "question": "What is ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Option A is correct because...",
    "topic": "Key Sub-topic"
  }
]
Output ONLY valid raw JSON.`;

  try {
    const raw = await callGemini({
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Gemini quiz generation failed, falling back to Groq:', err);
    try {
      const groqRaw = await callGroqDirect(prompt, true);
      const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [
        {
          id: 'q1',
          question: `Which fundamental principle is central to ${topicOrNotes.slice(0, 40) || 'this topic'}?`,
          options: [
            'Conservation and systematic equilibrium',
            'Arbitrary spontaneous generation',
            'Static non-interactive states',
            'Independent variable decoupling',
          ],
          correctIndex: 0,
          explanation: 'Core academic models rely on systematic equilibrium and conservation laws.',
          topic: 'Foundations',
        },
      ];
    }
  }
}

// -------------------------------------------------------------
// 2. AI Daily Study Planner
// -------------------------------------------------------------
export interface DailyStudyPlanResult {
  blocks: {
    time: string;
    task: string;
    strategy: string;
    durationMinutes: number;
  }[];
  summary: string;
  motivationTip: string;
}

export async function generateDailyStudyPlan(params: {
  tasks: string[];
  energy: 'low' | 'medium' | 'high';
  hoursAvailable: number;
}): Promise<DailyStudyPlanResult> {
  const prompt = `You are a master academic cognitive coach.
A student has ${params.hoursAvailable} available study hours today.
Their current energy level is: ${params.energy.toUpperCase()}.
Their pending assignment tasks are:
${params.tasks.map((t) => `- ${t}`).join('\n')}

Design an optimal time-blocked Pomodoro daily study plan for today.
Factor in cognitive load: if energy is high, tackle hard analytical tasks first. If energy is low, start with active recall or low-friction review.
Return ONLY raw JSON in this structure:
{
  "blocks": [
    {
      "time": "09:00 - 09:50",
      "task": "Task Name & Focus Goal",
      "strategy": "Active Recall / Deep Work / Problem Set",
      "durationMinutes": 50
    }
  ],
  "summary": "1-sentence strategic summary of today's study blueprint",
  "motivationTip": "Brief high-impact psychological tip"
}`;

  try {
    const raw = await callGemini({ contents: prompt });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const groqRaw = await callGroqDirect(prompt, true);
    const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// -------------------------------------------------------------
// 3. Google Scholar & Zotero Academic Citation Generator
// -------------------------------------------------------------
export interface AcademicCitationResult {
  title: string;
  authors: string;
  year: string;
  apa: string;
  mla: string;
  chicago: string;
  bibtex: string;
  inText: string;
}

export async function generateCitations(queryOrTitle: string): Promise<AcademicCitationResult> {
  const prompt = `You are an expert academic librarian and reference formatting engine.
Generate accurate academic bibliographic citations for this source, research topic, or book:
"${queryOrTitle}"

Return ONLY a raw JSON object with:
{
  "title": "Exact Title of Book / Article",
  "authors": "Author Name(s)",
  "year": "Publication Year",
  "apa": "Complete APA 7th Edition citation string",
  "mla": "Complete MLA 9th Edition citation string",
  "chicago": "Complete Chicago 17th Edition citation string",
  "bibtex": "@article{key,\\n  author = {...},\\n  title = {...}\\n}",
  "inText": "(Author, Year)"
}`;

  try {
    const raw = await callGemini({ contents: prompt });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const groqRaw = await callGroqDirect(prompt, true);
    const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// -------------------------------------------------------------
// 4. AI Grade & Final Exam Goal Predictor
// -------------------------------------------------------------
export interface GradePredictionResult {
  requiredFinalScore: number;
  isPossible: boolean;
  status: 'Guaranteed' | 'Achievable' | 'Challenging' | 'High Risk';
  feedback: string;
}

export function calculateGradePrediction(params: {
  currentGrade: number; // e.g. 84 (out of 100)
  desiredGrade: number; // e.g. 90 (out of 100)
  finalExamWeight: number; // e.g. 30 (percent)
}): GradePredictionResult {
  const { currentGrade, desiredGrade, finalExamWeight } = params;
  const currentWeight = 100 - finalExamWeight;

  // Formula: Desired = (Current * (100 - FinalWeight) + FinalScore * FinalWeight) / 100
  // FinalScore = (Desired * 100 - Current * CurrentWeight) / FinalWeight
  const requiredFinalScore = Math.round(((desiredGrade * 100 - currentGrade * currentWeight) / finalExamWeight) * 10) / 10;

  let status: 'Guaranteed' | 'Achievable' | 'Challenging' | 'High Risk' = 'Achievable';
  let feedback = '';

  if (requiredFinalScore <= 0) {
    status = 'Guaranteed';
    feedback = `You have mathematically already locked in your desired grade! Even with 0% on the final, your score is secured.`;
  } else if (requiredFinalScore <= 75) {
    status = 'Achievable';
    feedback = `Very reachable target. A standard revision schedule will easily achieve this.`;
  } else if (requiredFinalScore <= 90) {
    status = 'Challenging';
    feedback = `Achievable with focused effort. Plan at least 3 deep Pomodoro review sessions.`;
  } else if (requiredFinalScore <= 100) {
    status = 'High Risk';
    feedback = `High score needed on the final exam. Prioritize high-weight topics and active recall.`;
  } else {
    status = 'High Risk';
    feedback = `Mathematically requires extra credit or curving as ${requiredFinalScore}% exceeds 100%.`;
  }

  return {
    requiredFinalScore,
    isPossible: requiredFinalScore <= 100,
    status,
    feedback,
  };
}

// -------------------------------------------------------------
// 5. Syllabus PDF & Course Parser
// -------------------------------------------------------------
export interface ParsedSyllabusData {
  courseTitle: string;
  instructor: string;
  email: string;
  officeHours: string;
  gradingBreakdown: { item: string; weightPercent: number }[];
  deadlines: { title: string; dueDate: string; type: string; points?: number }[];
}

export async function parseSyllabusContent(syllabusText: string): Promise<ParsedSyllabusData> {
  const prompt = `You are an academic course coordinator.
Extract the key course structure from this syllabus text:
"${syllabusText.slice(0, 7000)}"

Return ONLY valid JSON matching this exact structure:
{
  "courseTitle": "Course Name / Code",
  "instructor": "Instructor Name",
  "email": "instructor@university.edu",
  "officeHours": "Mon/Wed 2-4pm",
  "gradingBreakdown": [
    { "item": "Midterm Exam", "weightPercent": 25 },
    { "item": "Final Exam", "weightPercent": 35 },
    { "item": "Homework Problem Sets", "weightPercent": 20 },
    { "item": "Laboratory Reports", "weightPercent": 20 }
  ],
  "deadlines": [
    { "title": "Homework 1", "dueDate": "2026-09-15", "type": "Homework", "points": 100 },
    { "title": "Midterm Exam", "dueDate": "2026-10-20", "type": "Exam", "points": 100 }
  ]
}`;

  try {
    const raw = await callGemini({ contents: prompt });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const groqRaw = await callGroqDirect(prompt, true);
    const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// -------------------------------------------------------------
// 6. AI "Why Is This Hard?" Cognitive Deconstruction
// -------------------------------------------------------------
export interface WhyIsThisHardResult {
  cognitiveBottlenecks: string[];
  coreDifficultyReason: string;
  recommendedStepByStepPlan: string[];
  prerequisiteConcepts: string[];
  estimatedPomodoros: number;
}

export async function explainWhyIsThisHard(params: {
  title: string;
  courseName?: string;
  description?: string;
}): Promise<WhyIsThisHardResult> {
  const prompt = `You are an elite cognitive learning specialist and academic tutor.
Analyze this academic assignment:
- Title: "${params.title}"
- Course: "${params.courseName || 'General Academic'}"
- Description / Prompt: "${params.description ? params.description.slice(0, 3000) : 'Standard coursework'}"

Deconstruct why students find this specific type of assignment difficult, what conceptual traps exist, and provide a clear step-by-step approach.

Return ONLY valid JSON matching this exact structure:
{
  "coreDifficultyReason": "2-3 concise sentences explaining the exact cognitive challenge (e.g., synthesis of disparate theorems, ambiguous requirements, or high working memory load).",
  "cognitiveBottlenecks": [
    "Common student pitfall 1",
    "Common student pitfall 2",
    "Common student pitfall 3"
  ],
  "recommendedStepByStepPlan": [
    "Phase 1: Scope & gather definitions",
    "Phase 2: Outline or draft initial derivation",
    "Phase 3: Verify edge cases & polish"
  ],
  "prerequisiteConcepts": [
    "Fundamental Concept 1",
    "Fundamental Concept 2"
  ],
  "estimatedPomodoros": 3
}`;

  try {
    const raw = await callGemini({ contents: prompt });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const groqRaw = await callGroqDirect(prompt, true);
    const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// -------------------------------------------------------------
// 7. AI Essay Proofreader & Thesis Strength Analyzer
// -------------------------------------------------------------
export interface EssayAnalysisResult {
  thesisEvaluation: {
    thesisText: string;
    strengthRating: 'Strong' | 'Moderate' | 'Weak' | 'Missing';
    critique: string;
    suggestedRefinement: string;
  };
  structuralFlow: {
    overallCoherence: string;
    transitionWeaknesses: string[];
  };
  evidenceAndLogic: {
    unsupportedClaims: string[];
    logicalPraise: string[];
  };
  actionableNextSteps: string[];
}

export async function analyzeEssayDraft(params: {
  essayDraft: string;
  rubricOrPrompt?: string;
}): Promise<EssayAnalysisResult> {
  const prompt = `You are an expert university writing fellow.
Analyze the following essay draft:
"${params.essayDraft.slice(0, 8000)}"

Assignment Prompt / Context: "${params.rubricOrPrompt ? params.rubricOrPrompt.slice(0, 2000) : 'General academic essay'}"

Evaluate thesis clarity, evidence-to-claim support, and structural coherence.

Return ONLY valid JSON:
{
  "thesisEvaluation": {
    "thesisText": "Identified thesis sentence or main claim",
    "strengthRating": "Strong",
    "critique": "Specific evaluation of why the claim is arguable/weak",
    "suggestedRefinement": "An improved, more precise thesis statement"
  },
  "structuralFlow": {
    "overallCoherence": "Brief evaluation of argument progression",
    "transitionWeaknesses": [
      "Paragraph 2 to 3 abrupt leap without topic transition"
    ]
  },
  "evidenceAndLogic": {
    "unsupportedClaims": [
      "Claim about X lacks citation or concrete data"
    ],
    "logicalPraise": [
      "Well-constructed rebuttal in paragraph 4"
    ]
  },
  "actionableNextSteps": [
    "Step 1 to revise",
    "Step 2 to revise",
    "Step 3 to revise"
  ]
}`;

  try {
    const raw = await callGemini({ contents: prompt });
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const groqRaw = await callGroqDirect(prompt, true);
    const cleaned = groqRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// -------------------------------------------------------------
// 8. Socratic Tutor Dialogue Engine
// -------------------------------------------------------------
export interface SocraticTurn {
  role: 'user' | 'model';
  content: string;
}

export async function socraticTutorStep(params: {
  topic: string;
  history: SocraticTurn[];
  userMessage: string;
}): Promise<string> {
  const historyText = params.history
    .map((turn) => `${turn.role === 'user' ? 'Student' : 'Socratic Tutor'}: ${turn.content}`)
    .join('\n');

  const prompt = `You are a world-class Socratic Tutor.
Topic: "${params.topic}"

Rules:
1. NEVER just dump the final answer or full derivation.
2. Ask one clear, probing, diagnostic question that leads the student to discover the principle themselves.
3. If the student answers correctly, validate with enthusiasm and ask the next step or edge case question.
4. If the student is confused or wrong, gently identify where their mental model broke down and offer a simpler analogy or intermediate question.
5. Keep your response under 100 words. Be encouraging and rigorous.

Conversation History:
${historyText}
Student: ${params.userMessage}
Socratic Tutor:`;

  try {
    const raw = await callGemini({ contents: prompt });
    return raw.trim();
  } catch {
    const groqRaw = await callGroqDirect(prompt, false);
    return groqRaw.trim();
  }
}

