/**
 * backend/src/env.ts — small typed environment surface.
 *
 * Keep the `env.X` shape stable across the codebase; never reach for
 * `process.env` elsewhere.
 */
export const env = {
  // ---- fixed ports (single source of truth: ports.env) ----
  WEB_PORT: Number(process.env.WEB_PORT || 5173), // vite / frontend
  PORT: Number(process.env.API_PORT || 8181), // hono / backend API
  REDIS_URL: process.env.REDIS_URL || `redis://127.0.0.1:${process.env.REDIS_PORT || 6379}`,
  // Reserved port range for per-research sandbox services (jupyter kernels, etc.).
  SANDBOX_PORT_BASE: Number(process.env.SANDBOX_PORT_BASE || 8200),
  SANDBOX_PORT_COUNT: Number(process.env.SANDBOX_PORT_COUNT || 50),

  DB_PATH: process.env.DB_PATH || "./data/app.db",
  NODE_ENV: process.env.NODE_ENV || "development",

  // Public origins — used to build the Composio "Continue with Google" redirect
  // round-trip (see routes/auth.ts). Override in prod; default to the fixed dev ports.
  APP_ORIGIN: process.env.APP_ORIGIN || `http://localhost:${process.env.WEB_PORT || 5173}`,
  API_ORIGIN: process.env.API_ORIGIN || `http://localhost:${process.env.API_PORT || 8181}`,

  // ---- concurrency / scaling limits (safe defaults; tune per host) ----
  WORKER_CONCURRENCY: Number(process.env.REAGENT_WORKER_CONCURRENCY) || 4, // agent runs at once / worker
  MAX_TASKS_PER_USER: Number(process.env.REAGENT_MAX_TASKS_PER_USER) || 5, // queued+running per user (backpressure)
  RUN_MAX_MS: Number(process.env.REAGENT_RUN_MAX_MS) || 2 * 60 * 60 * 1000, // wall-clock ceiling for a single run
  MAX_SANDBOXES: Number(process.env.REAGENT_MAX_SANDBOXES) || 12, // concurrent Docker sandbox containers/host
  SANDBOX_IDLE_MS: Number(process.env.REAGENT_SANDBOX_IDLE_MS) || 15 * 60 * 1000, // reap a container idle this long
  RATE_LIMIT_MAX: Number(process.env.REAGENT_RATE_LIMIT_MAX) || 240, // inbound API requests per window per caller
  RATE_LIMIT_WINDOW_MS: Number(process.env.REAGENT_RATE_LIMIT_WINDOW_MS) || 60_000,

  // LLM providers. The default model (Claude Sonnet 4.6) runs on a Databricks
  // model-serving endpoint (OpenAI-compatible); every other dropdown model runs
  // on OpenRouter. Same setup as worklone / orpex-dashboard.
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DATABRICKS_TOKEN: process.env.DATABRICKS_TOKEN,
  DATABRICKS_HOST: (process.env.DATABRICKS_HOST || "").replace(/\/+$/, ""), // strip trailing slash
  DATABRICKS_MODEL: process.env.DATABRICKS_MODEL || "databricks-claude-sonnet-4-6",
};
