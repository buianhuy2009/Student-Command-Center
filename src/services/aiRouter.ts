import { db } from './db';
import type { AISource, PromptTemplate } from '../types';

/* ---------- BYOK + provider routing (Gemini primary, Groq fallback) ---------- */

export type AIModelId = 'gemini-flash-lite' | 'gemini-flash' | 'gemini-pro' | 'groq-llama';
export type AITaskKind = 'spam' | 'summarize' | 'essay' | 'code' | 'chat';

export const MODEL_CATALOG: { id: AIModelId; label: string; bestFor: string; cheap: boolean }[] = [
  { id: 'gemini-flash-lite', label: 'Gemini Flash-Lite', bestFor: 'Spam triage, quick labels', cheap: true },
  { id: 'gemini-flash', label: 'Gemini Flash', bestFor: 'Everyday summaries, drafts', cheap: true },
  { id: 'gemini-pro', label: 'Gemini Pro', bestFor: 'Essays, rubrics, hard reasoning', cheap: false },
  { id: 'groq-llama', label: 'Groq Llama (fallback)', bestFor: 'Overflow when Gemini quota hits', cheap: true },
];

/** Per-task default model: cheap for spam, strong for essays. User can override per call. */
export function pickModelForTask(task: AITaskKind, override?: AIModelId): AIModelId {
  if (override) return override;
  if (task === 'spam') return 'gemini-flash-lite';
  if (task === 'essay') return 'gemini-pro';
  return 'gemini-flash';
}

export function getGeminiKey(): string {
  try { return localStorage.getItem('scc_gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || ''; }
  catch { return ''; }
}
export function getGroqKey(): string {
  try { return localStorage.getItem('scc_groq_api_key') || (import.meta as any).env?.GROQ_API_KEY || (import.meta as any).env?.VITE_GROQ_API_KEY || ''; }
  catch { return ''; }
}
export function hasAnyAIKey(): boolean { return Boolean(getGeminiKey() || getGroqKey()); }

/* ---------- Token usage meter (IndexedDB, per day / model / task) ---------- */

export async function logTokenUsage(model: string, tokens: number, task: string): Promise<void> {
  try {
    const date = new Date().toISOString().slice(0, 10);
    await db.tokenUsage.put({ id: `${date}-${model}-${task}-${Date.now()}`, date, model, tokens, task }).catch(() => {});
  } catch {}
}

export async function getTodayTokenUsage(): Promise<{ total: number; byModel: Record<string, number> }> {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const rows = await db.tokenUsage.where('date').equals(date).toArray().catch(() => [] as any[]);
    const byModel: Record<string, number> = {};
    let total = 0;
    for (const r of rows as any[]) { total += r.tokens || 0; byModel[r.model] = (byModel[r.model] || 0) + (r.tokens || 0); }
    return { total, byModel };
  } catch { return { total: 0, byModel: {} }; }
}

/* ---------- Streaming + citations: every answer shows its sources ---------- */

export interface StreamCallbacks {
  onToken: (chunk: string) => void;
  onDone: (full: string) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream an answer. Uses server /api/ai route when available, else falls back to
 * direct Gemini REST (BYOK) with a non-streaming call chunked for UI. Never black-box:
 * caller passes `sources`, we append them under the answer.
 */
export async function streamAnswerWithSources(
  prompt: string,
  sources: AISource[],
  opts: { model?: AIModelId; task?: AITaskKind; callbacks: StreamCallbacks },
): Promise<void> {
  const { callbacks } = opts;
  const model = pickModelForTask(opts.task ?? 'chat', opts.model);
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, stream: true }),
      signal: callbacks.signal,
    });
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        callbacks.onToken(chunk);
      }
      await logTokenUsage(model, Math.ceil(full.length / 4), opts.task ?? 'chat');
      callbacks.onDone(full);
      return;
    }
    throw new Error(`AI route ${res.status}`);
  } catch (e: any) {
    // Fallback: direct Gemini REST single-shot, then emit in word chunks so UI still streams
    try {
      const key = getGeminiKey();
      if (!key) throw new Error('No AI key. Add one in Settings → AI (BYOK), or use Groq fallback.');
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt.slice(0, 12000) }] }] }),
        signal: callbacks.signal,
      });
      const j = await r.json().catch(() => ({}));
      const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || 'No answer returned.';
      const words = text.split(/(\s+)/);
      let full = '';
      for (const w of words) {
        if (callbacks.signal?.aborted) break;
        full += w;
        callbacks.onToken(w);
        await new Promise((res2) => setTimeout(res2, 12));
      }
      await logTokenUsage(model, Math.ceil(full.length / 4), opts.task ?? 'chat');
      callbacks.onDone(full);
    } catch (err: any) {
      callbacks.onError?.(err?.message || 'AI request failed');
    }
  }
}

export function formatSourcesFooter(sources: AISource[]): string {
  if (!sources.length) return '';
  return '\n\nSources:\n' + sources.map((s) => `• ${s.label}${s.url ? ` (${s.url})` : ''}`).join('\n');
}

/* ---------- Prompt library (save/share templates) ---------- */

export const BUILTIN_PROMPTS: PromptTemplate[] = [
  { id: 'dbq-thesis', title: 'DBQ thesis builder', category: 'Essay', body: 'Write a defensible thesis for this DBQ in one sentence: claim + 2–3 categories. Documents: {{docs}}' },
  { id: 'lab-abstract', title: 'Lab abstract', category: 'Lab', body: 'Write a 150-word abstract (objective, method, key result with units, conclusion) for: {{experiment}}' },
  { id: 'email-professor', title: 'Email to professor', category: 'Email', body: 'Draft a polite 120-word email to {{professor}} about {{topic}}. Include course, section, what I tried, and one clear ask.' },
  { id: 'socratic-math', title: 'Socratic math hint', category: 'Study', body: 'Give me Hint {{level}} of 3 (never the full solution until level 3) for: {{problem}}' },
];

export async function listPrompts(): Promise<PromptTemplate[]> {
  try {
    const custom = await db.prompts.toArray().catch(() => [] as any[]);
    return [...BUILTIN_PROMPTS, ...(custom as PromptTemplate[])];
  } catch { return BUILTIN_PROMPTS; }
}

export async function savePrompt(t: PromptTemplate): Promise<void> {
  try { await db.prompts.put(t as any).catch(() => {}); } catch {}
}

/* ---------- Voice: Web Speech API dictation + speech synthesis ---------- */

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);
}

export function dictateOnce(opts?: { lang?: string; onResult?: (text: string, isFinal: boolean) => void; onError?: (msg: string) => void }): () => void {
  const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Rec) { opts?.onError?.('Voice input is not supported in this browser. Try Chrome.'); return () => {}; }
  const rec = new Rec();
  rec.lang = opts?.lang ?? 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    const r = e.results[e.results.length - 1];
    opts?.onResult?.(r[0].transcript, r.isFinal);
  };
  rec.onerror = (e: any) => opts?.onError?.(e?.error || 'recognition error');
  try { rec.start(); } catch {}
  return () => { try { rec.stop(); } catch {} };
}

export function speakText(text: string, opts?: { rate?: number; lang?: string }): void {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
    u.rate = opts?.rate ?? 1;
    u.lang = opts?.lang ?? 'en-US';
    window.speechSynthesis.speak(u);
  } catch {}
}
