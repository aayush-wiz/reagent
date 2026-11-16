#!/usr/bin/env python3
"""Successive halving / Hyperband — screen many candidates under a fixed budget.

Give every candidate a small budget, keep the top fraction, multiply the budget for
the survivors, and repeat. Spends compute on the candidates that keep looking best
instead of running each to completion --- a tournament of experiments. Use when you
have many candidate hypotheses/configs and a bounded compute budget.

Algorithm (successive halving with reduction factor eta):
  rung r: evaluate each survivor at budget b_r = min_budget * eta**r,
          keep the top ceil(n_r / eta), advance to rung r+1.

You inject:
  evaluate(candidate, budget) -> score (higher is better)
where `budget` is e.g. epochs, samples, or sandbox seconds — you decide the unit.

Import:
    from successive_halving import successive_halving
    winner, trace = successive_halving(candidates, evaluate, min_budget=1, max_budget=27, eta=3)

Run this file directly for a self-contained demo.
"""
import argparse
import json
import math
import sys

import numpy as np


def successive_halving(candidates, evaluate, min_budget=1, max_budget=27, eta=3):
    """Return (winner, trace). `trace` is the per-rung list of (candidate, budget, score)."""
    survivors = list(candidates)
    trace = []
    budget = float(min_budget)
    rung = 0
    while True:
        scored = [(c, budget, float(evaluate(c, budget))) for c in survivors]
        scored.sort(key=lambda t: t[2], reverse=True)
        trace.append({"rung": rung, "budget": budget, "results": [(str(c), s) for c, _, s in scored]})
        if len(scored) <= 1 or budget >= max_budget:
            return scored[0][0], trace
        keep = max(1, math.ceil(len(scored) / eta))
        survivors = [c for c, _, _ in scored[:keep]]
        budget = min(budget * eta, max_budget)
        rung += 1


def _demo(seed=0):
    """Toy: each candidate has a hidden 'quality'; evaluate() returns a noisy estimate
    whose noise shrinks as budget grows (more budget -> more reliable ranking)."""
    rng = np.random.default_rng(seed)
    qualities = {f"cand_{i}": rng.random() for i in range(27)}

    def evaluate(candidate, budget):
        noise = rng.normal(0, 1.0 / math.sqrt(budget))
        return qualities[candidate] + noise

    winner, trace = successive_halving(list(qualities), evaluate, min_budget=1, max_budget=27, eta=3)
    return winner, trace, qualities


def main():
    ap = argparse.ArgumentParser(description="Successive halving (demo + importable).")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    winner, trace, qualities = _demo(seed=args.seed)
    true_best = max(qualities, key=qualities.get)
    print("# Successive halving demo (import successive_halving to use with your own evaluate)")
    for r in trace:
        print(f"  rung {r['rung']} @ budget {r['budget']:.0f}: {len(r['results'])} candidates")
    print(f"  winner            : {winner}")
    print(f"  true best (hidden): {true_best}  ({'match' if winner == true_best else 'noise beat it'})")
    print("WINNER " + json.dumps({"winner": winner}))


if __name__ == "__main__":
    sys.exit(main())
