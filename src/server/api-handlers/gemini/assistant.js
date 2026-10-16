import { GoogleGenAI } from "@google/genai";
import { TUTOR_POLICY, HOMEWORK_DUMP_REMINDER, isHomeworkDump } from "./tutorPolicy.js";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.0-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
].filter(Boolean);

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

    const response = await generateWithModelFallback({
      contents: formattedContents,
      config: {
        systemInstruction,
      },
    });

    res.status(200).json({
      reply:
        response.text ||
        "I'm here to help you organize and conquer your school tasks!",
    });
  } catch (err) {
    console.error("Study assistant error:", err);
    res.status(200).json({
      reply:
        "I am ready to help you plan your study blocks, organize your assignments, and draft emails to your teachers! Let me know which task or class you want to tackle first.",
    });
  }
}
