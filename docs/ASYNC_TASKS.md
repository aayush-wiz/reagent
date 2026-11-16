# Reagent — Async Research Tasks Architecture

How a research run executes so that **(1)** a live chat run keeps running when you
leave and is still streaming when you come back, and **(2)** a "New task" run
executes fully async under the hood and is watched from a dedicated **Tasks** tab.

This is the agreed design. It uses a **real broker + queue + dedicated worker** —
no in-process shortcuts.

> Note on the stack: Celery is Python-only; this backend is Node/TypeScript, so
> the equivalent "broker + queue + worker" is **BullMQ on Redis**. Same pattern
> answerThis got from Celery — the Node-native tool.

---

## The two flows (this is what was asked — do not deviate)

### Flow 1 — Live chat run: keep it running, no reopen

When a run is processing in a research chat and you navigate away and come back,
the run **must still be processing in the chat, live** — not reopened, not
replayed, not restarted. It never stopped.

This is achieved on **two layers**:

- **Server owns execution.** The run executes inside the **worker process**, not
  the browser request. Leaving the chat, closing the tab, or navigating anywhere
  does not touch it. It genuinely keeps running.
- **Client keeps the stream alive across navigation.** The live run — its
  WebSocket **and** its accumulating messages — lives in a **global app-level
  store** (`RunProvider`, mounted once at the root, above the router). It does
  **not** unmount when you change pages. So messages keep flowing into the store
  while you're away, and when you return to the chat it just reads the store and
  shows the stream **still moving**. Nothing is reopened. Nothing is replayed.

  (The only case that must reconnect is a **hard browser refresh (F5)**, because
  that tears down all JS. That reconnect is lossless via the DB. In-app "go back
  and come back" = zero interruption.)

### Flow 2 — New task: full async, under the hood

The "New task" composer fires a task and returns instantly. You do **not** watch
it in the chat. It runs under the hood in the worker. A new **Tasks** tab in the
left sidebar is where you see every task: its live status, streamed steps, the
agent's final answer, and the artifacts it produced (findings / files). Each task
has a Cancel button.

**Both flows are the same job on the same queue + worker.** They differ only in
*where you watch* and *whether you watch immediately*.

---

## Architecture

```
                         ┌─────────────────── Redis ───────────────────┐
                         │  • BullMQ job queue  "runs"                   │
                         │  • pub/sub channel   run:<id>                 │
                         └──────────────────────────────────────────────┘
   POST /api/agent   ┐                     ▲ enqueue            │ subscribe
   (live chat)       ├──▶ enqueue job ─────┘                    │
   POST /api/tasks   ┘    returns runId instantly               ▼
   (async task)                                 ┌──── Worker process ────────┐
                                                │ picks job from "runs" queue │
                                                │ runs the shared agent loop  │
                                                │  ├─ persist every event ────┼──▶ SQLite  task_events
                                                │  │     to DB (durable)      │      (durable replay)
                                                │  ├─ publish every event ────┼──▶ Redis pub/sub run:<id>
                                                │  └─ AbortController = cancel │
                                                └──────────────────────────────┘
   Browser ◀── WebSocket /api/runs/:id/ws ── API relays:
                                              on connect → replay DB events since `seq`,
                                              then live-relay Redis pub/sub run:<id>.

   Client global RunProvider (above router) holds the socket + messages so
   in-app navigation never drops the live stream.
```

**Why this is the non-shortcut version**

- **Real broker + queue (Redis + BullMQ).** Jobs are durable in Redis, survive
  across many API requests, and can be retried, rate-limited, and scaled to N
  workers. Not a `void runAgent()` inside the request.
- **Dedicated worker process.** The agent loop runs in its own process
  (`npm run worker`) so the API stays responsive and workers can scale. This is
  the Celery-worker equivalent.
- **Redis pub/sub.** Live fan-out to any number of viewers / reconnections,
  decoupled from who is connected.
- **SQLite `task_events`.** Every event is also persisted, so replay-on-reconnect
  (hard refresh) loses nothing even though pub/sub is ephemeral.
- **Global client run store.** Keeps Flow 1 truly uninterrupted across in-app
  navigation — no reopen.

---

## Components

### Backend

1. **Queue + broker** — `bullmq` + `ioredis`. One queue: `runs`.
2. **Tables**
   - `tasks` — `id, researchId?, sessionId?, kind(chat|task), title, prompt,
     model, agent, status(queued|running|done|failed|canceled), result, error,
     createdAt, startedAt, finishedAt`.
   - `task_events` — append-only `(id, taskId, seq, part JSON, createdAt)` for
     durable replay.
3. **Shared agent loop** — extract the dynamic ReAct loop out of `agent/run.ts`
   into a core that emits UI-stream parts to a **sink**, so the interactive path
   and the worker share one loop (no duplication).
4. **Worker process** (`backend/src/worker.ts`) — a BullMQ `Worker` on the `runs`
   queue: sets status running → runs the loop → for each event: persist to
   `task_events` (seq++) **and** publish to Redis `run:<id>` → on finish persist
   `result`, set `done`, and (for chat runs) write the answer into the research
   session so it also shows there → on error set `failed`. Holds an
   `AbortController` per run for **Cancel** (threaded into `streamText`'s
   `abortSignal`).
5. **Enqueue endpoints**
   - `POST /api/tasks` — async task (Flow 2). Enqueue, return `runId`.
   - `POST /api/agent` — live chat (Flow 1). Enqueue bound to the session, return
     `runId` (instead of streaming inline).
   - `GET /api/sessions/:id/active-run` — the session's currently-running run, so
     the chat can attach to it.
   - `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/cancel`.
6. **WebSocket relay** (`ws` package attached to the Node server on `upgrade` at
   `/api/runs/:id/ws`) — on connect: replay `task_events` since the client's last
   `seq`, then subscribe to Redis `run:<id>` and relay live. `ws: true` on the
   Vite dev proxy.

### Frontend

7. **`RunProvider`** — a global context mounted once above the router. Owns each
   live run's WebSocket + accumulating messages so navigation never drops the
   stream. The chat and the Tasks detail both read from it.
8. **Live chat** — on send: enqueue → subscribe in `RunProvider`. On entering a
   research: check `active-run`; if present, the stream is already in the store,
   so the chat shows it still processing.
9. **Tasks tab** — new sidebar section + `TasksPage`: list (status pills) → detail
   that reads the run from `RunProvider` (replay + live), showing streamed steps,
   final answer, artifacts, and Cancel.
10. **New-task modal** — `POST /api/tasks` (fire-and-forget) → jump to
    `/tasks/:id`.

---

## Locked decisions

- **Autonomy:** full auto — no approval gates. Runs entirely under the hood.
- **Transport:** WebSocket + durable DB event replay.
- **Runner:** dedicated **worker process** consuming a **Redis/BullMQ** queue —
  the proper broker+queue+worker, not in-process.
- **Flow 1 stays live across in-app navigation** via the global `RunProvider`
  (no reopen); the worker keeps it running server-side regardless.

---

## Infrastructure & dependencies

- **Redis** running locally — `brew install redis && brew services start redis`
  (or a Docker container). This is the one new external dependency; it is the
  broker + pub/sub that makes this "proper."
- New packages: `bullmq`, `ioredis`, `ws` (+ `@types/ws`).
- **Dev runs three processes:** `web` (Vite) + `api` (Hono) + `worker` (BullMQ).
  `npm run dev` will launch all three together.

---

## Build order

1. Redis + `bullmq`/`ioredis`/`ws`; `tasks` + `task_events` tables; the `runs`
   queue.
2. Extract the agent loop into a shared core that emits events to a sink.
3. Worker process: consume jobs → run → persist + publish → cancel via
   AbortController.
4. Enqueue endpoints: `POST /api/tasks`, switch `POST /api/agent` to enqueue +
   return `runId`, `GET /api/sessions/:id/active-run`.
5. WebSocket relay `/api/runs/:id/ws`: DB replay since `seq` → live Redis relay.
6. Frontend: global `RunProvider`; live chat attaches to its session's active
   run (stays live across navigation); new **Tasks** tab (list + live detail +
   cancel); New-task modal → enqueue.
```
