/**
 * SQLite + Drizzle schema for Reagent.
 *
 *   The research workspace is the core object. Everything else hangs off
 *   a research: its papers (left library), chat messages (middle), and
 *   outputs (right panel — findings, charts, tables, files, run logs).
 *
 *   Timestamps are stored as **ms since epoch** in integer columns so the
 *   on-the-wire shape matches Date.now() everywhere in the app.
 *
 *   Tables: researches, sessions, papers, messages, findings, outputs, documents.
 */
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;

export const researches = sqliteTable("researches", {
  id: text("id").primaryKey(), // r_<rand>
  userId: text("user_id"), // owner (u_<rand>); null = legacy / unowned
  title: text("title").notNull(),
  meta: text("meta").notNull().default(""),
  status: text("status").notNull().default("draft"),
  icon: text("icon").notNull().default("◈"),
  color: text("color").notNull().default("#2b5fd1"),
  updatedLabel: text("updated_label").notNull().default("just now"),
  createdAt: integer("created_at").notNull().default(nowMs),
});

/**
 * A chat session inside a research. A research can hold many sessions (parallel
 * threads of investigation); messages belong to a session. Mirrors openscience,
 * where a research project contains many sessions.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // s_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New session"),
    agent: text("agent").notNull().default("research"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("sessions_research_idx").on(t.researchId) }),
);

/**
 * A per-research working document — the "major .md files" the agent maintains
 * and re-reads across stages: `plan`, `tasks`, `findings`, `literature-review`,
 * `reasoning`, `methodology`, plus any the agent creates. One row per
 * (research, name); `content` is Markdown. This is Reagent's equivalent of the
 * openscience artifact files the research agent writes as it works.
 */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(), // d_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // canonical slug, e.g. "literature-review"
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""), // Markdown
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({ researchName: uniqueIndex("documents_research_name_idx").on(t.researchId, t.name) }),
);

export const papers = sqliteTable(
  "papers",
  {
    id: text("id").primaryKey(), // p_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    byline: text("byline").notNull().default(""),
    year: text("year").notNull().default(""),
    venue: text("venue").notNull().default(""),
    citations: integer("citations").notNull().default(0),
    tag: text("tag").notNull().default(""),
    status: text("status").notNull().default("unread"), // read | reading | unread
    selected: integer("selected").notNull().default(0), // 0/1 — in chat context
    doi: text("doi"),
    abstract: text("abstract"),
    pdfUrl: text("pdf_url"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("papers_research_idx").on(t.researchId) }),
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(), // m_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    sessionId: text("session_id"), // which chat session (nullable for legacy rows)
    role: text("role").notNull(), // user | ai
    name: text("name").notNull(),
    text: text("text").notNull(),
    cites: text("cites").notNull().default("[]"), // JSON string[]
    parts: text("parts").notNull().default("[]"), // JSON: the raw UI-stream parts (reasoning/tool/text timeline)
    modelMessages: text("model_messages").notNull().default("[]"), // JSON: full ModelMessages (tool calls + results) for follow-up context
    taskId: text("task_id"), // the run that produced this turn — idempotency key (re-delivery / backfill can't duplicate a turn)
    usage: text("usage").notNull().default("{}"), // JSON: the AI turn's REAL provider usage { inputTokens, outputTokens, totalTokens, contextTokens }
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    researchIdx: index("messages_research_idx").on(t.researchId),
    sessionIdx: index("messages_session_idx").on(t.sessionId),
  }),
);

/**
 * A PUBLISHED research web page — the self-contained HTML site the agent authors
 * itself with write_file (its own HTML/CSS, no template), snapshotted here so it
 * can be served at a stable public URL (GET /sites/:id) like a Claude Artifact.
 * One row per research; re-publishing overwrites it (same URL, redeployed).
 */
export const sites = sqliteTable(
  "sites",
  {
    id: text("id").primaryKey(), // site_<rand> — the public slug in the URL
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Research"),
    html: text("html").notNull().default(""), // the self-contained page snapshot
    bytes: integer("bytes").notNull().default(0),
    publishedAt: integer("published_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: uniqueIndex("sites_research_idx").on(t.researchId) }),
);

/**
 * A user-owned, shareable article (blog-style write-up). Unlike `sites` (one per
 * research), an article belongs to the USER: `userId` is the owner, `researchId`
 * is only the source it was generated from (not unique, no cascade — the article
 * survives the research). A user can have many. `status` gates visibility: a new
 * article is a `draft` (private) until the user publishes it → `public` (live at
 * /article/:id).
 */
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(), // article_<rand> — the public slug in /article/:id
    userId: text("user_id"), // OWNER (u_<rand>) — the article belongs to the user
    researchId: text("research_id"), // the research it was generated from (source; not unique)
    authorName: text("author_name").notNull().default(""), // snapshot of the owner's display name
    title: text("title").notNull().default("Untitled"),
    subtitle: text("subtitle").notNull().default(""), // the dek / one-line summary
    contentMd: text("content_md").notNull().default(""), // article body as Markdown
    status: text("status").notNull().default("draft"), // draft (private) | public (live)
    bytes: integer("bytes").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    publishedAt: integer("published_at"), // set when first made public (nullable)
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({ userIdx: index("articles_user_idx").on(t.userId) }),
);

export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey(),
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("ok"), // ok | warn
    text: text("text").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("findings_research_idx").on(t.researchId) }),
);

/**
 * Generic right-panel asset. `type` distinguishes the Outputs tab it
 * belongs to; `data` is a type-specific JSON payload (forest rows, table
 * rows/cols, file content, log lines…).
 */
export const outputs = sqliteTable(
  "outputs",
  {
    id: text("id").primaryKey(),
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // chart | table | file | log
    name: text("name").notNull(),
    meta: text("meta").notNull().default(""),
    data: text("data").notNull().default("{}"), // JSON payload
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("outputs_research_idx").on(t.researchId) }),
);

/**
 * An async agent RUN (a "task"). Created by the New-task composer (kind='task')
 * or a live chat turn (kind='chat'). Execution is owned by the worker process
 * (BullMQ), so a run keeps going regardless of any browser connection. `result`
 * holds the agent's final answer; `status` tracks its lifecycle. See ASYNC_TASKS.md.
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(), // t_<rand>  (also the BullMQ job id + pub/sub channel key)
    userId: text("user_id"), // owner (u_<rand>); the worker recovers the owner from this
    researchId: text("research_id").references(() => researches.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    kind: text("kind").notNull().default("task"), // task | chat
    title: text("title").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    model: text("model").notNull().default(""),
    agent: text("agent").notNull().default("research"),
    status: text("status").notNull().default("queued"), // queued | running | done | failed | canceled
    input: text("input").notNull().default("{}"), // JSON: { messages, contextPapers } the worker runs
    artifacts: text("artifacts").notNull().default("{}"), // JSON: { findings[], docs[], files[] } THIS run produced
    result: text("result").notNull().default(""),
    error: text("error").notNull().default(""),
    createdAt: integer("created_at").notNull().default(nowMs),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
  },
  (t) => ({ researchIdx: index("tasks_research_idx").on(t.researchId), sessionIdx: index("tasks_session_idx").on(t.sessionId) }),
);

/**
 * Append-only stream of a run's UI-message parts (reasoning, tool calls, text).
 * The worker persists every event here as it publishes it to Redis pub/sub, so a
 * client that (re)connects can replay everything since its last `seq` losslessly.
 */
export const taskEvents = sqliteTable(
  "task_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(), // monotonic per task
    part: text("part").notNull().default("{}"), // JSON: a UI message stream part
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({ taskIdx: index("task_events_task_idx").on(t.taskId) }),
);

/**
 * An external MCP server the user has connected. Its tools are merged into the
 * live toolset of the research agent AND its subagents at runtime (see
 * agent/mcp.ts → agent/registry.ts). Connecting persists the row here so the
 * connection survives restarts; `headers` holds optional auth (JSON string).
 * `status`/`toolCount`/`lastError` are refreshed on the last probe.
 */
/**
 * A competing hypothesis on a research's board — the unit of the iterative
 * Strong-Inference research loop (see RESEARCH_LOOP.md). The agent keeps several
 * of these ALIVE at once and makes them compete in a `rank` tournament instead of
 * committing to one early. `rating` is a live Elo score updated by `record_match`;
 * `status` tracks whether evidence has killed, supported, or evolved it. This
 * durable board is what lets the loop iterate across steps, context windows, and
 * chat sessions — the state does NOT live in the model's context.
 */
export const hypotheses = sqliteTable(
  "hypotheses",
  {
    id: text("id").primaryKey(), // h_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(), // the hypothesis, stated testably
    h0: text("h0").notNull().default(""), // the null hypothesis
    confirmEvidence: text("confirm_evidence").notNull().default(""), // what would confirm it
    refuteEvidence: text("refute_evidence").notNull().default(""), // the crucial test — what would refute it
    status: text("status").notNull().default("alive"), // alive | supported | refuted | evolved | merged
    rating: real("rating").notNull().default(1000), // live Elo, updated by record_match
    matches: integer("matches").notNull().default(0), // tournament matches played
    parentIds: text("parent_ids").notNull().default("[]"), // JSON string[] — evolution lineage
    log: text("log").notNull().default("[]"), // JSON: [{ts, kind, note}] — evidence/status trail
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("hypotheses_research_idx").on(t.researchId) }),
);

/**
 * One pairwise tournament outcome between two hypotheses (append-only). Written by
 * `record_match`, which also applies the Elo update to both `hypotheses` rows. Kept
 * so the tournament is auditable and a Bradley-Terry re-fit can run over the whole
 * match graph if a more accurate final leaderboard is wanted.
 */
export const hypothesisMatches = sqliteTable(
  "hypothesis_matches",
  {
    id: text("id").primaryKey(), // hm_<rand>
    researchId: text("research_id")
      .notNull()
      .references(() => researches.id, { onDelete: "cascade" }),
    winnerId: text("winner_id").notNull(),
    loserId: text("loser_id").notNull(),
    outcome: text("outcome").notNull().default("win"), // win | draw
    ratingDelta: real("rating_delta").notNull().default(0), // Elo points the winner gained
    note: text("note").notNull().default(""), // the judge's one-line rationale
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({ researchIdx: index("hypothesis_matches_research_idx").on(t.researchId) }),
);

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(), // mcp_<rand>
  name: text("name").notNull(),
  url: text("url").notNull(),
  transport: text("transport").notNull().default("http"), // 'http' (streamable) | 'sse'
  headers: text("headers").notNull().default("{}"), // JSON: auth/custom headers
  enabled: integer("enabled").notNull().default(1),
  status: text("status").notNull().default("unknown"), // connected | error | unknown
  toolCount: integer("tool_count").notNull().default(0),
  tools: text("tools").notNull().default("[]"), // JSON: [{name, description}]
  lastError: text("last_error").notNull().default(""),
  createdAt: integer("created_at").notNull().default(nowMs),
});

/**
 * An application account. This is the ROOT owner: researches (and everything that
 * cascades from them — sessions, messages, papers, findings, outputs, documents,
 * hypotheses) plus tasks are scoped to a user via `researches.userId` / `tasks.userId`.
 * Passwords are stored as a scrypt `salt:hash` (see services/auth.ts); we never keep
 * the plaintext. `email` is unique and lower-cased.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // u_<rand>
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(), // scrypt "salt:hash"
  createdAt: integer("created_at").notNull().default(nowMs),
});

/**
 * An opaque bearer token issued at login/signup. Presented as `Authorization:
 * Bearer <token>`; the auth middleware resolves it back to a user. Deleting the row
 * (logout) revokes it. Named `auth_tokens` to avoid colliding with chat `sessions`.
 */
export const authTokens = sqliteTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull().default(nowMs),
});
