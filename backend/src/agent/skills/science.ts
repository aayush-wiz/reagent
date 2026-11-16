/**
 * backend/src/agent/skills/science.ts — openscience's runtime tools, ported to
 * Reagent's Skill contract.
 *
 *   These mirror openscience exactly (backend/cli/src/tool/science.ts): instead
 *   of one tool per database, the agent discovers databases with
 *   `science_list_dbs` and searches any of them through the single
 *   `science_search` tool, backed by the connector registry
 *   (backend/src/science/connectors — 42 scientific DBs: literature, proteins,
 *   genomics, chemistry, structure, pathways, omics). Plus `webfetch` for reading
 *   a URL. This replaces our hand-rolled `search_papers` (now stashed).
 */
import { z } from "zod";
import type { Skill } from "../types.ts";
import { registry } from "../../science/connectors/index.ts";

function fmtHit(h: { id: string; title: string; summary?: string; url?: string }): string {
  const lines = [`**${h.title}**`, `id: ${h.id}${h.url ? ` · ${h.url}` : ""}`];
  if (h.summary) lines.push(h.summary.slice(0, 400));
  return lines.join("\n");
}

export const scienceSkills: Skill[] = [
  {
    slug: "science_list_dbs",
    category: "science",
    description:
      "List the scientific databases available to search via `science_search`. Returns each database's id, name, " +
      "domain, and description. Call this first to discover which `db` id to pass to `science_search`. Optional " +
      "`domain` filter (e.g. 'literature', 'chemistry', 'genomics', 'proteomics', 'structure', 'biology', 'clinical').",
    inputSchema: z.object({
      domain: z.string().optional().describe("Optional domain filter."),
    }),
    run: (args) => {
      const domain = args.domain ? String(args.domain).toLowerCase() : undefined;
      const cat = registry.catalog().filter((e) => !domain || e.domain === domain);
      if (!cat.length) {
        const domains = [...new Set(registry.catalog().map((e) => e.domain))].sort().join(", ");
        return `No databases${domain ? ` in domain "${domain}"` : ""}. Available domains: ${domains}.`;
      }
      const byDom: Record<string, string[]> = {};
      for (const e of cat) (byDom[e.domain] ??= []).push(`- **${e.id}** (${e.name}) — ${e.description}`);
      return Object.entries(byDom)
        .map(([d, rows]) => `### ${d}\n${rows.join("\n")}`)
        .join("\n\n");
    },
  },
  {
    slug: "science_search",
    category: "science",
    description:
      "Search a scientific database registered in the connector registry. Pass a `db` id (from `science_list_dbs`, " +
      "e.g. 'openalex', 'arxiv', 'pubmed', 'uniprot', 'rcsb-pdb', 'chembl') and a `query`. This is how you find " +
      "papers, proteins, structures, compounds, genes, and pathways.",
    inputSchema: z.object({
      db: z.string().describe("Database id to search (from science_list_dbs)."),
      query: z.string().describe("The search query."),
      limit: z.number().int().positive().optional().describe("Max results (default 10)."),
    }),
    run: async (args) => {
      const db = String(args.db);
      const connector = registry.get(db);
      if (!connector) {
        const available = registry
          .catalog()
          .map((e) => e.id)
          .join(", ");
        return `No database "${db}". Available: ${available}. Use science_list_dbs to browse.`;
      }
      const query = String(args.query);
      const limit = typeof args.limit === "number" ? args.limit : 10;
      try {
        const hits = await connector.search(query, { limit });
        if (!hits.length) return `No results for "${query}" in ${connector.name}.`;
        return `**${connector.name}** — ${hits.length} result(s) for "${query}":\n\n${hits.slice(0, limit).map(fmtHit).join("\n\n---\n\n")}`;
      } catch (e) {
        return `${connector.name} search failed for "${query}": ${e instanceof Error ? e.message : String(e)}. It may be rate-limited — retry shortly.`;
      }
    },
  },
  {
    slug: "webfetch",
    category: "web",
    description: "Fetch a URL and return its text content (HTML is stripped to plain text). Use to read a paper page, docs, or any web resource.",
    inputSchema: z.object({
      url: z.string().describe("The URL to fetch."),
    }),
    run: async (args) => {
      const url = String(args.url);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Reagent/1.0 (research agent)" } });
        clearTimeout(t);
        if (!res.ok) return `Failed to fetch ${url}: HTTP ${res.status}`;
        const ct = res.headers.get("content-type") ?? "";
        let text = await res.text();
        if (ct.includes("html")) {
          text = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        return text.slice(0, 12000) + (text.length > 12000 ? "\n\n…(truncated)" : "");
      } catch (e) {
        return `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
