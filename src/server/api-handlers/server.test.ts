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
import { SERVER_MODELS, COACH_MODE_MODELS } from "./gemini/models.js";
import { resetRateLimitsForTest } from "./gemini/generate.js";
import handleAssistant from "./gemini/assistant.js";
import handleQuickDraft from "./gemini/quick-draft.js";
import handleExtractSubtasks from "./gemini/extract-subtasks.js";
import handleEstimateEffort from "./gemini/estimate-effort.js";
import handleSuggestStudySlots from "./gemini/suggest-study-slots.js";
import handleGenerate from "./gemini/generate.js";
import handleHealth from "./health.js";
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
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it("removes nonexistent Gemini model IDs and keeps valid models", () => {
    expect(SERVER_MODELS).not.toContain("gemini-3.5-flash");
    expect(SERVER_MODELS).not.toContain("gemini-3.8-flash");
    expect(SERVER_MODELS).toContain("gemini-flash-latest");
    expect(SERVER_MODELS).toContain("gemini-2.5-flash");
    expect(SERVER_MODELS).toContain("gemini-flash-lite-latest");
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

    it("serves /api/health without nonexistent model IDs", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.models).not.toContain("gemini-3.5-flash");
      expect(data.models).not.toContain("gemini-3.8-flash");
      expect(data.models).toContain("gemini-flash-latest");
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

      const connectSrc: string[] = directives["connect-src"] || [];
      expect(connectSrc).toContain("https://export.arxiv.org");
      expect(connectSrc).toContain("https://openlibrary.org");
      expect(connectSrc).toContain("https://covers.openlibrary.org");
      expect(connectSrc).toContain("https://archive.org");
      expect(connectSrc).toContain("https://api.nasa.gov");
      expect(connectSrc).toContain("https://api.groq.com");
      expect(connectSrc).toContain("https://generativelanguage.googleapis.com");
      expect(connectSrc).toContain("https://en.wikipedia.org");
      expect(connectSrc).not.toContain("https://api.crossref.org");

      const frameSrc: string[] = directives["frame-src"] || [];
      for (const expected of [
        "https://excalidraw.com",
        "https://*.excalidraw.com",
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

  describe("AI Coach 3-mode routing", () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevGroq = process.env.GROQ_API_KEY;
    const prevFetch = globalThis.fetch;

    afterEach(() => {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
      if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = prevGroq;
      globalThis.fetch = prevFetch;
    });

    it("routes Teacher (default) to gemini-3.5-flash-lite and Professor to gemini-3.5-flash", async () => {
      expect(COACH_MODE_MODELS.teacher[0]).toBe("gemini-3.5-flash-lite");
      expect(COACH_MODE_MODELS.professor[0]).toBe("gemini-3.5-flash");

      process.env.GEMINI_API_KEY = "AIzaTestOnly";
      generateContentMock.mockResolvedValue({ text: "Coach reply" });

      const resTeacher = createMockRes();
      await handleAssistant({ method: "POST", body: { messages: [{ role: "user", content: "Hi" }] } }, resTeacher);
      expect(resTeacher.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.5-flash-lite" }));
      expect(resTeacher.body.provider).toBe("gemini");

      generateContentMock.mockClear();
      const resProf = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "professor", messages: [{ role: "user", content: "Explain Eigenvalues" }] } }, resProf);
      expect(resProf.statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.5-flash" }));
      expect(resProf.body.provider).toBe("gemini");
    });

    it("routes Fast mode explicitly to Groq", async () => {
      process.env.GROQ_API_KEY = "gsk_test_only";
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Groq fast reply" } }] }),
      } as any);
      globalThis.fetch = fetchSpy;

      const resFast = createMockRes();
      await handleAssistant({ method: "POST", body: { mode: "fast", messages: [{ role: "user", content: "Quick summary" }] } }, resFast);
      expect(resFast.statusCode).toBe(200);
      expect(resFast.body).toEqual({ reply: "Groq fast reply", mode: "fast", provider: "groq" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.groq.com/openai/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
      expect(generateContentMock).not.toHaveBeenCalled();
    });
  });
});
