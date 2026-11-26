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
  LECTURE_SUMMARY_MODE: 'scc_lecture_summary_mode',
} as const;

export type OcrMode = 'printed' | 'handwritten-vi' | 'handwritten-en';
export type OcrEngineMode = 'online' | 'offline';
export type LectureTranscriptionMode =
  | 'online'
  | 'offline-tiny'
  | 'offline-base'
  | 'offline-en-tiny'
  | 'offline-en-base';
export type OfflineAsrTier = Exclude<LectureTranscriptionMode, 'online'>;
export type LectureSummaryMode = 'online' | 'offline';

export const LOCAL_MODEL_CACHE_NAME = 'studentos-local-models-v2';

export interface LocalModelCatalogEntry {
  id: string;
  vlmModelId?: string;
  fallbackId?: string;
  approxMbWasm: number;
  urls?: readonly string[];
  fallbackUrls?: readonly string[];
}

export const LOCAL_MODEL_CATALOG = {
  ocrVlm: {
    id: 'onnx-community/Qwen3.5-0.8B-ONNX',
    approxMbWasm: 620,
  },
  ocrDetector: {
    id: 'pp-ocrv5-mobile-det',
    approxMbWasm: 5,
    urls: [
      'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx',
    ],
    fallbackUrls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/paddleocr/det_v3.onnx',
    ],
  },
  ocrPrinted: {
    id: 'qwen3.5-0.8b-vl-printed',
    vlmModelId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    approxMbWasm: 620,
    urls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/encoder_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_init_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_step_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/vocab.txt',
    ],
  },
  ocrHandwrittenVi: {
    id: 'qwen3.5-0.8b-vl-handwritten-vi',
    vlmModelId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    approxMbWasm: 620,
    urls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/encoder_fp16w.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_init_fp16w.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_step_fp16w.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/vocab.txt',
    ],
    fallbackUrls: [
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/encoder_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_init_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/decoder_step_w8.onnx',
      'https://huggingface.co/dzngo/vietocr-models/resolve/main/vietocr/vocab.txt',
    ],
  },
  ocrHandwrittenEn: {
    id: 'qwen3.5-0.8b-vl-handwritten-en',
    vlmModelId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    approxMbWasm: 620,
    urls: [
      'https://huggingface.co/PaddlePaddle/PP-OCRv5_server_rec_onnx/resolve/main/inference.onnx',
      'https://huggingface.co/PaddlePaddle/PP-OCRv5_server_rec_onnx/resolve/main/inference.yml',
    ],
    fallbackUrls: [
      'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
      'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx/resolve/main/inference.yml',
    ],
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
  asrEnTiny: {
    id: 'onnx-community/whisper-tiny.en',
    fallbackId: 'onnx-community/moonshine-tiny-ONNX',
    approxMbWasm: 40,
  },
  asrEnBase: {
    id: 'onnx-community/distil-small.en',
    fallbackId: 'onnx-community/whisper-base.en',
    approxMbWasm: 165,
  },
  gemmaSummary: {
    id: 'onnx-community/Qwen3.5-0.8B-Text-ONNX',
    fallbackId: 'onnx-community/Qwen3-0.6B-ONNX-OPT',
    approxMbWasm: 450,
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
    if (
      raw === 'offline-tiny' ||
      raw === 'offline-base' ||
      raw === 'offline-en-tiny' ||
      raw === 'offline-en-base'
    ) {
      return raw;
    }
    return 'online';
  } catch {
    return 'online';
  }
}

export function setLectureMode(mode: LectureTranscriptionMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const normalized: LectureTranscriptionMode =
        mode === 'offline-tiny' ||
        mode === 'offline-base' ||
        mode === 'offline-en-tiny' ||
        mode === 'offline-en-base'
          ? mode
          : 'online';
      localStorage.setItem(LOCAL_STORAGE_KEYS.LECTURE_MODE, normalized);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getLectureSummaryMode(): LectureSummaryMode {
  try {
    if (typeof localStorage === 'undefined') return 'online';
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.LECTURE_SUMMARY_MODE);
    return raw === 'offline' ? 'offline' : 'online';
  } catch {
    return 'online';
  }
}

export function setLectureSummaryMode(mode: LectureSummaryMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.LECTURE_SUMMARY_MODE,
        mode === 'offline' ? 'offline' : 'online'
      );
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
