# Reagent Sandbox — filesystem layout

This container is your research computer. Everything lives under `/reagent`:

```
/reagent/
  workspace/        ← your working directory (this is your cwd; it PERSISTS)
    scripts/        write your analysis code here
    data/           input data and datasets you extract
    outputs/        result tables you produce (csv, json)
    figures/        plots you generate (png/svg)
  toolkit/          helper scripts and skill tools (read-only)
  library/          this research's papers (papers.jsonl + any full text)
```

Rules:
- Your working directory is `/reagent/workspace`. Save scripts to `scripts/`,
  data to `data/`, results to `outputs/`, and figures to `figures/`.
- Read the paper corpus from `/reagent/library/papers.jsonl`.
- `/reagent/workspace` and `/reagent/library` survive restarts; everything else
  is reset when the sandbox is rebuilt.
