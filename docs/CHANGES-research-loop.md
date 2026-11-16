# Change Log — Iterative Research Loop (Strong-Inference Tournament)

Every file created or modified to add the hypothesis-board tournament loop, so it can be
reviewed and reverted. This repo is **not** under git, so reverts are manual — this file is
the record. Design rationale is in `RESEARCH_LOOP.md`.

_Built in one session. Nothing outside this list was touched by this work._

---

## NEW files (delete to remove entirely)

| File | What it is |
|---|---|
| `RESEARCH_LOOP.md` | The design/plan doc for the method. |
| `CHANGES-research-loop.md` | This change log. |
| `backend/src/agent/skills/hypotheses.ts` | The 2 tools: hypothesis board (`add_hypothesis`, `update_hypothesis`, `list_hypotheses`) + ranking store (`record_match` Elo, `get_ratings`). The DB tables are the single source of truth — no markdown mirror. |
| `skills/research/research-loop/SKILL.md` | The method as agent instructions. |
| `skills/research/search-strategy/SKILL.md` | BFS / DFS / best-first / beam / MCTS reference. |
| `skills/research/research-algorithms/SKILL.md` | Numeric-algorithm reference (rank / select / breed). |
| `skills/research/research-algorithms/scripts/bradley_terry.py` | Bradley-Terry ranking (MLE). |
| `skills/research/research-algorithms/scripts/bandits.py` | UCB1 / Thompson / ε-greedy selection. |
| `skills/research/research-algorithms/scripts/bayesopt.py` | Bayesian optimization (GP + Expected Improvement). |
| `skills/research/research-algorithms/scripts/map_elites.py` | MAP-Elites quality-diversity archive. |
| `skills/research/research-algorithms/scripts/successive_halving.py` | Successive halving / Hyperband. |

To fully remove the feature: delete the files above **and** revert the edits below.

---

## MODIFIED files (revert these edits)

### `backend/src/models/schema.ts`
- Added `real` to the `drizzle-orm/sqlite-core` import.
- Added two table definitions before `mcpServers`: **`hypotheses`** and **`hypothesisMatches`**.
- Revert: remove those two table blocks and drop `real` from the import if unused elsewhere.

### `backend/src/repositories/db-client.ts`
- Added `CREATE TABLE IF NOT EXISTS hypotheses` + `hypothesis_matches` (with indexes) to the
  bootstrap block.
- Added the `dropIfStaleEmpty(...)` helper + its two calls (self-healing migration that drops a
  stale, EMPTY prototype `hypotheses`/`hypothesis_matches` table so the current schema applies —
  never drops a table with rows).
- Revert: remove the two CREATE statements, the helper, and its two calls.

### `backend/src/agent/registry.ts`
- Added `import { hypothesisSkills } from "./skills/hypotheses.ts";`
- Added `...hypothesisSkills` to `ALL_SKILLS`.
- Revert: remove both lines.

### `backend/src/agent/agents.ts`
- Imported `rankPrompt` from `./prompts.ts`.
- Added `list_hypotheses`, `get_ratings` to `READ_TOOLS`; `add_hypothesis`, `update_hypothesis`,
  `record_match` to `WRITE_TOOLS`.
- Added the **`rank`** subagent definition (and updated the header comment "five"→"six").
- Revert: remove the import, the added slugs, and the `rank` agent block.

### `backend/src/agent/prompts.ts`
- Updated the header comment (8-stage → iterative tournament).
- Added the "## The hypothesis board" section and the three research skills to the "## Skills"
  section; added `rank` to the subagent roster.
- **Rewrote** the primary `researchPrompt` workflow from the linear "Research Workflow (8 stages)"
  into the loop (SCOPE / LITERATURE / GENERATE / DIVERSIFY / REFLECT / RANK / DESIGN / PRE-REGISTER /
  GATE 1 / RUN / GATE 2 / ANALYZE / UPDATE BELIEFS / EVOLVE & RE-ENTER / TERMINATE / SYNTHESIZE /
  WRITE).
- Appended the **`rankPrompt`** export at the end.
- Revert: the pre-change version was the linear 8-stage prompt. To restore it, replace the workflow
  section back to the 8 stages and remove `rankPrompt` + the board/skill/roster additions. (The old
  text is preserved in `RESEARCH_LOOP.md`'s history discussion and in the openscience source it was
  ported from.)

### `backend/src/services/documents.ts`
- No net change. (An earlier iteration added a `hypotheses` canonical doc to mirror the board into
  markdown; that was removed — the DB board is the single source of truth, not mirrored to a document.)

---

## Database

Two new tables in `data/app.db`: `hypotheses`, `hypothesis_matches` (both keyed per-research,
cascade-delete with the research). They are created idempotently on boot. To remove:
`DROP TABLE hypothesis_matches; DROP TABLE hypotheses;` (a fresh DB simply won't recreate them
once the code above is reverted).

## NOT changed by this work
`loop.ts` (the ReAct engine — the loop stays emergent, no hardcoded control flow was added),
`worker.ts`, the routes, and the frontend. One PRE-EXISTING, unrelated error remains in
`src/pages/sections/ChatPage.tsx:297` (`ArrowLeft` used without a `lucide-react` import) — not from
this work.

## Verification run (all passed)
- Backend loads under `tsx`; all 5 board tools register; `rank` subagent present; primary prompt is
  the loop (no "8 stages").
- End-to-end: add → record_match (Elo 1000→1016 / 1000→984) → update (status+trail) → `list_hypotheses`
  / `get_ratings` reflect the changes. The board lives only in the DB (single source of truth).
- All 5 Python scripts run on sample data with correct output.
