---
name: paper2code
description: Reproduce a scientific paper as a runnable code repository. Runs the Paper2Code/PaperCoder pipeline (plan → analyze → code → debug) in the sandbox against OpenRouter, from the paper's text. Use when the user asks to implement, reproduce, or turn a paper into working code.
category: engineering
tags: [paper-to-code, reproduction, implementation, codegen, repository, papercoder]
---

# paper2code — turn a paper into a working repository

This skill runs the **Paper2Code / PaperCoder** pipeline (Apache-2.0; see `LICENSE`)
inside this research's sandbox to reproduce a paper as a real code repo. It is a
staged pipeline that produces a plan, a per-file logic analysis, and then writes
the code file-by-file in dependency order — then you iteratively run and fix it.

The scripts are mounted read-only at `/reagent/skills/engineering/paper2code/`.
Drive everything through the wrapper `run_reagent.sh` — do **not** call the raw
Python; the wrapper wires OpenRouter (aliases `OPENAI_API_KEY`/`OPENAI_BASE_URL`)
and installs deps. Model calls go through OpenRouter, so pass an OpenRouter model
id (e.g. `z-ai/glm-5.2`) as `<model>`.

## Step 0 — get the paper text into the workspace (REQUIRED)
The pipeline reads the paper as plain text (LaTeX mode = `f.read()`), so any text
works — no PDF/GROBID needed. Fetch it with reagent's own tools and write it to a
file in the workspace:
- Use `get_paper` / `get_papers` (or `webfetch` for an arXiv/HTML page) to get the
  full text of the target paper.
- `write_file("paper.tex", <the full paper text>)` — a short kebab `<name>` like
  `transformer` identifies the run.

Prefer the FULL paper (method + equations + any appendix). Abstract-only input
yields a shallow reproduction.

## Steps 1–4 — generate the repo (run one stage per bash call)
Each stage is a separate `bash` call so it stays under the tool's time cap and you
see its output. Substitute `<name>` (run id), `<model>` (e.g. `z-ai/glm-5.2`), and
`paper.tex`:

```bash
SK=/reagent/skills/engineering/paper2code/run_reagent.sh
bash $SK plan    <name> <model> paper.tex   # overall plan + architecture + task list
bash $SK config  <name>                      # extract config.yaml from the plan
bash $SK analyze <name> <model> paper.tex   # per-file logic analysis
bash $SK code    <name> <model> paper.tex   # write the repo, file-by-file
```

Outputs land in the workspace (and show in the **Files** tab):
- `outputs/<name>__p2c/` — intermediate: plan, per-file analyses, `planning_config.yaml`
- `outputs/<name>_repo/` — **the generated repository** (the deliverable)

For a small paper you may run all four at once with `bash $SK generate <name> <model> paper.tex`,
but prefer stage-by-stage so a slow stage doesn't hit the time cap.

## Step 5 — run & debug loop (this is your job to orchestrate)
The debug stage does NOT run the code; you do, then feed it the error:
1. Try to run the repo: `cd outputs/<name>_repo && python <entrypoint>.py` (or read
   its README/main). Capture stdout+stderr.
2. If it errors, write the error to a file and call the debug stage, which LLM-patches
   the offending files in place (backups saved as `*.<n>.bak`):
   ```bash
   bash $SK debug <name> <model> outputs/<name>__p2c/err.txt 1
   ```
3. Re-run; repeat with an incremented save number (2, 3, …) until it runs or you've
   made a few honest attempts. Don't loop forever — 3–5 iterations is plenty.

## Report back
Tell the user: where the repo is (`outputs/<name>_repo/`), whether it runs, what you
had to fix, and any parts that couldn't be reproduced. Never claim it works if you
didn't get it to run.

## Limits — be honest about these
- The base sandbox has numpy/scipy/pandas/sklearn but **not** heavy DL deps (torch,
  jax). If the generated code needs them, `pip install` is best-effort and large
  frameworks may not fit the sandbox — say so rather than faking success.
- This runs its own OpenRouter calls; a large paper is many calls (minutes + real
  credit), and a mid-run OpenRouter 402/rate-limit aborts the stage. Re-run the
  aborted stage.
- Input is plain text, not the benchmark's structured JSON, so results won't match
  the paper's reported reproduction scores — this gives a working implementation,
  not a benchmark number.
