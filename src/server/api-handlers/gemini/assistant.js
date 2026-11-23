import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, sendAiFailure } from "./generate.js";
import { COACH_MODE_MODELS } from "./models.js";
import { TUTOR_POLICY, HOMEWORK_DUMP_REMINDER, isHomeworkDump } from "./tutorPolicy.js";

const GROQ_CHAT_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

async function callServerGroq(messages, systemInstruction) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error("Fast mode uses Groq, which is not configured on this server (missing GROQ_API_KEY).");
    err.status = 503;
    throw err;
  }

  const groqMessages = [
    { role: "system", content: systemInstruction },
    ...(messages || []).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content || ""),
    })),
  ];

  let lastErr = null;
  for (const model of GROQ_CHAT_MODELS) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = String(data?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
    } else {
      const detail = await response.text().catch(() => "");
      lastErr = new Error(`Groq ${response.status}: ${detail.slice(0, 180)}`);
    }
  }
  throw lastErr || new Error("Groq did not return a reply.");
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { messages, context, mode: rawMode } = req.body || {};
    // Normalize legacy 'teacher' and 'fast' to 'auto'; keep 'professor' distinct.
    const mode = rawMode === "professor" ? "professor" : "auto";

    // Other studio tools (flashcards, outlines, research brief) reuse this endpoint as a
    // plain generator and identify themselves with context.tool; only the student-facing
    // tutor chat (no tool) gets the "hints, never the homework" policy.
    const isTutorChat = !(context && context.tool);

    const modeGuidance =
      mode === "professor"
        ? "Coach depth: Professor mode — provide thorough conceptual intuition, edge-case analysis, and university-level academic rigor."
        : "Coach style: Auto mode — clear, fast, supportive step-by-step explanations tailored for everyday study.";

    let systemInstruction = `You are the Student Command Center AI Study Advisor & Academic Coach.
${modeGuidance}
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

    const candidateModels =
      mode === "professor" ? COACH_MODE_MODELS.professor : COACH_MODE_MODELS.auto;

    try {
      const { response } = await generateWithModelFallback({
        candidateModels,
        contents: formattedContents,
        config: {
          systemInstruction,
        },
      });

      const reply = String(response?.text || "").trim();
      if (!reply) {
        throw new Error("Empty reply from AI model");
      }

      return res.status(200).json({ reply, mode });
    } catch (geminiErr) {
      // In Auto mode, silently fall back to Groq on Gemini error/quota/missing key.
      if (mode === "auto" && String(process.env.GROQ_API_KEY || "").trim()) {
        try {
          const reply = await callServerGroq(messages, systemInstruction);
          return res.status(200).json({ reply, mode: "auto" });
        } catch {
          // Fall through to surface original failure cleanly.
        }
      }
      throw geminiErr;
    }
  } catch (err) {
    console.error("Study assistant error:", err);
    return sendAiFailure(res, "Study assistant failed", err);
  }
}
