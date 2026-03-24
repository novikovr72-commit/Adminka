#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

status_by_pid_file() {
  file="$1"
  name="$2"
  if [ ! -f "$file" ]; then
    echo "$name: not running (no pid file)"
    return 0
  fi

  pid="$(tr -d " \n\r\t" < "$file")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "$name: running (pid=$pid)"
  else
    echo "$name: not running (stale pid file)"
  fi
}

status_by_port() {
  port="$1"
  name="$2"
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "$name-port :$port: not listening"
  else
    echo "$name-port :$port: listening (pid=$pids)"
  fi
}

status_by_pid_file "$BACKEND_PID_FILE" "backend"
status_by_pid_file "$FRONTEND_PID_FILE" "frontend"
status_by_port "3003" "backend"
status_by_port "5175" "frontend"

if curl -fsS "http://localhost:3003/api/admin/db-health" >/dev/null 2>&1; then
  echo "health: backend endpoint reachable"
else
  echo "health: backend endpoint not reachable"
fi

if curl -fsS "http://localhost:5175/" >/dev/null 2>&1; then
  echo "health: frontend endpoint reachable"
else
  echo "health: frontend endpoint not reachable"
fi
