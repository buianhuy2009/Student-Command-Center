import { applyApiCors } from "./cors.js";
import handleHealth from "./health.js";
import handleCanvasProxy from "./canvas/proxy.js";
import handleAssistant from "./gemini/assistant.js";
import handleParseAssignment from "./gemini/parse-assignment.js";
import handleSummarizeEmails from "./gemini/summarize-emails.js";
import handleQuickDraft from "./gemini/quick-draft.js";
import handleExtractSubtasks from "./gemini/extract-subtasks.js";
import handleEstimateEffort from "./gemini/estimate-effort.js";
import handleSuggestStudySlots from "./gemini/suggest-study-slots.js";
import handleGenerate from "./gemini/generate.js";
import handleExtractNotes from "./gemini/extract-notes.js";
import handleTranscribeAudio from "./gemini/transcribe-audio.js";
import handleSummarizeLecture from "./gemini/summarize-lecture.js";
import handleGoogleExchange from "./auth/google/exchange.js";
import handleGoogleRefresh from "./auth/google/refresh.js";
import handleDailyReport from "./reports/daily.js";
import handleArxivSearch from "./catalog/arxiv.js";
import handleOpenLibrarySearch from "./catalog/open-library.js";
import handlePhetCatalog from "./catalog/phet.js";

export const API_ROUTES = new Map([
  ["/health", handleHealth],
  ["/canvas/proxy", handleCanvasProxy],
  ["/gemini/assistant", handleAssistant],
  ["/gemini/parse-assignment", handleParseAssignment],
  ["/gemini/summarize-emails", handleSummarizeEmails],
  ["/gemini/quick-draft", handleQuickDraft],
  ["/gemini/extract-subtasks", handleExtractSubtasks],
  ["/gemini/estimate-effort", handleEstimateEffort],
  ["/gemini/suggest-study-slots", handleSuggestStudySlots],
  ["/gemini/generate", handleGenerate],
  ["/gemini/extract-notes", handleExtractNotes],
  ["/gemini/transcribe-audio", handleTranscribeAudio],
  ["/gemini/summarize-lecture", handleSummarizeLecture],
  ["/auth/google/exchange", handleGoogleExchange],
  ["/auth/google/refresh", handleGoogleRefresh],
  ["/reports/daily", handleDailyReport],
  ["/catalog/arxiv", handleArxivSearch],
  ["/catalog/open-library", handleOpenLibrarySearch],
  ["/catalog/phet", handlePhetCatalog],
]);

export function resolveApiPath(req) {
  const rawUrl = req?.headers?.["x-matched-path"] || req?.originalUrl || req?.url || "";
  let cleanPath = String(rawUrl).split("?")[0].replace(/^\/api(?=\/|$)/, "") || "/";
  if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
    cleanPath = cleanPath.slice(0, -1);
  }
  return cleanPath;
}

export async function dispatchApiRequest(req, res) {
  if (applyApiCors(req, res)) return;

  const cleanPath = resolveApiPath(req);

  if (cleanPath === "" || cleanPath === "/" || cleanPath === "/index") {
    // After the vercel.json rewrite /api/(.*) -> /api/index, nested routes
    // arrive here as /api/index?url=... with the original path rewritten away.
    // A `url` query param always means Canvas proxy (health never has one).
    if (req?.query?.url) return handleCanvasProxy(req, res);
    return handleHealth(req, res);
  }

  const routeHandler = API_ROUTES.get(cleanPath);
  if (routeHandler) {
    return routeHandler(req, res);
  }

  return res.status(404).json({ error: "API endpoint not found" });
}
