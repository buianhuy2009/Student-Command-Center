import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, parseJsonLoose, sendAiFailure } from "./generate.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

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

    const { response } = await generateWithModelFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseJsonLoose(response?.text);
    if (!parsed || !Array.isArray(parsed.suggestedSlots)) {
      throw new Error("Invalid study slots payload from AI");
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Suggest study slots error:", err);
    return sendAiFailure(res, "Suggest study slots failed", err);
  }
}
