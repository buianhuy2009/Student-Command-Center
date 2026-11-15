import fs from "node:fs";
import path from "node:path";

const DEFAULT_APPLET_OAUTH_CLIENT_ID =
  "614024702267-34fmfki2vkuaq7nmdm7s8crsqsj3fpto.apps.googleusercontent.com";

let cachedAppletClientId = null;

function readAppletClientId() {
  if (cachedAppletClientId !== null) return cachedAppletClientId;
  const candidates = [path.resolve(process.cwd(), "firebase-applet-config.json")];
  if (typeof __dirname === "string") {
    candidates.push(path.resolve(__dirname, "../../../../../firebase-applet-config.json"));
  }
  for (const target of candidates) {
    try {
      const raw = fs.readFileSync(target, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.oAuthClientId === "string" && parsed.oAuthClientId.trim()) {
        cachedAppletClientId = parsed.oAuthClientId.trim();
        return cachedAppletClientId;
      }
    } catch {
      // Try next candidate
    }
  }
  cachedAppletClientId = DEFAULT_APPLET_OAUTH_CLIENT_ID;
  return cachedAppletClientId;
}

/**
 * Resolve Google Web OAuth client credentials cleanly without duplicating logic
 * across health/exchange/refresh handlers.
 */
export function resolveServerGoogleOAuthConfig() {
  const envClientId = (
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ""
  ).trim();
  const clientId = envClientId || readAppletClientId();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return {
    clientId,
    clientSecret,
    isConfigured: Boolean(clientId && clientSecret),
  };
}
