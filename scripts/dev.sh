#!/usr/bin/env bash
# ============================================================================
# Reagent dev controller — start / stop / restart / status.
#
#   ONLY ever touches THIS app's own ports (from ports.env). It never does a
#   broad `pkill vite|concurrently|node`, so your other running apps are safe.
#
#   Usage:  ./scripts/dev.sh {start|stop|restart|status|logs}
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load the fixed ports (exported so npm/vite/api/worker children inherit them).
set -a
# shellcheck disable=SC1091
source ./ports.env
set +a

LOG="/tmp/reagent-dev.log"
DOCS_LOG="/tmp/reagent-docs.log"
DOCS_PORT="${DOCS_PORT:-4337}"
SANDBOX_LAST=$(( SANDBOX_PORT_BASE + SANDBOX_PORT_COUNT - 1 ))

free_port() {
  local p="$1"
  local pids
  pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  freeing port $p (pids: $pids)"
    kill -9 $pids 2>/dev/null || true
  fi
}

free_sandbox_range() {
  local i
  for ((i = SANDBOX_PORT_BASE; i <= SANDBOX_LAST; i++)); do
    free_port "$i"
  done
}

stop() {
  echo "Stopping Reagent (web:$WEB_PORT api:$API_PORT docs:$DOCS_PORT sandbox:$SANDBOX_PORT_BASE-$SANDBOX_LAST)…"
  free_port "$WEB_PORT"
  free_port "$API_PORT"
  free_port "$DOCS_PORT"
  free_sandbox_range
  # The worker has no port — target ONLY its exact, app-unique path.
  pkill -f "$ROOT/backend/src/worker.ts" 2>/dev/null || pkill -f "backend/src/worker.ts" 2>/dev/null || true
  # The docs server (Blume/Astro) — target ONLY this app's docs dir path.
  pkill -f "$ROOT/reagent-docs" 2>/dev/null || true
  echo "Stopped. (Redis on $REDIS_PORT is a shared service — left running.)"
}

start_docs() {
  free_port "$DOCS_PORT"
  echo "Starting docs → :$DOCS_PORT  (logs: $DOCS_LOG)"
  # A stale dev.lock from a killed server would make `blume dev` refuse to boot.
  rm -f "$ROOT/reagent-docs/.blume/dev.lock" 2>/dev/null || true
  ( cd "$ROOT/reagent-docs" && nohup npm run dev -- --port "$DOCS_PORT" >"$DOCS_LOG" 2>&1 & )
}

start() {
  # Make sure our ports are clear first, so Vite binds $WEB_PORT (strictPort)
  # instead of silently drifting to 5174.
  free_port "$WEB_PORT"
  free_port "$API_PORT"
  if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    echo "⚠  Redis not responding on $REDIS_PORT — start it (brew services start redis) or tasks won't run."
  fi
  echo "Starting Reagent → web:$WEB_PORT  api:$API_PORT  worker  (logs: $LOG)"
  nohup npm run dev >"$LOG" 2>&1 &
  echo "Started (pid $!)."
  start_docs
}

status() {
  for p in "$WEB_PORT" "$API_PORT" "$DOCS_PORT" "$REDIS_PORT"; do
    if lsof -ti tcp:"$p" >/dev/null 2>&1; then echo "  port $p: UP"; else echo "  port $p: down"; fi
  done
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  logs)    tail -f "$LOG" ;;
  *) echo "usage: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
