import { applyApiCors } from "../cors.js";
import {
  catalogRateLimitOk,
  fetchUpstream,
  readCache,
  readQueryParam,
  sendUpstreamFailure,
  sendUpstreamStatus,
  writeCache,
} from "./upstream.js";

// The default field set no longer includes isbn, so ask for exactly what the app shows.
const FIELDS = "key,title,author_name,first_publish_year,isbn,cover_i,edition_count,subject";
export const OPEN_LIBRARY_MIN_QUERY = 3;

export default async function handler(req, res) {
  if (applyApiCors(req, res, "GET, OPTIONS")) return;
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  const query = readQueryParam(req, "q").trim().slice(0, 200);
  if (query.length < OPEN_LIBRARY_MIN_QUERY) {
    return res.status(400).json({
      error: "Open Library needs at least 3 characters.",
      code: "query_too_short",
    });
  }
  const params = new URLSearchParams({ q: query, limit: "12", fields: FIELDS });
  const url = `https://openlibrary.org/search.json?${params}`;

  const send = (payload) => {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(payload);
  };

  const cached = readCache(url);
  if (cached) return send(cached);
  if (!catalogRateLimitOk(req)) {
    return res.status(429).json({ error: "Too many searches. Wait a minute.", code: "rate_limited" });
  }

  try {
    const upstream = await fetchUpstream(url);
    // 422 is Open Library refusing the wording itself, for example a lone stop word such as "the".
    if (upstream.status === 422) {
      return res.status(400).json({ error: "Open Library does not accept this search.", code: "query_not_allowed" });
    }
    if (!upstream.ok) return sendUpstreamStatus(res, "Open Library", upstream.status);
    const data = JSON.parse(upstream.text);
    const payload = {
      docs: (Array.isArray(data.docs) ? data.docs : []).map((doc) => ({
        ...doc,
        isbn: Array.isArray(doc.isbn) ? doc.isbn.slice(0, 3) : undefined,
        subject: Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : undefined,
      })),
    };
    writeCache(url, payload, 10 * 60_000);
    return send(payload);
  } catch (err) {
    return sendUpstreamFailure(res, "Open Library", err);
  }
}
