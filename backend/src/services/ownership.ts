/**
 * backend/src/services/ownership.ts — the multi-tenant access layer.
 *
 *   Every resource resolves to an owning user (directly, or via its research).
 *   Routes call these guards before reading/writing a resource; the API answers
 *   404 (not 403) for resources the caller doesn't own, so existence never leaks.
 */
import { eq } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";
import { researches, sessions, tasks, papers } from "../models/schema.ts";

/** The user id that owns a research, or null. */
export function researchOwner(researchId: string): string | null {
  const r = db.select({ userId: researches.userId }).from(researches).where(eq(researches.id, researchId)).get();
  return r?.userId ?? null;
}

export function ownsResearch(userId: string | undefined, researchId: string | null | undefined): boolean {
  if (!userId || !researchId) return false;
  return researchOwner(researchId) === userId;
}

/** A session is owned via its research. */
export function ownsSession(userId: string | undefined, sessionId: string): boolean {
  if (!userId) return false;
  const s = db.select({ researchId: sessions.researchId }).from(sessions).where(eq(sessions.id, sessionId)).get();
  return s ? ownsResearch(userId, s.researchId) : false;
}

/** A task carries its owner directly (it can exist without a research). */
export function ownsTask(userId: string | undefined, taskId: string): boolean {
  if (!userId) return false;
  const t = db.select({ userId: tasks.userId }).from(tasks).where(eq(tasks.id, taskId)).get();
  return t?.userId === userId;
}

/** A paper is owned via its research. */
export function ownsPaper(userId: string | undefined, paperId: string): boolean {
  if (!userId) return false;
  const p = db.select({ researchId: papers.researchId }).from(papers).where(eq(papers.id, paperId)).get();
  return p ? ownsResearch(userId, p.researchId) : false;
}
