import { describe, it, expect } from 'vitest';
import { isSupportedLectureMediaFile, isVideoFile } from './lectureAudio';

describe('lectureAudio media detection', () => {
  it('identifies video files by mime type or extension (MP4, MOV, M4V, MKV, video/webm)', () => {
    expect(isVideoFile({ name: 'lecture1.mp4', type: 'video/mp4' })).toBe(true);
    expect(isVideoFile({ name: 'recording.MOV', type: '' })).toBe(true);
    expect(isVideoFile({ name: 'class.mkv', type: '' })).toBe(true);
    expect(isVideoFile({ name: 'screen.webm', type: 'video/webm' })).toBe(true);
    expect(isVideoFile({ name: 'voice.webm', type: 'audio/webm' })).toBe(false);
    expect(isVideoFile({ name: 'lecture.mp3', type: 'audio/mpeg' })).toBe(false);
    expect(isVideoFile({ name: 'lecture.m4a', type: '' })).toBe(false);
  });

  it('accepts supported audio and video files while rejecting unrelated files', () => {
    expect(isSupportedLectureMediaFile({ name: 'lecture.mp4', type: 'video/mp4' })).toBe(true);
    expect(isSupportedLectureMediaFile({ name: 'lecture.mov', type: '' })).toBe(true);
    expect(isSupportedLectureMediaFile({ name: 'lecture.mp3', type: 'audio/mpeg' })).toBe(true);
    expect(isSupportedLectureMediaFile({ name: 'lecture.wav', type: 'audio/wav' })).toBe(true);
    expect(isSupportedLectureMediaFile({ name: 'slides.pdf', type: 'application/pdf' })).toBe(false);
    expect(isSupportedLectureMediaFile({ name: 'notes.png', type: 'image/png' })).toBe(false);
  });
});
