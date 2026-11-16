/**
 * backend/src/services/seed.ts — one-time seed of the demo research.
 *
 *   Runs at boot; no-ops if researches already exist. This is where the
 *   old hard-coded frontend fixtures now live as real DB rows so the app
 *   reads everything over the API instead of from component constants.
 */
import { nanoid } from "nanoid";
import { db, sqlite } from "../repositories/db-client.ts";
import { researches, papers, messages } from "../models/schema.ts";
import { searchPapers } from "./paper-search.ts";
import { log } from "../libs/logger.ts";

const RID = "r_meta_analysis";

const RAW_PAPERS: [string, string, string, string, number, string, string, boolean][] = [
  ["Scaling laws for retrieval-augmented language models", "Kaplan, Ito, Renner", "2024", "NeurIPS", 1284, "ML", "read", true],
  ["A meta-analysis of transfer learning in genomics", "Okoro, Vasquez, Lin", "2023", "Nat. Methods", 842, "Bio", "read", true],
  ["Uncertainty quantification in materials discovery", "Petrov, Aalto", "2024", "npj Comput. Mater.", 311, "Physics", "read", true],
  ["Benchmarking foundation models for climate downscaling", "Nakamura, Silva", "2025", "J. Climate", 97, "Climate", "reading", false],
  ["Effect sizes in reinforcement learning: a review", "Delgado, Roy", "2023", "JMLR", 528, "ML", "read", true],
  ["Single-cell atlases and batch correction revisited", "Haque, Bianchi, Osei", "2024", "Cell Systems", 406, "Bio", "read", true],
  ["Publication bias across ML benchmark leaderboards", "Fischer, Sun", "2024", "ICML", 219, "ML", "reading", false],
  ["Phase transitions in disordered spin glasses", "Moreau, Tanaka", "2022", "Phys. Rev. B", 733, "Physics", "unread", false],
  ["Attention as kernel regression: theory & practice", "Grewal, Abadi", "2023", "ICLR", 961, "ML", "read", true],
  ["Reproducibility of CRISPR screens meta-review", "Adeyemi, Costa", "2024", "eLife", 288, "Bio", "read", true],
  ["Neural operators for turbulent flow surrogates", "Volkov, Reyes", "2025", "Nat. Comput. Sci.", 144, "Physics", "reading", false],
  ["Extreme-event attribution with deep generative models", "Larsson, Mehta", "2024", "GRL", 176, "Climate", "unread", false],
  ["Data leakage in tabular deep learning benchmarks", "Chen, Wallace", "2023", "NeurIPS", 612, "ML", "read", true],
  ["Protein language models for enzyme design", "Suzuki, Bello", "2024", "Science", 1521, "Bio", "read", true],
  ["Bayesian optimization of perovskite synthesis", "Nam, Ferro", "2023", "Adv. Mater.", 395, "Physics", "unread", false],
  ["Bias correction in regional climate ensembles", "Owusu, Park", "2024", "Clim. Dyn.", 128, "Climate", "reading", false],
  ["Grokking and delayed generalization dynamics", "Idris, Weber", "2024", "ICML", 487, "ML", "read", true],
  ["Spatial transcriptomics deconvolution methods", "Rossi, Kang", "2023", "Nat. Biotech.", 521, "Bio", "unread", false],
  ["Topological defects in active nematics", "Beaumont, Cho", "2022", "PNAS", 344, "Physics", "unread", false],
  ["Carbon-cycle feedbacks in Earth system models", "Nkemelu, Tran", "2025", "Nat. Climate", 83, "Climate", "reading", false],
  ["Sparse autoencoders for interpretability at scale", "Marchetti, Yoon", "2025", "arXiv", 356, "ML", "read", true],
  ["Long-read assembly benchmarking across species", "Ahmadi, Cole", "2024", "Genome Res.", 264, "Bio", "unread", false],
];

const MESSAGES: [string, string, string, string, string[]][] = [
  ["user", "You", "I've selected 42 papers on effect sizes across ML, genomics, physics and climate. Run a random-effects meta-analysis and flag any publication bias.", "", []] as never,
  [
    "ai",
    "Research agent",
    "Reading the 42 selected papers now. I'll extract reported effect sizes and variances, pool them with a DerSimonian–Laird random-effects model, then test for small-study effects.\n\nStarting extraction — this touches methods sections and results tables in each PDF.",
    "",
    ["Kaplan 2024", "Delgado 2023", "Fischer 2024"],
  ] as never,
  [
    "ai",
    "Research agent",
    "Done. Pooled standardized effect g = 0.41 (95% CI 0.32–0.51) across 42 studies, with moderate heterogeneity (I² = 38%). Egger's test suggests possible publication bias (p = 0.03). Full breakdown and the forest plot are in the Outputs panel — I've also written the analysis to analysis.py so you can re-run it.",
    "",
    ["Fischer 2024", "Chen 2023"],
  ] as never,
];

function rid(prefix: string, i: number) {
  return `${prefix}_${RID}_${i}`;
}

type PaperRow = {
  id: string;
  researchId: string;
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  tag: string;
  status: string;
  selected: number;
  doi: string | null;
  abstract: string | null;
  pdfUrl: string | null;
};

/** Pull real papers (real DOIs/abstracts/PDFs) so the library isn't placeholder data.
 *  Falls back to the fictional list if the network is unavailable at boot. */
async function realOrFallbackPapers(): Promise<PaperRow[]> {
  const queries = ["retrieval augmented generation language models", "meta-analysis effect size genomics"];
  try {
    const batches = await Promise.all(queries.map((q) => searchPapers(q, 10)));
    const seen = new Set<string>();
    const rows: PaperRow[] = [];
    batches.flat().forEach((r) => {
      const key = r.doi ?? r.title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        id: `p_${nanoid(10)}`,
        researchId: RID,
        title: r.title,
        byline: r.authors.slice(0, 3).join(", ") + (r.authors.length > 3 ? " et al." : ""),
        year: r.year,
        venue: r.venue,
        citations: r.citations,
        tag: r.sources[0] ?? "openalex",
        status: "unread",
        selected: rows.length < 8 ? 1 : 0,
        doi: r.doi ?? null,
        abstract: r.abstract ?? null,
        pdfUrl: r.pdfUrl ?? null,
      });
    });
    if (rows.length >= 6) {
      log.info(`Seeded ${rows.length} real papers from live search`);
      return rows.slice(0, 18);
    }
  } catch (e) {
    log.warn("live paper seed failed — using fallback list", String(e));
  }
  return RAW_PAPERS.map((p, i) => ({
    id: rid("p", i),
    researchId: RID,
    title: p[0],
    byline: p[1],
    year: p[2],
    venue: p[3],
    citations: p[4],
    tag: p[5],
    status: p[6],
    selected: p[7] ? 1 : 0,
    doi: null,
    abstract: null,
    pdfUrl: null,
  }));
}

export async function seedIfEmpty(): Promise<void> {
  const existing = db.select({ id: researches.id }).from(researches).limit(1).all();
  if (existing.length > 0) return;

  const paperRows = await realOrFallbackPapers();

  const tx = sqlite.transaction(() => {
    db.insert(researches).values({
      id: RID,
      title: "Retrieval-Augmented Meta-Analysis",
      meta: "42 papers · 3 notebooks · 58 findings",
      status: "running",
      icon: "◈",
      color: "#2b5fd1",
      updatedLabel: "2m ago",
    }).run();

    db.insert(papers).values(paperRows).run();

    db.insert(messages).values(
      MESSAGES.map((m, i) => ({
        id: rid("m", i),
        researchId: RID,
        role: m[0],
        name: m[1],
        text: m[2],
        cites: JSON.stringify(m[4]),
        createdAt: Date.now() + i,
      })),
    ).run();

    // No demo findings/outputs — the right panel now reflects only REAL agent
    // work (documents it writes + files it produces in the compute workspace).
  });
  tx();
  log.info("Seeded demo research into SQLite");
}
