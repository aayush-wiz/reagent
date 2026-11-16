"""reagent — sandbox toolkit.

Available inside every research sandbox: `import reagent` (it's on PYTHONPATH).
Small helpers that know the sandbox layout so you save things in the right place
and read the paper corpus without re-fetching.

    import reagent
    df = reagent.load_papers()          # the research's corpus as a DataFrame
    reagent.save_table(results, "alignment_gap.csv")
    reagent.save_figure(fig, "gap_scatter.png")
"""
from __future__ import annotations
import json
import os

HOME = "/reagent"
WORKSPACE = f"{HOME}/workspace"
LIBRARY = f"{HOME}/library/papers.jsonl"
DATA_DIR = f"{WORKSPACE}/data"
OUTPUTS_DIR = f"{WORKSPACE}/outputs"
FIGURES_DIR = f"{WORKSPACE}/figures"


def papers() -> list[dict]:
    """The research's corpus as a list of dicts (id, title, authors, year, doi, abstract, ...)."""
    if not os.path.exists(LIBRARY):
        return []
    with open(LIBRARY) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def load_papers():
    """The research's corpus as a pandas DataFrame."""
    import pandas as pd
    return pd.DataFrame(papers())


def save_table(df, name: str) -> str:
    """Save a DataFrame to outputs/<name> (csv). Returns the path."""
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, name)
    df.to_csv(path, index=False)
    return path


def save_figure(fig, name: str, dpi: int = 150) -> str:
    """Save a matplotlib Figure to figures/<name>. Returns the path."""
    os.makedirs(FIGURES_DIR, exist_ok=True)
    path = os.path.join(FIGURES_DIR, name)
    fig.savefig(path, dpi=dpi, bbox_inches="tight")
    return path
