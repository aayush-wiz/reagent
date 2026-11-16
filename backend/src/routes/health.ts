/**
 * routes/health.ts — liveness probe.
 */
import type { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";

export function registerHealthRoute(app: Hono): void {
  app.get("/api/health", (c) => {
    let dbOk = true;
    try {
      db.run(sql`select 1`);
    } catch {
      dbOk = false;
    }
    return c.json({ ok: dbOk, service: "reagent-api", env: process.env.NODE_ENV || "development" }, dbOk ? 200 : 503);
  });
}
