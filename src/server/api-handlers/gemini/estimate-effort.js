import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

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

    const { response } = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseJsonLoose(response?.text);
    if (!parsed || !Array.isArray(parsed.estimates)) {
      throw new Error("Invalid effort estimates payload from AI");
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Estimate effort error:", err);
    return sendAiFailure(res, "Estimate effort failed", err);
  }
}
