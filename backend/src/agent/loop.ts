/**
 * backend/src/agent/loop.ts — the shared dynamic ReAct loop.
 *
 *   One implementation of the agent's step loop, emitting UI-message-stream parts
 *   to a SINK callback. Both callers share it:
 *     • interactive HTTP streaming (agent/run.ts) — sink writes to the response
 *     • the async worker (worker.ts) — sink persists to task_events + publishes
 *       to Redis pub/sub
 *
 *   Dynamic step budget: runs in windows of STEP_WINDOW and auto-continues while
 *   the model stopped mid-work (finishReason "tool-calls"), up to MAX_TOTAL_STEPS.
 *   An optional AbortSignal cancels the run (Cancel button / shutdown).
 */
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getModel } from "../libs/llm.ts";
import { buildToolSet } from "./registry.ts";
import { getAgent, PRIMARY_AGENT } from "./agents.ts";
import { getDocument, writeDocument } from "../services/documents.ts";
import { log } from "../libs/logger.ts";

export interface ContextPaper {
  title: string;
  byline: string;
  year: string;
  venue: string;
  doi?: string | null;
  abstract?: string | null;
}

export interface LoopInput {
  messages: ModelMessage[];
  researchId?: string;
  researchTitle?: string;
  model?: string;
  agent?: string;
  /** The run/task id — needed so `ask_user` can await the answer keyed to it. */
  taskId?: string;
  /** Papers the user has selected in the sidebar — injected as focused context. */
  contextPapers?: ContextPaper[];
}

/** A UI message stream part (reasoning / tool-call / text-delta / finish, …). */
export type UIPart = Record<string, unknown>;

/**
 * The REAL token usage of a turn, straight from the provider (AI SDK `step.usage`)
 * — never a chars/4 guess. `contextTokens` is the size the conversation reached
 * (the last model call's input + its output) and drives the composer's context bar;
 * the rest are this turn's aggregates for a "consumed" view.
 */
export interface TurnUsage {
  contextTokens: number; // conversation size after this turn = last call's input + output
  inputTokens: number; // the last (fullest) model call's input tokens
  outputTokens: number; // total tokens generated across this turn
  totalTokens: number; // total tokens consumed across this turn (all steps)
}

export interface LoopSink {
  /** Called for every UI-message part the loop produces, in order. */
  onPart: (part: UIPart) => void | Promise<void>;
}

const STEP_WINDOW = 40;
const MAX_TOTAL_STEPS = Number(process.env.REAGENT_MAX_STEPS) || 200;

/** Build the "papers the user selected" block appended to the system prompt. */
export function papersContext(papers?: ContextPaper[]): string {
  if (!papers?.length) return "";
  const lines = papers.map((p) => {
    const cite = [p.byline, [p.year, p.venue].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    const doi = p.doi ? ` · doi:${p.doi}` : "";
    const abs = p.abstract ? `\n  Abstract: ${p.abstract.slice(0, 600)}` : "";
    return `- "${p.title}" — ${cite}${doi}${abs}`;
  });
  return `\n\n## Papers the user attached to this message
The user selected these ${papers.length} paper(s) in the sidebar and sent them with their message, so
they're part of what's being discussed. Their abstracts are included below; read full text with
\`get_paper\` when you need it.
${lines.join("\n")}`;
}

/**
 * Build the "working memory" block pinned to the system prompt. This is the
 * agent's structured note-taking / agentic memory (per Anthropic's context-
 * engineering guidance): the progress + lessons it wrote to the `memory` doc in
 * EARLIER turns, re-loaded here so a long research stays coherent across context
 * windows without re-reading the whole transcript.
 *
 * It's a FROZEN SNAPSHOT — read once at the start of the turn (line ~97). The
 * agent's `write_doc("memory", …)` updates during THIS turn take effect on the
 * NEXT turn, which keeps the prompt prefix stable (cache-friendly) and mirrors
 * the "context can reset at any moment" model. Capped so the note itself can't
 * become the context-bloat problem it exists to prevent.
 */
const MEMORY_MAX_CHARS = 8000;

/**
 * The default scaffold for a research's working-memory note. Seeded the first
 * time a research runs so the doc always opens with these headings — the agent
 * then fills them in AND adds its own sections as the research needs (the note
 * is free to grow; these are just the defaults it starts from).
 */
export const MEMORY_TEMPLATE = `## Goal
_(the question this research answers, and what a decisive answer looks like)_

## Done
_(what's been completed so far)_

## Next
_(what to do next)_

## Key decisions
_(the choices made and why)_

## Do NOT repeat
_(mistakes, failed tool calls, dead-ends, wrong assumptions corrected — so a later turn doesn't redo them)_
`;

/** Create the memory doc with the default scaffold if this research doesn't have one yet. */
export function ensureMemoryScaffold(researchId?: string): void {
  if (!researchId) return;
  try {
    if (!getDocument(researchId, "memory")) writeDocument(researchId, "memory", MEMORY_TEMPLATE);
  } catch {
    // Best-effort: if the research row doesn't exist yet (FK) or the write fails,
    // skip silently — memory must never break a run.
  }
}

export function memoryContext(researchId?: string): string {
  if (!researchId) return "";
  const content = getDocument(researchId, "memory")?.content?.trim();
  if (!content) return "";
  const shown =
    content.length > MEMORY_MAX_CHARS
      ? content.slice(0, MEMORY_MAX_CHARS) + "\n… (working memory truncated — keep it compact)"
      : content;
  return `\n\n## Your working memory (from earlier in THIS research — auto-loaded)
Your running note across turns: what you've done, what's next, and mistakes NOT to repeat. It is
pinned here automatically at the start of every turn, so you do NOT need to \`read_doc("memory")\` —
just keep it current with \`write_doc("memory", …)\` as you work. Anything not written here is lost if
this turn's context resets.

${shown}`;
}

/** Resolve the model eagerly so a misconfigured provider throws before streaming. */
export function resolveModel(model?: string) {
  return getModel(model);
}

/**
 * Run the agent for one turn, streaming UI parts to `sink`. Returns the final
 * assistant text. Throws synchronously if the provider is unconfigured.
 */
export async function runAgentLoop(
  input: LoopInput,
  sink: LoopSink,
  signal?: AbortSignal,
): Promise<{ text: string; messages: ModelMessage[]; usage: TurnUsage }> {
  const agent = getAgent(input.agent ?? PRIMARY_AGENT);
  const model = getModel(input.model);
  // Pin the working-memory note (progress + lessons) for the PRIMARY only — a
  // subagent runs in its own focused window and must not inherit the primary's
  // memory (that would break sub-agent context isolation). Seed the default
  // scaffold first so the note always opens with its headings.
  if (agent.mode === "primary") ensureMemoryScaffold(input.researchId);
  const memory = agent.mode === "primary" ? memoryContext(input.researchId) : "";
  const system = agent.prompt(input.researchTitle) + memory + papersContext(input.contextPapers);
  const turnCeiling = Math.max(agent.maxSteps, MAX_TOTAL_STEPS);

  const tools = await buildToolSet({ researchId: input.researchId, taskId: input.taskId }, agent, input.model);
  let messages: ModelMessage[] = input.messages;
  let totalSteps = 0;
  let finalText = "";
  let first = true;
  // REAL usage from the provider (AI SDK step.usage), accumulated across every
  // step and window. `lastInput`/`lastOutput` track the final (fullest) model
  // call so we can report the true context size; the sums are the turn totals.
  let lastInput = 0;
  let lastOutput = 0;
  let sumOutput = 0;
  let sumTotal = 0;
  // Every assistant/tool message this turn produces — persisted so the NEXT turn
  // sees the full history (tool calls + their results), not just the final text.
  const turnMessages: ModelMessage[] = [];

  while (true) {
    if (signal?.aborted) break;
    const remaining = turnCeiling - totalSteps;
    // PRIMARY-LOOP TELEMETRY — same X-ray the subagents have. Logs each step's
    // wall time, tools, and output tokens, plus the window's context size, so a
    // slow run tells us exactly WHERE the time goes (model latency vs tools vs
    // context growth) instead of us guessing.
    const ctxChars = JSON.stringify(messages).length + system.length;
    const windowStart = Date.now();
    let lastStepAt = windowStart;
    let windowStep = 0;
    log.info(
      `primary ${agent.name} ▶ window (steps so far ${totalSteps}/${turnCeiling}) · context ≈${Math.round(ctxChars / 1000)}k chars (~${Math.round(ctxChars / 4 / 1000)}k tok)`,
    );
    const result = streamText({
      model,
      // Optional output-token cap. UNSET by default so long answers are never
      // truncated (original behavior). Only set REAGENT_MAX_OUTPUT_TOKENS if you
      // must bound per-request cost/credit reserve — but note a low value cuts
      // long answers off mid-sentence (finishReason "length").
      ...(Number(process.env.REAGENT_MAX_OUTPUT_TOKENS) > 0
        ? { maxOutputTokens: Number(process.env.REAGENT_MAX_OUTPUT_TOKENS) }
        : {}),
      system,
      messages,
      tools,
      abortSignal: signal,
      stopWhen: stepCountIs(Math.max(1, Math.min(STEP_WINDOW, remaining))),
      onStepFinish: (step) => {
        windowStep += 1;
        const now = Date.now();
        const dt = ((now - lastStepAt) / 1000).toFixed(1);
        lastStepAt = now;
        const toolNames = step.toolCalls?.length ? step.toolCalls.map((t) => t.toolName).join(", ") : "—";
        const usage = step.usage as { outputTokens?: number; inputTokens?: number; totalTokens?: number; reasoningTokens?: number } | undefined;
        // Record the provider's real counts. GLM (and other reasoning models) report
        // their THINKING tokens in a SEPARATE `reasoningTokens` field — the AI SDK does
        // NOT fold them into `outputTokens`. Count them, or a turn that thought for
        // thousands of tokens shows out=95. `lastOutput` stays the VISIBLE text only
        // (that's what actually re-enters the context window next turn); the reasoning
        // is added to the CONSUMED totals (it's generated + billed, but ephemeral).
        const reasoning = usage?.reasoningTokens ?? 0;
        if (usage?.inputTokens) lastInput = usage.inputTokens;
        if (usage?.outputTokens || reasoning) {
          lastOutput = usage?.outputTokens ?? 0; // visible text → context-window fill
          sumOutput += (usage?.outputTokens ?? 0) + reasoning; // consumed output incl. thinking
        }
        if (usage?.totalTokens) sumTotal += usage.totalTokens + reasoning;
        log.info(
          `primary ${agent.name} · step ${totalSteps + windowStep} +${dt}s · finish=${step.finishReason} · tools:[${toolNames}] · in=${usage?.inputTokens ?? "?"} out=${usage?.outputTokens ?? "?"} think=${reasoning}tok`,
        );
      },
    });

    // Forward every UI part to the sink. Only the first window sends `start`, and
    // no window sends `finish`, so continued windows render as one seamless turn.
    // onError surfaces the REAL provider/model error (instead of the SDK's default
    // masked "An error occurred.") — logged server-side AND sent to the client.
    let streamError: string | null = null;
    const uiStream = result.toUIMessageStream({
      sendReasoning: true,
      sendStart: first,
      sendFinish: false,
      onError: (error) => {
        streamError = error instanceof Error ? error.message : String(error);
        log.error(`primary ${agent.name} · model/stream error: ${streamError}`);
        return streamError;
      },
    });
    const reader = uiStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await sink.onPart(value as UIPart);
    }
    first = false;
    // If the stream errored, fail LOUDLY with the real reason so the run is marked
    // failed with a useful message (not the SDK's generic "No output generated").
    if (streamError) throw new Error(streamError);

    const [finishReason, steps, text] = await Promise.all([
      result.finishReason,
      result.steps,
      result.text,
    ]);
    totalSteps += steps.length;
    if (text) finalText = text;
    // Collect the window's messages PER STEP. `result.response.messages` holds
    // ONLY the final step's message (verified empirically) — using it silently
    // dropped every tool call/result from the persisted history, so follow-up
    // turns knew nothing about the work the agent actually did, and windows
    // lost their tool context at each 40-step boundary.
    const stepMessages = steps.flatMap((s) => s.response.messages);
    turnMessages.push(...stepMessages);

    if (finishReason !== "tool-calls" || totalSteps >= turnCeiling) break;
    messages = [...messages, ...stepMessages];
  }

  await sink.onPart({ type: "finish" });
  const usage: TurnUsage = {
    contextTokens: lastInput + lastOutput,
    inputTokens: lastInput,
    outputTokens: sumOutput,
    totalTokens: sumTotal || lastInput + sumOutput,
  };
  return { text: finalText, messages: turnMessages, usage };
}
