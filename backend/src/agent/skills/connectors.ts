/**
 * agent/skills/connectors.ts — scientific-database connectors.
 *
 *   The openscience "scientific database access" layer, ported: each is a thin
 *   read-only wrapper over a public API, so the agent can ground a gene, protein,
 *   compound or structure in real data mid-run. Same fan-out style as paper-search.
 */
import { z } from "zod";
import type { Skill } from "../types.ts";

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

async function getJson(url: string, headers?: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const connectorSkills: Skill[] = [
  {
    slug: "pubchem_lookup",
    category: "Chemistry",
    description: "Look up a chemical compound by name in PubChem — returns formula, molecular weight and IUPAC name.",
    inputSchema: z.object({ name: z.string() }),
    run: async (a) => {
      const name = encodeURIComponent(str(a.name));
      const d = await getJson(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${name}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`,
      );
      const p = d?.PropertyTable?.Properties?.[0];
      if (!p) return `No PubChem match for "${str(a.name)}".`;
      return `PubChem CID ${p.CID}: ${p.IUPACName ?? str(a.name)} · formula ${p.MolecularFormula} · MW ${p.MolecularWeight}`;
    },
  },
  {
    slug: "uniprot_lookup",
    category: "Biology",
    description: "Search UniProt for a protein/gene — returns accession, protein name, gene, organism and length for the top hits.",
    inputSchema: z.object({ query: z.string() }),
    run: async (a) => {
      const q = encodeURIComponent(str(a.query));
      const d = await getJson(`https://rest.uniprot.org/uniprotkb/search?query=${q}&format=json&size=3&fields=accession,protein_name,gene_names,organism_name,length`);
      const rows = d?.results ?? [];
      if (!rows.length) return `No UniProt match for "${str(a.query)}".`;
      return rows
        .map((r: any) => {
          const name = r.proteinDescription?.recommendedName?.fullName?.value ?? "?";
          const gene = r.genes?.[0]?.geneName?.value ?? "?";
          const org = r.organism?.scientificName ?? "?";
          return `${r.primaryAccession} · ${name} · gene ${gene} · ${org} · ${r.sequence?.length ?? "?"} aa`;
        })
        .join("\n");
    },
  },
  {
    slug: "pdb_lookup",
    category: "Biology",
    description: "Fetch a Protein Data Bank (RCSB) structure entry by 4-character PDB id — returns title, method and resolution.",
    inputSchema: z.object({ id: z.string() }),
    run: async (a) => {
      const id = str(a.id).toUpperCase();
      const d = await getJson(`https://data.rcsb.org/rest/v1/core/entry/${encodeURIComponent(id)}`);
      const title = d?.struct?.title ?? "?";
      const method = d?.exptl?.[0]?.method ?? "?";
      const res = d?.rcsb_entry_info?.resolution_combined?.[0];
      return `PDB ${id}: ${title} · method ${method}${res ? ` · ${res} Å` : ""}`;
    },
  },
  {
    slug: "ensembl_lookup",
    category: "Biology",
    description: "Look up a human gene symbol in Ensembl — returns Ensembl id, biotype and genomic location.",
    inputSchema: z.object({ gene: z.string() }),
    run: async (a) => {
      const gene = encodeURIComponent(str(a.gene));
      const d = await getJson(`https://rest.ensembl.org/lookup/symbol/homo_sapiens/${gene}?content-type=application/json`);
      if (!d?.id) return `No Ensembl match for "${str(a.gene)}".`;
      return `${d.display_name ?? str(a.gene)} · ${d.id} · ${d.biotype} · chr${d.seq_region_name}:${d.start}-${d.end} (${d.strand === 1 ? "+" : "-"})`;
    },
  },
  {
    slug: "chembl_search",
    category: "Chemistry",
    description: "Search ChEMBL for a bioactive molecule by name — returns ChEMBL id, preferred name and max clinical phase.",
    inputSchema: z.object({ query: z.string() }),
    run: async (a) => {
      const q = encodeURIComponent(str(a.query));
      const d = await getJson(`https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=${q}&format=json&limit=3`);
      const rows = d?.molecules ?? [];
      if (!rows.length) return `No ChEMBL match for "${str(a.query)}".`;
      return rows
        .map((m: any) => `${m.molecule_chembl_id} · ${m.pref_name ?? "?"} · max phase ${m.max_phase ?? "?"}`)
        .join("\n");
    },
  },
];
