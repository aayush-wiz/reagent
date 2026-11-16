/**
 * routes/sessions.ts — chat sessions inside a research.
 *
 *   GET  /api/researches/:id/sessions            → list the research's sessions
 *   POST /api/researches/:id/sessions            → create a new session
 *   GET  /api/sessions/:sid/messages             → a session's message thread
 */
import type { Hono } from "hono";
import { listSessions, createSession, getSession, sessionMessages, sessionUsage, touchSession } from "../services/sessions.ts";
import { getResearch } from "../services/researches.ts";
import { contextWindow } from "../libs/llm.ts";

export function registerSessionRoutes(app: Hono): void {
  app.get("/api/researches/:id/sessions", (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    return c.json({ sessions: listSessions(c.req.param("id")) });
  });

  app.post("/api/researches/:id/sessions", async (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { title?: string; agent?: string };
    const session = createSession(c.req.param("id"), body);
    return c.json({ session }, 201);
  });

  // Resolve a session → its research (the chat home opens /chat/:sessionId and
  // needs to know which research the session belongs to).
  app.get("/api/sessions/:sid", (c) => {
    const session = getSession(c.req.param("sid"));
    if (!session) return c.json({ error: "not found" }, 404);
    const research = getResearch(session.researchId);
    return c.json({ session, research });
  });

  app.get("/api/sessions/:sid/messages", (c) => {
    if (!getSession(c.req.param("sid"))) return c.json({ error: "not found" }, 404);
    return c.json({ messages: sessionMessages(c.req.param("sid")) });
  });

  // Context usage: the session's REAL token usage (provider-reported, from the
  // latest turn) vs the model's live window — drives the composer's "context used"
  // indicator. `real` is false only before the first turn (pre-run estimate).
  app.get("/api/sessions/:sid/usage", async (c) => {
    if (!getSession(c.req.param("sid"))) return c.json({ error: "not found" }, 404);
    const limit = await contextWindow(c.req.query("model") || undefined);
    const { tokens, real } = sessionUsage(c.req.param("sid"));
    return c.json({ tokens, limit, real });
  });

  // Mark a session as just-used (last-used ordering).
  app.post("/api/sessions/:sid/touch", (c) => {
    if (!getSession(c.req.param("sid"))) return c.json({ error: "not found" }, 404);
    touchSession(c.req.param("sid"));
    return c.json({ ok: true });
  });
}
