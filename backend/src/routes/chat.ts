/**
 * routes/chat.ts — the "Chat" home surface.
 *
 * A chat is NOT a new entity: it is a normal session that belongs to a research
 * (the same schema as the research chat sessions). This route just gives the
 * chat home a way to start one without the user first opening a research:
 *
 *   POST /api/chat/start   { prompt, researchId? }
 *      → if researchId given, open a new session inside it.
 *      → else create a research with an AI-generated name, then a session.
 *      → returns { researchId, researchTitle, sessionId }
 *
 *   GET  /api/chat/recent  → recent sessions across all researches (Recent list)
 */
import type { Hono } from "hono";
import { generateText } from "ai";
import { getModel } from "../libs/llm.ts";
import { createResearch, getResearch } from "../services/researches.ts";
import { createSession, recentSessions } from "../services/sessions.ts";

/** Ask the model for a short research title; fall back to a trimmed prompt. */
async function generateResearchTitle(prompt: string, model?: string): Promise<string> {
  const fallback = prompt.trim().replace(/\s+/g, " ").slice(0, 60) || "New research";
  try {
    const { text } = await generateText({
      model: getModel(model),
      prompt:
        `Generate a concise research project title (3–6 words, Title Case, no quotes, no trailing punctuation) ` +
        `for a project started from this request:\n\n"${prompt.trim().slice(0, 500)}"\n\nTitle:`,
    });
    const clean = text.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").slice(0, 80);
    return clean || fallback;
  } catch {
    return fallback;
  }
}

export function registerChatRoutes(app: Hono): void {
  app.post("/api/chat/start", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      prompt?: string;
      researchId?: string | null;
      model?: string;
    };
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return c.json({ error: "prompt required" }, 400);

    const userId = c.get("userId");
    let research = body.researchId ? getResearch(body.researchId) : undefined;
    // Only reuse a research the caller owns; otherwise start a fresh one.
    if (research && research.userId !== userId) research = undefined;
    if (!research) {
      const title = await generateResearchTitle(prompt, body.model);
      research = createResearch({ title, userId });
    }

    const session = createSession(research.id, { title: prompt.slice(0, 60) });
    return c.json({ researchId: research.id, researchTitle: research.title, sessionId: session.id }, 201);
  });

  app.get("/api/chat/recent", (c) => {
    return c.json({ sessions: recentSessions(30, c.get("userId")) });
  });
}
