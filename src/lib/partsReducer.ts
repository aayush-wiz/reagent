/**
 * src/lib/partsReducer.ts — reconstruct a UI-message-stream into ordered parts.
 *
 *   The AI SDK's UI message stream is a flat sequence of events (text-delta,
 *   reasoning-delta, tool-input-available, …). Both transports feed the SAME
 *   reducer: the HTTP chat stream (agentStream.ts) and the run WebSocket
 *   (RunProvider). It maintains the `parts[]` array AgentMessage renders.
 */

export type StreamPart =
  | { type: "text"; text: string; _id?: string; _ts?: number; _tsEnd?: number }
  | { type: "reasoning"; text: string; _id?: string; _ts?: number; _tsEnd?: number }
  | { type: string; toolCallId?: string; toolName?: string; state?: string; input?: unknown; output?: unknown; _ts?: number; _tsEnd?: number };

type ToolPart = { type: string; toolCallId?: string; toolName?: string; state?: string; input?: unknown; output?: unknown; _ts?: number; _tsEnd?: number };

export interface PartsAccumulator {
  parts: StreamPart[];
  /** Apply one UI-stream event. Returns true if it changed the parts. */
  apply: (ev: Record<string, unknown>) => boolean;
  /** The concatenated assistant text so far. */
  text: () => string;
  /** The error text, if an `error` event arrived. */
  error?: string;
}

export function createPartsAccumulator(): PartsAccumulator {
  const parts: StreamPart[] = [];
  const textById = new Map<string, StreamPart>();
  const reasonById = new Map<string, StreamPart>();
  const toolById = new Map<string, ToolPart>();

  const acc: PartsAccumulator = {
    parts,
    text: () => parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join(""),
    apply(ev) {
      const t = String(ev.type ?? "");
      // Wall-clock stamp: the worker adds `_ts` to every event; backfilled turns
      // carry the event row's created_at. Stamps the target part's first/last
      // touch so the UI can show REAL "Worked for Ns" durations after reload.
      const ts = typeof ev._ts === "number" ? (ev._ts as number) : undefined;
      const stamp = (p: { _ts?: number; _tsEnd?: number }) => {
        if (ts === undefined) return;
        if (p._ts === undefined) p._ts = ts;
        p._tsEnd = ts;
      };
      switch (t) {
        case "text-start": {
          const p: StreamPart = { type: "text", text: "", _id: String(ev.id ?? "") };
          stamp(p);
          parts.push(p);
          textById.set(p._id!, p);
          return true;
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
          stamp(p);
          return true;
        }
        case "reasoning-start": {
          const p: StreamPart = { type: "reasoning", text: "", _id: String(ev.id ?? "") };
          stamp(p);
          parts.push(p);
          reasonById.set(p._id!, p);
          return true;
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
          stamp(p);
          return true;
        }
        case "tool-input-start": {
          const id = String(ev.toolCallId ?? "");
          const p: ToolPart = { type: "tool-" + String(ev.toolName ?? "tool"), toolCallId: id, toolName: String(ev.toolName ?? "tool"), state: "input-streaming", input: undefined, output: undefined };
          stamp(p);
          parts.push(p);
          toolById.set(id, p);
          return true;
        }
        case "tool-input-available": {
          const id = String(ev.toolCallId ?? "");
          const p = toolById.get(id);
          if (p) {
            p.state = "input-available";
            stamp(p);
            (p as { input: unknown }).input = ev.input;
          }
          return true;
        }
        case "tool-output-available": {
          const id = String(ev.toolCallId ?? "");
          const p = toolById.get(id);
          if (p) {
            p.state = "output-available";
            stamp(p);
            (p as { output: unknown }).output = ev.output;
          }
          return true;
        }
        case "tool-output-error": {
          const id = String(ev.toolCallId ?? "");
          const p = toolById.get(id);
          if (p) {
            p.state = "output-error";
            stamp(p);
            (p as { output: unknown }).output = ev.errorText ?? "error";
          }
          return true;
        }
        case "error": {
          acc.error = String(ev.errorText ?? ev.error ?? "Agent error.");
          return true;
        }
        default:
          return false; // start/finish/step boundaries — nothing to render
      }
    },
  };
  return acc;
}
