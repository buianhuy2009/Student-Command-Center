import { acquireLocalSlot, registerOcrUnloader, releaseLocalSlot } from './localAi';
import { type OcrMode } from './localAiConfig';
import type { NormalizedCropRect } from '../workers/ocr.worker';

export type { NormalizedCropRect };

export interface OcrScanProgress {
  stage: 'downloading' | 'reading';
  percent: number;
  loaded?: number;
  total?: number;
  completed?: number;
  lineTotal?: number;
}

export interface OcrScanResult {
  markdown: string;
  lineCount: number;
}

let ocrWorker: Worker | null = null;
let ocrSeq = 0;

const pendingOcr = new Map<
  string,
  {
    resolve: (res: OcrScanResult) => void;
    reject: (err: Error) => void;
    onProgress?: (progress: OcrScanProgress) => void;
  }
>();

export function terminateOcrWorker(): void {
  const worker = ocrWorker;
  ocrWorker = null;
  if (!worker) return;

  for (const [id, cb] of pendingOcr.entries()) {
    pendingOcr.delete(id);
    cb.reject(new Error('ABORTED'));
  }

  try {
    worker.postMessage({ type: 'unload' });
  } catch {}
  try {
    worker.terminate();
  } catch {}
  releaseLocalSlot('ocr');
}

registerOcrUnloader(terminateOcrWorker);

function ensureOcrWorker(): Worker {
  if (ocrWorker) return ocrWorker;
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this browser.');
  }
  const worker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (event: MessageEvent<any>) => {
    const data = event.data;
    if (!data || !data.type) return;
    const cb = data.id ? pendingOcr.get(data.id) : undefined;
    if (!cb) return;

    if (data.type === 'progress') {
      cb.onProgress?.({
        stage: data.stage === 'reading' ? 'reading' : 'downloading',
        percent: Number(data.percent || 0),
        loaded: typeof data.loaded === 'number' ? data.loaded : undefined,
        total: typeof data.total === 'number' ? data.total : undefined,
        completed: typeof data.completed === 'number' ? data.completed : undefined,
        lineTotal: typeof data.total === 'number' && data.stage === 'reading' ? data.total : undefined,
      });
      return;
    }

    if (data.type === 'done') {
      pendingOcr.delete(data.id);
      releaseLocalSlot('ocr');
      cb.resolve({
        markdown: String(data.markdown || ''),
        lineCount: Number(data.lineCount || 0),
      });
      return;
    }

    if (data.type === 'error') {
      pendingOcr.delete(data.id);
      releaseLocalSlot('ocr');
      cb.reject(new Error(String(data.error || 'Photo scan failed')));
    }
  };
  worker.onerror = (err) => {
    for (const [id, cb] of pendingOcr.entries()) {
      pendingOcr.delete(id);
      cb.reject(new Error(err?.message || 'Photo scanner worker error'));
    }
    releaseLocalSlot('ocr');
  };
  ocrWorker = worker;
  return worker;
}

/**
 * Scans an image completely on-device (full-page line detection + 1-line-at-a-time recognition).
 * Automatically unloads any active Offline LLM first so peak RAM stays within 8 GB laptop budgets.
 */
export async function scanImageToNoteMarkdown(
  imageBlob: Blob,
  opts: {
    mode: OcrMode;
    cropRect?: NormalizedCropRect;
    onProgress?: (progress: OcrScanProgress) => void;
    signal?: AbortSignal;
  }
): Promise<OcrScanResult> {
  if (opts.signal?.aborted) {
    throw new Error('ABORTED');
  }

  await acquireLocalSlot('ocr');
  const worker = ensureOcrWorker();
  const id = `ocr-${++ocrSeq}-${Date.now()}`;

  return new Promise<OcrScanResult>((resolve, reject) => {
    const onAbort = () => {
      try {
        worker.postMessage({ type: 'abort', id });
      } catch {}
      pendingOcr.delete(id);
      releaseLocalSlot('ocr');
      reject(new Error('ABORTED'));
    };

    if (opts.signal) {
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    pendingOcr.set(id, {
      resolve: (res) => {
        opts.signal?.removeEventListener('abort', onAbort);
        resolve(res);
      },
      reject: (err) => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
      onProgress: opts.onProgress,
    });

    worker.postMessage({
      type: 'scan',
      id,
      imageBlob,
      mode: opts.mode,
      cropRect: opts.cropRect,
    });
  });
}
