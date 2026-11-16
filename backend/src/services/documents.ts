/**
 * backend/src/services/documents.ts — the per-research working documents.
 *
 *   These are the "major .md files" a research owns: `plan`, `tasks`,
 *   `findings`, and the stage artifacts the research agent writes
 *   (`literature-review`, `reasoning`, `methodology`). One row per
 *   (research, name); content is Markdown. The agent reads and writes them via
 *   the doc tools (agent/skills/documents.ts), and the UI can render them.
 */
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { documents } from "../models/schema.ts";

/** Canonical documents every research is expected to grow, in display order. */
export const CANONICAL_DOCS: { name: string; title: string; hint: string }[] = [
  { name: "memory", title: "Working Memory", hint: "The agent's running note: what's done, what's next, and mistakes not to repeat. Auto-loaded into context at the start of every turn." },
  { name: "plan", title: "Research Plan", hint: "The scope, question, and the plan of attack." },
  { name: "literature-review", title: "Literature Review", hint: "Synthesis of the relevant literature, by facet, with citations." },
  { name: "reasoning", title: "Reasoning", hint: "Deliberation over the evidence: hypotheses and the chosen direction." },
  { name: "methodology", title: "Methodology", hint: "The analysis pipeline, controls, and statistical plan." },
  { name: "findings", title: "Findings", hint: "The durable, cited conclusions reached so far." },
  { name: "tasks", title: "Tasks", hint: "Open and completed tasks / next steps." },
];

/** Normalize a free-form name to a slug (so "Literature Review" == "literature-review"). */
export function slugifyDoc(name: string): string {
  return name.trim().toLowerCase().replace(/\.md$/, "").replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function listDocuments(researchId: string) {
  return db.select().from(documents).where(eq(documents.researchId, researchId)).orderBy(asc(documents.createdAt)).all();
}

export function getDocument(researchId: string, name: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.researchId, researchId), eq(documents.name, slugifyDoc(name))))
    .get();
}

/** Create-or-replace a document's content (upsert on (research, name)). */
export function writeDocument(researchId: string, name: string, content: string, title?: string) {
  const slug = slugifyDoc(name);
  const canonical = CANONICAL_DOCS.find((d) => d.name === slug);
  const finalTitle = title || canonical?.title || slug.replace(/\b\w/g, (c) => c.toUpperCase());
  const existing = getDocument(researchId, slug);
  const now = Date.now();
  if (existing) {
    db.update(documents).set({ content, title: finalTitle, updatedAt: now }).where(eq(documents.id, existing.id)).run();
    return getDocument(researchId, slug)!;
  }
  db.insert(documents).values({ id: `d_${nanoid(10)}`, researchId, name: slug, title: finalTitle, content, createdAt: now, updatedAt: now }).run();
  return getDocument(researchId, slug)!;
}

/** Append a Markdown section to a document, creating it if absent. */
export function appendDocument(researchId: string, name: string, content: string, title?: string) {
  const existing = getDocument(researchId, name);
  const next = existing ? `${existing.content.trimEnd()}\n\n${content.trim()}\n` : `${content.trim()}\n`;
  return writeDocument(researchId, name, next, title);
}

/** The doc list the UI shows: every canonical slot, filled or empty, plus extras. */
export function documentsForUI(researchId: string) {
  const rows = listDocuments(researchId);
  const byName = new Map(rows.map((r) => [r.name, r]));
  const canonical = CANONICAL_DOCS.map((d) => {
    const row = byName.get(d.name);
    return {
      name: d.name,
      title: row?.title || d.title,
      hint: d.hint,
      exists: !!row,
      updatedAt: row?.updatedAt ?? null,
      chars: row?.content.length ?? 0,
    };
  });
  const extras = rows
    .filter((r) => !CANONICAL_DOCS.some((d) => d.name === r.name))
    .map((r) => ({ name: r.name, title: r.title, hint: "", exists: true, updatedAt: r.updatedAt, chars: r.content.length }));
  return [...canonical, ...extras];
}
