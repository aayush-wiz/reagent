/**
 * routes/tasks.ts — async run (task) API. Both flows enqueue here:
 *   • New-task composer  → kind='task'  (watched in the Tasks tab)
 *   • Live chat send      → kind='chat'  (watched in the research chat)
 * The run executes in the worker; clients watch it over the WebSocket relay.
 *
 *   POST /api/tasks                     → create + enqueue a run, returns {task}
 *   GET  /api/tasks                     → list tasks (Tasks tab)
 *   GET  /api/tasks/:id                 → one task + its persisted events (replay)
 *   GET  /api/tasks/:id/events?since=N  → events after seq N
 *   POST /api/tasks/:id/cancel          → ask the worker to abort it
 *   GET  /api/sessions/:id/active-run   → the chat session's live run, for reattach
 */
import type { Hono } from "hono";
import type { ModelMessage } from "ai";
import { llmConfigured } from "../libs/llm.ts";
import {
  createTask,
  TaskQuotaError,
  getTask,
  listTasks,
  eventsSince,
  activeRunForSession,
  activeChatRunForResearch,
} from "../services/tasks.ts";
import { getResearch, getPapersByIds } from "../services/researches.ts";
import { ensureSession, getSession, sessionModelMessages } from "../services/sessions.ts";
import { resolveTaskArtifacts } from "../services/task-artifacts.ts";
import { requestCancel, publishAnswer } from "../queue/redis.ts";
import { deliverAnswer } from "../agent/ask-registry.ts";

function serialize(t: NonNullable<ReturnType<typeof getTask>>) {
  return {
    id: t.id,
    researchId: t.researchId,
    sessionId: t.sessionId,
    kind: t.kind,
    title: t.title,
    prompt: t.prompt,
    status: t.status,
    result: t.result,
    error: t.error,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
  };
}

export function registerTaskRoutes(app: Hono): void {
  app.post("/api/tasks", async (c) => {
    if (!llmConfigured()) return c.json({ error: "LLM not configured — set OPENROUTER_API_KEY in .env." }, 503);
    const body = (await c.req.json().catch(() => ({}))) as {
      prompt?: string;
      researchId?: string;
      sessionId?: string;
      kind?: "task" | "chat";
      model?: string;
      agent?: string;
      messages?: ModelMessage[];
      selectedPaperIds?: string[];
    };
    const prompt = (body.prompt ?? "").trim();
    if (!prompt && !body.messages?.length) return c.json({ error: "prompt required" }, 400);

    const research = body.researchId ? getResearch(body.researchId) : undefined;
    if (body.researchId && (!research || research.userId !== c.get("userId"))) return c.json({ error: "research not found" }, 404);

    // Resolve a session for chat runs so the answer can be persisted to the thread.
    let sessionId = body.sessionId && getSession(body.sessionId) ? body.sessionId : undefined;
    if (!sessionId && research && body.kind === "chat") sessionId = ensureSession(research.id).id;

    // For a chat follow-up, replay the FULL session history from the DB (every
    // user turn + each AI turn's tool calls AND results) so the agent knows
    // everything it did before — not the frontend's text-only summary.
    let messages = body.messages;
    if ((body.kind ?? "task") === "chat" && sessionId) {
      messages = [...sessionModelMessages(sessionId), { role: "user", content: prompt }];
    }

    const contextPapers = (body.selectedPaperIds?.length ? getPapersByIds(body.selectedPaperIds) : []).map((p) => ({
      title: p.title,
      byline: p.byline,
      year: p.year,
      venue: p.venue,
      doi: p.doi,
      abstract: p.abstract,
    }));

    let task;
    try {
      task = await createTask({
        prompt,
        userId: c.get("userId"),
        researchId: research?.id ?? null,
        sessionId: sessionId ?? null,
        kind: body.kind ?? "task",
        model: body.model,
        agent: body.agent,
        messages,
        contextPapers,
      });
    } catch (e) {
      if (e instanceof TaskQuotaError) return c.json({ error: e.message }, 429);
      throw e;
    }
    return c.json({ task: serialize(task) }, 201);
  });

  app.get("/api/tasks", (c) => {
    return c.json({ tasks: listTasks({ userId: c.get("userId") }).map(serialize) });
  });

  app.get("/api/tasks/:id", (c) => {
    const t = getTask(c.req.param("id"));
    if (!t) return c.json({ error: "not found" }, 404);
    const events = eventsSince(t.id, 0).map((e) => ({ seq: e.seq, part: JSON.parse(e.part) }));
    return c.json({ task: serialize(t), events });
  });

  app.get("/api/tasks/:id/events", (c) => {
    const t = getTask(c.req.param("id"));
    if (!t) return c.json({ error: "not found" }, 404);
    const since = Number(c.req.query("since") ?? 0) || 0;
    return c.json({ events: eventsSince(t.id, since).map((e) => ({ seq: e.seq, part: JSON.parse(e.part) })) });
  });

  // Only the artifacts (findings / docs / files) THIS task produced.
  app.get("/api/tasks/:id/artifacts", async (c) => {
    const t = getTask(c.req.param("id"));
    if (!t) return c.json({ error: "not found" }, 404);
    return c.json(await resolveTaskArtifacts(t.id));
  });

  app.post("/api/tasks/:id/cancel", (c) => {
    const t = getTask(c.req.param("id"));
    if (!t) return c.json({ error: "not found" }, 404);
    requestCancel(t.id);
    return c.json({ ok: true });
  });

  // Deliver the user's answer to an `ask_user` question the agent is parked on.
  // The run is executing in the worker, so publish over Redis; also try in-process
  // in case an interactive (same-process) run is the one waiting.
  app.post("/api/tasks/:id/answer", async (c) => {
    const t = getTask(c.req.param("id"));
    if (!t) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as {
      toolCallId?: string;
      answers?: { question: string; answer: string }[];
      answer?: string;
    };
    if (!body.toolCallId) return c.json({ error: "toolCallId required" }, 400);
    const answer =
      body.answer ??
      (body.answers ?? [])
        .map((a) => `**${a.question}**\n${a.answer || "(no answer)"}`)
        .join("\n\n") ??
      "";
    deliverAnswer(t.id, body.toolCallId, answer);
    publishAnswer(t.id, body.toolCallId, answer);
    return c.json({ ok: true });
  });

  app.get("/api/sessions/:id/active-run", (c) => {
    const run = activeRunForSession(c.req.param("id"));
    return c.json({ run: run ? serialize(run) : null });
  });

  app.get("/api/researches/:id/active-run", (c) => {
    const run = activeChatRunForResearch(c.req.param("id"));
    return c.json({ run: run ? serialize(run) : null });
  });
}
