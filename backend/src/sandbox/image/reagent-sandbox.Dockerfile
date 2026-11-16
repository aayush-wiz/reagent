# reagent-sandbox — the research agent's computer.
#
# One image, built once, reused by every research as its own container. It ships
# the full scientific Python stack pre-installed and a fixed, recognizable
# on-disk layout so the agent always knows where things live:
#
#   /reagent/workspace   the working dir (bind-mounted per research; persists)
#     ├─ scripts/        agent-authored code
#     ├─ data/           input + extracted datasets
#     ├─ outputs/        result tables (csv/json)
#     └─ figures/        generated plots
#   /reagent/toolkit     helper scripts + skill tools (baked in, read-only)
#   /reagent/library     this research's papers (bind-mounted per research)
#
# Runs anywhere Docker runs — your Mac, any Linux server, a user's self-host.
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MPLBACKEND=Agg \
    REAGENT_HOME=/reagent \
    PYTHONPATH=/reagent/toolkit

# System libs some science wheels need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git curl ca-certificates \
      libgomp1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# The scientific stack — pre-installed so COMPUTE/ANALYZE start instantly.
RUN pip install --no-cache-dir \
      numpy scipy pandas matplotlib seaborn scikit-learn statsmodels \
      networkx sympy pyarrow \
      ipython jupyter-client ipykernel \
      biopython requests

# PDF report toolchain: pandoc + a LaTeX engine (pdflatex/bibtex), so the agent
# can typeset a Markdown report into a professional PDF — the same LaTeX route
# AI-Scientist-v2 uses, authored from Markdown. Curated texlive set (not the full
# ~4GB) covering article/report styling, fonts, math, tables, and bibliographies.
RUN apt-get update && apt-get install -y --no-install-recommends \
      pandoc \
      texlive-latex-base texlive-latex-recommended texlive-latex-extra \
      texlive-fonts-recommended texlive-bibtex-extra \
      latexmk lmodern \
  && rm -rf /var/lib/apt/lists/*

# uv — fast Python runner, so a skill's `uv run --with <pkg>` (e.g. exa-search)
# works out of the box, with no pip-install fallback.
RUN pip install --no-cache-dir uv

# The recognizable layout. workspace/ and library/ are bind-mount points filled
# per research at run time; toolkit/ is baked into the image.
RUN mkdir -p /reagent/workspace/scripts \
             /reagent/workspace/data \
             /reagent/workspace/outputs \
             /reagent/workspace/figures \
             /reagent/toolkit \
             /reagent/library

COPY toolkit/ /reagent/toolkit/
COPY LAYOUT.md /reagent/LAYOUT.md

WORKDIR /reagent/workspace

# Keep the container alive so the agent can exec into it across many tool calls.
CMD ["sleep", "infinity"]
