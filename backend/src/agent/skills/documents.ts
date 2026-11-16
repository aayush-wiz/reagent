/**
 * backend/src/agent/skills/documents.ts — the research agent's document tools.
 *
 *   These give the agent read/write access to the per-research working files
 *   (plan, tasks, findings, literature-review, reasoning, methodology, …). This
 *   is the Reagent equivalent of openscience writing `literature-review.md`,
 *   `reasoning.md`, `methodology.md` and re-reading them across stages: durable,
 *   named Markdown documents scoped to the current research.
 */
import { z } from "zod";
import type { Skill } from "../types.ts";
import {
  listDocuments,
  getDocument,
  writeDocument,
  appendDocument,
  documentsForUI,
  CANONICAL_DOCS,
} from "../../services/documents.ts";

const CANON = CANONICAL_DOCS.map((d) => d.name).join(", ");

/** Read-only doc tools — granted to every agent (including read-only subagents). */
export const docReadSkills: Skill[] = [
  {
    slug: "list_docs",
    category: "documents",
    description:
      `List this research's working documents and which are filled vs empty. Canonical docs: ${CANON}. ` +
      `Use this at the start of a task to see what has already been established.`,
    inputSchema: z.object({}),
    run: (_args, ctx) => {
      if (!ctx.researchId) return "No active research — documents are unavailable.";
      const docs = documentsForUI(ctx.researchId);
      const lines = docs.map(
        (d) => `- **${d.name}** (${d.title})${d.exists ? ` — ${d.chars} chars` : " — empty"}${d.hint ? `\n  ${d.hint}` : ""}`,
      );
      return `# Research documents\n${lines.join("\n")}`;
    },
  },
  {
    slug: "read_doc",
    category: "documents",
    description: "Read a research document's full Markdown content by name (e.g. plan, literature-review, findings).",
    inputSchema: z.object({ name: z.string().describe("Document name/slug, e.g. \"literature-review\".") }),
    run: (args, ctx) => {
      if (!ctx.researchId) return "No active research — documents are unavailable.";
      const doc = getDocument(ctx.researchId, String(args.name));
      if (!doc) return `Document "${args.name}" doesn't exist yet. Create it with write_doc. Existing: ${listDocuments(ctx.researchId).map((d) => d.name).join(", ") || "(none)"}.`;
      return `# ${doc.title} (${doc.name})\n\n${doc.content}`;
    },
  },
];

/** Write doc tools — granted to the primary agent and the write subagent. */
export const docWriteSkills: Skill[] = [
  {
    slug: "write_doc",
    category: "documents",
    description:
      `Create or REPLACE a research document's content (Markdown). Use canonical names where they fit (${CANON}). ` +
      `Writing the whole document — use append_doc to add to an existing one instead of overwriting.`,
    inputSchema: z.object({
      name: z.string().describe("Document name/slug, e.g. \"reasoning\"."),
      content: z.string().describe("The full Markdown content to store."),
      title: z.string().optional().describe("Optional human title; inferred if omitted."),
    }),
    run: (args, ctx) => {
      if (!ctx.researchId) return "No active research — cannot write documents.";
      const doc = writeDocument(ctx.researchId, String(args.name), String(args.content), args.title ? String(args.title) : undefined);
      return `Saved "${doc.name}" (${doc.content.length} chars).`;
    },
  },
  {
    slug: "append_doc",
    category: "documents",
    description: "Append a Markdown section to a research document, creating it if it doesn't exist. Preferred over overwriting.",
    inputSchema: z.object({
      name: z.string().describe("Document name/slug."),
      content: z.string().describe("The Markdown section to append."),
      title: z.string().optional(),
    }),
    run: (args, ctx) => {
      if (!ctx.researchId) return "No active research — cannot write documents.";
      const doc = appendDocument(ctx.researchId, String(args.name), String(args.content), args.title ? String(args.title) : undefined);
      return `Appended to "${doc.name}" (now ${doc.content.length} chars).`;
    },
  },
];

export const documentSkills: Skill[] = [...docReadSkills, ...docWriteSkills];
