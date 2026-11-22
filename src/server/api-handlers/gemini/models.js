// One model chain for every server AI route.
// `gemini-flash-latest` is Google's moving alias for the current Flash model;
// `GEMINI_MODEL` (server env override) takes priority when set.
export const SERVER_MODELS = [
  ...new Set(
    [
      process.env.GEMINI_MODEL,
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-flash-lite-latest",
    ].filter(Boolean)
  ),
];

export const COACH_MODE_MODELS = {
  teacher: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"],
  professor: ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"],
};

/** Short, key-free error text for logs, error payloads, and the health probe. */
export function modelError(err) {
  const raw = String((err && err.message) || err || "");
  const m = /"message"\s*:\s*"([^"]{0,180})/.exec(raw);
  return (m ? m[1] : raw).slice(0, 180);
}
