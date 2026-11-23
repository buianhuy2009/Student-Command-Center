/// <reference lib="webworker" />
import {
  AutoModelForCausalLM,
  AutoTokenizer,
  InterruptableStoppingCriteria,
  TextStreamer,
  env,
  type ProgressInfo,
} from '@huggingface/transformers';
import { LOCAL_MODEL_CATALOG, type OfflineCoachLevel } from '../services/localAiConfig';

// Always download from Hugging Face Hub lazily into browser cache; never bundle local models.
env.allowLocalModels = false;
env.useBrowserCache = true;

// Keep WASM single-threaded when crossOriginIsolated is disabled (preserves Google OAuth popups & bounds RAM).
if (typeof self !== 'undefined' && !self.crossOriginIsolated) {
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }
}

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

let loadedLevel: OfflineCoachLevel | null = null;
let loadedTokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
let loadedModel: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>> | null = null;
let loadPromise: Promise<void> | null = null;
let activeAbortCriteria: InterruptableStoppingCriteria | null = null;
let activeProgressRequestId: string | null = null;
const cancelledRequestIds = new Set<string>();
let workerQueue: Promise<void> = Promise.resolve();

function enqueueWorkerTask(fn: () => Promise<void>): void {
  workerQueue = workerQueue.then(fn, fn);
}

async function detectWebGpuAdapter(): Promise<boolean> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: { requestAdapter?: () => Promise<unknown | null> };
    };
    if (nav?.gpu && typeof nav.gpu.requestAdapter === 'function') {
      const adapter = await nav.gpu.requestAdapter();
      return Boolean(adapter);
    }
  } catch {
    // WebGPU unavailable; fall back to single-threaded WASM CPU.
  }
  return false;
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
  const model = loadedModel as ({ dispose?: () => Promise<void> | void } | null);
  loadedModel = null;
  loadedTokenizer = null;
  if (model && typeof model.dispose === 'function') {
    try {
      await model.dispose();
    } catch {
      // Ignore disposal errors when freeing memory.
    }
  }
}

async function ensureModelLoaded(level: OfflineCoachLevel, requestId: string): Promise<void> {
  activeProgressRequestId = requestId;
  if (loadedLevel === level && loadedModel && loadedTokenizer) {
    self.postMessage({
      type: 'progress',
      id: requestId,
      file: '',
      loaded: 1,
      total: 1,
      percent: 100,
      stage: 'ready',
    });
    return;
  }
  if (loadPromise) {
    await loadPromise;
    if (loadedLevel === level && loadedModel && loadedTokenizer) {
      self.postMessage({
        type: 'progress',
        id: requestId,
        file: '',
        loaded: 1,
        total: 1,
        percent: 100,
        stage: 'ready',
      });
      return;
    }
  }

  loadPromise = (async () => {
    if (loadedModel || loadedTokenizer) {
      await disposeModel();
    }

    const modelId =
      level === 'deeper' ? LOCAL_MODEL_CATALOG.llmDeeper.id : LOCAL_MODEL_CATALOG.llmQuick.id;
    const hasWebGpu = await detectWebGpuAdapter();
    const device = hasWebGpu ? 'webgpu' : 'wasm';
    // Use q4 on both WebGPU and WASM: q4f16 triggers degenerate/repetitive activations on Qwen2.5 WebGPU.
    const dtype = 'q4';

    const fileBytes = new Map<string, { loaded: number; total: number }>();
    let emittedInitializing = false;

    const emitInitializing = (loaded: number, total: number) => {
      if (emittedInitializing) return;
      emittedInitializing = true;
      if (!activeProgressRequestId) return;
      self.postMessage({
        type: 'progress',
        id: activeProgressRequestId,
        file: '',
        loaded: loaded || 1,
        total: total || 1,
        percent: 100,
        stage: 'initializing',
      });
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
        for (const entry of fileBytes.values()) {
          totalLoaded += entry.loaded;
          totalExpected += entry.total;
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
        self.postMessage({
          type: 'progress',
          id: targetId,
          file: info.file,
          loaded: totalLoaded,
          total: totalExpected,
          percent,
          stage: 'downloading',
        });
      } else if (info.status === 'done' && 'file' in info && String(info.file || '').endsWith('.onnx')) {
        let totalExpected = 0;
        for (const entry of fileBytes.values()) {
          totalExpected += entry.total;
        }
        emitInitializing(totalExpected, totalExpected);
      } else if (info.status === 'ready') {
        self.postMessage({
          type: 'progress',
          id: targetId,
          file: '',
          loaded: 1,
          total: 1,
          percent: 100,
          stage: 'ready',
        });
      }
    };

    try {
      const tokenizer = await AutoTokenizer.from_pretrained(modelId, { progress_callback });
      const model = await AutoModelForCausalLM.from_pretrained(modelId, {
        device,
        dtype,
        progress_callback,
      });
      loadedTokenizer = tokenizer;
      loadedModel = model;
      loadedLevel = level;
    } catch (err) {
      // Fallback to WASM q4 if WebGPU initialization fails on a driver quirk.
      if (device === 'webgpu') {
        emitInitializing(1, 1);
        const tokenizer = loadedTokenizer || (await AutoTokenizer.from_pretrained(modelId, { progress_callback }));
        const model = await AutoModelForCausalLM.from_pretrained(modelId, {
          device: 'wasm',
          dtype: 'q4',
          progress_callback,
        });
        loadedTokenizer = tokenizer;
        loadedModel = model;
        loadedLevel = level;
      } else {
        throw err;
      }
    }

    if (activeProgressRequestId) {
      self.postMessage({
        type: 'progress',
        id: activeProgressRequestId,
        file: '',
        loaded: 1,
        total: 1,
        percent: 100,
        stage: 'ready',
      });
    }
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function runGeneration(
  requestId: string,
  level: OfflineCoachLevel,
  chatMessages: WorkerChatMessage[],
  maxNewTokens: number,
  streamTokens: boolean
): Promise<string> {
  if (cancelledRequestIds.has(requestId)) {
    throw new Error('ABORTED');
  }
  await ensureModelLoaded(level, requestId);
  if (cancelledRequestIds.has(requestId)) {
    throw new Error('ABORTED');
  }
  if (!loadedTokenizer || !loadedModel) {
    throw new Error('Local model failed to initialize.');
  }

  const promptText = loadedTokenizer.apply_chat_template(chatMessages, {
    tokenize: false,
    add_generation_prompt: true,
    ...(level === 'deeper' ? { enable_thinking: false } : {}),
  }) as string;

  const inputs = loadedTokenizer(promptText);
  const inputTokenCount = inputs.input_ids?.dims?.[1] ?? 0;

  const stoppingCriteria = new InterruptableStoppingCriteria();
  activeAbortCriteria = stoppingCriteria;

  let accumulated = '';
  const streamer = streamTokens
    ? new TextStreamer(loadedTokenizer, {
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
    const output = (await loadedModel.generate({
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
      const generatedTokens = output.slice(null, [inputTokenCount, null]) as Parameters<
        typeof loadedTokenizer.batch_decode
      >[0];
      const decodedArr = loadedTokenizer.batch_decode(generatedTokens, {
        skip_special_tokens: true,
      });
      decoded = decodedArr[0] || '';
    }
    return stripThinkBlocks(decoded).trim();
  } finally {
    cancelledRequestIds.delete(requestId);
    if (activeAbortCriteria === stoppingCriteria) {
      activeAbortCriteria = null;
    }
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
        // Ignore interrupt failure.
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
          false
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
          msg.maxNewTokens ?? 220,
          true
        );
        self.postMessage({ type: 'done', id: msg.id, text });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'error', id: msg.id, error: message });
      }
    });
  }
};
