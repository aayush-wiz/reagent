---
name: search-strategy
description: "How to explore the hypothesis/experiment space — breadth-first, depth-first, best-first, beam, and Monte-Carlo tree search. What each takes as input, what it returns, and when to pick which. Load when you must decide how to expand and prune the hypothesis board or a tree of experiment plans rather than testing everything."
category: research
---

# Search Strategy — exploring the hypothesis / experiment tree

You rarely can test every hypothesis or run every experiment. Exploration is a **search over
a tree**: a node is a hypothesis (or an experiment plan), expanding a node means generating
its children (refinements, follow-up experiments), and each node has a **score** from your
evaluator (the `rank` tournament for hypotheses, a metric for experiments). This skill is how
to choose *which node to expand next* and *what to prune*.

You do not need code for the small cases — this is a reasoning discipline over the board
(`list_hypotheses` / `get_ratings`). For a large or numeric search, the scoring/selection math
lives in `research-algorithms`.

## The node and its score

- **Node** = a hypothesis on the board, or a candidate experiment/analysis plan.
- **Children** = refinements of a hypothesis, or follow-up experiments a result opens up.
- **Score `h(node)`** = how promising the node is. For hypotheses, that is the Elo from the
  tournament (`get_ratings`) and its evidential support; for experiments, the expected
  information gain or a measured metric.

## The algorithms — input → output, and when to use each

### Breadth-First Search (BFS)
- **Input:** a root node + a way to list a node's children.
- **Output:** nodes explored level-by-level (all depth-1, then all depth-2, …).
- **Use when:** the space is shallow and you want *coverage* — e.g. enumerate all first-order
  hypotheses before going deep on any. Broad but can be expensive.

### Depth-First Search (DFS)
- **Input:** root + children function.
- **Output:** nodes explored down one branch before backtracking.
- **Use when:** you have a strong lead worth chasing to a conclusion before considering
  alternatives, and backtracking is cheap. Risk: tunnel vision — pair with the tournament so
  you don't over-commit.

### Best-First Search (the default for research)
- **Input:** children function + a heuristic score `h(node)`.
- **Output:** the node sequence obtained by always expanding the highest-scoring frontier node.
- **Use when:** you can score nodes (you can — the tournament gives Elo). Expand the current
  best hypothesis, generate its refinements/experiments, re-score, repeat. This is what
  AI-Scientist-v2 uses. **Default to this**: it puts compute where the evidence is best.

### Beam Search (best-first, memory-bounded)
- **Input:** children function, score `h(node)`, **beam width k**.
- **Output:** at each level, keep only the top-`k` nodes and expand those; the rest are pruned.
- **Use when:** the branching is wide and you must bound cost. Keep the top **k = 3–5**
  hypotheses alive, expand each one cycle, prune back to `k`. Maps directly onto "keep ≥3 rivals
  on the board" — beam width = how many hypotheses you carry.

### Monte-Carlo Tree Search (MCTS)
- **Input:** children function, a reward/rollout estimate for a node, an iteration budget.
- **Output:** the best child, chosen by balancing exploration and exploitation (UCB, see below).
- **Use when:** decisions are *sequential* and a node's value only becomes clear after several
  more steps (a multi-stage experimental program). Heavier than best-first; reach for it only
  when a one-shot score isn't enough. The selection rule inside MCTS is UCB
  (`research-algorithms`).

## Exploration vs exploitation — the one rule that governs all of them

Every strategy trades **exploiting** the current best node against **exploring** uncertain ones.
- Pure exploitation (greedy DFS on the leader) risks a local optimum — you confirm a good-looking
  wrong hypothesis.
- Pure exploration (BFS everything) wastes budget.
- Best-first / beam with the tournament score, plus a bandit rule (UCB / Thompson from
  `research-algorithms`) for *which experiment next*, is the balanced default.

## Bounding the tournament (don't compare every pair)

When the board is large, a full round-robin of `rank` comparisons is `O(n²)`. Instead:
- **Beam:** only rank the top-`k` alive hypotheses against each other.
- **Swiss pairing:** each round, pair hypotheses of *similar* Elo (near-equal `get_ratings`);
  a few rounds rank a big field cheaply. See `research-algorithms` for Swiss + Bradley-Terry.
- **Successive halving:** give every hypothesis a small test, keep the top half, repeat — a
  tournament of experiments under a fixed budget (`research-algorithms`).

## Practical default

For most investigations: **beam search with width 3–5 over the hypothesis board, scored by the
`rank` tournament (Elo), expanding the leader and its nearest rival each cycle, and choosing the
next experiment with a UCB/Bayesian-optimization rule when experiments are expensive.** Escalate
to MCTS only for genuinely multi-stage experimental programs.
