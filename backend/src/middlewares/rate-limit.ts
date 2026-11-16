/**
 * backend/src/middlewares/rate-limit.ts — inbound API rate limiting.
 *
 *   A fixed-window limiter keyed by bearer token (falls back to client IP), so a
 *   single caller can't hammer the API — protects login brute-force and runaway
 *   clients. Counters are in-process: correct for the current single-process
 *   deployment; when you run multiple API replicas, move the counter to Redis
 *   (INCR + EXPIRE) so the limit is shared across them.
 */
import type { Context, Next } from "hono";
import { env } from "../env.ts";

const buckets = new Map<string, { count: number; resetAt: number }>();

// Drop expired buckets at most once per window so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < env.RATE_LIMIT_WINDOW_MS) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

function callerKey(c: Context): string {
  const auth = c.req.header("authorization");
  if (auth) return `t:${auth.slice(-40)}`; // token tail — don't key on the full secret
  const fwd = c.req.header("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]!.trim() : "") || c.req.header("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

export async function rateLimit(c: Context, next: Next): Promise<Response | void> {
  if (c.req.path === "/api/health") return next(); // never throttle LB health probes
  const now = Date.now();
  sweep(now);
  const key = callerKey(c);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + env.RATE_LIMIT_WINDOW_MS };
    buckets.set(key, b);
  }
  b.count++;
  c.header("X-RateLimit-Limit", String(env.RATE_LIMIT_MAX));
  c.header("X-RateLimit-Remaining", String(Math.max(0, env.RATE_LIMIT_MAX - b.count)));
  if (b.count > env.RATE_LIMIT_MAX) {
    c.header("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
    return c.json({ error: "Rate limit exceeded — slow down and retry shortly." }, 429);
  }
  return next();
}
