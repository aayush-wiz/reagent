/**
 * backend/src/skills/loader.ts — reads the openscience skill catalog off disk.
 *
 *   The 292 skills live in ./skills/<category>/<name>/SKILL.md (Anthropic Agent
 *   Skills format: YAML frontmatter + supporting scripts/references). We scan
 *   them once, parse the frontmatter, and expose a catalog the API serves live —
 *   nothing hardcoded.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "../libs/logger.ts";

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  tags: string[];
  location: string; // relative path to the skill folder
}

const SKILLS_DIR = join(process.cwd(), "skills");

/** Strip matching surrounding quotes from a scalar value. */
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Minimal YAML-frontmatter parse for the top-level keys we need. Handles
 * quoted scalars and block scalars (`>` folded / `|` literal), which the
 * K-Dense skills use for multi-line descriptions.
 */
function parseFrontmatter(md: string): Record<string, string> {
  if (!md.startsWith("---")) return {};
  const end = md.indexOf("\n---", 3);
  if (end === -1) return {};
  const lines = md.slice(3, end).split("\n");
  const out: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^\s/.test(line)) continue; // skip nested (metadata:) lines
    const c = line.indexOf(":");
    if (c === -1) continue;
    const key = line.slice(0, c).trim();
    if (!key) continue;
    const raw = line.slice(c + 1).trim();
    // Block scalar: `>` folds newlines to spaces, `|` keeps them. Collect the
    // following indented lines until dedent.
    if (raw === ">" || raw === "|" || raw === ">-" || raw === "|-" || raw === ">+" || raw === "|+") {
      const fold = raw[0] === ">";
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].trim() !== "" && !/^\s/.test(lines[j])) break; // dedent → end
        body.push(lines[j].replace(/^\s+/, ""));
      }
      i = j - 1;
      out[key] = body.join(fold ? " " : "\n").replace(/\s+/g, " ").trim();
      continue;
    }
    out[key] = unquote(raw);
  }
  return out;
}

let cache: SkillInfo[] | null = null;

export function loadSkills(): SkillInfo[] {
  if (cache) return cache;
  const skills: SkillInfo[] = [];
  if (!existsSync(SKILLS_DIR)) {
    log.warn(`skills dir not found at ${SKILLS_DIR}`);
    cache = [];
    return cache;
  }
  for (const category of readdirSync(SKILLS_DIR)) {
    const catDir = join(SKILLS_DIR, category);
    if (!statSync(catDir).isDirectory()) continue;
    for (const name of readdirSync(catDir)) {
      const skillDir = join(catDir, name);
      const mdPath = join(skillDir, "SKILL.md");
      if (!existsSync(mdPath)) continue;
      try {
        const fm = parseFrontmatter(readFileSync(mdPath, "utf8"));
        skills.push({
          name: fm.name || name,
          description: fm.description || "",
          category: fm.category || category,
          tags: fm.tags ? fm.tags.replace(/[[\]]/g, "").split(",").map((t) => t.trim()).filter(Boolean) : [],
          location: `skills/${category}/${name}`,
        });
      } catch (e) {
        log.warn(`failed to read skill ${category}/${name}`, String(e));
      }
    }
  }
  skills.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  cache = skills;
  log.info(`Loaded ${skills.length} skills from ${SKILLS_DIR}`);
  return skills;
}

/** Full SKILL.md markdown for a single skill (for the detail view). */
export function readSkillDoc(name: string): { skill: SkillInfo; markdown: string } | null {
  const skill = loadSkills().find((s) => s.name === name);
  if (!skill) return null;
  const mdPath = join(process.cwd(), skill.location, "SKILL.md");
  if (!existsSync(mdPath)) return null;
  return { skill, markdown: readFileSync(mdPath, "utf8") };
}

export function skillsByCategory(): Record<string, SkillInfo[]> {
  const m: Record<string, SkillInfo[]> = {};
  for (const s of loadSkills()) (m[s.category] ??= []).push(s);
  return m;
}

/**
 * Keyword/relevance search across every skill's name, description, tags, and
 * category — so the agent can *find* the right pack ("web search", "market
 * report") instead of having to guess a category and browse. Returns the top
 * matches, most relevant first. Nothing hardcoded: it scores over the live
 * catalog read off disk.
 */
export function searchSkills(query: string, limit = 8): SkillInfo[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const scored = loadSkills().map((s) => {
    const name = s.name.toLowerCase();
    const desc = s.description.toLowerCase();
    const tags = s.tags.join(" ").toLowerCase();
    const cat = s.category.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (name === t) score += 12;
      else if (name.includes(t)) score += 6;
      if (desc.includes(t)) score += 2;
      if (tags.includes(t)) score += 2;
      if (cat.includes(t)) score += 1;
    }
    return { s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}
