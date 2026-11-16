/**
 * src/lib/agentStream.ts — a plain-fetch reader for the Vercel AI SDK
 * **UI Message Stream** (what `toUIMessageStreamResponse()` emits on the server).
 *
 *   worklone/orpex use `useChat`, which assembles `message.parts[]` for you.
 *   Reagent's chat is a manual fetch loop, so this does the same assembly by
 *   hand: it parses the SSE `data:` events and maintains an ordered `parts[]`
 *   the renderer (AgentMessage) can turn into text/reasoning/tool blocks.
 */

// A part in the shape AgentMessage.partsToBlocks expects (shared with the WS path).
export type { StreamPart } from "./partsReducer";
import type { StreamPart } from "./partsReducer";

export interface StreamHandle {
  parts: StreamPart[];
}

interface RunOpts {
  body: unknown;
  onUpdate: (parts: StreamPart[]) => void;
  signal?: AbortSignal;
}

/** POST to /api/agent and stream the UI message parts back via onUpdate. Returns the final text. */
export async function streamAgent({ body, onUpdate, signal }: RunOpts): Promise<{ text: string; error?: string }> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: `Agent error (${res.status}).` }));
    return { text: "", error: err.error || `Agent error (${res.status}).` };
  }

  type ToolPart = { type: string; toolCallId?: string; toolName?: string; state?: string; input?: unknown; output?: unknown };
  const parts: StreamPart[] = [];
  const textById = new Map<string, StreamPart>();
  const reasonById = new Map<string, StreamPart>();
  const toolById = new Map<string, ToolPart>();
  let errorText: string | undefined;

  const emit = () => onUpdate(parts.slice());

  const handle = (ev: Record<string, unknown>) => {
    const t = String(ev.type ?? "");
    switch (t) {
      case "text-start": {
        const p: StreamPart = { type: "text", text: "", _id: String(ev.id ?? "") };
        parts.push(p);
        textById.set(p._id!, p);
        break;
      }
      case "text-delta": {
        const id = String(ev.id ?? "");
        const delta = String(ev.delta ?? ev.text ?? "");
        let p = textById.get(id);
        if (!p) {
          const last = parts[parts.length - 1];
          if (last && last.type === "text") p = last as StreamPart;
          else {
            p = { type: "text", text: "", _id: id };
            parts.push(p);
          }
          textById.set(id, p);
        }
        (p as { text: string }).text += delta;
        break;
      }
      case "reasoning-start": {
        const p: StreamPart = { type: "reasoning", text: "", _id: String(ev.id ?? "") };
        parts.push(p);
        reasonById.set(p._id!, p);
        break;
      }
      case "reasoning-delta": {
        const id = String(ev.id ?? "");
        const delta = String(ev.delta ?? ev.text ?? "");
        let p = reasonById.get(id);
        if (!p) {
          p = { type: "reasoning", text: "", _id: id };
          parts.push(p);
          reasonById.set(id, p);
        }
        (p as { text: string }).text += delta;
        break;
      }
      case "tool-input-start": {
        const id = String(ev.toolCallId ?? "");
        const p: ToolPart = { type: "tool-" + String(ev.toolName ?? "tool"), toolCallId: id, toolName: String(ev.toolName ?? "tool"), state: "input-streaming", input: undefined, output: undefined };
        parts.push(p);
        toolById.set(id, p);
        break;
      }
      case "tool-input-available": {
        const id = String(ev.toolCallId ?? "");
        const p = toolById.get(id);
        if (p) {
          p.state = "input-available";
          (p as { input: unknown }).input = ev.input;
        }
        break;
      }
      case "tool-output-available": {
        const id = String(ev.toolCallId ?? "");
        const p = toolById.get(id);
        if (p) {
          p.state = "output-available";
          (p as { output: unknown }).output = ev.output;
        }
        break;
      }
      case "tool-output-error": {
        const id = String(ev.toolCallId ?? "");
        const p = toolById.get(id);
        if (p) {
          p.state = "output-error";
          (p as { output: unknown }).output = ev.errorText ?? "error";
        }
        break;
      }
      case "error": {
        errorText = String(ev.errorText ?? ev.error ?? "Agent error.");
        break;
      }
      default:
        return; // start/finish/step boundaries — nothing to render
    }
    emit();
  };

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // SSE events are separated by a blank line; each carries one or more `data:` lines.
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        handle(JSON.parse(payload));
      } catch {
        /* ignore partial/keepalive lines */
      }
    }
  }

  const text = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
  return { text, error: errorText };
}
