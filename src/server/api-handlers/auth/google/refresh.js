import { applyApiCors } from "../../cors.js";

// POST /api/auth/google/refresh — mint a fresh access token from a refresh token.
// Body: { refresh_token }. Returns { access_token, expires_in }.
// Revoked/expired grants surface as HTTP 401 { error: 'refresh_revoked' } so the
// frontend can fall back to a fresh consent grant exactly once.
export default async function handler(req, res) {
  if (applyApiCors(req, res, "POST, OPTIONS")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { refresh_token, scope: knownScope } = req.body || {};
    if (!refresh_token) return res.status(400).json({ error: "Missing refresh_token" });
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "OAuth not configured on server (missing client id/secret)" });
    }
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: String(refresh_token),
      client_id: clientId,
      client_secret: clientSecret,
    });
    const upstream = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const code = String(data?.error || "");
      // invalid_grant = revoked, expired, or wrong-project grant → must re-consent.
      if (code === "invalid_grant") {
        return res.status(401).json({ error: "refresh_revoked" });
      }
      return res.status(400).json({ error: data?.error_description || data?.error || `Refresh failed (HTTP ${upstream.status})` });
    }
    if (!data?.access_token) return res.status(400).json({ error: "Google returned no access token" });
    const rawScope =
      typeof data.scope === "string" && data.scope.trim()
        ? data.scope
        : typeof knownScope === "string"
        ? knownScope
        : "";
    const scopes = Array.from(new Set(rawScope.split(/\s+/).map((s) => s.trim()).filter(Boolean)));
    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
      scope: scopes.join(" "),
      scopes,
      token_type: data.token_type || "Bearer",
    });
  } catch (err) {
    console.error("auth refresh error", err);
    return res.status(500).json({ error: err?.message || "Refresh failed" });
  }
}
