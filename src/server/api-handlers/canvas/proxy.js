import { applyApiCors } from "../cors.js";

export default async function handler(req, res) {
  if (applyApiCors(req, res)) return;

  try {
    const rawUrl = req.query?.url;
    const targetUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).json({ error: "Missing 'url' query parameter", code: "missing-url" });
    }

    // Strict SSRF allowlist: http(s) only, no embedded credentials, host must match Canvas allowlist.
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: "Invalid target URL", code: "invalid-url" });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ error: "Invalid URL protocol", code: "invalid-url" });
    }
    if (parsedUrl.username || parsedUrl.password) {
      return res.status(400).json({ error: "Credentials in URL are not allowed", code: "invalid-url" });
    }

    const allowed = (process.env.CANVAS_ALLOWED_HOSTS || "instructure.com,canvaslms.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const host = parsedUrl.hostname.toLowerCase();
    const ok = allowed.some((h) => host === h || host.endsWith("." + h));
    if (!ok) {
      return res.status(400).json({
        error: "host-not-allowlisted",
        code: "host-not-allowlisted",
        host: parsedUrl.hostname,
        allowed,
        message: `Host not allowlisted for Canvas proxy: ${parsedUrl.hostname}. Allowed: ${allowed.join(", ")}. Set CANVAS_ALLOWED_HOSTS if your school uses a custom Canvas domain.`,
      });
    }

    const headers = {
      "User-Agent": "StudentCommandCenter/1.0",
    };

    const canvasToken = req.headers?.["x-canvas-token"];
    if (typeof canvasToken === "string" && canvasToken.trim()) {
      headers["Authorization"] = `Bearer ${canvasToken.trim()}`;
    }

    // Forward method + JSON body so Canvas submissions (POST) work, not just GET sync.
    const method = String(req.method || "GET").toUpperCase();
    const fetchInit = { headers, method };
    const hasBody =
      req.body &&
      (typeof req.body === "string"
        ? req.body.length > 0
        : typeof req.body === "object" && Object.keys(req.body).length > 0);
    if (method !== "GET" && method !== "HEAD" && hasBody) {
      try {
        fetchInit.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        headers["Content-Type"] = "application/json";
      } catch {}
    }

    const response = await fetch(parsedUrl.toString(), fetchInit);
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
    }
    const text = await response.text();
    return res.status(200).send(text);
  } catch (err) {
    console.error("Canvas proxy error:", err);
    return res.status(500).json({ error: err?.message || "Failed to fetch from Canvas", code: "proxy-error" });
  }
}
