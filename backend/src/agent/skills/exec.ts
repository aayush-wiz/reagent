/**
 * backend/src/agent/skills/exec.ts — the agent's code-execution tools.
 *
 *   `bash` runs a shell command and `run_python` runs a Python snippet, both
 *   with their working directory pinned to the research's compute workspace
 *   (services/workspace-fs). This is the capability openscience gets from its
 *   Bun `bash`/notebook tools — running skill scripts, statistical analysis,
 *   and figure generation.
 *
 *   SECURITY: these execute real commands on the host (scoped cwd, but a shell
 *   can still reach outside via absolute paths). That's the point of a local
 *   research tool — but only enable it where you trust the operator. Gate with
 *   REAGENT_ENABLE_EXEC=1.
 */
import { z } from "zod";
import type { Skill } from "../types.ts";
import { sandboxExec, sandboxRunPython } from "../../sandbox/manager.ts";

export const execEnabled = /^(1|true|yes)$/i.test(process.env.REAGENT_ENABLE_EXEC || "");

export const execSkills: Skill[] = [
  {
    slug: "bash",
    category: "compute",
    description:
      "Run a shell command inside this research's sandbox (an isolated container). cwd is /reagent/workspace. " +
      "Use for running scripts, installing packages (pip), moving files, and inspecting outputs. The workspace " +
      "(scripts/ data/ outputs/ figures/) persists across calls; the paper corpus is at /reagent/library/papers.jsonl. " +
      "Bundled skill packs (with their scripts) are mounted read-only at /reagent/skills/<category>/<name>/ — run a " +
      "loaded skill's scripts from there; their API keys (EXA_API_KEY, etc.) are already in the environment. " +
      "Long output is truncated.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to run, e.g. 'python scripts/analysis.py' or 'ls -la figures'."),
      timeout: z.number().int().positive().optional().describe("Timeout in seconds (default 120)."),
    }),
    run: async (args, ctx) => {
      if (!ctx.researchId) return "No active research — the sandbox needs a workspace.";
      const timeoutMs = Math.min((typeof args.timeout === "number" ? args.timeout : 120) * 1000, 600_000);
      try {
        return await sandboxExec(ctx.researchId, String(args.command), timeoutMs);
      } catch (e) {
        return String(e);
      }
    },
  },
  {
    slug: "run_python",
    category: "compute",
    description:
      "Run a Python snippet inside this research's sandbox. The scientific stack (numpy, scipy, pandas, matplotlib, " +
      "seaborn, scikit-learn, statsmodels, networkx, biopython) is pre-installed. Save figures to figures/ and data " +
      "to outputs/; read the corpus from /reagent/library/papers.jsonl. Output is stdout+stderr.",
    inputSchema: z.object({
      code: z.string().describe("Python source to execute."),
      timeout: z.number().int().positive().optional(),
    }),
    run: async (args, ctx) => {
      if (!ctx.researchId) return "No active research — the sandbox needs a workspace.";
      const timeoutMs = Math.min((typeof args.timeout === "number" ? args.timeout : 120) * 1000, 600_000);
      try {
        return await sandboxRunPython(ctx.researchId, String(args.code), timeoutMs);
      } catch (e) {
        return String(e);
      }
    },
  },
];
