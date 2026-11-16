# Reagent — The Iterative Research Method (Strong-Inference Tournament)

How Reagent stops doing **linear** research (guess one hypothesis → run → write it up)
and starts doing **real** research: hold several rival hypotheses at once, make them
compete, kill some with evidence, and **loop back** until one survives. This is the
agreed plan — built from the established scientific norms (Platt's *Strong Inference*,
Google Co-Scientist's *generate–debate–evolve* Elo tournament, AI-Scientist-v2's
best-first tree search, and Bayesian optimal experimental design).

> **Not a hardcoded loop.** There is NO `while` loop added in `loop.ts`. The iteration
> is *emergent*: the existing ReAct engine already auto-continues while the agent keeps
> acting. We give the agent (1) a **skill** that teaches the method, (2) **tools** that
> hold the hypothesis/tournament state durably, and (3) a **subagent** that judges the
> tournament. The agent decides how many cycles, when to prune, and when to re-enter —
> by reasoning over the live board, not by a coded branch.

---

## What the method is (the norm the agent follows)

A loop of operations, driven by the state on the hypothesis board — not a fixed sequence:

1. **SCOPE** — define the question and what a decisive answer looks like.
2. **GENERATE** — put **≥3 competing hypotheses** on the board (`add_hypothesis`). For each:
   its claim, its H0, what would confirm it, and — the key move — what would **refute** it.
3. **DIVERSIFY** — dedupe so the rivals genuinely disagree (Proximity).
4. **REFLECT** — cheap-kill the unsound ones with the `critique` subagent (peer review).
5. **RANK** — the tournament. Spawn the `rank` subagent to run **pairwise scientific
   debates**; record each outcome with `record_match` (updates Elo). The board re-orders.
6. **DESIGN** the crucial experiment — the one test that best **discriminates** the top
   hypothesis from its nearest rival (max information gain), not one that confirms it.
7. **PRE-REGISTER** — lock the success/failure criteria into the board **before** running
   (`update_hypothesis`). This is the anti-p-hacking / anti-HARKing gate.
8. **RUN** — real compute in the sandbox, or evidence synthesis for a literature question.
9. **VERIFY & UPDATE** — `critique` gate 2 checks traceability; then apply the
   pre-registered rule and mark refuted hypotheses `refuted` (a refutation is **data**).
10. **EVOLVE & RE-ENTER** — combine/mutate the survivors into sharper hypotheses and
    go back to step 3 with a smaller, stronger board.
11. **TERMINATE** — when one hypothesis survives its crucial test and meets its
    pre-registered criteria, or the budget is spent (report the board honestly).
12. **SYNTHESIZE → blind `reviewer` audit → `write`.**

---

## What we build (the whole delta — nothing else)

### A. Two tools — durable state (coded backend)
`backend/src/agent/skills/hypotheses.ts`, backed by two new SQLite tables
(`hypotheses`, `hypothesis_matches`):

- **Hypothesis board:** `add_hypothesis`, `update_hypothesis`, `list_hypotheses`.
  Holds each node: statement, H0, confirm/refute evidence, status
  (`alive|supported|refuted|evolved|merged`), Elo rating, match count, evolution lineage.
- **Ranking store:** `record_match` (deterministic Elo update from one pairwise outcome),
  `get_ratings` (the leaderboard).

State lives in SQLite — NOT the model's context — so the loop survives steps, context
windows, and sessions. The Elo arithmetic is the *definition* of Elo (deterministic
bookkeeping), not a research heuristic: the agent/`rank` subagent decides *who wins and
why*; the tool only records it and keeps ratings consistent.

### B. Three skills — methodology + numeric reference (SKILL.md packs)
- `skills/research/research-loop/SKILL.md` — the method above, as general instructions
  the agent reasons through (the norm; references the tools + subagents by name).
- `skills/research/search-strategy/SKILL.md` — BFS / DFS / Best-First / Beam / MCTS:
  what each is, input → output, and **when to pick which** to explore the hypothesis tree.
- `skills/research/research-algorithms/SKILL.md` — the numeric algorithms
  (Bradley-Terry, UCB1 / Thompson / ε-greedy, Bayesian optimization, MAP-Elites,
  successive halving / Hyperband): formula, when-to-use, input → output, library, and a
  **real code template**. Ships working scripts under `scripts/` for the fiddly ones.
  The agent WRITES/RUNS the code in the sandbox; the skill makes it correct & consistent.

### C. One subagent — the tournament judge
`rank` (in `agents.ts` + `prompts.ts`): a read-only pairwise LLM judge. Given the board +
evidence, it runs scientific debates and returns which hypothesis wins each pairing and
why, so the primary records the matches. Reuses `critique` (Reflection) and `reviewer`
(blind audit).

### D. Wire-up
- `schema.ts` — the two tables.
- `db-client.ts` — idempotent `CREATE TABLE IF NOT EXISTS` for both.
- `registry.ts` — add the tools to `ALL_SKILLS`.
- `agents.ts` — grant the tool slugs (reads to subagents, writes to primary); add `rank`.
- `prompts.ts` — add `rankPrompt`; rewrite the primary `researchPrompt` from the linear
  8 stages into the loop above (general instructions, not a coded sequence).
- Step budget stays governed by `REAGENT_MAX_STEPS` (default 200) — raise via env for
  deep multi-cycle runs.

### Reused as-is (no rebuild)
ReAct engine (`loop.ts`), `critique`, `reviewer`, `write`, `literature-review`, the
sandbox (`bash`/`run_python`), the working documents, and `task` fan-out.
