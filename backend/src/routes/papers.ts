/**
 * routes/papers.ts — cross-journal search + import.
 *
 *   GET  /api/papers/search?q=…            → aggregated results from OpenAlex,
 *                                            Crossref, Semantic Scholar
 *   POST /api/researches/:id/papers/import → persist selected results into a
 *                                            research's library
 */
import type { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { papers, researches } from "../models/schema.ts";
import { eq } from "drizzle-orm";
import { searchPapers, type PaperResult } from "../services/paper-search.ts";
import { buildPaperMarkdown, resolvePdfUrl } from "../services/paper-content.ts";
import { desc } from "drizzle-orm";
import { log } from "../libs/logger.ts";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";

// Disk cache for fetched PDFs — answerThis's pdf_store pattern. A fully-downloaded,
// validated PDF file serves reliably to pdf.js (real Content-Length, range-able)
// where a proxied stream fails; and repeat views are instant.
const PDF_STORE = resolve(process.env.PDF_STORE_DIR || "./data/pdf_store");

/** Fetch a PDF fully, validate the %PDF header, cache to disk, return the bytes. */
async function fetchPdfBuffer(paperId: string, url: string): Promise<Buffer | null> {
  await fs.mkdir(PDF_STORE, { recursive: true });
  const file = join(PDF_STORE, `${paperId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
  try {
    const cached = await fs.readFile(file);
    if (cached.length > 1000 && cached.subarray(0, 5).toString("latin1") === "%PDF-") return cached;
  } catch {
    /* not cached yet */
  }
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "application/pdf,*/*",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    log.warn(`pdf fetch: upstream ${res.status} for ${url}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // Reject HTML challenge/login pages and anything that isn't a real PDF.
  if (buf.length < 1000 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    log.warn(`pdf fetch: not a PDF (${buf.length}b, header "${buf.subarray(0, 5).toString("latin1")}") for ${url}`);
    return null;
  }
  await fs.writeFile(file, buf).catch(() => {});
  return buf;
}

export function registerPaperRoutes(app: Hono): void {
  // Every paper across the workspace (Papers section list). Each row carries the
  // research it belongs to, and `inResearches` — how many researches hold the
  // same paper (deduped by DOI||title). A paper shared across >1 research is
  // effectively "public" (part of the shared library pool).
  app.get("/api/papers", (c) => {
    const rows = db
      .select({
        id: papers.id,
        researchId: papers.researchId,
        title: papers.title,
        byline: papers.byline,
        year: papers.year,
        venue: papers.venue,
        citations: papers.citations,
        tag: papers.tag,
        status: papers.status,
        selected: papers.selected,
        doi: papers.doi,
        createdAt: papers.createdAt,
        researchTitle: researches.title,
        ownerId: researches.userId,
      })
      .from(papers)
      .leftJoin(researches, eq(papers.researchId, researches.id))
      .orderBy(desc(papers.createdAt))
      .all();

    // Scope to the caller's own researches (multi-tenant isolation).
    const uid = c.get("userId");
    const owned = rows.filter((p) => p.ownerId === uid);

    // Dedup key → number of DISTINCT researches holding it.
    const keyOf = (p: { doi: string | null; title: string }) =>
      (p.doi && p.doi.trim().toLowerCase()) || p.title.trim().toLowerCase();
    const researchesByKey = new Map<string, Set<string>>();
    for (const p of owned) {
      const k = keyOf(p);
      if (!researchesByKey.has(k)) researchesByKey.set(k, new Set());
      researchesByKey.get(k)!.add(p.researchId);
    }

    const out = owned.map(({ ownerId, ...p }) => ({
      ...p,
      selected: !!p.selected,
      inResearches: researchesByKey.get(keyOf(p))!.size,
    }));
    return c.json({ papers: out });
  });

  // Proxy the paper's PDF through our origin (avoids CORS so the in-app PDF
  // viewer — @cyntler/react-doc-viewer — can render the real paper, ditto).
  app.get("/api/papers/:id/pdf", async (c) => {
    const p = db.select().from(papers).where(eq(papers.id, c.req.param("id"))).get();
    if (!p) return c.json({ error: "not found" }, 404);
    // Prefer an OPEN, fetchable PDF (arXiv) over a paywalled publisher URL.
    const pdfUrl = await resolvePdfUrl(p);
    if (!pdfUrl) return c.json({ error: "no pdf for this paper" }, 404);
    try {
      // Fetch the FULL PDF into a buffer (not a stream). pdf.js needs a real
      // Content-Length + a byte range-able body; a chunked proxy stream makes it
      // fail with "Failed to load PDF file". Cache to disk (answerThis's
      // pdf_store) so repeat views + the reader's probe don't re-download.
      const buf = await fetchPdfBuffer(p.id, pdfUrl);
      if (!buf) return c.json({ error: "pdf unavailable" }, 502);
      return new Response(buf, {
        headers: {
          "content-type": "application/pdf",
          "content-length": String(buf.length),
          "accept-ranges": "bytes",
          "content-disposition": `inline; filename="${p.id}.pdf"`,
          "cache-control": "public, max-age=86400",
        },
      });
    } catch (e) {
      log.warn("pdf proxy failed", String(e));
      return c.json({ error: "pdf fetch failed" }, 502);
    }
  });

  // Readable document for a single paper (Notion reader).
  app.get("/api/papers/:id/content", async (c) => {
    const p = db.select().from(papers).where(eq(papers.id, c.req.param("id"))).get();
    if (!p) return c.json({ error: "not found" }, 404);
    const doc = await buildPaperMarkdown(p);
    return c.json({ paper: { id: p.id, title: p.title, byline: p.byline, venue: p.venue, year: p.year, doi: p.doi, pdfUrl: p.pdfUrl }, markdown: doc.markdown, html: doc.html ?? null, source: doc.source });
  });

  app.get("/api/papers/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ error: "q required" }, 400);
    const limit = Math.min(40, Number(c.req.query("limit") ?? 20) || 20);
    try {
      const results = await searchPapers(q, limit);
      return c.json({ query: q, count: results.length, results });
    } catch (e) {
      log.error("paper-search failed", String(e));
      return c.json({ error: "search failed" }, 502);
    }
  });

  app.post("/api/researches/:id/papers/import", async (c) => {
    const researchId = c.req.param("id");
    const research = db.select().from(researches).where(eq(researches.id, researchId)).get();
    if (!research) return c.json({ error: "research not found" }, 404);

    const body = (await c.req.json().catch(() => ({}))) as { papers?: PaperResult[] };
    const items = body.papers ?? [];
    if (!items.length) return c.json({ error: "no papers" }, 400);

    const rows = items.map((p) => ({
      id: `p_${nanoid(10)}`,
      researchId,
      title: p.title,
      byline: p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : ""),
      year: p.year,
      venue: p.venue,
      citations: p.citations,
      tag: p.sources[0] ?? "imported",
      status: "unread",
      selected: 0,
      doi: p.doi ?? null,
      abstract: p.abstract ?? null,
      pdfUrl: p.pdfUrl ?? null,
    }));
    db.insert(papers).values(rows).run();
    return c.json({ imported: rows.length });
  });
}
