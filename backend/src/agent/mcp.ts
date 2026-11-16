/**
 * backend/src/agent/mcp.ts — external MCP server loader + connection pipeline.
 *
 *   Users connect MCP servers from the Tools page (persisted in the `mcp_servers`
 *   table) or via REAGENT_MCP_SERVERS in .env. Every ENABLED server's tools are
 *   merged into the live toolset of the primary research agent AND its subagents
 *   at runtime (agent/registry.ts → buildToolSet), so once a server is connected
 *   the whole agent graph can call it — no restart, no prompt injection.
 *
 *   Transports: 'http' (Streamable HTTP, the modern default) and 'sse' (legacy).
 *   Optional per-server `headers` carry auth (e.g. {"Authorization":"Bearer …"}).
 *
 *   .env fallback:
 *     REAGENT_MCP_SERVERS=[{"name":"my-server","url":"http://localhost:9000/mcp","transport":"http"}]
 */
import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { eq } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";
import { mcpServers } from "../models/schema.ts";
import { log } from "../libs/logger.ts";

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: "http" | "sse";
  headers: Record<string, string>;
}

export interface McpToolInfo {
  name: string;
  description: string;
}

/** How long to wait for a server to hand over its tool list before giving up.
 *  A dead/slow MCP server must never stall an agent turn. */
const CONNECT_TIMEOUT_MS = 12_000;

/** A tool-name-safe slug for a server, used to namespace its tools. */
function serverSlug(name: string): string {
  return (name || "mcp").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "mcp";
}

function normalizeTransport(t: unknown): "http" | "sse" {
  return t === "sse" ? "sse" : "http";
}

function parseHeaders(raw: unknown): Record<string, string> {
  if (!raw) return {};
  try {
    const h = typeof raw === "string" ? JSON.parse(raw) : raw;
    return h && typeof h === "object" ? (h as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Enabled MCP servers from the DB, plus any declared in REAGENT_MCP_SERVERS. */
export function mcpCatalog(): McpServer[] {
  const rows = db.select().from(mcpServers).where(eq(mcpServers.enabled, 1)).all();
  const fromDb: McpServer[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    transport: normalizeTransport(r.transport),
    headers: parseHeaders(r.headers),
  }));

  const fromEnv: McpServer[] = (() => {
    try {
      const raw = JSON.parse(process.env.REAGENT_MCP_SERVERS || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((s) => s?.url)
        .map((s, i) => ({
          id: `env_${i}`,
          name: s.name || `env-${i}`,
          url: s.url,
          transport: normalizeTransport(s.transport),
          headers: parseHeaders(s.headers),
        }));
    } catch {
      log.warn("REAGENT_MCP_SERVERS is not valid JSON — ignoring");
      return [];
    }
  })();

  // De-dupe by url (a DB row wins over an identical env entry).
  const seen = new Set(fromDb.map((s) => s.url));
  return [...fromDb, ...fromEnv.filter((s) => !seen.has(s.url))];
}

/** Open a client to one server (with a hard connect timeout). Caller closes it. */
async function openClient(s: McpServer) {
  const connect = createMCPClient({
    transport: { type: s.transport, url: s.url, headers: s.headers },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`connect timed out after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS),
  );
  return (await Promise.race([connect, timeout])) as Awaited<typeof connect>;
}

/**
 * Probe a server WITHOUT persisting it — used by the connect route to validate a
 * URL and report the tools it exposes before we save the row.
 */
export async function probeMcpServer(
  s: Omit<McpServer, "id">,
): Promise<{ ok: boolean; toolCount: number; tools: McpToolInfo[]; error?: string }> {
  let client: Awaited<ReturnType<typeof openClient>> | null = null;
  try {
    client = await openClient({ ...s, id: "probe" });
    const tools = await client.tools();
    const infos: McpToolInfo[] = Object.entries(tools).map(([name, t]) => ({
      name,
      description: String((t as { description?: string }).description || "").slice(0, 200),
    }));
    return { ok: true, toolCount: infos.length, tools: infos };
  } catch (e) {
    return { ok: false, toolCount: 0, tools: [], error: String(e instanceof Error ? e.message : e) };
  } finally {
    await client?.close().catch(() => {});
  }
}

/**
 * Connect to every enabled server and merge their tools into one ToolSet.
 * Each server's tools are namespaced `<<slug>>__<<tool>>` so two servers can
 * expose a tool of the same name without colliding, and the model can see which
 * server a tool belongs to. One bad server is isolated — it never breaks the
 * others or the agent.
 */
export async function mcpTools(): Promise<ToolSet> {
  const servers = mcpCatalog();
  if (!servers.length) return {};
  const sets = await Promise.all(
    servers.map(async (s) => {
      try {
        const client = await openClient(s);
        const tools = await client.tools();
        const slug = serverSlug(s.name);
        const namespaced: ToolSet = {};
        for (const [name, t] of Object.entries(tools)) namespaced[`${slug}__${name}`] = t;
        log.info(`MCP "${s.name}" (${s.transport}) → ${Object.keys(tools).length} tools`);
        return namespaced;
      } catch (e) {
        log.warn(`MCP server "${s.name}" failed to load`, String(e));
        return {} as ToolSet;
      }
    }),
  );
  return Object.assign({}, ...sets);
}

export { serverSlug };
