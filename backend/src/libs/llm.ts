/**
 * backend/src/libs/llm.ts — the single place the agent gets its model handle.
 *
 *   Two providers, mirroring worklone / orpex-dashboard:
 *     · Databricks (OpenAI-compatible model serving) → **Claude Sonnet 4.6**,
 *       the default. Runs at {DATABRICKS_HOST}/serving-endpoints, Bearer token.
 *     · OpenRouter → every other model in the composer dropdown (open models).
 *
 *   The composer's model dropdown label maps to a provider + id below.
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "../env.ts";

// The default/primary model label — also the fallback when none is chosen.
// GLM 5.2 (OpenRouter, ~1M context window) is the primary: the Databricks Sonnet
// endpoint kept rejecting large replayed histories (~90k tokens) mid-run, which
// surfaced as the masked "An error occurred." run-stops. GLM's 1M window removes
// that ceiling. Sonnet stays selectable in the dropdown.
export const DEFAULT_MODEL_LABEL = "GLM 5.2";

interface ModelRef {
  provider: "databricks" | "openrouter";
  id: string; // Databricks: resolved from env.DATABRICKS_MODEL; OpenRouter: slug
}

// Display label (from the UI dropdown) → provider + model id.
// The primary/default is GLM 5.2 (OpenRouter, ~1M context); Sonnet (Databricks)
// stays available but is no longer the default. First key = dropdown default.
export const MODEL_MAP: Record<string, ModelRef> = {
  "GLM 5.2": { provider: "openrouter", id: "z-ai/glm-5.2" },
  "Claude Sonnet 4.6": { provider: "databricks", id: env.DATABRICKS_MODEL },
  "DeepSeek V4 Flash": { provider: "openrouter", id: "deepseek/deepseek-v4-flash" },
  "Llama 4 Maverick": { provider: "openrouter", id: "meta-llama/llama-4-maverick" },
  "Qwen 3.7 Plus": { provider: "openrouter", id: "qwen/qwen3.7-plus" },
};

// The dropdown order (first = default). Kept in sync with the UI composer.
export const MODEL_LABELS = Object.keys(MODEL_MAP);

// Context windows are read LIVE from OpenRouter's public models API — never
// hardcoded/assumed. Cached for 6h. A Databricks-hosted Claude maps to its
// Anthropic OpenRouter twin (same model → same window) for the lookup.
let orModelsCache: Record<string, number> | null = null;
let orModelsAt = 0;

async function openrouterContextLengths(): Promise<Record<string, number>> {
  if (orModelsCache && Date.now() - orModelsAt < 6 * 3_600_000) return orModelsCache;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = (await res.json()) as { data: { id: string; context_length: number }[] };
    orModelsCache = Object.fromEntries(json.data.map((m) => [m.id, m.context_length]));
    orModelsAt = Date.now();
  } catch {
    /* keep whatever we had cached */
  }
  return orModelsCache ?? {};
}

/** Resolve a UI label / raw slug to the OpenRouter model id whose window applies. */
function openrouterIdFor(label?: string): string | undefined {
  if (label && !MODEL_MAP[label] && label.includes("/")) return label; // raw slug
  const ref = (label && MODEL_MAP[label]) || MODEL_MAP[DEFAULT_MODEL_LABEL];
  if (ref.provider === "openrouter") return ref.id;
  // Databricks Claude → its Anthropic twin, e.g. "databricks-claude-sonnet-4-6"
  // → "anthropic/claude-sonnet-4.6".
  const m = ref.id.match(/claude-sonnet-(\d+)-(\d+)/);
  return m ? `anthropic/claude-sonnet-${m[1]}.${m[2]}` : undefined;
}

/** The model's real context window (tokens), from OpenRouter. 0 = unknown. */
export async function contextWindow(label?: string): Promise<number> {
  const env = Number(process.env.REAGENT_CONTEXT_WINDOW);
  if (env > 0) return env;
  const id = openrouterIdFor(label);
  const map = await openrouterContextLengths();
  return (id && map[id]) || 0;
}

function databricksProvider() {
  if (!env.DATABRICKS_TOKEN || !env.DATABRICKS_HOST) {
    throw new Error("DATABRICKS_TOKEN / DATABRICKS_HOST are not set — add them to .env to use Claude Sonnet 4.6.");
  }
  return createOpenAICompatible({
    name: "databricks",
    baseURL: `${env.DATABRICKS_HOST}/serving-endpoints`,
    apiKey: env.DATABRICKS_TOKEN,
  });
}

function openrouterProvider() {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set — add it to .env to use the OpenRouter models.");
  }
  return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
}

export function databricksConfigured(): boolean {
  return !!(env.DATABRICKS_TOKEN && env.DATABRICKS_HOST);
}

/** True if at least one provider is configured (the agent can run). */
export function llmConfigured(): boolean {
  return databricksConfigured() || !!env.OPENROUTER_API_KEY;
}

/**
 * Resolve a model to a LanguageModel. Accepts either a UI dropdown label
 * (MODEL_MAP) or a raw OpenRouter slug like "tencent/hy3" (anything containing a
 * "/" that isn't a known label). Defaults to Databricks Sonnet 4.6.
 */
export function getModel(label?: string): LanguageModel {
  // Ask OpenRouter to include token usage in the response — otherwise streaming
  // responses omit it and our real-usage tracking silently falls back to a guess.
  const OR_SETTINGS = { usage: { include: true } } as const;
  if (label && !MODEL_MAP[label] && label.includes("/")) {
    // Raw OpenRouter model id (e.g. "tencent/hy3", "tencent/hy3:free").
    return openrouterProvider().chat(label, OR_SETTINGS);
  }
  const ref = (label && MODEL_MAP[label]) || MODEL_MAP[DEFAULT_MODEL_LABEL];
  if (ref.provider === "databricks") return databricksProvider().chatModel(ref.id);
  return openrouterProvider().chat(ref.id, OR_SETTINGS);
}

// The fixed OpenRouter model subagents use when REAGENT_SUBAGENT_MODEL is unset.
// (The hang was never the model — it was an uncapped Retry-After sleep in
// science/connectors/http.ts; see backoffMs.)
export const DEFAULT_SUBAGENT_MODEL = "google/gemma-4-31b-it";

/**
 * The model subagents run on — ALWAYS an OpenRouter model, NEVER the primary
 * (Databricks) one. There is deliberately NO fallback to the primary: fanning
 * 5+ subagents at Databricks alongside the primary trips its rate limit and they
 * all time out (that was the "none of the subagents worked" bug — a long-lived
 * worker whose env never picked up REAGENT_SUBAGENT_MODEL silently fell back to
 * Databricks). REAGENT_SUBAGENT_MODEL overrides; otherwise we use a fixed
 * OpenRouter default, so a stale/un-propagated env can't reroute the fan-out.
 * (primaryLabel is accepted for call-site compatibility but intentionally ignored.)
 */
export function getSubagentModel(_primaryLabel?: string): LanguageModel {
  const sub = process.env.REAGENT_SUBAGENT_MODEL?.trim() || DEFAULT_SUBAGENT_MODEL;
  return getModel(sub);
}
