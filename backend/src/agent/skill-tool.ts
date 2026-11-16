/**
 * backend/src/agent/skill-tool.ts — the `skill` tool (mirrors openscience
 * backend/cli/src/tool/skill.ts).
 *
 *   Progressive disclosure over the 292 bundled skill packs: the tool's
 *   description advertises the categories; calling it with a `category` browses
 *   that category's skills; calling it with a `name` loads that pack's full
 *   SKILL.md body into context. This is how the agent "loads a skill before
 *   doing the work", exactly as the openscience research prompt instructs.
 */
import { tool } from "ai";
import { z } from "zod";
import { loadSkills, readSkillDoc, skillsByCategory, searchSkills } from "../skills/loader.ts";

// Lightweight fuzzy score for a "did you mean?" hint (ported from openscience).
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 1;
  if (t.includes(q) || q.includes(t)) return 0.8;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const qb = bigrams(q);
  const tb = bigrams(t);
  if (qb.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const b of qb) if (tb.has(b)) shared++;
  return (2 * shared) / (qb.size + tb.size);
}

export function makeSkillTool() {
  const byCat = skillsByCategory();
  const categories = Object.keys(byCat).sort();
  const catLine = categories.map((c) => `${c} (${byCat[c].length})`).join(", ");

  return tool({
    description:
      `Load a skill pack (an instruction bundle with proven workflows) before doing domain work. ` +
      `The BEST way to find one is \`query\` — a keyword search over all ${loadSkills().length} skills ` +
      `(e.g. \`skill(query: "web search")\`, \`skill(query: "market research report")\`). ` +
      `Then load the best match with \`name\`. You can also \`category\`-browse. ` +
      `The catalog spans ${categories.length} categories: ${catLine} — not just science: it includes ` +
      `general web-search and report-writing packs. Search first, then load.`,
    inputSchema: z.object({
      query: z.string().optional().describe("Keyword search to FIND the right skill(s), e.g. \"web search\", \"market report\". Best starting point."),
      name: z.string().optional().describe("Exact skill name to load its full SKILL.md instructions."),
      category: z.string().optional().describe("Category to browse (returns the skills in it)."),
    }),
    execute: async ({ query, name, category }) => {
      // Search mode — find skills by keyword across name + description + tags.
      if (query && !name) {
        const hits = searchSkills(query, 8);
        if (!hits.length) return `No skills matched "${query}". Browse a category instead — one of: ${categories.join(", ")}.`;
        const listing = hits
          .map((s) => `- **${s.name}** (${s.category}): ${s.description.slice(0, 150)}${s.description.length > 150 ? "…" : ""}`)
          .join("\n");
        return `## Skills matching "${query}" (${hits.length})\nLoad one with skill(name: "…").\n\n${listing}`;
      }

      // Browse mode.
      if (category && !name) {
        const cat = category.toLowerCase();
        const matched = byCat[cat] ?? byCat[categories.find((c) => c.toLowerCase() === cat) ?? ""];
        if (!matched?.length) return `No skills in category "${category}". Available: ${categories.join(", ")}`;
        const listing = matched
          .map((s) => `- **${s.name}**: ${s.description.slice(0, 140)}${s.description.length > 140 ? "…" : ""}`)
          .join("\n");
        return `## Category: ${cat} (${matched.length} skills)\nLoad one by calling skill(name: "…").\n\n${listing}`;
      }

      if (!name) return `Search with \`query\` (e.g. skill(query: "web search")), load with \`name\`, or browse a \`category\`. Categories: ${categories.join(", ")}`;

      const doc = readSkillDoc(name);
      if (!doc) {
        const all = loadSkills().map((s) => s.name);
        const top = all
          .map((n) => ({ n, s: fuzzyScore(name, n) }))
          .sort((a, b) => b.s - a.s)
          .filter((x) => x.s > 0)
          .slice(0, 5)
          .map((x) => x.n);
        return `Skill "${name}" not found.${top.length ? ` Did you mean: ${top.join(", ")}?` : ""}`;
      }
      // Strip frontmatter; return the body (progressive disclosure — level 2).
      const body = doc.markdown.replace(/^---[\s\S]*?---\n/, "").trim();
      return `## Skill: ${doc.skill.name}\n**Category**: ${doc.skill.category} · **In the sandbox**: /reagent/${doc.skill.location} (run its scripts/ from there with bash; API keys are already in the env)\n\n${body}`;
    },
  });
}
