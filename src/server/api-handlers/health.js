import { generateWithModelFallback } from "./gemini/generate.js";
import { SERVER_MODELS } from "./gemini/models.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-canvas-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  const body = {
    status: "ok",
    platform: "vercel-serverless",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    models: SERVER_MODELS,
    timestamp: new Date().toISOString(),
  };
  // /api/health?probe=1 → which model actually answers right now (no secrets returned).
  if (req.query && req.query.probe) {
    try {
      const { model, errors } = await generateWithModelFallback({ contents: "Reply with OK." });
      body.ai = { ok: true, model, skipped: errors };
    } catch (err) {
      body.ai = { ok: false, errors: err.errors || [String(err.message || err).slice(0, 300)] };
    }
  }
  return res.status(200).json(body);
}
