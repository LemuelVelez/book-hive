#!/usr/bin/env bash
set -Eeuo pipefail

# ---------- Config ----------
APP_DIR="/root/book-hive"
COMPOSE_FILE="${APP_DIR}/docker-compose.frontend.yml"
PROJECT="bookhivefe"

DOMAIN="bookhive.jrmsu-tc.cloud"
SITE="/etc/nginx/sites-available/bookhive.jrmsu-tc.cloud"

BLUE_SVC="bookhive-blue"
GREEN_SVC="bookhive-green"
BLUE_PORT="18081"
GREEN_PORT="18082"

MAX_WAIT=180
SLEEP_SEC=3
SMOKE_RETRIES=15
SMOKE_SLEEP=2

# ---------- Helpers ----------
log(){ echo "[$(date '+%F %T')] $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat <<USAGE
Usage:
  ./deploy.sh
  ./deploy.sh --to blue
  ./deploy.sh --to green
USAGE
}

svc_of(){ [[ "$1" == "blue" ]] && echo "$BLUE_SVC" || echo "$GREEN_SVC"; }
port_of(){ [[ "$1" == "blue" ]] && echo "$BLUE_PORT" || echo "$GREEN_PORT"; }

wait_health_port() {
  local port="$1" waited=0
  while (( waited < MAX_WAIT )); do
    if curl -fsS "http://127.0.0.1:${port}/health" | grep -qi '^ok$'; then
      return 0
    fi
    sleep "$SLEEP_SEC"
    waited=$((waited + SLEEP_SEC))
  done
  return 1
}

smoke_https() {
  local i code body hdr
  for ((i=1;i<=SMOKE_RETRIES;i++)); do
    code="$(curl -k -sS \
      --resolve "${DOMAIN}:443:127.0.0.1" \
      -o /tmp/bookhive_smoke_body.out \
      -D /tmp/bookhive_smoke_hdr.out \
      -w '%{http_code}' \
      "https://${DOMAIN}/health" || true)"

    if [[ "$code" == "200" ]]; then
      body="$(tr -d '\r\n' </tmp/bookhive_smoke_body.out || true)"
      hdr="$(cat /tmp/bookhive_smoke_hdr.out || true)"
      # Must be frontend health, not old Express
      if [[ "$body" == "ok" ]] && ! grep -qi '^X-Powered-By: Express' <<<"$hdr"; then
        return 0
      fi
    fi
    sleep "$SMOKE_SLEEP"
  done

  echo "---- smoke headers ----" >&2
  cat /tmp/bookhive_smoke_hdr.out >&2 || true
  echo "---- smoke body ----" >&2
  cat /tmp/bookhive_smoke_body.out >&2 || true
  return 1
}

# ---------- Args ----------
TARGET_FORCE=""
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ "${1:-}" == "--to" ]]; then
  [[ "${2:-}" == "blue" || "${2:-}" == "green" ]] || die "--to must be blue or green"
  TARGET_FORCE="$2"
fi

# ---------- Preconditions ----------
cd "$APP_DIR"
[[ -f "$COMPOSE_FILE" ]] || die "Missing compose file: $COMPOSE_FILE"
[[ -f "$SITE" ]] || die "Missing nginx site file: $SITE"
command -v docker >/dev/null || die "docker not found"
command -v curl >/dev/null || die "curl not found"
command -v nginx >/dev/null || die "nginx not found"

# Detect active color from nginx proxy_pass
CURRENT_PORT="$(grep -Eo 'proxy_pass[[:space:]]+http://127\.0\.0\.1:[0-9]+' "$SITE" | tail -n1 | awk -F: '{print $NF}' || true)"
if [[ "$CURRENT_PORT" == "$BLUE_PORT" ]]; then
  ACTIVE="blue"
elif [[ "$CURRENT_PORT" == "$GREEN_PORT" ]]; then
  ACTIVE="green"
else
  ACTIVE="blue"
fi

if [[ -n "$TARGET_FORCE" ]]; then
  TARGET="$TARGET_FORCE"
else
  [[ "$ACTIVE" == "blue" ]] && TARGET="green" || TARGET="blue"
fi

ACTIVE_SVC="$(svc_of "$ACTIVE")"
TARGET_SVC="$(svc_of "$TARGET")"
TARGET_PORT="$(port_of "$TARGET")"

log "Active: $ACTIVE ($ACTIVE_SVC)"
log "Target: $TARGET ($TARGET_SVC @ 127.0.0.1:$TARGET_PORT)"

# ---------- Build + start target ----------
log "Building and starting target container..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" up -d --build --no-deps "$TARGET_SVC"

log "Waiting for target health on :$TARGET_PORT ..."
if ! wait_health_port "$TARGET_PORT"; then
  echo "Target did not become healthy on host port $TARGET_PORT" >&2
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'bookhive-(blue|green)' || true
  docker inspect "$TARGET_SVC" --format '{{json .HostConfig.PortBindings}}' || true
  die "Target health check failed"
fi

# ---------- Switch nginx + rollback guard ----------
backup="$(mktemp)"
cp "$SITE" "$backup"

rollback() {
  log "Rollback: restoring previous nginx config..."
  cp "$backup" "$SITE"
  nginx -t && systemctl reload nginx || true
  log "Traffic restored to $ACTIVE"
}

log "Switching nginx upstream to :$TARGET_PORT ..."
sed -i -E "s#proxy_pass[[:space:]]+http://127\\.0\\.0\\.1:[0-9]+;#proxy_pass http://127.0.0.1:${TARGET_PORT};#g" "$SITE"

if ! nginx -t; then
  rollback
  die "nginx -t failed after switch"
fi

if ! systemctl reload nginx; then
  rollback
  die "nginx reload failed after switch"
fi

log "Post-switch smoke test..."
if ! smoke_https; then
  rollback
  die "Smoke test failed"
fi

rm -f "$backup"
log "✅ Deploy success. Live color: $TARGET"
log "Previous color still running: $ACTIVE"
