/**
 * backend/src/services/library.ts — the public paper library.
 *
 *   Each research has its OWN library (papers rows bound to its researchId).
 *   The "public library" is the shared pool of every paper across all
 *   researches, deduplicated by DOI (or title). A user browses the public
 *   library and adds papers into the current research — which copies the paper
 *   row under that researchId (skipping ones already present).
 */
import { asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { papers } from "../models/schema.ts";

const keyOf = (p: { doi?: string | null; title: string }) =>
  (p.doi && p.doi.trim().toLowerCase()) || p.title.trim().toLowerCase();

export interface PublicPaper {
  key: string;
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  tag: string;
  doi: string | null;
  abstract: string | null;
  pdfUrl: string | null;
  inResearches: number; // how many researches already hold it
}

/** The deduplicated shared pool of every paper in the DB. */
export function listPublicPapers(): PublicPaper[] {
  const rows = db.select().from(papers).orderBy(asc(papers.createdAt)).all();
  const byKey = new Map<string, PublicPaper>();
  for (const p of rows) {
    const key = keyOf(p);
    const existing = byKey.get(key);
    if (existing) {
      existing.inResearches += 1;
      if (p.citations > existing.citations) existing.citations = p.citations;
      continue;
    }
    byKey.set(key, {
      key,
      title: p.title,
      byline: p.byline,
      year: p.year,
      venue: p.venue,
      citations: p.citations,
      tag: p.tag,
      doi: p.doi ?? null,
      abstract: p.abstract ?? null,
      pdfUrl: p.pdfUrl ?? null,
      inResearches: 1,
    });
  }
  return [...byKey.values()].sort((a, b) => b.citations - a.citations);
}

/** Add public papers (by key) into a research's library. Returns how many were added. */
export function addPublicPapersToResearch(researchId: string, keys: string[]): number {
  const pool = new Map(listPublicPapers().map((p) => [p.key, p]));
  const have = new Set(
    db.select().from(papers).all().filter((p) => p.researchId === researchId).map((p) => keyOf(p)),
  );
  let added = 0;
  for (const key of keys) {
    const src = pool.get(key);
    if (!src || have.has(key)) continue;
    db.insert(papers)
      .values({
        id: `p_${nanoid(10)}`,
        researchId,
        title: src.title,
        byline: src.byline,
        year: src.year,
        venue: src.venue,
        citations: src.citations,
        tag: src.tag,
        status: "unread",
        selected: 0,
        doi: src.doi,
        abstract: src.abstract,
        pdfUrl: src.pdfUrl,
        createdAt: Date.now(),
      })
      .run();
    have.add(key);
    added++;
  }
  return added;
}
