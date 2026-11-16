/**
 * backend/src/server.ts — Hono entry point.
 *
 *   Wiring harness. Route handlers live in routes/*.ts; each module exports
 *   a `register…Routes(app)` function called below. Business logic lives in
 *   services/, DB access in repositories/, schemas in models/, 3rd-party
 *   wrappers in libs/.
 *
 *   Boot order:
 *     1. Bootstrap DB (create-if-missing) + seed demo data
 *     2. Register /api/* route groups
 *     3. (Production) serve the built React bundle from dist/
 *     4. Start the Hono server
 *
 *   In dev (npm run dev): Vite serves the SPA and proxies /api → :8181.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { env } from "./env.ts";
import { log, requestLogger } from "./libs/logger.ts";

// Importing the db client runs the idempotent bootstrap.
import "./repositories/db-client.ts";
import { seedIfEmpty } from "./services/seed.ts";

import { authMiddleware } from "./middlewares/auth.ts";
import { rateLimit } from "./middlewares/rate-limit.ts";
import { ownsResearch, ownsSession, ownsTask, ownsPaper } from "./services/ownership.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerHealthRoute } from "./routes/health.ts";
import { registerResearchRoutes } from "./routes/researches.ts";
import { registerSessionRoutes } from "./routes/sessions.ts";
import { registerChatRoutes } from "./routes/chat.ts";
import { registerDocumentRoutes } from "./routes/documents.ts";
import { registerWorkspaceRoutes } from "./routes/workspace.ts";
import { registerPaperRoutes } from "./routes/papers.ts";
import { registerAgentRoutes } from "./routes/agent.ts";
import { registerCatalogRoutes } from "./routes/catalog.ts";
import { registerToolRoutes } from "./routes/tools.ts";
import { registerFindingRoutes } from "./routes/findings.ts";
import { registerTaskRoutes } from "./routes/tasks.ts";
import { registerResultRoutes } from "./routes/results.ts";
import { registerSiteRoutes } from "./routes/sites.ts";
import { registerArticleRoutes } from "./routes/articles.ts";
import { attachRunWebSocket } from "./ws/run-socket.ts";
import type { Server } from "node:http";

await seedIfEmpty();

const app = new Hono();
app.use("*", requestLogger);
app.use("/api/*", cors());
// Inbound rate limit (before auth, so it also throttles login brute-force).
app.use("/api/*", rateLimit);
// Gate every /api/* route behind a bearer token (except /api/auth + /api/health).
app.use("/api/*", authMiddleware);

// ---- Ownership guards (multi-tenant IDOR prevention) ----
// Any resource addressed by id is checked against the authed user; a resource
// owned by someone else answers 404 (never leak existence). These cover every
// nested by-id route in one place so no handler can forget the check.
const notFound = (c: import("hono").Context) => c.json({ error: "not found" }, 404);
app.use("/api/researches/:id/*", async (c, next) =>
  ownsResearch(c.get("userId"), c.req.param("id")) ? next() : notFound(c),
);
const sessionGuard = async (c: import("hono").Context, next: () => Promise<void>) =>
  ownsSession(c.get("userId"), c.req.param("sid")) ? next() : notFound(c);
app.use("/api/sessions/:sid", sessionGuard);
app.use("/api/sessions/:sid/*", sessionGuard);
const taskGuard = async (c: import("hono").Context, next: () => Promise<void>) =>
  ownsTask(c.get("userId"), c.req.param("id")) ? next() : notFound(c);
app.use("/api/tasks/:id", taskGuard);
app.use("/api/tasks/:id/*", taskGuard);
app.use("/api/papers/:id/*", async (c, next) =>
  ownsPaper(c.get("userId"), c.req.param("id")) ? next() : notFound(c),
);

registerHealthRoute(app);
registerAuthRoutes(app);
registerResearchRoutes(app);
registerSessionRoutes(app);
registerChatRoutes(app);
registerDocumentRoutes(app);
registerWorkspaceRoutes(app);
registerPaperRoutes(app);
registerAgentRoutes(app);
registerCatalogRoutes(app);
registerToolRoutes(app);
registerFindingRoutes(app);
registerTaskRoutes(app);
registerResultRoutes(app);
registerSiteRoutes(app);
registerArticleRoutes(app);

// Production: serve the built SPA. In dev, Vite owns this.
if (env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("/*", serveStatic({ path: "./dist/index.html" }));
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info(`Reagent API listening on http://localhost:${info.port}`);
  log.info(`Subagent model: ${process.env.REAGENT_SUBAGENT_MODEL || "(inherits primary)"}`);
});

// Attach the run WebSocket relay to the same HTTP server (path /api/runs/:id/ws).
attachRunWebSocket(server as unknown as Server);
