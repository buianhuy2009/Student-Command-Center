/// <reference lib="webworker" />
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import type {
  InterruptableStoppingCriteria,
  ProgressInfo,
} from '@huggingface/transformers';
import {
  LOCAL_MODEL_CATALOG,
  type LocalModelCatalogEntry,
  type OfflineCoachLevel,
} from '../services/localAiConfig';

type WorkerChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type WorkerRequest =
  | {
      type: 'classifyEmail';
      id: string;
      prompt: string;
      systemPrompt: string;
      maxNewTokens?: number;
    }
  | {
      type: 'coachChat';
      id: string;
      level: OfflineCoachLevel;
      messages: WorkerChatMessage[];
      systemPrompt: string;
      maxNewTokens?: number;
    }
  | { type: 'abort'; id?: string }
  | { type: 'unload'; id?: string };

type LoadedBackend = 'webllm' | 'wasm' | null;

let loadedLevel: OfflineCoachLevel | null = null;
let loadedBackend: LoadedBackend = null;
let webLlmEngine: MLCEngine | null = null;
let wasmTokenizer: {
  apply_chat_template: (msgs: WorkerChatMessage[], opts: Record<string, unknown>) => unknown;
  (text: string): { input_ids?: { dims?: number[] } } & Record<string, unknown>;
  batch_decode: (tokens: unknown, opts: Record<string, unknown>) => string[];
} | null = null;
let wasmModel: ({
  generate: (opts: Record<string, unknown>) => Promise<unknown>;
  dispose?: () => Promise<void> | void;
}) | null = null;

let loadPromise: Promise<void> | null = null;
let activeAbortCriteria: InterruptableStoppingCriteria | null = null;
let activeProgressRequestId: string | null = null;
const cancelledRequestIds = new Set<string>();
let workerQueue: Promise<void> = Promise.resolve();

function enqueueWorkerTask(fn: () => Promise<void>): void {
  workerQueue = workerQueue.then(fn, fn);
}

async function detectWebGpuCapabilities(): Promise<{ hasWebGpu: boolean; hasShaderF16: boolean }> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: {
        requestAdapter?: () => Promise<{ features?: { has?: (name: string) => boolean } } | null>;
      };
    };
    if (nav?.gpu && typeof nav.gpu.requestAdapter === 'function') {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        const hasShaderF16 = Boolean(adapter.features && typeof adapter.features.has === 'function' && adapter.features.has('shader-f16'));
        return { hasWebGpu: true, hasShaderF16 };
      }
    }
  } catch {
    // WebGPU unavailable; fall back to single-threaded WASM CPU.
  }
  return { hasWebGpu: false, hasShaderF16: false };
}

export function stripThinkBlocks(text: string): string {
  // Remove complete <think>...</think> blocks and any still-streaming unclosed <think>... tail.
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trimStart();
}

async function disposeModel(): Promise<void> {
  loadPromise = null;
  loadedLevel = null;
  loadedBackend = null;

  if (webLlmEngine) {
    const engine = webLlmEngine;
    webLlmEngine = null;
    try {
      await engine.unload();
    } catch {
      // Ignore disposal errors when freeing WebGPU memory.
    }
  }

  const model = wasmModel;
  wasmModel = null;
  wasmTokenizer = null;
  if (model && typeof model.dispose === 'function') {
    try {
      await model.dispose();
    } catch {
      // Ignore disposal errors when freeing WASM memory.
    }
  }
}

function postProgress(
  requestId: string | null,
  stage: 'downloading' | 'initializing' | 'ready',
  loaded: number,
  total: number,
  percent: number,
  file = ''
): void {
  if (!requestId) return;
  self.postMessage({
    type: 'progress',
    id: requestId,
    file,
    loaded,
    total,
    percent,
    stage,
  });
}

async function loadWebLlmEngine(
  level: OfflineCoachLevel,
  hasShaderF16: boolean
): Promise<void> {
  const entry: LocalModelCatalogEntry =
    level === 'deeper' ? LOCAL_MODEL_CATALOG.llmDeeper : LOCAL_MODEL_CATALOG.llmQuick;
  const modelId = hasShaderF16 ? entry.id : (entry.f32FallbackId || entry.id);
  const expectedTotalBytes = entry.approxMbWebGpu * 1024 * 1024;
  const contextWindowSize = entry.contextWindowSize ?? 2048;

  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

  let highestDownloadPct = 0;
  let reachedShaderInit = false;

  const initProgressCallback = (report: InitProgressReport) => {
    const targetId = activeProgressRequestId;
    if (!targetId) return;
    const progress = typeof report.progress === 'number' ? Math.max(0, Math.min(1, report.progress)) : 0;
    const lowerText = (report.text || '').toLowerCase();

    if (lowerText.includes('finish loading')) {
      postProgress(targetId, 'ready', expectedTotalBytes, expectedTotalBytes, 100);
      return;
    }

    if (lowerText.includes('loading gpu shader') || reachedShaderInit) {
      reachedShaderInit = true;
      postProgress(targetId, 'initializing', expectedTotalBytes, expectedTotalBytes, 100);
      return;
    }

    const rawPct = Math.min(99, Math.round(progress * 100));
    if (rawPct > highestDownloadPct) {
      highestDownloadPct = rawPct;
    }
    const loadedBytes = Math.round((highestDownloadPct / 100) * expectedTotalBytes);
    postProgress(targetId, 'downloading', loadedBytes, expectedTotalBytes, highestDownloadPct, report.text || '');
  };

  const engine = await CreateMLCEngine(
    modelId,
    { initProgressCallback, logLevel: 'SILENT' },
    { context_window_size: contextWindowSize }
  );

  webLlmEngine = engine;
  loadedBackend = 'webllm';
  loadedLevel = level;
}

async function loadWasmTransformersModel(level: OfflineCoachLevel): Promise<void> {
  const entry: LocalModelCatalogEntry =
    level === 'deeper' ? LOCAL_MODEL_CATALOG.llmDeeper : LOCAL_MODEL_CATALOG.llmQuick;
  const modelId = entry.wasmFallbackId || entry.id;

  const transformers = await import('@huggingface/transformers');
  const { AutoModelForCausalLM, AutoTokenizer, env } = transformers;

  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if (typeof self !== 'undefined' && !self.crossOriginIsolated) {
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }
  }

  const fileBytes = new Map<string, { loaded: number; total: number }>();
  let emittedInitializing = false;

  const emitInitializing = (loaded: number, total: number) => {
    if (emittedInitializing) return;
    emittedInitializing = true;
    postProgress(activeProgressRequestId, 'initializing', loaded || 1, total || 1, 100);
  };

  const progress_callback = (info: ProgressInfo) => {
    const targetId = activeProgressRequestId;
    if (!targetId) return;

    if (info.status === 'progress' && 'file' in info) {
      fileBytes.set(info.file, {
        loaded: info.loaded || 0,
        total: info.total || 0,
      });
      let totalLoaded = 0;
      let totalExpected = 0;
      for (const item of fileBytes.values()) {
        totalLoaded += item.loaded;
        totalExpected += item.total;
      }
      const isDoneDownloadingOnnx =
        totalExpected > 0 &&
        totalLoaded >= totalExpected &&
        String(info.file || '').endsWith('.onnx');
      if (isDoneDownloadingOnnx) {
        emitInitializing(totalLoaded, totalExpected);
        return;
      }
      const percent =
        totalExpected > 0
          ? Math.min(99, Math.round((totalLoaded / totalExpected) * 100))
          : Math.min(99, Math.round(info.progress || 0));
      postProgress(targetId, 'downloading', totalLoaded, totalExpected, percent, info.file);
    } else if (info.status === 'done' && 'file' in info && String(info.file || '').endsWith('.onnx')) {
      let totalExpected = 0;
      for (const item of fileBytes.values()) {
        totalExpected += item.total;
      }
      emitInitializing(totalExpected, totalExpected);
    } else if (info.status === 'ready') {
      postProgress(targetId, 'ready', 1, 1, 100);
    }
  };

  const tokenizer = await AutoTokenizer.from_pretrained(modelId, { progress_callback });
  const model = await AutoModelForCausalLM.from_pretrained(modelId, {
    device: 'wasm',
    dtype: 'q4',
    progress_callback,
  });

  wasmTokenizer = tokenizer as unknown as typeof wasmTokenizer;
  wasmModel = model as unknown as typeof wasmModel;
  loadedBackend = 'wasm';
  loadedLevel = level;
}

async function ensureModelLoaded(level: OfflineCoachLevel, requestId: string): Promise<void> {
  activeProgressRequestId = requestId;
  const isAlreadyLoaded =
    loadedLevel === level &&
    ((loadedBackend === 'webllm' && Boolean(webLlmEngine)) ||
      (loadedBackend === 'wasm' && Boolean(wasmModel) && Boolean(wasmTokenizer)));

  if (isAlreadyLoaded) {
    postProgress(requestId, 'ready', 1, 1, 100);
    return;
  }

  if (loadPromise) {
    await loadPromise;
    const nowReady =
      loadedLevel === level &&
      ((loadedBackend === 'webllm' && Boolean(webLlmEngine)) ||
        (loadedBackend === 'wasm' && Boolean(wasmModel) && Boolean(wasmTokenizer)));
    if (nowReady) {
      postProgress(requestId, 'ready', 1, 1, 100);
      return;
    }
  }

  loadPromise = (async () => {
    if (webLlmEngine || wasmModel || wasmTokenizer) {
      await disposeModel();
    }

    const { hasWebGpu, hasShaderF16 } = await detectWebGpuCapabilities();

    if (hasWebGpu) {
      try {
        await loadWebLlmEngine(level, hasShaderF16);
      } catch (webgpuErr) {
        console.warn('[StudentOS LocalAI] WebGPU WebLLM failed, falling back to WASM:', webgpuErr);
        await disposeModel();
        await loadWasmTransformersModel(level);
      }
    } else {
      await loadWasmTransformersModel(level);
    }

    postProgress(activeProgressRequestId, 'ready', 1, 1, 100);
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function runWebLlmGeneration(
  requestId: string,
  chatMessages: WorkerChatMessage[],
  maxNewTokens: number,
  streamTokens: boolean,
  jsonMode: boolean
): Promise<string> {
  if (!webLlmEngine) {
    throw new Error('Local WebGPU engine failed to initialize.');
  }

  if (streamTokens) {
    let accumulated = '';
    const chunks = await webLlmEngine.chat.completions.create({
      messages: chatMessages,
      max_tokens: maxNewTokens,
      temperature: 0.3,
      top_p: 0.9,
      stream: true,
    });

    for await (const chunk of chunks) {
      if (cancelledRequestIds.has(requestId)) {
        try {
          await webLlmEngine.interruptGenerate();
        } catch {
          // Ignore interrupt failures.
        }
        throw new Error('ABORTED');
      }
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        accumulated += delta;
        const clean = stripThinkBlocks(accumulated);
        if (clean) {
          self.postMessage({ type: 'token', id: requestId, text: clean });
        }
      }
    }

    if (cancelledRequestIds.has(requestId)) {
      throw new Error('ABORTED');
    }
    return stripThinkBlocks(accumulated).trim();
  }

  const response = await webLlmEngine.chat.completions.create({
    messages: chatMessages,
    max_tokens: maxNewTokens,
    temperature: 0.1,
    stream: false,
  });

  if (cancelledRequestIds.has(requestId)) {
    throw new Error('ABORTED');
  }

  const content = response.choices?.[0]?.message?.content || '';
  return stripThinkBlocks(content).trim();
}

async function runWasmGeneration(
  requestId: string,
  level: OfflineCoachLevel,
  chatMessages: WorkerChatMessage[],
  maxNewTokens: number,
  streamTokens: boolean
): Promise<string> {
  if (!wasmTokenizer || !wasmModel) {
    throw new Error('Local WASM model failed to initialize.');
  }

  const { InterruptableStoppingCriteria, TextStreamer } = await import('@huggingface/transformers');
  const promptText = wasmTokenizer.apply_chat_template(chatMessages, {
    tokenize: false,
    add_generation_prompt: true,
    ...(level === 'deeper' ? { enable_thinking: false } : {}),
  }) as string;

  const inputs = wasmTokenizer(promptText);
  const inputTokenCount = inputs.input_ids?.dims?.[1] ?? 0;

  const stoppingCriteria = new InterruptableStoppingCriteria();
  activeAbortCriteria = stoppingCriteria;

  let accumulated = '';
  const streamer = streamTokens
    ? new TextStreamer(wasmTokenizer as never, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (piece: string) => {
          accumulated += piece;
          const clean = stripThinkBlocks(accumulated);
          if (clean) {
            self.postMessage({ type: 'token', id: requestId, text: clean });
          }
        },
      })
    : undefined;

  try {
    const output = (await wasmModel.generate({
      ...inputs,
      max_new_tokens: maxNewTokens,
      do_sample: false,
      stopping_criteria: [stoppingCriteria],
      ...(streamer ? { streamer } : {}),
    })) as {
      slice?: (dim0: number | [number, number] | null, dim1: number | [number | null, number | null] | null) => unknown;
    } & Record<string, unknown>;

    if (cancelledRequestIds.has(requestId)) {
      throw new Error('ABORTED');
    }

    let decoded = accumulated;
    if (!decoded && typeof output?.slice === 'function') {
      const generatedTokens = output.slice(null, [inputTokenCount, null]);
      const decodedArr = wasmTokenizer.batch_decode(generatedTokens, {
        skip_special_tokens: true,
      });
      decoded = decodedArr[0] || '';
    }
    return stripThinkBlocks(decoded).trim();
  } finally {
    if (activeAbortCriteria === stoppingCriteria) {
      activeAbortCriteria = null;
    }
  }
}

async function runGeneration(
  requestId: string,
  level: OfflineCoachLevel,
  chatMessages: WorkerChatMessage[],
  maxNewTokens: number,
  streamTokens: boolean,
  jsonMode: boolean
): Promise<string> {
  if (cancelledRequestIds.has(requestId)) {
    throw new Error('ABORTED');
  }
  await ensureModelLoaded(level, requestId);
  if (cancelledRequestIds.has(requestId)) {
    throw new Error('ABORTED');
  }

  try {
    if (loadedBackend === 'webllm') {
      return await runWebLlmGeneration(requestId, chatMessages, maxNewTokens, streamTokens, jsonMode);
    }
    return await runWasmGeneration(requestId, level, chatMessages, maxNewTokens, streamTokens);
  } finally {
    cancelledRequestIds.delete(requestId);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'abort') {
    const target = msg.id || activeProgressRequestId;
    if (target) cancelledRequestIds.add(target);
    if (activeAbortCriteria) {
      try {
        activeAbortCriteria.interrupt();
      } catch {
        // Ignore WASM interrupt failure.
      }
    }
    if (webLlmEngine) {
      try {
        void webLlmEngine.interruptGenerate();
      } catch {
        // Ignore WebLLM interrupt failure.
      }
    }
    return;
  }

  if (msg.type === 'unload') {
    enqueueWorkerTask(async () => {
      await disposeModel();
      self.postMessage({ type: 'unloaded', id: msg.id });
    });
    return;
  }

  if (msg.type === 'classifyEmail') {
    enqueueWorkerTask(async () => {
      try {
        const text = await runGeneration(
          msg.id,
          'quick',
          [
            { role: 'system', content: msg.systemPrompt },
            { role: 'user', content: msg.prompt },
          ],
          msg.maxNewTokens ?? 180,
          false,
          true
        );
        self.postMessage({ type: 'done', id: msg.id, text });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'error', id: msg.id, error: message });
      }
    });
    return;
  }

  if (msg.type === 'coachChat') {
    enqueueWorkerTask(async () => {
      try {
        const chatMessages: WorkerChatMessage[] = [
          { role: 'system', content: msg.systemPrompt },
          ...msg.messages.map((m) => ({
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: String(m.content || ''),
          })),
        ];
        const text = await runGeneration(
          msg.id,
          msg.level || 'quick',
          chatMessages,
          msg.maxNewTokens ?? 140,
          true,
          false
        );
        self.postMessage({ type: 'done', id: msg.id, text });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'error', id: msg.id, error: message });
      }
    });
  }
};
