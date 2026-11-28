// @vitest-environment node
import fs from "fs";
import path from "path";
import http from "http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };
  },
}));

import apiIndexHandler from "../../../api/index.js";
import { createServerApp } from "../../../server.ts";
import {
  ALLOWED_GEMINI_MODELS,
  SERVER_MODELS,
  COACH_MODE_MODELS,
  EMAIL_FAST_MODELS,
  VISION_CHEAPEST_MODELS,
  resetModelCooldownsForTest,
} from "./gemini/models.js";
import { resetRateLimitsForTest } from "./gemini/generate.js";
import handleAssistant from "./gemini/assistant.js";
import handleExtractNotes from "./gemini/extract-notes.js";
import handleSummarizeEmails from "./gemini/summarize-emails.js";
import handleQuickDraft from "./gemini/quick-draft.js";
import handleExtractSubtasks from "./gemini/extract-subtasks.js";
import handleEstimateEffort from "./gemini/estimate-effort.js";
import handleSuggestStudySlots from "./gemini/suggest-study-slots.js";
import handleGenerate from "./gemini/generate.js";
import handleHealth from "./health.js";
import handleDailyReport from "./reports/daily.js";
import { resolveServerGoogleOAuthConfig } from "./auth/google/oauthConfig.js";

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    ended: false,
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    getHeader(k: string) {
      return headers[k.toLowerCase()];
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      res.ended = true;
      return res;
    },
    send(payload: any) {
      res.body = payload;
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

describe("Server models & unified API surface", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    generateContentMock.mockReset();
    resetRateLimitsForTest();
    resetModelCooldownsForTest();
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it("uses only the allowed Gemini/Gemma models and never calls TTS or unapproved aliases", () => {
    expect(SERVER_MODELS).not.toContain("gemini-3.5-flash");
    expect(SERVER_MODELS).not.toContain("gemini-3.8-flash-tts");
    expect(SERVER_MODELS).not.toContain("gemini-3.8-flash-lite-tts");
    expect(SERVER_MODELS).not.toContain("gemini-flash-latest");
    expect(SERVER_MODELS).not.toContain("gemini-2.5-flash");
    expect(SERVER_MODELS).not.toContain("gemini-flash-lite-latest");
    for (const m of SERVER_MODELS) {
      expect(ALLOWED_GEMINI_MODELS).toContain(m);
    }
    expect(SERVER_MODELS).toContain("gemini-3-flash-preview");
    expect(SERVER_MODELS).toContain("gemini-3.1-flash-lite");
    expect(SERVER_MODELS).toContain("gemini-3.6-flash");
    expect(SERVER_MODELS).toContain("gemini-3.5-flash-lite");
    expect(SERVER_MODELS).toContain("gemini-3.8-flash");
    expect(SERVER_MODELS).toContain("gemma-4-31b-it");
    expect(SERVER_MODELS).toContain("gemma-4-26b-a4b-it");
  });

  it("removes dead app.ts and duplicate handlers.ts", () => {
    expect(fs.existsSync(path.resolve(process.cwd(), "src/server/app.ts"))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), "src/server/handlers.ts"))).toBe(false);
  });

  describe("Express server.ts parity with api/index.js", () => {
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
      const app = await createServerApp({ skipFrontend: true });
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("serves /api/health with only allowed model IDs", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.models).not.toContain("gemini-3.5-flash");
      expect(data.models).not.toContain("gemini-3.8-flash-tts");
      expect(data.models).not.toContain("gemini-flash-latest");
      expect(data.models).toContain("gemini-3-flash-preview");
    });

    it("includes x-canvas-token in CORS Allow-Headers on OPTIONS", async () => {
      const res = await fetch(`${baseUrl}/api/canvas/proxy`, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      const allowHeaders = res.headers.get("access-control-allow-headers") || "";
      expect(allowHeaders.toLowerCase()).toContain("x-canvas-token");
    });

    it("mounts /api/auth/google/exchange and /api/auth/google/refresh", async () => {
      const exRes = await fetch(`${baseUrl}/api/auth/google/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(exRes.status).toBe(400);
      expect(await exRes.json()).toEqual({ error: "Missing authorization code" });

      const rfRes = await fetch(`${baseUrl}/api/auth/google/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(rfRes.status).toBe(400);
      expect(await rfRes.json()).toEqual({ error: "Missing refresh_token" });

      const badMethod = await fetch(`${baseUrl}/api/auth/google/exchange`, { method: "GET" });
      expect(badMethod.status).toBe(405);
    });

    it("returns 404 JSON (never HTML) for unmatched /api/* routes including assistant-stream", async () => {
      const streamRes = await fetch(`${baseUrl}/api/gemini/assistant-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      });
      expect(streamRes.status).toBe(404);
      expect(streamRes.headers.get("content-type")).toContain("application/json");
      expect(await streamRes.json()).toEqual({ error: "API endpoint not found" });

      const unknownGet = await fetch(`${baseUrl}/api/nonexistent/route`);
      expect(unknownGet.status).toBe(404);
      expect(unknownGet.headers.get("content-type")).toContain("application/json");
      expect(await unknownGet.json()).toEqual({ error: "API endpoint not found" });
    });

    it("enforces strict Canvas proxy SSRF allowlist and returns host-not-allowlisted", async () => {
      const res = await fetch(
        `${baseUrl}/api/canvas/proxy?url=${encodeURIComponent("https://evil.example.com/api/v1/courses")}`
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("host-not-allowlisted");
      expect(body.code).toBe("host-not-allowlisted");
      expect(body.host).toBe("evil.example.com");

      const metaRes = await fetch(
        `${baseUrl}/api/canvas/proxy?url=${encodeURIComponent("http://169.254.169.254/latest/meta-data")}`
      );
      expect(metaRes.status).toBe(400);
      const metaBody = await metaRes.json();
      expect(metaBody.error).toBe("host-not-allowlisted");
      expect(metaBody.host).toBe("169.254.169.254");
    });

    it("returns 400 JSON on malformed JSON body to /api/*", async () => {
      const res = await fetch(`${baseUrl}/api/gemini/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      });
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("Vercel api/index.js parity", () => {
    it("handles CORS OPTIONS, Google auth routes, Canvas rewrite, and 404 JSON identically", async () => {
      const optRes = createMockRes();
      await apiIndexHandler({ method: "OPTIONS", url: "/api/canvas/proxy", headers: {} }, optRes);
      expect(optRes.statusCode).toBe(200);
      expect(optRes.headers["access-control-allow-headers"].toLowerCase()).toContain("x-canvas-token");

      const exRes = createMockRes();
      await apiIndexHandler({ method: "POST", url: "/api/auth/google/exchange", body: {}, headers: {} }, exRes);
      expect(exRes.statusCode).toBe(400);
      expect(exRes.body).toEqual({ error: "Missing authorization code" });

      const rfRes = createMockRes();
      await apiIndexHandler({ method: "POST", url: "/api/auth/google/refresh", body: {}, headers: {} }, rfRes);
      expect(rfRes.statusCode).toBe(400);
      expect(rfRes.body).toEqual({ error: "Missing refresh_token" });

      const missRes = createMockRes();
      await apiIndexHandler({ method: "POST", url: "/api/gemini/assistant-stream", body: {}, headers: {} }, missRes);
      expect(missRes.statusCode).toBe(404);
      expect(missRes.body).toEqual({ error: "API endpoint not found" });

      const rewriteProxyRes = createMockRes();
      await apiIndexHandler(
        {
          method: "GET",
          url: "/api/index",
          query: { url: "https://moodle.school.edu/calendar.ics" },
          headers: {},
        },
        rewriteProxyRes
      );
      expect(rewriteProxyRes.statusCode).toBe(400);
      expect(rewriteProxyRes.body.error).toBe("host-not-allowlisted");
      expect(rewriteProxyRes.body.host).toBe("moodle.school.edu");
    });
  });

  describe("Gemini endpoints never return HTTP 200 fabricated payloads on AI failure", () => {
    it("returns 503 when GEMINI_API_KEY is missing across all 5 endpoints", async () => {
      delete process.env.GEMINI_API_KEY;
      generateContentMock.mockRejectedValue(new Error("API key missing"));

      const cases: Array<[any, Record<string, any>]> = [
        [handleAssistant, { messages: [{ role: "user", content: "Help me study" }] }],
        [handleQuickDraft, { topic: "Lab 2", course: "Physics" }],
        [handleExtractSubtasks, { assignmentName: "Lab Report" }],
        [handleEstimateEffort, { assignments: [{ id: "1", assignmentName: "Essay", dueDate: "2026-12-01" }] }],
        [handleSuggestStudySlots, { existingEvents: [], pendingTasks: [{ assignmentName: "Read ch 1" }] }],
      ];

      for (const [handler, body] of cases) {
        const res = createMockRes();
        await handler({ method: "POST", body, headers: {} }, res);
        expect(res.statusCode).toBe(503);
        expect(res.body).toMatchObject({
          error: expect.any(String),
          code: "ai_not_configured",
        });
      }
    });

    it("returns 502 when GEMINI_API_KEY is set and all upstream Gemini models fail", async () => {
      process.env.GEMINI_API_KEY = "test-key-not-real";
      generateContentMock.mockRejectedValue(new Error("Upstream 500 internal error"));

      const cases: Array<[any, Record<string, any>]> = [
        [handleAssistant, { messages: [{ role: "user", content: "Explain Newton's 2nd law" }] }],
        [handleQuickDraft, { topic: "Extension", course: "History" }],
        [handleExtractSubtasks, { assignmentName: "Research Paper" }],
        [handleEstimateEffort, { assignments: [{ id: "1", assignmentName: "Quiz Prep", dueDate: "2026-12-01" }] }],
        [handleSuggestStudySlots, { existingEvents: [], pendingTasks: [{ assignmentName: "Math HW" }] }],
      ];

      for (const [handler, body] of cases) {
        const res = createMockRes();
        await handler({ method: "POST", body, headers: {} }, res);
        expect(res.statusCode).toBe(502);
        expect(res.body).toMatchObject({
          error: expect.any(String),
          code: "ai_upstream_failed",
        });
      }
    });

    it("enforces 15/min per-IP rate limiting on /api/gemini/generate", async () => {
      process.env.GEMINI_API_KEY = "test-key-not-real";
      generateContentMock.mockResolvedValue({ text: "ok" });

      for (let i = 0; i < 15; i++) {
        const res = createMockRes();
        await handleGenerate({ method: "POST", body: { contents: "hi" }, headers: {}, ip: "10.0.0.42" }, res);
        expect(res.statusCode).toBe(200);
      }

      const blocked = createMockRes();
      await handleGenerate({ method: "POST", body: { contents: "hi" }, headers: {}, ip: "10.0.0.42" }, blocked);
      expect(blocked.statusCode).toBe(429);
      expect(blocked.body.code).toBe("rate_limited");
    });
  });

  describe("vercel.json CSP cleanup", () => {
    it("updates connect-src and frame-src with apex + wildcard surviving embeds and removes unused domains", () => {
      const raw = fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8");
      const config = JSON.parse(raw);
      const globalHeaders = config.headers.find((h: any) => h.source === "/(.*)")?.headers || [];
      const csp = globalHeaders.find((h: any) => h.key === "Content-Security-Policy")?.value || "";

      const directives = Object.fromEntries(
        csp
          .split(";")
          .map((d: string) => d.trim())
          .filter(Boolean)
          .map((d: string) => {
            const [name, ...vals] = d.split(/\s+/);
            return [name, vals];
          })
      );

      const mediaSrc: string[] = directives["media-src"] || [];
      expect(mediaSrc).toEqual(expect.arrayContaining(["'self'", "blob:", "data:"]));

      const connectSrc: string[] = directives["connect-src"] || [];
      expect(connectSrc).toContain("https://export.arxiv.org");
      expect(connectSrc).toContain("https://openlibrary.org");
      expect(connectSrc).toContain("https://covers.openlibrary.org");
      expect(connectSrc).toContain("https://archive.org");
      expect(connectSrc).toContain("https://api.nasa.gov");
      expect(connectSrc).not.toContain("https://api.groq.com");
      expect(connectSrc).toContain("https://generativelanguage.googleapis.com");
      expect(connectSrc).toContain("https://en.wikipedia.org");
      expect(connectSrc).not.toContain("https://api.crossref.org");

      const frameSrc: string[] = directives["frame-src"] || [];
      for (const expected of [
        "https://phet.colorado.edu",
        "https://*.phet.colorado.edu",
        "https://geogebra.org",
        "https://*.geogebra.org",
        "https://desmos.com",
        "https://*.desmos.com",
        "https://openlibrary.org",
        "https://*.openlibrary.org",
        "https://arxiv.org",
        "https://*.arxiv.org",
        "https://*.google.com",
        "https://*.firebaseapp.com",
      ]) {
        expect(frameSrc).toContain(expected);
      }

      for (const removed of [
        "https://excalidraw.com",
        "https://*.excalidraw.com",
        "https://*.notion.so",
        "https://*.figma.com",
        "https://*.wolframalpha.com",
        "https://*.canva.com",
      ]) {
        expect(frameSrc).not.toContain(removed);
      }

      const coop = globalHeaders.find((h: any) => h.key === "Cross-Origin-Opener-Policy")?.value || "";
      expect(coop).toBe("same-origin-allow-popups");
    });
  });

  describe("Google OAuth server config & health readiness", () => {
    const prevViteClientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const prevServerClientId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;

    afterEach(() => {
      if (prevViteClientId === undefined) delete process.env.VITE_GOOGLE_CLIENT_ID;
      else process.env.VITE_GOOGLE_CLIENT_ID = prevViteClientId;
      if (prevServerClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevServerClientId;
      if (prevSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    });

    it("falls back to firebase-applet-config.json oAuthClientId and gates isConfigured on GOOGLE_CLIENT_SECRET", async () => {
      delete process.env.VITE_GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const withoutSecret = resolveServerGoogleOAuthConfig();
      expect(withoutSecret.clientId).toMatch(/\.apps\.googleusercontent\.com$/);
      expect(withoutSecret.clientSecret).toBe("");
      expect(withoutSecret.isConfigured).toBe(false);

      const healthOff = createMockRes();
      await handleHealth({ method: "GET", headers: {} }, healthOff);
      expect(healthOff.statusCode).toBe(200);
      expect(healthOff.body.hasGoogleOAuth).toBe(false);

      process.env.GOOGLE_CLIENT_SECRET = "GOCSPX-test-only-never-real";
      const withSecret = resolveServerGoogleOAuthConfig();
      expect(withSecret.isConfigured).toBe(true);

      const healthOn = createMockRes();
      await handleHealth({ method: "GET", headers: {} }, healthOn);
      expect(healthOn.statusCode).toBe(200);
      expect(healthOn.body.hasGoogleOAuth).toBe(true);
      expect(JSON.stringify(healthOn.body)).not.toContain("GOCSPX-test-only-never-real");
    });
  });

  describe("AI Coach 4-tier routing, email fast group, note scanner & limit rotation", () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevFetch = globalThis.fetch;

    afterEach(() => {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
      globalThis.fetch = prevFetch;
    });

    it("routes Instant (quick), Balanced, Scholar (reasoning), and Mastery (apex) to their exact model tiers", async () => {
      expect(COACH_MODE_MODELS.quick).toEqual(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);
      expect(COACH_MODE_MODELS.balanced).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
      expect(COACH_MODE_MODELS.reasoning).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
      expect(COACH_MODE_MODELS.apex).toEqual(["gemini-3.8-flash"]);

      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      generateContentMock.mockResolvedValue({ text: "Coach reply" });

      const resBalanced = createMockRes();
      await handleAssistant({ method: "POST", body: { messages: [{ role: "user", content: "Hi" }] } }, resBalanced);
      expect(resBalanced.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3-flash-preview" }));

      generateContentMock.mockClear();
      const resReasoning = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "reasoning", messages: [{ role: "user", content: "Explain Eigenvalues" }] } }, resReasoning);
      expect(resReasoning.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.6-flash" }));

      generateContentMock.mockClear();
      const resApex = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "apex", messages: [{ role: "user", content: "Prove convergence" }] } }, resApex);
      expect(resApex.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.8-flash" }));

      generateContentMock.mockClear();
      const resQuick = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "quick", messages: [{ role: "user", content: "Quick tip" }] } }, resQuick);
      expect(resQuick.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemma-4-31b-it" }));
    });

    it("rotates away from a rate-limited model and falls back to Gemini Balanced in Instant mode", async () => {
      process.env.GEMINI_API_KEY = "AIzaTestOnly";

      // First call: Gemma 31B hits 429, rotates to Gemma 26B seamlessly.
      generateContentMock
        .mockRejectedValueOnce(Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }))
        .mockResolvedValueOnce({ text: "Gemma 26B reply" });

      const resRotated = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "quick", messages: [{ role: "user", content: "Hi" }] } }, resRotated);
      expect(resRotated.statusCode).toBe(200);
      expect(resRotated.body.model).toBe("gemma-4-26b-a4b-it");

      // Next call while 31B is cooled down starts straight on 26B; if Gemma 26B fails, Gemini Balanced answers.
      generateContentMock
        .mockRejectedValueOnce(Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }))
        .mockResolvedValueOnce({ text: "Gemini backup reply" });

      const resBackup = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "fast", messages: [{ role: "user", content: "Quick summary" }] } }, resBackup);
      expect(resBackup.statusCode).toBe(200);
      expect(resBackup.body).toEqual({
        reply: "Gemini backup reply",
        mode: "quick",
        provider: "gemini",
        model: "gemini-3-flash-preview",
        tutorPolicyEnforced: true,
        guardrailTriggered: false,
      });
    });

    it("routes email summarization through Gemini 3.5 Flash Lite with Gemma 4 31B fallback", async () => {
      expect(EMAIL_FAST_MODELS).toEqual(["gemini-3.5-flash-lite", "gemma-4-31b-it"]);
      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          alerts: [
            {
              id: "e1",
              sender: "Ms. Lan",
              subject: "Math HW",
              oneLineSummary: "Homework due tomorrow",
              urgency: "HIGH",
              category: "ASSIGNMENT",
              categoryLabel: "Bài tập",
              confidence: 0.95,
              detectedAssignment: { isAssignment: true, name: "Worksheet 2", subject: "Toán", dueDate: "2026-11-24", dueConfidence: "explicit", dueEvidence: "24/11", priority: "High" },
            },
          ],
        }),
      });

      const res = createMockRes();
      await handleSummarizeEmails({ method: "POST", body: { emails: [{ id: "e1", sender: "Ms. Lan", subject: "Math HW", body: "Submit 24/11" }] } }, res);
      expect(res.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.5-flash-lite" }));
      expect(res.body.model).toBe("gemini-3.5-flash-lite");

      // If Gemini 3.5 Flash Lite fails, it falls back to Gemma 4 31B (with JSON mode stripped), then Gemini Flash.
      generateContentMock.mockReset();
      generateContentMock
        .mockRejectedValueOnce(new Error("Flash Lite 3.5 unavailable"))
        .mockResolvedValueOnce({
          text: JSON.stringify({
            alerts: [
              {
                id: "e2",
                sender: "Mr. Minh",
                subject: "Physics Quiz",
                oneLineSummary: "Quiz Friday",
                urgency: "HIGH",
                category: "EXAM",
                categoryLabel: "Kiểm tra",
                confidence: 0.9,
              },
            ],
          }),
        });
      const resBackup = createMockRes();
      await handleSummarizeEmails({ method: "POST", body: { emails: [{ id: "e2", sender: "Mr. Minh", subject: "Physics Quiz", body: "Quiz this Friday" }] } }, resBackup);
      expect(resBackup.statusCode).toBe(200);
      const gemmaCall = generateContentMock.mock.calls[1]?.[0];
      expect(gemmaCall?.model).toBe("gemma-4-31b-it");
      expect(gemmaCall?.config?.responseMimeType).toBeUndefined();
      expect(resBackup.body.model).toBe("gemma-4-31b-it");
      expect(resBackup.body.alerts[0]).toMatchObject({ id: "e2", aiStatus: "ok", category: "EXAM" });
    });

    it("extracts text from note images using the cheapest vision-capable model group", async () => {
      expect(VISION_CHEAPEST_MODELS[0]).toBe("gemma-4-31b-it");
      expect(VISION_CHEAPEST_MODELS[1]).toBe("gemma-4-26b-a4b-it");
      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          title: "Calculus Lecture 4",
          subject: "Calculus",
          text: "# Integration by Parts\n$$\\int u\\,dv = uv - \\int v\\,du$$",
          keyTerms: ["Integration by Parts"],
        }),
      });

      const res = createMockRes();
      await handleExtractNotes(
        { method: "POST", body: { imageBase64: "ZmFrZQ==", mimeType: "image/png", formatMode: "markdown" } },
        res
      );
      expect(res.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemma-4-31b-it" }));
      expect(res.body.title).toBe("Calculus Lecture 4");
      expect(res.body.text).toContain("Integration by Parts");
    });
  });

  describe("Daily Email Report endpoint (/api/reports/daily)", () => {
    const prevResend = process.env.RESEND_API_KEY;
    const prevSmtpPass = process.env.GMAIL_APP_PASSWORD;
    const prevFetch = globalThis.fetch;

    afterEach(() => {
      if (prevResend === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevResend;
      if (prevSmtpPass === undefined) delete process.env.GMAIL_APP_PASSWORD;
      else process.env.GMAIL_APP_PASSWORD = prevSmtpPass;
      globalThis.fetch = prevFetch;
    });

    it("rejects invalid emails with 400 and returns honest preview when no transport is configured", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.GMAIL_APP_PASSWORD;

      const badRes = createMockRes();
      await handleDailyReport({ method: "POST", body: { toEmail: "not-an-email", text: "Hi" } }, badRes);
      expect(badRes.statusCode).toBe(400);

      const previewRes = createMockRes();
      await handleDailyReport(
        { method: "POST", body: { toEmail: "student@example.com", subject: "Brief", text: "Today plan" } },
        previewRes
      );
      expect(previewRes.statusCode).toBe(200);
      expect(previewRes.body.ok).toBe(true);
      expect(previewRes.body.delivered).toBe(false);
      expect(previewRes.body.transport).toBe("preview");
      expect(previewRes.body.preview.to).toBe("student@example.com");
      expect(previewRes.body.preview.from).toBe("studentos.service@gmail.com");
    });

    it("sends via Resend when RESEND_API_KEY is configured", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email_123" }),
      } as any);
      globalThis.fetch = fetchSpy;

      const okRes = createMockRes();
      await handleDailyReport(
        { method: "POST", body: { toEmail: "student@example.com", subject: "Brief", text: "Tasks today" } },
        okRes
      );
      expect(okRes.statusCode).toBe(200);
      expect(okRes.body).toEqual({
        ok: true,
        delivered: true,
        transport: "resend",
        from: "studentos.service@gmail.com",
        id: "email_123",
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("studentos.service@gmail.com"),
        })
      );
    });
  });

  describe("AI Coach Multimodal Image Support (/api/gemini/assistant)", () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevFetch = globalThis.fetch;

    beforeEach(() => {
      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      resetModelCooldownsForTest();
      resetRateLimitsForTest();
      generateContentMock.mockReset();
    });

    afterEach(() => {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
      globalThis.fetch = prevFetch;
    });

    it("forwards inlineData images on all 4 model tiers (quick, balanced, reasoning, apex)", async () => {
      for (const mode of ["quick", "balanced", "reasoning", "apex"] as const) {
        generateContentMock.mockResolvedValueOnce({ text: `Vision reply for ${mode}` });
        const res = createMockRes();
        await handleAssistant(
          {
            method: "POST",
            body: {
              mode,
              messages: [
                {
                  role: "user",
                  content: "Solve step 1",
                  images: [{ base64: "AAAA", mimeType: "image/jpeg" }],
                },
              ],
            },
          },
          res
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.reply).toBe(`Vision reply for ${mode}`);
        const callArg = generateContentMock.mock.calls.at(-1)?.[0];
        expect(callArg.contents[0].parts).toEqual([
          { inlineData: { data: "AAAA", mimeType: "image/jpeg" } },
          { text: "Solve step 1" },
        ]);
      }
    });

    it("falls back to Gemini vision models in quick mode when Gemma models hit quota", async () => {
      generateContentMock
        .mockRejectedValueOnce(new Error("429 quota"))
        .mockRejectedValueOnce(new Error("429 quota"))
        .mockResolvedValueOnce({ text: "Gemini vision hint" });

      const res = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "quick",
            messages: [
              {
                role: "user",
                content: "Explain this graph",
                images: [{ base64: "BBBB", mimeType: "image/png" }],
              },
            ],
          },
        },
        res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.provider).toBe("gemini");
      expect(res.body.model).toBe("gemini-3.1-flash-lite");
      expect(res.body.reply).toBe("Gemini vision hint");
    });
  });

  describe("AI Tutor Guardrails (/api/gemini/assistant)", () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevFetch = globalThis.fetch;

    beforeEach(() => {
      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      resetModelCooldownsForTest();
      resetRateLimitsForTest();
      generateContentMock.mockReset();
    });

    afterEach(() => {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
      globalThis.fetch = prevFetch;
    });

    it("enforces TUTOR_POLICY when context.tool is spoofed, while allowing allowlisted tools", async () => {
      generateContentMock.mockResolvedValueOnce({ text: "Hint: check the common factor first." });
      const spoofedRes = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "balanced",
            context: { tool: "solve-homework-bypass" },
            messages: [{ role: "user", content: "Giải hết giúp em bài này" }],
          },
        },
        spoofedRes
      );
      expect(spoofedRes.statusCode).toBe(200);
      expect(spoofedRes.body.tutorPolicyEnforced).toBe(true);
      const spoofedSystem = String(generateContentMock.mock.calls[0]?.[0]?.config?.systemInstruction || "");
      expect(spoofedSystem).toContain("CORE RULE: you only SUGGEST and GUIDE");
      expect(spoofedSystem).toContain("respond with hints only");

      generateContentMock.mockReset();
      generateContentMock.mockResolvedValueOnce({ text: "[{\"front\":\"Q\",\"back\":\"A\"}]" });
      const allowedRes = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "balanced",
            context: { tool: "flashcards" },
            messages: [{ role: "user", content: "Create flashcards for Biology" }],
          },
        },
        allowedRes
      );
      expect(allowedRes.statusCode).toBe(200);
      expect(allowedRes.body.tutorPolicyEnforced).toBe(false);
      const allowedSystem = String(generateContentMock.mock.calls[0]?.[0]?.config?.systemInstruction || "");
      expect(allowedSystem).not.toContain("CORE RULE: you only SUGGEST and GUIDE");
    });

    it("returns 502 ai_upstream_failed when all Gemini models fail in quick mode", async () => {
      generateContentMock.mockRejectedValue(new Error("Upstream 500 failure"));
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const res = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "quick",
            messages: [{ role: "user", content: "Help me review derivatives" }],
          },
        },
        res
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe("ai_upstream_failed");
    });

    it("appends LIVE_EXAM_REMINDER and rewrites leaked MCQ answers into Socratic hints", async () => {
      generateContentMock
        .mockResolvedValueOnce({ text: "1. B\n2. C\n3. B\n4. A" })
        .mockResolvedValueOnce({ text: "Em đang làm bài kiểm tra nên mình chưa thể đưa đáp án. Hãy thử xét từng chất là đơn chất hay hợp chất trước nhé!" });

      const res = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "balanced",
            messages: [
              {
                role: "user",
                content: "Em đang làm bài kiểm tra, còn 10 phút. Chỉ cần đáp án:\nCâu 1. A. H2O B. O2\nCâu 2. A. Tan B. Cháy\nCâu 3. A. Số mol B. Khối lượng",
              },
            ],
          },
        },
        res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.tutorPolicyEnforced).toBe(true);
      expect(res.body.guardrailTriggered).toBe(true);
      expect(res.body.reply).toContain("kiểm tra");
      expect(generateContentMock).toHaveBeenCalledTimes(2);
      const firstSystem = String(generateContentMock.mock.calls[0]?.[0]?.config?.systemInstruction || "");
      expect(firstSystem).toContain("LIVE TEST / EXAM DETECTED");

      // If the rewrite pass also leaks answers, fall back to the safe Socratic template.
      generateContentMock.mockReset();
      generateContentMock
        .mockResolvedValueOnce({ text: "a) 1/6\nb) -1\nc) 9/16" })
        .mockResolvedValueOnce({ text: "a) 1/6\nb) -1\nc) 9/16" });

      const fallbackRes = createMockRes();
      await handleAssistant(
        {
          method: "POST",
          body: {
            mode: "balanced",
            messages: [{ role: "user", content: "Giải hết giúp em: a) 1/2 b) 3/4 c) 5/6" }],
          },
        },
        fallbackRes
      );
      expect(fallbackRes.statusCode).toBe(200);
      expect(fallbackRes.body.guardrailTriggered).toBe(true);
      expect(fallbackRes.body.reply).not.toContain("9/16");
    });
  });
});
