/**
 * routes/findings.ts — findings across ALL researches (the Findings section).
 *
 *   GET /api/findings → every recorded finding, joined with the research it was
 *                       extracted from (so the UI can show a "Research" column).
 */
import type { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";
import { findings, researches } from "../models/schema.ts";

export function registerFindingRoutes(app: Hono): void {
  app.get("/api/findings", (c) => {
    const rows = db
      .select({
        id: findings.id,
        kind: findings.kind,
        text: findings.text,
        createdAt: findings.createdAt,
        researchId: findings.researchId,
        researchTitle: researches.title,
        researchIcon: researches.icon,
        researchColor: researches.color,
        ownerId: researches.userId,
      })
      .from(findings)
      .leftJoin(researches, eq(findings.researchId, researches.id))
      .orderBy(desc(findings.createdAt))
      .all();
    const uid = c.get("userId");
    return c.json({ findings: rows.filter((r) => r.ownerId === uid).map(({ ownerId, ...r }) => r) });
  });
}
