/**
 * routes/sites.ts — published research web pages.
 *
 *   GET /sites/:id                    → the published page itself (PUBLIC, no auth
 *                                        — a shareable link, like an Artifact URL).
 *   GET /api/researches/:id/site      → does this research have a published site?
 *                                        (authed; drives the Reports "Open website"
 *                                        button). Ownership enforced by the
 *                                        /api/researches/:id/* guard in server.ts.
 */
import type { Hono } from "hono";
import { getSite, getSiteByResearch } from "../services/sites.ts";

const PUBLIC_URL = (process.env.REAGENT_PUBLIC_URL || "http://localhost:8181").replace(/\/$/, "");

export function registerSiteRoutes(app: Hono): void {
  app.get("/sites/:id", (c) => {
    const site = getSite(c.req.param("id"));
    if (!site) return c.text("This research page was not found or is no longer published.", 404);
    return c.html(site.html);
  });

  app.get("/api/researches/:id/site", (c) => {
    const site = getSiteByResearch(c.req.param("id"));
    if (!site) return c.json({ site: null });
    return c.json({
      site: {
        id: site.id,
        url: `${PUBLIC_URL}/sites/${site.id}`,
        title: site.title,
        bytes: site.bytes,
        publishedAt: site.publishedAt,
        updatedAt: site.updatedAt,
      },
    });
  });
}
