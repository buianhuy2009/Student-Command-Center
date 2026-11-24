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

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|mkv|avi)$/i;
const MEDIA_EXT_RE = /\.(mp3|m4a|wav|ogg|webm|aac|flac|mp4|mov|m4v|mkv|avi)$/i;

export function isVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  if (mime.startsWith('audio/')) return false;
  return VIDEO_EXT_RE.test(file.name || '');
}

export function isSupportedLectureMediaFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return true;
  return MEDIA_EXT_RE.test(file.name || '');
}

async function decodeBufferToAudioBuffer(arrayBuf: ArrayBuffer): Promise<AudioBuffer> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const tempCtx = new AudioCtx();
  try {
    return await tempCtx.decodeAudioData(arrayBuf);
  } finally {
    await tempCtx.close().catch(() => {});
  }
}

/**
 * Fallback video-to-audio extractor when AudioContext.decodeAudioData cannot directly demux a container.
 * Uses a muted <video> element + captureStream() + MediaRecorder to capture only the audio track.
 */
async function extractAudioBlobFromVideoElement(
  file: File,
  signal?: AbortSignal
): Promise<Blob> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Could not decode audio track from this video format in this browser.');
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not load video file for audio extraction.'));
    });

    if (signal?.aborted) throw new Error('ABORTED');

    const captureFn =
      (video as any).captureStream?.bind(video) ||
      (video as any).mozCaptureStream?.bind(video);
    if (!captureFn) {
      throw new Error('This browser cannot extract audio tracks from unsupported video containers.');
    }

    const rawStream: MediaStream = captureFn();
    const audioTracks = rawStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio track found in this video file.');
    }

    const audioOnlyStream = new MediaStream(audioTracks);
    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = chosenMime
      ? new MediaRecorder(audioOnlyStream, { mimeType: chosenMime })
      : new MediaRecorder(audioOnlyStream);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    return await new Promise<Blob>((resolve, reject) => {
      const cleanupTracks = () => {
        try {
          video.pause();
        } catch {}
        rawStream.getTracks().forEach((tr) => tr.stop());
      };

      const onAbort = () => {
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {}
        cleanupTracks();
        reject(new Error('ABORTED'));
      };

      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      recorder.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        cleanupTracks();
        reject(new Error('Failed to extract audio from video.'));
      };

      recorder.onstop = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        cleanupTracks();
        if (signal?.aborted) {
          reject(new Error('ABORTED'));
          return;
        }
        resolve(new Blob(chunks, { type: chosenMime || 'audio/webm' }));
      };

      video.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      try {
        video.playbackRate = 8;
      } catch {
        try {
          video.playbackRate = 4;
        } catch {}
      }

      recorder.start(500);
      video.play().catch((err) => {
        if (recorder.state !== 'inactive') recorder.stop();
        cleanupTracks();
        reject(err instanceof Error ? err : new Error('Could not play video to extract audio.'));
      });
    });
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

/**
 * Decodes any browser-supported audio OR video file (MP3/M4A/WAV/OGG/WebM/MP4/MOV/M4V/MKV)
 * directly to 16 kHz mono Float32Array, automatically extracting the audio track from videos
 * and dropping the full-rate AudioBuffer immediately to keep RAM usage low on 8 GB devices.
 */
export async function decodeAudioFileTo16kMono(
  file: File,
  signal?: AbortSignal
): Promise<{
  pcm16k: Float32Array;
  durationSec: number;
}> {
  if (signal?.aborted) throw new Error('ABORTED');

  let decoded: AudioBuffer;
  try {
    // Native C++ AudioContext.decodeAudioData demuxes MP4/MOV/WebM audio tracks directly in ~1-3s.
    const arrayBuf = await file.arrayBuffer();
    if (signal?.aborted) throw new Error('ABORTED');
    decoded = await decodeBufferToAudioBuffer(arrayBuf);
  } catch (primaryErr: any) {
    if (primaryErr?.message === 'ABORTED' || signal?.aborted) {
      throw new Error('ABORTED');
    }
    if (!isVideoFile(file)) {
      throw primaryErr;
    }
    // Fallback for video containers that decodeAudioData cannot demux directly.
    const extractedAudioBlob = await extractAudioBlobFromVideoElement(file, signal);
    if (signal?.aborted) throw new Error('ABORTED');
    const extractedBuf = await extractedAudioBlob.arrayBuffer();
    decoded = await decodeBufferToAudioBuffer(extractedBuf);
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
      const media = document.createElement(isVideoFile(file) ? 'video' : 'audio');
      media.preload = 'metadata';
      const cleanup = () => {
        media.onloadedmetadata = null;
        media.onerror = null;
      };
      media.onloadedmetadata = () => {
        const d = Number.isFinite(media.duration) ? Math.round(media.duration) : null;
        cleanup();
        resolve(d);
      };
      media.onerror = () => {
        cleanup();
        resolve(null);
      };
      media.src = url;
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
  const { pcm16k, durationSec } = await decodeAudioFileTo16kMono(params.file, params.signal);
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
