/**
 * backend/src/agent/run.ts — interactive (HTTP-streamed) agent turn.
 *
 *   Thin wrapper over the shared ReAct loop (agent/loop.ts): it pipes the loop's
 *   UI-message parts straight into a streaming HTTP Response. The async/worker
 *   path uses the SAME loop with a different sink (persist + Redis pub/sub).
 */
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { runAgentLoop, resolveModel, type LoopInput } from "./loop.ts";

export type { ContextPaper } from "./loop.ts";

export interface RunInput extends LoopInput {
  researchTitle?: string;
  /** Called once the whole turn completes, with the agent's final text. */
  onFinish?: (finalText: string) => void;
}

/**
 * Run the agent for one turn, returning a UI message stream Response. The model
 * is resolved eagerly so a misconfigured provider throws to the caller (→ 400)
 * before any streaming starts.
 */
export function runAgent(input: RunInput): Response {
  resolveModel(input.model); // throws synchronously if provider unconfigured

  const stream = createUIMessageStream({
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    execute: async ({ writer }) => {
      const { text: finalText } = await runAgentLoop(input, { onPart: (part) => writer.write(part as never) });
      input.onFinish?.(finalText);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
