import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, sendAiFailure } from "./generate.js";
import { COACH_MODE_MODELS, normalizeCoachMode } from "./models.js";
import { TUTOR_POLICY, HOMEWORK_DUMP_REMINDER, isHomeworkDump } from "./tutorPolicy.js";

const GROQ_CHAT_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

async function callServerGroq(messages, systemInstruction) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error("Quick tier backup uses Groq, which is not configured on this server (missing GROQ_API_KEY).");
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
      if (text) return { text, model };
    } else {
      const detail = await response.text().catch(() => "");
      lastErr = new Error(`Groq ${response.status}: ${detail.slice(0, 180)}`);
    }
  }
  throw lastErr || new Error("Groq did not return a reply.");
}

function buildFormattedContents(messages) {
  const formattedContents = [];
  for (const m of messages || []) {
    const role = m.role === "assistant" ? "model" : "user";
    if (formattedContents.length === 0 && role === "model") {
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
  return formattedContents;
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    const { messages, context, mode: rawMode } = req.body || {};
    const mode = normalizeCoachMode(rawMode);

    // Other studio tools (flashcards, outlines, research brief) reuse this endpoint as a
    // plain generator and identify themselves with context.tool; only the student-facing
    // tutor chat (no tool) gets the "hints, never the homework" policy.
    const isTutorChat = !(context && context.tool);

    const modeGuidance =
      mode === "apex"
        ? "Coach depth: Maximum depth — deliver rigorous, nuanced academic synthesis, edge-case checks, and deep conceptual clarity."
        : mode === "reasoning"
          ? "Coach depth: Multi-step reasoning — break down tough problems systematically with university-level rigor and intuition."
          : mode === "quick"
            ? "Coach style: Quick — give crisp, direct, scannable next steps in as few sentences as possible."
            : "Coach style: Balanced — clear, supportive, step-by-step explanations tailored for everyday study.";

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

    const formattedContents = buildFormattedContents(messages);

    // Quick tier: Gemma 4 (31B -> 26B) first, then Groq fallback when Gemma is unavailable or hits limit.
    if (mode === "quick") {
      let gemmaErr = null;
      if (process.env.GEMINI_API_KEY) {
        try {
          const { response, model } = await generateWithModelFallback({
            candidateModels: COACH_MODE_MODELS.quick,
            contents: formattedContents,
            config: { systemInstruction },
          });
          const reply = String(response?.text || "").trim();
          if (reply) {
            return res.status(200).json({ reply, mode, provider: "gemini", model });
          }
        } catch (err) {
          gemmaErr = err;
        }
      }
      try {
        const { text, model } = await callServerGroq(messages, systemInstruction);
        return res.status(200).json({ reply: text, mode, provider: "groq", model });
      } catch (groqErr) {
        throw gemmaErr || groqErr;
      }
    }

    // Build candidate list for the requested tier, plus graceful cross-tier fallback on limit exhaustion.
    const tierModels = COACH_MODE_MODELS[mode] || COACH_MODE_MODELS.balanced;
    const crossTierBackup =
      mode === "apex"
        ? [...COACH_MODE_MODELS.reasoning, ...COACH_MODE_MODELS.balanced]
        : mode === "reasoning"
          ? COACH_MODE_MODELS.balanced
          : COACH_MODE_MODELS.quick;
    const candidateModels = [...new Set([...tierModels, ...crossTierBackup])];

    const { response, model } = await generateWithModelFallback({
      candidateModels,
      contents: formattedContents,
      config: { systemInstruction },
    });

    const reply = String(response?.text || "").trim();
    if (!reply) {
      throw new Error("Empty reply from AI model");
    }

    return res.status(200).json({ reply, mode, provider: "gemini", model });
  } catch (err) {
    console.error("Study assistant error:", err);
    return sendAiFailure(res, "Study assistant failed", err);
  }
}
