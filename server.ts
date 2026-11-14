import "dotenv/config";
import express from "express";
import path from "path";
import { dispatchApiRequest } from "./src/server/api-handlers/router.js";

export async function createServerApp(options: { skipFrontend?: boolean } = {}) {
  const app = express();

  app.use(express.json({ limit: "5mb" }));

  // Return JSON 400 on malformed JSON bodies targeting /api/* instead of Express HTML error pages.
  app.use(
    "/api",
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON request body", code: "invalid_json" });
      }
      return next(err);
    }
  );

  // Canonical API router — identical route table, CORS, rate limits, and 404 JSON as api/index.js.
  app.all(["/api", "/api/*"], (req: express.Request, res: express.Response) => {
    return dispatchApiRequest(req, res);
  });

  if (!options.skipFrontend) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req: express.Request, res: express.Response) => {
        if (req.path === "/api" || req.path.startsWith("/api/")) {
          return res.status(404).json({ error: "API endpoint not found" });
        }
        return res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  return app;
}

async function startServer() {
  const app = await createServerApp();
  const PORT = Number(process.env.PORT) || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Student Command Center Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
