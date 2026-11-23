import {
  LOCAL_MODEL_CACHE_NAME,
  LOCAL_MODEL_CATALOG,
  type OfflineCoachLevel,
} from './localAiConfig';

export type LocalAiSlot = 'llm:quick' | 'llm:deeper' | 'ocr';

export interface ModelDownloadProgress {
  file: string;
  loaded: number;
  total: number;
  percent: number;
  stage?: 'downloading' | 'initializing' | 'ready';
}

export interface CachedModelSummary {
  key: 'quick_llm' | 'deeper_llm' | 'photo_scanner';
  bytes: number;
  mb: number;
}

export interface CachedModelsInfo {
  supported: boolean;
  totalBytes: number;
  totalMb: number;
  items: CachedModelSummary[];
  activeSlot: LocalAiSlot | null;
}

const IDLE_UNLOAD_MS = 10 * 60 * 1000;
const TRANSFORMERS_CACHE_NAME = 'transformers-cache';

let llmWorker: Worker | null = null;
let activeSlot: LocalAiSlot | null = null;
let loadedSlotReady: LocalAiSlot | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let ocrUnloader: (() => Promise<void> | void) | null = null;
let reqSeq = 0;

interface PendingWorkerCallbacks {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  onToken?: (partialText: string) => void;
  onProgress?: (progress: ModelDownloadProgress) => void;
}

const pendingRequests = new Map<string, PendingWorkerCallbacks>();
let llmQueue: Promise<unknown> = Promise.resolve();

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function resetIdleTimer(): void {
  clearIdleTimer();
  if (activeSlot === 'llm:quick' || activeSlot === 'llm:deeper') {
    idleTimer = setTimeout(() => {
      void unloadLlmWorker();
    }, IDLE_UNLOAD_MS);
  }
}

function ensureLlmWorker(): Worker {
  if (llmWorker) return llmWorker;
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this browser environment.');
  }
  const worker = new Worker(new URL('../workers/localLlm.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (event: MessageEvent<any>) => {
    const data = event.data;
    if (!data || !data.type) return;
    if (data.type === 'unloaded') return;

    const cb = data.id ? pendingRequests.get(data.id) : undefined;
    if (!cb) return;

    if (data.type === 'progress') {
      if (data.stage === 'ready') {
        loadedSlotReady = activeSlot;
      }
      cb.onProgress?.({
        file: String(data.file || ''),
        loaded: Number(data.loaded || 0),
        total: Number(data.total || 0),
        percent: Number(data.percent || 0),
        stage: data.stage,
      });
      return;
    }

    if (data.type === 'token') {
      loadedSlotReady = activeSlot;
      cb.onToken?.(String(data.text || ''));
      return;
    }

    if (data.type === 'done') {
      loadedSlotReady = activeSlot;
      pendingRequests.delete(data.id);
      resetIdleTimer();
      cb.resolve(String(data.text || ''));
      return;
    }

    if (data.type === 'error') {
      pendingRequests.delete(data.id);
      resetIdleTimer();
      cb.reject(new Error(String(data.error || 'Local AI generation failed')));
    }
  };
  worker.onerror = (err) => {
    for (const [id, cb] of pendingRequests.entries()) {
      pendingRequests.delete(id);
      cb.reject(new Error(err?.message || 'Local AI worker error'));
    }
  };
  llmWorker = worker;
  return worker;
}

export async function unloadLlmWorker(): Promise<void> {
  clearIdleTimer();
  loadedSlotReady = null;
  if (activeSlot === 'llm:quick' || activeSlot === 'llm:deeper') {
    activeSlot = null;
  }
  const worker = llmWorker;
  llmWorker = null;
  if (!worker) return;

  for (const [id, cb] of pendingRequests.entries()) {
    pendingRequests.delete(id);
    cb.reject(new Error('ABORTED'));
  }

  try {
    worker.postMessage({ type: 'unload' });
  } catch {
    // Ignore postMessage failures when terminating.
  }
  try {
    worker.terminate();
  } catch {
    // Ignore terminate errors.
  }
}

export function registerOcrUnloader(unloader: () => Promise<void> | void): void {
  ocrUnloader = unloader;
}

export async function acquireLocalSlot(target: LocalAiSlot): Promise<void> {
  if (activeSlot && activeSlot !== target) {
    if (activeSlot === 'ocr') {
      if (ocrUnloader) {
        try {
          await ocrUnloader();
        } catch {
          // Best-effort OCR release.
        }
      }
      activeSlot = null;
    } else if (target === 'ocr' || activeSlot !== target) {
      await unloadLlmWorker();
    }
  }
  activeSlot = target;
  if (target === 'ocr') {
    clearIdleTimer();
  } else {
    resetIdleTimer();
  }
}

export function releaseLocalSlot(slot: LocalAiSlot): void {
  if (activeSlot === slot) {
    activeSlot = null;
  }
}

export function getActiveLocalSlot(): LocalAiSlot | null {
  return activeSlot;
}

export async function unloadAllLocalAi(): Promise<void> {
  clearIdleTimer();
  await unloadLlmWorker();
  if (ocrUnloader) {
    try {
      await ocrUnloader();
    } catch {
      // Ignore OCR unload errors.
    }
  }
  activeSlot = null;
}

export function abortLocalLlm(): void {
  if (!llmWorker) return;
  try {
    llmWorker.postMessage({ type: 'abort' });
  } catch {
    // Ignore abort errors.
  }
}

function enqueueLlmTask<T>(fn: () => Promise<T>): Promise<T> {
  const next = llmQueue.then(fn, fn);
  llmQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function runLocalLlmClassify(opts: {
  prompt: string;
  systemPrompt: string;
  maxNewTokens?: number;
  onProgress?: (progress: ModelDownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<string> {
  return enqueueLlmTask(async () => {
    if (opts.signal?.aborted) {
      throw new Error('ABORTED');
    }
    const slot: LocalAiSlot = 'llm:quick';
    await acquireLocalSlot(slot);
    const worker = ensureLlmWorker();
    const id = `cls-${++reqSeq}-${Date.now()}`;

    return new Promise<string>((resolve, reject) => {
      const onAbort = () => {
        pendingRequests.delete(id);
        if (loadedSlotReady !== slot) {
          // Terminating cancels in-flight model downloads or WebGPU shader compiles cleanly.
          void unloadLlmWorker();
        } else {
          try {
            worker.postMessage({ type: 'abort', id });
          } catch {
            // Ignore abort failure.
          }
        }
        reject(new Error('ABORTED'));
      };

      if (opts.signal) {
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      pendingRequests.set(id, {
        resolve: (text) => {
          opts.signal?.removeEventListener('abort', onAbort);
          resolve(text);
        },
        reject: (err) => {
          opts.signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
        onProgress: opts.onProgress,
      });

      worker.postMessage({
        type: 'classifyEmail',
        id,
        prompt: opts.prompt,
        systemPrompt: opts.systemPrompt,
        maxNewTokens: opts.maxNewTokens ?? 180,
      });
    });
  });
}

export async function runLocalLlmChat(opts: {
  level: OfflineCoachLevel;
  messages: { role: 'user' | 'assistant'; content: string }[];
  systemPrompt: string;
  maxNewTokens?: number;
  onToken?: (partialText: string) => void;
  onProgress?: (progress: ModelDownloadProgress) => void;
  signal?: AbortSignal;
}): Promise<string> {
  return enqueueLlmTask(async () => {
    if (opts.signal?.aborted) {
      throw new Error('ABORTED');
    }
    const slot: LocalAiSlot = opts.level === 'deeper' ? 'llm:deeper' : 'llm:quick';
    await acquireLocalSlot(slot);
    const worker = ensureLlmWorker();
    const id = `chat-${++reqSeq}-${Date.now()}`;

    return new Promise<string>((resolve, reject) => {
      const onAbort = () => {
        pendingRequests.delete(id);
        if (loadedSlotReady !== slot) {
          // Terminating cancels in-flight model downloads or WebGPU shader compiles cleanly.
          void unloadLlmWorker();
        } else {
          try {
            worker.postMessage({ type: 'abort', id });
          } catch {
            // Ignore abort failure.
          }
        }
        reject(new Error('ABORTED'));
      };

      if (opts.signal) {
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      pendingRequests.set(id, {
        resolve: (text) => {
          opts.signal?.removeEventListener('abort', onAbort);
          resolve(text);
        },
        reject: (err) => {
          opts.signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
        onToken: opts.onToken,
        onProgress: opts.onProgress,
      });

      worker.postMessage({
        type: 'coachChat',
        id,
        level: opts.level,
        messages: opts.messages,
        systemPrompt: opts.systemPrompt,
        maxNewTokens: opts.maxNewTokens ?? 220,
      });
    });
  });
}

const WEBLLM_CACHE_NAMES = ['webllm/model', 'webllm/config', 'webllm/wasm'] as const;

function classifyCachedUrl(url: string, cacheName?: string): CachedModelSummary['key'] {
  const lower = url.toLowerCase();
  if (
    lower.includes(LOCAL_MODEL_CATALOG.llmDeeper.id.toLowerCase()) ||
    (LOCAL_MODEL_CATALOG.llmDeeper.f32FallbackId && lower.includes(LOCAL_MODEL_CATALOG.llmDeeper.f32FallbackId.toLowerCase())) ||
    (LOCAL_MODEL_CATALOG.llmDeeper.wasmFallbackId && lower.includes(LOCAL_MODEL_CATALOG.llmDeeper.wasmFallbackId.toLowerCase())) ||
    lower.includes('1.5b') ||
    lower.includes('1.7b')
  ) {
    return 'deeper_llm';
  }
  if (
    lower.includes(LOCAL_MODEL_CATALOG.llmQuick.id.toLowerCase()) ||
    (LOCAL_MODEL_CATALOG.llmQuick.f32FallbackId && lower.includes(LOCAL_MODEL_CATALOG.llmQuick.f32FallbackId.toLowerCase())) ||
    (LOCAL_MODEL_CATALOG.llmQuick.wasmFallbackId && lower.includes(LOCAL_MODEL_CATALOG.llmQuick.wasmFallbackId.toLowerCase())) ||
    lower.includes('0.5b') ||
    lower.includes('360m')
  ) {
    return 'quick_llm';
  }
  if (cacheName && (WEBLLM_CACHE_NAMES as readonly string[]).includes(cacheName)) {
    return 'quick_llm';
  }
  return 'photo_scanner';
}

export async function getCachedModelsInfo(): Promise<CachedModelsInfo> {
  if (typeof caches === 'undefined') {
    return {
      supported: false,
      totalBytes: 0,
      totalMb: 0,
      items: [],
      activeSlot,
    };
  }

  const bucketBytes: Record<CachedModelSummary['key'], number> = {
    quick_llm: 0,
    deeper_llm: 0,
    photo_scanner: 0,
  };

  for (const cacheName of [LOCAL_MODEL_CACHE_NAME, TRANSFORMERS_CACHE_NAME, ...WEBLLM_CACHE_NAMES]) {
    try {
      const has = await caches.has(cacheName);
      if (!has) continue;
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      for (const req of requests) {
        const res = await cache.match(req);
        if (!res) continue;
        let bytes = 0;
        const cl = res.headers.get('content-length');
        if (cl && Number.isFinite(Number(cl))) {
          bytes = Number(cl);
        } else {
          try {
            const buf = await res.clone().arrayBuffer();
            bytes = buf.byteLength;
          } catch {
            bytes = 0;
          }
        }
        const key = classifyCachedUrl(req.url, cacheName);
        bucketBytes[key] += bytes;
      }
    } catch {
      // Ignore individual cache read errors.
    }
  }

  const items: CachedModelSummary[] = (Object.entries(bucketBytes) as [CachedModelSummary['key'], number][])
    .filter(([, bytes]) => bytes > 0)
    .map(([key, bytes]) => ({
      key,
      bytes,
      mb: Math.round((bytes / (1024 * 1024)) * 10) / 10,
    }));

  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
  return {
    supported: true,
    totalBytes,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
    items,
    activeSlot,
  };
}

export async function clearLocalModelCache(): Promise<void> {
  await unloadAllLocalAi();
  if (typeof caches === 'undefined') return;
  for (const cacheName of [LOCAL_MODEL_CACHE_NAME, TRANSFORMERS_CACHE_NAME, ...WEBLLM_CACHE_NAMES]) {
    try {
      await caches.delete(cacheName);
    } catch {
      // Ignore cache delete errors.
    }
  }
}
