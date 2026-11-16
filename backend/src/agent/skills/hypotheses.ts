/**
 * backend/src/agent/skills/hypotheses.ts — the hypothesis board + ranking store.
 *
 *   Durable state for the iterative Strong-Inference research loop (see
 *   RESEARCH_LOOP.md). The agent keeps several COMPETING hypotheses alive at once,
 *   runs a pairwise `rank` tournament over them, and prunes them with evidence —
 *   instead of committing to one hypothesis early. Because this state must survive
 *   across the ReAct loop's steps, across context windows, and across chat
 *   sessions, it lives in SQLite, NOT in the model's context.
 *
 *   The Elo update in `record_match` is deterministic BOOKKEEPING — the definition
 *   of Elo, not a research heuristic. The agent (via the `rank` subagent) decides
 *   WHO wins a pairing and WHY; this tool only records the outcome and keeps the
 *   ratings consistent so the board stays correctly ordered. Anything heavier
 *   (a Bradley-Terry re-fit over the whole match graph, bandit selection, Bayesian
 *   optimization) is written and run by the agent in the sandbox — see the
 *   `research-algorithms` skill — not hardcoded here.
 *
 *   Tools:
 *     • add_hypothesis     — put a rival hypothesis on the board
 *     • update_hypothesis  — change its status / attach evidence / edit its tests
 *     • list_hypotheses    — read the board, ranked by Elo
 *     • record_match       — record one pairwise tournament outcome (updates Elo)
 *     • get_ratings        — the current leaderboard
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../../repositories/db-client.ts";
import { hypotheses, hypothesisMatches } from "../../models/schema.ts";
import { and, eq, desc } from "drizzle-orm";
import type { Skill } from "../types.ts";

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const STATUSES = ["alive", "supported", "refuted", "evolved", "merged"] as const;
type Status = (typeof STATUSES)[number];

// Standard Elo. K is the update step; 32 is the long-standing default and is right
// for a handful of hypotheses over a few rounds. Overridable but rarely worth it.
const K = Number(process.env.REAGENT_ELO_K) || 32;
const BASE_RATING = 1000;

/** Elo expectation: probability `a` beats `b` given their ratings. */
function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

interface LogEntry {
  ts: number;
  kind: string;
  note: string;
}

/** Append one entry to a hypothesis's JSON evidence/status trail (bounded). */
function pushLog(raw: string, kind: string, note: string): string {
  let arr: LogEntry[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) arr = parsed as LogEntry[];
  } catch {
    arr = [];
  }
  arr.push({ ts: Date.now(), kind, note });
  // Keep the trail from growing unbounded; the most recent entries matter most.
  while (JSON.stringify(arr).length > 12000 && arr.length > 1) arr.shift();
  return JSON.stringify(arr);
}

const addHypothesis: Skill = {
  slug: "add_hypothesis",
  category: "hypotheses",
  description:
    "Put a COMPETING hypothesis on the research's hypothesis board. Real research holds several rivals at " +
    "once — add ≥3 that genuinely disagree, then make them compete (`rank` + `record_match`). For each give: " +
    "the testable `statement`, its `h0` (null hypothesis), `confirm_evidence` (what would confirm it) and — most " +
    "important — `refute_evidence` (the crucial test whose outcome would kill it). Returns the new hypothesis id.",
  inputSchema: z.object({
    statement: z.string().describe("The hypothesis, stated so it can be tested."),
    h0: z.string().optional().describe("The null hypothesis."),
    confirm_evidence: z.string().optional().describe("What observation would confirm this hypothesis."),
    refute_evidence: z.string().optional().describe("The crucial test — what observation would REFUTE it."),
    parent_ids: z.array(z.string()).optional().describe("Ids of the hypotheses this one evolved from (lineage)."),
  }),
  run: (a, ctx) => {
    if (!ctx.researchId) return "No active research — the hypothesis board needs a workspace.";
    const statement = str(a.statement).trim();
    if (!statement) return "Provide `statement` — the hypothesis to test.";
    const id = `h_${nanoid(10)}`;
    db.insert(hypotheses)
      .values({
        id,
        researchId: ctx.researchId,
        statement,
        h0: str(a.h0),
        confirmEvidence: str(a.confirm_evidence),
        refuteEvidence: str(a.refute_evidence),
        status: "alive",
        rating: BASE_RATING,
        matches: 0,
        parentIds: JSON.stringify(Array.isArray(a.parent_ids) ? a.parent_ids : []),
        log: "[]",
      })
      .run();
    const n = db.select().from(hypotheses).where(eq(hypotheses.researchId, ctx.researchId)).all().length;
    return `Added hypothesis ${id} (Elo ${BASE_RATING}, status alive). The board now holds ${n} hypothesis(es). Add its rivals before ranking.`;
  },
};

const updateHypothesis: Skill = {
  slug: "update_hypothesis",
  category: "hypotheses",
  description:
    "Update a hypothesis on the board: set its `status` (alive|supported|refuted|evolved|merged), attach an " +
    "evidence/decision `note`, or revise its `confirm_evidence`/`refute_evidence`. Use this to PRE-REGISTER the " +
    "success/failure criteria BEFORE running an experiment, and afterwards to mark a hypothesis `refuted` or " +
    "`supported` per the result (a refutation is data, not a failure). Does NOT change Elo — use record_match for that.",
  inputSchema: z.object({
    id: z.string().describe("The hypothesis id (from list_hypotheses)."),
    status: z.enum(STATUSES).optional().describe("New status."),
    note: z.string().optional().describe("Evidence or decision to log against this hypothesis."),
    confirm_evidence: z.string().optional().describe("Revised: what would confirm it."),
    refute_evidence: z.string().optional().describe("Revised: the crucial test that would refute it."),
  }),
  run: (a, ctx) => {
    if (!ctx.researchId) return "No active research.";
    const id = str(a.id);
    const row = db
      .select()
      .from(hypotheses)
      .where(and(eq(hypotheses.id, id), eq(hypotheses.researchId, ctx.researchId)))
      .get();
    if (!row) return `No hypothesis "${id}" on this board. Call list_hypotheses to see the ids.`;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const status = str(a.status);
    if (status) {
      if (!STATUSES.includes(status as Status)) return `status must be one of: ${STATUSES.join(", ")}.`;
      patch.status = status;
    }
    if (a.confirm_evidence !== undefined) patch.confirmEvidence = str(a.confirm_evidence);
    if (a.refute_evidence !== undefined) patch.refuteEvidence = str(a.refute_evidence);
    const note = str(a.note);
    if (note || status) {
      patch.log = pushLog(row.log, status || "note", note || `status → ${status}`);
    }
    db.update(hypotheses).set(patch).where(eq(hypotheses.id, id)).run();
    return `Updated ${id}${status ? ` → ${status}` : ""}${note ? " (note logged)" : ""}.`;
  },
};

const listHypotheses: Skill = {
  slug: "list_hypotheses",
  category: "hypotheses",
  description:
    "Read the hypothesis board, ranked by Elo (highest first). Shows each hypothesis's id, statement, status, " +
    "rating, match count, and its confirm/refute tests. Read this at the start of every cycle to decide what to " +
    "test next and whether the loop has converged. Optional `status` filter (e.g. 'alive').",
  inputSchema: z.object({
    status: z.enum(STATUSES).optional().describe("Only show hypotheses with this status."),
  }),
  run: (a, ctx) => {
    if (!ctx.researchId) return "No active research.";
    const filter = str(a.status);
    let rows = db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.researchId, ctx.researchId))
      .orderBy(desc(hypotheses.rating))
      .all();
    if (filter) rows = rows.filter((r) => r.status === filter);
    if (!rows.length) {
      return filter
        ? `No hypotheses with status "${filter}".`
        : "The hypothesis board is empty. Add ≥3 competing rivals with add_hypothesis before you run anything.";
    }
    const aliveCount = rows.filter((r) => r.status === "alive").length;
    const body = rows
      .map((r, i) => {
        const head = `${i + 1}. [${r.id}] **${r.statement}**`;
        const meta = `   status: ${r.status} · Elo ${r.rating.toFixed(0)} · ${r.matches} match(es)`;
        const h0 = r.h0 ? `\n   H0: ${r.h0}` : "";
        const refute = r.refuteEvidence ? `\n   crucial test (refutes it): ${r.refuteEvidence}` : "";
        const confirm = r.confirmEvidence ? `\n   confirms it: ${r.confirmEvidence}` : "";
        return `${head}\n${meta}${h0}${refute}${confirm}`;
      })
      .join("\n\n");
    return `# Hypothesis board — ${rows.length} shown, ${aliveCount} alive\n\n${body}`;
  },
};

const recordMatch: Skill = {
  slug: "record_match",
  category: "hypotheses",
  description:
    "Record ONE pairwise tournament outcome between two hypotheses and update both Elo ratings. Call this after " +
    "the `rank` subagent (or a discriminating experiment) decides which of two rival hypotheses the evidence " +
    "favours. Pass the `winner_id` and `loser_id` (or set `draw` for a tie), plus a one-line `note` on why. " +
    "Repeat over several pairings to run the tournament; the board re-orders by rating.",
  inputSchema: z.object({
    winner_id: z.string().describe("Id of the hypothesis the evidence/debate favoured."),
    loser_id: z.string().describe("Id of the hypothesis it beat."),
    draw: z.boolean().optional().describe("Set true if the pairing was a genuine tie (both get 0.5)."),
    note: z.string().optional().describe("One-line rationale for the outcome (the discriminating evidence)."),
  }),
  run: (a, ctx) => {
    if (!ctx.researchId) return "No active research.";
    const winnerId = str(a.winner_id);
    const loserId = str(a.loser_id);
    const draw = a.draw === true;
    if (!winnerId || !loserId || winnerId === loserId) {
      return "Provide distinct winner_id and loser_id (from list_hypotheses).";
    }
    const w = db
      .select()
      .from(hypotheses)
      .where(and(eq(hypotheses.id, winnerId), eq(hypotheses.researchId, ctx.researchId)))
      .get();
    const l = db
      .select()
      .from(hypotheses)
      .where(and(eq(hypotheses.id, loserId), eq(hypotheses.researchId, ctx.researchId)))
      .get();
    if (!w || !l) return "Unknown hypothesis id(s). Call list_hypotheses to see the current ids.";
    const ew = expectedScore(w.rating, l.rating);
    const el = expectedScore(l.rating, w.rating);
    const sw = draw ? 0.5 : 1;
    const sl = draw ? 0.5 : 0;
    const wNew = w.rating + K * (sw - ew);
    const lNew = l.rating + K * (sl - el);
    const now = Date.now();
    db.update(hypotheses).set({ rating: wNew, matches: w.matches + 1, updatedAt: now }).where(eq(hypotheses.id, winnerId)).run();
    db.update(hypotheses).set({ rating: lNew, matches: l.matches + 1, updatedAt: now }).where(eq(hypotheses.id, loserId)).run();
    db.insert(hypothesisMatches)
      .values({
        id: `hm_${nanoid(10)}`,
        researchId: ctx.researchId,
        winnerId,
        loserId,
        outcome: draw ? "draw" : "win",
        ratingDelta: wNew - w.rating,
        note: str(a.note),
      })
      .run();
    const verdict = draw ? `Draw between ${winnerId} and ${loserId}` : `${winnerId} beat ${loserId}`;
    return `${verdict}. Elo — ${winnerId}: ${w.rating.toFixed(0)}→${wNew.toFixed(0)}, ${loserId}: ${l.rating.toFixed(0)}→${lNew.toFixed(0)}.`;
  },
};

const getRatings: Skill = {
  slug: "get_ratings",
  category: "hypotheses",
  description:
    "The tournament leaderboard: every hypothesis with its live Elo rating, match count, and status, best first. " +
    "A compact view for deciding whether a clear leader has emerged (the loop has converged) or the top rivals " +
    "are still close (keep testing).",
  inputSchema: z.object({}),
  run: (_a, ctx) => {
    if (!ctx.researchId) return "No active research.";
    const rows = db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.researchId, ctx.researchId))
      .orderBy(desc(hypotheses.rating))
      .all();
    if (!rows.length) return "No hypotheses on the board yet.";
    const totalMatches = db.select().from(hypothesisMatches).where(eq(hypothesisMatches.researchId, ctx.researchId)).all().length;
    const board = rows
      .map((r, i) => `${i + 1}. ${r.id} — Elo ${r.rating.toFixed(0)} · ${r.matches} match(es) · ${r.status} · ${r.statement.slice(0, 90)}`)
      .join("\n");
    return `# Tournament leaderboard (${rows.length} hypotheses, ${totalMatches} matches played)\n${board}`;
  },
};

export const hypothesisSkills: Skill[] = [addHypothesis, updateHypothesis, listHypotheses, recordMatch, getRatings];
