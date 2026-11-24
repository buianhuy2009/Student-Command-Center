/**
 * Local On-Device AI Configuration, Model Catalog & Capability Probe
 *
 * Technical model IDs live strictly inside this service layer and are never
 * surfaced in student-facing UI copy.
 */

export const LOCAL_STORAGE_KEYS = {
  OCR_MODE: 'scc_ocr_mode',
  OCR_ENGINE: 'scc_ocr_engine',
  LECTURE_MODE: 'scc_lecture_mode',
} as const;

export type OcrMode = 'printed' | 'handwritten-vi' | 'handwritten-en';
export type OcrEngineMode = 'online' | 'offline';
export type LectureTranscriptionMode = 'online' | 'offline-tiny' | 'offline-base';

export const LOCAL_MODEL_CACHE_NAME = 'studentos-local-models-v1';

export interface LocalModelCatalogEntry {
  id: string;
  fallbackId?: string;
  approxMbWasm: number;
  urls?: readonly string[];
}

export const LOCAL_MODEL_CATALOG = {
  ocrDetector: {
    id: 'dbnet-v3',
    approxMbWasm: 3,
    urls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/paddleocr/det_v3.onnx',
    ],
  },
  ocrPrinted: {
    id: 'paddleocr-latin-v5',
    approxMbWasm: 10,
    urls: [
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/rec.onnx',
      'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/dict.txt',
    ],
  },
  ocrHandwrittenVi: {
    id: 'vietocr-w8',
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
    approxMbWasm: 61,
  },
  sileroVad: {
    id: 'silero-vad-v5',
    approxMbWasm: 2,
    urls: [
      'https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx',
      'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/silero_vad_v5.onnx',
    ],
  },
  asrTiny: {
    id: 'huuquyet/PhoWhisper-tiny',
    fallbackId: 'onnx-community/whisper-tiny',
    approxMbWasm: 60,
  },
  asrBase: {
    id: 'onnx-community/PhoWhisper-base-ONNX',
    fallbackId: 'bichnhan2701/PhoWhisper-base-ONNX',
    approxMbWasm: 160,
  },
} as const satisfies Record<string, LocalModelCatalogEntry>;

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

export function getOcrEngineMode(): OcrEngineMode {
  try {
    if (typeof localStorage === 'undefined') return 'online';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.OCR_ENGINE);
    return raw === 'offline' ? 'offline' : 'online';
  } catch {
    return 'online';
  }
}

export function setOcrEngineMode(engine: OcrEngineMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.OCR_ENGINE,
        engine === 'offline' ? 'offline' : 'online'
      );
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getLectureMode(): LectureTranscriptionMode {
  try {
    if (typeof localStorage === 'undefined') return 'online';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.LECTURE_MODE);
    if (raw === 'offline-tiny' || raw === 'offline-base') return raw;
    return 'online';
  } catch {
    return 'online';
  }
}

export function setLectureMode(mode: LectureTranscriptionMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const normalized: LectureTranscriptionMode =
        mode === 'offline-tiny' || mode === 'offline-base' ? mode : 'online';
      localStorage.setItem(LOCAL_STORAGE_KEYS.LECTURE_MODE, normalized);
    }
  } catch {
    // Ignore storage failures.
  }
}

export interface LocalAiCapabilities {
  deviceMemoryGb: number | null;
  storageQuotaMb: number | null;
  storageUsedMb: number | null;
}

export async function probeLocalAiCapabilities(): Promise<LocalAiCapabilities> {
  let deviceMemoryGb: number | null = null;
  let storageQuotaMb: number | null = null;
  let storageUsedMb: number | null = null;

  try {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        storage?: StorageManager;
      };
      if (typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)) {
        deviceMemoryGb = nav.deviceMemory;
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

  return { deviceMemoryGb, storageQuotaMb, storageUsedMb };
}
