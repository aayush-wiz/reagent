---
name: compute-sandbox
description: "Use the research compute sandbox. Run code with bash/run_python inside the per-research container, navigate the /reagent layout (workspace, toolkit, library), read the paper corpus, and save outputs and figures to the right places."
category: research
allowed-tools: [Bash]
---

# Compute Sandbox

## Overview
Each research has its own **sandbox** — an isolated Docker container that is the
agent's computer for the COMPUTE and ANALYZE stages. The scientific Python stack
is pre-installed, so you never have to set up an environment. Use `bash` and
`run_python`; both execute **inside** this research's sandbox.

## When to Use This Skill
Load this at Stage 5 (COMPUTE) and Stage 6 (ANALYZE), before running code.

## The layout — know where things live
```
/reagent/
  workspace/        your working directory (cwd; PERSISTS across calls)
    scripts/        write your analysis scripts here
    data/           input and extracted datasets
    outputs/        result tables you produce (csv/json)
    figures/        plots you generate (png/svg)
  toolkit/          helper libraries (on PYTHONPATH)
  library/          this research's papers -> papers.jsonl
```

## Read the corpus (don't re-fetch)
The research's papers are already in the sandbox. Read them from
`/reagent/library/papers.jsonl` (one JSON paper per line: id, title, authors,
year, venue, citations, doi, abstract, pdf_url), or use the toolkit:
```python
import reagent
df = reagent.load_papers()      # corpus as a pandas DataFrame
```

## Save outputs to the right place
```python
import reagent
reagent.save_table(results_df, "alignment_gap.csv")   # -> workspace/outputs/
reagent.save_figure(fig, "gap_scatter.png")           # -> workspace/figures/
```
Or write directly under `outputs/` and `figures/`. Anything under
`/reagent/workspace` persists and shows up in the research's Outputs panel.

## Workflow
1. Read `/reagent/library/papers.jsonl` (or `reagent.load_papers()`) for the corpus.
2. Write scripts to `scripts/`, run them with `bash` (`python scripts/x.py`) or
   `run_python`.
3. Save result tables to `outputs/`, figures to `figures/`.
4. Report the raw values your scripts print — never hand-edit a computed number.

## Rules
- Everything runs inside the sandbox; you cannot touch the host machine.
- Packages missing? `bash: pip install <pkg>` inside the sandbox.
- The scientific stack (numpy, scipy, pandas, matplotlib, seaborn, scikit-learn,
  statsmodels, networkx, biopython) is already installed.
