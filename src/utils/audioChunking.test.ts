import { describe, it, expect } from 'vitest';
import {
  buildSpeechChunks,
  encodeAudioChunkForOnline,
  estimateLectureDuration,
  mergeAndPadIntervals,
  remapCompressedTimestamp,
  type TimeMapEntry,
} from './audioChunking';

describe('audioChunking', () => {
  it('remaps silence-stripped timestamps back to original recording seconds', () => {
    const timeMap: TimeMapEntry[] = [
      { compressedStartSec: 0, compressedEndSec: 15, originalStartSec: 10, originalEndSec: 25 },
      { compressedStartSec: 15, compressedEndSec: 35, originalStartSec: 80, originalEndSec: 100 },
    ];

    expect(remapCompressedTimestamp(0, timeMap)).toBe(10);
    expect(remapCompressedTimestamp(7.5, timeMap)).toBe(17.5);
    expect(remapCompressedTimestamp(20, timeMap)).toBe(85);
    expect(remapCompressedTimestamp(999, timeMap)).toBe(100);
  });

  it('encodes online WAV chunks strictly under 2.5 MB (<= 1.85 MB)', () => {
    // 110 seconds at 16 kHz mono = 1,760,000 float32 samples
    const pcm16k = new Float32Array(16000 * 110);
    for (let i = 0; i < pcm16k.length; i += 100) {
      pcm16k[i] = 0.25;
    }
    const encoded = encodeAudioChunkForOnline(pcm16k);
    expect(encoded.mimeType).toBe('audio/wav');
    expect(encoded.sampleRate).toBe(8000);
    expect(encoded.bytes.byteLength).toBeLessThanOrEqual(1_850_000);
    // Base64 size must stay well below Vercel's 4.5 MB cap
    expect(Math.ceil((encoded.bytes.byteLength * 4) / 3)).toBeLessThan(2_500_000);
  });

  it('merges nearby speech windows and splits online chunks under max bytes', () => {
    const sampleRate = 16000;
    const totalSec = 260; // > 4 minutes continuous speech
    const pcm16k = new Float32Array(sampleRate * totalSec);
    const mask = new Array(Math.floor(pcm16k.length / 512)).fill(true);

    const intervals = mergeAndPadIntervals(mask, sampleRate, 512, pcm16k.length);
    expect(intervals.length).toBe(1);

    const chunked = buildSpeechChunks(pcm16k, sampleRate, intervals, 'online');
    expect(chunked.onlineChunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunked.onlineChunks) {
      expect(c.wavBytes.byteLength).toBeLessThanOrEqual(1_850_000);
    }
  });

  it('estimates realistic durations for online vs offline modes', () => {
    const online = estimateLectureDuration({ audioDurationSec: 3600, mode: 'online' });
    const tiny = estimateLectureDuration({ audioDurationSec: 3600, mode: 'offline-tiny' });
    const base = estimateLectureDuration({ audioDurationSec: 3600, mode: 'offline-base' });

    expect(online.maxMinutes).toBeLessThan(tiny.minMinutes);
    expect(tiny.minMinutes).toBeLessThan(base.minMinutes);
  });
});
