import { applyApiCors } from "../cors.js";
import { generateWithModelFallback, sendAiFailure } from "./generate.js";
import { COACH_MODE_MODELS, VISION_CHEAPEST_MODELS, normalizeCoachMode } from "./models.js";
import {
  TUTOR_POLICY,
  HOMEWORK_DUMP_REMINDER,
  LIVE_EXAM_REMINDER,
  ALLOWED_NON_TUTOR_TOOLS,
  isHomeworkDump,
  isLiveExamAttempt,
  detectAnswerLeak,
  buildSafeSocraticFallback,
} from "./tutorPolicy.js";

const MAX_LOG_PROMPT_CHARS = 300;
function truncateForLog(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_LOG_PROMPT_CHARS);
}

function normalizeMessageImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .slice(0, 4)
    .map((img) => ({
      base64: typeof img?.base64 === "string" ? img.base64.trim() : "",
      mimeType: typeof img?.mimeType === "string" ? img.mimeType.trim() : "image/jpeg",
    }))
    .filter((img) => img.base64.length > 0 && img.mimeType.startsWith("image/"));
}

function buildFormattedContents(messages) {
  const formattedContents = [];
  for (const m of messages || []) {
    const role = m.role === "assistant" ? "model" : "user";
    if (formattedContents.length === 0 && role === "model") {
      continue;
    }
    const imgs = role === "user" ? normalizeMessageImages(m?.images) : [];
    const parts = imgs.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    }));
    const text = String(m.content || "");
    if (text || parts.length === 0) {
      parts.push({
        text: text || "Hello! How can you help me today?",
      });
    } else {
      parts.push({
        text: "Please examine the attached image(s) and help me understand.",
      });
    }
    formattedContents.push({ role, parts });
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

    // Other studio tools (flashcards, outline, brief, summary, study_plan) reuse this endpoint
    // and identify themselves with an allowlisted context.tool; spoofed tools fall back to tutor policy.
    const requestedTool = typeof context?.tool === "string" ? context.tool.trim() : "";
    const isTutorChat = !(requestedTool && ALLOWED_NON_TUTOR_TOOLS.has(requestedTool));

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

    const lastUser = [...(messages || [])].reverse().find((m) => m && m.role !== "assistant");
    const lastUserText = String(lastUser?.content || "");

    if (isTutorChat) {
      systemInstruction = `${TUTOR_POLICY}\n\n${systemInstruction}`;
      if (isLiveExamAttempt(lastUserText)) {
        systemInstruction += `\n\n${LIVE_EXAM_REMINDER}`;
      }
      if (isHomeworkDump(lastUserText)) {
        systemInstruction += `\n\n${HOMEWORK_DUMP_REMINDER}`;
      }
    }

    const formattedContents = buildFormattedContents(messages);
    const hasImages = (messages || []).some((m) => normalizeMessageImages(m?.images).length > 0);

    const tierModels = COACH_MODE_MODELS[mode] || COACH_MODE_MODELS.balanced;
    const crossTierBackup =
      mode === "apex"
        ? [...COACH_MODE_MODELS.reasoning, ...COACH_MODE_MODELS.balanced]
        : mode === "reasoning"
          ? COACH_MODE_MODELS.balanced
          : mode === "quick"
            ? hasImages
              ? VISION_CHEAPEST_MODELS
              : COACH_MODE_MODELS.balanced
            : COACH_MODE_MODELS.quick;
    const candidateModels = [...new Set([...tierModels, ...crossTierBackup])];

    async function generatePrimaryReply() {
      const { response, model } = await generateWithModelFallback({
        candidateModels,
        contents: formattedContents,
        config: { systemInstruction },
      });
      const reply = String(response?.text || "").trim();
      if (!reply) {
        throw new Error("Empty reply from AI model");
      }
      return { reply, provider: "gemini", model };
    }

    const generated = await generatePrimaryReply();
    let finalReply = generated.reply;
    let guardrailTriggered = false;

    if (isTutorChat && detectAnswerLeak(lastUserText, finalReply)) {
      guardrailTriggered = true;
      console.warn("[tutor-guard] Answer leak detected for prompt:", truncateForLog(lastUserText));

      const strictRewriteSystem = `${TUTOR_POLICY}

STRICT REWRITE MANDATE: Your previous draft leaked direct answers, an answer key, multi-part solutions, or a finished essay. Rewrite from scratch as a brief Socratic hint ONLY (under 100 words). Never list answers (no 1. A / 2. B or a) / b) / c) solutions), ask what the student tried, and give at most one first-step hint or a worked example with different numbers.`;

      const rewritePrompt = `Student prompt: ${truncateForLog(lastUserText)}

Previous leaked draft (DO NOT copy answers from this):
${finalReply.slice(0, 600)}

Rewrite into a safe, hint-only Socratic reply in the same language as the student:`;

      let rewritten = "";
      try {
        if (process.env.GEMINI_API_KEY) {
          const resGem = await generateWithModelFallback({
            candidateModels,
            contents: [{ role: "user", parts: [{ text: rewritePrompt }] }],
            config: { systemInstruction: strictRewriteSystem },
          });
          rewritten = String(resGem?.response?.text || "").trim();
        }
      } catch {
        rewritten = "";
      }

      finalReply =
        rewritten && !detectAnswerLeak(lastUserText, rewritten)
          ? rewritten
          : buildSafeSocraticFallback(lastUserText);
    }

    return res.status(200).json({
      reply: finalReply,
      mode,
      provider: generated.provider,
      model: generated.model,
      tutorPolicyEnforced: isTutorChat,
      guardrailTriggered,
    });
  } catch (err) {
    console.error("Study assistant error:", err);
    return sendAiFailure(res, "Study assistant failed", err);
  }
}
