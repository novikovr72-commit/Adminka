#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

mkdir -p "$LOG_DIR"

is_running() {
  pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

is_http_ready() {
  url="$1"
  curl -fsS "$url" >/dev/null 2>&1
}

read_pid() {
  file="$1"
  if [ -f "$file" ]; then
    tr -d " \n\r\t" < "$file"
  else
    printf ""
  fi
}

start_backend() {
  if is_http_ready "http://localhost:3003/api/admin/db-health"; then
    echo "Backend already reachable on :3003"
    return 0
  fi

  existing_pid="$(read_pid "$BACKEND_PID_FILE")"
  if is_running "$existing_pid"; then
    echo "Backend already running (pid=$existing_pid)"
    return 0
  fi

  echo "Starting backend on :3003 ..."
  (
    cd "$ROOT_DIR"
    set -a
    [ -f backend/.env ] && . backend/.env
    set +a
    ALL_PROXY= HTTP_PROXY= HTTPS_PROXY= SOCKS_PROXY= SOCKS5_PROXY= \
    all_proxy= http_proxy= https_proxy= socks_proxy= socks5_proxy= \
    NO_PROXY=127.0.0.1,::1,localhost no_proxy=127.0.0.1,::1,localhost \
    PATH="/opt/homebrew/opt/openjdk/bin:/usr/local/opt/openjdk/bin:$PATH" \
    nohup ./backend/mvnw -f backend/pom.xml -Dmaven.test.skip=true spring-boot:run \
      > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )
}

start_frontend() {
  if is_http_ready "http://localhost:5175/"; then
    echo "Frontend already reachable on :5175"
    return 0
  fi

  existing_pid="$(read_pid "$FRONTEND_PID_FILE")"
  if is_running "$existing_pid"; then
    echo "Frontend already running (pid=$existing_pid)"
    return 0
  fi

  echo "Starting frontend on :5175 ..."
  (
    cd "$ROOT_DIR"
    nohup npm run dev --prefix frontend > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )
}

wait_http() {
  url="$1"
  timeout_sec="$2"
  i=0
  while [ "$i" -lt "$timeout_sec" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

start_backend
start_frontend

if wait_http "http://localhost:3003/api/admin/db-health" 40; then
  echo "Backend OK: http://localhost:3003/api/admin/db-health"
else
  echo "Backend did not become healthy in time. Check: $LOG_DIR/backend.log"
fi

if wait_http "http://localhost:5175/" 20; then
  echo "Frontend OK: http://localhost:5175/"
else
  echo "Frontend did not become ready in time. Check: $LOG_DIR/frontend.log"
fi

echo "Done. Logs: $LOG_DIR"
