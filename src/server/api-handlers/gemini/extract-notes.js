import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";
import { VISION_CHEAPEST_MODELS } from "./models.js";

const MODE_INSTRUCTIONS = {
  markdown:
    "Transcribe ALL handwritten or printed text, diagrams' labels, and equations from this note image into clean, well-structured Markdown. Preserve headings (# / ##), bullet lists, numbered steps, and tables. Format math formulas with KaTeX delimiters ($...$ inline, $$...$$ on its own line).",
  verbatim:
    "Transcribe every visible word, line, heading, label, and formula from this note image as faithfully and completely as possible without summarizing or skipping anything. Keep original line breaks and structure.",
  summary:
    "Read this note image carefully, extract the main ideas and any formulas/dates, and organize them into a crisp study outline with headings, bullet points, and key takeaways.",
};

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { imageBase64, mimeType, formatMode } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Missing image data", code: "missing_image" });
    }
    const safeMime =
      typeof mimeType === "string" && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    const mode = formatMode && MODE_INSTRUCTIONS[formatMode] ? formatMode : "markdown";

    const prompt = `You are an accurate academic OCR and note transcription assistant.
${MODE_INSTRUCTIONS[mode]}
If the notes are in Vietnamese, preserve Vietnamese diacritics accurately. If in English or another language, keep the original language.
If any handwritten word is slightly unclear, make your best contextual reading and mark uncertain words with [?].

Respond with strict JSON:
{
  "title": "Short descriptive title for these notes",
  "subject": "Detected school subject (or General)",
  "text": "The extracted note text (Markdown/KaTeX when requested)",
  "keyTerms": ["key term 1", "key term 2"]
}
Return only JSON.`;

    const { response, model } = await generateWithModelFallback({
      candidateModels: VISION_CHEAPEST_MODELS,
      contents: [
        { inlineData: { data: imageBase64, mimeType: safeMime } },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const rawText = String(response?.text || "").trim();
    if (!rawText) {
      throw new Error("Empty OCR response from model");
    }

    try {
      const parsed = parseJsonLoose(rawText);
      if (parsed && typeof parsed.text === "string" && parsed.text.trim()) {
        return res.status(200).json({
          title: String(parsed.title || "").trim() || "Scanned Notes",
          subject: String(parsed.subject || "").trim() || "General",
          text: parsed.text.trim(),
          keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.map(String).slice(0, 12) : [],
          model,
        });
      }
    } catch {
      // If model returned plain markdown instead of strict JSON, still return the extracted text cleanly.
    }

    return res.status(200).json({
      title: "Scanned Notes",
      subject: "General",
      text: rawText,
      keyTerms: [],
      model,
    });
  } catch (err) {
    console.error("Extract notes error:", err);
    return sendAiFailure(res, "Note scanner failed", err);
  }
}
