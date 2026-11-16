/**
 * routes/results.ts — aggregated Reports & Results across ALL researches.
 *
 *   GET /api/results → every document + workspace file the agent generated,
 *                      each tagged with the research it came from, so the
 *                      Reports tab can list them and open/download each.
 */
import type { Hono } from "hono";
import { listResearches } from "../services/researches.ts";
import { listDocuments } from "../services/documents.ts";
import { listWorkspaceFiles } from "../services/workspace-files.ts";

export function registerResultRoutes(app: Hono): void {
  app.get("/api/results", async (c) => {
    const researches = listResearches(c.get("userId"));

    const documents: {
      researchId: string;
      researchTitle: string;
      name: string;
      title: string;
      chars: number;
      updatedAt: number;
    }[] = [];
    const files: {
      researchId: string;
      researchTitle: string;
      path: string;
      category: "chart" | "table" | "file";
      ext: string;
      size: number;
      updatedAt: number;
    }[] = [];

    for (const r of researches) {
      for (const d of listDocuments(r.id)) {
        if (!d.content || !d.content.trim()) continue; // skip empty docs
        documents.push({ researchId: r.id, researchTitle: r.title, name: d.name, title: d.title, chars: d.content.length, updatedAt: d.updatedAt });
      }
      const wf = await listWorkspaceFiles(r.id).catch(() => []);
      for (const f of wf) {
        files.push({ researchId: r.id, researchTitle: r.title, path: f.path, category: f.category, ext: f.ext, size: f.size, updatedAt: f.updatedAt });
      }
    }

    documents.sort((a, b) => b.updatedAt - a.updatedAt);
    files.sort((a, b) => b.updatedAt - a.updatedAt);
    return c.json({ documents, files });
  });
}
