import { GoogleGenAI } from "@google/genai";
import { applyApiCors } from "../cors.js";
import {
  SERVER_MODELS,
  isRateLimitError,
  markModelLimited,
  modelError,
  prioritizeAvailableModels,
} from "./models.js";

let genAI = null;
let cachedApiKey = null;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!genAI || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

// Per-IP token bucket (15 req/min) + daily quota (50 req/day) shared by Express and Vercel.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_MIN = 15;
const DAILY_QUOTA_LIMIT = 50;
const serverBuckets = new Map();
const dailyQuotaMap = new Map();

function getClientIp(req) {
  const fwd = req?.headers?.["x-forwarded-for"];
  const firstFwd = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === "string"
      ? fwd.split(",")[0]
      : "";
  return (
    firstFwd.trim() ||
    String(req?.headers?.["x-real-ip"] || req?.ip || req?.socket?.remoteAddress || "127.0.0.1")
  );
}

function serverRateLimitOk(ip) {
  const now = Date.now();
  if (serverBuckets.size > 1000) {
    for (const [k, v] of serverBuckets) {
      if (now - v.last >= RATE_WINDOW_MS) serverBuckets.delete(k);
    }
  }
  const entry = serverBuckets.get(ip) || { tokens: RATE_LIMIT_PER_MIN, last: now };
  if (now - entry.last >= RATE_WINDOW_MS) {
    entry.tokens = RATE_LIMIT_PER_MIN;
    entry.last = now;
  }
  if (entry.tokens <= 0) return false;
  entry.tokens -= 1;
  serverBuckets.set(ip, entry);
  return true;
}

function serverDailyQuotaOk(ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyQuotaMap.size > 1000) {
    for (const [k, v] of dailyQuotaMap) {
      if (v.date !== today) dailyQuotaMap.delete(k);
    }
  }
  const entry = dailyQuotaMap.get(ip) || { date: today, count: 0 };
  if (entry.date !== today) {
    dailyQuotaMap.set(ip, { date: today, count: 1 });
    return true;
  }
  if (entry.count >= DAILY_QUOTA_LIMIT) return false;
  entry.count += 1;
  dailyQuotaMap.set(ip, entry);
  return true;
}

export function resetRateLimitsForTest() {
  serverBuckets.clear();
  dailyQuotaMap.clear();
}

export async function generateWithModelFallback(params) {
  const ai = getGenAI();
  const errors = [];
  const requested = params?.model;
  const candidateModels =
    Array.isArray(params?.candidateModels) && params.candidateModels.length > 0
      ? params.candidateModels
      : null;
  const rawModels = candidateModels
    ? candidateModels
    : requested && SERVER_MODELS.includes(requested)
      ? [requested, ...SERVER_MODELS.filter((m) => m !== requested)]
      : SERVER_MODELS;
  const models = prioritizeAvailableModels(rawModels);

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return { response, model, errors };
    } catch (e) {
      if (isRateLimitError(e)) {
        markModelLimited(model);
      }
      errors.push(`${model}: ${modelError(e)}`);
      console.warn(`Model ${model} failed: ${e?.message || e}`);
    }
  }
  const err = new Error(errors.join(" | ") || "All candidate Gemini models failed.");
  err.errors = errors;
  throw err;
}

export function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf("{");
    const firstBracket = stripped.indexOf("[");
    let start = -1;
    let end = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = stripped.lastIndexOf("}") + 1;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = stripped.lastIndexOf("]") + 1;
    }
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end));
    }
    throw new Error("Model did not return valid JSON");
  }
}

/** Return an honest HTTP 502/503 JSON error when all AI providers/models fail. */
export function sendAiFailure(res, label, err, extra = {}) {
  const detail = modelError(err);
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: `${label}: Server Gemini API key is not configured.`,
      code: "ai_not_configured",
      ...extra,
    });
  }
  const raw = String((err && err.message) || err || "");
  if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(raw)) {
    return res.status(503).json({
      error: `${label}: AI service is temporarily rate-limited or unavailable. ${detail}`.trim(),
      code: "ai_rate_limited",
      ...extra,
    });
  }
  return res.status(502).json({
    error: `${label}: AI upstream request failed. ${detail}`.trim(),
    code: "ai_upstream_failed",
    ...extra,
  });
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed", text: "" });
  }
  try {
    const { contents, config, model: requestedModel, candidateModels } = req.body || {};
    if (!contents) {
      return res.status(400).json({ error: "Missing contents", code: "missing_contents", text: "" });
    }
    const ip = getClientIp(req);
    if (!serverRateLimitOk(ip)) {
      return res.status(429).json({ error: "Rate limit 15/min exceeded", code: "rate_limited", text: "" });
    }
    if (!serverDailyQuotaOk(ip)) {
      return res.status(429).json({ error: "Daily quota 50/day exceeded", code: "daily_quota_exceeded", text: "" });
    }
    const allowedCandidates = Array.isArray(candidateModels)
      ? candidateModels.filter((m) => SERVER_MODELS.includes(m))
      : undefined;
    const { response, model } = await generateWithModelFallback({
      contents,
      config,
      model: requestedModel,
      candidateModels: allowedCandidates && allowedCandidates.length > 0 ? allowedCandidates : undefined,
    });
    return res.status(200).json({ text: response?.text || "", model });
  } catch (err) {
    console.error("generate error", err);
    return sendAiFailure(res, "Generate failed", err, { errors: err?.errors || [], text: "" });
  }
}
