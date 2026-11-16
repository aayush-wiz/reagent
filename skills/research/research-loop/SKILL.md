---
name: research-loop
description: "The iterative Strong-Inference tournament — how to do real research instead of a linear guess-and-write. Load at the start of any non-trivial investigation. Keep several competing hypotheses on the board, make them compete in a pairwise tournament, kill some with evidence, evolve the survivors, and loop back until evidence (not preference) decides."
category: research
---

# The Iterative Research Loop (Strong-Inference Tournament)

## Why this exists

A linear pipeline — guess one hypothesis, run one analysis, write it up — can only ever
*confirm* what you already guessed. That is advocacy, not research. The scientific norm is
a **loop** that holds several rival hypotheses, designs experiments to *falsify* them, and
re-enters earlier steps as evidence comes in. This skill is that method, built from
J. R. Platt's **Strong Inference** (multiple working hypotheses + crucial experiments),
the **generate–debate–evolve** Elo tournament, and **pre-registration** rigor.

**This is a method you reason through — not a script.** You decide the order of operations,
how many cycles to run, and when to loop back, by reading the live state of the
**hypothesis board**. Nothing here runs on a fixed schedule.

## The state you work over: the hypothesis board

Everything hangs off the board (durable tools, not chat memory):

- `add_hypothesis(statement, h0, confirm_evidence, refute_evidence, parent_ids?)` — put a
  rival on the board.
- `list_hypotheses(status?)` — read the board, ranked by Elo.
- `update_hypothesis(id, status?, note?, confirm_evidence?, refute_evidence?)` — set status
  (`alive | supported | refuted | evolved | merged`), attach evidence, pre-register criteria.
- `record_match(winner_id, loser_id, draw?, note?)` — record one pairwise tournament outcome;
  updates both hypotheses' Elo.
- `get_ratings()` — the leaderboard (has a clear leader emerged, or are the top rivals close?).

Read the board at the **start of every cycle**.

## The operations (call them as the board demands; re-enter freely)

### 1. GENERATE ≥3 competing hypotheses
After grounding in the literature, add **at least three** rival hypotheses that genuinely
disagree. For each, be explicit about the crucial test — *what observation would refute it*.
A board with one hypothesis is not research.

- Do **not** collapse to a single "selected direction" early. Plurality is the point.
- Rivals should span the space of explanations (mechanism A vs B vs "no effect / confound"),
  not be three phrasings of one idea.

### 2. DIVERSIFY (Proximity)
Merge or drop near-duplicates (`update_hypothesis … status:"merged"`) so compute is spent on
distinct explanations.

### 3. REFLECT — cheap kill before compute
Spawn a `critique` subagent per serious hypothesis (peer review for soundness, leakage, bad
stats, unsupported claims). Mark the logically broken ones `refuted` **now** — never spend an
experiment on a hypothesis a read-through already kills.

### 4. RANK — the tournament
Spawn the `rank` subagent over the alive hypotheses. It runs pairwise scientific debates and
returns which the current evidence favours per pairing. Take each verdict and call
`record_match(winner, loser, note)`. The board re-orders by Elo. When the top two are close on
`get_ratings`, that gap is telling you **where the decisive experiment is**.

- For a bigger board, don't run all pairs — use a **Swiss-style** schedule (pair near-equal
  ratings) or read `search-strategy` to bound the comparisons.
- To turn many pairwise outcomes into a sharper final ranking, fit **Bradley-Terry** over the
  match log (see `research-algorithms`).

### 5. DESIGN the crucial experiment
Take the leader and its nearest rival and design the **one** test whose outcome would *split*
them — maximise information gain; do not design a test that only confirms the favourite. When
the choice of *what to run next* is expensive, select it with a **bandit (UCB / Thompson)** or
**Bayesian optimization** (see `research-algorithms`) instead of guessing.

### 6. PRE-REGISTER (rigor gate)
**Before running anything**, lock the criteria into the board with `update_hypothesis`: for
each rival in this test, state which outcome refutes it and which supports it. Deciding what
the result *means* before you see it is what prevents p-hacking and HARKing.

### 7. RUN → VERIFY
Execute in the sandbox (or synthesise evidence for a literature question). Pass the two
CRITIQUE gates in the main workflow (pre-compute methodology audit, post-compute output-integrity
audit). Report raw outputs — never post-hoc calibrate.

### 8. UPDATE BELIEFS
Apply the pre-registered rule: mark refuted hypotheses `refuted` and supported ones `supported`
(log the deciding evidence), and `record_match` the experiment's verdict between the rivals it
tested — so Elo reflects real evidence, not just debate. **A refutation is data.**

### 9. EVOLVE & RE-ENTER
Combine and sharpen the survivors into better hypotheses (`add_hypothesis` with `parent_ids`),
then go back to DIVERSIFY / REFLECT / RANK / DESIGN with the smaller, stronger board. This
loop-back is the whole method.

### 10. TERMINATE
Stop when **one hypothesis has survived its crucial test and meets its pre-registered success
criteria** (a clear Elo leader with rivals refuted), or the budget is spent — in which case
report the board honestly (what leads, what's still open). Do not force a conclusion.

## Anti-patterns (this is what "linear research" looks like — avoid it)

- One hypothesis on the board → you are confirming, not testing. Add rivals.
- Designing a test that can only confirm the favourite → design one that could **kill** it.
- Deciding what a result "means" after seeing it → pre-register first.
- Treating a refutation as failure → it is the loop working; evolve and continue.
- Writing up before an Elo leader has survived a crucial test → keep looping or report honestly.

## Companion skills

- `search-strategy` — how to explore the hypothesis/experiment space (BFS / best-first / beam /
  MCTS) and bound the tournament.
- `research-algorithms` — the numeric algorithms (Bradley-Terry ranking, UCB / Thompson,
  Bayesian optimization, MAP-Elites, successive halving) with formulas, templates, and ready
  scripts you run in the sandbox.
