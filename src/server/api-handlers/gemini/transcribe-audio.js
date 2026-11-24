import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";
import { AUDIO_MODELS } from "./models.js";

const MAX_AUDIO_BASE64_CHARS = 3_500_000;

function remapTime(sec, timeMap, fallbackOffsetSec = 0) {
  const numeric = Number(sec);
  if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, fallbackOffsetSec);
  if (Array.isArray(timeMap) && timeMap.length > 0) {
    for (const entry of timeMap) {
      const cStart = Number(entry?.compressedStartSec);
      const cEnd = Number(entry?.compressedEndSec);
      const oStart = Number(entry?.originalStartSec);
      if (
        Number.isFinite(cStart) &&
        Number.isFinite(cEnd) &&
        Number.isFinite(oStart) &&
        numeric >= cStart - 0.5 &&
        numeric <= cEnd + 0.5
      ) {
        return Math.max(0, Math.round((oStart + Math.max(0, numeric - cStart)) * 10) / 10);
      }
    }
    const last = timeMap[timeMap.length - 1];
    if (last && Number.isFinite(Number(last.originalEndSec))) {
      return Math.max(0, Number(last.originalEndSec));
    }
  }
  return Math.max(0, Math.round((fallbackOffsetSec + numeric) * 10) / 10);
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const {
      audioBase64,
      mimeType,
      language = "auto",
      chunkIndex = 0,
      chunkStartSec = 0,
      chunkEndSec = 0,
      timeMap,
      apiKey,
    } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "Missing audioBase64", code: "missing_audio" });
    }
    if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      return res.status(413).json({
        error: "Audio chunk exceeds maximum allowed size (2.5 MB).",
        code: "payload_too_large",
      });
    }

    const safeMime =
      typeof mimeType === "string" && mimeType.startsWith("audio/") ? mimeType : "audio/wav";
    const langHint =
      language === "vi"
        ? "Primary language is Vietnamese (preserve diacritics and any English technical terms accurately)."
        : language === "en"
          ? "Primary language is English."
          : "Detect the spoken language (often Vietnamese, English, or mixed Vietnamese + English academic terms) and transcribe verbatim in the original language(s).";

    const prompt = `You are an accurate academic lecture transcription assistant.
Listen to this lecture audio chunk (#${Number(chunkIndex) + 1}).
${langHint}
Break the speech into natural timestamped segments (startSec and endSec in seconds relative to the start of THIS audio clip).
Also extract 3 to 5 concise study bullet takeaways (chunkBullets) and up to 8 key academic terms/concepts (keyTerms).

Respond with strict JSON only:
{
  "segments": [
    { "startSec": 0.0, "endSec": 12.5, "text": "Spoken transcript text..." }
  ],
  "chunkBullets": ["Concise takeaway 1", "Concise takeaway 2"],
  "keyTerms": ["Term 1", "Term 2"]
}`;

    const { response, model } = await generateWithModelFallback({
      candidateModels: AUDIO_MODELS,
      apiKey,
      contents: [
        { inlineData: { data: audioBase64, mimeType: safeMime } },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const rawText = String(response?.text || "").trim();
    if (!rawText) {
      throw new Error("Empty transcription response from model");
    }

    const parsed = parseJsonLoose(rawText);
    const rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];
    const fallbackStart = Number(chunkStartSec) || 0;
    const fallbackEnd = Math.max(fallbackStart, Number(chunkEndSec) || fallbackStart);

    const segments = rawSegments
      .map((seg) => {
        const text = String(seg?.text || "").trim();
        if (!text) return null;
        const startSec = remapTime(seg?.startSec ?? 0, timeMap, fallbackStart);
        const endSec = Math.max(startSec, remapTime(seg?.endSec ?? seg?.startSec ?? 0, timeMap, fallbackEnd));
        return { startSec, endSec, text };
      })
      .filter(Boolean);

    if (segments.length === 0 && typeof parsed?.text === "string" && parsed.text.trim()) {
      segments.push({
        startSec: fallbackStart,
        endSec: fallbackEnd,
        text: parsed.text.trim(),
      });
    }

    return res.status(200).json({
      segments,
      chunkBullets: Array.isArray(parsed?.chunkBullets)
        ? parsed.chunkBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
        : [],
      keyTerms: Array.isArray(parsed?.keyTerms)
        ? parsed.keyTerms.map((k) => String(k).trim()).filter(Boolean).slice(0, 10)
        : [],
      modelUsed: model,
    });
  } catch (err) {
    console.error("Transcribe audio error:", err);
    return sendAiFailure(res, "Lecture audio transcription failed", err);
  }
}
