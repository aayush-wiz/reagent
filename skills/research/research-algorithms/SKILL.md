---
name: research-algorithms
description: "The numeric algorithms behind the research loop — ranking (Bradley-Terry), next-experiment selection (UCB, Thompson sampling, epsilon-greedy, Bayesian optimization), and hypothesis breeding (MAP-Elites, successive halving / Hyperband). For each: what it is, when to use it, input to output, the formula, the Python library, and a ready-to-run script under scripts/. You write and run the code in the sandbox; this makes it correct and consistent."
category: research
---

# Research Algorithms — rank, select, breed (with runnable scripts)

The research loop needs three kinds of math: **rank** competing hypotheses, **select** the next
experiment to run, and **breed** a diverse hypothesis population. This skill documents each
algorithm and ships a real, tested Python script for the fiddly ones under
`skills/research/research-algorithms/scripts/`.

**How to use this skill:** load it, pick the algorithm that matches your situation from the table,
then either adapt the short template or — for the shipped ones — run the script in the sandbox
with `bash` (do **not** rewrite it). Every script reads/writes JSON so you pipe your own data in.
The scientific Python stack (numpy, scipy, scikit-learn) is pre-installed.

| Situation | Algorithm | Script |
|---|---|---|
| Turn many pairwise tournament outcomes into one accurate ranking | Bradley-Terry (MLE) | `bradley_terry.py` |
| Choose the next experiment among a few options, cheaply | UCB1 / Thompson / ε-greedy | `bandits.py` |
| Choose the next experiment when each run is expensive and inputs are continuous | Bayesian optimization (GP + EI) | `bayesopt.py` |
| Keep a *diverse* set of high-quality hypotheses, not one winner | MAP-Elites (quality-diversity) | `map_elites.py` |
| Screen many candidates under a fixed budget, killing losers early | Successive halving / Hyperband | `successive_halving.py` |

The live Elo on the hypothesis board (`record_match`) already gives you a running ranking during
the tournament. Reach for the scripts below when you need a *more accurate final ranking*
(Bradley-Terry) or to *decide what to run next* (bandits / Bayesian optimization / halving).

---

## 1. Bradley-Terry — accurate ranking from pairwise outcomes

- **What:** fits one latent *strength* per item from all pairwise win/loss results; more accurate
  offline than live Elo (used by LMArena / Arena-Hard).
- **When:** after the tournament, to produce the definitive ranking from the full match log.
- **Input → Output:** a list of `(winner_id, loser_id)` matches → a strength score per hypothesis
  (sorted).
- **Formula:** `P(i beats j) = strength_i / (strength_i + strength_j)`, fit by maximum likelihood.
- **Library:** numpy (the script uses the closed-form MM / Zermelo iteration — no heavy deps).
- **Run:** `python scripts/bradley_terry.py matches.json` where `matches.json` is
  `[{"winner": "h_a", "loser": "h_b"}, …]`. Prints the ranked strengths.

## 2. Multi-armed bandits — cheap next-experiment selection

- **What:** pick which "arm" (experiment / hypothesis to test) to pull next, balancing exploiting
  the current best against exploring uncertain ones.
- **When:** you have a handful of candidate experiments, each returns a noisy reward, and you want
  to spend your budget where it learns most.
- **Input → Output:** per-arm history of rewards → the arm to try next.
- **Formulas:**
  - **UCB1:** pick `argmax_i  x̄_i + sqrt(2·ln N / n_i)` (mean + exploration bonus).
  - **Thompson (Bernoulli):** sample `θ_i ~ Beta(1+wins_i, 1+losses_i)`, pick `argmax θ_i`.
  - **ε-greedy:** best arm with prob `1−ε`, random arm with prob `ε`.
- **Library:** numpy.
- **Run:** `python scripts/bandits.py --strategy ucb arms.json` where `arms.json` is
  `{"arm_a": {"reward_sum": 3.2, "pulls": 5}, …}` (or Beta counts for Thompson). Prints the arm to
  pull next.

## 3. Bayesian optimization — expensive, continuous experiment selection

- **What:** models the objective with a Gaussian-process surrogate and proposes the next input
  that maximises an acquisition function — formal optimal experimental design.
- **When:** each experiment is expensive (a long sandbox run, a costly simulation) and the knob
  you're tuning is continuous (a threshold, a rate, a hyperparameter).
- **Input → Output:** observed points `(x, y)` and the input bounds → the next `x` to evaluate.
- **Formula (Expected Improvement):** `EI(x) = E[max(0, f(x) − f_best)]` under the GP posterior.
- **Library:** scikit-learn (`GaussianProcessRegressor`).
- **Run:** `python scripts/bayesopt.py observations.json` where `observations.json` is
  `{"bounds": [[lo, hi], …], "X": [[…], …], "y": [ … ]}`. Prints the next `x` to try.

## 4. MAP-Elites — a diverse archive of good hypotheses

- **What:** quality-diversity search — keep the best solution *per behaviour cell* so you retain a
  diverse set of strong hypotheses instead of collapsing to one. Core of AlphaEvolve.
- **When:** in EVOLVE, to breed hypotheses that are both high-scoring *and* varied along chosen
  axes (e.g. mechanism type × boldness), so the board doesn't converge prematurely.
- **Input → Output:** an evaluate function `→ (fitness, [descriptor…])`, a mutation function, and
  a grid over the descriptor axes → an archive (grid) of the best solution in each cell.
- **Algorithm:** initialise randomly; repeatedly pick a random elite, mutate it, evaluate, and
  place it in its descriptor cell if it beats the current occupant.
- **Library:** numpy.
- **Run:** `python scripts/map_elites.py` runs a self-contained demo; import
  `MapElites` from it and pass your own `evaluate`/`mutate` (the LLM is the mutation operator —
  you generate the mutated hypothesis, the script manages the archive). See the module docstring.

## 5. Successive halving / Hyperband — screen many under a budget

- **What:** give every candidate a small budget, keep the top fraction, multiply the budget, repeat
  — a tournament of experiments that spends compute on survivors.
- **When:** you have many candidate hypotheses/configs and a fixed compute budget and want the best
  without running each to completion.
- **Input → Output:** candidates + an `evaluate(candidate, budget)` + a total budget → the winner
  and the elimination trace.
- **Algorithm:** at rung `r`, evaluate survivors at budget `b·η^r`, keep the top `1/η`, repeat.
- **Library:** numpy.
- **Run:** `python scripts/successive_halving.py` runs a demo; import `successive_halving`
  and pass your own candidates + `evaluate`. See the module docstring.

---

## Rules

- **Prefer the shipped script over rewriting it** — it's tested; you just supply the data.
- Report the raw numeric output. Do not hand-tune or post-hoc adjust a ranking or a selection.
- These decide *what to test* and *how to rank* — they never invent evidence. The evidence still
  comes from real experiments and cited literature.
- For a small board (≤4 hypotheses, a couple of experiment options) you often don't need a script
  at all — the live Elo (`get_ratings`) and a UCB rule you reason through are enough. Reach for the
  scripts when the numbers get big enough that doing it by hand would be error-prone.
