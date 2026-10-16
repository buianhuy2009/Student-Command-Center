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

async function generateWithModelFallback(params) {
  const ai = getGenAI();
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} attempt failed: ${err.message || err}. Trying next fallback...`);
    }
  }
  throw lastError || new Error("All candidate Gemini models failed.");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { existingEvents, pendingTasks, chronotype, date } = req.body || {};
    const targetDate = date || new Date().toISOString().split("T")[0];
    const prompt = `You are an AI study planner that schedules optimal focus blocks for a student.

Today's date: ${targetDate}
Student chronotype preference: ${chronotype || "balanced (no preference)"}

Existing calendar events today (DO NOT overlap with these):
${JSON.stringify(existingEvents || [], null, 2)}

Pending tasks that need study time:
${JSON.stringify((pendingTasks || []).map((t) => ({
  name: t.assignmentName || t.name, subject: t.subject || t.courseName, dueDate: t.dueDate || t.dueAt, priority: t.priority, estimatedMinutes: t.estimatedMinutes || 45,
})), null, 2)}

Guidelines:
1. Suggest 2-4 study blocks of 25-50 minutes each with 5-10 min breaks between them.
2. If chronotype is "morning", prefer slots 7am-12pm. If "evening", prefer 4pm-10pm. If "balanced", spread across the day.
3. Avoid overlapping with existing events. Leave at least 15 min buffer.
4. Assign the highest-priority pending task to the first suggested slot.

Respond with valid JSON:
{
  "suggestedSlots": [
    { "startTime": "09:00", "endTime": "09:45", "taskName": "Task name", "taskSubject": "Subject", "reason": "Brief reason" }
  ],
  "chronotypeAdvice": "Short personalized tip about their study pattern"
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Suggest study slots error:", err);
    res.status(200).json({
      suggestedSlots: [
        { startTime: "09:00", endTime: "09:45", taskName: "Study Block 1", taskSubject: "General", reason: "Morning focus window" },
        { startTime: "14:00", endTime: "14:45", taskName: "Study Block 2", taskSubject: "General", reason: "Afternoon review session" },
      ],
      chronotypeAdvice: "Try studying during your most alert hours for best results!",
    });
  }
}
