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

const METADATA_URL = "https://phet.colorado.edu/services/metadata/1.3/simulations?format=json&summary";
const CACHE_TTL_MS = 6 * 60 * 60_000;
const HTML5_PROJECT_TYPE = 2;
// Top-level subject ids used by PhET's metadata service.
const SUBJECTS = { 4: "Physics", 13: "Chemistry", 12: "Biology", 15: "Math", 14: "Earth" };
const SIM_NAME = /^[a-z0-9-]+$/;
const PROJECT_NAME = /^html\/[a-z0-9-]+$/;

/**
 * Reduce PhET metadata to the HTML5 simulations that can run inside an iframe.
 * Java and Flash titles are left out because browsers cannot run them.
 */
export function toPhetCatalog(metadata, localized, locale = "en") {
  const localTitles = new Map();
  for (const project of localized?.projects || []) {
    if (project?.type !== HTML5_PROJECT_TYPE) continue;
    for (const sim of project.simulations || []) {
      const title = sim?.localizedSimulations?.[locale]?.title;
      if (title) localTitles.set(sim.name, title);
    }
  }

  const sims = [];
  const seen = new Set();
  for (const project of metadata?.projects || []) {
    if (project?.type !== HTML5_PROJECT_TYPE || !PROJECT_NAME.test(project.name || "")) continue;
    for (const sim of project.simulations || []) {
      const englishTitle = sim?.localizedSimulations?.en?.title;
      if (!englishTitle || !SIM_NAME.test(sim.name || "") || seen.has(sim.name)) continue;
      seen.add(sim.name);
      const localTitle = localTitles.get(sim.name);
      const base = `https://phet.colorado.edu/sims/${project.name}/latest/${sim.name}`;
      sims.push({
        name: sim.name,
        title: localTitle || englishTitle,
        englishTitle,
        subjects: (sim.subjects || []).map((id) => SUBJECTS[id]).filter(Boolean),
        isNew: Boolean(sim.isNew),
        url: `${base}_${localTitle ? locale : "en"}.html`,
        thumbnail: `${base}-128.png`,
      });
    }
  }
  return sims;
}

async function fetchMetadata(locale) {
  const upstream = await fetchUpstream(`${METADATA_URL}&locale=${locale}`);
  if (!upstream.ok) {
    const err = new Error(`PhET returned HTTP ${upstream.status}.`);
    err.upstreamStatus = upstream.status;
    throw err;
  }
  return JSON.parse(upstream.text);
}

export default async function handler(req, res) {
  if (applyApiCors(req, res, "GET, OPTIONS")) return;
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  const locale = readQueryParam(req, "locale") === "vi" ? "vi" : "en";
  const cacheKey = `phet:${locale}`;
  const send = (payload) => {
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json(payload);
  };

  const cached = readCache(cacheKey);
  if (cached) return send(cached);
  if (!catalogRateLimitOk(req)) {
    return res.status(429).json({ error: "Too many requests. Wait a minute.", code: "rate_limited" });
  }

  try {
    const [english, localized] = await Promise.all([
      fetchMetadata("en"),
      // Translated titles are optional: the catalog still works in English without them.
      locale === "en" ? null : fetchMetadata(locale).catch(() => null),
    ]);
    const sims = toPhetCatalog(english, localized, locale);
    if (sims.length === 0) {
      return res.status(502).json({ error: "PhET sent an empty catalog.", code: "upstream_error" });
    }
    const payload = { sims, fetchedAt: new Date().toISOString() };
    writeCache(cacheKey, payload, CACHE_TTL_MS);
    return send(payload);
  } catch (err) {
    if (err?.upstreamStatus) return sendUpstreamStatus(res, "PhET", err.upstreamStatus);
    return sendUpstreamFailure(res, "PhET", err);
  }
}
