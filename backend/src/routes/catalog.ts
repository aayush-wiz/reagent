/**
 * routes/catalog.ts — serves the openscience catalog live to the frontend.
 *
 *   GET /api/catalog/skills        → all 292 skills (grouped by category)
 *   GET /api/catalog/skills/:name  → a single skill's full SKILL.md
 *   GET /api/catalog/databases     → the database skills (Data section)
 *
 *   (The Tools page moved to routes/tools.ts — it now shows the REAL built-in
 *   agent tools + connected MCP servers, not a static vendor catalog.)
 */
import type { Hono } from "hono";
import { loadSkills, readSkillDoc } from "../skills/loader.ts";
import { sampleDatabase } from "../skills/db-samples.ts";

export function registerCatalogRoutes(app: Hono): void {
  app.get("/api/catalog/skills", (c) => {
    const skills = loadSkills();
    return c.json({ count: skills.length, skills });
  });

  app.get("/api/catalog/skills/:name", (c) => {
    const doc = readSkillDoc(c.req.param("name"));
    if (!doc) return c.json({ error: "not found" }, 404);
    return c.json(doc);
  });

  app.get("/api/catalog/databases", (c) => {
    const dbs = loadSkills().filter((s) => s.category === "databases");
    return c.json({ count: dbs.length, databases: dbs });
  });

  app.get("/api/catalog/databases/:name/sample", async (c) => {
    return c.json(await sampleDatabase(c.req.param("name")));
  });
}
