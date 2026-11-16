# Toolkit

Helper scripts and libraries baked into every research sandbox at
`/reagent/toolkit` (on `PYTHONPATH`, so importable directly).

## `reagent` (Python)
```python
import reagent
df = reagent.load_papers()                    # the research corpus as a DataFrame
papers = reagent.papers()                     # ... or as a list of dicts
reagent.save_table(results_df, "gap.csv")     # -> /reagent/workspace/outputs/gap.csv
reagent.save_figure(fig, "gap_scatter.png")   # -> /reagent/workspace/figures/gap_scatter.png
```

The scientific Python stack is pre-installed: numpy, scipy, pandas, matplotlib,
seaborn, scikit-learn, statsmodels, networkx, sympy, biopython.
