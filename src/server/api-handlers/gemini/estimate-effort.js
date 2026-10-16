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
    const { assignments } = req.body || {};
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(200).json({ estimates: [] });
    }

    const today = new Date().toISOString().split("T")[0];
    const prompt = `You are an AI academic advisor. Analyze the following student assignments and for each one, calculate:
1. A dynamic "riskScore" from 1-10 based on: how close the due date is to today (${today}), the assignment type difficulty, and current status.
2. An "estimatedMinutes" for how long the task should take.
3. A recommended "focusOrder" (1 = do first, 2 = do second, etc.)
4. A short "aiTip" (max 12 words) with specific advice.

Assignments:
${JSON.stringify(assignments.map((a) => ({
  id: a.id, name: a.assignmentName, subject: a.subject, dueDate: a.dueDate, priority: a.priority, status: a.status, estimatedMinutes: a.estimatedMinutes,
})), null, 2)}

Respond with valid JSON:
{
  "estimates": [
    { "id": "matching assignment id", "riskScore": 8, "estimatedMinutes": 45, "focusOrder": 1, "aiTip": "Due tomorrow — start the outline now" }
  ]
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Estimate effort error:", err);
    const fallback = ((req.body && req.body.assignments) || []).map((a, i) => {
      const daysLeft = Math.max(0, Math.floor((new Date(a.dueDate).getTime() - Date.now()) / 86400000));
      const riskScore = Math.min(10, Math.max(1, 10 - daysLeft));
      return {
        id: a.id, riskScore, estimatedMinutes: a.estimatedMinutes || 45, focusOrder: i + 1,
        aiTip: daysLeft <= 1 ? "Due very soon — start immediately" : daysLeft <= 3 ? "Due this week — prioritize" : "On track — plan ahead",
      };
    });
    res.status(200).json({ estimates: fallback });
  }
}
