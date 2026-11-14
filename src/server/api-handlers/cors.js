// Shared CORS headers for every API handler (Vercel serverless + local Express).

export const API_CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
export const API_CORS_HEADERS = "Content-Type, Authorization, x-canvas-token, Accept";

/**
 * Set standard API CORS headers and short-circuit OPTIONS preflight requests.
 * Returns true when an OPTIONS response was sent and the caller should return.
 */
export function applyApiCors(req, res, methods = API_CORS_METHODS) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", API_CORS_HEADERS);
  if (req && req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
