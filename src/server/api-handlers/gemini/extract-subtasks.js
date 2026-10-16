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
    const { assignmentName, courseName, description, dueAt, pointsPossible } = req.body || {};
    if (!assignmentName) {
      return res.status(400).json({ error: "Assignment name is required" });
    }

    const prompt = `You are an AI academic task planner for a student command center.
Given the following Canvas LMS assignment, break it down into a clear, ordered checklist of actionable sub-tasks that a student can follow step-by-step to complete the assignment.

Assignment Details:
- Name: ${assignmentName}
- Course: ${courseName || "Unknown"}
- Due Date: ${dueAt || "Not specified"}
- Points: ${pointsPossible || "N/A"}
- Description / Instructions:
${description || "No description provided. Infer reasonable sub-tasks from the assignment name."}

Guidelines:
1. Extract 3-8 concrete, actionable sub-tasks (not vague like "do research" — be specific like "Find 3 peer-reviewed sources on [topic]").
2. Order them logically (research first, then draft, then review, then submit).
3. For each sub-task, estimate minutes needed.
4. If the description is in Vietnamese, write sub-tasks in Vietnamese. Otherwise use English.

Respond with valid JSON:
{
  "subtasks": [
    { "title": "Clear actionable sub-task title", "estimatedMinutes": 20, "order": 1 },
    { "title": "Another sub-task", "estimatedMinutes": 15, "order": 2 }
  ],
  "totalEstimatedMinutes": 60,
  "difficulty": "Easy" | "Medium" | "Hard"
}
Return only JSON.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.status(200).json(parsed);
  } catch (err) {
    console.error("Extract subtasks error:", err);
    res.status(200).json({
      subtasks: [
        { title: "Read the assignment instructions carefully", estimatedMinutes: 10, order: 1 },
        { title: "Research and gather materials", estimatedMinutes: 30, order: 2 },
        { title: "Create first draft", estimatedMinutes: 45, order: 3 },
        { title: "Review, proofread, and finalize", estimatedMinutes: 20, order: 4 },
        { title: "Submit before deadline", estimatedMinutes: 5, order: 5 },
      ],
      totalEstimatedMinutes: 110,
      difficulty: "Medium",
    });
  }
}
