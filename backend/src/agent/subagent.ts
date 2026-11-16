/**
 * backend/src/agent/subagent.ts — run a subagent to completion (mirrors the
 * child-session run inside openscience's TaskTool).
 *
 *   A subagent is a fresh ReAct loop with its own system prompt, its own
 *   (restricted) toolset, and its own step budget. It runs non-streaming via
 *   generateText and returns its final text — the "compressed result" the
 *   parent agent reads back from the `task` tool.
 */
import { generateText, stepCountIs } from "ai";
import { getSubagentModel } from "../libs/llm.ts";
import { getAgent } from "./agents.ts";
import { buildToolSet } from "./registry.ts";
import { log } from "../libs/logger.ts";
import type { SkillCtx } from "./types.ts";

// NO wall-clock timeout — removed by request so we can measure how long a full
// subagent run actually takes. A subagent runs until it finishes, hits its step
// cap, or the parent run is canceled. (Cancel the run to stop a wedged subagent.)

// Cap concurrent subagent LLM runs. When the primary fans out (e.g. 7 write
// sections in parallel), firing all of them at the model at once trips the
// provider's rate limit (429). Only run this many at a time; the rest queue and
// start as slots free up. Override with REAGENT_SUBAGENT_CONCURRENCY.
const MAX_CONCURRENT = Number(process.env.REAGENT_SUBAGENT_CONCURRENCY) || 8;
let active = 0;
const waiters: Array<() => void> = [];
function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    const attempt = () => {
      if (active < MAX_CONCURRENT) {
        active++;
        resolve();
      } else {
        waiters.push(attempt);
      }
    };
    attempt();
  });
}
function releaseSlot(): void {
  active--;
  waiters.shift()?.();
}

// A static, one-time orientation line (NOT per-task content — keeps prompts small).
// Points the subagent at the tools that hold the current research's knowledge so
// it can look up context itself instead of us bloating every task prompt.
const ORIENT =
  `\n\nYou are working inside an active research workspace. When you need context on what's already ` +
  `been done, use your tools to look it up rather than assuming: \`list_docs\`/\`read_doc\` for the ` +
  `working documents (plan, reasoning, methodology, literature-review, findings) and ` +
  `\`list_library\`/\`get_papers\` for the paper corpus. Ground your work in what's already established.`;

export async function runSubagent(
  agentName: string,
  taskPrompt: string,
  ctx: SkillCtx,
  model?: string,
  parentSignal?: AbortSignal,
): Promise<string> {
  const agent = getAgent(agentName);
  const tools = await buildToolSet(ctx, agent);
  await acquireSlot(); // wait for a concurrency slot (avoids 429 floods on fan-out)
  const t0 = Date.now();

  // Parent-cancel only — no wall-clock timeout. A cancel of the parent run
  // propagates in so the user can still stop a wedged subagent.
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const modelHandle = getSubagentModel();
  const modelId = (modelHandle as { modelId?: string }).modelId ?? "?";
  log.info(
    `subagent ${agentName} ▶ start · model=${modelId} · (${active}/${MAX_CONCURRENT} active · no time limit · up to ${agent.maxSteps} steps)`,
  );

  let stepNum = 0;
  let lastAt = t0;
  try {
    const result = await generateText({
      model: modelHandle,
      // Optional output cap — unset by default (no truncation). See loop.ts.
      ...(Number(process.env.REAGENT_MAX_OUTPUT_TOKENS) > 0
        ? { maxOutputTokens: Number(process.env.REAGENT_MAX_OUTPUT_TOKENS) }
        : {}),
      system: agent.prompt() + ORIENT,
      prompt: taskPrompt,
      tools,
      stopWhen: stepCountIs(agent.maxSteps),
      abortSignal: controller.signal,
      // Per-step telemetry: does the model run, how fast is each step, how many
      // tokens, what tools — so we can see exactly where a slow run spends time.
      onStepFinish: (step) => {
        stepNum += 1;
        const now = Date.now();
        const dt = ((now - lastAt) / 1000).toFixed(1);
        lastAt = now;
        const toolNames = step.toolCalls?.length ? step.toolCalls.map((t) => t.toolName).join(", ") : "—";
        const usage = step.usage as { outputTokens?: number; completionTokens?: number } | undefined;
        const out = usage?.outputTokens ?? usage?.completionTokens ?? "?";
        log.info(
          `subagent ${agentName} · step ${stepNum} +${dt}s · finish=${step.finishReason} · tools:[${toolNames}] · out=${out}tok · elapsed=${((now - t0) / 1000).toFixed(0)}s`,
        );
      },
    });
    log.info(
      `subagent ${agentName} ✔ DONE in ${((Date.now() - t0) / 1000).toFixed(0)}s · ${result.steps.length} steps · model=${modelId} · ${result.text?.length ?? 0} chars out`,
    );
    return result.text?.trim() || "(subagent returned no text)";
  } catch (e) {
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const canceled = parentSignal?.aborted || controller.signal.aborted;
    const rateLimited = /Too Many Requests|429|rate limit/i.test(String(e));
    log.warn(
      `subagent ${agentName} ${canceled ? "CANCELED" : rateLimited ? "RATE-LIMITED" : "FAILED"} after ${secs}s · ${stepNum} steps · model=${modelId}`,
      String(e),
    );
    if (canceled) return `[${agentName} subagent canceled after ${secs}s (${stepNum} steps).]`;
    if (rateLimited) return `[${agentName} subagent hit the model's rate limit (429). Retry shortly.]`;
    // NEVER throw — always hand the primary a usable result.
    return `[${agentName} subagent failed after ${secs}s: ${String(e)} — proceed with what you have or retry.]`;
  } finally {
    parentSignal?.removeEventListener("abort", onParentAbort);
    releaseSlot();
  }
}
