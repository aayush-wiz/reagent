/**
 * routes/agent.ts — the Reagent agent API.
 *
 *   GET  /api/agent/skills → the attached skills / MCP servers (Tools tab).
 *   POST /api/agent        → stream a chat turn (plain-text token stream).
 */
import type { Hono } from "hono";
import { llmConfigured } from "../libs/llm.ts";
import { runAgent } from "../agent/run.ts";
import { skillCatalog, mcpCatalog } from "../agent/registry.ts";
import { AGENTS } from "../agent/agents.ts";
import { getResearch, getPapersByIds } from "../services/researches.ts";
import { ensureSession, getSession, persistTurn } from "../services/sessions.ts";
import { ownsResearch, ownsSession } from "../services/ownership.ts";
import type { ModelMessage } from "ai";

export function registerAgentRoutes(app: Hono): void {
  app.get("/api/agent/skills", (c) =>
    c.json({ configured: llmConfigured(), skills: skillCatalog(), mcp: mcpCatalog() }),
  );

  // The agent roster: the primary agent + the subagents it can spawn.
  app.get("/api/agent/agents", (c) =>
    c.json({
      agents: Object.values(AGENTS).map((a) => ({
        name: a.name,
        mode: a.mode,
        description: a.description,
        color: a.color,
        canSpawn: a.canSpawn,
        maxSteps: a.maxSteps,
        tools: a.toolSlugs === "*" ? "all" : a.toolSlugs,
      })),
    }),
  );

  app.post("/api/agent", async (c) => {
    if (!llmConfigured()) {
      return c.json({ error: "OPENROUTER_API_KEY is not set — add it to .env to enable the agent." }, 503);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      messages?: ModelMessage[];
      researchId?: string;
      sessionId?: string;
      model?: string;
      agent?: string;
      selectedPaperIds?: string[];
    };
    const uid = c.get("userId");
    // Reject a research/session the caller doesn't own (multi-tenant isolation).
    if (body.researchId && !ownsResearch(uid, body.researchId)) return c.json({ error: "not found" }, 404);
    const research = body.researchId ? getResearch(body.researchId) : undefined;

    // The papers the user selected in the sidebar → injected as focused context.
    const contextPapers = (body.selectedPaperIds?.length ? getPapersByIds(body.selectedPaperIds) : []).map((p) => ({
      title: p.title,
      byline: p.byline,
      year: p.year,
      venue: p.venue,
      doi: p.doi,
      abstract: p.abstract,
    }));

    // Resolve the chat session so the turn can be persisted under it. If a
    // researchId is present but no session, use/create the research's session.
    let sessionId = body.sessionId && ownsSession(uid, body.sessionId) ? body.sessionId : undefined;
    if (!sessionId && research) sessionId = ensureSession(research.id).id;

    // The user's latest turn (last user message) — persisted with the reply.
    const messages = body.messages ?? [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText = typeof lastUser?.content === "string" ? lastUser.content : "";

    try {
      // Returns a UI message stream Response directly — the dynamic ReAct loop
      // (auto-continuing across step windows) is driven inside runAgent. It
      // resolves the model eagerly, so a misconfigured provider throws here.
      return runAgent({
        messages,
        researchId: research?.id,
        researchTitle: research?.title,
        model: body.model,
        agent: body.agent,
        contextPapers,
        onFinish: (finalText) => {
          if (research && sessionId && userText) {
            persistTurn({ researchId: research.id, sessionId, userText, assistantText: finalText });
          }
        },
      });
    } catch (e) {
      // e.g. the selected model's provider isn't configured (missing Databricks /
      // OpenRouter keys). Return a clean JSON error the chat can display, not a 500.
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: msg }, 400);
    }
  });
}
