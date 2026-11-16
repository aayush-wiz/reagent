/**
 * src/lib/RunProvider.tsx — the global live-run store.
 *
 *   Mounted ONCE above the router (App.tsx), so a run's WebSocket and its
 *   accumulating messages survive in-app navigation — leave the chat, wander
 *   anywhere, come back, and the run is still streaming with zero interruption.
 *   (The run itself lives in the worker, so it never stops regardless.)
 *
 *   The socket replays persisted events on connect (lossless), then goes live.
 *   Both the chat (Flow 1) and the Tasks tab (Flow 2) read runs from here.
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPartsAccumulator, type StreamPart } from "./partsReducer";
import { api } from "./api";
import { getToken } from "./auth";

export type RunStatus = "queued" | "running" | "done" | "failed" | "canceled" | "unknown";

export interface RunState {
  parts: StreamPart[];
  status: RunStatus;
  error?: string;
  lastSeq: number;
}

interface RunContextValue {
  runs: Record<string, RunState>;
  /** Open (or reuse) a socket for a run. Idempotent — safe to call on every render/mount. */
  attach: (runId: string) => void;
  cancel: (runId: string) => void;
  get: (runId: string) => RunState | undefined;
}

const RunContext = createContext<RunContextValue | null>(null);

function wsUrl(runId: string, since: number): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // A browser WebSocket can't set an Authorization header, so the bearer token
  // rides in the query string; the server authenticates the handshake with it.
  const token = getToken();
  const auth = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${proto}://${window.location.host}/api/runs/${encodeURIComponent(runId)}/ws?since=${since}${auth}`;
}

export function RunProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  // Per-run socket + accumulator + last seq, kept in refs so they persist across renders.
  const sockets = useRef<Map<string, WebSocket>>(new Map());
  const accs = useRef<Map<string, ReturnType<typeof createPartsAccumulator>>>(new Map());
  const seqs = useRef<Map<string, number>>(new Map());

  const publish = useCallback((runId: string, patch: Partial<RunState>) => {
    setRuns((prev) => ({ ...prev, [runId]: { ...(prev[runId] ?? { parts: [], status: "unknown", lastSeq: 0 }), ...patch } }));
  }, []);

  const open = useCallback(
    (runId: string) => {
      // Reuse an existing open/connecting socket.
      const existing = sockets.current.get(runId);
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

      const acc = accs.current.get(runId) ?? createPartsAccumulator();
      accs.current.set(runId, acc);
      const since = seqs.current.get(runId) ?? 0;
      const ws = new WebSocket(wsUrl(runId, since));
      sockets.current.set(runId, ws);

      ws.onmessage = (ev) => {
        let msg: { seq?: number; part?: Record<string, unknown>; type?: string; status?: RunStatus; error?: string };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "status" && msg.status) {
          publish(runId, { status: msg.status });
          return;
        }
        if (msg.type === "error") {
          publish(runId, { error: msg.error, status: "failed" });
          return;
        }
        if (typeof msg.seq === "number" && msg.part) {
          seqs.current.set(runId, Math.max(seqs.current.get(runId) ?? 0, msg.seq));
          const changed = acc.apply(msg.part);
          if (changed) publish(runId, { parts: acc.parts.slice(), error: acc.error, lastSeq: seqs.current.get(runId)! });
        }
      };

      ws.onclose = () => {
        sockets.current.delete(runId);
        // Reconnect if the run isn't finished yet (e.g. transient drop). Resumes
        // from lastSeq, so nothing is missed and nothing duplicated.
        setRuns((prev) => {
          const st = prev[runId];
          if (st && (st.status === "queued" || st.status === "running" || st.status === "unknown")) {
            setTimeout(() => open(runId), 800);
          }
          return prev;
        });
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    },
    [publish],
  );

  const attach = useCallback(
    (runId: string) => {
      if (!runs[runId]) publish(runId, { parts: [], status: "unknown", lastSeq: 0 });
      open(runId);
    },
    [open, publish, runs],
  );

  const cancel = useCallback((runId: string) => {
    api.cancelTask(runId).catch(() => {});
  }, []);

  const get = useCallback((runId: string) => runs[runId], [runs]);

  return <RunContext.Provider value={{ runs, attach, cancel, get }}>{children}</RunContext.Provider>;
}

export function useRuns(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRuns must be used within <RunProvider>");
  return ctx;
}

/** Convenience: attach to a run and get its live state. */
export function useRun(runId: string | null | undefined): RunState | undefined {
  const { runs } = useRuns();
  return runId ? runs[runId] : undefined;
}
