/// <reference lib="webworker" />
import { env, pipeline, TextStreamer, type ProgressInfo } from '@huggingface/transformers';
import { LOCAL_MODEL_CATALOG } from '../services/localAiConfig';
import { formatLectureSummaryMarkdown } from '../utils/lectureSummaryFormat';

env.allowLocalModels = false;
env.useBrowserCache = true;
if (typeof self !== 'undefined' && !self.crossOriginIsolated && env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

export interface SummarySegmentInput {
  startSec: number;
  endSec: number;
  text: string;
}

type SummaryWorkerRequest =
  | {
      type: 'summarize';
      id: string;
      title: string;
      language: 'auto' | 'vi' | 'en';
      segments: SummarySegmentInput[];
    }
  | { type: 'abort'; id?: string };

let cancelledId: string | null = null;

function isCancelled(id: string): boolean {
  return cancelledId === id || cancelledId === '__all__';
}

function postProgress(
  id: string,
  payload: {
    stage: 'downloading' | 'summarizing';
    percent: number;
    file?: string;
    loaded?: number;
    total?: number;
  }
) {
  self.postMessage({
    type: 'progress',
    id,
    stage: payload.stage,
    file: payload.file,
    loaded: payload.loaded,
    total: payload.total,
    percent: Math.min(99, Math.max(0, Math.round(payload.percent))),
  });
}

async function detectPreferredBackend(): Promise<{ device: 'webgpu' | 'wasm'; dtype: 'q4f16' | 'q4' }> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<any> } }).gpu;
    if (gpu && typeof gpu.requestAdapter === 'function') {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        const hasF16 = Boolean(adapter.features?.has?.('shader-f16'));
        return { device: 'webgpu', dtype: hasF16 ? 'q4f16' : 'q4' };
      }
    }
  } catch {
    // Fall back to WASM.
  }
  return { device: 'wasm', dtype: 'q4' };
}

async function createGemmaPipeline(requestId: string) {
  const modelId = LOCAL_MODEL_CATALOG.gemmaSummary.id;
  const fileBytes = new Map<string, { loaded: number; total: number }>();

  const progress_callback = (info: ProgressInfo) => {
    if (info.status === 'progress' && 'file' in info) {
      fileBytes.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 });
      let totalLoaded = 0;
      let totalExpected = 0;
      for (const e of fileBytes.values()) {
        totalLoaded += e.loaded;
        totalExpected += e.total;
      }
      const frac = totalExpected > 0 ? totalLoaded / totalExpected : (info.progress || 0) / 100;
      postProgress(requestId, {
        stage: 'downloading',
        file: info.file,
        loaded: totalLoaded,
        total: totalExpected,
        percent: 5 + Math.min(1, Math.max(0, frac)) * 50,
      });
    }
  };

  const preferred = await detectPreferredBackend();
  const attempts: { device: 'webgpu' | 'wasm'; dtype: 'q4f16' | 'q4' }[] =
    preferred.device === 'webgpu'
      ? [
          preferred,
          ...(preferred.dtype === 'q4f16' ? [{ device: 'webgpu' as const, dtype: 'q4' as const }] : []),
          { device: 'wasm', dtype: 'q4' },
        ]
      : [{ device: 'wasm', dtype: 'q4' }];

  let lastErr: unknown = null;
  for (const cfg of attempts) {
    if (isCancelled(requestId)) throw new Error('ABORTED');
    try {
      const pipe = await pipeline('text-generation', modelId, {
        device: cfg.device,
        dtype: cfg.dtype,
        progress_callback,
      });
      return pipe;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Failed to load offline Gemma 3 270M summary model.');
}

function buildCompactTranscriptFor270M(segments: SummarySegmentInput[], maxChars = 3200): string {
  const clean = segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, ' ').trim() }))
    .filter((s) => s.text.length > 0);

  if (clean.length === 0) return '';

  const joined = clean.map((s) => s.text).join(' ');
  if (joined.length <= maxChars) return joined;

  // Sample evenly across the whole lecture so start, middle, and conclusion are covered.
  const targetSegments = Math.min(clean.length, 18);
  const perSegBudget = Math.max(100, Math.floor(maxChars / targetSegments));
  const picked: string[] = [];
  for (let i = 0; i < targetSegments; i++) {
    const idx = Math.min(clean.length - 1, Math.floor((i * clean.length) / targetSegments));
    const snippet = clean[idx].text.slice(0, perSegBudget).trim();
    if (snippet) picked.push(snippet);
  }
  return picked.join('\n').slice(0, maxChars);
}

function buildOfflineOutline(
  segments: SummarySegmentInput[],
  title: string
): { timestampSec: number; heading: string; bullets: string[] }[] {
  const clean = segments.filter((s) => s.text.trim().length > 0);
  if (clean.length === 0) return [];

  const sectionCount = Math.min(5, Math.max(1, Math.ceil(clean.length / 4)));
  const groupSize = Math.ceil(clean.length / sectionCount);
  const outline: { timestampSec: number; heading: string; bullets: string[] }[] = [];

  for (let g = 0; g < sectionCount; g++) {
    const slice = clean.slice(g * groupSize, (g + 1) * groupSize);
    if (slice.length === 0) continue;
    const first = slice[0];
    const combined = slice.map((s) => s.text.trim()).join(' ');
    const sentences = combined
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 16);

    const bullets = (sentences.length > 0 ? sentences : [combined])
      .slice(0, 3)
      .map((s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s));

    outline.push({
      timestampSec: Math.max(0, Math.round(first.startSec || 0)),
      heading: `${title || 'Part'} — Part ${g + 1}`,
      bullets,
    });
  }

  return outline;
}

function extractKeyTermsSimple(text: string): string[] {
  const stop = new Set([
    'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could',
    'every', 'first', 'from', 'have', 'here', 'into', 'just', 'like', 'make', 'many',
    'more', 'most', 'much', 'need', 'only', 'other', 'over', 'some', 'such', 'than',
    'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
    'under', 'very', 'want', 'well', 'were', 'what', 'when', 'where', 'which', 'while',
    'will', 'with', 'would', 'your', 'những', 'trong', 'được', 'không', 'nhưng', 'rằng',
    'cũng', 'người', 'chúng', 'nhiều', 'thời', 'gian', 'phần', 'tiếp', 'theo', 'này',
  ]);
  const counts = new Map<string, number>();
  const words = text.match(/[A-Za-zÀ-ỹ]{4,}/g) || [];
  for (const w of words) {
    const low = w.toLowerCase();
    if (stop.has(low)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

function extractOfflineFlashcards(
  summaryMd: string,
  title: string
): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = [];
  const lines = summaryMd.split('\n').map((l) => l.trim());
  for (const line of lines) {
    const boldMatch = line.match(/^[-*]\s+\*\*([^*]{3,80})\*\*[:\s–-]+(.{10,})$/);
    if (boldMatch) {
      cards.push({
        front: `What is ${boldMatch[1].replace(/:$/, '').trim()}?`,
        back: boldMatch[2].trim(),
      });
    }
    if (cards.length >= 6) break;
  }
  if (cards.length === 0) {
    const bullets = lines
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, '').trim())
      .filter((l) => l.length > 15)
      .slice(0, 5);
    bullets.forEach((b, idx) => {
      cards.push({
        front: `${title} — Key Point ${idx + 1}`,
        back: b,
      });
    });
  }
  return cards;
}

self.onmessage = async (event: MessageEvent<SummaryWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'abort') {
    cancelledId = msg.id || '__all__';
    return;
  }

  if (msg.type === 'summarize') {
    cancelledId = null;
    let genPipe: any = null;
    try {
      postProgress(msg.id, { stage: 'downloading', percent: 5 });
      genPipe = await createGemmaPipeline(msg.id);
      if (isCancelled(msg.id)) throw new Error('ABORTED');

      postProgress(msg.id, { stage: 'summarizing', percent: 58 });

      const compactTranscript = buildCompactTranscriptFor270M(msg.segments, 3200);
      if (!compactTranscript) {
        throw new Error('No transcript text available to summarize.');
      }

      const langDirective =
        msg.language === 'vi'
          ? 'Write your entire answer in Vietnamese.'
          : msg.language === 'en'
            ? 'Write your entire answer in English.'
            : 'Write in the same language as the transcript (Vietnamese or English).';

      const prompt = `Summarize this lecture transcript into clean, easy-to-scan study notes.
${langDirective}
Use this exact Markdown layout (keep sentences short, no big walls of text):

### Core Idea
1-2 short sentences explaining the main point.

### Key Takeaways
- **Point 1:** concise note
- **Point 2:** concise note
- **Point 3:** concise note

### Quick Review
- 2 short things to remember for an exam or quiz.

Lecture title: ${msg.title}
Transcript:
${compactTranscript}`;

      let emittedChars = 0;
      const streamer = new TextStreamer(genPipe.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (chunk: string) => {
          emittedChars += chunk.length;
          const pct = Math.min(96, 58 + Math.round((emittedChars / 900) * 38));
          postProgress(msg.id, { stage: 'summarizing', percent: pct });
        },
      });

      const out = await genPipe([{ role: 'user', content: prompt }], {
        max_new_tokens: 360,
        do_sample: false,
        repetition_penalty: 1.15,
        return_full_text: false,
        streamer,
      });

      if (isCancelled(msg.id)) throw new Error('ABORTED');

      let rawGenerated = '';
      if (Array.isArray(out) && out[0]) {
        const gt = out[0].generated_text;
        if (typeof gt === 'string') {
          rawGenerated = gt;
        } else if (Array.isArray(gt)) {
          const lastMsg = gt[gt.length - 1];
          rawGenerated = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
        }
      }

      const formattedSummary = formatLectureSummaryMarkdown(rawGenerated.trim());
      const outline = buildOfflineOutline(msg.segments, msg.title);
      const terms = extractKeyTermsSimple(compactTranscript);
      const flashcards = extractOfflineFlashcards(formattedSummary, msg.title);

      self.postMessage({
        type: 'done',
        id: msg.id,
        summary: {
          executiveSummary:
            formattedSummary ||
            formatLectureSummaryMarkdown(
              outline.flatMap((o) => o.bullets.map((b) => `- ${b}`)).join('\n')
            ),
          outline,
          vocabulary: terms.map((term) => ({ term, definition: '' })).filter(Boolean),
          flashcards,
          modelUsed: 'gemma-3-270m-it-offline',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', id: msg.id, error: message });
    } finally {
      await genPipe?.dispose?.().catch(() => {});
    }
  }
};
