#!/usr/bin/env python3
"""Bayesian optimization — propose the next experiment when each run is expensive.

Fits a Gaussian-process surrogate to the observations so far and proposes the next
input that maximises Expected Improvement (EI) --- the standard optimal-experimental-
design loop. Use when the knob you tune is continuous (a threshold, rate, or
hyperparameter) and each evaluation costs a long run.

Acquisition (maximisation of y):
    I    = mu(x) - f_best - xi
    EI(x)= I * Phi(I/sigma) + sigma * phi(I/sigma)   (0 where sigma = 0)

Usage:
    python bayesopt.py observations.json [--minimize] [--xi 0.01] [--candidates 20000] [--seed 0]

observations.json:
    {
      "bounds": [[lo1, hi1], [lo2, hi2], ...],   # one [lo, hi] per input dimension
      "X": [[x11, x12, ...], [x21, x22, ...]],   # evaluated inputs (rows)
      "y": [y1, y2, ...]                          # observed objective values
    }

Prints the next input x to evaluate (its predicted mean, std, and EI).
"""
import argparse
import json
import sys

import numpy as np
from scipy.stats import norm
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel


def propose(bounds, X, y, minimize=False, xi=0.01, n_candidates=20000, seed=0):
    bounds = np.asarray(bounds, dtype=float)
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    if X.ndim == 1:
        X = X.reshape(-1, 1)
    # Optimise for a maximum internally; flip sign to minimise.
    sign = -1.0 if minimize else 1.0
    y_fit = sign * y

    kernel = ConstantKernel(1.0) * Matern(length_scale=np.ones(bounds.shape[0]), nu=2.5) + WhiteKernel(1e-6)
    gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True, n_restarts_optimizer=5, random_state=seed)
    gp.fit(X, y_fit)

    rng = np.random.default_rng(seed)
    cand = rng.uniform(bounds[:, 0], bounds[:, 1], size=(n_candidates, bounds.shape[0]))
    mu, sigma = gp.predict(cand, return_std=True)
    sigma = np.maximum(sigma, 1e-12)

    f_best = y_fit.max()
    imp = mu - f_best - xi
    Z = imp / sigma
    ei = imp * norm.cdf(Z) + sigma * norm.pdf(Z)
    ei[sigma < 1e-9] = 0.0

    idx = int(np.argmax(ei))
    x_next = cand[idx]
    return {
        "x_next": [float(v) for v in x_next],
        "predicted_mean": float(sign * mu[idx]),  # back to the user's orientation
        "predicted_std": float(sigma[idx]),
        "expected_improvement": float(ei[idx]),
    }


def main():
    ap = argparse.ArgumentParser(description="Bayesian optimization — next point via Expected Improvement.")
    ap.add_argument("observations", help="Path to observations JSON (bounds, X, y).")
    ap.add_argument("--minimize", action="store_true", help="Minimise y instead of maximising.")
    ap.add_argument("--xi", type=float, default=0.01, help="EI exploration parameter.")
    ap.add_argument("--candidates", type=int, default=20000, help="Random candidates to score.")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    with open(args.observations) as f:
        obs = json.load(f)
    for key in ("bounds", "X", "y"):
        if key not in obs:
            raise SystemExit(f"observations JSON must contain '{key}'.")
    if len(obs["X"]) != len(obs["y"]) or not obs["X"]:
        raise SystemExit("X and y must be non-empty and the same length.")

    result = propose(
        obs["bounds"], obs["X"], obs["y"],
        minimize=args.minimize, xi=args.xi, n_candidates=args.candidates, seed=args.seed,
    )
    print(f"# Bayesian optimization — next experiment ({'minimise' if args.minimize else 'maximise'})")
    print(f"  x_next               = {result['x_next']}")
    print(f"  predicted mean       = {result['predicted_mean']:.4f}")
    print(f"  predicted std        = {result['predicted_std']:.4f}")
    print(f"  expected improvement = {result['expected_improvement']:.4g}")
    print("NEXT " + json.dumps(result))


if __name__ == "__main__":
    sys.exit(main())
