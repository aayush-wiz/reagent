/**
 * backend/src/sandbox/manager.ts — the research agent's sandbox.
 *
 *   One Docker container per research is the agent's computer. It is built from
 *   the `reagent-sandbox` image (scientific Python stack pre-installed) with a
 *   fixed, recognizable layout:
 *
 *     /reagent/workspace   the working dir  (bind-mount data/workspaces/<id>)
 *     /reagent/toolkit     helper scripts   (baked into the image)
 *     /reagent/library     the research's papers (bind-mount .../<id>/.library)
 *
 *   This is the single sandbox architecture: it runs identically on a laptop
 *   (local Docker), our server, or a user's self-host — only the Docker daemon
 *   location changes (DOCKER_HOST). No cloud, no keys.
 *
 *   We drive Docker through its CLI (no extra dependency). Containers are lazily
 *   started on first use and kept warm; exec/runCode/fs operate inside them.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../libs/logger.ts";
import { env } from "../env.ts";
import { makeRedis } from "../queue/redis.ts";
import { workspaceDir } from "../services/workspace-fs.ts";

const IMAGE = process.env.REAGENT_SANDBOX_IMAGE || "reagent-sandbox:latest";
const HERE = dirname(fileURLToPath(import.meta.url));
// backend/src/sandbox/image — the Docker build context (Dockerfile + toolkit).
const BUILD_CONTEXT = resolve(HERE, "image");
const CONTAINER_PREFIX = "reagent-sbx-";
const MAX_OUTPUT = 30_000;

// The bundled skill packs (skills/<category>/<name>/) — mounted read-only into
// the sandbox so the agent can run a skill's shipped scripts (exa-search, etc.).
const SKILLS_DIR = resolve(process.cwd(), "skills");

// Host env keys the skill scripts read (Exa web search, OpenRouter-backed search,
// etc.). Only the ones actually set are forwarded into the container — an explicit
// allowlist, never the whole host env (so DB creds and the like never leak in).
const SKILL_ENV_KEYS = [
  "EXA_API_KEY", "OPENROUTER_API_KEY", "PERPLEXITY_API_KEY", "PARALLEL_API_KEY",
  "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY",
  "FAL_KEY", "HF_TOKEN", "TAVILY_API_KEY", "SERPER_API_KEY", "SERPAPI_API_KEY",
  "FIRECRAWL_API_KEY", "BRAVE_API_KEY",
];
function skillEnvArgs(): string[] {
  return SKILL_ENV_KEYS.filter((k) => process.env[k]).flatMap((k) => ["-e", `${k}=${process.env[k]}`]);
}

function containerName(researchId: string): string {
  return CONTAINER_PREFIX + researchId;
}

/** Host dir that bind-mounts to /reagent/library inside the sandbox. */
export function libraryDir(researchId: string): string {
  const dir = join(workspaceDir(researchId), ".library");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Run a host process, capturing stdout+stderr. */
function sh(cmd: string, args: string[], opts: { input?: string; timeoutMs?: number } = {}): Promise<{ code: number; out: string }> {
  return new Promise((resolveP) => {
    const child = spawn(cmd, args, { env: process.env });
    let out = "";
    let killed = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          killed = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;
    const onData = (d: Buffer) => {
      if (out.length < MAX_OUTPUT) out += d.toString();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      resolveP({ code: -1, out: `Failed to start ${cmd}: ${e.message}` });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const trimmed = out.length > MAX_OUTPUT ? out.slice(0, MAX_OUTPUT) + "\n… (output truncated)" : out;
      resolveP({ code: killed ? 124 : code ?? 0, out: trimmed + (killed ? `\n[killed: timeout]` : "") });
    });
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

let dockerOk: boolean | null = null;
let imageReady = false;
const starting = new Map<string, Promise<void>>();

// ---- sandbox pool bounds (cross-process via Redis) --------------------------
// Containers used to accumulate forever (stopSandbox was never called). Now they
// are bounded two ways: a hard cap (evict the least-recently-used idle container
// when starting a new one at the cap) and an idle reaper (stop any container
// unused for SANDBOX_IDLE_MS). "Last used" lives in a Redis sorted set so the API
// and worker processes share one view. Reaping is safe: the workspace/library are
// host bind-mounts, so a reaped container just cold-starts on its next use.
const LRU_KEY = "reagent:sbx:lru";
let redisConn: ReturnType<typeof makeRedis> | null = null;
const redis = () => (redisConn ??= makeRedis());

/** Record that a research's sandbox was just used (shared across processes). */
async function touch(researchId: string): Promise<void> {
  try {
    await redis().zadd(LRU_KEY, Date.now(), researchId);
  } catch {
    /* best-effort — never fail a sandbox op on a Redis touch hiccup */
  }
}

/** Number of running reagent sandbox containers (Docker is the source of truth). */
async function runningSandboxCount(): Promise<number> {
  const { code, out } = await sh("docker", ["ps", "-q", "--filter", "label=reagent.sandbox=1"], { timeoutMs: 8000 });
  return code === 0 ? out.split("\n").filter((l) => l.trim()).length : 0;
}

/** Evict the least-recently-used idle sandbox to make room (called at the cap). */
async function evictForCapacity(exceptResearchId: string): Promise<void> {
  try {
    const ids = await redis().zrange(LRU_KEY, 0, 30); // oldest-used first
    for (const id of ids) {
      if (id === exceptResearchId || starting.has(id)) continue;
      await stopSandbox(id);
      await redis().zrem(LRU_KEY, id);
      log.info(`sandbox: evicted LRU idle container for ${id} (at cap ${env.MAX_SANDBOXES})`);
      return;
    }
  } catch (e) {
    log.warn("sandbox: capacity eviction failed", String(e));
  }
}

let reaperStarted = false;
/** Start the idle-sandbox reaper. Call once, from the worker process. Stops any
 *  container unused for SANDBOX_IDLE_MS so containers can't accumulate forever. */
export function startSandboxReaper(): void {
  if (reaperStarted) return;
  reaperStarted = true;
  const tick = async () => {
    try {
      const cutoff = Date.now() - env.SANDBOX_IDLE_MS;
      const stale = await redis().zrangebyscore(LRU_KEY, "-inf", cutoff);
      for (const id of stale) {
        if (starting.has(id)) continue;
        await stopSandbox(id);
        await redis().zrem(LRU_KEY, id);
        log.info(`sandbox: reaped idle container for ${id} (idle > ${Math.round(env.SANDBOX_IDLE_MS / 60000)}m)`);
      }
    } catch (e) {
      log.warn("sandbox: reaper tick failed", String(e));
    }
  };
  const t = setInterval(tick, 60_000);
  t.unref?.();
  log.info(`sandbox: idle reaper started (cap ${env.MAX_SANDBOXES}, idle ${Math.round(env.SANDBOX_IDLE_MS / 60000)}m)`);
}

/** Is a usable Docker daemon reachable? (cached) */
export async function dockerAvailable(): Promise<boolean> {
  if (dockerOk !== null) return dockerOk;
  const { code } = await sh("docker", ["info"], { timeoutMs: 8000 });
  dockerOk = code === 0;
  if (!dockerOk) log.warn("sandbox: Docker daemon not reachable — start Docker Desktop to enable the compute sandbox");
  return dockerOk;
}

/** Build the sandbox image if it isn't present yet. */
async function ensureImage(): Promise<void> {
  if (imageReady) return;
  const { code } = await sh("docker", ["image", "inspect", IMAGE], { timeoutMs: 10_000 });
  if (code === 0) {
    imageReady = true;
    return;
  }
  log.info(`sandbox: building image ${IMAGE} (first run, ~1-2 min)…`);
  const t0 = Date.now();
  const { code: bcode, out } = await sh(
    "docker",
    ["build", "-t", IMAGE, "-f", join(BUILD_CONTEXT, "reagent-sandbox.Dockerfile"), BUILD_CONTEXT],
    { timeoutMs: 600_000 },
  );
  if (bcode !== 0) throw new Error(`sandbox image build failed:\n${out.slice(-2000)}`);
  imageReady = true;
  log.info(`sandbox: image ${IMAGE} built in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

/** True if the research's container exists and is running. */
async function isRunning(researchId: string): Promise<boolean> {
  const { code, out } = await sh("docker", ["inspect", "-f", "{{.State.Running}}", containerName(researchId)], { timeoutMs: 8000 });
  return code === 0 && out.trim() === "true";
}

/**
 * Ensure the research's sandbox container is up (lazy start, deduped). Bind-mounts
 * the workspace and library dirs so files persist and the corpus is visible.
 */
export async function ensureSandbox(researchId: string): Promise<void> {
  if (!(await dockerAvailable())) throw new Error("Docker is not running — start Docker Desktop to use the compute sandbox.");
  if (starting.has(researchId)) return starting.get(researchId)!;
  const p = (async () => {
    await ensureImage();
    if (await isRunning(researchId)) {
      await touch(researchId); // already up — just mark it recently used
      return;
    }
    const name = containerName(researchId);
    // Remove a stale (stopped) container of the same name, if any.
    await sh("docker", ["rm", "-f", name], { timeoutMs: 10_000 });
    // Enforce the concurrent-container cap before starting a new one.
    if ((await runningSandboxCount()) >= env.MAX_SANDBOXES) await evictForCapacity(researchId);
    const ws = workspaceDir(researchId);
    const lib = libraryDir(researchId);
    // Scaffold the recognizable layout host-side (the bind-mount hides the
    // image's pre-made dirs), so scripts/ data/ outputs/ figures/ always exist.
    for (const d of ["scripts", "data", "outputs", "figures"]) mkdirSync(join(ws, d), { recursive: true });
    const { code, out } = await sh(
      "docker",
      [
        "run", "-d", "--name", name,
        "--label", "reagent.sandbox=1",
        "--label", `reagent.research=${researchId}`,
        "-v", `${ws}:/reagent/workspace`,
        "-v", `${lib}:/reagent/library`,
        "-v", `${SKILLS_DIR}:/reagent/skills:ro`,
        "-w", "/reagent/workspace",
        // Resource guards so a runaway script can't take the host down.
        "--memory", process.env.REAGENT_SANDBOX_MEM || "2g",
        "--cpus", process.env.REAGENT_SANDBOX_CPUS || "2",
        "--pids-limit", "512",
        // Skill API keys (Exa etc.) — allowlisted, only those actually set.
        ...skillEnvArgs(),
        IMAGE,
      ],
      { timeoutMs: 60_000 },
    );
    if (code !== 0) throw new Error(`failed to start sandbox container:\n${out.slice(-1500)}`);
    await touch(researchId); // freshly started — mark recently used
    // Populate the library kit (corpus) — dynamic import avoids a load-time cycle.
    try {
      const { syncLibrary } = await import("./library-sync.ts");
      const n = syncLibrary(researchId);
      log.info(`sandbox: started ${name} · synced ${n} papers to /reagent/library`);
    } catch (e) {
      log.warn(`sandbox: library sync failed for ${name}`, String(e));
    }
  })();
  starting.set(researchId, p);
  try {
    await p;
  } finally {
    starting.delete(researchId);
  }
}

/** Run a shell command inside the research's sandbox. */
export async function sandboxExec(researchId: string, command: string, timeoutMs = 120_000): Promise<string> {
  await ensureSandbox(researchId);
  const { out } = await sh(
    "docker",
    ["exec", "-w", "/reagent/workspace", containerName(researchId), "bash", "-lc", command],
    { timeoutMs },
  );
  return out || "(no output)";
}

/** Run a Python snippet inside the research's sandbox (via stdin to python3). */
export async function sandboxRunPython(researchId: string, code: string, timeoutMs = 120_000): Promise<string> {
  await ensureSandbox(researchId);
  const { out } = await sh(
    "docker",
    ["exec", "-i", "-w", "/reagent/workspace", containerName(researchId), "python", "-"],
    { input: code, timeoutMs },
  );
  return out || "(no output)";
}

/** Stop and remove a research's sandbox container. */
export async function stopSandbox(researchId: string): Promise<void> {
  await sh("docker", ["rm", "-f", containerName(researchId)], { timeoutMs: 15_000 });
}
