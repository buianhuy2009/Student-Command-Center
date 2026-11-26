import { describe, it, expect } from 'vitest';
import { LOCAL_MODEL_CATALOG } from './localAiConfig';
import './lectureOfflineAsr';
import { useLectureStore } from '../store/lectureStore';

describe('Offline ASR configuration & registration', () => {
  it('defines Vietnamese PhoWhisper and English 2-tier (Light & Accurate) catalog entries with fallbacks', () => {
    expect(LOCAL_MODEL_CATALOG.asrTiny.id).toBe('huuquyet/PhoWhisper-tiny');
    expect(LOCAL_MODEL_CATALOG.asrTiny.fallbackId).toBe('onnx-community/whisper-tiny');
    expect(LOCAL_MODEL_CATALOG.asrBase.id).toBe('onnx-community/PhoWhisper-base-ONNX');
    expect(LOCAL_MODEL_CATALOG.asrBase.fallbackId).toBe('bichnhan2701/PhoWhisper-base-ONNX');
    expect(LOCAL_MODEL_CATALOG.asrEnTiny.id).toBe('onnx-community/whisper-tiny.en');
    expect(LOCAL_MODEL_CATALOG.asrEnTiny.fallbackId).toBe('onnx-community/moonshine-tiny-ONNX');
    expect(LOCAL_MODEL_CATALOG.asrEnBase.id).toBe('onnx-community/distil-small.en');
    expect(LOCAL_MODEL_CATALOG.asrEnBase.fallbackId).toBe('onnx-community/whisper-base.en');
  });

  it('registers offline runner and supports Vietnamese and English offline tiers', () => {
    const store = useLectureStore.getState();
    store.setMode('offline-tiny');
    expect(useLectureStore.getState().mode).toBe('offline-tiny');
    store.setMode('offline-en-tiny');
    expect(useLectureStore.getState().mode).toBe('offline-en-tiny');
    store.setMode('offline-en-base');
    expect(useLectureStore.getState().mode).toBe('offline-en-base');
    store.setMode('online');
    expect(useLectureStore.getState().mode).toBe('online');
  });
});
