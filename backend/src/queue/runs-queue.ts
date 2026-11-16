/**
 * backend/src/queue/runs-queue.ts — the BullMQ "runs" queue.
 *
 *   Both flows (live chat + async task) enqueue a job here; the dedicated worker
 *   process (worker.ts) consumes them. The job payload is just the task id — the
 *   worker loads everything else from the `tasks` row.
 */
import { Queue } from "bullmq";
import { bullConnection } from "./redis.ts";

export const RUNS_QUEUE = "runs";

export interface RunJobData {
  taskId: string;
}

// A single shared Queue handle for enqueuing from the API process.
export const runsQueue = new Queue<RunJobData>(RUNS_QUEUE, { connection: bullConnection() });

/** Enqueue a run. The jobId IS the task id so it's easy to find / cancel. */
export async function enqueueRun(taskId: string): Promise<void> {
  await runsQueue.add("run", { taskId }, { jobId: taskId, removeOnComplete: 1000, removeOnFail: 1000 });
}
