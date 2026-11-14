// Single-function API router (api/index.js is the ONLY file under api/ by design).
// Vercel Hobby allows max 12 Serverless Functions per deployment; 13 file-routed
// handlers failed every deploy at "Deploying outputs..." with no build error
// (see dpl_29g1j9oUm, 2026-09-06). Handler implementations live in
// src/server/api-handlers/* (bundled into this one function via nft) so the
// route table, CORS, rate limits, and 404 responses stay identical to server.ts.
import { dispatchApiRequest } from "../src/server/api-handlers/router.js";

export default async function handler(req, res) {
  return dispatchApiRequest(req, res);
}
