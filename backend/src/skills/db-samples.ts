/**
 * backend/src/skills/db-samples.ts — live "sample data" for a database skill.
 *
 *   Powers the Data detail's "Data sample" tab. Two layers:
 *     1. Hand-tuned SAMPLERS below give a nicely-columned sample for a few DBs.
 *     2. For EVERY other database, we fall back to the 42-connector science
 *        registry (the same one `science_search` uses): look the connector up by
 *        id, run a small domain-appropriate probe query, and render the hits.
 *   Only databases with neither a sampler nor a registry connector show a note.
 */
import { registry } from "../science/connectors/index.ts";
import type { ConnectorDomain } from "../science/connectors/types.ts";
import { collectionsFor, type Collection } from "./db-catalog.ts";
import { readSkillDoc } from "./loader.ts";

export interface Sample {
  /** One-paragraph description of the database (from its skill doc). */
  description?: string;
  /** The tables / collections (or file groups) this database exposes. */
  collections?: Collection[];
  /** Which collection the preview below is drawn from. */
  previewOf?: string;
  // ---- preview of that collection ----
  columns: string[];
  rows: string[][];
  note?: string;
  source?: string;
  /** The structure of ONE real record — every top-level field + an example
   *  value. Lets the user see the schema / what fields exist, including for
   *  unstructured (nested JSON) sources. */
  fields?: { name: string; example: string; type: string }[];
  /** The id of the record `fields` was pulled from. */
  recordId?: string;
  /** How many records the preview holds (rows may be capped for display). */
  recordCount?: number;
}

/** Pull the "## Overview" paragraph out of a database's SKILL.md. */
function dbDescription(skillName: string): string | undefined {
  const doc = readSkillDoc(skillName);
  if (!doc) return undefined;
  const md = doc.markdown.replace(/^---[\s\S]*?---\n/, "");
  const m = md.match(/(^|\n)##\s+Overview\s*\n([\s\S]*?)(\n##\s|$)/i);
  const body = (m ? m[2] : md).trim().replace(/\s+/g, " ");
  return body.slice(0, 400) || undefined;
}

// A browser-like User-Agent — some APIs (AlphaFold/Cloudflare) 403 requests without one.
const UA = "Mozilla/5.0 (Reagent research app; +https://reagent.app)";

async function getJson(url: string, headers?: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json", "user-agent": UA, ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const S = (v: unknown) => (v == null ? "" : String(v));

const SAMPLERS: Record<string, () => Promise<Sample>> = {
  "uniprot-database": async () => {
    const d = await getJson(
      "https://rest.uniprot.org/uniprotkb/search?query=insulin+AND+organism_id:9606&format=json&size=6&fields=accession,protein_name,gene_names,organism_name,length",
    );
    return {
      columns: ["Accession", "Protein", "Gene", "Organism", "Length"],
      rows: (d.results ?? []).map((r: any) => [
        S(r.primaryAccession),
        S(r.proteinDescription?.recommendedName?.fullName?.value),
        S(r.genes?.[0]?.geneName?.value),
        S(r.organism?.scientificName),
        S(r.sequence?.length),
      ]),
      source: "rest.uniprot.org · query: insulin (human)",
    };
  },
  "pubchem-database": async () => {
    const names = ["aspirin", "caffeine", "glucose", "ibuprofen", "penicillin"];
    const rows: string[][] = [];
    for (const n of names) {
      try {
        const d = await getJson(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(n)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`,
        );
        const p = d?.PropertyTable?.Properties?.[0];
        if (p) rows.push([S(p.CID), n, S(p.MolecularFormula), S(p.MolecularWeight)]);
      } catch {
        /* skip */
      }
    }
    return { columns: ["CID", "Name", "Formula", "MW"], rows, source: "pubchem.ncbi.nlm.nih.gov" };
  },
  "pdb-database": async () => {
    const ids = ["1TUP", "6VXX", "4HHB", "1CRN"];
    const rows: string[][] = [];
    for (const id of ids) {
      try {
        const d = await getJson(`https://data.rcsb.org/rest/v1/core/entry/${id}`);
        rows.push([id, S(d?.struct?.title).slice(0, 60), S(d?.exptl?.[0]?.method), S(d?.rcsb_entry_info?.resolution_combined?.[0])]);
      } catch {
        /* skip */
      }
    }
    return { columns: ["PDB", "Title", "Method", "Resolution (Å)"], rows, source: "data.rcsb.org" };
  },
  "ensembl-database": async () => {
    const genes = ["BRCA1", "TP53", "EGFR", "MYC"];
    const rows: string[][] = [];
    for (const g of genes) {
      try {
        const d = await getJson(`https://rest.ensembl.org/lookup/symbol/homo_sapiens/${g}?content-type=application/json`);
        rows.push([g, S(d.id), S(d.biotype), `chr${S(d.seq_region_name)}:${S(d.start)}-${S(d.end)}`]);
      } catch {
        /* skip */
      }
    }
    return { columns: ["Gene", "Ensembl ID", "Biotype", "Location"], rows, source: "rest.ensembl.org · human" };
  },
  "chembl-database": async () => {
    const d = await getJson("https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=kinase+inhibitor&format=json&limit=6");
    return {
      columns: ["ChEMBL ID", "Name", "Max phase"],
      rows: (d.molecules ?? []).map((m: any) => [S(m.molecule_chembl_id), S(m.pref_name), S(m.max_phase)]),
      source: "ebi.ac.uk/chembl · query: kinase inhibitor",
    };
  },
  "openalex-database": async () => {
    const d = await getJson("https://api.openalex.org/works?search=machine%20learning&per_page=6&mailto=hello@reagent.app");
    return {
      columns: ["Title", "Year", "Citations", "OA"],
      rows: (d.results ?? []).map((w: any) => [S(w.display_name).slice(0, 60), S(w.publication_year), S(w.cited_by_count), w.open_access?.is_oa ? "yes" : "no"]),
      source: "api.openalex.org · search: machine learning",
    };
  },
  "pubmed-database": async () => {
    const d = await getJson(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=crispr&format=json&pageSize=6&resultType=lite",
    );
    return {
      columns: ["Title", "Year", "Journal", "Cites"],
      rows: (d.resultList?.result ?? []).map((r: any) => [S(r.title).slice(0, 60), S(r.pubYear), S(r.journalTitle).slice(0, 24), S(r.citedByCount)]),
      source: "europepmc.org · query: crispr",
    };
  },
  "alphafold-database": async () => {
    const accs = ["P00520", "P0DTC2", "P04637"];
    const rows: string[][] = [];
    for (const a of accs) {
      try {
        const d = await getJson(`https://alphafold.ebi.ac.uk/api/prediction/${a}`);
        const p = Array.isArray(d) ? d[0] : d;
        if (p) rows.push([S(p.uniprotAccession), S(p.gene), S(p.organismScientificName).slice(0, 24), S(p.uniprotDescription).slice(0, 40)]);
      } catch {
        /* skip */
      }
    }
    return { columns: ["UniProt", "Gene", "Organism", "Description"], rows, source: "alphafold.ebi.ac.uk" };
  },
  "clinicaltrials-database": async () => {
    const d = await getJson("https://clinicaltrials.gov/api/v2/studies?query.cond=diabetes&pageSize=6&fields=NCTId,BriefTitle,OverallStatus,Phase");
    return {
      columns: ["NCT ID", "Title", "Status", "Phase"],
      rows: (d.studies ?? []).map((s: any) => {
        const p = s.protocolSection;
        return [S(p?.identificationModule?.nctId), S(p?.identificationModule?.briefTitle).slice(0, 50), S(p?.statusModule?.overallStatus), S(p?.designModule?.phases?.[0])];
      }),
      source: "clinicaltrials.gov · condition: diabetes",
    };
  },
};

// A small, domain-appropriate probe query so a connector returns something
// representative (a gene DB won't match "machine learning", etc.). One query per
// broad domain — universal across all connectors in that domain, no per-source
// special-casing.
const DOMAIN_PROBE: Record<ConnectorDomain, string> = {
  biology: "cancer",
  chemistry: "aspirin",
  physics: "graphene",
  genomics: "BRCA1",
  proteomics: "insulin",
  structure: "hemoglobin",
  literature: "machine learning",
  materials: "silicon",
  clinical: "diabetes",
  general: "protein",
};

/** Map a Data-section skill name (e.g. "opentargets-database") to a registry
 *  connector id (e.g. "opentargets"). */
function connectorIdFromSkill(name: string): string {
  return name.replace(/-database$/, "").replace(/-db$/, "");
}

/** A short, readable preview of any value (scalars as-is, objects/arrays as a
 *  compact JSON snippet) — so unstructured/nested fields still show something. */
function preview(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 140 ? s.slice(0, 140) + "…" : s;
  }
  return String(v).slice(0, 140);
}

function typeOf(v: unknown): string {
  if (v == null) return "null";
  if (Array.isArray(v)) return `array[${v.length}]`;
  return typeof v;
}

/** Flatten ONE record into its top-level fields with an example value + type —
 *  the "schema" / structure view of the data. */
function recordFields(rec: unknown): { name: string; example: string; type: string }[] {
  if (!rec || typeof rec !== "object") return [{ name: "value", example: preview(rec), type: typeOf(rec) }];
  return Object.entries(rec as Record<string, unknown>)
    .slice(0, 50)
    .map(([k, v]) => ({ name: k, example: preview(v), type: typeOf(v) }));
}

/** Generic live sample via the science connector registry — works for any of
 *  the 42 connected databases without a hand-written sampler. Returns a rows
 *  preview PLUS the structure (fields) of a real record. */
async function registrySample(name: string): Promise<Sample | null> {
  const connector = registry.get(connectorIdFromSkill(name));
  if (!connector) return null;
  const query = DOMAIN_PROBE[connector.domain] ?? "protein";
  const hits = await connector.search(query, { limit: 12 });

  // Structure: fetch the full record for the first hit and expose its fields.
  let fields: Sample["fields"];
  let recordId: string | undefined;
  if (hits[0]) {
    recordId = hits[0].id;
    try {
      const full = await connector.fetch(hits[0].id);
      fields = recordFields(full ?? hits[0].extra ?? hits[0]);
    } catch {
      fields = recordFields(hits[0].extra ?? hits[0]); // fall back to the search hit shape
    }
  }

  return {
    columns: ["ID", "Title", "Summary"],
    rows: hits.map((h) => [S(h.id).slice(0, 28), S(h.title).slice(0, 80), S(h.summary).slice(0, 110)]),
    source: `${connector.name} · probe query: “${query}”`,
    fields,
    recordId,
    recordCount: hits.length,
    note: hits.length ? undefined : `No results for the probe query “${query}”.`,
  };
}

export async function sampleDatabase(name: string): Promise<Sample> {
  const connector = registry.get(connectorIdFromSkill(name));
  const fn = SAMPLERS[name];

  // Sections 1 & 2 — the description and the list of tables/collections. These
  // are available regardless of whether the live preview succeeds.
  const description = dbDescription(name);
  const collections = collectionsFor(name, connector?.name);

  // Section 3 — a live preview of the primary collection.
  let preview: Sample;
  try {
    if (connector) {
      const generic = await registrySample(name);
      if (generic && (generic.rows.length || generic.fields?.length)) preview = generic;
      else if (fn) preview = await fn();
      else preview = { columns: [], rows: [], note: "No live preview available right now — see the Reference tab." };
    } else if (fn) {
      preview = await fn();
    } else {
      preview = { columns: [], rows: [], note: "No live preview is wired for this database — see the Reference tab for how to query it." };
    }
  } catch (e) {
    try {
      preview = fn ? await fn() : { columns: [], rows: [], note: `Live preview failed: ${String(e)}` };
    } catch {
      preview = { columns: [], rows: [], note: `Live preview failed: ${String(e)}` };
    }
  }

  return { ...preview, description, collections, previewOf: collections[0]?.name };
}
