/**
 * backend/src/skills/db-catalog.ts — a data dictionary for each connected
 * database: the logical TABLES / COLLECTIONS (or file groups) it exposes.
 *
 *   Scientific sources are REST/GraphQL APIs, not SQL servers — there is no
 *   universal "list tables" call. So this is a curated catalog of each source's
 *   entity types (Open Targets → Targets/Diseases/Drugs/Evidence, GEO → Series/
 *   Samples/Platforms, …). It's factual reference metadata, not agent logic.
 *   Databases not listed fall back to a single "records" collection.
 */

export interface Collection {
  name: string;
  description: string;
  kind: "table" | "file";
}

// Keyed by the Data-section skill name (e.g. "opentargets-database").
const DB_COLLECTIONS: Record<string, Collection[]> = {
  "openalex-database": [
    { name: "works", description: "Papers, books, datasets — the scholarly documents", kind: "table" },
    { name: "authors", description: "Disambiguated author profiles", kind: "table" },
    { name: "sources", description: "Journals, conferences, repositories", kind: "table" },
    { name: "institutions", description: "Universities and research organizations", kind: "table" },
    { name: "concepts", description: "Topics / fields of study", kind: "table" },
    { name: "publishers", description: "Publishing organizations", kind: "table" },
    { name: "funders", description: "Grant-funding bodies", kind: "table" },
  ],
  "opentargets-database": [
    { name: "targets", description: "Genes / proteins (Ensembl IDs) with tractability & constraint", kind: "table" },
    { name: "diseases", description: "Diseases / phenotypes (EFO/MONDO)", kind: "table" },
    { name: "drugs", description: "Drug / molecule records (ChEMBL)", kind: "table" },
    { name: "evidence", description: "Target–disease association evidence, scored", kind: "table" },
  ],
  "ensembl-database": [
    { name: "genes", description: "Gene models with location & biotype", kind: "table" },
    { name: "transcripts", description: "Transcript isoforms", kind: "table" },
    { name: "exons", description: "Exon coordinates", kind: "table" },
    { name: "variants", description: "Known sequence variants", kind: "table" },
    { name: "regulatory_features", description: "Promoters, enhancers, TF binding sites", kind: "table" },
  ],
  "uniprot-database": [
    { name: "uniprotkb", description: "Protein sequences + functional annotation", kind: "table" },
    { name: "uniref", description: "Clustered sequences (100/90/50% identity)", kind: "table" },
    { name: "uniparc", description: "Non-redundant sequence archive", kind: "table" },
    { name: "proteomes", description: "Per-organism protein sets", kind: "table" },
  ],
  "reactome-database": [
    { name: "pathways", description: "Biological pathways (hierarchical)", kind: "table" },
    { name: "reactions", description: "Molecular reactions / events", kind: "table" },
    { name: "physical_entities", description: "Proteins, complexes, small molecules", kind: "table" },
  ],
  "pubchem-database": [
    { name: "compounds", description: "Normalized chemical structures (CID)", kind: "table" },
    { name: "substances", description: "Depositor-supplied substances (SID)", kind: "table" },
    { name: "bioassays", description: "Biological assay results (AID)", kind: "table" },
  ],
  "chembl-database": [
    { name: "molecules", description: "Bioactive drug-like molecules", kind: "table" },
    { name: "targets", description: "Protein / organism targets", kind: "table" },
    { name: "assays", description: "Bioassay descriptions", kind: "table" },
    { name: "activities", description: "Measured bioactivities (IC50, Ki…)", kind: "table" },
    { name: "drugs", description: "Approved / clinical drugs", kind: "table" },
  ],
  "pdb-database": [
    { name: "structures", description: "3D macromolecular structures (entries)", kind: "table" },
    { name: "polymer_entities", description: "Protein / nucleic-acid chains", kind: "table" },
    { name: "assemblies", description: "Biological assemblies", kind: "table" },
    { name: "ligands", description: "Bound small-molecule ligands", kind: "table" },
  ],
  "clinvar-database": [
    { name: "variants", description: "Clinically-interpreted genetic variants", kind: "table" },
  ],
  "gwas-database": [
    { name: "studies", description: "GWAS publications / studies", kind: "table" },
    { name: "associations", description: "SNP–trait associations with p-values", kind: "table" },
    { name: "traits", description: "Mapped traits (EFO)", kind: "table" },
  ],
  "kegg-database": [
    { name: "pathways", description: "Metabolic & signaling pathway maps", kind: "table" },
    { name: "genes", description: "Genes per organism", kind: "table" },
    { name: "compounds", description: "Metabolites & small molecules", kind: "table" },
    { name: "reactions", description: "Biochemical reactions", kind: "table" },
    { name: "diseases", description: "Disease entries", kind: "table" },
    { name: "drugs", description: "Drug entries", kind: "table" },
  ],
  "geo-database": [
    { name: "series (GSE)", description: "An experiment / study", kind: "file" },
    { name: "samples (GSM)", description: "Individual samples", kind: "file" },
    { name: "platforms (GPL)", description: "Array / sequencer definitions", kind: "file" },
    { name: "datasets (GDS)", description: "Curated dataset collections", kind: "file" },
  ],
  "ena-database": [
    { name: "studies", description: "Sequencing study / project", kind: "file" },
    { name: "samples", description: "Biological samples", kind: "table" },
    { name: "runs", description: "Raw read runs (FASTQ)", kind: "file" },
    { name: "assemblies", description: "Genome assemblies", kind: "file" },
    { name: "sequences", description: "Annotated sequence records", kind: "file" },
  ],
  "fda-database": [
    { name: "drugs", description: "Approved drug products & labels", kind: "table" },
    { name: "devices", description: "Medical devices", kind: "table" },
    { name: "adverse_events", description: "FAERS adverse-event reports", kind: "table" },
    { name: "food", description: "Food enforcement / recalls", kind: "table" },
  ],
  "clinicaltrials-database": [
    { name: "studies", description: "Registered clinical trials (NCT)", kind: "table" },
  ],
  "alphafold-database": [
    { name: "predictions", description: "Predicted 3D structures per UniProt accession", kind: "file" },
  ],
  "string-database": [
    { name: "proteins", description: "Proteins by identifier", kind: "table" },
    { name: "interactions", description: "Protein–protein interactions with confidence", kind: "table" },
  ],
  "pubmed-database": [
    { name: "articles", description: "Biomedical citations & abstracts", kind: "table" },
  ],
  "biorxiv-database": [
    { name: "preprints", description: "bioRxiv / medRxiv preprints", kind: "table" },
  ],
  "drugbank-database": [
    { name: "drugs", description: "Drug entries with pharmacology", kind: "table" },
    { name: "targets", description: "Drug targets / enzymes / transporters", kind: "table" },
    { name: "interactions", description: "Drug–drug interactions", kind: "table" },
  ],
  "gene-database": [
    { name: "genes", description: "NCBI Gene records", kind: "table" },
  ],
  "cosmic-database": [
    { name: "mutations", description: "Somatic cancer mutations", kind: "table" },
    { name: "genes", description: "Cancer census genes", kind: "table" },
    { name: "samples", description: "Tumour samples", kind: "table" },
  ],
  "hmdb-database": [
    { name: "metabolites", description: "Human metabolite records", kind: "table" },
  ],
  "zinc-database": [
    { name: "compounds", description: "Purchasable compounds for screening", kind: "table" },
  ],
  "brenda-database": [
    { name: "enzymes", description: "Enzyme functional & kinetic data (EC)", kind: "table" },
  ],
  "cellxgene-census": [
    { name: "datasets", description: "Single-cell RNA-seq datasets", kind: "file" },
    { name: "cells", description: "Per-cell metadata & expression", kind: "table" },
  ],
  "imaging-data-commons": [
    { name: "collections", description: "Imaging collections", kind: "file" },
    { name: "studies", description: "DICOM studies", kind: "file" },
    { name: "series", description: "Image series", kind: "file" },
  ],
  "metabolomics-workbench-database": [
    { name: "studies", description: "Metabolomics studies", kind: "file" },
    { name: "metabolites", description: "Measured metabolites", kind: "table" },
  ],
  "fred-economic-data": [
    { name: "series", description: "Economic time series", kind: "table" },
  ],
  "uspto-database": [
    { name: "patents", description: "Granted patents", kind: "table" },
    { name: "applications", description: "Patent applications", kind: "table" },
  ],
  "clinpgx-database": [
    { name: "drugs", description: "Pharmacogenomic drug records", kind: "table" },
    { name: "genes", description: "Pharmacogenes", kind: "table" },
    { name: "variants", description: "Variant annotations", kind: "table" },
    { name: "clinical_annotations", description: "Gene–drug clinical annotations", kind: "table" },
  ],
  "datacommons-client": [
    { name: "statistical_variables", description: "Statistical variables", kind: "table" },
    { name: "places", description: "Geographic places", kind: "table" },
    { name: "observations", description: "Time-series observations", kind: "table" },
  ],
};

/** Collections for a database. Falls back to a single primary "records" table
 *  labeled with the source name when the source isn't in the curated catalog. */
export function collectionsFor(skillName: string, sourceName?: string): Collection[] {
  const curated = DB_COLLECTIONS[skillName];
  if (curated) return curated;
  return [{ name: "records", description: `Primary searchable records${sourceName ? ` in ${sourceName}` : ""}`, kind: "table" }];
}
