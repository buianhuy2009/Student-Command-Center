// Shared plumbing for the public catalog proxies (arXiv, Open Library, PhET).
// Browsers cannot call arXiv or the PhET metadata service directly (no CORS header),
// so the server fetches them. Each handler targets one fixed host: only query values
// come from the client, never a URL.

const USER_AGENT = "StudentOS/3.6 (student study app)";
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 30;
const CACHE_MAX_ENTRIES = 100;

const buckets = new Map();
const cache = new Map();

export function resetCatalogStateForTest() {
  buckets.clear();
  cache.clear();
}

export function catalogRateLimitOk(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "").split(",")[0];
  const ip = String(first || "").trim() || String(req?.ip || req?.socket?.remoteAddress || "local");
  const now = Date.now();
  if (buckets.size > 1000) buckets.clear();
  const entry = buckets.get(ip);
  if (!entry || now - entry.start >= RATE_WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_PER_WINDOW;
}

export function readQueryParam(req, name) {
  const direct = req?.query?.[name];
  const value = Array.isArray(direct) ? direct[0] : direct;
  if (typeof value === "string") return value;
  try {
    return new URL(req?.originalUrl || req?.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

export function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function writeCache(key, value, ttlMs) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// 503 usually means "slow down", so only transient server errors are retried.
const RETRY_STATUSES = new Set([500, 502]);

/** GET with a timeout. Retries once on a 500/502 or network failure, never after a timeout. */
export async function fetchUpstream(url, { timeoutMs = 20_000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!RETRY_STATUSES.has(response.status) || attempt > 0) {
        // Read the body inside the timeout window so a stalled stream cannot hang the function.
        const text = await response.text();
        return { ok: response.ok, status: response.status, text };
      }
    } catch (err) {
      if (controller.signal.aborted) {
        const timeout = new Error("The catalog took too long to answer.");
        timeout.code = "timeout";
        throw timeout;
      }
      if (attempt > 0) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function sendUpstreamFailure(res, label, err) {
  const timedOut = err?.code === "timeout";
  console.error(`${label} proxy failed:`, String(err?.message || err).slice(0, 300));
  return res.status(timedOut ? 504 : 502).json({
    error: timedOut ? `${label} took too long to answer.` : `Could not reach ${label}.`,
    code: timedOut ? "timeout" : "upstream_unreachable",
  });
}

export function sendUpstreamStatus(res, label, status) {
  const busy = status === 429 || status === 503;
  return res.status(busy ? 429 : 502).json({
    error: `${label} returned HTTP ${status}.`,
    code: busy ? "upstream_busy" : "upstream_error",
    status,
  });
}
