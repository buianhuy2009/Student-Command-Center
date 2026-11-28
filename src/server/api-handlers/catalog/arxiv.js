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

// arXiv has no bare "math", "econ", "stat" or "physics" category, so groups need wildcards.
const CATEGORY_QUERIES = {
  all: "cat:cs.AI OR cat:physics.* OR cat:math.*",
  "cs.AI": "cat:cs.AI",
  math: "cat:math.*",
  physics:
    "cat:physics.* OR cat:astro-ph.* OR cat:cond-mat.* OR cat:quant-ph OR cat:gr-qc OR cat:hep-th OR cat:hep-ph OR cat:math-ph",
  "q-bio": "cat:q-bio.*",
  econ: "cat:econ.*",
  stat: "cat:stat.*",
};

export function buildArxivSearchQuery(query, category) {
  const terms = String(query || "")
    .replace(/["():\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  const known = Object.prototype.hasOwnProperty.call(CATEGORY_QUERIES, category) ? category : "all";
  const termExpr = terms.map((term) => `all:${term}`).join(" AND ");
  if (!termExpr) return CATEGORY_QUERIES[known];
  if (known === "all") return termExpr;
  return `(${CATEGORY_QUERIES[known]}) AND (${termExpr})`;
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "GET, OPTIONS")) return;
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  const query = readQueryParam(req, "q").trim().slice(0, 200);
  const category = readQueryParam(req, "category") || "all";
  const params = new URLSearchParams({
    search_query: buildArxivSearchQuery(query, category),
    start: "0",
    max_results: "12",
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
  const url = `https://export.arxiv.org/api/query?${params}`;

  const send = (xml) => {
    res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(xml);
  };

  const cached = readCache(url);
  if (cached) return send(cached);
  if (!catalogRateLimitOk(req)) {
    return res.status(429).json({ error: "Too many searches. Wait a minute.", code: "rate_limited" });
  }

  try {
    const upstream = await fetchUpstream(url);
    if (!upstream.ok) return sendUpstreamStatus(res, "arXiv", upstream.status);
    writeCache(url, upstream.text, 10 * 60_000);
    return send(upstream.text);
  } catch (err) {
    return sendUpstreamFailure(res, "arXiv", err);
  }
}
