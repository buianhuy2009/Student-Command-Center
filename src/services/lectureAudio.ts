import { db, type LectureRecord, type LectureSegment } from './db';
import { getClientGeminiApiKey } from './gemini';
import type { LectureTranscriptionMode } from './localAiConfig';
import { runLocalVadProcess } from './localMediaManager';
import type { OfflineAudioClip, OnlineAudioChunk } from '../utils/audioChunking';

export interface TranscribedSegmentPayload {
  startSec: number;
  endSec: number;
  text: string;
}

export interface LectureSummaryPayload {
  executiveSummary: string;
  outline: { timestampSec: number; heading: string; bullets: string[] }[];
  vocabulary: { term: string; definition: string }[];
  flashcards: { front: string; back: string }[];
  modelUsed?: string;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    parts.push(String.fromCharCode.apply(null, Array.from(slice)));
  }
  return btoa(parts.join(''));
}

/**
 * Decodes any browser-supported audio file (MP3/M4A/WAV/OGG/WebM) directly to 16 kHz mono Float32Array
 * and drops the full-rate AudioBuffer immediately to keep RAM usage low on 8 GB devices.
 */
export async function decodeAudioFileTo16kMono(file: File): Promise<{
  pcm16k: Float32Array;
  durationSec: number;
}> {
  const arrayBuf = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const tempCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuf);
  } finally {
    await tempCtx.close().catch(() => {});
  }

  const durationSec = Math.round(decoded.duration * 10) / 10;
  const targetRate = 16000;
  const targetLength = Math.max(1, Math.ceil(decoded.duration * targetRate));

  const offlineCtx = new OfflineAudioContext(1, targetLength, targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  // Copy channel 0 out and allow rendered AudioBuffer to be GC'd.
  const pcm16k = new Float32Array(rendered.getChannelData(0));
  return { pcm16k, durationSec };
}

export async function detectAudioFileDurationSec(file: File): Promise<number | null> {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number | null>((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
        cleanup();
        resolve(d);
      };
      audio.onerror = () => {
        cleanup();
        resolve(null);
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function postTranscribeAudioChunk(params: {
  chunk: OnlineAudioChunk;
  language: 'auto' | 'vi' | 'en';
  signal?: AbortSignal;
}): Promise<{
  segments: TranscribedSegmentPayload[];
  chunkBullets: string[];
  keyTerms: string[];
  modelUsed?: string;
}> {
  const apiKey = getClientGeminiApiKey();
  const audioBase64 = uint8ToBase64(params.chunk.wavBytes);

  const res = await fetch('/api/gemini/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      audioBase64,
      mimeType: params.chunk.mimeType,
      language: params.language,
      chunkIndex: params.chunk.chunkIndex,
      chunkStartSec: params.chunk.startSec,
      chunkEndSec: params.chunk.endSec,
      timeMap: params.chunk.timeMap,
      ...(apiKey ? { apiKey } : {}),
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Transcription API returned unexpected response (${res.status}).`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Transcription failed (${res.status}).`);
  }
  return {
    segments: Array.isArray(data.segments) ? data.segments : [],
    chunkBullets: Array.isArray(data.chunkBullets) ? data.chunkBullets : [],
    keyTerms: Array.isArray(data.keyTerms) ? data.keyTerms : [],
    modelUsed: data.modelUsed,
  };
}

export async function postSummarizeLecture(params: {
  title: string;
  language: 'auto' | 'vi' | 'en';
  totalDurationSec: number;
  chunkBullets: string[];
  keyTerms: string[];
  transcriptExcerpt?: string;
  signal?: AbortSignal;
}): Promise<LectureSummaryPayload> {
  const apiKey = getClientGeminiApiKey();
  const res = await fetch('/api/gemini/summarize-lecture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      title: params.title,
      language: params.language,
      totalDurationSec: params.totalDurationSec,
      chunkBullets: params.chunkBullets,
      keyTerms: params.keyTerms,
      transcriptExcerpt: params.transcriptExcerpt,
      ...(apiKey ? { apiKey } : {}),
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Lecture summary API returned unexpected response (${res.status}).`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Lecture summary failed (${res.status}).`);
  }
  return {
    executiveSummary: String(data.executiveSummary || ''),
    outline: Array.isArray(data.outline) ? data.outline : [],
    vocabulary: Array.isArray(data.vocabulary) ? data.vocabulary : [],
    flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
    modelUsed: data.modelUsed,
  };
}

export async function prepareLectureChunks(params: {
  file: File;
  mode: LectureTranscriptionMode;
  onVadProgress?: (percent: number, stage: string) => void;
  signal?: AbortSignal;
}): Promise<{
  originalDurationSec: number;
  speechDurationSec: number;
  onlineChunks: OnlineAudioChunk[];
  offlineClips: OfflineAudioClip[];
}> {
  const { pcm16k, durationSec } = await decodeAudioFileTo16kMono(params.file);
  if (params.signal?.aborted) throw new Error('ABORTED');

  const vadRes = await runLocalVadProcess({
    pcm16k,
    sampleRate: 16000,
    mode: params.mode === 'online' ? 'online' : 'offline',
    signal: params.signal,
    onProgress: (p) => params.onVadProgress?.(p.percent, p.stage),
  });

  return {
    originalDurationSec: vadRes.originalDurationSec || durationSec,
    speechDurationSec: vadRes.speechDurationSec || durationSec,
    onlineChunks: vadRes.onlineChunks,
    offlineClips: vadRes.offlineClips,
  };
}

export async function loadAllLecturesFromDb(): Promise<LectureRecord[]> {
  try {
    const rows = await db.lectures.orderBy('updatedAt').reverse().toArray();
    return rows;
  } catch {
    return [];
  }
}

export async function loadLectureSegmentsFromDb(lectureId: string): Promise<LectureSegment[]> {
  try {
    const rows = await db.lectureSegments.where('lectureId').equals(lectureId).toArray();
    return rows.sort((a, b) => a.chunkIndex - b.chunkIndex || a.startSec - b.startSec);
  } catch {
    return [];
  }
}
