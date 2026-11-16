#!/usr/bin/env bash
# run_reagent.sh — drive the Paper2Code / PaperCoder pipeline INSIDE reagent's
# sandbox, against OpenRouter, from a plain-text or LaTeX paper file.
#
# Why per-stage subcommands: reagent's `bash` tool caps each call at ~600s, and
# running the whole pipeline in one shot both blows that cap and hides progress.
# Run one stage per `bash` call so the agent sees each stage's output and stays
# under the cap. Debugging is a caller-driven loop (run the repo → capture the
# error → `debug` → repeat), which fits the ReAct loop.
#
# Usage:
#   run_reagent.sh setup
#   run_reagent.sh plan     <name> <model> <paper_file>
#   run_reagent.sh config   <name>
#   run_reagent.sh analyze  <name> <model> <paper_file>
#   run_reagent.sh code     <name> <model> <paper_file>
#   run_reagent.sh debug    <name> <model> <error_file> [save_num]
#   run_reagent.sh generate <name> <model> <paper_file>   # plan+config+analyze+code (small papers only)
#
# Outputs (written under the workspace, so they surface in the Files tab):
#   /reagent/workspace/outputs/<name>__p2c/    intermediate: plan, analysis, config.yaml
#   /reagent/workspace/outputs/<name>_repo/    the generated repository (the deliverable)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODES="$HERE/codes"
WS="/reagent/workspace"

# --- OpenRouter wiring -------------------------------------------------------
# The Paper2Code scripts call `OpenAI(api_key=os.environ["OPENAI_API_KEY"])` with
# NO explicit base_url, and the openai SDK falls back to OPENAI_BASE_URL from the
# env. So alias the already-injected OpenRouter key + endpoint onto the OpenAI
# env vars and every call routes through OpenRouter — no code change.
export OPENAI_API_KEY="${OPENAI_API_KEY:-${OPENROUTER_API_KEY:-}}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://openrouter.ai/api/v1}"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: no OPENROUTER_API_KEY/OPENAI_API_KEY in the sandbox env." >&2
  exit 3
fi

out_dir()  { echo "$WS/outputs/${1}__p2c"; }
repo_dir() { echo "$WS/outputs/${1}_repo"; }

ensure_deps() {
  # The base image ships the scientific stack but not the openai client. Install
  # once; it's cached while the container stays warm.
  if ! python -c "import openai, tiktoken" >/dev/null 2>&1; then
    echo "[setup] installing openai + tiktoken ..." >&2
    pip install --quiet openai tiktoken >&2
  fi
}

cmd="${1:-}"; shift || true
case "$cmd" in
  setup)
    ensure_deps
    echo "ok — deps ready · OPENAI_BASE_URL=$OPENAI_BASE_URL" ;;

  plan)
    name="$1"; model="$2"; paper="$3"; OUT="$(out_dir "$name")"; mkdir -p "$OUT"; ensure_deps
    python "$CODES/1_planning.py" \
      --paper_name "$name" --gpt_version "$model" \
      --pdf_latex_path "$paper" --paper_format LaTeX --output_dir "$OUT"
    echo "[plan] done → $OUT/planning_trajectories.json" ;;

  config)
    name="$1"; OUT="$(out_dir "$name")"; REPO="$(repo_dir "$name")"; mkdir -p "$REPO"
    python "$CODES/1.1_extract_config.py" --paper_name "$name" --output_dir "$OUT"
    cp -f "$OUT/planning_config.yaml" "$REPO/config.yaml" 2>/dev/null || true
    echo "[config] done → $REPO/config.yaml" ;;

  analyze)
    name="$1"; model="$2"; paper="$3"; OUT="$(out_dir "$name")"; ensure_deps
    python "$CODES/2_analyzing.py" \
      --paper_name "$name" --gpt_version "$model" \
      --pdf_latex_path "$paper" --paper_format LaTeX --output_dir "$OUT"
    echo "[analyze] done → $OUT (per-file analyses)" ;;

  code)
    name="$1"; model="$2"; paper="$3"; OUT="$(out_dir "$name")"; REPO="$(repo_dir "$name")"; mkdir -p "$REPO"; ensure_deps
    python "$CODES/3_coding.py" \
      --paper_name "$name" --gpt_version "$model" \
      --pdf_latex_path "$paper" --paper_format LaTeX \
      --output_dir "$OUT" --output_repo_dir "$REPO"
    echo "[code] done → repo at $REPO" ;;

  debug)
    name="$1"; model="$2"; errfile="$3"; save="${4:-1}"
    OUT="$(out_dir "$name")"; REPO="$(repo_dir "$name")"; ensure_deps
    python "$CODES/4_debugging.py" \
      --error_file_name "$errfile" --output_dir "$OUT" \
      --paper_name "$name" --model "$model" \
      --save_num "$save" --output_repo_dir "$REPO"
    echo "[debug] applied fixes to $REPO (backups: *.$save.bak)" ;;

  generate)
    name="$1"; model="$2"; paper="$3"
    "$0" plan    "$name" "$model" "$paper"
    "$0" config  "$name"
    "$0" analyze "$name" "$model" "$paper"
    "$0" code    "$name" "$model" "$paper" ;;

  *)
    echo "usage: run_reagent.sh {setup|plan|config|analyze|code|debug|generate} ..." >&2
    exit 2 ;;
esac
