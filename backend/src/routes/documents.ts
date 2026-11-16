/**
 * routes/documents.ts — the per-research working documents API.
 *
 *   GET  /api/researches/:id/documents          → list (canonical slots + extras)
 *   GET  /api/researches/:id/documents/:name     → one document's Markdown
 *   PUT  /api/researches/:id/documents/:name     → create/replace (manual edits)
 */
import type { Hono } from "hono";
import { documentsForUI, getDocument, writeDocument } from "../services/documents.ts";
import { getResearch } from "../services/researches.ts";

export function registerDocumentRoutes(app: Hono): void {
  app.get("/api/researches/:id/documents", (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    return c.json({ documents: documentsForUI(c.req.param("id")) });
  });

  app.get("/api/researches/:id/documents/:name", (c) => {
    const doc = getDocument(c.req.param("id"), c.req.param("name"));
    if (!doc) return c.json({ error: "not found" }, 404);
    return c.json({ document: doc });
  });

  app.put("/api/researches/:id/documents/:name", async (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { content?: string; title?: string };
    const doc = writeDocument(c.req.param("id"), c.req.param("name"), String(body.content ?? ""), body.title);
    return c.json({ document: doc });
  });
}
