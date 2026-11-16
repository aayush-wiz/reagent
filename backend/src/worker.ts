/**
 * backend/src/worker.ts — the dedicated run worker (BullMQ).
 *
 *   A separate process from the API. It consumes the "runs" queue and executes
 *   agent runs via the shared loop (agent/loop.ts). For every UI-message part it:
 *     • persists it to task_events (durable replay), and
 *     • publishes it to Redis pub/sub run:<id> (live fan-out to WebSocket viewers).
 *   Because the run lives here — not in a browser request — it keeps going no
 *   matter what the client does. Cancel is a Redis control message → AbortSignal.
 *
 *   Run with `npm run worker` (dev launches web + api + worker together).
 */
import "./repositories/db-client.ts"; // idempotent bootstrap for this process
import { Worker } from "bullmq";
import { makeRedis, bullConnection, runChannel, CANCEL_CHANNEL, ANSWER_CHANNEL } from "./queue/redis.ts";
import { deliverAnswer } from "./agent/ask-registry.ts";
import { RUNS_QUEUE, type RunJobData } from "./queue/runs-queue.ts";
import { runAgentLoop } from "./agent/loop.ts";
import {
  getTask,
  getTaskInput,
  markRunning,
  markDone,
  markFailed,
  markCanceled,
  insertEvent,
  failOrphanedRuns,
  failStuckRuns,
  backfillTurnFromEvents,
} from "./services/tasks.ts";
import { env } from "./env.ts";
import { startSandboxReaper } from "./sandbox/manager.ts";
import { getResearch } from "./services/researches.ts";
import { ensureSession, getSession, persistTurn } from "./services/sessions.ts";
import { snapshotArtifacts, diffArtifacts, saveTaskArtifacts, type ArtifactSnapshot } from "./services/task-artifacts.ts";
import { log } from "./libs/logger.ts";

// Active runs in THIS worker, so a cancel message can abort the right one.
const controllers = new Map<string, AbortController>();

// Control subscriber: the API publishes a taskId to cancel it, or an ask_user
// answer to unblock a run parked on a question.
const control = makeRedis();
control.subscribe(CANCEL_CHANNEL, ANSWER_CHANNEL).catch((e) => log.warn("control subscribe failed", String(e)));
control.on("message", (ch, payload) => {
  if (ch === CANCEL_CHANNEL) {
    controllers.get(payload)?.abort();
    return;
  }
  if (ch === ANSWER_CHANNEL) {
    try {
      const { taskId, toolCallId, answer } = JSON.parse(payload) as { taskId: string; toolCallId: string; answer: string };
      deliverAnswer(taskId, toolCallId, answer);
    } catch (e) {
      log.warn("bad answer payload", String(e));
    }
  }
});

// Publisher for run events + status.
const pub = makeRedis();

const worker = new Worker<RunJobData>(
  RUNS_QUEUE,
  async (job) => {
    const taskId = job.data.taskId;
    const task = getTask(taskId);
    if (!task) return;

    const controller = new AbortController();
    controllers.set(taskId, controller);
    let seq = 0;
    const publishStatus = (status: string) =>
      pub.publish(runChannel(taskId), JSON.stringify({ type: "status", status }));

    // Accumulated across the run so EVERY terminal path (done / failed /
    // canceled) can persist the full chat turn — the thread must never end up
    // blank just because a run didn't finish cleanly.
    const uiParts: unknown[] = [];
    let finalText = "";
    let turnMessages: import("ai").ModelMessage[] = [];
    let turnUsage: import("./agent/loop.ts").TurnUsage | undefined;

    /** Persist the chat turn for whatever state the run ended in. Idempotent
     *  per task (persistTurn replaces by taskId), so re-deliveries can't dupe. */
    const persistChatTurn = (status: "done" | "failed" | "canceled", errText?: string) => {
      if (!task.researchId || task.kind !== "chat") return;
      try {
        const sessionId =
          task.sessionId && getSession(task.sessionId) ? task.sessionId : ensureSession(task.researchId).id;
        const streamedText = uiParts
          .filter((p): p is { type: string; delta?: unknown } => (p as { type?: string }).type === "text-delta")
          .map((p) => String(p.delta ?? ""))
          .join("")
          .trim();
        const body = finalText || streamedText;
        const note =
          status === "done"
            ? ""
            : `\n\n> ⚠︎ This run ${status === "canceled" ? "was canceled" : `failed${errText ? `: ${errText.slice(0, 200)}` : ""}`} before completing — the timeline above is the work it did up to that point.`;
        persistTurn({
          researchId: task.researchId,
          sessionId,
          userText: task.prompt,
          assistantText: (body + note).trim() || `(run ${status} with no output)`,
          parts: uiParts,
          modelMessages: turnMessages.length ? turnMessages : body ? [{ role: "assistant", content: body }] : [],
          taskId,
          usage: turnUsage,
        });
      } catch (err) {
        log.warn(`persistChatTurn(${status}) failed for ${taskId}`, String(err));
      }
    };

    try {
      markRunning(taskId);
      await publishStatus("running");

      const { messages, contextPapers } = getTaskInput(taskId);
      const research = task.researchId ? getResearch(task.researchId) : undefined;

      // Snapshot the research's artifacts BEFORE the run, so we can attribute
      // only what THIS task creates/changes to it afterwards.
      let before: ArtifactSnapshot | null = null;
      if (task.researchId) before = await snapshotArtifacts(task.researchId).catch(() => null);

      const result = await runAgentLoop(
        {
          messages,
          researchId: task.researchId ?? undefined,
          researchTitle: research?.title,
          model: task.model || undefined,
          agent: task.agent,
          taskId,
          contextPapers,
        },
        {
          onPart: async (part) => {
            seq += 1;
            uiParts.push(part);
            insertEvent(taskId, seq, part); // durable
            await pub.publish(runChannel(taskId), JSON.stringify({ seq, part })); // live
          },
        },
        controller.signal,
      );
      finalText = result.text;
      turnMessages = result.messages;
      turnUsage = result.usage;

      if (controller.signal.aborted) {
        markCanceled(taskId);
        persistChatTurn("canceled");
        await publishStatus("canceled");
      } else {
        // Attribute the artifacts this run produced (diff vs the pre-run snapshot).
        if (task.researchId && before) {
          const artifacts = await diffArtifacts(task.researchId, before).catch(() => null);
          if (artifacts) saveTaskArtifacts(taskId, artifacts);
        }
        markDone(taskId, finalText);
        persistChatTurn("done");
        await publishStatus("done");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (controller.signal.aborted) {
        markCanceled(taskId);
        persistChatTurn("canceled");
        await publishStatus("canceled");
      } else {
        markFailed(taskId, msg);
        persistChatTurn("failed", msg);
        await pub.publish(runChannel(taskId), JSON.stringify({ type: "error", error: msg }));
        await publishStatus("failed");
      }
    } finally {
      controllers.delete(taskId);
    }
  },
  { connection: bullConnection(), concurrency: env.WORKER_CONCURRENCY },
);

worker.on("ready", () => log.info("Reagent worker ready — consuming queue 'runs'"));
worker.on("failed", (job, err) => log.warn(`run ${job?.id} failed`, String(err)));
worker.on("error", (err) => log.warn("worker error", String(err)));

// Sweep orphaned runs from a previous crash/restart/wedge so they don't linger as
// forever-"running" zombies (the UI would keep reattaching to a dead run) — and
// backfill each one's chat turn from its event stream so the thread is never blank.
const swept = failOrphanedRuns("Worker restarted — run was orphaned and did not complete.");
if (swept.length) {
  log.warn(`swept ${swept.length} orphaned running task(s) → failed`);
  for (const id of swept) {
    backfillTurnFromEvents(id)
      .then((did) => did && log.info(`backfilled chat turn for orphaned run ${id}`))
      .catch((e) => log.warn(`backfill failed for ${id}`, String(e)));
  }
}

// Cap concurrent sandbox containers and reap idle ones (they used to leak forever).
startSandboxReaper();

// Wall-clock ceiling: periodically fail runs stuck "running" past RUN_MAX_MS (the
// queue has no per-job timeout), abort the local controller, and backfill the turn.
setInterval(() => {
  const stuck = failStuckRuns(env.RUN_MAX_MS);
  for (const id of stuck) {
    controllers.get(id)?.abort();
    log.warn(`run ${id} exceeded the ${Math.round(env.RUN_MAX_MS / 60000)}-minute ceiling → failed`);
    backfillTurnFromEvents(id).catch(() => {});
  }
}, 60_000).unref();

log.info("Reagent worker starting…");
