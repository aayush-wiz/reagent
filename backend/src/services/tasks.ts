/**
 * backend/src/services/tasks.ts — CRUD + lifecycle for async agent runs (tasks).
 *
 *   Creating a task inserts a row and enqueues a BullMQ job; the worker process
 *   picks it up. Events the worker produces are appended here (task_events) and
 *   published to Redis pub/sub. See ASYNC_TASKS.md.
 */
import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ModelMessage } from "ai";
import { db } from "../repositories/db-client.ts";
import { tasks, taskEvents } from "../models/schema.ts";
import type { ContextPaper } from "../agent/loop.ts";
import { enqueueRun } from "../queue/runs-queue.ts";
import { env } from "../env.ts";

/** Thrown by createTask when a user already has too many active runs. The route
 *  translates this into a 429 so a single user can't flood the queue. */
export class TaskQuotaError extends Error {
  constructor(public readonly limit: number) {
    super(`You already have ${limit} runs in progress. Wait for one to finish before starting another.`);
    this.name = "TaskQuotaError";
  }
}

/** How many runs a user currently has queued or running. */
export function activeTaskCount(userId: string): number {
  return db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.status, ["queued", "running"])))
    .all().length;
}

export interface TaskInput {
  prompt: string;
  userId?: string | null;
  researchId?: string | null;
  sessionId?: string | null;
  kind?: "task" | "chat";
  model?: string;
  agent?: string;
  messages?: ModelMessage[];
  contextPapers?: ContextPaper[];
}

const titleFrom = (prompt: string) => prompt.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled task";

/** Create a task row and enqueue it for the worker. Returns the row. */
export async function createTask(input: TaskInput) {
  // Backpressure: cap concurrent runs per user so one caller can't fill the queue.
  const userId = input.userId ?? null;
  if (userId && activeTaskCount(userId) >= env.MAX_TASKS_PER_USER) {
    throw new TaskQuotaError(env.MAX_TASKS_PER_USER);
  }
  const id = `t_${nanoid(12)}`;
  // The messages the worker will run: an explicit history (chat) or the prompt.
  const messages: ModelMessage[] = input.messages?.length
    ? input.messages
    : [{ role: "user", content: input.prompt }];
  const row = {
    id,
    userId,
    researchId: input.researchId ?? null,
    sessionId: input.sessionId ?? null,
    kind: input.kind ?? "task",
    title: titleFrom(input.prompt),
    prompt: input.prompt,
    model: input.model ?? "",
    agent: input.agent ?? "research",
    status: "queued" as const,
    input: JSON.stringify({ messages, contextPapers: input.contextPapers ?? [] }),
    result: "",
    error: "",
  };
  db.insert(tasks).values(row).run();
  await enqueueRun(id);
  return getTask(id)!;
}

export function getTask(id: string) {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

/** Parsed { messages, contextPapers } the worker should run. */
export function getTaskInput(id: string): { messages: ModelMessage[]; contextPapers: ContextPaper[] } {
  const t = getTask(id);
  if (!t) return { messages: [], contextPapers: [] };
  try {
    const parsed = JSON.parse(t.input);
    return { messages: parsed.messages ?? [], contextPapers: parsed.contextPapers ?? [] };
  } catch {
    return { messages: [], contextPapers: [] };
  }
}

/** All tasks for the Tasks tab (newest first). Chat runs are excluded by default.
 *  Scoped to `userId` when given. */
export function listTasks(opts?: { includeChat?: boolean; userId?: string }) {
  let rows = db.select().from(tasks).orderBy(desc(tasks.createdAt)).all();
  if (opts?.userId) rows = rows.filter((r) => r.userId === opts.userId);
  return opts?.includeChat ? rows : rows.filter((r) => r.kind === "task");
}

/** The run currently active (queued/running) for a chat session, for reattach. */
export function activeRunForSession(sessionId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.sessionId, sessionId), inArray(tasks.status, ["queued", "running"])))
    .orderBy(desc(tasks.createdAt))
    .get();
}

/** The most recent active CHAT run for a research (any of its sessions), so the
 *  chat can jump to the right session when you return to the research. */
export function activeChatRunForResearch(researchId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.researchId, researchId), eq(tasks.kind, "chat"), inArray(tasks.status, ["queued", "running"])))
    .orderBy(desc(tasks.createdAt))
    .get();
}

export function markRunning(id: string) {
  db.update(tasks).set({ status: "running", startedAt: Date.now() }).where(eq(tasks.id, id)).run();
}
export function markDone(id: string, result: string) {
  db.update(tasks).set({ status: "done", result, finishedAt: Date.now() }).where(eq(tasks.id, id)).run();
}
export function markFailed(id: string, error: string) {
  db.update(tasks).set({ status: "failed", error, finishedAt: Date.now() }).where(eq(tasks.id, id)).run();
}
export function markCanceled(id: string) {
  db.update(tasks).set({ status: "canceled", finishedAt: Date.now() }).where(eq(tasks.id, id)).run();
}

/** Fail any task still marked "running" — called on worker startup. The worker is
 *  the only executor, so if it's just starting nothing can actually be running:
 *  those are orphans from a crash/restart/wedge. (Genuinely queued jobs are left
 *  for BullMQ to deliver.) A re-delivered job simply calls markRunning again.
 *  Returns the swept task ids (so their chat turns can be backfilled). */
export function failOrphanedRuns(reason: string): string[] {
  const orphans = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.status, "running")).all();
  if (orphans.length) {
    db.update(tasks)
      .set({ status: "failed", error: reason, finishedAt: Date.now() })
      .where(eq(tasks.status, "running"))
      .run();
  }
  return orphans.map((o) => o.id);
}

/** Fail runs that have been "running" longer than `maxMs` — the wall-clock ceiling
 *  for a single run (the system otherwise has no per-job timeout). Rows with a
 *  null startedAt are excluded by the `lt` comparison. Returns the swept ids so
 *  the worker can abort the local controller and backfill the chat turn. */
export function failStuckRuns(maxMs: number): string[] {
  const cutoff = Date.now() - maxMs;
  const stuck = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.status, "running"), lt(tasks.startedAt, cutoff)))
    .all();
  for (const s of stuck) markFailed(s.id, `Run exceeded the ${Math.round(maxMs / 60000)}-minute ceiling and was stopped.`);
  return stuck.map((s) => s.id);
}

/**
 * Reconstruct and persist a chat turn from a run's persisted event stream —
 * crash recovery for runs that died before persistTurn (worker kill, wedge,
 * stall). The events hold the full timeline (reasoning, tool calls, text), so
 * the thread shows exactly the work that happened. No-op if the run already
 * has a persisted turn, isn't a chat, or produced no events. Returns true if
 * a turn was written.
 */
export async function backfillTurnFromEvents(taskId: string): Promise<boolean> {
  const t = getTask(taskId);
  if (!t || t.kind !== "chat" || !t.researchId) return false;
  const { persistTurn, turnExistsForTask, getSession, ensureSession } = await import("./sessions.ts");
  if (turnExistsForTask(taskId)) return false;
  const events = eventsSince(taskId, 0);
  if (!events.length) return false;
  const parts = events.map((e) => JSON.parse(e.part) as Record<string, unknown>);
  // The streamed narration text = every text-delta in order.
  const text = parts
    .filter((p) => p.type === "text-delta")
    .map((p) => String(p.delta ?? ""))
    .join("")
    .trim();
  const status = t.status === "canceled" ? "canceled" : "failed";
  const note = `\n\n> ⚠︎ This run ${status === "canceled" ? "was canceled" : "did not complete"} — the timeline above is the work it did before stopping. Its artifacts (documents, files, findings) are saved in the research.`;
  const sessionId = t.sessionId && getSession(t.sessionId) ? t.sessionId : ensureSession(t.researchId).id;
  persistTurn({
    researchId: t.researchId,
    sessionId,
    userText: t.prompt,
    assistantText: (text + note).trim(),
    parts,
    // Tool ModelMessages can't be reconstructed from UI events safely (tool_use
    // pairing) — fall back to the narration text so follow-ups still see it.
    modelMessages: text ? [{ role: "assistant", content: text }] : [],
    taskId,
  });
  return true;
}

/** Insert one UI-message part at an explicit seq (the worker owns the counter,
 *  so we avoid a max(seq) query per streamed part). */
export function insertEvent(taskId: string, seq: number, part: unknown): void {
  db.insert(taskEvents).values({ id: `te_${nanoid(12)}`, taskId, seq, part: JSON.stringify(part) }).run();
}

/** Events since `sinceSeq` (0 = all), for replay-on-connect. */
export function eventsSince(taskId: string, sinceSeq: number) {
  return db
    .select()
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), gt(taskEvents.seq, sinceSeq)))
    .orderBy(asc(taskEvents.seq))
    .all();
}
