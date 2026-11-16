# Attribution

This skill vendors the **Paper2Code / PaperCoder** pipeline:
- Source: https://github.com/going-doer/paper2code
- License: Apache-2.0 (see `LICENSE`)

Only the OpenAI-API-path scripts are included (`codes/`). The `*_llm.py` (vLLM/GPU)
variants and the RAG helper are intentionally omitted — reagent's sandbox is CPU-only
and routes model calls through OpenRouter.

## Local modifications (marked `# REAGENT PATCH` in the source)
- `codes/utils.py` — `cal_cost` no longer raises `KeyError` on models missing from the
  OpenAI pricing table (OpenRouter model ids); returns zero cost instead.
- `codes/4_debugging.py` — `reasoning_effort="high"` is now gated on the model name
  (o3-mini/o4-mini) like the other stages, so non-OpenAI models aren't rejected; and a
  missing `--output_repo_dir` argument (used but never declared) was added.
- `run_reagent.sh` (new) — reagent wrapper: aliases `OPENROUTER_API_KEY` → the OpenAI
  SDK env vars, installs deps, and runs the LaTeX/plain-text path stage-by-stage with
  outputs under `/reagent/workspace`.
