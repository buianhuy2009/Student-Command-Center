import { LOCAL_MODEL_CACHE_NAME, type OcrMode, type OcrQualityTier, type OfflineAsrTier } from './localAiConfig';
import type { OfflineAudioClip, OnlineAudioChunk } from '../utils/audioChunking';

export interface LocalOcrProgress {
  stage: 'downloading' | 'detecting' | 'reading' | 'formatting';
  percent: number;
  file?: string;
  loaded?: number;
  total?: number;
  completed?: number;
  totalLines?: number;
}

export interface LocalOcrResult {
  markdown: string;
  lineCount: number;
}

const IDLE_TERMINATE_MS = 60_000;

let activeWorkerKind: 'ocr' | 'vad' | 'asr' | 'summary' | null = null;
let ocrWorker: Worker | null = null;
let vadWorker: Worker | null = null;
let asrWorker: Worker | null = null;
let summaryWorker: Worker | null = null;
let ocrIdleTimer: number | null = null;

function clearOcrIdleTimer() {
  if (ocrIdleTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(ocrIdleTimer);
  }
  ocrIdleTimer = null;
}

function scheduleOcrIdleTerminate() {
  clearOcrIdleTimer();
  if (typeof window === 'undefined') return;
  ocrIdleTimer = window.setTimeout(() => {
    terminateOcrWorker();
  }, IDLE_TERMINATE_MS);
}

export function terminateOcrWorker(): void {
  clearOcrIdleTimer();
  if (ocrWorker) {
    try {
      ocrWorker.terminate();
    } catch {
      // Ignore termination error.
    }
    ocrWorker = null;
  }
  if (activeWorkerKind === 'ocr') {
    activeWorkerKind = null;
  }
}

export function terminateVadWorker(): void {
  if (vadWorker) {
    try {
      vadWorker.terminate();
    } catch {
      // Ignore termination error.
    }
    vadWorker = null;
  }
  if (activeWorkerKind === 'vad') {
    activeWorkerKind = null;
  }
}

export function terminateAsrWorker(): void {
  if (asrWorker) {
    try {
      asrWorker.terminate();
    } catch {
      // Ignore termination error.
    }
    asrWorker = null;
  }
  if (activeWorkerKind === 'asr') {
    activeWorkerKind = null;
  }
}

export function terminateSummaryWorker(): void {
  if (summaryWorker) {
    try {
      summaryWorker.terminate();
    } catch {
      // Ignore termination error.
    }
    summaryWorker = null;
  }
  if (activeWorkerKind === 'summary') {
    activeWorkerKind = null;
  }
}

/**
 * Ensures at most ONE heavy ML worker is alive at a time so 8 GB laptops stay safe.
 */
export function claimWorkerSlot(kind: 'ocr' | 'vad' | 'asr' | 'summary'): void {
  if (activeWorkerKind && activeWorkerKind !== kind) {
    if (activeWorkerKind === 'ocr') {
      terminateOcrWorker();
    } else if (activeWorkerKind === 'vad') {
      terminateVadWorker();
    } else if (activeWorkerKind === 'asr') {
      terminateAsrWorker();
    } else if (activeWorkerKind === 'summary') {
      terminateSummaryWorker();
    }
  }
  activeWorkerKind = kind;
}

export function releaseWorkerSlot(kind: 'ocr' | 'vad' | 'asr' | 'summary'): void {
  if (activeWorkerKind === kind) {
    activeWorkerKind = null;
  }
}

function getOrCreateOcrWorker(): Worker {
  claimWorkerSlot('ocr');
  clearOcrIdleTimer();
  if (!ocrWorker) {
    ocrWorker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return ocrWorker;
}

export async function runLocalOcrScan(params: {
  imageBlob: Blob;
  mode: OcrMode;
  tier?: OcrQualityTier;
  onProgress?: (progress: LocalOcrProgress) => void;
  signal?: AbortSignal;
}): Promise<LocalOcrResult> {
  const { imageBlob, mode, tier = 'accurate', onProgress, signal } = params;
  if (signal?.aborted) {
    throw new Error('ABORTED');
  }

  const worker = getOrCreateOcrWorker();
  const requestId = `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<LocalOcrResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      scheduleOcrIdleTerminate();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      try {
        worker.postMessage({ type: 'abort', id: requestId });
      } catch {}
      terminateOcrWorker();
      cleanup();
      reject(new Error('ABORTED'));
    };

    const onError = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      terminateOcrWorker();
      cleanup();
      reject(new Error(ev.message || 'Offline OCR worker failed.'));
    };

    const onMessage = (event: MessageEvent<any>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'progress') {
        onProgress?.({
          stage: msg.stage,
          percent: typeof msg.percent === 'number' ? msg.percent : 0,
          file: msg.file,
          loaded: msg.loaded,
          total: msg.total,
          completed: msg.completed,
          totalLines: msg.totalLines,
        });
      } else if (msg.type === 'done') {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          markdown: String(msg.markdown || ''),
          lineCount: Number(msg.lineCount || 0),
        });
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(String(msg.error || 'Offline OCR failed.')));
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.postMessage({
      type: 'scan',
      id: requestId,
      imageBlob,
      mode,
      tier,
    });
  });
}

export async function getOfflineModelCacheStats(): Promise<{
  entryCount: number;
  approxMb: number;
}> {
  if (typeof caches === 'undefined') return { entryCount: 0, approxMb: 0 };
  // Never scan multi-hundred-MB model caches while an offline ML worker is actively running.
  if (activeWorkerKind !== null) {
    return { entryCount: 0, approxMb: 0 };
  }
  let totalBytes = 0;
  let entryCount = 0;

  const cacheNames = [LOCAL_MODEL_CACHE_NAME, 'studentos-local-models-v1', 'transformers-cache'];
  for (const name of cacheNames) {
    try {
      const has = await caches.has(name);
      if (!has) continue;
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      entryCount += reqs.length;
      for (const req of reqs) {
        const res = await cache.match(req);
        if (!res) continue;
        const len = Number(res.headers.get('content-length') || 0);
        if (len > 0) {
          totalBytes += len;
        } else {
          // Use Blob.size (file-backed metadata) instead of arrayBuffer() so we never pull 600+ MB into JS RAM.
          const blob = await res.blob();
          totalBytes += blob.size;
        }
      }
    } catch {
      // Ignore inaccessible cache storage.
    }
  }

  return {
    entryCount,
    approxMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
  };
}

export interface LocalVadResult {
  originalDurationSec: number;
  speechDurationSec: number;
  onlineChunks: OnlineAudioChunk[];
  offlineClips: OfflineAudioClip[];
}

export async function runLocalVadProcess(params: {
  pcm16k: Float32Array;
  sampleRate: number;
  mode: 'online' | 'offline';
  onProgress?: (p: { stage: string; percent: number }) => void;
  signal?: AbortSignal;
}): Promise<LocalVadResult> {
  const { pcm16k, sampleRate, mode, onProgress, signal } = params;
  if (signal?.aborted) throw new Error('ABORTED');

  claimWorkerSlot('vad');
  if (vadWorker) terminateVadWorker();
  vadWorker = new Worker(new URL('../workers/vad.worker.ts', import.meta.url), {
    type: 'module',
  });

  const worker = vadWorker;
  const requestId = `vad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<LocalVadResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (signal) signal.removeEventListener('abort', onAbort);
      terminateVadWorker();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      try {
        worker.postMessage({ type: 'abort', id: requestId });
      } catch {}
      cleanup();
      reject(new Error('ABORTED'));
    };

    const onError = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(ev.message || 'VAD worker failed.'));
    };

    const onMessage = (event: MessageEvent<any>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'progress') {
        onProgress?.({
          stage: String(msg.stage || 'vad'),
          percent: typeof msg.percent === 'number' ? msg.percent : 0,
        });
      } else if (msg.type === 'done') {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          originalDurationSec: Number(msg.originalDurationSec || 0),
          speechDurationSec: Number(msg.speechDurationSec || 0),
          onlineChunks: Array.isArray(msg.onlineChunks) ? msg.onlineChunks : [],
          offlineClips: Array.isArray(msg.offlineClips) ? msg.offlineClips : [],
        });
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(String(msg.error || 'Audio processing failed.')));
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    // Transfer the Float32Array buffer directly so we never duplicate 1-hour audio in RAM.
    worker.postMessage(
      {
        type: 'process',
        id: requestId,
        pcm16k,
        sampleRate,
        mode,
      },
      [pcm16k.buffer]
    );
  });
}

export interface LocalAsrProgress {
  stage: 'downloading' | 'transcribing';
  percent: number;
  file?: string;
  loaded?: number;
  total?: number;
  currentClip?: number;
  totalClips?: number;
}

export async function runLocalAsrClips(params: {
  modelTier: OfflineAsrTier;
  language: 'auto' | 'vi' | 'en';
  clips: OfflineAudioClip[];
  onProgress?: (p: LocalAsrProgress) => void;
  onClipDone: (
    segment: { chunkIndex: number; startSec: number; endSec: number; text: string },
    completed: number,
    total: number
  ) => Promise<void> | void;
  signal?: AbortSignal;
}): Promise<void> {
  const { modelTier, language, clips, onProgress, onClipDone, signal } = params;
  if (signal?.aborted) throw new Error('ABORTED');
  if (clips.length === 0) return;

  claimWorkerSlot('asr');
  if (asrWorker) terminateAsrWorker();
  asrWorker = new Worker(new URL('../workers/asr.worker.ts', import.meta.url), {
    type: 'module',
  });

  const worker = asrWorker;
  const requestId = `asr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let clipChain = Promise.resolve();

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (signal) signal.removeEventListener('abort', onAbort);
      // Immediately terminate ASR worker so PhoWhisper WASM heap returns to 0 MB.
      terminateAsrWorker();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      try {
        worker.postMessage({ type: 'abort', id: requestId });
      } catch {}
      cleanup();
      reject(new Error('ABORTED'));
    };

    const onError = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(ev.message || 'Offline ASR worker failed.'));
    };

    const onMessage = (event: MessageEvent<any>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'progress') {
        onProgress?.({
          stage: msg.stage,
          percent: typeof msg.percent === 'number' ? msg.percent : 0,
          file: msg.file,
          loaded: msg.loaded,
          total: msg.total,
          currentClip: msg.currentClip,
          totalClips: msg.totalClips,
        });
      } else if (msg.type === 'clip-done') {
        clipChain = clipChain.then(() =>
          onClipDone(msg.segment, Number(msg.completed || 0), Number(msg.total || clips.length))
        );
      } else if (msg.type === 'done') {
        clipChain
          .then(() => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          })
          .catch((e) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(e);
          });
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(String(msg.error || 'Offline transcription failed.')));
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    const transferables = clips.map((c) => c.pcm16k.buffer);
    worker.postMessage(
      {
        type: 'transcribe-clips',
        id: requestId,
        modelTier,
        language,
        clips,
      },
      transferables
    );
  });
}

export interface LocalSummaryProgress {
  stage: 'downloading' | 'summarizing';
  percent: number;
  file?: string;
  loaded?: number;
  total?: number;
}

export interface LocalSummaryResult {
  executiveSummary: string;
  outline: { timestampSec: number; heading: string; bullets: string[] }[];
  vocabulary: { term: string; definition: string }[];
  flashcards: { front: string; back: string }[];
  modelUsed?: string;
}

export async function runLocalLectureSummary(params: {
  title: string;
  language: 'auto' | 'vi' | 'en';
  segments: { startSec: number; endSec: number; text: string }[];
  onProgress?: (p: LocalSummaryProgress) => void;
  signal?: AbortSignal;
}): Promise<LocalSummaryResult> {
  const { title, language, segments, onProgress, signal } = params;
  if (signal?.aborted) throw new Error('ABORTED');

  claimWorkerSlot('summary');
  if (summaryWorker) terminateSummaryWorker();
  summaryWorker = new Worker(new URL('../workers/summary.worker.ts', import.meta.url), {
    type: 'module',
  });

  const worker = summaryWorker;
  const requestId = `sum-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<LocalSummaryResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (signal) signal.removeEventListener('abort', onAbort);
      // Immediately terminate summary worker so local LLM memory returns to 0 MB.
      terminateSummaryWorker();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      try {
        worker.postMessage({ type: 'abort', id: requestId });
      } catch {}
      cleanup();
      reject(new Error('ABORTED'));
    };

    const onError = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(ev.message || 'Offline Qwen3.5 summary worker failed.'));
    };

    const onMessage = (event: MessageEvent<any>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'progress') {
        onProgress?.({
          stage: msg.stage === 'downloading' ? 'downloading' : 'summarizing',
          percent: typeof msg.percent === 'number' ? msg.percent : 0,
          file: msg.file,
          loaded: msg.loaded,
          total: msg.total,
        });
      } else if (msg.type === 'done') {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(msg.summary);
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(String(msg.error || 'Offline summary failed.')));
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    worker.postMessage({
      type: 'summarize',
      id: requestId,
      title,
      language,
      segments,
    });
  });
}

export async function clearOfflineModels(): Promise<void> {
  terminateOcrWorker();
  terminateVadWorker();
  terminateAsrWorker();
  terminateSummaryWorker();
  if (typeof caches === 'undefined') return;
  for (const name of [LOCAL_MODEL_CACHE_NAME, 'studentos-local-models-v1', 'transformers-cache']) {
    try {
      await caches.delete(name);
    } catch {
      // Ignore cache delete errors.
    }
  }
}
