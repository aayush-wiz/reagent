/**
 * backend/src/agent/ask-registry.ts — the human-in-the-loop wait registry.
 *
 *   When the agent calls `ask_user`, its tool `execute` BLOCKS the streamText
 *   loop by awaiting `waitForAnswer(...)`. The run stays alive (the worker is
 *   just parked on this promise) while the UI renders the question card. When the
 *   user answers, the API publishes it over Redis; the worker's answer subscriber
 *   calls `deliverAnswer(...)`, which resolves the matching pending promise and
 *   the agent continues with the answer as the tool result.
 *
 *   This mirrors the existing cancel bridge (Redis control channel → in-process
 *   action), just in the "user → agent" direction. The map is per-process; only
 *   the process actually running the loop holds a pending resolver, so a
 *   `deliverAnswer` that finds nothing is a harmless no-op in the other process.
 */
const pending = new Map<string, (answer: string) => void>();

const key = (taskId: string | undefined, toolCallId: string) => `${taskId ?? "_"}:${toolCallId}`;

/**
 * Park until the user answers this `ask_user` call (or we give up).
 * Resolves with the formatted answer text, or `null` if it timed out / was
 * aborted (the agent then proceeds on reasonable assumptions).
 */
export function waitForAnswer(
  taskId: string | undefined,
  toolCallId: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const k = key(taskId, toolCallId);
  return new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      pending.delete(k);
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(val);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    if (signal) {
      if (signal.aborted) return finish(null);
      signal.addEventListener("abort", onAbort, { once: true });
    }
    pending.set(k, (answer) => finish(answer));
  });
}

/** Deliver a user's answer to the parked `ask_user` call. Returns true if one
 *  was waiting in THIS process (false = it's parked in the other process). */
export function deliverAnswer(taskId: string | undefined, toolCallId: string, answer: string): boolean {
  const resolve = pending.get(key(taskId, toolCallId));
  if (!resolve) return false;
  resolve(answer);
  return true;
}
