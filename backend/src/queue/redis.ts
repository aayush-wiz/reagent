/**
 * backend/src/queue/redis.ts — Redis connections + channel helpers.
 *
 *   Redis is the broker (BullMQ job queue) AND the live pub/sub bus that fans a
 *   run's UI events out to any connected WebSocket viewer. See ASYNC_TASKS.md.
 */
import IORedis from "ioredis";

export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/** A fresh ioredis connection (used for our pub/sub). */
export function makeRedis(): IORedis {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

/** Connection OPTIONS for BullMQ (it bundles its own ioredis, so we hand it
 *  options rather than an instance to avoid a dual-ioredis type clash). */
export function bullConnection() {
  const u = new URL(REDIS_URL);
  return {
    host: u.hostname || "127.0.0.1",
    port: Number(u.port || 6379),
    password: u.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/** Pub/sub channel a run publishes its UI-message parts to. */
export const runChannel = (taskId: string) => `run:${taskId}`;

/** Control channel the API uses to ask the worker to cancel a run. */
export const CANCEL_CHANNEL = "runs:cancel";

/** Control channel the API uses to deliver a user's ask_user answer to the worker. */
export const ANSWER_CHANNEL = "runs:answer";

// A lazily-created shared publisher for control messages from the API process.
let controlPub: IORedis | null = null;
export function requestCancel(taskId: string): void {
  controlPub ??= makeRedis();
  void controlPub.publish(CANCEL_CHANNEL, taskId);
}

/** Deliver a user's answer to a parked `ask_user` call running in the worker. */
export function publishAnswer(taskId: string, toolCallId: string, answer: string): void {
  controlPub ??= makeRedis();
  void controlPub.publish(ANSWER_CHANNEL, JSON.stringify({ taskId, toolCallId, answer }));
}
