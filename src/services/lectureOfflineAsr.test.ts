import { describe, it, expect } from 'vitest';
import { LOCAL_MODEL_CATALOG } from './localAiConfig';
import './lectureOfflineAsr';
import { useLectureStore } from '../store/lectureStore';

describe('Offline ASR configuration & registration', () => {
  it('defines PhoWhisper tiny and base catalog entries with fallbacks', () => {
    expect(LOCAL_MODEL_CATALOG.asrTiny.id).toBe('huuquyet/PhoWhisper-tiny');
    expect(LOCAL_MODEL_CATALOG.asrTiny.fallbackId).toBe('onnx-community/whisper-tiny');
    expect(LOCAL_MODEL_CATALOG.asrBase.id).toBe('onnx-community/PhoWhisper-base-ONNX');
    expect(LOCAL_MODEL_CATALOG.asrBase.fallbackId).toBe('bichnhan2701/PhoWhisper-base-ONNX');
  });

  it('registers offline runner without requiring online API for offline mode selection', () => {
    const store = useLectureStore.getState();
    store.setMode('offline-tiny');
    expect(useLectureStore.getState().mode).toBe('offline-tiny');
    store.setMode('online');
    expect(useLectureStore.getState().mode).toBe('online');
  });
});
