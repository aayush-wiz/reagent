/**
 * backend/src/agent/registry.ts — assemble an agent's ToolSet.
 *
 *   Per agent, we grant: the paper/connector skill tools it's allowed
 *   (AgentDef.toolSlugs), the `skill` loader over the 292 packs (if it may load
 *   skills), the `task` subagent spawner (primary only), and any MCP tools.
 *   Mirrors openscience's per-agent tool filtering by permission.
 */
import { tool, type ToolSet } from "ai";
import { paperSkills } from "./skills/papers.ts";
import { connectorSkills } from "./skills/connectors.ts";
import { documentSkills } from "./skills/documents.ts";
import { hypothesisSkills } from "./skills/hypotheses.ts";
import { scienceSkills } from "./skills/science.ts";
import { fileSkills } from "./skills/files.ts";
import { execSkills, execEnabled } from "./skills/exec.ts";
import { publishSkills } from "./skills/publish.ts";
import { mcpTools, mcpCatalog } from "./mcp.ts";
import { makeSkillTool } from "./skill-tool.ts";
import { makeTaskTool } from "./task.ts";
import { makeAskUserTool } from "./ask-tool.ts";
import { getAgent, type AgentDef } from "./agents.ts";
import type { Skill, SkillCtx } from "./types.ts";

// STASHED tools — kept in the codebase but not given to the agent. Our custom
// `search_papers` fan-out is superseded by openscience's `science_search` over
// the connector registry (backend/src/science/connectors, 42 DBs).
const STASHED = new Set(["search_papers"]);

// The legacy hand-rolled bio-lookup skills are now redundant with `science_search`
// (uniprot/pubchem/pdb/ensembl/chembl are all connectors); enable only if asked.
const bioPackEnabled = /^(1|true|yes)$/i.test(process.env.REAGENT_BIO_PACK || "");

export const ALL_SKILLS: Skill[] = [
  ...paperSkills.filter((s) => !STASHED.has(s.slug)), // get_paper, import_papers, list_library, add_finding
  ...documentSkills, // list_docs, read_doc, write_doc, append_doc
  ...hypothesisSkills, // add/update/list_hypotheses, record_match, get_ratings ← the Strong-Inference tournament board
  ...scienceSkills, // science_list_dbs, science_search, webfetch  ← 42-DB search
  ...fileSkills, // read_file, write_file, edit_file, list_files, glob_files, grep_files
  ...(execEnabled ? execSkills : []), // bash, run_python — gated by REAGENT_ENABLE_EXEC
  ...publishSkills, // publish_site — hosts a web page the agent authored (no sandbox needed)
  ...(bioPackEnabled ? connectorSkills : []),
];

export function skillCatalog() {
  return ALL_SKILLS.map((s) => ({ slug: s.slug, category: s.category, description: s.description }));
}

/** Build the toolset for a given agent, scoped to a workspace. */
export async function buildToolSet(ctx: SkillCtx, agent: AgentDef = getAgent(), model?: string): Promise<ToolSet> {
  const local: ToolSet = {};

  // Paper/connector skill tools this agent is allowed to call.
  const allow = agent.toolSlugs;
  for (const s of ALL_SKILLS) {
    if (allow !== "*" && !allow.includes(s.slug)) continue;
    local[s.slug] = tool({
      description: s.description,
      inputSchema: s.inputSchema,
      execute: async (args) => String(await s.run(args as Record<string, unknown>, ctx)),
    });
  }

  // The `skill` loader (progressive disclosure over the 292 packs).
  if (agent.canLoadSkills) local.skill = makeSkillTool();

  // The `task` spawner — primary agent only (no subagent nesting).
  if (agent.canSpawn) local.task = makeTaskTool(ctx, model);

  // `ask_user` — human-in-the-loop, primary agent only. Subagents run
  // autonomously and cannot ask the user (their prompts say so), so only the
  // orchestrating primary can pause the run for a question.
  if (agent.mode === "primary") local.ask_user = makeAskUserTool(ctx);

  // MCP tools (external servers) — available to every agent.
  const mcp = await mcpTools();
  return { ...local, ...mcp };
}

export { mcpCatalog };
