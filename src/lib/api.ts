// Thin client for the Reagent Hono backend. In dev, Vite proxies /api → :8181.

export interface ApiResearch {
  id: string;
  title: string;
  meta: string;
  status: string;
  icon: string;
  color: string;
  updatedLabel: string;
  createdAt: number;
}

export interface ApiPaper {
  id: string;
  researchId: string;
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  tag: string;
  status: "read" | "reading" | "unread";
  selected: boolean;
  researchTitle?: string | null;
  inResearches?: number; // # of researches holding this paper; >1 ⇒ shared/public
}

export interface ApiMessage {
  id: string;
  role: "user" | "ai";
  name: string;
  text: string;
  cites: string[];
  createdAt: number;
}

export interface ApiFinding {
  id: string;
  kind: "ok" | "warn";
  text: string;
}

export interface ApiOutput {
  id: string;
  type: "chart" | "table" | "file" | "log";
  name: string;
  meta: string;
  data: Record<string, unknown>;
}

export interface ApiSession {
  id: string;
  researchId: string;
  title: string;
  agent: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiDocMeta {
  name: string;
  title: string;
  hint: string;
  exists: boolean;
  updatedAt: number | null;
  chars: number;
}

export interface ApiDocument {
  id: string;
  researchId: string;
  name: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  research: ApiResearch;
  papers: ApiPaper[];
  messages: ApiMessage[];
  findings: ApiFinding[];
  outputs: ApiOutput[];
  sessions: ApiSession[];
  documents: ApiDocMeta[];
}

/** A user-owned article as shown in the "My Articles" list. */
export interface ArticleMeta {
  id: string;
  title: string;
  subtitle: string;
  status: "draft" | "public";
  researchId: string | null;
  createdAt: number;
  publishedAt: number | null;
  url: string;
}

/** A published article as shown on the public gallery (`/articles`). */
export interface PublicArticleCard {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  publishedAt: number | null;
  cover: string; // image URL — first workspace figure, else a generated cover
  url: string;
}

/** A full article (body included) — public view or owner preview. */
export interface ArticleFull {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  contentMd: string;
  status?: "draft" | "public";
  researchId?: string | null;
  publishedAt: number | null;
  url: string;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  listResearches: () => fetch("/api/researches").then(j<{ researches: ApiResearch[] }>),
  createResearch: (title: string, meta?: string) =>
    fetch("/api/researches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, meta }),
    }).then(j<{ research: ApiResearch }>),
  getWorkspace: (id: string) => fetch(`/api/researches/${encodeURIComponent(id)}`).then(j<Workspace>),
  sendMessage: (id: string, text: string) =>
    fetch(`/api/researches/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(j<{ messages: ApiMessage[] }>),
  togglePaper: (paperId: string) =>
    fetch(`/api/papers/${encodeURIComponent(paperId)}/toggle`, { method: "PATCH" }).then(j<{ paper: ApiPaper }>),
  searchPapers: (q: string) =>
    fetch(`/api/papers/search?q=${encodeURIComponent(q)}`).then(j<{ query: string; count: number; results: PaperSearchResult[] }>),
  importPapers: (researchId: string, results: PaperSearchResult[]) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/papers/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ papers: results }),
    }).then(j<{ imported: number }>),
  listPapers: () => fetch("/api/papers").then(j<{ papers: ApiPaper[] }>),
  listSessions: (researchId: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/sessions`).then(j<{ sessions: ApiSession[] }>),
  // The published web page for a research (null if it hasn't been published).
  researchSite: (researchId: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/site`).then(
      j<{ site: { id: string; url: string; title: string; bytes: number; publishedAt: number; updatedAt: number } | null }>,
    ),
  // ---- Articles (user-owned, shareable write-ups) ----
  listArticles: () => fetch("/api/articles").then(j<{ articles: ArticleMeta[] }>),
  // The public gallery — every published article across all users.
  listPublicArticles: () => fetch("/api/public/articles").then(j<{ articles: PublicArticleCard[] }>),
  getOwnArticle: (id: string) => fetch(`/api/articles/${encodeURIComponent(id)}`).then(j<{ article: ArticleFull }>),
  getPublicArticle: (id: string) => fetch(`/api/public/articles/${encodeURIComponent(id)}`).then(j<{ article: ArticleFull }>),
  publishArticle: (id: string) =>
    fetch(`/api/articles/${encodeURIComponent(id)}/publish`, { method: "POST" }).then(j<{ ok: boolean; status: string; url: string }>),
  unpublishArticle: (id: string) =>
    fetch(`/api/articles/${encodeURIComponent(id)}/unpublish`, { method: "POST" }).then(j<{ ok: boolean; status: string }>),
  deleteArticle: (id: string) =>
    fetch(`/api/articles/${encodeURIComponent(id)}`, { method: "DELETE" }).then(j<{ ok: boolean }>),
  createSession: (researchId: string, title?: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    }).then(j<{ session: ApiSession }>),
  sessionMessages: (sessionId: string) =>
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`).then(j<{ messages: ApiMessage[] }>),
  sessionUsage: (sessionId: string, model?: string) =>
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/usage${model ? `?model=${encodeURIComponent(model)}` : ""}`).then(
      j<{ tokens: number; limit: number; real?: boolean }>,
    ),
  // Resolve a chat session → its research (chat home opens /chat/:sessionId).
  getSession: (sessionId: string) =>
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}`).then(
      j<{ session: ApiSession & { researchId: string }; research: ApiResearch | null }>
    ),
  // Chat home: start a chat (creates/attaches a research + a session).
  chatStart: (body: { prompt: string; researchId?: string | null; model?: string }) =>
    fetch("/api/chat/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
      j<{ researchId: string; researchTitle: string; sessionId: string }>
    ),
  chatRecent: () =>
    fetch("/api/chat/recent").then(
      j<{ sessions: { id: string; title: string; updatedAt: number; researchId: string; researchTitle: string | null }[] }>
    ),
  touchSession: (sessionId: string) =>
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/touch`, { method: "POST" }).then(j<{ ok: boolean }>),
  listDocuments: (researchId: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/documents`).then(j<{ documents: ApiDocMeta[] }>),
  getDocument: (researchId: string, name: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/documents/${encodeURIComponent(name)}`).then(
      j<{ document: ApiDocument }>,
    ),
  agentSkills: () =>
    fetch("/api/agent/skills").then(
      j<{ configured: boolean; skills: { slug: string; category: string; description: string }[]; mcp: { name: string; url: string }[] }>
    ),
  catalogSkills: () => fetch("/api/catalog/skills").then(j<{ count: number; skills: CatalogSkill[] }>),
  catalogDatabases: () => fetch("/api/catalog/databases").then(j<{ count: number; databases: CatalogSkill[] }>),
  // ---- async runs / tasks ----
  createTask: (body: { prompt: string; researchId?: string | null; sessionId?: string | null; kind?: "task" | "chat"; model?: string; agent?: string; messages?: unknown[]; selectedPaperIds?: string[] }) =>
    fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(j<{ task: TaskInfo }>),
  listTasks: () => fetch("/api/tasks").then(j<{ tasks: TaskInfo[] }>),
  getTask: (id: string) => fetch(`/api/tasks/${encodeURIComponent(id)}`).then(j<{ task: TaskInfo; events: { seq: number; part: Record<string, unknown> }[] }>),
  cancelTask: (id: string) => fetch(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then(j<{ ok: boolean }>),
  answerAsk: (id: string, toolCallId: string, answers: { question: string; answer: string }[]) =>
    fetch(`/api/tasks/${encodeURIComponent(id)}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolCallId, answers }),
    }).then(j<{ ok: boolean }>),
  taskArtifacts: (id: string) => fetch(`/api/tasks/${encodeURIComponent(id)}/artifacts`).then(j<TaskArtifacts>),
  activeRun: (sessionId: string) => fetch(`/api/sessions/${encodeURIComponent(sessionId)}/active-run`).then(j<{ run: TaskInfo | null }>),
  activeRunForResearch: (researchId: string) => fetch(`/api/researches/${encodeURIComponent(researchId)}/active-run`).then(j<{ run: TaskInfo | null }>),

  // Reports & Results across ALL researches (docs + files, with source research).
  listResults: () => fetch("/api/results").then(j<{ documents: ResultDoc[]; files: ResultFile[] }>),

  // Findings across ALL researches (with the research each came from).
  listFindings: () => fetch("/api/findings").then(j<{ findings: GlobalFinding[] }>),
  // Tools page — the REAL built-in agent tools + connected external MCP servers.
  listTools: () => fetch("/api/tools").then(j<{ tools: BuiltinTool[]; execEnabled: boolean }>),
  listMcp: () => fetch("/api/tools/mcp").then(j<{ servers: McpServerInfo[] }>),
  connectMcp: (body: { name: string; url: string; transport: "http" | "sse"; headers?: string }) =>
    fetch("/api/tools/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<{ server: McpServerInfo }>),
  setMcpEnabled: (id: string, enabled: boolean) =>
    fetch(`/api/tools/mcp/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).then(j<{ server: McpServerInfo }>),
  disconnectMcp: (id: string) =>
    fetch(`/api/tools/mcp/${encodeURIComponent(id)}`, { method: "DELETE" }).then(j<{ ok: boolean }>),
  skillDoc: (name: string) => fetch(`/api/catalog/skills/${encodeURIComponent(name)}`).then(j<{ skill: CatalogSkill; markdown: string }>),
  dbSample: (name: string) =>
    fetch(`/api/catalog/databases/${encodeURIComponent(name)}/sample`).then(j<DbSample>),
  listFiles: (researchId: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/files`).then(j<{ files: WorkspaceFile[] }>),
  readFile: (researchId: string, path: string) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/file?path=${encodeURIComponent(path)}`).then(
      j<{ file: { path: string; kind: "text" | "image"; content: string; mime: string } }>,
    ),
  /** Raw binary URL for a workspace file (PDF reports, archives) — fetch it authenticated, then save/preview. */
  fileRawUrl: (researchId: string, path: string) =>
    `/api/researches/${encodeURIComponent(researchId)}/file/raw?path=${encodeURIComponent(path)}`,
  listPublicPapers: () => fetch("/api/library/public").then(j<{ papers: PublicPaper[] }>),
  addToLibrary: (researchId: string, keys: string[]) =>
    fetch(`/api/researches/${encodeURIComponent(researchId)}/library/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys }),
    }).then(j<{ added: number; papers: ApiPaper[] }>),
  getPaperContent: (id: string) =>
    fetch(`/api/papers/${encodeURIComponent(id)}/content`).then(
      j<{ paper: { id: string; title: string; byline: string; venue: string; year: string; doi?: string; pdfUrl?: string }; markdown: string; html: string | null; source: string }>
    ),
  /** Same-origin proxied URL for the paper's PDF (for the in-app PDF viewer). */
  paperPdfUrl: (id: string) => `/api/papers/${encodeURIComponent(id)}/pdf`,
};

export interface CatalogSkill {
  name: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
}

export interface DbCollection {
  name: string;
  description: string;
  kind: "table" | "file";
}

export interface DbSample {
  description?: string;
  collections?: DbCollection[];
  previewOf?: string;
  columns: string[];
  rows: string[][];
  note?: string;
  source?: string;
  fields?: { name: string; example: string; type: string }[];
  recordId?: string;
  recordCount?: number;
}

export interface TaskInfo {
  id: string;
  researchId: string | null;
  sessionId: string | null;
  kind: "task" | "chat";
  title: string;
  prompt: string;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  result: string;
  error: string;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface ResultDoc {
  researchId: string;
  researchTitle: string;
  name: string;
  title: string;
  chars: number;
  updatedAt: number;
}
export interface ResultFile {
  researchId: string;
  researchTitle: string;
  path: string;
  category: "chart" | "table" | "file";
  ext: string;
  size: number;
  updatedAt: number;
}

export interface TaskArtifacts {
  researchId: string | null;
  findings: { id: string; kind: "ok" | "warn"; text: string }[];
  documents: { name: string; title: string; content: string }[];
  files: WorkspaceFile[];
}

export interface GlobalFinding {
  id: string;
  kind: "ok" | "warn";
  text: string;
  createdAt: number;
  researchId: string | null;
  researchTitle: string | null;
  researchIcon: string | null;
  researchColor: string | null;
}

export interface BuiltinTool {
  id: string;
  description: string;
  runtime: "sandbox" | "backend";
  access: "read" | "write";
  category: string;
}

export interface McpServerInfo {
  id: string;
  name: string;
  url: string;
  transport: "http" | "sse";
  slug: string;
  enabled: boolean;
  status: string;
  toolCount: number;
  tools: { name: string; description: string }[];
  lastError: string;
  createdAt: number;
}

export interface WorkspaceFile {
  path: string;
  size: number;
  ext: string;
  category: "chart" | "table" | "file";
  updatedAt: number;
}

export interface PublicPaper {
  key: string;
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  tag: string;
  doi: string | null;
  abstract: string | null;
  pdfUrl: string | null;
  inResearches: number;
}

export interface PaperSearchResult {
  id: string;
  title: string;
  authors: string[];
  year: string;
  venue: string;
  citations: number;
  abstract?: string;
  doi?: string;
  pdfUrl?: string;
  openAccess: boolean;
  sources: string[];
}
