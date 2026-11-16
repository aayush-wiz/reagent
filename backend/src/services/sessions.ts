/**
 * backend/src/services/sessions.ts — chat sessions inside a research.
 *
 *   A research holds many sessions; each session holds a message thread. The
 *   agent turns are persisted here (persistTurn) so a session survives reloads.
 */
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ModelMessage } from "ai";
import { db } from "../repositories/db-client.ts";
import { sessions, messages, researches, tasks } from "../models/schema.ts";

const jparse = (s: string | null | undefined): unknown[] => {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function listSessions(researchId: string) {
  return db.select().from(sessions).where(eq(sessions.researchId, researchId)).orderBy(desc(sessions.updatedAt)).all();
}

/** Recent chat sessions across the user's researches, tagged with their research. */
export function recentSessions(limit = 30, userId?: string) {
  const rows = db
    .select({
      id: sessions.id,
      title: sessions.title,
      updatedAt: sessions.updatedAt,
      researchId: sessions.researchId,
      researchTitle: researches.title,
      ownerId: researches.userId,
    })
    .from(sessions)
    .leftJoin(researches, eq(sessions.researchId, researches.id))
    .orderBy(desc(sessions.updatedAt))
    .all();
  const scoped = userId ? rows.filter((r) => r.ownerId === userId) : rows;
  // Which sessions have a live run right now (for the sidebar shimmer).
  const active = db.select({ sid: tasks.sessionId }).from(tasks).where(inArray(tasks.status, ["queued", "running"])).all();
  const running = new Set(active.map((a) => a.sid).filter(Boolean) as string[]);
  return scoped.slice(0, limit).map(({ ownerId, ...r }) => ({ ...r, running: running.has(r.id) }));
}

export function getSession(id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

/** Rough token estimate of the full history fed to the model next turn (~4 chars/token).
 *  ONLY a pre-first-turn fallback — once a turn runs we use the provider's REAL count. */
export function sessionTokenEstimate(id: string): number {
  return Math.ceil(JSON.stringify(sessionModelMessages(id)).length / 4);
}

/**
 * The session's REAL context usage (tokens) — the provider-reported `contextTokens`
 * of the most recent AI turn (input + output the model actually counted), NOT a
 * chars/4 guess. Per session: reads only this session's latest AI turn. Falls back
 * to the rough estimate only when no turn has run yet (brand-new session) or the
 * turn predates usage tracking. Scoped per user because sessions belong to a
 * user's research; the caller gates access by ownership.
 */
export function sessionUsage(id: string): { tokens: number; real: boolean } {
  const last = db
    .select({ usage: messages.usage })
    .from(messages)
    .where(and(eq(messages.sessionId, id), eq(messages.role, "ai")))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();
  if (last?.usage) {
    try {
      const u = JSON.parse(last.usage) as { contextTokens?: number; inputTokens?: number };
      const tokens = u.contextTokens || u.inputTokens || 0;
      if (tokens > 0) return { tokens, real: true };
    } catch {
      /* fall through to estimate */
    }
  }
  return { tokens: sessionTokenEstimate(id), real: false };
}

export function createSession(researchId: string, input?: { title?: string; agent?: string }) {
  const id = `s_${nanoid(10)}`;
  const now = Date.now();
  db.insert(sessions)
    .values({ id, researchId, title: input?.title || "New session", agent: input?.agent || "research", createdAt: now, updatedAt: now })
    .run();
  return getSession(id)!;
}

/** Get the most recent session for a research, creating one if none exist. */
export function ensureSession(researchId: string) {
  return listSessions(researchId)[0] ?? createSession(researchId);
}

export function sessionMessages(sessionId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all()
    .map((m) => ({ ...m, cites: JSON.parse(m.cites) as string[], parts: jparse((m as { parts?: string }).parts) }));
}

/**
 * Replay the WHOLE session as model messages — every user turn plus each AI
 * turn's full tool calls + tool results (not just its final text). This is what
 * a follow-up turn is fed, so the agent knows everything it did earlier. Falls
 * back to the AI text for turns saved before this was tracked.
 */
export function sessionModelMessages(sessionId: string): ModelMessage[] {
  const rows = db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .all();
  const out: ModelMessage[] = [];
  for (const m of rows) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else {
      const mm = jparse((m as { modelMessages?: string }).modelMessages) as ModelMessage[];
      if (mm.length) out.push(...mm);
      else if (m.text) out.push({ role: "assistant", content: m.text }); // pre-migration turn
    }
  }
  return out;
}

function renameSessionFromFirstMessage(sessionId: string, researchId: string, text: string) {
  const s = getSession(sessionId);
  if (!s || s.title !== "New session") return;
  const title = text.trim().replace(/\s+/g, " ").slice(0, 60) || "New session";
  db.update(sessions).set({ title }).where(and(eq(sessions.id, sessionId), eq(sessions.researchId, researchId))).run();
}

/** Mark a session as just-used (bumps updatedAt), so "last used" ordering
 *  reflects opening it, not only sending a message. */
export function touchSession(id: string) {
  db.update(sessions).set({ updatedAt: Date.now() }).where(eq(sessions.id, id)).run();
}

/**
 * Persist one chat turn (the user prompt + the agent's reply) — for EVERY
 * terminal state, not only success. Idempotent per task: passing `taskId`
 * replaces any turn previously persisted for that run (a BullMQ re-delivery,
 * a crash-recovery backfill, or a retry can never duplicate a turn).
 */
export function persistTurn(input: {
  researchId: string;
  sessionId: string;
  userText: string;
  assistantText: string;
  cites?: string[];
  parts?: unknown[]; // the raw UI-stream timeline for the AI turn (reasoning + tools + text)
  modelMessages?: unknown[]; // the AI turn's full ModelMessages (tool calls + results)
  taskId?: string; // the run that produced this turn — enables idempotent upsert
  usage?: unknown; // the AI turn's REAL provider usage { contextTokens, inputTokens, outputTokens, totalTokens }
}) {
  const now = Date.now();
  renameSessionFromFirstMessage(input.sessionId, input.researchId, input.userText);
  if (input.taskId) {
    db.delete(messages).where(eq(messages.taskId, input.taskId)).run(); // replace, never duplicate
  }
  db.insert(messages)
    .values([
      { id: `m_${nanoid(10)}`, researchId: input.researchId, sessionId: input.sessionId, role: "user", name: "You", text: input.userText, cites: "[]", parts: "[]", modelMessages: "[]", taskId: input.taskId ?? null, createdAt: now },
      { id: `m_${nanoid(10)}`, researchId: input.researchId, sessionId: input.sessionId, role: "ai", name: "Research agent", text: input.assistantText, cites: JSON.stringify(input.cites ?? []), parts: JSON.stringify(input.parts ?? []), modelMessages: JSON.stringify(input.modelMessages ?? []), taskId: input.taskId ?? null, usage: JSON.stringify(input.usage ?? {}), createdAt: now + 1 },
    ])
    .run();
  db.update(sessions).set({ updatedAt: now + 1 }).where(eq(sessions.id, input.sessionId)).run();
}

/** Has a chat turn already been persisted for this run? */
export function turnExistsForTask(taskId: string): boolean {
  return !!db.select({ id: messages.id }).from(messages).where(eq(messages.taskId, taskId)).limit(1).get();
}
