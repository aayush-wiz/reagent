import type { z } from "zod";

/** Context every skill runs in (the workspace it's acting on). */
export interface SkillCtx {
  researchId?: string;
  /** The run/task id — lets a human-in-the-loop tool (ask_user) key its wait
   *  for the answer that the API delivers back over Redis. */
  taskId?: string;
}

/** A single agent capability — the openscience "skill" unit. Converted to a
 *  Vercel AI SDK tool in the registry. */
export interface Skill {
  slug: string;
  category: string;
  description: string;
  inputSchema: z.ZodType;
  run: (args: Record<string, unknown>, ctx: SkillCtx) => Promise<string> | string;
}
