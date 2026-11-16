/**
 * backend/src/repositories/db-client.ts — SQLite client + idempotent bootstrap.
 *
 *   Mirrors the scrape-leads pattern: a single better-sqlite3 handle wrapped
 *   by drizzle, with a "create-if-missing" bootstrap so a fresh DB boots
 *   without a manual migration step. Once the schema stabilises we can switch
 *   to drizzle-kit migrations (see drizzle.config.ts).
 *
 *   The DB file lives at env.DB_PATH (default ./data/app.db).
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../models/schema.ts";
import { env } from "../env.ts";
import { log } from "../libs/logger.ts";

mkdirSync(dirname(env.DB_PATH), { recursive: true });

export const sqlite = new Database(env.DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// The API and the worker are separate processes both writing this DB (WAL allows
// it). Wait up to 5s on a lock instead of throwing SQLITE_BUSY immediately.
sqlite.pragma("busy_timeout = 5000");

// An earlier prototype created `hypotheses` / `hypothesis_matches` with different
// columns (rationale/predicts/elo/parent_id — no rating/matches/log/outcome). If a
// DB still carries that stale shape AND it is empty, drop it so the current schema
// (created just below) applies. Guarded on emptiness — it NEVER drops a table that
// holds rows (those are logged for manual migration instead).
function dropIfStaleEmpty(table: string, currentColumn: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.length || cols.some((c) => c.name === currentColumn)) return; // fresh, or already current
  const n = (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  if (n > 0) {
    log.warn(`sqlite: ${table} has a stale prototype schema and ${n} row(s); leaving it — migrate manually`);
    return;
  }
  sqlite.exec(`DROP TABLE ${table};`);
  log.info(`sqlite: dropped stale empty ${table} so the current schema applies`);
}
dropIfStaleEmpty("hypotheses", "rating");
dropIfStaleEmpty("hypothesis_matches", "outcome");

// Idempotent schema bootstrap. Safe to run on every boot.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS researches (
    id            TEXT PRIMARY KEY,
    user_id       TEXT,
    title         TEXT NOT NULL,
    meta          TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'draft',
    icon          TEXT NOT NULL DEFAULT '◈',
    color         TEXT NOT NULL DEFAULT '#2b5fd1',
    updated_label TEXT NOT NULL DEFAULT 'just now',
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS papers (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    byline      TEXT NOT NULL DEFAULT '',
    year        TEXT NOT NULL DEFAULT '',
    venue       TEXT NOT NULL DEFAULT '',
    citations   INTEGER NOT NULL DEFAULT 0,
    tag         TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'unread',
    selected    INTEGER NOT NULL DEFAULT 0,
    doi         TEXT,
    abstract    TEXT,
    pdf_url     TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS papers_research_idx ON papers(research_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New session',
    agent       TEXT NOT NULL DEFAULT 'research',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS sessions_research_idx ON sessions(research_id);

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    session_id  TEXT,
    role        TEXT NOT NULL,
    name        TEXT NOT NULL,
    text        TEXT NOT NULL,
    cites       TEXT NOT NULL DEFAULT '[]',
    parts       TEXT NOT NULL DEFAULT '[]',
    model_messages TEXT NOT NULL DEFAULT '[]',
    task_id     TEXT,
    usage       TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS messages_research_idx ON messages(research_id);

  CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS documents_research_name_idx ON documents(research_id, name);

  CREATE TABLE IF NOT EXISTS findings (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'ok',
    text        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS findings_research_idx ON findings(research_id);

  CREATE TABLE IF NOT EXISTS sites (
    id           TEXT PRIMARY KEY,
    research_id  TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT 'Research',
    html         TEXT NOT NULL DEFAULT '',
    bytes        INTEGER NOT NULL DEFAULT 0,
    published_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS sites_research_idx ON sites(research_id);

  CREATE TABLE IF NOT EXISTS articles (
    id           TEXT PRIMARY KEY,
    user_id      TEXT,
    research_id  TEXT,
    author_name  TEXT NOT NULL DEFAULT '',
    title        TEXT NOT NULL DEFAULT 'Untitled',
    subtitle     TEXT NOT NULL DEFAULT '',
    content_md   TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'draft',
    bytes        INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    published_at INTEGER,
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS articles_user_idx ON articles(user_id);

  CREATE TABLE IF NOT EXISTS outputs (
    id          TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    name        TEXT NOT NULL,
    meta        TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS outputs_research_idx ON outputs(research_id);

  CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    user_id      TEXT,
    research_id  TEXT REFERENCES researches(id) ON DELETE CASCADE,
    session_id   TEXT,
    kind         TEXT NOT NULL DEFAULT 'task',
    title        TEXT NOT NULL DEFAULT '',
    prompt       TEXT NOT NULL DEFAULT '',
    model        TEXT NOT NULL DEFAULT '',
    agent        TEXT NOT NULL DEFAULT 'research',
    status       TEXT NOT NULL DEFAULT 'queued',
    input        TEXT NOT NULL DEFAULT '{}',
    artifacts    TEXT NOT NULL DEFAULT '{}',
    result       TEXT NOT NULL DEFAULT '',
    error        TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    started_at   INTEGER,
    finished_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS tasks_research_idx ON tasks(research_id);
  CREATE INDEX IF NOT EXISTS tasks_session_idx ON tasks(session_id);

  CREATE TABLE IF NOT EXISTS task_events (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    part        TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS task_events_task_idx ON task_events(task_id);

  CREATE TABLE IF NOT EXISTS hypotheses (
    id               TEXT PRIMARY KEY,
    research_id      TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    statement        TEXT NOT NULL,
    h0               TEXT NOT NULL DEFAULT '',
    confirm_evidence TEXT NOT NULL DEFAULT '',
    refute_evidence  TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'alive',
    rating           REAL NOT NULL DEFAULT 1000,
    matches          INTEGER NOT NULL DEFAULT 0,
    parent_ids       TEXT NOT NULL DEFAULT '[]',
    log              TEXT NOT NULL DEFAULT '[]',
    created_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS hypotheses_research_idx ON hypotheses(research_id);

  CREATE TABLE IF NOT EXISTS hypothesis_matches (
    id           TEXT PRIMARY KEY,
    research_id  TEXT NOT NULL REFERENCES researches(id) ON DELETE CASCADE,
    winner_id    TEXT NOT NULL,
    loser_id     TEXT NOT NULL,
    outcome      TEXT NOT NULL DEFAULT 'win',
    rating_delta REAL NOT NULL DEFAULT 0,
    note         TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS hypothesis_matches_research_idx ON hypothesis_matches(research_id);

  CREATE TABLE IF NOT EXISTS mcp_servers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    transport   TEXT NOT NULL DEFAULT 'http',
    headers     TEXT NOT NULL DEFAULT '{}',
    enabled     INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'unknown',
    tool_count  INTEGER NOT NULL DEFAULT 0,
    tools       TEXT NOT NULL DEFAULT '[]',
    last_error  TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens(user_id);
`);

// Guarded migration: add columns to tables that predate them. `ALTER TABLE ADD
// COLUMN` throws if the column already exists, so probe pragma first (and skip
// entirely if the table doesn't exist — a fresh DB already has the column).
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.length && !cols.some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn("messages", "session_id", "session_id TEXT");
// `tasks.input` was added after the table shipped — backfill it on existing DBs.
ensureColumn("tasks", "input", "input TEXT NOT NULL DEFAULT '{}'");
ensureColumn("tasks", "artifacts", "artifacts TEXT NOT NULL DEFAULT '{}'");
// Per-user ownership: add owner columns to DBs that predate auth.
ensureColumn("researches", "user_id", "user_id TEXT");
ensureColumn("tasks", "user_id", "user_id TEXT");
// Persist the reasoning/tool timeline on chat messages so it survives reloads.
ensureColumn("messages", "parts", "parts TEXT NOT NULL DEFAULT '[]'");
ensureColumn("messages", "model_messages", "model_messages TEXT NOT NULL DEFAULT '[]'");
ensureColumn("messages", "task_id", "task_id TEXT");
ensureColumn("messages", "usage", "usage TEXT NOT NULL DEFAULT '{}'");
// Now that session_id is guaranteed to exist, its index is safe to create.
sqlite.exec(`CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id);`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS researches_user_idx ON researches(user_id);`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);`);

export const db = drizzle(sqlite, { schema });

if (!existsSync(env.DB_PATH)) {
  log.info(`Created new SQLite database at ${env.DB_PATH}`);
}
