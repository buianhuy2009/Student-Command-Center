// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };
  },
}));

import { AUDIO_MODELS, LECTURE_SUMMARY_MODELS, resetModelCooldownsForTest } from "./models.js";
import { resetRateLimitsForTest } from "./generate.js";
import handleTranscribeAudio from "./transcribe-audio.js";
import handleSummarizeLecture from "./summarize-lecture.js";

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    getHeader(k: string) {
      return headers[k.toLowerCase()];
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

describe("Lecture Studio Gemini handlers & models", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockReset();
    resetModelCooldownsForTest();
    resetRateLimitsForTest();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("AUDIO_MODELS puts gemini-3.5-flash-lite first, then gemini-3.1-flash-lite, and excludes gemma", () => {
    expect(AUDIO_MODELS[0]).toBe("gemini-3.5-flash-lite");
    expect(AUDIO_MODELS[1]).toBe("gemini-3.1-flash-lite");
    expect(AUDIO_MODELS.some((m) => m.startsWith("gemma-"))).toBe(false);
    expect(LECTURE_SUMMARY_MODELS[0]).toBe("gemini-3-flash-preview");
  });

  it("transcribe-audio rejects oversized payloads (>3.5 MB base64) with 413", async () => {
    const req: any = {
      method: "POST",
      headers: {},
      body: {
        audioBase64: "A".repeat(3_600_000),
        mimeType: "audio/wav",
      },
    };
    const res = createMockRes();
    await handleTranscribeAudio(req, res);
    expect(res.statusCode).toBe(413);
    expect(res.body?.code).toBe("payload_too_large");
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("transcribe-audio remaps timestamps with timeMap and returns segments, bullets, keyTerms", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        segments: [{ startSec: 2, endSec: 6, text: "Hôm nay học giải tích." }],
        chunkBullets: ["Giới thiệu đạo hàm"],
        keyTerms: ["Đạo hàm"],
      }),
    });

    const req: any = {
      method: "POST",
      headers: {},
      body: {
        audioBase64: "UklGRg==",
        mimeType: "audio/wav",
        language: "vi",
        chunkIndex: 0,
        chunkStartSec: 12,
        chunkEndSec: 20,
        timeMap: [{ compressedStartSec: 0, compressedEndSec: 8, originalStartSec: 12, originalEndSec: 20 }],
      },
    };
    const res = createMockRes();
    await handleTranscribeAudio(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.modelUsed).toBe("gemini-3.5-flash-lite");
    expect(res.body.segments).toEqual([
      { startSec: 14, endSec: 18, text: "Hôm nay học giải tích." },
    ]);
    expect(res.body.chunkBullets).toEqual(["Giới thiệu đạo hàm"]);
    expect(res.body.keyTerms).toEqual(["Đạo hàm"]);
  });

  it("summarize-lecture returns normalized executiveSummary, outline, vocabulary, and flashcards", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        executiveSummary: "## Overview\nKey lecture summary.",
        outline: [{ timestampSec: 45, heading: "Derivatives", bullets: ["Slope definition"] }],
        vocabulary: [{ term: "Derivative", definition: "Instantaneous rate of change." }],
        flashcards: [{ front: "What is a derivative?", back: "Instantaneous rate of change." }],
      }),
    });

    const req: any = {
      method: "POST",
      headers: {},
      body: {
        title: "Calculus Week 1",
        language: "en",
        totalDurationSec: 1800,
        chunkBullets: ["Slope definition"],
        keyTerms: ["Derivative"],
      },
    };
    const res = createMockRes();
    await handleSummarizeLecture(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.modelUsed).toBe("gemini-3-flash-preview");
    expect(res.body.executiveSummary).toContain("Key lecture summary");
    expect(res.body.outline).toHaveLength(1);
    expect(res.body.vocabulary).toHaveLength(1);
    expect(res.body.flashcards).toHaveLength(1);
  });
});
