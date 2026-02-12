#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-$HOME/book-hive}"
COMPOSE_FILE="docker-compose.frontend.yml"
ENV_LOADER="scripts/load-external-env.sh"
CADDY_REPO_FILE="infra/Caddyfile"
ACTIVE_MARKER="/opt/bookhive-env/bookhive.active"

BLUE_SVC="bookhive-blue"
GREEN_SVC="bookhive-green"
BLUE_PORT="18081"
GREEN_PORT="18082"

log(){ printf "\n[%s] %s\n" "$(date '+%F %T')" "$*"; }
err(){ printf "\n[ERROR] %s\n" "$*" >&2; }

require_file() {
  local f="$1"
  [[ -f "$f" ]] || { err "Missing file: $f"; exit 1; }
}

cd "$REPO_DIR"

require_file "$COMPOSE_FILE"
require_file "$ENV_LOADER"
require_file "$CADDY_REPO_FILE"

log "1) Sync repo (fast-forward only)"
git fetch origin main --prune
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"
printf "LOCAL : %s\nREMOTE: %s\n" "$LOCAL_SHA" "$REMOTE_SHA"
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  git pull --ff-only origin main
else
  echo "Already up to date."
fi

log "2) Load external frontend env"
# shellcheck source=/dev/null
. "$ENV_LOADER"
: "${EXTERNAL_ENV_1:?EXTERNAL_ENV_1 missing in .env bridge}"
echo "Loaded EXTERNAL_ENV_1=$EXTERNAL_ENV_1"

get_active_from_caddy_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  if grep -Eq '(127\.0\.0\.1|localhost):18081' "$file"; then
    echo "blue"; return 0
  elif grep -Eq '(127\.0\.0\.1|localhost):18082' "$file"; then
    echo "green"; return 0
  fi
  return 1
}

ACTIVE_COLOR=""
if [[ -f "$ACTIVE_MARKER" ]]; then
  marker_val="$(tr -d '[:space:]' < "$ACTIVE_MARKER" || true)"
  if [[ "$marker_val" == "blue" || "$marker_val" == "green" ]]; then
    ACTIVE_COLOR="$marker_val"
  fi
fi

if [[ -z "$ACTIVE_COLOR" ]]; then
  ACTIVE_COLOR="$(get_active_from_caddy_file /etc/caddy/Caddyfile 2>/dev/null || true)"
fi
if [[ -z "$ACTIVE_COLOR" ]]; then
  ACTIVE_COLOR="$(get_active_from_caddy_file "$CADDY_REPO_FILE" 2>/dev/null || true)"
fi
if [[ -z "$ACTIVE_COLOR" ]]; then
  ACTIVE_COLOR="blue"
fi

if [[ "$ACTIVE_COLOR" == "blue" ]]; then
  IDLE_COLOR="green"
  ACTIVE_PORT="$BLUE_PORT"
  IDLE_PORT="$GREEN_PORT"
  ACTIVE_SVC="$BLUE_SVC"
  IDLE_SVC="$GREEN_SVC"
else
  IDLE_COLOR="blue"
  ACTIVE_PORT="$GREEN_PORT"
  IDLE_PORT="$BLUE_PORT"
  ACTIVE_SVC="$GREEN_SVC"
  IDLE_SVC="$BLUE_SVC"
fi

echo "Active slot: $ACTIVE_COLOR ($ACTIVE_SVC:$ACTIVE_PORT)"
echo "Deploy slot: $IDLE_COLOR ($IDLE_SVC:$IDLE_PORT)"

log "3) Build + start idle slot only"
docker compose -f "$COMPOSE_FILE" up -d --build --no-deps "$IDLE_SVC"

wait_idle_ready() {
  local svc="$1" port="$2" timeout_sec=180
  local start_ts now_ts cid health running

  start_ts="$(date +%s)"
  while true; do
    cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" || true)"
    if [[ -n "$cid" ]]; then
      running="$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || echo false)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)"

      if [[ "$running" == "true" ]]; then
        if [[ "$health" == "healthy" ]]; then
          return 0
        fi
        if [[ "$health" == "none" ]]; then
          if command -v curl >/dev/null 2>&1; then
            if curl -fsS --max-time 2 "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
              return 0
            fi
          else
            return 0
          fi
        fi
        if [[ "$health" == "unhealthy" ]]; then
          err "$svc is unhealthy"
          return 1
        fi
      fi
    fi

    now_ts="$(date +%s)"
    if (( now_ts - start_ts >= timeout_sec )); then
      err "Timeout waiting for $svc readiness"
      return 1
    fi
    sleep 2
  done
}

log "4) Wait idle slot ready"
wait_idle_ready "$IDLE_SVC" "$IDLE_PORT"

switch_port_in_file() {
  local file="$1" from_port="$2" to_port="$3"
  [[ -f "$file" ]] || return 1

  if grep -Eq "(127\.0\.0\.1|localhost):${from_port}" "$file"; then
    cp -a "$file" "${file}.bak.$(date +%F-%H%M%S)"
    sed -E "s#(127\.0\.0\.1|localhost):${from_port}#\1:${to_port}#g" "$file" > "${file}.tmp"
    mv "${file}.tmp" "$file"
    return 0
  fi
  return 1
}

reload_caddy() {
  # Host caddy service
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy; then
    if [[ -f /etc/caddy/Caddyfile ]]; then
      install -m 644 "$CADDY_REPO_FILE" /etc/caddy/Caddyfile
      if command -v caddy >/dev/null 2>&1; then
        caddy validate --config /etc/caddy/Caddyfile
      fi
    fi
    systemctl reload caddy
    return 0
  fi

  # Caddy container fallback
  local caddy_container
  caddy_container="$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /caddy/ {print $1; exit}')"
  if [[ -n "$caddy_container" ]]; then
    docker cp "$CADDY_REPO_FILE" "$caddy_container":/etc/caddy/Caddyfile
    docker exec "$caddy_container" caddy validate --config /etc/caddy/Caddyfile
    docker exec "$caddy_container" caddy reload --config /etc/caddy/Caddyfile
    return 0
  fi

  return 1
}

log "5) Switch traffic in Caddy from $ACTIVE_PORT -> $IDLE_PORT"
if switch_port_in_file "$CADDY_REPO_FILE" "$ACTIVE_PORT" "$IDLE_PORT"; then
  if reload_caddy; then
    echo "Traffic switched to $IDLE_COLOR slot."
  else
    err "Caddy reload was not detected. $CADDY_REPO_FILE updated; reload Caddy manually."
    exit 1
  fi
else
  err "Could not find active upstream port $ACTIVE_PORT in $CADDY_REPO_FILE"
  exit 1
fi

install -d -m 700 "$(dirname "$ACTIVE_MARKER")"
echo "$IDLE_COLOR" > "$ACTIVE_MARKER"
chmod 600 "$ACTIVE_MARKER"

log "6) Final status"
docker compose -f "$COMPOSE_FILE" ps
echo "Active slot is now: $IDLE_COLOR"
echo "Previous slot kept running for rollback: $ACTIVE_COLOR"
