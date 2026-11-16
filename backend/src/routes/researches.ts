/**
 * routes/researches.ts — research workspace API.
 *
 *   GET   /api/researches            → list (home tables)
 *   POST  /api/researches            → create
 *   GET   /api/researches/:id        → full workspace (research + papers + messages + findings + outputs)
 *   POST  /api/researches/:id/messages     → append a chat turn, returns messages
 *   PATCH /api/papers/:id/toggle           → toggle a paper's selected state
 */
import type { Hono } from "hono";
import {
  listResearches,
  createResearch,
  getWorkspace,
  addMessage,
  togglePaperSelected,
} from "../services/researches.ts";

export function registerResearchRoutes(app: Hono): void {
  app.get("/api/researches", (c) => c.json({ researches: listResearches(c.get("userId")) }));

  app.post("/api/researches", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const research = createResearch({ title: String(body.title ?? ""), meta: body.meta, userId: c.get("userId") });
    return c.json({ research }, 201);
  });

  app.get("/api/researches/:id", (c) => {
    const ws = getWorkspace(c.req.param("id"), c.get("userId"));
    if (!ws) return c.json({ error: "not found" }, 404);
    return c.json(ws);
  });

  app.post("/api/researches/:id/messages", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim();
    if (!text) return c.json({ error: "text required" }, 400);
    return c.json({ messages: addMessage(c.req.param("id"), { text }) });
  });

  app.patch("/api/papers/:id/toggle", (c) => {
    const paper = togglePaperSelected(c.req.param("id"));
    if (!paper) return c.json({ error: "not found" }, 404);
    return c.json({ paper });
  });
}
