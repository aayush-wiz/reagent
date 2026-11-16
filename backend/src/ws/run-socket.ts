/**
 * backend/src/ws/run-socket.ts — the run WebSocket relay.
 *
 *   Endpoint: ws://…/api/runs/:id/ws?since=<seq>
 *
 *   On connect we (1) subscribe to the run's Redis pub/sub channel and buffer
 *   live events, (2) replay persisted task_events after `since` from SQLite,
 *   (3) flush buffered live events with seq > last replayed, then (4) forward
 *   live events directly. This makes reconnection lossless with no duplicates —
 *   the run itself never stops, it lives in the worker.
 */
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { makeRedis, runChannel } from "../queue/redis.ts";
import { eventsSince, getTask } from "../services/tasks.ts";
import { userForToken } from "../services/auth.ts";
import { ownsTask } from "../services/ownership.ts";
import { log } from "../libs/logger.ts";

const PATH_RE = /^\/api\/runs\/([^/]+)\/ws$/;

// ---- one shared Redis subscriber for ALL run WebSockets ---------------------
// Each socket used to open its own Redis connection (thousands of viewers →
// thousands of connections). A single psubscribe("run:*") now fans out to local
// listeners keyed by channel, so N sockets cost exactly 1 Redis connection.
type Listener = (msg: string) => void;
const channelListeners = new Map<string, Set<Listener>>();
let sharedSub: ReturnType<typeof makeRedis> | null = null;

function ensureSharedSub(): void {
  if (sharedSub) return;
  sharedSub = makeRedis();
  sharedSub.on("pmessage", (_pattern, channel, msg) => {
    const set = channelListeners.get(channel);
    if (set) for (const fn of set) fn(msg);
  });
  sharedSub.psubscribe("run:*").catch((e) => log.warn("run ws psubscribe failed", String(e)));
}

/** Register a listener for a run's channel; returns an unsubscribe fn. */
function addListener(channel: string, fn: Listener): () => void {
  ensureSharedSub();
  let set = channelListeners.get(channel);
  if (!set) {
    set = new Set();
    channelListeners.set(channel, set);
  }
  set.add(fn);
  return () => {
    const s = channelListeners.get(channel);
    if (s) {
      s.delete(fn);
      if (s.size === 0) channelListeners.delete(channel);
    }
  };
}

export function attachRunWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const m = url.pathname.match(PATH_RE);
    if (!m) return; // let other upgrade handlers (or nothing) deal with it
    const taskId = decodeURIComponent(m[1]);
    const since = Number(url.searchParams.get("since") ?? 0) || 0;
    // Authenticate the handshake: the browser can't set headers on a WebSocket,
    // so the token rides in the query string. Reject unless it resolves to the
    // user who owns this run.
    const user = userForToken(url.searchParams.get("token") ?? "");
    if (!user || !ownsTask(user.id, taskId)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws, taskId, since));
  });

  log.info("Run WebSocket relay attached at /api/runs/:id/ws");
}

async function handleConnection(ws: WebSocket, taskId: string, since: number): Promise<void> {
  const send = (msg: string) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  };

  const buffer: string[] = [];
  let liveReady = false;

  // (1) subscribe first (via the shared subscriber), buffering live events until
  // replay is done.
  const onMessage: Listener = (msg) => {
    if (liveReady) send(msg);
    else buffer.push(msg);
  };
  const unsubscribe = addListener(runChannel(taskId), onMessage);

  // (2) replay persisted events after `since`.
  let lastSeq = since;
  for (const e of eventsSince(taskId, since)) {
    lastSeq = e.seq;
    send(JSON.stringify({ seq: e.seq, part: JSON.parse(e.part) }));
  }

  // Send current status so a client that connects late knows the run's state.
  const task = getTask(taskId);
  if (task) send(JSON.stringify({ type: "status", status: task.status }));

  // (3) flush buffered live events not already covered by the replay.
  liveReady = true;
  for (const msg of buffer) {
    try {
      const p = JSON.parse(msg) as { seq?: number };
      if (typeof p.seq === "number" && p.seq <= lastSeq) continue;
    } catch {
      /* status/error messages have no seq — always forward */
    }
    send(msg);
  }
  buffer.length = 0;

  const cleanup = () => unsubscribe();
  ws.on("close", cleanup);
  ws.on("error", cleanup);
}
