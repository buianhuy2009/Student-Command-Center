/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
import { LOCAL_MODEL_CACHE_NAME, LOCAL_MODEL_CATALOG } from '../services/localAiConfig';
import { buildSpeechChunks, mergeAndPadIntervals } from '../utils/audioChunking';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
if (typeof self !== 'undefined' && !self.crossOriginIsolated) {
  ort.env.wasm.numThreads = 1;
}

type VadWorkerRequest =
  | {
      type: 'process';
      id: string;
      pcm16k: Float32Array;
      sampleRate: number;
      mode: 'online' | 'offline';
    }
  | { type: 'abort'; id?: string };

let cancelledId: string | null = null;

function isCancelled(id: string): boolean {
  return cancelledId === id || cancelledId === '__all__';
}

function postProgress(id: string, percent: number, stage: 'downloading' | 'vad' | 'chunking') {
  self.postMessage({
    type: 'progress',
    id,
    stage,
    percent: Math.min(15, Math.max(0, Math.round(percent))),
  });
}

async function fetchVadModelBytes(requestId: string): Promise<Uint8Array | null> {
  const urls = LOCAL_MODEL_CATALOG.sileroVad.urls;
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
      for (const u of urls) {
        const cached = await cache.match(u);
        if (cached) {
          postProgress(requestId, 5, 'downloading');
          return new Uint8Array(await cached.arrayBuffer());
        }
      }
    } catch {
      // Ignore cache lookup failure.
    }
  }

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      postProgress(requestId, 5, 'downloading');
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
          await cache.put(
            url,
            new Response(bytes.buffer as ArrayBuffer, {
              status: 200,
              headers: {
                'content-type': 'application/octet-stream',
                'content-length': String(bytes.byteLength),
              },
            })
          );
        } catch {}
      }
      return bytes;
    } catch {
      // Try mirror URL.
    }
  }
  return null;
}

/**
 * Fallback energy-based VAD when offline without cached Silero VAD weights.
 */
function runEnergyVad(pcm16k: Float32Array, windowSize: number): boolean[] {
  const numWindows = Math.floor(pcm16k.length / windowSize);
  const rmsList = new Float32Array(numWindows);
  let sumRms = 0;

  for (let w = 0; w < numWindows; w++) {
    const base = w * windowSize;
    let sq = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = pcm16k[base + i];
      sq += s * s;
    }
    const rms = Math.sqrt(sq / windowSize);
    rmsList[w] = rms;
    sumRms += rms;
  }

  const avgRms = numWindows > 0 ? sumRms / numWindows : 0;
  const threshold = Math.max(0.008, avgRms * 0.45);
  const mask: boolean[] = new Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    mask[w] = rmsList[w] >= threshold;
  }
  return mask;
}

async function runSileroVad(
  pcm16k: Float32Array,
  sampleRate: number,
  requestId: string
): Promise<boolean[]> {
  const windowSize = 512;
  const numWindows = Math.floor(pcm16k.length / windowSize);
  if (numWindows === 0) return [];

  const modelBytes = await fetchVadModelBytes(requestId);
  if (!modelBytes) {
    return runEnergyVad(pcm16k, windowSize);
  }
  if (isCancelled(requestId)) throw new Error('ABORTED');

  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ['wasm'],
  });

  const inputNames = new Set(session.inputNames);
  const isV5 = inputNames.has('state');
  const srTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(sampleRate)]), [1]);

  let stateTensor: ort.Tensor | null = isV5
    ? new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128])
    : null;
  let hTensor: ort.Tensor | null = !isV5
    ? new ort.Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64])
    : null;
  let cTensor: ort.Tensor | null = !isV5
    ? new ort.Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64])
    : null;

  const mask: boolean[] = new Array(numWindows).fill(false);
  const threshold = 0.42;
  const progressInterval = Math.max(1, Math.floor(numWindows / 25));

  try {
    for (let w = 0; w < numWindows; w++) {
      if (isCancelled(requestId)) throw new Error('ABORTED');
      if (w % progressInterval === 0) {
        const frac = w / numWindows;
        postProgress(requestId, 5 + frac * 8, 'vad');
      }

      const frame = pcm16k.subarray(w * windowSize, (w + 1) * windowSize);
      const inputTensor = new ort.Tensor('float32', frame, [1, windowSize]);
      let outputs: Record<string, ort.Tensor> | null = null;

      try {
        if (isV5 && stateTensor) {
          outputs = await session.run({
            input: inputTensor,
            state: stateTensor,
            sr: srTensor,
          });
          const prob = (outputs.output?.data as Float32Array)?.[0] ?? 0;
          mask[w] = prob >= threshold;
          if (outputs.stateN) {
            stateTensor.dispose();
            stateTensor = outputs.stateN;
          }
        } else if (hTensor && cTensor) {
          outputs = await session.run({
            input: inputTensor,
            sr: srTensor,
            h: hTensor,
            c: cTensor,
          });
          const prob = (outputs.output?.data as Float32Array)?.[0] ?? 0;
          mask[w] = prob >= threshold;
          if (outputs.hn) {
            hTensor.dispose();
            hTensor = outputs.hn;
          }
          if (outputs.cn) {
            cTensor.dispose();
            cTensor = outputs.cn;
          }
        }
      } finally {
        inputTensor.dispose();
        outputs?.output?.dispose();
      }
    }
  } finally {
    srTensor.dispose();
    stateTensor?.dispose();
    hTensor?.dispose();
    cTensor?.dispose();
    await session.release().catch(() => {});
  }

  return mask;
}

self.onmessage = async (event: MessageEvent<VadWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'abort') {
    cancelledId = msg.id || '__all__';
    return;
  }

  if (msg.type === 'process') {
    cancelledId = null;
    try {
      postProgress(msg.id, 1, 'downloading');
      const mask = await runSileroVad(msg.pcm16k, msg.sampleRate, msg.id);
      if (isCancelled(msg.id)) throw new Error('ABORTED');

      postProgress(msg.id, 14, 'chunking');
      const intervals = mergeAndPadIntervals(mask, msg.sampleRate, 512, msg.pcm16k.length);
      const originalDurationSec = Math.round((msg.pcm16k.length / msg.sampleRate) * 10) / 10;
      const chunked = buildSpeechChunks(msg.pcm16k, msg.sampleRate, intervals, msg.mode);

      const transferables: Transferable[] = [];
      for (const c of chunked.onlineChunks) {
        transferables.push(c.wavBytes.buffer);
      }
      for (const c of chunked.offlineClips) {
        transferables.push(c.pcm16k.buffer);
      }

      postProgress(msg.id, 15, 'chunking');
      self.postMessage(
        {
          type: 'done',
          id: msg.id,
          originalDurationSec,
          speechDurationSec: chunked.speechDurationSec,
          onlineChunks: chunked.onlineChunks,
          offlineClips: chunked.offlineClips,
        },
        transferables
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', id: msg.id, error: message });
    }
  }
};
