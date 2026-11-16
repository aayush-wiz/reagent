/**
 * backend/src/libs/http-pool.ts — a rate-limited concurrent HTTP client.
 *
 *   Lets the app fan out paper searches across all sources AND across many
 *   parallel literature-review subagents at full speed, without tripping the
 *   free APIs' rate limits. The trick a professional research app uses:
 *
 *     • per-host concurrency cap + minimum spacing (arXiv wants ~1 req/3s,
 *       Semantic Scholar ~1/1.2s; OpenAlex/Crossref tolerate many)
 *     • DIFFERENT hosts run fully in parallel — max throughput
 *     • 429/503 are retried with backoff, honoring Retry-After
 *     • a short-TTL response cache + in-flight dedup, so repeated lookups
 *       (common when subagents overlap) are instant instead of re-fetched
 *
 *   All external HTTP for paper search/fetch goes through here.
 */

interface HostLimit {
  concurrency: number; // max simultaneous requests to this host
  minIntervalMs: number; // min spacing between request STARTS to this host
}

// Tuned to each API's published/observed limits. Unknown hosts get a safe default.
const HOST_LIMITS: Record<string, HostLimit> = {
  "api.openalex.org": { concurrency: 8, minIntervalMs: 0 },
  "api.crossref.org": { concurrency: 6, minIntervalMs: 0 },
  "www.ebi.ac.uk": { concurrency: 5, minIntervalMs: 0 }, // Europe PMC
  "api.semanticscholar.org": { concurrency: 1, minIntervalMs: 1200 },
  "export.arxiv.org": { concurrency: 1, minIntervalMs: 3000 },
  "api.core.ac.uk": { concurrency: 2, minIntervalMs: 400 },
  "api.unpaywall.org": { concurrency: 5, minIntervalMs: 0 },
};
const DEFAULT_LIMIT: HostLimit = { concurrency: 4, minIntervalMs: 0 };

const FETCH_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 10 * 60_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── per-host gate: a semaphore (concurrency) + pacing (minInterval) ──────────
interface Gate {
  active: number;
  lastStart: number;
  queue: (() => void)[];
}
const gates = new Map<string, Gate>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function acquire(host: string): Promise<() => void> {
  const limit = HOST_LIMITS[host] ?? DEFAULT_LIMIT;
  let g = gates.get(host);
  if (!g) {
    g = { active: 0, lastStart: 0, queue: [] };
    gates.set(host, g);
  }
  // Wait for a free concurrency slot.
  while (g.active >= limit.concurrency) {
    await new Promise<void>((res) => g!.queue.push(res));
  }
  g.active++;
  // Respect the minimum spacing between request starts.
  const wait = limit.minIntervalMs - (Date.now() - g.lastStart);
  if (wait > 0) await sleep(wait);
  g.lastStart = Date.now();
  return () => {
    g!.active--;
    const next = g!.queue.shift();
    if (next) next();
  };
}

// ── cache + in-flight dedup ──────────────────────────────────────────────────
type Kind = "json" | "text";
const cache = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(kind: Kind, url: string) {
  return `${kind}:${url}`;
}

// One attempt: acquires a slot, fetches, ALWAYS releases exactly once (in the
// finally), and returns a discriminated result so the caller decides on retry.
type Attempt = { kind: "value"; value: unknown } | { kind: "retry"; backoff: number } | { kind: "error"; error: Error };

async function attemptOnce(host: string, url: string, headers: Record<string, string>, want: Kind, attempt: number): Promise<Attempt> {
  const release = await acquire(host);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * 2 ** attempt);
      return { kind: "retry", backoff };
    }
    if (!res.ok) return { kind: "error", error: new Error(`HTTP ${res.status}`) };
    return { kind: "value", value: want === "json" ? await res.json() : await res.text() };
  } catch (e) {
    return { kind: "error", error: e instanceof Error ? e : new Error(String(e)) };
  } finally {
    clearTimeout(t);
    release(); // exactly once per acquire — the retry happens AFTER release
  }
}

async function doFetch(url: string, headers: Record<string, string>, kind: Kind): Promise<unknown> {
  const host = hostOf(url);
  for (let attempt = 0; ; attempt++) {
    const r = await attemptOnce(host, url, headers, kind, attempt);
    if (r.kind === "value") return r.value;
    if (r.kind === "retry" && attempt < MAX_RETRIES) {
      await sleep(r.backoff);
      continue;
    }
    throw r.kind === "error" ? r.error : new Error("HTTP 429 (max retries exceeded)");
  }
}

async function request(url: string, headers: Record<string, string>, kind: Kind): Promise<unknown> {
  const key = cacheKey(kind, url);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const pending = inflight.get(key);
  if (pending) return pending; // dedup identical concurrent requests

  const p = doFetch(url, headers, kind)
    .then((value) => {
      cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
  return request(url, { accept: "application/json", ...headers }, "json") as Promise<T>;
}

export function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  return request(url, headers, "text") as Promise<string>;
}
