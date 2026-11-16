/**
 * routes/tools.ts — the Tools page backend.
 *
 *   GET    /api/tools                → the REAL built-in tools the agent + its
 *                                      subagents can call (accurately labelled by
 *                                      runtime: sandbox vs backend, read vs write)
 *   GET    /api/tools/mcp            → connected external MCP servers
 *   POST   /api/tools/mcp            → connect a new MCP server (probes it first)
 *   PATCH  /api/tools/mcp/:id        → enable / disable a server
 *   DELETE /api/tools/mcp/:id        → disconnect (remove) a server
 *
 *   Connected MCP tools are merged into every agent's live toolset by
 *   agent/registry.ts (buildToolSet → mcpTools), so this endpoint IS the pipeline
 *   the research agent + subagents pull external tools from.
 */
import type { Hono } from "hono";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";
import { mcpServers } from "../models/schema.ts";
import { ALL_SKILLS } from "../agent/registry.ts";
import { execEnabled } from "../agent/skills/exec.ts";
import { probeMcpServer, serverSlug } from "../agent/mcp.ts";
import { log } from "../libs/logger.ts";

// Which built-in tools run inside the Docker sandbox vs the backend process,
// and which can WRITE (mutate the workspace / library / DB) vs only read.
const SANDBOX_SLUGS = new Set(["bash", "run_python"]);
const WRITE_SLUGS = new Set([
  "import_papers", "add_finding", "write_doc", "append_doc", "write_file", "edit_file", "bash", "run_python",
]);

interface BuiltinTool {
  id: string;
  description: string;
  runtime: "sandbox" | "backend";
  access: "read" | "write";
  category: string;
}

function builtinTools(): BuiltinTool[] {
  const fromSkills: BuiltinTool[] = ALL_SKILLS.map((s) => ({
    id: s.slug,
    description: s.description,
    runtime: SANDBOX_SLUGS.has(s.slug) ? "sandbox" : "backend",
    access: WRITE_SLUGS.has(s.slug) ? "write" : "read",
    category: s.category,
  }));
  // The meta-tools the registry adds on top of the skills.
  fromSkills.push(
    { id: "skill", description: "Load a skill pack on demand (progressive disclosure over the skill library).", runtime: "backend", access: "read", category: "meta" },
    { id: "task", description: "Spawn a subagent (literature-review / critique / reviewer) for a scoped job. Primary agent only.", runtime: "backend", access: "read", category: "meta" },
  );
  return fromSkills.sort((a, b) => a.id.localeCompare(b.id));
}

function serializeServer(r: typeof mcpServers.$inferSelect) {
  let tools: { name: string; description: string }[] = [];
  try {
    tools = JSON.parse(r.tools);
  } catch {
    /* ignore */
  }
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    transport: r.transport,
    slug: serverSlug(r.name),
    enabled: !!r.enabled,
    status: r.status,
    toolCount: r.toolCount,
    tools,
    lastError: r.lastError,
    createdAt: r.createdAt,
  };
}

export function registerToolRoutes(app: Hono): void {
  // The real built-in tools (this is what the agent actually holds).
  app.get("/api/tools", (c) => {
    return c.json({ tools: builtinTools(), execEnabled });
  });

  app.get("/api/tools/mcp", (c) => {
    const rows = db.select().from(mcpServers).all().map(serializeServer);
    return c.json({ servers: rows });
  });

  // Connect a new MCP server: probe it first so we only persist reachable ones.
  app.post("/api/tools/mcp", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      url?: string;
      transport?: string;
      headers?: Record<string, string> | string;
    };
    const name = (body.name || "").trim();
    const url = (body.url || "").trim();
    if (!name || !url) return c.json({ error: "name and url are required" }, 400);
    const transport = body.transport === "sse" ? "sse" : "http";
    let headers: Record<string, string> = {};
    if (typeof body.headers === "string") {
      try {
        headers = body.headers.trim() ? JSON.parse(body.headers) : {};
      } catch {
        return c.json({ error: "headers must be valid JSON" }, 400);
      }
    } else if (body.headers && typeof body.headers === "object") {
      headers = body.headers;
    }

    const probe = await probeMcpServer({ name, url, transport, headers });
    if (!probe.ok) {
      return c.json({ error: `couldn't connect: ${probe.error}` }, 400);
    }

    const row = {
      id: `mcp_${nanoid(10)}`,
      name,
      url,
      transport,
      headers: JSON.stringify(headers),
      enabled: 1,
      status: "connected",
      toolCount: probe.toolCount,
      tools: JSON.stringify(probe.tools),
      lastError: "",
    };
    db.insert(mcpServers).values(row).run();
    log.info(`MCP server connected: ${name} (${probe.toolCount} tools)`);
    const saved = db.select().from(mcpServers).where(eq(mcpServers.id, row.id)).get()!;
    return c.json({ server: serializeServer(saved) });
  });

  app.patch("/api/tools/mcp/:id", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    if (typeof body.enabled === "boolean") {
      db.update(mcpServers).set({ enabled: body.enabled ? 1 : 0 }).where(eq(mcpServers.id, id)).run();
    }
    const row = db.select().from(mcpServers).where(eq(mcpServers.id, id)).get();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ server: serializeServer(row) });
  });

  app.delete("/api/tools/mcp/:id", (c) => {
    const id = c.req.param("id");
    db.delete(mcpServers).where(eq(mcpServers.id, id)).run();
    return c.json({ ok: true });
  });
}
