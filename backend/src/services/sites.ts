/**
 * backend/src/services/sites.ts — published research web pages.
 *
 *   The agent's `publish_site` tool builds a self-contained HTML page from a
 *   research's report + figures and calls publishSite() to snapshot it here. The
 *   page is then served at a stable public URL (GET /sites/:id, routes/sites.ts),
 *   like a Claude Artifact. One row per research: re-publishing overwrites it so
 *   the URL stays the same (redeploy).
 */
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { sites } from "../models/schema.ts";

export function getSite(id: string) {
  return db.select().from(sites).where(eq(sites.id, id)).get();
}

export function getSiteByResearch(researchId: string) {
  return db.select().from(sites).where(eq(sites.researchId, researchId)).get();
}

/** Publish (or re-publish) a research's web page. Stable URL: an existing site
 *  for the research is updated in place; a new one gets a fresh slug. */
export function publishSite(researchId: string, title: string, html: string) {
  const now = Date.now();
  const bytes = Buffer.byteLength(html, "utf8");
  const existing = getSiteByResearch(researchId);
  if (existing) {
    db.update(sites).set({ title, html, bytes, updatedAt: now }).where(eq(sites.id, existing.id)).run();
    return getSite(existing.id)!;
  }
  const id = `site_${nanoid(10)}`;
  db.insert(sites).values({ id, researchId, title, html, bytes, publishedAt: now, updatedAt: now }).run();
  return getSite(id)!;
}
