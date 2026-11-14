import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose } from "./generate.js";
import { SERVER_MODELS } from "./models.js";

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
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }
  const prompt = buildParsePrompt(text);
  try {
    const { response } = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const parsed = parseJsonLoose(response?.text);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.dueDate || ""))) {
      parsed.dueDate = "";
      parsed.dueConfidence = "none";
    }
    return res.status(200).json({ ...parsed, aiStatus: "ok" });
  } catch (err) {
    console.error("Parse assignment error:", err);
    // Honest fallback: keep the student's words, invent nothing — the confirm card asks for the date.
    return res.status(200).json({
      subject: "",
      assignmentName: String(text).slice(0, 120),
      dueDate: "",
      dueConfidence: "none",
      dueEvidence: "",
      priority: "Med",
      status: "Not Started",
      estimatedMinutes: 45,
      aiStatus: "failed",
      candidateModelsTried: CANDIDATE_MODELS.length,
    });
  }
}
