import { GoogleGenAI } from "@google/genai";
import { SERVER_MODELS } from "./models.js";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const CANDIDATE_MODELS = SERVER_MODELS;
const VI_WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildParsePrompt(text, nowISO) {
  const d = new Date(Date.parse(nowISO || new Date().toISOString()) + 7 * 3600 * 1000);
  const today = `${d.toISOString().slice(0, 10)} (${VI_WEEKDAYS[d.getUTCDay()]} / ${EN_WEEKDAYS[d.getUTCDay()]})`;
  return `A Vietnamese lower-secondary student typed this to add a task: ${JSON.stringify(String(text).slice(0, 600))}
Today in Vietnam: ${today}. Weeks run Monday-Sunday. "thứ 2" = Monday … "thứ 7" = Saturday, "chủ nhật"/"CN" = Sunday. "thứ 6 tuần này" = this week's Friday, "tuần sau" = next week. Numeric dates are DAY/MONTH ("18/9" = 18 September).
If the text gives no specific day, dueDate MUST be "" and dueConfidence "none" — never guess a date.

Return ONLY JSON:
{"subject":"school subject (Vietnamese curriculum name if Vietnamese: Toán, Ngữ văn, Tiếng Anh, Khoa học tự nhiên, Lịch sử và Địa lí, GDCD, Tin học, Công nghệ…) or General","assignmentName":"short clean task title","dueDate":"YYYY-MM-DD or empty","dueConfidence":"explicit|relative|none","dueEvidence":"the words from the text that hold the date, or empty","priority":"High|Med|Low","status":"Not Started","estimatedMinutes":45}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }
  const prompt = buildParsePrompt(text);
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await getGenAI().models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.1 },
      });
      const parsed = JSON.parse(response.text || "{}");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.dueDate || ""))) {
        parsed.dueDate = "";
        parsed.dueConfidence = "none";
      }
      return res.status(200).json({ ...parsed, aiStatus: "ok" });
    } catch (err) {
      lastError = err;
      console.warn(`Parse assignment: ${model} failed: ${err?.message || err}`);
    }
  }
  console.error("Parse assignment error:", lastError);
  // Honest fallback: keep the student's words, invent nothing — the confirm card asks for the date.
  res.status(200).json({
    subject: "",
    assignmentName: String(text).slice(0, 120),
    dueDate: "",
    dueConfidence: "none",
    dueEvidence: "",
    priority: "Med",
    status: "Not Started",
    estimatedMinutes: 45,
    aiStatus: "failed",
  });
}
