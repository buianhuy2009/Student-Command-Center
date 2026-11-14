import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, sendAiFailure } from "./generate.js";
import { TUTOR_POLICY, HOMEWORK_DUMP_REMINDER, isHomeworkDump } from "./tutorPolicy.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { messages, context } = req.body || {};

    // Other studio tools (flashcards, outlines, research brief) reuse this endpoint as a
    // plain generator and identify themselves with context.tool; only the student-facing
    // tutor chat (no tool) gets the "hints, never the homework" policy.
    const isTutorChat = !(context && context.tool);

    let systemInstruction = `You are the Student Command Center AI Study Advisor & Academic Coach.
You help high school and university students manage their coursework, plan 45-minute focus sessions, break down large essays/projects into milestones, draft professional emails to professors, and master challenging concepts.
Keep your responses structured, encouraging, concise, and highly actionable with markdown formatting and bullet points where helpful.
Math formatting rules (the client renders with KaTeX): write inline formulas as $...$ and display formulas as $$...$$ on their own lines. Never mix \\(...\\) / \\[...\\] delimiters, and never place two $$...$$ blocks on a single line — put each display formula on its own line.
Current student context:
${JSON.stringify(context || {}, null, 2)}`;

    if (isTutorChat) {
      systemInstruction = `${TUTOR_POLICY}\n\n${systemInstruction}`;
      const lastUser = [...(messages || [])].reverse().find((m) => m && m.role !== "assistant");
      if (lastUser && isHomeworkDump(lastUser.content)) {
        systemInstruction += `\n\n${HOMEWORK_DUMP_REMINDER}`;
      }
    }

    // Sanitize messages so that turn 0 is ALWAYS 'user' (Gemini requirement)
    const formattedContents = [];
    for (const m of messages || []) {
      const role = m.role === "assistant" ? "model" : "user";
      if (formattedContents.length === 0 && role === "model") {
        // Skip assistant welcome greeting if it's at index 0
        continue;
      }
      formattedContents.push({
        role,
        parts: [{ text: m.content || "" }],
      });
    }

    if (formattedContents.length === 0) {
      formattedContents.push({
        role: "user",
        parts: [{ text: "Hello! How can you help me today?" }],
      });
    }

    const { response } = await generateWithModelFallback({
      contents: formattedContents,
      config: {
        systemInstruction,
      },
    });

    const reply = String(response?.text || "").trim();
    if (!reply) {
      throw new Error("Empty reply from AI model");
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Study assistant error:", err);
    return sendAiFailure(res, "Study assistant failed", err);
  }
}
