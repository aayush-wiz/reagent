/**
 * backend/src/services/researches.ts — research read/write helpers.
 *
 *   All DB access for the research workspace goes through here. Routes stay
 *   thin (parse → call service → json); business logic lives in this file.
 */
import { eq, asc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { researches, papers, messages, findings, outputs, sessions } from "../models/schema.ts";
import { listSessions } from "./sessions.ts";
import { documentsForUI } from "./documents.ts";

/** A compact "time since" label from a ms timestamp (e.g. "just now", "5m ago",
 *  "3h ago", "2d ago", "Jul 3"). */
function relativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function listResearches(userId?: string) {
  const rows = db.select().from(researches).orderBy(asc(researches.createdAt)).all();
  const scoped = userId ? rows.filter((r) => r.userId === userId) : rows;
  // The stored `updated_label` column is frozen at creation ("just now"), so it's
  // the same for every row. Compute a LIVE label from the most recent session
  // activity per research (persistTurn/touchSession bump session.updatedAt),
  // falling back to when the research was created.
  const latest = new Map<string, number>();
  for (const s of db.select({ researchId: sessions.researchId, updatedAt: sessions.updatedAt }).from(sessions).all()) {
    if (s.updatedAt > (latest.get(s.researchId) ?? 0)) latest.set(s.researchId, s.updatedAt);
  }
  return scoped.map((r) => ({ ...r, updatedLabel: relativeTime(latest.get(r.id) ?? r.createdAt) }));
}

export function getResearch(id: string) {
  return db.select().from(researches).where(eq(researches.id, id)).get();
}

export function getPapers(researchId: string) {
  return db
    .select()
    .from(papers)
    .where(eq(papers.researchId, researchId))
    .orderBy(asc(papers.createdAt))
    .all()
    .map((p) => ({ ...p, selected: !!p.selected }));
}

export function getMessages(researchId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.researchId, researchId))
    .orderBy(asc(messages.createdAt))
    .all()
    .map((m) => ({ ...m, cites: JSON.parse(m.cites) as string[] }));
}

export function getFindings(researchId: string) {
  return db.select().from(findings).where(eq(findings.researchId, researchId)).orderBy(asc(findings.createdAt)).all();
}

export function getOutputs(researchId: string) {
  return db
    .select()
    .from(outputs)
    .where(eq(outputs.researchId, researchId))
    .orderBy(asc(outputs.createdAt))
    .all()
    .map((o) => ({ ...o, data: JSON.parse(o.data) }));
}

/** Full workspace payload for /api/researches/:id. When `userId` is given, a
 *  research owned by someone else is treated as not found. */
export function getWorkspace(id: string, userId?: string) {
  const research = getResearch(id);
  if (!research) return null;
  if (userId && research.userId !== userId) return null;
  return {
    research,
    papers: getPapers(id),
    messages: getMessages(id),
    findings: getFindings(id),
    outputs: getOutputs(id),
    sessions: listSessions(id),
    documents: documentsForUI(id),
  };
}

export function createResearch(input: { title: string; meta?: string; userId?: string | null }) {
  const id = `r_${nanoid(10)}`;
  db.insert(researches)
    .values({ id, userId: input.userId ?? null, title: input.title || "untitled-research", meta: input.meta ?? "", status: "draft", updatedLabel: "just now" })
    .run();
  return getResearch(id)!;
}

/** Load specific papers by id (for injecting the user's selected papers into agent context). */
export function getPapersByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(papers).where(inArray(papers.id, ids)).all();
}

export function togglePaperSelected(paperId: string) {
  const p = db.select().from(papers).where(eq(papers.id, paperId)).get();
  if (!p) return null;
  const next = p.selected ? 0 : 1;
  db.update(papers).set({ selected: next }).where(eq(papers.id, paperId)).run();
  return { ...p, selected: !!next };
}

export function addMessage(researchId: string, input: { text: string }) {
  const userMsg = {
    id: `m_${nanoid(10)}`,
    researchId,
    role: "user",
    name: "You",
    text: input.text,
    cites: "[]",
    createdAt: Date.now(),
  };
  const aiMsg = {
    id: `m_${nanoid(10)}`,
    researchId,
    role: "ai",
    name: "Research agent",
    text: "Working on it — pulling the relevant passages from your selected papers and updating the analysis. I'll post results to the Outputs panel as they land.",
    cites: JSON.stringify(["Okoro 2023", "Suzuki 2024"]),
    createdAt: Date.now() + 1,
  };
  db.insert(messages).values([userMsg, aiMsg]).run();
  return getMessages(researchId);
}
