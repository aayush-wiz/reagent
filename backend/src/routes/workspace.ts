/**
 * routes/workspace.ts — the research compute workspace + public library API.
 *
 *   GET  /api/researches/:id/files             → real files the agent produced
 *   GET  /api/researches/:id/file?path=…        → read one file (text or image)
 *   GET  /api/library/public                     → the shared public paper pool
 *   POST /api/researches/:id/library/add         → add public papers to a research
 */
import type { Hono } from "hono";
import { listWorkspaceFiles, readWorkspaceFile, readWorkspaceFileRaw } from "../services/workspace-files.ts";
import { listPublicPapers, addPublicPapersToResearch } from "../services/library.ts";
import { getResearch, getPapers } from "../services/researches.ts";

export function registerWorkspaceRoutes(app: Hono): void {
  app.get("/api/researches/:id/files", async (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    return c.json({ files: await listWorkspaceFiles(c.req.param("id")) });
  });

  app.get("/api/researches/:id/file", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const file = await readWorkspaceFile(c.req.param("id"), path).catch(() => null);
    if (!file) return c.json({ error: "not found" }, 404);
    return c.json({ file });
  });

  // Raw binary download (PDF reports, images, archives). `?dl=1` forces a download.
  app.get("/api/researches/:id/file/raw", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const file = await readWorkspaceFileRaw(c.req.param("id"), path).catch(() => null);
    if (!file) return c.json({ error: "not found" }, 404);
    const disposition = c.req.query("dl") ? "attachment" : "inline";
    return c.body(file.buffer, 200, {
      "Content-Type": file.mime,
      "Content-Disposition": `${disposition}; filename="${file.name}"`,
      "Content-Length": String(file.buffer.length),
    });
  });

  app.get("/api/library/public", (c) => c.json({ papers: listPublicPapers() }));

  app.post("/api/researches/:id/library/add", async (c) => {
    if (!getResearch(c.req.param("id"))) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { keys?: string[] };
    const added = addPublicPapersToResearch(c.req.param("id"), body.keys ?? []);
    return c.json({ added, papers: getPapers(c.req.param("id")) });
  });
}
