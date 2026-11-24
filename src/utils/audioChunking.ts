export interface SpeechInterval {
  startSample: number;
  endSample: number;
  startSec: number;
  endSec: number;
}

export interface TimeMapEntry {
  compressedStartSec: number;
  compressedEndSec: number;
  originalStartSec: number;
  originalEndSec: number;
}

export interface OnlineAudioChunk {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  compressedDurationSec: number;
  wavBytes: Uint8Array;
  mimeType: 'audio/wav';
  timeMap: TimeMapEntry[];
}

export interface OfflineAudioClip {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  pcm16k: Float32Array;
}

/**
 * Merges short silences and pads detected speech windows so word onsets/offsets are never clipped.
 */
export function mergeAndPadIntervals(
  speechMask: boolean[],
  sampleRate: number,
  windowSamples: number,
  totalSamples: number,
  options: {
    padMs?: number;
    minGapMs?: number;
    minSpeechMs?: number;
  } = {}
): SpeechInterval[] {
  const padSamples = Math.round(((options.padMs ?? 200) / 1000) * sampleRate);
  const minGapSamples = Math.round(((options.minGapMs ?? 450) / 1000) * sampleRate);
  const minSpeechSamples = Math.round(((options.minSpeechMs ?? 250) / 1000) * sampleRate);

  const raw: { startSample: number; endSample: number }[] = [];
  let activeStart = -1;

  for (let i = 0; i < speechMask.length; i++) {
    if (speechMask[i] && activeStart === -1) {
      activeStart = i * windowSamples;
    } else if (!speechMask[i] && activeStart !== -1) {
      raw.push({
        startSample: Math.max(0, activeStart - padSamples),
        endSample: Math.min(totalSamples, i * windowSamples + padSamples),
      });
      activeStart = -1;
    }
  }
  if (activeStart !== -1) {
    raw.push({
      startSample: Math.max(0, activeStart - padSamples),
      endSample: totalSamples,
    });
  }

  if (raw.length === 0) return [];

  const merged: { startSample: number; endSample: number }[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    if (curr.startSample - prev.endSample <= minGapSamples) {
      prev.endSample = Math.max(prev.endSample, curr.endSample);
    } else {
      merged.push(curr);
    }
  }

  return merged
    .filter((iv) => iv.endSample - iv.startSample >= minSpeechSamples)
    .map((iv) => ({
      startSample: iv.startSample,
      endSample: iv.endSample,
      startSec: Math.round((iv.startSample / sampleRate) * 100) / 100,
      endSec: Math.round((iv.endSample / sampleRate) * 100) / 100,
    }));
}

/**
 * Maps a timestamp (in seconds) within silence-stripped audio back to the original recording timestamp.
 */
export function remapCompressedTimestamp(compressedSec: number, timeMap: TimeMapEntry[]): number {
  if (!Number.isFinite(compressedSec) || compressedSec < 0) {
    return timeMap[0]?.originalStartSec ?? 0;
  }
  if (timeMap.length === 0) return Math.round(compressedSec * 10) / 10;

  for (const entry of timeMap) {
    if (compressedSec >= entry.compressedStartSec - 0.05 && compressedSec <= entry.compressedEndSec + 0.05) {
      const offset = Math.max(0, compressedSec - entry.compressedStartSec);
      const mapped = Math.min(entry.originalEndSec, entry.originalStartSec + offset);
      return Math.round(mapped * 10) / 10;
    }
  }

  if (compressedSec < timeMap[0].compressedStartSec) {
    return timeMap[0].originalStartSec;
  }
  const last = timeMap[timeMap.length - 1];
  return last.originalEndSec;
}

/**
 * Downsamples 16 kHz mono Float32 PCM to 8 kHz 16-bit mono WAV, strictly enforcing maxBytes (< 2.5 MB).
 * At 8 kHz 16-bit mono, 110s of speech = 1.76 MB (crystal clear speech, 1/4 size of 16 kHz WAV).
 */
export function encodeAudioChunkForOnline(
  pcm16k: Float32Array,
  maxBytes = 1_850_000
): { bytes: Uint8Array; mimeType: 'audio/wav'; sampleRate: number } {
  const targetRate = 8000;
  const maxSamplesAt8k = Math.max(8000, Math.floor((maxBytes - 44) / 2));
  const downsampledLen = Math.min(maxSamplesAt8k, Math.floor(pcm16k.length / 2));
  const dataBytes = downsampledLen * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < downsampledLen; i++) {
    const s0 = pcm16k[i * 2] ?? 0;
    const s1 = pcm16k[i * 2 + 1] ?? s0;
    const avg = Math.max(-1, Math.min(1, (s0 + s1) * 0.5));
    const int16 = avg < 0 ? Math.round(avg * 32768) : Math.round(avg * 32767);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return {
    bytes: new Uint8Array(buffer),
    mimeType: 'audio/wav',
    sampleRate: targetRate,
  };
}

/**
 * Slices merged speech intervals into target-duration chunks without splitting across arbitrary silence jumps.
 */
export function buildSpeechChunks(
  pcm16k: Float32Array,
  sampleRate: number,
  intervals: SpeechInterval[],
  mode: 'online' | 'offline'
): {
  onlineChunks: OnlineAudioChunk[];
  offlineClips: OfflineAudioClip[];
  speechDurationSec: number;
} {
  const safeIntervals =
    intervals.length > 0
      ? intervals
      : [
          {
            startSample: 0,
            endSample: pcm16k.length,
            startSec: 0,
            endSec: Math.round((pcm16k.length / sampleRate) * 100) / 100,
          },
        ];

  const maxChunkSamples = (mode === 'online' ? 105 : 20) * sampleRate;
  const onlineChunks: OnlineAudioChunk[] = [];
  const offlineClips: OfflineAudioClip[] = [];

  let currentSlices: { startSample: number; endSample: number; startSec: number; endSec: number }[] = [];
  let currentSamples = 0;
  let totalSpeechSamples = 0;

  const flushChunk = () => {
    if (currentSlices.length === 0 || currentSamples === 0) return;
    const mergedPcm = new Float32Array(currentSamples);
    const timeMap: TimeMapEntry[] = [];
    let writeOffset = 0;
    let compressedSecCursor = 0;

    for (const s of currentSlices) {
      const seg = pcm16k.subarray(s.startSample, s.endSample);
      mergedPcm.set(seg, writeOffset);
      writeOffset += seg.length;
      const dur = seg.length / sampleRate;
      timeMap.push({
        compressedStartSec: Math.round(compressedSecCursor * 100) / 100,
        compressedEndSec: Math.round((compressedSecCursor + dur) * 100) / 100,
        originalStartSec: s.startSec,
        originalEndSec: s.endSec,
      });
      compressedSecCursor += dur;
    }

    const startSec = currentSlices[0].startSec;
    const endSec = currentSlices[currentSlices.length - 1].endSec;

    if (mode === 'online') {
      const idx = onlineChunks.length;
      const encoded = encodeAudioChunkForOnline(mergedPcm);
      onlineChunks.push({
        chunkIndex: idx,
        startSec,
        endSec,
        compressedDurationSec: Math.round(compressedSecCursor * 10) / 10,
        wavBytes: encoded.bytes,
        mimeType: encoded.mimeType,
        timeMap,
      });
    } else {
      const idx = offlineClips.length;
      offlineClips.push({
        chunkIndex: idx,
        startSec,
        endSec,
        pcm16k: mergedPcm,
      });
    }

    currentSlices = [];
    currentSamples = 0;
  };

  for (const iv of safeIntervals) {
    let cursor = iv.startSample;
    while (cursor < iv.endSample) {
      const remainingInChunk = maxChunkSamples - currentSamples;
      if (remainingInChunk <= sampleRate * 2) {
        flushChunk();
        continue;
      }
      const takeEnd = Math.min(iv.endSample, cursor + remainingInChunk);
      const len = takeEnd - cursor;
      currentSlices.push({
        startSample: cursor,
        endSample: takeEnd,
        startSec: Math.round((cursor / sampleRate) * 100) / 100,
        endSec: Math.round((takeEnd / sampleRate) * 100) / 100,
      });
      currentSamples += len;
      totalSpeechSamples += len;
      cursor = takeEnd;
      if (currentSamples >= maxChunkSamples) {
        flushChunk();
      }
    }
  }
  flushChunk();

  return {
    onlineChunks,
    offlineClips,
    speechDurationSec: Math.round((totalSpeechSamples / sampleRate) * 10) / 10,
  };
}

export function estimateLectureDuration(params: {
  audioDurationSec: number;
  mode: 'online' | 'offline-tiny' | 'offline-base';
}): { minMinutes: number; maxMinutes: number; estimatedSpeechSec: number } {
  const dur = Math.max(0, Number(params.audioDurationSec) || 0);
  const estimatedSpeechSec = Math.round(dur * 0.65);
  const mins = dur / 60;
  if (params.mode === 'online') {
    const minMinutes = Math.max(0.5, Math.round((mins * 0.03 + 0.3) * 10) / 10);
    const maxMinutes = Math.max(minMinutes + 0.5, Math.round((mins * 0.055 + 0.6) * 10) / 10);
    return { minMinutes, maxMinutes, estimatedSpeechSec };
  }
  if (params.mode === 'offline-base') {
    const minMinutes = Math.max(1, Math.round((mins * 0.33) * 10) / 10);
    const maxMinutes = Math.max(minMinutes + 1, Math.round((mins * 0.55) * 10) / 10);
    return { minMinutes, maxMinutes, estimatedSpeechSec };
  }
  const minMinutes = Math.max(0.5, Math.round((mins * 0.16) * 10) / 10);
  const maxMinutes = Math.max(minMinutes + 1, Math.round((mins * 0.28) * 10) / 10);
  return { minMinutes, maxMinutes, estimatedSpeechSec };
}

export function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
