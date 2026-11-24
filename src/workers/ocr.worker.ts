/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
import {
  LOCAL_MODEL_CACHE_NAME,
  LOCAL_MODEL_CATALOG,
  type OcrMode,
} from '../services/localAiConfig';
import {
  formatOcrLinesToMarkdown,
  sortLinesInReadingOrder,
  type OcrBox,
  type OcrLineBox,
} from '../utils/noteFormatter';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
if (typeof self !== 'undefined' && !self.crossOriginIsolated) {
  ort.env.wasm.numThreads = 1;
}

export interface NormalizedCropRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

type OcrWorkerRequest =
  | {
      type: 'scan';
      id: string;
      imageBlob: Blob;
      mode: OcrMode;
      cropRect?: NormalizedCropRect;
    }
  | { type: 'abort'; id?: string }
  | { type: 'unload'; id?: string };

let cancelledId: string | null = null;

function isCancelled(id: string): boolean {
  return cancelledId === id || cancelledId === '__all__';
}

function postWeightedProgress(
  requestId: string,
  payload: {
    stage: 'downloading' | 'detecting' | 'reading' | 'formatting';
    percent: number;
    file?: string;
    loaded?: number;
    total?: number;
    completed?: number;
    totalLines?: number;
  }
) {
  self.postMessage({
    type: 'progress',
    id: requestId,
    stage: payload.stage,
    file: payload.file,
    loaded: payload.loaded,
    total: payload.total,
    completed: payload.completed,
    totalLines: payload.totalLines,
    percent: Math.min(100, Math.max(0, Math.round(payload.percent))),
  });
}

async function fetchWithCacheAndProgress(
  url: string,
  requestId: string,
  fileLabel: string,
  progressRange: [number, number]
): Promise<Uint8Array> {
  const [pStart, pEnd] = progressRange;
  const emit = (loaded: number, total: number, pct: number) => {
    postWeightedProgress(requestId, {
      stage: 'downloading',
      file: fileLabel,
      loaded,
      total,
      percent: pct,
    });
  };

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const buf = new Uint8Array(await cached.arrayBuffer());
        emit(buf.byteLength, buf.byteLength, pEnd);
        return buf;
      }
    } catch {
      // Cache lookup failed; fall through to network fetch.
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download scanner model (${res.status}).`);
  }

  const totalHeader = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader();
  let bytes: Uint8Array;

  if (reader) {
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      if (isCancelled(requestId)) {
        await reader.cancel().catch(() => {});
        throw new Error('ABORTED');
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        const frac = totalHeader > 0 ? Math.min(1, loaded / totalHeader) : 0.5;
        emit(loaded, totalHeader || loaded, pStart + frac * (pEnd - pStart));
      }
    }
    bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await res.arrayBuffer());
    emit(bytes.byteLength, bytes.byteLength, pEnd);
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
      const headers = new Headers({
        'content-type': res.headers.get('content-type') || 'application/octet-stream',
        'content-length': String(bytes.byteLength),
      });
      await cache.put(url, new Response(bytes.buffer as ArrayBuffer, { status: 200, headers }));
    } catch {
      // Ignore cache quota errors; inference can still proceed from memory.
    }
  }

  return bytes;
}

async function fetchTextWithCache(url: string): Promise<string> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) return await cached.text();
    } catch {
      // Ignore cache error.
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch dictionary (${res.status}).`);
  const text = await res.text();
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(LOCAL_MODEL_CACHE_NAME);
      await cache.put(
        url,
        new Response(text, {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      );
    } catch {
      // Ignore cache error.
    }
  }
  return text;
}

function createPageCanvas(
  bitmap: ImageBitmap,
  cropRect?: NormalizedCropRect
): { canvas: OffscreenCanvas; width: number; height: number } {
  const sx = cropRect ? Math.max(0, Math.floor(cropRect.x * bitmap.width)) : 0;
  const sy = cropRect ? Math.max(0, Math.floor(cropRect.y * bitmap.height)) : 0;
  const sw = cropRect
    ? Math.max(16, Math.min(bitmap.width - sx, Math.floor(cropRect.width * bitmap.width)))
    : bitmap.width;
  const sh = cropRect
    ? Math.max(16, Math.min(bitmap.height - sy, Math.floor(cropRect.height * bitmap.height)))
    : bitmap.height;

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const width = Math.max(16, Math.round(sw * scale));
  const height = Math.max(16, Math.round(sh * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  return { canvas, width, height };
}

function extractConnectedBoxes(
  probMap: Float32Array,
  detW: number,
  detH: number,
  pageW: number,
  pageH: number
): OcrBox[] {
  const threshold = 0.3;
  const visited = new Uint8Array(detW * detH);
  const rawBoxes: OcrBox[] = [];
  const scaleX = pageW / detW;
  const scaleY = pageH / detH;

  const queueX = new Int32Array(detW * detH);
  const queueY = new Int32Array(detW * detH);

  for (let y = 0; y < detH; y++) {
    for (let x = 0; x < detW; x++) {
      const idx = y * detW + x;
      if (visited[idx] || probMap[idx] <= threshold) continue;

      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail++;
      visited[idx] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;

      while (head < tail) {
        const cx = queueX[head];
        const cy = queueY[head];
        head++;
        count++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= detW || ny < 0 || ny >= detH) continue;
          const nIdx = ny * detW + nx;
          if (!visited[nIdx] && probMap[nIdx] > threshold) {
            visited[nIdx] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }

      if (count < 12) continue;
      const bw = (maxX - minX + 1) * scaleX;
      const bh = (maxY - minY + 1) * scaleY;
      if (bw < 10 || bh < 6) continue;

      // Expand DBNet box slightly so Vietnamese diacritics and punctuation stay intact.
      const padX = Math.max(6, bh * 0.25);
      const padY = Math.max(4, bh * 0.3);
      const x0 = Math.max(0, Math.floor(minX * scaleX - padX));
      const y0 = Math.max(0, Math.floor(minY * scaleY - padY));
      const x1 = Math.min(pageW, Math.ceil((maxX + 1) * scaleX + padX));
      const y1 = Math.min(pageH, Math.ceil((maxY + 1) * scaleY + padY));
      rawBoxes.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
    }
  }

  return mergeHorizontalLineFragments(rawBoxes);
}

function mergeHorizontalLineFragments(boxes: OcrBox[]): OcrBox[] {
  if (boxes.length <= 1) return boxes;
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: OcrBox[] = [];

  for (const box of sorted) {
    const cy = box.y + box.height / 2;
    const match = merged.find((m) => {
      const mCy = m.y + m.height / 2;
      const hRef = Math.min(m.height, box.height);
      const sameRow = Math.abs(cy - mCy) <= hRef * 0.55;
      const gap = box.x - (m.x + m.width);
      const overlapOrClose = gap <= hRef * 1.45 && box.x + box.width >= m.x - hRef * 1.45;
      return sameRow && overlapOrClose;
    });
    if (match) {
      const x0 = Math.min(match.x, box.x);
      const y0 = Math.min(match.y, box.y);
      const x1 = Math.max(match.x + match.width, box.x + box.width);
      const y1 = Math.max(match.y + match.height, box.y + box.height);
      match.x = x0;
      match.y = y0;
      match.width = x1 - x0;
      match.height = y1 - y0;
    } else {
      merged.push({ ...box });
    }
  }

  return merged;
}

async function detectLinesWithDbNet(
  pageCanvas: OffscreenCanvas,
  pageW: number,
  pageH: number,
  requestId: string
): Promise<OcrBox[]> {
  const detUrl = LOCAL_MODEL_CATALOG.ocrDetector.urls[0];
  const detBytes = await fetchWithCacheAndProgress(detUrl, requestId, 'detector', [0, 6]);
  if (isCancelled(requestId)) throw new Error('ABORTED');

  postWeightedProgress(requestId, {
    stage: 'detecting',
    percent: 18,
  });

  const detSession = await ort.InferenceSession.create(detBytes, {
    executionProviders: ['wasm'],
  });

  let detTensor: ort.Tensor | null = null;
  let outTensor: ort.Tensor | null = null;

  try {
    const maxDetSide = 960;
    const ratio = Math.min(1, maxDetSide / Math.max(pageW, pageH));
    const detW = Math.max(32, Math.round((pageW * ratio) / 32) * 32);
    const detH = Math.max(32, Math.round((pageH * ratio) / 32) * 32);

    const tmpCanvas = new OffscreenCanvas(detW, detH);
    const ctx = tmpCanvas.getContext('2d')!;
    ctx.drawImage(pageCanvas, 0, 0, detW, detH);
    const imgData = ctx.getImageData(0, 0, detW, detH).data;

    const area = detW * detH;
    const inputArr = new Float32Array(3 * area);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < area; i++) {
      const r = imgData[i * 4] / 255;
      const g = imgData[i * 4 + 1] / 255;
      const b = imgData[i * 4 + 2] / 255;
      inputArr[i] = (r - mean[0]) / std[0];
      inputArr[area + i] = (g - mean[1]) / std[1];
      inputArr[2 * area + i] = (b - mean[2]) / std[2];
    }

    detTensor = new ort.Tensor('float32', inputArr, [1, 3, detH, detW]);
    const inputName = detSession.inputNames[0] || 'x';
    const outputName = detSession.outputNames[0] || 'fetch_name_0';
    const outputs = await detSession.run({ [inputName]: detTensor });
    outTensor = outputs[outputName];
    const probData = outTensor.data as Float32Array;

    const boxes = extractConnectedBoxes(probData, detW, detH, pageW, pageH);
    const finalBoxes =
      boxes.length === 0
        ? [{ x: 0, y: 0, width: pageW, height: pageH }]
        : sortLinesInReadingOrder(boxes.map((box) => ({ text: '', box }))).map((item) => item.box);

    postWeightedProgress(requestId, {
      stage: 'detecting',
      percent: 25,
      totalLines: finalBoxes.length,
    });
    return finalBoxes;
  } finally {
    detTensor?.dispose();
    outTensor?.dispose();
    await detSession.release().catch(() => {});
  }
}

function cropLineToCanvas(
  pageCanvas: OffscreenCanvas,
  box: OcrBox,
  targetHeight: number,
  maxWidth: number,
  widthMultiple = 1
): { canvas: OffscreenCanvas; width: number; height: number } {
  const aspect = Math.max(0.2, box.width / Math.max(1, box.height));
  // Preserve exact aspect ratio of the cropped line and right-pad with white
  // instead of stretching short words horizontally.
  const drawWidth = Math.min(maxWidth, Math.max(8, Math.round(targetHeight * aspect)));
  let width = Math.min(maxWidth, Math.max(targetHeight, drawWidth));
  if (widthMultiple > 1) {
    width = Math.max(widthMultiple, Math.ceil(width / widthMultiple) * widthMultiple);
    width = Math.min(maxWidth, width);
  }
  const canvas = new OffscreenCanvas(width, targetHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, targetHeight);
  ctx.drawImage(
    pageCanvas,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    Math.min(width, drawWidth),
    targetHeight
  );
  return { canvas, width, height: targetHeight };
}

function weightedLinePercent(completed: number, total: number): number {
  if (total <= 0) return 98;
  return Math.round(25 + (completed / total) * 73);
}

async function recognizePaddleLines(
  pageCanvas: OffscreenCanvas,
  boxes: OcrBox[],
  requestId: string,
  urls: readonly [string, string],
  fileLabel: string
): Promise<OcrLineBox[]> {
  const [recUrl, dictUrl] = urls;
  const [recBytes, dictText] = await Promise.all([
    fetchWithCacheAndProgress(recUrl, requestId, fileLabel, [6, 15]),
    fetchTextWithCache(dictUrl),
  ]);
  if (isCancelled(requestId)) throw new Error('ABORTED');

  const dictChars = dictText.replace(/\r/g, '').split('\n');
  const recSession = await ort.InferenceSession.create(recBytes, {
    executionProviders: ['wasm'],
  });

  const results: OcrLineBox[] = [];
  try {
    const inputName = recSession.inputNames[0] || 'x';
    const outputName = recSession.outputNames[0] || 'fetch_name_0';

    for (let i = 0; i < boxes.length; i++) {
      if (isCancelled(requestId)) throw new Error('ABORTED');
      postWeightedProgress(requestId, {
        stage: 'reading',
        completed: i,
        totalLines: boxes.length,
        percent: weightedLinePercent(i, boxes.length),
      });

      const box = boxes[i];
      const { canvas, width, height } = cropLineToCanvas(pageCanvas, box, 48, 640, 8);
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.getImageData(0, 0, width, height).data;
      const area = width * height;
      const arr = new Float32Array(3 * area);

      for (let p = 0; p < area; p++) {
        const r = imgData[p * 4] / 255;
        const g = imgData[p * 4 + 1] / 255;
        const b = imgData[p * 4 + 2] / 255;
        arr[p] = (b - 0.5) / 0.5;
        arr[area + p] = (g - 0.5) / 0.5;
        arr[2 * area + p] = (r - 0.5) / 0.5;
      }

      const tensor = new ort.Tensor('float32', arr, [1, 3, height, width]);
      let outTensor: ort.Tensor | null = null;
      try {
        const out = await recSession.run({ [inputName]: tensor });
        outTensor = out[outputName];
        const [, steps, classes] = outTensor.dims;
        const logits = outTensor.data as Float32Array;

        let text = '';
        let prevIdx = -1;
        for (let t = 0; t < steps; t++) {
          const offset = t * classes;
          let bestIdx = 0;
          let bestVal = logits[offset];
          for (let c = 1; c < classes; c++) {
            if (logits[offset + c] > bestVal) {
              bestVal = logits[offset + c];
              bestIdx = c;
            }
          }
          if (bestIdx !== 0 && bestIdx !== prevIdx) {
            if (bestIdx === classes - 1) {
              text += ' ';
            } else {
              const ch = dictChars[bestIdx - 1];
              if (ch !== undefined) text += ch;
            }
          }
          prevIdx = bestIdx;
        }
        results.push({ text: text.trim(), box });
      } finally {
        tensor.dispose();
        outTensor?.dispose();
      }
    }
  } finally {
    await recSession.release().catch(() => {});
  }

  return results;
}

async function recognizePrintedLines(
  pageCanvas: OffscreenCanvas,
  boxes: OcrBox[],
  requestId: string
): Promise<OcrLineBox[]> {
  return recognizePaddleLines(
    pageCanvas,
    boxes,
    requestId,
    LOCAL_MODEL_CATALOG.ocrPrinted.urls,
    'printed-ocr'
  );
}

async function recognizeEnglishHandwriting(
  pageCanvas: OffscreenCanvas,
  boxes: OcrBox[],
  requestId: string
): Promise<OcrLineBox[]> {
  return recognizePaddleLines(
    pageCanvas,
    boxes,
    requestId,
    LOCAL_MODEL_CATALOG.ocrHandwrittenEn.urls,
    'en-ocr'
  );
}

async function recognizeVietnameseHandwriting(
  pageCanvas: OffscreenCanvas,
  boxes: OcrBox[],
  requestId: string
): Promise<OcrLineBox[]> {
  const [encUrl, decInitUrl, decStepUrl, vocabUrl] = LOCAL_MODEL_CATALOG.ocrHandwrittenVi.urls;
  const encBytes = await fetchWithCacheAndProgress(encUrl, requestId, 'vi-enc', [6, 11]);
  const decInitBytes = await fetchWithCacheAndProgress(decInitUrl, requestId, 'vi-init', [11, 13]);
  const decStepBytes = await fetchWithCacheAndProgress(decStepUrl, requestId, 'vi-step', [13, 15]);
  const vocabText = await fetchTextWithCache(vocabUrl);
  if (isCancelled(requestId)) throw new Error('ABORTED');

  const vocab = vocabText.replace(/\r/g, '').split('\n');
  const SOS_ID = 1n;
  const EOS_ID = 2;
  const PAD_ID = 0;

  const [encSession, decInitSession, decStepSession] = await Promise.all([
    ort.InferenceSession.create(encBytes, { executionProviders: ['wasm'] }),
    ort.InferenceSession.create(decInitBytes, { executionProviders: ['wasm'] }),
    ort.InferenceSession.create(decStepBytes, { executionProviders: ['wasm'] }),
  ]);

  const results: OcrLineBox[] = [];
  try {
    for (let i = 0; i < boxes.length; i++) {
      if (isCancelled(requestId)) throw new Error('ABORTED');
      postWeightedProgress(requestId, {
        stage: 'reading',
        completed: i,
        totalLines: boxes.length,
        percent: weightedLinePercent(i, boxes.length),
      });

      const box = boxes[i];
      const { canvas, width, height } = cropLineToCanvas(pageCanvas, box, 32, 512, 16);
      const ctx = canvas.getContext('2d')!;
      const imgData = ctx.getImageData(0, 0, width, height).data;
      const area = width * height;
      const arr = new Float32Array(3 * area);

      // VietOCR expects RGB float32 normalized strictly to [0, 1] (NOT [-1, 1]).
      for (let p = 0; p < area; p++) {
        arr[p] = imgData[p * 4] / 255;
        arr[area + p] = imgData[p * 4 + 1] / 255;
        arr[2 * area + p] = imgData[p * 4 + 2] / 255;
      }

      const imgTensor = new ort.Tensor('float32', arr, [1, 3, height, width]);
      let memoryTensor: ort.Tensor | null = null;
      let crossK: ort.Tensor | null = null;
      let crossV: ort.Tensor | null = null;
      let pastK: ort.Tensor | null = null;
      let pastV: ort.Tensor | null = null;

      try {
        const encOut = await encSession.run({ image: imgTensor });
        memoryTensor = encOut.memory;
        imgTensor.dispose();

        const initOut = await decInitSession.run({ memory: memoryTensor });
        crossK = initOut.cross_k;
        crossV = initOut.cross_v;
        memoryTensor.dispose();
        memoryTensor = null;

        pastK = new ort.Tensor('float32', new Float32Array(0), [6, 8, 0, 32]);
        pastV = new ort.Tensor('float32', new Float32Array(0), [6, 8, 0, 32]);

        let currentToken = SOS_ID;
        let lineText = '';

        for (let step = 0; step < 128; step++) {
          const tokTensor = new ort.Tensor('int64', BigInt64Array.from([currentToken]), [1]);
          const posTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(step)]), [1]);
          let stepOut: Record<string, ort.Tensor> | null = null;

          try {
            stepOut = await decStepSession.run({
              token: tokTensor,
              pos: posTensor,
              past_k: pastK,
              past_v: pastV,
              cross_k: crossK,
              cross_v: crossV,
            });
          } finally {
            tokTensor.dispose();
            posTensor.dispose();
            pastK.dispose();
            pastV.dispose();
          }

          pastK = stepOut.new_k;
          pastV = stepOut.new_v;

          const logits = stepOut.logits.data as Float32Array;
          let bestId = 0;
          let bestScore = logits[0];
          for (let c = 1; c < logits.length; c++) {
            if (logits[c] > bestScore) {
              bestScore = logits[c];
              bestId = c;
            }
          }
          stepOut.logits.dispose();

          if (bestId === EOS_ID || bestId === PAD_ID) break;
          if (bestId >= 4 && vocab[bestId] !== undefined) {
            lineText += vocab[bestId];
          }
          currentToken = BigInt(bestId);
        }

        results.push({ text: lineText.trim(), box });
      } finally {
        try {
          imgTensor.dispose();
        } catch {}
        memoryTensor?.dispose();
        crossK?.dispose();
        crossV?.dispose();
        pastK?.dispose();
        pastV?.dispose();
      }
    }
  } finally {
    await Promise.all([
      encSession.release().catch(() => {}),
      decInitSession.release().catch(() => {}),
      decStepSession.release().catch(() => {}),
    ]);
  }

  return results;
}

self.onmessage = async (event: MessageEvent<OcrWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'abort') {
    cancelledId = msg.id || '__all__';
    return;
  }

  if (msg.type === 'unload') {
    cancelledId = '__all__';
    self.postMessage({ type: 'unloaded', id: msg.id });
    return;
  }

  if (msg.type === 'scan') {
    cancelledId = null;
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(msg.imageBlob);
      const { canvas: pageCanvas, width: pageW, height: pageH } = createPageCanvas(
        bitmap,
        msg.cropRect
      );
      bitmap.close();
      bitmap = null;

      if (isCancelled(msg.id)) throw new Error('ABORTED');

      const boxes = await detectLinesWithDbNet(pageCanvas, pageW, pageH, msg.id);
      if (isCancelled(msg.id)) throw new Error('ABORTED');

      let recognized: OcrLineBox[];
      if (msg.mode === 'handwritten-vi') {
        recognized = await recognizeVietnameseHandwriting(pageCanvas, boxes, msg.id);
      } else if (msg.mode === 'handwritten-en') {
        recognized = await recognizeEnglishHandwriting(pageCanvas, boxes, msg.id);
      } else {
        recognized = await recognizePrintedLines(pageCanvas, boxes, msg.id);
      }

      postWeightedProgress(msg.id, {
        stage: 'formatting',
        completed: boxes.length,
        totalLines: boxes.length,
        percent: 99,
      });

      const markdown = formatOcrLinesToMarkdown(recognized);
      self.postMessage({
        type: 'done',
        id: msg.id,
        markdown,
        lineCount: recognized.filter((r) => r.text.length > 0).length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', id: msg.id, error: message });
    } finally {
      try {
        bitmap?.close();
      } catch {}
    }
  }
};
