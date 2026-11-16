/**
 * backend/src/agent/agents.ts — the agent registry (mirrors openscience
 * backend/cli/src/agent/agent.ts).
 *
 *   One PRIMARY agent (`research`) that orchestrates, and six hidden SUBAGENTS
 *   it spawns via the `task` tool. Each agent declares: its mode, its system
 *   prompt, which tool slugs it may use, whether it may spawn further subagents,
 *   and its step budget. `toolPolicy` names the paper/connector skill slugs the
 *   agent is granted (plus the always-available `skill` loader); the primary
 *   also gets `task`.
 */
import {
  researchPrompt,
  literatureReviewPrompt,
  critiquePrompt,
  reviewerPrompt,
  writePrompt,
  explorePrompt,
  rankPrompt,
  reproducePrompt,
} from "./prompts.ts";

export type AgentMode = "primary" | "subagent";

export interface AgentDef {
  name: string;
  mode: AgentMode;
  description: string;
  color: string;
  /** Build the system prompt (the primary takes the workspace title). */
  prompt: (researchTitle?: string) => string;
  /** Paper/connector skill slugs this agent may call. "*" = all of them. */
  toolSlugs: string[] | "*";
  /** May this agent load skill packs via the `skill` tool? */
  canLoadSkills: boolean;
  /** May this agent spawn subagents via the `task` tool? (only the primary) */
  canSpawn: boolean;
  /** Step budget for its ReAct loop. */
  maxSteps: number;
}

// Read-only tools: search the scientific DBs + fetch URLs + read papers,
// working documents, workspace files, and the hypothesis board. (`science_*`/
// `webfetch` = 42-DB search; `get_paper` = full-text reader; `*_file(s)` = the
// compute workspace; `list_hypotheses`/`get_ratings` = read the tournament board.)
const READ_TOOLS = [
  "science_list_dbs", "science_search", "webfetch",
  "get_paper", "get_papers", "list_library", "list_docs", "read_doc",
  "read_file", "list_files", "glob_files", "grep_files",
  "list_hypotheses", "get_ratings",
];
// Full tools: reads + workspace writes + code execution + hypothesis-board writes.
const WRITE_TOOLS = [
  ...READ_TOOLS,
  "import_papers", "save_papers", "add_finding", "write_doc", "append_doc",
  "add_hypothesis", "update_hypothesis", "record_match",
  "write_file", "edit_file", "import_file", "save_base64_file", "bash", "run_python",
];
// The literature-review subagent is the one that actually discovers + verifies
// papers, so it needs to PERSIST them — otherwise the papers it finds are only
// returned as text and the workspace library stays empty. Reads + `save_papers`.
const LIT_REVIEW_TOOLS = [...READ_TOOLS, "save_papers"];
// The reproduce subagent turns a paper into a runnable repo via the `paper2code`
// skill: it reads the paper, writes code, and runs/debugs it in the sandbox.
// Reads + file writes + code execution (it also loads the skill via `skill`).
const REPRODUCE_TOOLS = [...READ_TOOLS, "write_file", "edit_file", "import_file", "save_base64_file", "bash", "run_python", "write_doc", "append_doc"];

export const AGENTS: Record<string, AgentDef> = {
  research: {
    name: "research",
    mode: "primary",
    description:
      "Primary research agent — scopes questions, reviews literature, reasons, analyzes, and synthesizes cited answers across any field.",
    color: "#06b6d4",
    prompt: researchPrompt,
    toolSlugs: "*",
    canLoadSkills: true,
    canSpawn: true,
    // Compute/analyze stages are long tool chains (write script → run → inspect →
    // critique → fix → record). 20 truncated a full COMPUTE turn mid-way; 60 lets
    // a stage complete and still finish with prose.
    maxSteps: 60,
  },

  "literature-review": {
    name: "literature-review",
    mode: "subagent",
    description:
      "PRISMA-style systematic literature search — finds, screens, and verifies real papers for one facet, returns a cited synthesis.",
    color: "#0e9f6e",
    prompt: () => literatureReviewPrompt,
    toolSlugs: LIT_REVIEW_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    maxSteps: 100,
  },

  critique: {
    name: "critique",
    mode: "subagent",
    description:
      "Read-only checklist auditor — finds BLOCKING errors (data leakage, bad stats, unsupported claims) in a methodology or result before a costly step.",
    color: "#c2416a",
    prompt: () => critiquePrompt,
    toolSlugs: READ_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    maxSteps: 100,
  },

  reviewer: {
    name: "reviewer",
    mode: "subagent",
    description:
      "Blind adversarial auditor of a finished output — catches citation mismatches, untraceable numbers, and stat mismatches.",
    color: "#c07806",
    prompt: () => reviewerPrompt,
    toolSlugs: READ_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    maxSteps: 100,
  },

  write: {
    name: "write",
    mode: "subagent",
    description:
      "Scientific writing specialist — produces a publication-ready Markdown document backed by verified citations.",
    color: "#7c58e6",
    prompt: () => writePrompt,
    toolSlugs: WRITE_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    maxSteps: 100,
  },

  explore: {
    name: "explore",
    mode: "subagent",
    description: "Fast search specialist — locates relevant papers and evidence in the workspace and literature.",
    color: "#47576a",
    prompt: () => explorePrompt,
    toolSlugs: READ_TOOLS,
    canLoadSkills: false,
    canSpawn: false,
    maxSteps: 100,
  },

  reproduce: {
    name: "reproduce",
    mode: "subagent",
    description:
      "Paper-to-code specialist — reproduces a paper as a runnable repository via the paper2code skill (plan → analyze → code → run/debug in the sandbox). Spawn it when the user wants a paper implemented as working code.",
    color: "#0d9488",
    prompt: () => reproducePrompt,
    toolSlugs: REPRODUCE_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    // A full reproduction is a long chain: fetch paper → plan → analyze → code →
    // run → debug loop. Each pipeline stage is its own bash step, so give it room.
    maxSteps: 120,
  },

  rank: {
    name: "rank",
    mode: "subagent",
    description:
      "Tournament judge — runs pairwise scientific debates over competing hypotheses and returns which the evidence favours, so the primary records the matches (Elo).",
    color: "#2563eb",
    prompt: () => rankPrompt,
    toolSlugs: READ_TOOLS,
    canLoadSkills: true,
    canSpawn: false,
    // A pairwise round over a small board: read the hypotheses + evidence, debate
    // each pairing, return the verdicts.
    maxSteps: 100,
  },
};

export const PRIMARY_AGENT = "research";

/** The subagents the primary may spawn (for the `task` tool description). */
export function spawnableAgents(): AgentDef[] {
  return Object.values(AGENTS).filter((a) => a.mode === "subagent");
}

export function getAgent(name?: string): AgentDef {
  return (name && AGENTS[name]) || AGENTS[PRIMARY_AGENT];
}
