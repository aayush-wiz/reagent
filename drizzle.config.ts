/**
 * drizzle-kit config (SQLite).
 *
 * Schema lives in backend/src/models/schema.ts. The DB shape is currently
 * bootstrapped by the CREATE TABLE IF NOT EXISTS block in
 * backend/src/repositories/db-client.ts — that stays the source of truth
 * for now. `npm run db:generate` produces migration files under drizzle/
 * so schema changes are reviewable per-PR; treat them as documentation
 * until we cut over to `db:migrate` at boot.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/src/models/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH || "./data/app.db",
  },
  casing: "snake_case",
  breakpoints: false,
});
