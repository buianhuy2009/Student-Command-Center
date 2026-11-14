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
import handleGoogleExchange from "./auth/google/exchange.js";
import handleGoogleRefresh from "./auth/google/refresh.js";

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
  ["/auth/google/exchange", handleGoogleExchange],
  ["/auth/google/refresh", handleGoogleRefresh],
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
