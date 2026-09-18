export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-canvas-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Invalid URL protocol" });
    }

    // Only allow Canvas-like domains (covers custom school hosts like 4015.instructure.com)
    try {
      const u = new URL(targetUrl);
      const allowed = (process.env.CANVAS_ALLOWED_HOSTS || "instructure.com,canvaslms.com").split(",").map((s) => s.trim()).filter(Boolean);
      const ok = allowed.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
      if (!ok) {
        return res.status(400).json({ error: `Host not allowlisted for Canvas proxy: ${u.hostname}. Allowed: ${allowed.join(", ")}`, code: "host-not-allowlisted", host: u.hostname });
      }
    } catch {
      return res.status(400).json({ error: "Invalid target URL", code: "invalid-url" });
    }

    const headers = {
      "User-Agent": "StudentCommandCenter/1.0",
    };

    const canvasToken = req.headers["x-canvas-token"];
    if (canvasToken) {
      headers["Authorization"] = `Bearer ${canvasToken}`;
    }

    // Forward method + JSON body so Canvas submissions (POST) work, not just GET sync.
    const method = (req.method || "GET").toUpperCase();
    const fetchInit = { headers, method };
    if (method !== "GET" && method !== "HEAD" && req.body) {
      try {
        fetchInit.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        headers["Content-Type"] = "application/json";
      } catch {}
    }

    const response = await fetch(targetUrl, fetchInit);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Canvas fetch failed with status ${response.status}: ${response.statusText}`,
        code: response.status === 401 ? "canvas-unauthorized" : "canvas-upstream-error",
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    res.setHeader("Content-Type", contentType);

    if (contentType.includes("json")) {
      const data = await response.json();
      return res.status(200).json(data);
    } else {
      const text = await response.text();
      return res.status(200).send(text);
    }
  } catch (err) {
    console.error("Canvas proxy error:", err);
    // Sanitize error message to prevent leaking internal exception details
    res.status(500).json({ error: "Failed to fetch from Canvas" });
  }
}
