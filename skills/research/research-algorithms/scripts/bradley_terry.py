#!/usr/bin/env python3
"""Bradley-Terry ranking from pairwise outcomes.

Fits one latent *strength* per item to a set of pairwise win/loss results by
maximum likelihood, using Hunter's (2004) minorization-maximization (MM) update
--- the same model behind LMArena / Arena-Hard leaderboards. More accurate than
the live Elo on the hypothesis board because it uses the whole match graph at once.

Model:  P(i beats j) = s_i / (s_i + s_j)
MM update:  s_i <- W_i / sum_{j != i} n_ij / (s_i + s_j)
where W_i = #wins of i and n_ij = #comparisons between i and j.

Usage:
    python bradley_terry.py matches.json [--smooth 0.5] [--tol 1e-9]

matches.json is a list of pairwise outcomes:
    [{"winner": "h_a", "loser": "h_b"}, {"winner": "h_a", "loser": "h_c"}, ...]
    (draws: pass {"winner": a, "loser": b, "weight": 0.5} twice with roles swapped,
     or a single {"a": x, "b": y, "outcome": "draw"} — both are handled.)

Prints the items ranked by strength (normalised to sum to 1).
"""
import argparse
import json
import sys
from collections import defaultdict


def fit_bradley_terry(matches, smooth=0.5, tol=1e-9, max_iter=10000):
    """Return {item: strength} fit by MM.

    `smooth` adds a light symmetric prior: every observed pair also gets `smooth`
    virtual wins each way. This keeps the MLE finite when an item never wins or
    never loses (the unregularised MLE would send its strength to 0 or infinity).
    """
    wins = defaultdict(float)          # W_i
    pair_counts = defaultdict(float)   # n_ij (symmetric), keyed by frozenset{i, j}
    items = set()

    for m in matches:
        if "outcome" in m and m["outcome"] == "draw":
            a, b = m["a"], m["b"]
            wins[a] += 0.5
            wins[b] += 0.5
            pair_counts[frozenset((a, b))] += 1.0
            items.update((a, b))
            continue
        w, l = m["winner"], m["loser"]
        weight = float(m.get("weight", 1.0))
        wins[w] += weight
        pair_counts[frozenset((w, l))] += weight
        items.update((w, l))

    items = sorted(items)
    if len(items) < 2:
        raise SystemExit("Need at least two distinct items to rank.")

    # Apply symmetric smoothing prior over every observed pair.
    if smooth > 0:
        for pair in list(pair_counts):
            i, j = tuple(pair)
            wins[i] += smooth
            wins[j] += smooth
            pair_counts[pair] += 2 * smooth

    # Neighbours of each item and the count between them.
    neighbours = defaultdict(dict)
    for pair, n in pair_counts.items():
        i, j = tuple(pair)
        neighbours[i][j] = n
        neighbours[j][i] = n

    s = {i: 1.0 for i in items}
    for _ in range(max_iter):
        new = {}
        for i in items:
            denom = 0.0
            for j, n_ij in neighbours[i].items():
                denom += n_ij / (s[i] + s[j])
            new[i] = (wins[i] / denom) if denom > 0 else s[i]
        # Normalise to sum to 1 (BT strengths are identified only up to scale).
        total = sum(new.values())
        new = {i: v / total for i, v in new.items()}
        change = max(abs(new[i] - s[i]) for i in items)
        s = new
        if change < tol:
            break
    return s


def main():
    ap = argparse.ArgumentParser(description="Bradley-Terry ranking from pairwise outcomes.")
    ap.add_argument("matches", help="Path to matches JSON (list of {winner, loser}).")
    ap.add_argument("--smooth", type=float, default=0.5, help="Symmetric prior per pair (default 0.5).")
    ap.add_argument("--tol", type=float, default=1e-9, help="Convergence tolerance.")
    args = ap.parse_args()

    with open(args.matches) as f:
        matches = json.load(f)
    if not isinstance(matches, list) or not matches:
        raise SystemExit("matches JSON must be a non-empty list of pairwise outcomes.")

    strengths = fit_bradley_terry(matches, smooth=args.smooth, tol=args.tol)
    ranked = sorted(strengths.items(), key=lambda kv: kv[1], reverse=True)

    print(f"# Bradley-Terry ranking ({len(ranked)} items, {len(matches)} matches, smooth={args.smooth})")
    for rank, (item, s) in enumerate(ranked, 1):
        print(f"{rank}. {item}\tstrength={s:.4f}")
    # Also emit machine-readable JSON on stderr-free stdout tail.
    print("JSON " + json.dumps({item: round(s, 6) for item, s in ranked}))


if __name__ == "__main__":
    sys.exit(main())
