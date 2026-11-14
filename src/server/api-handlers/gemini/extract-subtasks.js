import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { assignmentName, courseName, description, dueAt, pointsPossible } = req.body || {};
    if (!assignmentName) {
      return res.status(400).json({ error: "Assignment name is required", code: "missing_assignment_name" });
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

    const { response } = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseJsonLoose(response?.text);
    if (!parsed || !Array.isArray(parsed.subtasks)) {
      throw new Error("Invalid subtasks payload from AI");
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Extract subtasks error:", err);
    return sendAiFailure(res, "Extract subtasks failed", err);
  }
}
