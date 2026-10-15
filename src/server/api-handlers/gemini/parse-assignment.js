import { GoogleGenAI } from "@google/genai";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getGenAI();
    const todayISO = new Date().toISOString().slice(0, 10);
    const prompt = `Extract a student assignment from this natural language text: "${text}"
Current reference date is ${todayISO} (Asia/Ho_Chi_Minh).
- dueDate: YYYY-MM-DD only if text states or unambiguously implies a date. Else "".
- NEVER invent weekend/+2d. If missing add "dateSource":"missing","confidence":0,"quote":"".
- Return confidence/dateSource/quote alongside subject/assignmentName/dueDate/priority.

Respond with JSON:
{
  "subject": "detected course/subject like Physics, AP Calculus, Literature, Chemistry, etc. If unknown, use General",
  "assignmentName": "clean concise assignment title",
  "dueDate": "YYYY-MM-DD ONLY if explicit or unambiguous relative, else empty string",
  "dateSource": "explicit|inferred-relative|missing",
  "confidence": 0.9,
  "quote": "exact <=25-word substring stating the date or empty string",
  "priority": "High" | "Med" | "Low",
  "status": "Not Started",
  "estimatedMinutes": 45
}
Return only JSON.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    // Div B post-guard: never let a guessed/malformed date through.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate || '')) parsed.dueDate = '';
    if (!parsed.dueDate) { parsed.dateSource = 'missing'; parsed.confidence = Math.min(Number(parsed.confidence ?? 0), 0.4); if (!parsed.quote) parsed.quote = ''; }
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Parse assignment error:", err);
    res.status(200).json({
      subject: "General",
      assignmentName: (req.body && req.body.text) || "New Task",
      dueDate: "",
      dateSource: "missing",
      confidence: 0,
      quote: "",
      priority: "Med",
      status: "Not Started",
      estimatedMinutes: 45,
    });
  }
}

// Div B (AI Deadline Trust V2) — pure helper exported for vitest. Additive only.
export function normalizeParseResult(parsed) {
  const out = parsed || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.dueDate || '')) out.dueDate = '';
  if (!out.dueDate) { out.dateSource = 'missing'; out.confidence = Math.min(Number(out.confidence ?? 0), 0.4); if (!out.quote) out.quote = ''; }
  return out;
}
