import type { MenuItemVal, NavVal, PaperRaw, PaperStatus } from "../../components/workspace/types";

// ---- static paper corpus (this.all in the original DCLogic constructor) ----
const RAW_PAPERS: [string, string, string, string, number, string, PaperStatus][] = [
  ["Scaling laws for retrieval-augmented language models", "Kaplan, Ito, Renner", "2024", "NeurIPS", 1284, "ML", "read"],
  ["A meta-analysis of transfer learning in genomics", "Okoro, Vasquez, Lin", "2023", "Nat. Methods", 842, "Bio", "read"],
  ["Uncertainty quantification in materials discovery", "Petrov, Aalto", "2024", "npj Comput. Mater.", 311, "Physics", "read"],
  ["Benchmarking foundation models for climate downscaling", "Nakamura, Silva", "2025", "J. Climate", 97, "Climate", "reading"],
  ["Effect sizes in reinforcement learning: a review", "Delgado, Roy", "2023", "JMLR", 528, "ML", "read"],
  ["Single-cell atlases and batch correction revisited", "Haque, Bianchi, Osei", "2024", "Cell Systems", 406, "Bio", "read"],
  ["Publication bias across ML benchmark leaderboards", "Fischer, Sun", "2024", "ICML", 219, "ML", "reading"],
  ["Phase transitions in disordered spin glasses", "Moreau, Tanaka", "2022", "Phys. Rev. B", 733, "Physics", "unread"],
  ["Attention as kernel regression: theory & practice", "Grewal, Abadi", "2023", "ICLR", 961, "ML", "read"],
  ["Reproducibility of CRISPR screens meta-review", "Adeyemi, Costa", "2024", "eLife", 288, "Bio", "read"],
  ["Neural operators for turbulent flow surrogates", "Volkov, Reyes", "2025", "Nat. Comput. Sci.", 144, "Physics", "reading"],
  ["Extreme-event attribution with deep generative models", "Larsson, Mehta", "2024", "GRL", 176, "Climate", "unread"],
  ["Data leakage in tabular deep learning benchmarks", "Chen, Wallace", "2023", "NeurIPS", 612, "ML", "read"],
  ["Protein language models for enzyme design", "Suzuki, Bello", "2024", "Science", 1521, "Bio", "read"],
  ["Bayesian optimization of perovskite synthesis", "Nam, Ferro", "2023", "Adv. Mater.", 395, "Physics", "unread"],
  ["Bias correction in regional climate ensembles", "Owusu, Park", "2024", "Clim. Dyn.", 128, "Climate", "reading"],
  ["Grokking and delayed generalization dynamics", "Idris, Weber", "2024", "ICML", 487, "ML", "read"],
  ["Spatial transcriptomics deconvolution methods", "Rossi, Kang", "2023", "Nat. Biotech.", 521, "Bio", "unread"],
  ["Topological defects in active nematics", "Beaumont, Cho", "2022", "PNAS", 344, "Physics", "unread"],
  ["Carbon-cycle feedbacks in Earth system models", "Nkemelu, Tran", "2025", "Nat. Climate", 83, "Climate", "reading"],
  ["Sparse autoencoders for interpretability at scale", "Marchetti, Yoon", "2025", "arXiv", 356, "ML", "read"],
  ["Long-read assembly benchmarking across species", "Ahmadi, Cole", "2024", "Genome Res.", 264, "Bio", "unread"],
];

export const ALL_PAPERS: PaperRaw[] = RAW_PAPERS.map((r, i) => ({
  id: i,
  title: r[0],
  byline: r[1],
  year: r[2],
  venue: r[3],
  citations: r[4],
  tag: r[5],
  status: r[6],
}));

export const NAV_SECTIONS = ["chat", "researches", "tasks", "reports", "my-articles", "agents", "skills", "data", "notebooks", "findings", "papers", "collections", "tools", "docs"];

export const ITEM_DETAIL_SECTIONS = ["skills", "data", "findings", "papers", "collections", "tools"];

export const statusMap: Record<PaperStatus, [string, string]> = {
  read: ["#3a7d44", "AI read"],
  reading: ["#b07419", "reading"],
  unread: ["#b0aca4", "unread"],
};

export const navItems: [string, string, string, string][] = [
  ["chat", "Chat", "◇", ""],
  ["researches", "Researches", "◈", "7"],
  ["tasks", "Tasks", "▶", ""],
  ["reports", "Reports & Results", "▦", ""],
  // ["agents", "Agents", "✦", "5"], // hidden for now — revisit later
  ["skills", "Skills", "✦", "24"],
  ["data", "Data", "▦", "22"],
  // ["notebooks", "Notebooks", "❯", "12"], // hidden for now — revisit later
  ["findings", "Findings", "✓", "58"],
  ["papers", "Papers", "◫", "187"],
  // ["collections", "Collections", "▤", "9"], // hidden for now — revisit later
  ["tools", "Tools & MCP", "⚙", "18"],
  ["my-articles", "My Articles", "✎", ""],
];

export const navMeta: Record<string, [string, string]> = {
  chat: ["Chat", "Talk to the research agent — every chat becomes a research session"],
  researches: ["Researches", "7 active investigations across your library"],
  tasks: ["Tasks", "Async agent runs — they keep running in the background"],
  reports: ["Reports & Results", "Documents, plots and files generated across all your researches"],
  "my-articles": ["My Articles", "Articles you've published — write-ups the agent drafts from your researches"],
  agents: ["Agents", "5 research agents you've configured"],
  skills: ["Skills", "Reusable capabilities the agent can run — training, evaluation, docs, compute and more"],
  data: ["Data", "Scientific databases the agent can query, live"],
  notebooks: ["Notebooks", "12 analysis notebooks"],
  findings: ["Findings", "58 extracted findings, cited to source papers"],
  papers: ["Papers", "187 papers in your library"],
  collections: ["Collections", "9 curated paper collections"],
  tools: ["Tools & MCP", "Runtime tools and connected MCP servers"],
  docs: ["Docs", "The algorithms behind the research loop"],
};

export const BL: [string, string] = ["#2b5fd1", "#eef2fc"];
export const GR: [string, string] = ["#3a7d44", "#eef4ea"];
export const AM: [string, string] = ["#b07419", "#fdf3e6"];
export const GY: [string, string] = ["#8a8680", "#f0efea"];

export type DatasetRow = [string, string, string, [string, string], string, string];

export const datasets: Record<string, DatasetRow[]> = {
  researches: [
    ["Retrieval-Augmented Meta-Analysis", "42 papers · 3 notebooks · 58 findings", "running", BL, "◈", "2m ago"],
    ["Cross-domain effect-size survey", "61 papers · 5 notebooks", "synced", GR, "▦", "1h ago"],
    ["Publication bias in ML benchmarks", "28 papers · 2 notebooks", "synced", GR, "◫", "yesterday"],
    ["Protein LM design literature review", "74 papers · 4 notebooks", "draft", GY, "▤", "3d ago"],
    ["Climate downscaling reproducibility", "19 papers · 1 notebook", "draft", GY, "❯", "1w ago"],
  ],
  skills: [
    ["DeepSpeed", "distributed training · ZeRO sharding, offload", "ML", BL, "◆", "training"],
    ["PEFT / LoRA", "parameter-efficient fine-tuning (LoRA/QLoRA)", "ML", BL, "◆", "training"],
    ["TRL", "RLHF / DPO / PPO alignment training", "ML", BL, "◆", "training"],
    ["Accelerate", "multi-GPU / mixed-precision launch", "ML", BL, "◆", "training"],
    ["Transformers", "load & run any HF model", "ML", BL, "◆", "training"],
    ["Eval harness", "benchmarks, metrics, scoring", "Eval", GR, "◆", "evaluation"],
    ["Dataset prep", "load, clean, split, tokenize", "Data", GR, "◆", "datasets"],
    ["Data curation", "dedup, filter, quality scoring", "Data", GR, "◆", "datasets"],
    ["Statistical analysis", "tests, effect sizes, meta-analysis", "Analysis", AM, "◆", "analysis"],
    ["Notebook execution", "run Python / R analyses", "Analysis", AM, "◆", "analysis"],
    ["Plotting", "matplotlib / plotly figures", "Analysis", AM, "◆", "analysis"],
    ["LaTeX write-up", "papers & reports (arXiv style)", "Docs", GY, "◆", "documentation"],
    ["Figure generation", "diagrams, charts, schematics", "Docs", GY, "◆", "documentation"],
    ["Citation manager", "BibTeX, reference graph", "Docs", GY, "◆", "documentation"],
    ["Literature review", "search, read, synthesize", "Research", BL, "◆", "research"],
    ["Hypothesis generation", "propose & rank ideas", "Research", BL, "◆", "research"],
    ["Experiment design", "plan runs & ablations", "Research", BL, "◆", "research"],
    ["Critique / review", "adversarial verification", "Research", BL, "◆", "research"],
    ["Modal", "serverless GPU compute", "Compute", GR, "◆", "cloud"],
    ["Tinker", "managed training compute", "Compute", GR, "◆", "cloud"],
    ["Molecular biology", "sequences, structures, variants", "Bio", AM, "◆", "domain pack"],
    ["Cheminformatics", "RDKit descriptors, similarity", "Chem", AM, "◆", "domain pack"],
    ["Genomics", "gene lookup, expression, GWAS", "Bio", AM, "◆", "domain pack"],
    ["Physics sim", "numerical simulation helpers", "Physics", AM, "◆", "domain pack"],
  ],
  data: [
    ["OpenAlex", "250M+ works across all publishers", "literature", BL, "▦", "connected"],
    ["Crossref", "DOI registry · every publisher", "literature", BL, "▦", "connected"],
    ["Semantic Scholar", "abstracts, citations, OA PDFs", "literature", BL, "▦", "connected"],
    ["Europe PMC", "OA full text · biomedical", "literature", BL, "▦", "connected"],
    ["arXiv", "preprints · full HTML", "literature", BL, "▦", "connected"],
    ["PubMed", "biomedical citations", "literature", BL, "▦", "connected"],
    ["NASA ADS", "astrophysics literature", "literature", BL, "▦", "connected"],
    ["UniProt", "protein sequences & function", "biology", GR, "▦", "connected"],
    ["PDB (RCSB)", "3D macromolecular structures", "biology", GR, "▦", "connected"],
    ["Ensembl", "genomes & gene annotation", "biology", GR, "▦", "connected"],
    ["NCBI GEO / SRA", "expression & sequencing data", "biology", GR, "▦", "connected"],
    ["STRING", "protein–protein interactions", "biology", GR, "▦", "connected"],
    ["ClinVar / dbSNP", "clinical variants", "biology", GR, "▦", "connected"],
    ["GWAS Catalog", "genotype–phenotype associations", "biology", GR, "▦", "connected"],
    ["PubChem", "compounds & properties", "chemistry", AM, "▦", "connected"],
    ["ChEMBL", "bioactive molecules & assays", "chemistry", AM, "▦", "connected"],
    ["ZINC", "purchasable compounds", "chemistry", AM, "▦", "connected"],
    ["Hugging Face", "models & datasets hub", "ml", GY, "▦", "connected"],
    ["Kaggle", "datasets & competitions", "ml", GY, "▦", "connected"],
    ["Papers with Code", "SOTA benchmarks & code", "ml", GY, "▦", "connected"],
    ["Materials Project", "computed materials properties", "materials", GY, "▦", "connected"],
    ["OpenStreetMap", "geospatial data", "geo", GY, "▦", "connected"],
  ],
  notebooks: [
    ["analysis.py", "meta-analysis · DerSimonian–Laird", "last run 12:04", BL, "❯", "2m ago"],
    ["extract_effects.ipynb", "PDF → effect-size extraction", "last run 12:03", GR, "❯", "3m ago"],
    ["forest_plot.py", "figure generation", "last run 12:04", GR, "❯", "2m ago"],
    ["sensitivity.ipynb", "leave-one-out robustness", "not run", GY, "❯", "1d ago"],
  ],
  findings: [
    ["Pooled effect g = 0.41 (95% CI 0.32–0.51)", "across 42 studies · I² = 38%", "verified", GR, "✓", "12:04"],
    ["Effect strongest in ML-benchmark subgroup", "k = 14 · g = 0.49", "verified", GR, "✓", "12:04"],
    ["Possible publication bias (Egger p = 0.03)", "recommend trim-and-fill", "review", AM, "!", "12:04"],
    ["Climate subgroup effect attenuated", "k = 8 · g = 0.29", "verified", GR, "✓", "12:04"],
  ],
  papers: ALL_PAPERS.slice(0, 6).map((p) => [p.title, `${p.byline} · ${p.venue} ${p.year}`, `✳ ${p.citations}`, GY, "◫", p.status]),
  agents: [
    ["Meta-Analyst", "pools effect sizes · checks bias", "active", GR, "✦", "2m ago"],
    ["Literature Scout", "finds & clusters new papers daily", "active", GR, "✦", "1h ago"],
    ["Extraction Bot", "pulls tables & stats from PDFs", "active", GR, "✦", "3h ago"],
    ["Reproducibility Checker", "re-runs reported analyses", "paused", AM, "✦", "2d ago"],
    ["Citation Auditor", "verifies claims against sources", "draft", GY, "✦", "5d ago"],
  ],
  collections: [
    ["Core effect-size methods", "18 papers", "shared", BL, "▤", "2d ago"],
    ["ML benchmark critiques", "14 papers", "private", GY, "▤", "5d ago"],
    ["Genomics reproducibility", "11 papers", "shared", BL, "▤", "1w ago"],
    ["Climate model evaluation", "8 papers", "private", GY, "▤", "2w ago"],
  ],
  tools: [
    ["Shell / terminal", "run shell commands in the sandbox", "connected", GR, "▷", "core"],
    ["Code editor (LSP)", "edit files with language servers", "connected", GR, "❯", "core"],
    ["File system", "read / write project files", "connected", GR, "▤", "core"],
    ["Python interpreter", "execute code, notebooks & plots", "connected", GR, "▷", "core"],
    ["Web browser / fetch", "read web pages & docs", "connected", GR, "⌕", "core"],
    ["Web search", "search the open web", "connected", GR, "⌕", "core"],
    ["Git", "clone, commit, diff repos", "connected", GR, "⎇", "core"],
    ["SQL / dataframes", "query datasets", "connected", GR, "▦", "core"],
    ["LaTeX render", "compile papers & equations", "connected", GR, "∑", "core"],
    ["Research harness", "plan → run → verify loop", "connected", GR, "◈", "core"],
    ["Skill library", "load & invoke skills", "connected", GR, "◆", "core"],
    ["Plugin runtime", "custom tools via the SDK", "connected", GR, "⧉", "core"],
    ["Filesystem MCP", "sandboxed file access", "connected", BL, "⎘", "mcp"],
    ["GitHub MCP server", "read/write lab repos", "connected", BL, "⎘", "mcp"],
    ["Slack MCP server", "post digests to #research", "connected", BL, "⎘", "mcp"],
    ["Modal MCP", "serverless GPU compute", "connected", BL, "⎘", "mcp"],
    ["Fetch MCP", "structured web fetch", "connected", BL, "⎘", "mcp"],
    ["Custom MCP…", "attach via REAGENT_MCP_SERVERS", "available", GY, "⎘", "mcp"],
  ],
};

// Card colour by skill/database category.
export const catColor = (cat: string): [string, string] => {
  if (cat === "databases") return GR;
  if (["ml-training", "ml-inference", "coding", "llm-tools", "data-engineering", "cloud-compute"].includes(cat)) return BL;
  if (["chemistry", "biology", "physics", "quantum"].includes(cat)) return AM;
  return GY;
};
export const iconStyleFor = (c: [string, string]) =>
  `flex:0 0 auto; width:38px; height:38px; border-radius:9px; background:${c[1]}; color:${c[0]}; display:flex; align-items:center; justify-content:center; font-size:16px;`;
export const statusStyleFor = (c: [string, string]) => `font-size:11px; padding:2px 9px; border-radius:12px; background:${c[1]}; color:${c[0]}; font-weight:500;`;

/** Shared "home" chrome (sidebar nav + user menu + assign-task) passed from the shell to every section page. */
export interface HomeChrome {
  nav: NavVal[];
  homeTitle: string;
  homeSub: string;
  menuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
  menuItems: MenuItemVal[];
  openTask: () => void;
}
