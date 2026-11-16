/**
 * backend/src/agent/task.ts — the `task` tool (mirrors openscience
 * backend/cli/src/tool/task.ts).
 *
 *   Lets the primary agent spawn a subagent: it picks a `subagent_type`, hands
 *   it a `prompt`, and gets back the subagent's final structured result. The
 *   subagent runs its own ReAct loop (see subagent.ts) with a restricted
 *   toolset and cannot itself spawn further subagents (no nesting), matching
 *   openscience's default. The primary can issue several task() calls in one
 *   step to fan them out in parallel.
 */
import { tool } from "ai";
import { z } from "zod";
import { spawnableAgents } from "./agents.ts";
import { db } from "../repositories/db-client.ts";
import { papers } from "../models/schema.ts";
import { eq, asc } from "drizzle-orm";
import type { SkillCtx } from "./types.ts";

/** Render the current research's library as a corpus block to hand a subagent. */
function libraryBlock(researchId: string | undefined, scope: "only" | "augment"): string {
  if (!researchId) return "";
  const n = db.select().from(papers).where(eq(papers.researchId, researchId)).all().length;
  if (!n) return "";
  // Point the subagent at the library; it reads the papers (with abstracts) via
  // the `list_library` tool — one fast DB call — not by fetching each one.
  return scope === "only"
    ? `\n\nCorpus: the ${n} papers already in the workspace library. Call \`list_library\` to read them (titles + abstracts), and review THOSE — do NOT search for new papers. Use \`get_paper\` only for the few you need to quote in full, and \`science_search\` only to fill a specific gap the task names.`
    : `\n\nStart from the ${n} papers already in the workspace library — call \`list_library\` to read them (titles + abstracts) and review them, THEN \`science_search\` for additional related work and fold it in.`;
}

export function makeTaskTool(ctx: SkillCtx, model?: string) {
  const agents = spawnableAgents();
  const roster = agents.map((a) => `- ${a.name}: ${a.description}`).join("\n");
  const names = agents.map((a) => a.name);

  return tool({
    description:
      `Spawn a specialist subagent to handle a scoped task and return its result. ` +
      `Issue several calls in one turn to run them in parallel (e.g. one literature-review per facet). ` +
      `Available subagents:\n${roster}`,
    inputSchema: z.object({
      subagent_type: z.enum(names as [string, ...string[]]).describe("Which subagent to spawn."),
      description: z.string().describe("A short (3–5 word) label for the task."),
      prompt: z.string().describe("The full task for the subagent — be specific and self-contained."),
      library_scope: z
        .enum(["only", "augment"])
        .optional()
        .describe(
          "How the subagent should treat the current workspace library. " +
            "'only' = the library papers ARE the corpus, review those (search only to fill a gap). " +
            "'augment' = review the library papers AND search for more related work. " +
            "Omit for pure discovery (search fresh, ignore the library). " +
            "When set, the actual library papers are injected into the subagent's task.",
        ),
    }),
    execute: async ({ subagent_type, prompt, library_scope }, { abortSignal }) => {
      // Dynamic import breaks the registry ↔ subagent module cycle.
      const { runSubagent } = await import("./subagent.ts");
      const fullPrompt = library_scope ? prompt + libraryBlock(ctx.researchId, library_scope) : prompt;
      try {
        // Pass the run's abort signal so canceling the run kills the subagent.
        const out = await runSubagent(subagent_type, fullPrompt, ctx, model, abortSignal);
        return `<task_result agent="${subagent_type}">\n${out}\n</task_result>`;
      } catch (e) {
        return `<task_error agent="${subagent_type}">${String(e)}</task_error>`;
      }
    },
  });
}
