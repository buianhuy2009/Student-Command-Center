// Allowed Gemini & Gemma models for StudentOS (no TTS or unapproved aliases).
// Models rotate automatically when one hits a rate/quota limit.
export const ALLOWED_GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

const ALLOWED_SET = new Set(ALLOWED_GEMINI_MODELS);
const envModel = process.env.GEMINI_MODEL && ALLOWED_SET.has(process.env.GEMINI_MODEL)
  ? process.env.GEMINI_MODEL
  : null;

export const SERVER_MODELS = [
  ...new Set(
    [
      envModel,
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
    ].filter(Boolean)
  ),
];

export const COACH_MODE_MODELS = {
  quick: ["gemma-4-31b-it", "gemma-4-26b-a4b-it"],
  balanced: ["gemini-3-flash-preview", "gemini-3.1-flash-lite"],
  reasoning: ["gemini-3.6-flash", "gemini-3.5-flash-lite"],
  apex: ["gemini-3.8-flash"],
};

// Email triage uses the Fast (Gemma 4 + Groq) group.
export const EMAIL_FAST_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];

// Note image OCR uses the cheapest image-capable model group first, with Lite/Flash backup.
export const VISION_CHEAPEST_MODELS = [
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];

export function normalizeCoachMode(rawMode) {
  switch (rawMode) {
    case "quick":
    case "fast":
      return "quick";
    case "balanced":
    case "teacher":
      return "balanced";
    case "reasoning":
    case "professor":
    case "deep":
      return "reasoning";
    case "apex":
    case "deepest":
      return "apex";
    default:
      return "balanced";
  }
}

// Temporary per-model cooldowns so rate-limited models rotate out instead of being hammered repeatedly.
const MODEL_COOLDOWN_MS = 90_000;
const modelCooldowns = new Map();

export function isRateLimitError(err) {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  const raw = String((err && err.message) || err || "");
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(raw);
}

export function markModelLimited(model) {
  if (!model) return;
  modelCooldowns.set(model, Date.now() + MODEL_COOLDOWN_MS);
}

export function prioritizeAvailableModels(models) {
  const now = Date.now();
  const ready = [];
  const cooled = [];
  for (const m of models) {
    const until = modelCooldowns.get(m) || 0;
    if (until > now) {
      cooled.push(m);
    } else {
      if (until) modelCooldowns.delete(m);
      ready.push(m);
    }
  }
  return [...ready, ...cooled];
}

export function resetModelCooldownsForTest() {
  modelCooldowns.clear();
}

/** Short, key-free error text for logs, error payloads, and the health probe. */
export function modelError(err) {
  const raw = String((err && err.message) || err || "");
  const m = /"message"\s*:\s*"([^"]{0,180})/.exec(raw);
  return (m ? m[1] : raw).slice(0, 180);
}
