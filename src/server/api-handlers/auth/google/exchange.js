// POST /api/auth/google/exchange — trade a GIS authorization `code` for tokens.
// The client_secret never leaves the server: the browser only ever sees the
// one-time code. Returns { access_token, expires_in, refresh_token?, scope? }.
// A `refresh_token` is issued on first consent (or when prompt=consent); repeat
// grants may omit it — the frontend keeps its previously stored one.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { code, redirect_uri } = req.body || {};
    if (!code) return res.status(400).json({ error: "Missing authorization code" });
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "OAuth not configured on server (missing client id/secret)" });
    }
    const params = new URLSearchParams({
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri ? String(redirect_uri) : "postmessage",
      grant_type: "authorization_code",
    });
    const upstream = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error_description || data?.error || `Exchange failed (HTTP ${upstream.status})`;
      return res.status(400).json({ error: msg });
    }
    if (!data?.access_token) return res.status(400).json({ error: "Google returned no access token" });
    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
      refresh_token: data.refresh_token || null,
      scope: data.scope || "",
      token_type: data.token_type || "Bearer",
    });
  } catch (err) {
    console.error("auth exchange error", err);
    // Sanitize error message to prevent leaking sensitive server details / stack info
    return res.status(500).json({ error: "Internal server error during authorization exchange" });
  }
}
