/**
 * backend/src/sandbox/library-sync.ts — populate the sandbox's `library` kit.
 *
 *   Writes the research's paper corpus to `<workspace>/.library/papers.jsonl`,
 *   which bind-mounts to `/reagent/library/papers.jsonl` inside the sandbox.
 *   The agent reads the corpus from there for extraction/analysis instead of
 *   re-fetching over the network.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../repositories/db-client.ts";
import { papers } from "../models/schema.ts";
import { eq, asc } from "drizzle-orm";
import { libraryDir } from "./manager.ts";

/** Dump the research's library to `.library/papers.jsonl` (one paper per line). */
export function syncLibrary(researchId: string): number {
  const rows = db.select().from(papers).where(eq(papers.researchId, researchId)).orderBy(asc(papers.createdAt)).all();
  const lines = rows.map((p) =>
    JSON.stringify({
      id: p.id,
      title: p.title,
      authors: p.byline,
      year: p.year,
      venue: p.venue,
      citations: p.citations,
      doi: p.doi,
      abstract: p.abstract,
      pdf_url: p.pdfUrl,
    }),
  );
  writeFileSync(join(libraryDir(researchId), "papers.jsonl"), lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
  return rows.length;
}
