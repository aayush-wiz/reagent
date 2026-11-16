/**
 * agent/skills/papers.ts — literature + workspace skills.
 *
 *   These wrap the existing services (paper-search, paper-content, DB) so the
 *   agent can do real literature work: search, read full text, curate the
 *   library, and record findings.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { searchPapers, getPaperByDoi, RELIABLE_SOURCES, type PaperResult } from "../../services/paper-search.ts";
import { buildPaperMarkdown } from "../../services/paper-content.ts";
import { log } from "../../libs/logger.ts";
import { db } from "../../repositories/db-client.ts";
import { papers, findings } from "../../models/schema.ts";
import { eq, asc } from "drizzle-orm";
import type { Skill } from "../types.ts";

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);

/**
 * Bounded-concurrency map — the JS analog of answerThis's
 * `ThreadPoolExecutor(max_workers=N)`: run `fn` over all items but never more
 * than `limit` in flight at once. Used to read many papers in parallel instead
 * of the agent calling get_paper serially (one slow PDF fetch at a time).
 */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}

/**
 * Persist resolved paper hits into a research's Library (`papers` table),
 * de-duplicated by DOI (else title) against what's already there. Fully
 * synchronous, so concurrent readers can't create duplicate rows. Shared by the
 * explicit `save_papers` tool AND by `get_paper`/`get_papers`, so ANY paper the
 * agent actually reads lands in the Library automatically — in every chat, from
 * the chat home or a research page, for the primary or any subagent. Returns how
 * many NEW rows were added.
 */
function persistPaperHits(researchId: string, hits: (PaperResult | null | undefined)[]): number {
  const existing = db.select().from(papers).where(eq(papers.researchId, researchId)).all();
  const seen = new Set(existing.map((p) => (p.doi?.trim().toLowerCase() || p.title.trim().toLowerCase())));
  const rows = [];
  for (const hit of hits) {
    if (!hit) continue;
    const key = hit.doi?.trim().toLowerCase() || hit.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: `p_${nanoid(10)}`,
      researchId,
      title: hit.title,
      byline: hit.authors.slice(0, 3).join(", ") + (hit.authors.length > 3 ? " et al." : ""),
      year: hit.year,
      venue: hit.venue,
      citations: hit.citations,
      tag: hit.sources[0] ?? "cited",
      status: "unread",
      selected: 0,
      doi: hit.doi ?? null,
      abstract: hit.abstract ?? null,
      pdfUrl: hit.pdfUrl ?? null,
      createdAt: Date.now(),
    });
  }
  if (rows.length) db.insert(papers).values(rows).run();
  return rows.length;
}

/** Read one paper's full text (open-access) or abstract, by DOI or exact title.
 *  When `researchId` is given, the resolved paper is auto-saved to the Library. */
async function readOnePaper(doi: string, title: string, researchId?: string): Promise<string> {
  if (!doi && !title) return "Provide a doi or title.";
  // A DOI is an EXACT id — resolve it against the per-DOI record endpoints, NOT
  // searchPapers() (which fuzzy-matches the DOI and returns the wrong paper).
  let hit = doi ? await getPaperByDoi(doi) : null;
  if (!hit) [hit] = await searchPapers(title || doi, 1, RELIABLE_SOURCES);
  if (!hit) return `No paper found for "${doi || title}".`;
  // Auto-save: a paper the agent reads is part of the corpus → keep it in the
  // Library (deduped). Non-fatal — a save hiccup must never block the read.
  if (researchId) {
    try {
      persistPaperHits(researchId, [hit]);
    } catch (e) {
      log.warn("readOnePaper: library auto-save failed", String(e));
    }
  }
  const meta = `**${hit.title}** — ${hit.authors.slice(0, 4).join(", ")} (${hit.year}${hit.venue ? `, ${hit.venue}` : ""})${hit.doi ? ` · doi:${hit.doi}` : ""}`;
  const fallback = `[source: metadata]\n\n${meta}\n\n${hit.abstract ?? "(no abstract available — full text couldn't be fetched in time)"}`;
  // Full-text extraction hits flaky PDF sources; cap at 20s → fall back to abstract.
  const doc = await Promise.race([
    buildPaperMarkdown({
      title: hit.title,
      byline: hit.authors.slice(0, 4).join(", "),
      year: hit.year,
      venue: hit.venue,
      citations: hit.citations,
      doi: hit.doi,
      abstract: hit.abstract,
      pdfUrl: hit.pdfUrl,
    }).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 20_000)),
  ]);
  if (!doc) return fallback;
  const body = doc.html ? "(full formatted HTML available in the reader)\n\n" + (hit.abstract ?? "") : doc.markdown;
  return `[source: ${doc.source}]\n\n${body.slice(0, 8000)}`;
}

export const paperSkills: Skill[] = [
  {
    slug: "search_papers",
    category: "Literature",
    description:
      "Search across journals (OpenAlex, Crossref, Semantic Scholar, Europe PMC, arXiv) for the query. Returns ranked papers with authors, year, venue, citation count, DOI and whether an open-access PDF exists.",
    inputSchema: z.object({ query: z.string(), limit: z.number().int().min(1).max(25).optional() }),
    run: async (a) => {
      const results = await searchPapers(str(a.query), num(a.limit, 8));
      if (!results.length) return `No papers found for "${str(a.query)}".`;
      return results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title} — ${r.authors.slice(0, 3).join(", ")}${r.authors.length > 3 ? " et al." : ""} (${r.year || "n.d."}) · ${r.venue || "?"} · ✳${r.citations}${r.doi ? ` · doi:${r.doi}` : ""}${r.openAccess ? " · OA" : ""}`,
        )
        .join("\n");
    },
  },
  {
    slug: "get_paper",
    category: "Literature",
    description:
      "Read a paper's full text (open-access) or abstract. Provide a DOI or an exact title; returns the assembled document text so you can quote and cite it.",
    inputSchema: z.object({ doi: z.string().optional(), title: z.string().optional() }),
    run: (a, ctx) => readOnePaper(str(a.doi), str(a.title), ctx.researchId),
  },
  {
    slug: "get_papers",
    category: "Literature",
    description:
      "Read MULTIPLE papers at once, IN PARALLEL (bounded concurrency — like a thread pool). Pass a list of {doi} or {title}. Use this to read a whole set of papers (e.g. the library) in one call instead of get_paper one-by-one, which is slow because each fetch can take up to 20s. Returns each paper's text, numbered.",
    inputSchema: z.object({
      papers: z
        .array(z.object({ doi: z.string().optional(), title: z.string().optional() }))
        .min(1)
        .max(60)
        .describe("The papers to read, each by doi or exact title."),
      concurrency: z.number().int().min(1).max(10).optional().describe("Max papers fetched at once (default 6)."),
    }),
    run: async (a, ctx) => {
      const list = Array.isArray(a.papers) ? (a.papers as { doi?: string; title?: string }[]) : [];
      if (!list.length) return "Provide papers: [{doi|title}, …].";
      const limit = num(a.concurrency, 6);
      const t0 = Date.now();
      let inFlight = 0;
      let peak = 0;
      let serialMs = 0; // sum of per-paper durations — what it WOULD cost serially
      log.info(`get_papers ▶ reading ${list.length} papers in parallel (max ${limit} at once)`);
      const texts = await mapPool(list, limit, async (p, i) => {
        const label = str(p.doi) || str(p.title) || `#${i}`;
        peak = Math.max(peak, ++inFlight);
        const s = Date.now();
        log.info(`get_papers   ├ start [${i}] +${s - t0}ms (${inFlight} in flight) ${label}`);
        const txt = await readOnePaper(str(p.doi), str(p.title), ctx.researchId);
        const dur = Date.now() - s;
        serialMs += dur;
        inFlight--;
        log.info(`get_papers   ├ done  [${i}] +${Date.now() - t0}ms (${dur}ms) ${label}`);
        return txt;
      });
      const total = Date.now() - t0;
      log.info(
        `get_papers ✔ ${list.length} papers in ${total}ms · peak concurrency ${peak}/${limit} · serial would be ~${serialMs}ms · ${(serialMs / Math.max(1, total)).toFixed(1)}× speedup`,
      );
      return texts
        .map((t, i) => `### Paper ${i + 1}${list[i].doi ? ` (doi:${list[i].doi})` : list[i].title ? ` (${list[i].title})` : ""}\n${t}`)
        .join("\n\n---\n\n");
    },
  },
  {
    slug: "import_papers",
    category: "Library",
    description:
      "Search for papers and add the top matches to the current research's library so the user keeps them. Provide a query; returns how many were imported.",
    inputSchema: z.object({ query: z.string(), limit: z.number().int().min(1).max(15).optional() }),
    run: async (a, ctx) => {
      if (!ctx.researchId) return "No active research to import into.";
      const results = await searchPapers(str(a.query), num(a.limit, 5));
      if (!results.length) return "Nothing to import.";
      const rows = results.map((p) => ({
        id: `p_${nanoid(10)}`,
        researchId: ctx.researchId!,
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
      return `Imported ${rows.length} papers into the library: ${rows.map((r) => r.title).slice(0, 5).join("; ")}`;
    },
  },
  {
    slug: "save_papers",
    category: "Library",
    description:
      "Persist SPECIFIC papers you've already found and verified into the current research's library, so " +
      "they show up for the user and are kept. Pass the papers by DOI (preferred — exact) or exact title; " +
      "each is resolved to full metadata (authors, year, venue, abstract) and de-duplicated against the " +
      "library. Use this to save the exact papers you include in a review — unlike `import_papers`, which " +
      "runs a fresh query search. Call it for your final included set before you finish.",
    inputSchema: z.object({
      papers: z
        .array(z.object({ doi: z.string().optional(), title: z.string().optional() }))
        .min(1)
        .max(40)
        .describe("The verified papers to save, each identified by a doi (preferred) or an exact title."),
    }),
    run: async (a, ctx) => {
      if (!ctx.researchId) return "No active research to save into.";
      const list = Array.isArray(a.papers) ? (a.papers as { doi?: string; title?: string }[]) : [];
      if (!list.length) return "Provide papers: [{doi|title}, …].";
      // Resolve each reference to full metadata in parallel: a DOI is exact
      // (per-record endpoint); a bare title falls back to a 1-result search.
      const resolved = await mapPool(list, 6, async (ref) => {
        const doi = str(ref.doi);
        const title = str(ref.title);
        if (!doi && !title) return null;
        let hit = doi ? await getPaperByDoi(doi) : null;
        if (!hit) [hit] = await searchPapers(title || doi, 1, RELIABLE_SOURCES);
        return hit ?? null;
      });
      const added = persistPaperHits(ctx.researchId, resolved);
      if (!added) return "No new papers to save — all were already in the library or couldn't be resolved.";
      const names = resolved.filter(Boolean).map((h) => h!.title).slice(0, 5).join("; ");
      return `Saved ${added} paper(s) to the library: ${names}${added > 5 ? "…" : ""}`;
    },
  },
  {
    slug: "list_library",
    category: "Library",
    description:
      "List the papers in this research's library WITH their abstracts — one fast read of the whole corpus. Use this to review the library instead of calling get_paper on each paper (get_paper fetches full text/PDF and is slow per-paper).",
    inputSchema: z.object({ abstracts: z.boolean().optional().describe("Include stored abstracts (default true).") }),
    run: (a, ctx) => {
      if (!ctx.researchId) return "No active research.";
      const withAbs = a.abstracts !== false;
      const rows = db.select().from(papers).where(eq(papers.researchId, ctx.researchId)).orderBy(asc(papers.createdAt)).all();
      if (!rows.length) return "Library is empty.";
      return rows
        .map((p, i) => {
          const head = `${i + 1}. ${p.title} — ${p.byline || "?"} (${p.year || "n.d."}) · ✳${p.citations}${p.doi ? ` · doi:${p.doi}` : ""}`;
          if (!withAbs) return head;
          const abs = p.abstract ? `\n   ${p.abstract.slice(0, 900)}` : `\n   (no abstract stored)`;
          return head + abs;
        })
        .join("\n\n");
    },
  },
  {
    slug: "add_finding",
    category: "Workspace",
    description:
      "Record a durable, cited finding in the research workspace (shows in the Findings panel). kind='ok' for a confirmed result, 'warn' for a caveat/risk.",
    inputSchema: z.object({ text: z.string(), kind: z.enum(["ok", "warn"]).optional() }),
    run: (a, ctx) => {
      if (!ctx.researchId) return "No active research.";
      db.insert(findings)
        .values({ id: `f_${nanoid(10)}`, researchId: ctx.researchId, kind: str(a.kind, "ok"), text: str(a.text) })
        .run();
      return "Finding recorded.";
    },
  },
];
