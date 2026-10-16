// One model chain for every server AI route. On 2026-10-16 the old hard-coded chain
// (3.5-flash → 3.0-flash → 2.5-flash → 2.0-flash) failed end to end ("gemini-2.0-flash is
// no longer available"), so every AI feature silently fell back. `gemini-flash-latest`
// is Google's moving alias for the current Flash model; GEMINI_MODEL (Vercel env) wins.
export const SERVER_MODELS = [
  ...new Set(
    [
      process.env.GEMINI_MODEL,
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-flash-lite-latest",
    ].filter(Boolean)
  ),
];

/** Short, key-free error text for logs and the health probe. */
export function modelError(err) {
  const raw = String((err && err.message) || err || "");
  const m = /"message"\s*:\s*"([^"]{0,180})/.exec(raw);
  return (m ? m[1] : raw).slice(0, 180);
}
