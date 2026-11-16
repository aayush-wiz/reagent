---
name: saige-gwas
description: Run SAIGE genetic association pipelines (GWAS, ExWAS, gene/variant PheWAS) through the connected SAIGE MCP server, on the toolkit's bundled test data or the user's own genotype+phenotype data. Covers the pipeline, every config parameter, input/output formats, and the exact run workflow. Use whenever the user wants a genome-wide or gene-based association analysis with SAIGE.
category: biology
tags: [saige, gwas, exwas, phewas, genomics, association, mixed-model, nextflow, mcp, biobank]
---

# SAIGE association analysis (GWAS/ExWAS/PheWAS) via the SAIGE MCP server

This skill drives the **PMBB `pmbb-nf-toolkit-saige-family`** toolkit through a connected
**MCP server**. You do NOT run SAIGE in the sandbox — the heavy compute (Nextflow + the
official `pennbiobank/saige:latest` container) runs on the MCP server's host, and you call
its tools. The toolkit is used **unchanged**.

Reference material:
- SAIGE (Nature 2018): https://www.nature.com/articles/s41588-018-0184-y
- SAIGE-GENE (Nature 2022): https://www.nature.com/articles/s41588-022-01178-w
- SAIGE docs: https://saigegit.github.io/SAIGE-doc/
- Toolkit GWAS README: https://github.com/PMBB-Informatics-and-Genomics/pmbb-nf-toolkit-saige-family/blob/main/READMEs/SAIGE_GWAS_docs.md

## What SAIGE does
SAIGE performs association tests between genetic variants and a phenotype using a
**generalized linear mixed model (GLMM)** that controls for relatedness/population structure
and, for binary traits, uses a saddlepoint approximation (+ optional Firth fallback) so
case-control imbalance doesn't inflate false positives. Every pipeline is **two SAIGE steps**:
- **Step 1** — fit the *null* model per cohort/phenotype (builds/uses a GRM from high-quality LD-pruned SNPs).
- **Step 2** — test each variant (GWAS/single-variant) or gene/region (ExWAS/gene-burden) against that null model.
The toolkit then post-processes: filters, optional Biofilter nearest-gene annotation, and Manhattan/QQ plots.

## Prerequisite — the MCP server must be connected
Connect the SAIGE MCP server in the Tools page (URL like `http://127.0.0.1:8790/mcp`,
transport `http`). Its tools appear **namespaced by the server name** — if you named it
`saige`, they are `saige__health`, `saige__run_saige`, etc. Below they're written
unprefixed; add your server's prefix when calling.

## The MCP tools you have
| Tool | Purpose |
|---|---|
| `health()` | Verify the runtime is ready (nextflow, docker running, toolkit + profile). **Call first.** |
| `list_pipelines()` | The pipeline ids: `gwas`, `exwas`, `gene_phewas`, `variant_phewas`, `gwama`. |
| `pipeline_params(pipeline)` | The `params.*` a pipeline's `.conf` must/can set. |
| `list_test_data(pipeline)` | The bundled test scenarios and their Input files (absolute host paths). |
| `list_files(path)` · `read_file(path)` · `write_file(path, content)` · `edit_file(path, old, new)` | **Host-side** file ops — write/edit your config and inspect/patch toolkit code ON THE MCP HOST (where Nextflow reads them). |
| `run_saige(pipeline, config_path, run_name, extra_args)` | Launch a run in the background → returns a `run_id`. |
| `get_run_status(run_id)` | running / succeeded / failed + Nextflow log tail. |
| `get_results(run_id)` | Output tables, plots, reports produced by the run — returns their **absolute host paths**. |
| `read_file_base64(path)` | Read a host file as base64 (binary-safe) — for pulling a small binary out via `save_base64_file`. |
| `cancel_run(run_id)` | Stop a run. |

**Copying results into this research — use `import_file`, nothing else.** The run's outputs live on the
MCP host. SAIGE and reagent share this machine's filesystem, so the ONLY correct way to bring a
figure/table into the research is a direct on-disk copy:
- **`import_file(source, dest)`** — `source` = an **absolute host path** from `get_results`
  (e.g. `.../runs/test_gwas/.../manhattan.png`). Copied on disk directly → **instant, binary-safe, no
  size limit** (bytes never pass through the chat). Works on a single file or a whole output directory.
  Example: `import_file(source="/Users/.../runs/…/manhattan.png", dest="results/manhattan.png")`.
  > ⛔ **NEVER use `read_file_base64` + `save_base64_file` for SAIGE outputs.** They route the whole file's
  > bytes through the model; GLM cannot re-emit a large base64 blob as a tool argument, so `save_base64_file`
  > gets empty `{}` args and fails. Those files are already on this host → always `import_file`.
- `read_file`/`read_file_base64` are for *inspecting* a small config or log, not for copying results.

## End-to-end workflow (follow in order)
1. **`health()`** — if it isn't READY, tell the user exactly what's missing (Docker not running,
   Nextflow absent, image not pulled) and stop. Don't attempt a run before it's READY.
2. **`list_pipelines()`** — pick the id. Standard genome-wide single-variant study = `gwas`.
3. **`list_test_data("gwas")`** — see the test scenario's Input files, OR gather the user's own
   genotype + phenotype paths.
4. **Write the run config ON THE MCP HOST** — call `pipeline_params("gwas")` for the param list,
   then write the config with the **MCP's `write_file`** tool, e.g.
   `write_file(path="configs/test_gwas.conf", content="params { ... }")`. It returns the config's
   absolute host path. Point every input at the **absolute host paths** `list_test_data` gave you.
   Use the MCP's `read_file` / `edit_file` / `list_files` to inspect and tweak it. Everything stays
   on the MCP host — the only filesystem Nextflow can read.
   > ⚠️ **CRITICAL — you have TWO `write_file` tools.** reagent's own `write_file` writes into the
   > sandbox, which the MCP/Nextflow **cannot see** (different filesystem). Always use the **MCP's**
   > `saige__write_file` (and `saige__read_file`/`saige__edit_file`) for anything the pipeline reads.
5. **Stub first (STRONGLY recommended):**
   `run_saige(pipeline="gwas", config_path="<path from write_file>", run_name="stub", extra_args="-stub")`
   → poll `get_run_status`. A stub is a dry run that validates the environment, params, and input
   files without executing SAIGE. Fix any errors before a real run.
6. **Real run:** `run_saige(pipeline="gwas", config_path="<same path>", run_name="test_gwas")` → note the `run_id`.
7. **Poll:** `get_run_status(run_id)` periodically. Runs take **minutes** (longer on Apple Silicon —
   the SAIGE image is amd64 and runs under emulation). Do NOT claim success until status=`succeeded`.
8. **Collect:** `get_results(run_id)` → summarize the association results (top hits, lambda/inflation)
   and point the user at the output tables + Manhattan/QQ plots. If a run failed, read the log tail
   from `get_run_status` and report the real error.
9. **Bring results into the research:** for any figure/table the user wants kept, call
   **`import_file(source=<absolute path from get_results>, dest="results/<name>")`** — this copies the
   file (PNG, CSV, PDF, anything) into the research workspace so it appears in Files. Copy the whole run
   output folder by pointing `source` at its directory. Do NOT try to `read_file` a PNG and re-save it —
   that corrupts binaries; `import_file` copies raw bytes.

---

# GWAS configuration reference (author the `.conf` from this)

The toolkit reads a Nextflow config with a `params { … }` block. Below is every parameter the
GWAS pipeline uses, grouped, with defaults and meaning (from the toolkit's GWAS README).

## Required parameters (every run sets all of these)
| Parameter | Group | Description |
|---|---|---|
| `data_csv` | Input | CSV of participant phenotypes + covariates (one row per participant; has the `id_col` column). |
| `cohort_sets` | Input | CSV cohort-membership table: columns = cohort names, rows = participants, `1`/`0` membership; first column = participant ID. |
| `id_col` | Pre-proc | Participant ID column name in `data_csv` and `cohort_sets` (e.g. `"IID"`, `"PMBB_ID"`). |
| `cohort_list` | Pre-proc | List of cohorts to run (must match `cohort_sets` columns), e.g. `["EUR_ALL","EUR_F","EUR_M"]`. |
| `sex_strat_cohort_list` | Pre-proc | Subset of `cohort_list` that is sex-stratified (uses `sex_strat_*_covars`). |
| `bin_pheno_list` and/or `quant_pheno_list` | Pre-proc | Phenotype column names (or a path to a one-per-line file); at least one non-empty. |
| `cat_covars` | Pre-proc | Categorical covariate columns, e.g. `["SEX"]`. |
| `cont_covars` | Pre-proc | Continuous covariate columns, e.g. `["AGE","PC1",…,"PC10"]`. |
| `chromosome_list` | Pre-proc | Chromosomes for Step 2. Full GWAS `["1"…"22"]`; testing a small subset like `["21","22"]`. |
| `step1_plink_prefix` | Input | PLINK `.bed/.bim/.fam` prefix (all chromosomes merged) for Step 1 GRM. Pipeline appends `.bed/.bim/.fam`. |
| `ftype` | Input | Step 2 genotype format: `"PLINK1"`, `"PLINK2"`, or `"BGEN"` (case-sensitive). |
| `step2_plink_prefix` / `step2_pgen_prefix` / `step2_bgen_prefix` | Input | Step 2 genotype prefix matching `ftype` (chromosome number appended directly, e.g. `data.chr` → `data.chr1.bed`). |
| `biofilter_loki` | Post | Path to `loki.db` — required only when `annotate = true`. |
| `biofilter_build` | Post | Genome build for Biofilter: `"19"` (GRCh37) or `"38"` (GRCh38) — required when `annotate = true`. |

## Input file formats
**`data_csv`** (phenotypes + covariates):
```
IID,y_quantitative,y_binary,x1,x2,a1,a2
1a1,2.004,0,1.511,1,0,0
1a2,0.104,0,0.389,1,0,0
```
**`cohort_sets`** (membership, `1`=in cohort):
```
IID,POP1,POP2,POP3
1a1,1,0,1
1a2,1,0,0
```
- **Step 1 genotypes:** `step1_plink_prefix` → high-quality, LD-pruned SNPs, all chromosomes in one merged `.bed/.bim/.fam`.
- **Step 2 genotypes:** chromosome-separated, format by `ftype`:
  - `PLINK1` → `step2_plink_prefix` (`.bed/.bim/.fam` per chr)
  - `PLINK2` → `step2_pgen_prefix` (`.pgen/.pvar/.psam` per chr)
  - `BGEN` → `step2_bgen_prefix` (`.bgen` + `.bgen.bgi` per chr) **plus** `bgen_samplefile` (the `.sample` file)

## Cohort & phenotype setup
| Parameter | Default | Description |
|---|---|---|
| `survival_pheno_list` | `[]` | Survival phenotype columns (or file). Requires `event_time_col`/`event_time_bin`. |
| `sex_strat_cat_covars` | `[]` | Categorical covariates for sex-stratified cohorts only (e.g. drop SEX). |
| `sex_strat_cont_covars` | = `cont_covars` | Continuous covariates for sex-stratified cohorts. |
| `min_bin_cases` | `50` | Skip a binary pheno/cohort with fewer cases. `null` → default 50. |
| `min_quant_n` | `500` | Skip a quantitative pheno/cohort with fewer non-missing samples. |
| `min_survival_cases` | `100` | Minimum events to run a survival phenotype. |
| `sex_specific_pheno_file` | `null` | File of phenotypes to include only in sex-stratified cohorts. |

## SAIGE Step 1 parameters (null model / GRM)
| Parameter | Default | Description |
|---|---|---|
| `use_sparse_GRM` | `false` | Use a precomputed sparse GRM (`step1_sparse_grm` + `step1_sparse_grm_samples`). Faster for large cohorts. |
| `LOCO` | `"TRUE"` | Leave-one-chromosome-out. Keep `"TRUE"` for GWAS; `"FALSE"` for quick tests/ExWAS. |
| `maf` | `0.01` | Step 1 QC min MAF (plink2 `--maf`). |
| `geno` | `0.01` | Step 1 QC max per-variant missingness (plink2 `--geno`). |
| `hwe` | `1E-6` | Step 1 QC HWE p-value threshold (plink2 `--hwe`). |
| `max_vars_for_GRM` | `null` (cap 150k) | Max variants for GRM; if `null`, errors above 150k. |
| `min_vars_for_GRM` | `30000` | Min variants after QC to proceed. |
| `pruning_r2_for_GRM` | `0.6` | LD-pruning r² (plink2 `--indep-pairwise`). |
| `GPU` | `"OFF"` | `"ON"` uses GPU SAIGE-DOE (special hardware). Keep `"OFF"`. |
| `step1_script` | `/usr/local/bin/step1_fitNULLGLMM.R` | Step 1 R script in the container (rarely changed). |
| `event_time_col` / `event_time_bin` | — | Required only for survival phenotypes. |

## SAIGE Step 2 parameters (association test)
| Parameter | Default | Description |
|---|---|---|
| `min_mac` | `40` | Min minor allele count to test a variant (20 for array, 40 for imputed). |
| `min_maf` | `0` | Min MAF to test (usually controlled by `min_mac`). |
| `use_firth` | `TRUE` | Firth fallback for small-p binary-trait variants. Keep `TRUE`. |
| `firth_cutoff` | `0.1` | P below which Firth applies (BGEN, binary). |
| `LOCO` | `"TRUE"` | Match Step 1. |
| `isImputed` | `"FALSE"` | `"TRUE"` for imputed Step 2 files → enables info-score filter. |
| `minInfo` | `0` | Min imputation info (active when `isImputed="TRUE"`; typical `0.3`). |
| `step2_script` | `/usr/local/bin/step2_SPAtests.R` | Step 2 R script in the container. |
| `enable_chunking` | `false` | Split chromosomes into chunks (needs `chunks_manifest`). |
| `gwas_col_names` | see example | Rename SAIGE output columns. |

## Post-processing & annotation
| Parameter | Default | Description |
|---|---|---|
| `annotate` | `true` | Annotate hits with RSIDs + nearest gene via Biofilter (needs `biofilter_loki` + `biofilter_build`). `false` → skip, unannotated plots. |
| `p_cutoff_summarize` | `0.00001` | P threshold for the top-hits summary table. |
| `biofilter_close_dist` | `5E4` | bp distance for "close" vs "far" gene labeling. |

## Infrastructure (defaults correct for the SAIGE container — rarely change)
`my_python=/opt/conda/bin/python`, `my_bgenix=/opt/conda/bin/bgenix` (needed for BGEN),
`host=""` (env hint: `"AOU"`, `"DNAnexus"`, `"LPC"`, or empty), `gene_location_file=/app/NCBI.gene.loc`.

## Example config (`saige_gwas.config`)
```groovy
params {
    my_python = "/opt/conda/bin/python"
    my_bgenix = "/opt/conda/bin/bgenix"
    ftype = "BGEN"
    GPU = "OFF"
    annotate = true
    use_sparse_GRM = false
    step1_script = "/usr/local/bin/step1_fitNULLGLMM.R"
    step2_script = "/usr/local/bin/step2_SPAtests.R"

    data_csv    = "/path/to/data/common_ICD_covariate_ALL.csv"
    cohort_sets = "/path/to/data/Imputed_sample_table.csv"
    step1_plink_prefix = "/path/to/data/pruned_data"
    step2_bgen_prefix  = "/path/to/data/..._imputed-topmed-r2_chr"
    bgen_samplefile    = "/path/to/data/..._bgen.sample"

    cat_covars  = ["SEX"]
    cont_covars = ["AGE","PC1","PC2","PC3","PC4","PC5","PC6","PC7","PC8","PC9","PC10"]
    sex_strat_cat_covars  = []
    sex_strat_cont_covars = cont_covars

    id_col = "PMBB_ID"
    maf = 0.01; geno = 0.01; hwe = 1E-6
    min_maf = 0; min_mac = 40; firth_cutoff = 0.1
    LOCO = "TRUE"; isImputed = "TRUE"; minInfo = 0.3
    p_cutoff_summarize = 0.00001

    cohort_list = ["PMBB_EUR_ALL","PMBB_EUR_F","PMBB_EUR_M"]
    sex_strat_cohort_list = ["PMBB_EUR_F","PMBB_EUR_M"]
    bin_pheno_list  = "/path/to/data/common_ICD_list.txt"
    quant_pheno_list = []

    chromosome_list = ["1","2","3","4","5","6","7","8","9","10",
                       "11","12","13","14","15","16","17","18","19","20","21","22"]
}
```
For a fast **test run**, shrink it: one cohort, `LOCO="FALSE"`, `annotate=false`, and
`chromosome_list=["21","22"]`, pointed at a `list_test_data("gwas")` scenario's Input files.

## Running (what the MCP tools map to)
The MCP server runs, verbatim:
`nextflow run workflows/saige_gwas.nf -profile docker_local -c <profile> -c <your.conf>`
- `run_saige(..., extra_args="-stub")` → dry run (validate first).
- `run_saige(...)` → real run.
- `run_saige(..., extra_args="-resume")` → resume an interrupted run.

## Outputs
Per-cohort/phenotype Step 2 association tables (merged raw + filtered), a pheno info table,
a **summary of top hits** (below `p_cutoff_summarize`), and **Manhattan + QQ plots** (annotated
with nearest gene when `annotate=true`). List them with `get_results(run_id)` (absolute host paths),
then copy any you want to keep into the research with `import_file(source=<that path>, dest="results/…")`.

## The other pipelines (same tools, different id + config)
- `exwas` — exome/rare-variant gene-burden (SAIGE-GENE).
- `gene_phewas` — gene-burden across many phenotypes.
- `variant_phewas` — single-variant across many phenotypes.
- `gwama` — stitched GWAS + GWAMA meta-analysis.
Call `pipeline_params(<id>)` and see the toolkit's per-module READMEs for their configs.

## Caveats — be honest about these
- **Nextflow 24.04.3** is required by the toolkit; 25.x/26.x break it. The MCP host must have a compatible version.
- **Apple Silicon:** the amd64 SAIGE image runs under emulation → slower. Fine for test data; set that expectation.
- Never report success without a `succeeded` status and real result files. If a run fails, quote the actual log error from `get_run_status`.
- **Files must live on the MCP host.** reagent's sandbox and the MCP server are different filesystems.
  Use the MCP's `write_file`/`edit_file`/`read_file`/`list_files` (host-side) for every config and any
  toolkit code you touch — never reagent's sandbox file tools, whose files the pipeline can't see.
