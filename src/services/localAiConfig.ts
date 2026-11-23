/**
 * Local On-Device AI Configuration, Model Catalog & Capability Probe
 *
 * All technical model identifiers live strictly inside this service layer and are NEVER
 * surfaced in student-facing UI copy.
 */

export const LOCAL_STORAGE_KEYS = {
  EMAIL_AI_MODE: 'scc_email_ai_mode',
  COACH_MODE: 'scc_ai_coach_mode_v1',
  OFFLINE_COACH_LEVEL: 'scc_offline_coach_level',
  OCR_MODE: 'scc_ocr_mode',
} as const;

export type EmailAiMode = 'online' | 'offline';
export type OfflineCoachLevel = 'quick' | 'deeper';
export type OcrMode = 'printed' | 'handwritten-vi' | 'handwritten-en';

export const LOCAL_MODEL_CACHE_NAME = 'studentos-local-models-v1';

export interface LocalModelCatalogEntry {
  id: string;
  wasmFallbackId?: string;
  f32FallbackId?: string;
  contextWindowSize?: number;
  approxMbWebGpu: number;
  approxMbWasm: number;
  urls?: readonly string[];
}

export const LOCAL_MODEL_CATALOG = {
  llmQuick: {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    f32FallbackId: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
    wasmFallbackId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    contextWindowSize: 1536,
    approxMbWebGpu: 265,
    approxMbWasm: 370,
  },
  llmDeeper: {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    f32FallbackId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    wasmFallbackId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    contextWindowSize: 2048,
    approxMbWebGpu: 828,
    approxMbWasm: 749,
  },
  ocrDetector: {
    id: 'dbnet-v3',
    approxMbWebGpu: 3,
    approxMbWasm: 3,
    urls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/paddleocr/det_v3.onnx',
    ],
  },
  ocrPrinted: {
    id: 'paddleocr-latin-v5',
    approxMbWebGpu: 10,
    approxMbWasm: 10,
    urls: [
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/rec.onnx',
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/dict.txt',
    ],
  },
  ocrHandwrittenVi: {
    id: 'vietocr-w8',
    approxMbWebGpu: 38,
    approxMbWasm: 38,
    urls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/encoder_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_init_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_step_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/vocab.txt',
    ],
  },
  ocrHandwrittenEn: {
    id: 'Xenova/trocr-small-handwritten',
    approxMbWebGpu: 61,
    approxMbWasm: 61,
  },
} as const satisfies Record<string, LocalModelCatalogEntry>;

export function getEmailAiMode(): EmailAiMode {
  try {
    if (typeof localStorage === 'undefined') return 'online';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.EMAIL_AI_MODE);
    return raw === 'offline' ? 'offline' : 'online';
  } catch {
    return 'online';
  }
}

export function setEmailAiMode(mode: EmailAiMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEYS.EMAIL_AI_MODE, mode === 'offline' ? 'offline' : 'online');
    }
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

export function getOfflineCoachLevel(): OfflineCoachLevel {
  try {
    if (typeof localStorage === 'undefined') return 'quick';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.OFFLINE_COACH_LEVEL);
    return raw === 'deeper' ? 'deeper' : 'quick';
  } catch {
    return 'quick';
  }
}

export function setOfflineCoachLevel(level: OfflineCoachLevel): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEYS.OFFLINE_COACH_LEVEL, level === 'deeper' ? 'deeper' : 'quick');
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getOcrMode(): OcrMode {
  try {
    if (typeof localStorage === 'undefined') return 'printed';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.OCR_MODE);
    if (raw === 'handwritten-vi' || raw === 'handwritten-en') return raw;
    return 'printed';
  } catch {
    return 'printed';
  }
}

export function setOcrMode(mode: OcrMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const normalized: OcrMode =
        mode === 'handwritten-vi' || mode === 'handwritten-en' ? mode : 'printed';
      localStorage.setItem(LOCAL_STORAGE_KEYS.OCR_MODE, normalized);
    }
  } catch {
    // Ignore storage failures.
  }
}

export interface LocalAiCapabilities {
  hasWebGpu: boolean;
  deviceMemoryGb: number | null;
  storageQuotaMb: number | null;
  storageUsedMb: number | null;
}

export async function probeLocalAiCapabilities(): Promise<LocalAiCapabilities> {
  let hasWebGpu = false;
  let deviceMemoryGb: number | null = null;
  let storageQuotaMb: number | null = null;
  let storageUsedMb: number | null = null;

  try {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {
        gpu?: { requestAdapter?: () => Promise<unknown | null> };
        deviceMemory?: number;
        storage?: StorageManager;
      };
      if (typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)) {
        deviceMemoryGb = nav.deviceMemory;
      }
      if (nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
        try {
          const adapter = await nav.gpu.requestAdapter();
          hasWebGpu = Boolean(adapter);
        } catch {
          hasWebGpu = false;
        }
      }
      if (nav.storage && typeof nav.storage.estimate === 'function') {
        try {
          const est = await nav.storage.estimate();
          if (typeof est.quota === 'number') {
            storageQuotaMb = Math.round(est.quota / (1024 * 1024));
          }
          if (typeof est.usage === 'number') {
            storageUsedMb = Math.round((est.usage / (1024 * 1024)) * 10) / 10;
          }
        } catch {
          // Ignore quota errors.
        }
      }
    }
  } catch {
    // Ignore probe errors.
  }

  return { hasWebGpu, deviceMemoryGb, storageQuotaMb, storageUsedMb };
}
