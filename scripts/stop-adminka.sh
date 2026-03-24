#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

stop_by_pid_file() {
  file="$1"
  name="$2"
  if [ ! -f "$file" ]; then
    echo "$name: pid file not found"
    return 0
  fi

  pid="$(tr -d " \n\r\t" < "$file")"
  if [ -z "$pid" ]; then
    rm -f "$file"
    echo "$name: empty pid file removed"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $name (pid=$pid) ..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      echo "Force stopping $name (pid=$pid) ..."
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "$name stopped"
  else
    echo "$name already stopped (stale pid=$pid)"
  fi

  rm -f "$file"
}

stop_by_port() {
  port="$1"
  name="$2"
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "$name: no listener on :$port"
    return 0
  fi
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name on :$port (pid=$pid) ..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping $name on :$port (pid=$pid) ..."
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
  done
}

stop_by_pid_file "$FRONTEND_PID_FILE" "frontend"
stop_by_pid_file "$BACKEND_PID_FILE" "backend"
stop_by_port "5175" "frontend"
stop_by_port "3003" "backend"

echo "Done."
