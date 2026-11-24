/// <reference lib="webworker" />
import { env, pipeline, type ProgressInfo } from '@huggingface/transformers';
import { LOCAL_MODEL_CATALOG } from '../services/localAiConfig';

env.allowLocalModels = false;
env.useBrowserCache = true;
if (typeof self !== 'undefined' && !self.crossOriginIsolated && env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

export interface AsrInputClip {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  pcm16k: Float32Array;
}

type AsrWorkerRequest =
  | {
      type: 'transcribe-clips';
      id: string;
      modelTier: 'offline-tiny' | 'offline-base';
      language: 'auto' | 'vi' | 'en';
      clips: AsrInputClip[];
    }
  | { type: 'abort'; id?: string };

let cancelledId: string | null = null;

function isCancelled(id: string): boolean {
  return cancelledId === id || cancelledId === '__all__';
}

function postAsrProgress(
  id: string,
  payload: {
    stage: 'downloading' | 'transcribing';
    percent: number;
    file?: string;
    loaded?: number;
    total?: number;
    currentClip?: number;
    totalClips?: number;
  }
) {
  self.postMessage({
    type: 'progress',
    id,
    stage: payload.stage,
    file: payload.file,
    loaded: payload.loaded,
    total: payload.total,
    currentClip: payload.currentClip,
    totalClips: payload.totalClips,
    percent: Math.min(99, Math.max(0, Math.round(payload.percent))),
  });
}

async function createAsrPipeline(
  modelTier: 'offline-tiny' | 'offline-base',
  requestId: string
) {
  const entry =
    modelTier === 'offline-base'
      ? LOCAL_MODEL_CATALOG.asrBase
      : LOCAL_MODEL_CATALOG.asrTiny;

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
      postAsrProgress(requestId, {
        stage: 'downloading',
        file: info.file,
        loaded: totalLoaded,
        total: totalExpected,
        percent: 15 + Math.min(1, Math.max(0, frac)) * 10,
      });
    }
  };

  const candidates = [entry.id, entry.fallbackId].filter(Boolean) as string[];
  let lastErr: unknown = null;

  for (const modelId of candidates) {
    if (isCancelled(requestId)) throw new Error('ABORTED');
    try {
      const asrPipe = await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback,
      });
      return asrPipe;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Failed to load offline speech recognition model.');
}

self.onmessage = async (event: MessageEvent<AsrWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'abort') {
    cancelledId = msg.id || '__all__';
    return;
  }

  if (msg.type === 'transcribe-clips') {
    cancelledId = null;
    let asrPipe: any = null;
    try {
      postAsrProgress(msg.id, {
        stage: 'downloading',
        percent: 15,
      });

      asrPipe = await createAsrPipeline(msg.modelTier, msg.id);
      if (isCancelled(msg.id)) throw new Error('ABORTED');

      const total = msg.clips.length;
      for (let i = 0; i < total; i++) {
        if (isCancelled(msg.id)) throw new Error('ABORTED');
        const clip = msg.clips[i];
        postAsrProgress(msg.id, {
          stage: 'transcribing',
          currentClip: i + 1,
          totalClips: total,
          percent: 25 + (i / Math.max(1, total)) * 73,
        });

        const opts: Record<string, unknown> = {
          chunk_length_s: 30,
          stride_length_s: 5,
        };
        if (msg.language === 'vi') opts.language = 'vietnamese';
        else if (msg.language === 'en') opts.language = 'english';

        const out = await asrPipe(clip.pcm16k, opts);
        const text = String(Array.isArray(out) ? out[0]?.text || '' : out?.text || '').trim();

        self.postMessage({
          type: 'clip-done',
          id: msg.id,
          completed: i + 1,
          total,
          segment: {
            chunkIndex: clip.chunkIndex,
            startSec: clip.startSec,
            endSec: clip.endSec,
            text,
          },
        });
      }

      self.postMessage({
        type: 'done',
        id: msg.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', id: msg.id, error: message });
    } finally {
      await asrPipe?.dispose?.().catch(() => {});
    }
  }
};
