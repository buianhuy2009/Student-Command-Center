import { db } from './db';
import { getLocaleTag, t } from './i18n';
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
  try {
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem('scc_gemini_api_key') || '' : '';
    return local || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
}
export function getGroqKey(): string {
  try {
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem('scc_groq_api_key') || '' : '';
    return local || (import.meta as any).env?.GROQ_API_KEY || (import.meta as any).env?.VITE_GROQ_API_KEY || '';
  } catch {
    return '';
  }
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

function resolveApiModelName(model: AIModelId): string {
  switch (model) {
    case 'gemini-flash-lite':
      return 'gemini-3.1-flash-lite';
    case 'gemini-pro':
      return 'gemini-3.6-flash';
    case 'gemini-flash':
    case 'groq-llama':
    default:
      return 'gemini-3-flash-preview';
  }
}

async function emitChunkedAnswer(
  text: string,
  sources: AISource[],
  model: string,
  task: AITaskKind,
  callbacks: StreamCallbacks
): Promise<void> {
  const finalOutput = sources.length > 0 ? `${text}${formatSourcesFooter(sources)}` : text;
  const words = finalOutput.split(/(\s+)/);
  let full = '';
  for (const w of words) {
    if (callbacks.signal?.aborted) break;
    full += w;
    callbacks.onToken(w);
    await new Promise((r) => setTimeout(r, 8));
  }
  await logTokenUsage(model, Math.ceil(full.length / 4), task);
  callbacks.onDone(full);
}

/**
 * Stream an answer. Uses server `/api/gemini/generate` JSON route when available, else falls back
 * to direct Gemini REST or Groq (BYOK) when configured, strictly rejecting non-JSON HTML responses.
 */
export async function streamAnswerWithSources(
  prompt: string,
  sources: AISource[],
  opts: { model?: AIModelId; task?: AITaskKind; callbacks: StreamCallbacks },
): Promise<void> {
  const { callbacks } = opts;
  const task = opts.task ?? 'chat';
  const model = pickModelForTask(task, opts.model);
  const apiModel = resolveApiModelName(model);
  let primaryError = '';

  if (model !== 'groq-llama') {
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: prompt.slice(0, 12000), model: apiModel }),
        signal: callbacks.signal,
      });
      const contentType = res.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(t('airouter_unexpected_res', { status: res.status, contentType: contentType || t('airouter_unknown_type') }));
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t('airouter_route_err', { status: res.status }));
      }
      const text = String(data?.text || '').trim();
      if (!text) {
        throw new Error(t('airouter_empty_server'));
      }
      await emitChunkedAnswer(text, sources, data?.model || model, task, callbacks);
      return;
    } catch (e: any) {
      if (callbacks.signal?.aborted) return;
      primaryError = e?.message || t('airouter_server_failed');
    }
  }

  // Fallback: direct BYOK Gemini REST or Groq if user configured local API keys
  try {
    const geminiKey = getGeminiKey();
    if (geminiKey && model !== 'groq-llama') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(apiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt.slice(0, 12000) }] }] }),
          signal: callbacks.signal,
        }
      );
      const rType = r.headers?.get?.('content-type') || '';
      if (!rType.includes('application/json')) {
        throw new Error(t('airouter_gemini_nonjson', { status: r.status }));
      }
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || t('airouter_gemini_err', { status: r.status }));
      }
      const text = String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '').trim();
      if (!text) throw new Error(t('airouter_gemini_empty'));
      await emitChunkedAnswer(text, sources, model, task, callbacks);
      return;
    }

    const groqKey = getGroqKey();
    if (groqKey) {
      const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt.slice(0, 12000) }],
          temperature: 0.3,
        }),
        signal: callbacks.signal,
      });
      const grType = gr.headers?.get?.('content-type') || '';
      if (!grType.includes('application/json')) {
        throw new Error(t('airouter_groq_nonjson', { status: gr.status }));
      }
      const gd = await gr.json();
      if (!gr.ok) {
        throw new Error(gd?.error?.message || t('airouter_groq_err', { status: gr.status }));
      }
      const text = String(gd?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error(t('airouter_groq_empty'));
      await emitChunkedAnswer(text, sources, 'groq-llama', task, callbacks);
      return;
    }

    throw new Error(primaryError || t('airouter_no_key'));
  } catch (err: any) {
    callbacks.onError?.(err?.message || primaryError || t('airouter_failed'));
  }
}

export function formatSourcesFooter(sources: AISource[]): string {
  if (!sources.length) return '';
  return t('airouter_sources_header') + sources.map((s) => `• ${s.label}${s.url ? ` (${s.url})` : ''}`).join('\n');
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
  if (!Rec) { opts?.onError?.(t('airouter_voice_unsupported')); return () => {}; }
  const rec = new Rec();
  rec.lang = opts?.lang ?? getLocaleTag();
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    const r = e.results[e.results.length - 1];
    opts?.onResult?.(r[0].transcript, r.isFinal);
  };
  rec.onerror = (e: any) => opts?.onError?.(e?.error || t('airouter_recognition_err'));
  try { rec.start(); } catch {}
  return () => { try { rec.stop(); } catch {} };
}

export function speakText(text: string, opts?: { rate?: number; lang?: string }): void {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
    u.rate = opts?.rate ?? 1;
    u.lang = opts?.lang ?? getLocaleTag();
    window.speechSynthesis.speak(u);
  } catch {}
}
