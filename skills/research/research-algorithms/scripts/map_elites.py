#!/usr/bin/env python3
"""MAP-Elites — a diverse archive of high-quality solutions (quality-diversity).

Instead of collapsing to a single best solution, MAP-Elites keeps the best solution
found in each cell of a behaviour grid, so you retain a DIVERSE set of strong
candidates. In the research loop it is the EVOLVE step: breed hypotheses that are
both high-scoring and varied along chosen axes (e.g. mechanism type x boldness), so
the board doesn't converge prematurely. This is a core component of AlphaEvolve.

Algorithm:
  1. Seed the archive with a few random solutions.
  2. Repeatedly: pick a random elite, MUTATE it, EVALUATE (-> fitness + descriptors),
     and place it in its descriptor cell iff it beats the current occupant.

You inject two callbacks:
  evaluate(solution) -> (fitness: float, descriptors: tuple[float, ...])
  mutate(solution)   -> new_solution
In the agent loop the LLM is the mutation operator: YOU generate the mutated
hypothesis; this module just manages the archive and tells you which cell won.

Import:
    from map_elites import MapElites
    me = MapElites(bins=[(0, 1, 10), (0, 1, 10)], evaluate=my_eval, mutate=my_mutate)
    me.seed(initial_solutions)
    me.run(iterations=500)
    for cell, (sol, fit, desc) in me.archive.items(): ...

Run this file directly for a self-contained demo on a toy 2-descriptor problem.
"""
import argparse
import json
import sys

import numpy as np


class MapElites:
    def __init__(self, bins, evaluate, mutate, seed=0):
        """bins: list of (low, high, n_cells) per descriptor axis."""
        self.bins = bins
        self.evaluate = evaluate
        self.mutate = mutate
        self.rng = np.random.default_rng(seed)
        self.archive = {}  # cell tuple -> (solution, fitness, descriptors)

    def _cell(self, descriptors):
        idx = []
        for d, (lo, hi, n) in zip(descriptors, self.bins):
            frac = 0.0 if hi == lo else (d - lo) / (hi - lo)
            idx.append(int(min(max(frac, 0.0), 0.999999) * n))
        return tuple(idx)

    def _place(self, solution):
        fitness, descriptors = self.evaluate(solution)
        cell = self._cell(descriptors)
        cur = self.archive.get(cell)
        if cur is None or fitness > cur[1]:
            self.archive[cell] = (solution, fitness, tuple(descriptors))
            return True
        return False

    def seed(self, solutions):
        for s in solutions:
            self._place(s)

    def run(self, iterations=500):
        improvements = 0
        for _ in range(iterations):
            if not self.archive:
                raise RuntimeError("Archive is empty — call seed() with at least one solution first.")
            elite = self.archive[list(self.archive.keys())[self.rng.integers(len(self.archive))]][0]
            child = self.mutate(elite)
            if self._place(child):
                improvements += 1
        return improvements

    def best(self):
        if not self.archive:
            return None
        return max(self.archive.values(), key=lambda v: v[1])

    def summary(self):
        total_cells = int(np.prod([n for _, _, n in self.bins]))
        return {
            "filled_cells": len(self.archive),
            "total_cells": total_cells,
            "coverage": round(len(self.archive) / total_cells, 3),
            "best_fitness": round(self.best()[1], 4) if self.archive else None,
        }


def _demo(seed=0):
    """Toy problem: solution is a 2-vector in [0,1]^2. Fitness rewards being near a
    ridge; descriptors are the two coordinates -> a diverse archive along both axes."""
    rng = np.random.default_rng(seed)

    def evaluate(x):
        x = np.clip(x, 0, 1)
        fitness = -abs(x[0] + x[1] - 1.0)  # ridge x0 + x1 = 1
        return float(fitness), (float(x[0]), float(x[1]))

    def mutate(x):
        return np.clip(np.asarray(x) + rng.normal(0, 0.1, size=2), 0, 1)

    me = MapElites(bins=[(0, 1, 10), (0, 1, 10)], evaluate=evaluate, mutate=mutate, seed=seed)
    me.seed([rng.random(2) for _ in range(10)])
    me.run(iterations=2000)
    return me


def main():
    ap = argparse.ArgumentParser(description="MAP-Elites quality-diversity archive (demo + importable).")
    ap.add_argument("--iterations", type=int, default=2000, help="Demo iterations.")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    me = _demo(seed=args.seed)
    summary = me.summary()
    print("# MAP-Elites demo (import MapElites to use with your own evaluate/mutate)")
    print(f"  filled cells : {summary['filled_cells']} / {summary['total_cells']}  (coverage {summary['coverage']})")
    print(f"  best fitness : {summary['best_fitness']}")
    print("SUMMARY " + json.dumps(summary))


if __name__ == "__main__":
    sys.exit(main())
