#!/usr/bin/env python3
"""Multi-armed bandit selection — which experiment / arm to try next.

Balances exploiting the current best arm against exploring uncertain ones. Use to
choose the next experiment when you have a few options, each returning a noisy
reward, and a limited budget.

Strategies:
  ucb        UCB1: argmax_i  mean_i + sqrt(2 ln N / n_i)      (deterministic)
  thompson   Thompson sampling (Bernoulli): sample theta_i ~ Beta(1+wins, 1+losses)
  epsilon    epsilon-greedy: best arm w.p. 1-eps, random arm w.p. eps

Usage:
    python bandits.py --strategy ucb arms.json
    python bandits.py --strategy thompson arms.json --seed 0
    python bandits.py --strategy epsilon arms.json --epsilon 0.1 --seed 0

arms.json maps an arm id to its history. Provide whatever you have; each strategy
uses the fields it needs:
    {
      "arm_a": {"reward_sum": 3.2, "pulls": 5},          # for ucb / epsilon
      "arm_b": {"wins": 4, "losses": 1},                  # for thompson (or ucb via mean)
      "arm_c": {"mean": 0.6, "pulls": 3}
    }

Prints the arm to pull next and the per-arm scores.
"""
import argparse
import json
import sys

import numpy as np


def arm_mean(stats):
    """Mean reward from whatever fields are present."""
    if "mean" in stats:
        return float(stats["mean"])
    if "reward_sum" in stats and stats.get("pulls", 0) > 0:
        return float(stats["reward_sum"]) / float(stats["pulls"])
    if "wins" in stats:
        w, l = float(stats["wins"]), float(stats.get("losses", 0))
        return w / (w + l) if (w + l) > 0 else 0.0
    return 0.0


def arm_pulls(stats):
    if "pulls" in stats:
        return int(stats["pulls"])
    if "wins" in stats:
        return int(stats.get("wins", 0)) + int(stats.get("losses", 0))
    return 0


def select_ucb(arms):
    total = sum(arm_pulls(s) for s in arms.values())
    scores = {}
    for arm, s in arms.items():
        n = arm_pulls(s)
        if n == 0:
            scores[arm] = float("inf")  # untried arms first
        else:
            scores[arm] = arm_mean(s) + np.sqrt(2.0 * np.log(max(total, 1)) / n)
    return scores


def select_thompson(arms, rng):
    scores = {}
    for arm, s in arms.items():
        if "wins" in s or "losses" in s:
            a = 1.0 + float(s.get("wins", 0))
            b = 1.0 + float(s.get("losses", 0))
        else:
            # Fall back to a Normal posterior around the mean if only reward/pulls given.
            n = max(arm_pulls(s), 1)
            m = arm_mean(s)
            scores[arm] = float(rng.normal(m, 1.0 / np.sqrt(n)))
            continue
        scores[arm] = float(rng.beta(a, b))
    return scores


def select_epsilon(arms, eps, rng):
    means = {arm: arm_mean(s) for arm, s in arms.items()}
    if rng.random() < eps:
        chosen = str(rng.choice(list(arms.keys())))
        return means, chosen
    chosen = max(means, key=means.get)
    return means, chosen


def main():
    ap = argparse.ArgumentParser(description="Multi-armed bandit next-arm selection.")
    ap.add_argument("arms", help="Path to arms JSON.")
    ap.add_argument("--strategy", choices=["ucb", "thompson", "epsilon"], default="ucb")
    ap.add_argument("--epsilon", type=float, default=0.1)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    with open(args.arms) as f:
        arms = json.load(f)
    if not isinstance(arms, dict) or not arms:
        raise SystemExit("arms JSON must be a non-empty object {arm_id: {stats}}.")

    rng = np.random.default_rng(args.seed)

    if args.strategy == "ucb":
        scores = select_ucb(arms)
        chosen = max(scores, key=scores.get)
    elif args.strategy == "thompson":
        scores = select_thompson(arms, rng)
        chosen = max(scores, key=scores.get)
    else:
        scores, chosen = select_epsilon(arms, args.epsilon, rng)

    print(f"# Bandit selection — strategy={args.strategy}")
    for arm, sc in sorted(scores.items(), key=lambda kv: kv[1], reverse=True):
        mark = "  <- pull next" if arm == chosen else ""
        val = "inf" if sc == float("inf") else f"{sc:.4f}"
        print(f"  {arm}\tscore={val}{mark}")
    print("NEXT " + json.dumps({"arm": chosen}))


if __name__ == "__main__":
    sys.exit(main())
