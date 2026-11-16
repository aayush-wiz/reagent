/**
 * backend/src/agent/ask-tool.ts — the `ask_user` human-in-the-loop tool.
 *
 *   The agent calls this to ask the user structured questions — before starting a
 *   research (scope, how many hypotheses, which sources) or anytime mid-run when
 *   it's genuinely blocked. Unlike orpex (which pauses a browser-side loop), our
 *   loop runs in the worker, so `execute` BLOCKS on the answer registry: the
 *   tool-call streams to the UI as a question card, the run parks here, and the
 *   user's answer (delivered over Redis → deliverAnswer) resolves it. The answer
 *   text becomes the tool result and the agent carries on.
 */
import { tool } from "ai";
import { z } from "zod";
import { waitForAnswer } from "./ask-registry.ts";
import type { SkillCtx } from "./types.ts";

// How long to park waiting for a human before proceeding on assumptions. The run
// stays fully alive during this wait; this is just a backstop so a walked-away
// user doesn't wedge a run forever. Override with REAGENT_ASK_TIMEOUT_MS.
const ASK_TIMEOUT_MS = Number(process.env.REAGENT_ASK_TIMEOUT_MS) || 45 * 60_000; // 45 min

export function makeAskUserTool(ctx: SkillCtx) {
  return tool({
    description:
      "Ask the USER one or more clarifying questions and WAIT for their answers before continuing. " +
      "Use it to scope the work before you start (e.g. how deep to go, how many competing hypotheses " +
      "to run, whether to ground in the scholarly literature only or the literature plus the open web, " +
      "what deliverable they want) and anytime mid-research you hit a real fork only the user can decide. " +
      "Put ALL the questions for one moment into a SINGLE call. Each question can offer suggested options; " +
      "the user may also type their own. Returns the user's answers as text. Don't overuse it — ask when " +
      "the answer would actually change what you do, not for things you can reasonably decide yourself.",
    inputSchema: z.object({
      intro: z.string().optional().describe("One short sentence shown above the questions (optional)."),
      questions: z
        .array(
          z.object({
            question: z.string().describe("The question text."),
            options: z
              .array(z.string())
              .optional()
              .describe("A few suggested answers (optional); the user can also type their own."),
          }),
        )
        .min(1)
        .max(10)
        .describe("The clarifying questions (1–10). For an initial scoping, 4–8 is typical."),
    }),
    execute: async ({ questions }, { toolCallId, abortSignal }) => {
      const answer = await waitForAnswer(ctx.taskId, toolCallId, ASK_TIMEOUT_MS, abortSignal);
      if (answer && answer.trim()) return answer.trim();
      return (
        "[The user did not answer" +
        (answer === null ? " in time" : "") +
        `. Proceed with reasonable, clearly-stated assumptions for: ${questions
          .map((q) => q.question)
          .join(" | ")}. State the assumptions you made so the user can correct you.]`
      );
    },
  });
}
