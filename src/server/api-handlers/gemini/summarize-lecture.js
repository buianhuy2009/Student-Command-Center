import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";
import { LECTURE_SUMMARY_MODELS } from "./models.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const {
      title = "Lecture Notes",
      language = "auto",
      totalDurationSec = 0,
      chunkBullets = [],
      keyTerms = [],
      transcriptExcerpt = "",
      apiKey,
    } = req.body || {};

    const hasBullets = Array.isArray(chunkBullets) && chunkBullets.length > 0;
    const hasExcerpt = typeof transcriptExcerpt === "string" && transcriptExcerpt.trim().length > 0;
    if (!hasBullets && !hasExcerpt) {
      return res.status(400).json({
        error: "Missing lecture content (chunkBullets or transcriptExcerpt required)",
        code: "missing_content",
      });
    }

    const langInstruction =
      language === "vi"
        ? "Write the summary, outline, vocabulary definitions, and flashcards in Vietnamese (keeping technical English terms where natural)."
        : language === "en"
          ? "Write the summary, outline, vocabulary definitions, and flashcards in English."
          : "Write in the primary language of the lecture content below (Vietnamese or English).";

    const condensedBullets = Array.isArray(chunkBullets)
      ? chunkBullets.slice(0, 120).map((b) => `- ${String(b)}`).join("\n")
      : "";
    const condensedTerms = Array.isArray(keyTerms)
      ? Array.from(new Set(keyTerms.map(String))).slice(0, 40).join(", ")
      : "";
    const safeExcerpt = String(transcriptExcerpt || "").slice(0, 18_000);

    const prompt = `You are an expert university study coach synthesizing a recorded lecture into structured study notes.
Lecture title: ${String(title)}
Duration: ${Math.round(Number(totalDurationSec) || 0)} seconds
${langInstruction}

${condensedBullets ? `Chunk takeaways:\n${condensedBullets}\n` : ""}
${condensedTerms ? `Key terms noticed: ${condensedTerms}\n` : ""}
${safeExcerpt ? `Timestamped transcript / notes:\n${safeExcerpt}\n` : ""}

Respond with strict JSON only (no extra prose):
{
  "executiveSummary": "A crisp 2-4 paragraph Markdown overview of the lecture's core thesis, proofs/examples, and exam takeaways.",
  "outline": [
    {
      "timestampSec": 0,
      "heading": "Topic / Section Heading",
      "bullets": ["Key point 1", "Key point 2"]
    }
  ],
  "vocabulary": [
    { "term": "Concept", "definition": "Clear 1-sentence student-friendly definition" }
  ],
  "flashcards": [
    { "front": "Active recall question", "back": "Concise accurate answer" }
  ]
}
Keep outline to 4-10 sections, vocabulary to 5-12 terms, and flashcards to 5-10 high-yield cards.`;

    const { response, model } = await generateWithModelFallback({
      candidateModels: LECTURE_SUMMARY_MODELS,
      apiKey,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const rawText = String(response?.text || "").trim();
    if (!rawText) {
      throw new Error("Empty lecture summary response from model");
    }

    const parsed = parseJsonLoose(rawText);
    return res.status(200).json({
      executiveSummary: String(parsed?.executiveSummary || "").trim(),
      outline: Array.isArray(parsed?.outline)
        ? parsed.outline.map((sec) => ({
            timestampSec: Math.max(0, Math.round(Number(sec?.timestampSec) || 0)),
            heading: String(sec?.heading || "").trim(),
            bullets: Array.isArray(sec?.bullets)
              ? sec.bullets.map((b) => String(b).trim()).filter(Boolean)
              : [],
          }))
        : [],
      vocabulary: Array.isArray(parsed?.vocabulary)
        ? parsed.vocabulary
            .map((v) => ({
              term: String(v?.term || "").trim(),
              definition: String(v?.definition || "").trim(),
            }))
            .filter((v) => v.term && v.definition)
        : [],
      flashcards: Array.isArray(parsed?.flashcards)
        ? parsed.flashcards
            .map((c) => ({
              front: String(c?.front || "").trim(),
              back: String(c?.back || "").trim(),
            }))
            .filter((c) => c.front && c.back)
        : [],
      modelUsed: model,
    });
  } catch (err) {
    console.error("Summarize lecture error:", err);
    return sendAiFailure(res, "Lecture summary failed", err);
  }
}
