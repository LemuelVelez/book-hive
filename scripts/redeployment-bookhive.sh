#!/usr/bin/env bash
set -Eeuo pipefail

# ===== Logging / errors =====
log(){ printf "\n[%s] %s\n" "$(date '+%F %T')" "$*"; }
err(){ printf "\n[ERROR] %s\n" "$*" >&2; }
die(){ err "$*"; exit 1; }
trap 'err "Line $LINENO failed: $BASH_COMMAND"' ERR

# ===== Config (override via env vars if needed) =====
REPO_DIR="${REPO_DIR:-$HOME/book-hive}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.frontend.yml}"
ENV_LOADER="${ENV_LOADER:-scripts/load-external-env.sh}"
CADDY_REPO_FILE="${CADDY_REPO_FILE:-infra/Caddyfile}"
ACTIVE_MARKER="${ACTIVE_MARKER:-/opt/bookhive-env/bookhive.active}"

DOMAIN="${DOMAIN:-bookhive.jrmsu-tc.cloud}"
HEALTH_PATH="${HEALTH_PATH:-/}"
PUBLIC_CHECK_URL="${PUBLIC_CHECK_URL:-https://${DOMAIN}${HEALTH_PATH}}"
SLOT_HEADER_NAME="${SLOT_HEADER_NAME:-X-BookHive-Slot}"

# Set REQUIRED_ENV_KEY="EXTERNAL_ENV_1" (or another key) if you want strict env validation
REQUIRED_ENV_KEY="${REQUIRED_ENV_KEY:-EXTERNAL_ENV_1}"

# Optional preferred Caddy container name
CADDY_CTN="${CADDY_CTN:-}"

PUBLIC_CHECK_RETRIES="${PUBLIC_CHECK_RETRIES:-30}"
PUBLIC_CHECK_SLEEP_SECS="${PUBLIC_CHECK_SLEEP_SECS:-2}"

UPSTREAM_PROBE_IMAGE="${UPSTREAM_PROBE_IMAGE:-curlimages/curl:8.11.1}"
UPSTREAM_PROBE_RETRIES="${UPSTREAM_PROBE_RETRIES:-8}"
UPSTREAM_PROBE_SLEEP_SECS="${UPSTREAM_PROBE_SLEEP_SECS:-2}"

AUTO_REMEDY_502="${AUTO_REMEDY_502:-1}"                            # 1=try network fix + reload on 502
AUTO_ROLLBACK_ON_VERIFY_FAIL="${AUTO_ROLLBACK_ON_VERIFY_FAIL:-0}"  # 1=rollback switch if verify fails

# Reliability knobs
LOCK_FILE="${LOCK_FILE:-/tmp/redeployment-bookhive.lock}"
CADDY_RESTART_ON_RELOAD_FAIL="${CADDY_RESTART_ON_RELOAD_FAIL:-1}"
CADDY_ENABLE_FMT="${CADDY_ENABLE_FMT:-0}"

# Slot services/ports (overridable by backend wrapper)
BLUE_SVC="${BLUE_SVC:-bookhive-blue}"
GREEN_SVC="${GREEN_SVC:-bookhive-green}"
BLUE_PORT="${BLUE_PORT:-18081}"
GREEN_PORT="${GREEN_PORT:-18082}"
UPSTREAM_CONTAINER_PORT="${UPSTREAM_CONTAINER_PORT:-8080}"

EDGE_OWNER="none"               # docker|host|none
SERVICE_CADDY_ACTIVE="inactive" # active|inactive|failed|...
CADDY_RUNTIME_MODE="none"       # host|container-mounted|container-internal|none
CADDY_RUNTIME_FILE=""           # path to editable runtime Caddyfile (if available)
CADDY_CONTAINER_NAME=""         # edge Caddy container (when EDGE_OWNER=docker)
CADDY_TARGET_FILE=""            # exactly one file that this script edits
SWITCH_MODE="unknown"           # service|port|unknown

# Compose command array, initialized in main
COMPOSE_BASE=()

# ===== Utilities =====
require_file() {
  local f="$1"
  [[ -f "$f" ]] || die "Missing file: $f"
}

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1 || die "Missing required command: $c"
}

compose() {
  "${COMPOSE_BASE[@]}" "$@"
}

to_abs_under_repo() {
  local p="$1"
  if [[ "$p" = /* ]]; then
    printf '%s\n' "$p"
  else
    printf '%s\n' "$REPO_DIR/$p"
  fi
}

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
      die "Another deployment appears to be running (lock: $LOCK_FILE)."
    fi
  fi
}

is_http_2xx_or_3xx() {
  [[ "${1:-}" =~ ^[23][0-9][0-9]$ ]]
}

http_code_from_headers() {
  awk 'toupper($1) ~ /^HTTP\// {code=$2} END{print code}'
}

slot_from_headers() {
  local hdr_lc
  hdr_lc="$(tr '[:upper:]' '[:lower:]' <<< "$SLOT_HEADER_NAME")"
  awk -F': ' -v h="$hdr_lc" '
    tolower($1)==h {gsub("\r","",$2); slot=tolower($2)}
    END{print slot}
  '
}

probe_headers() {
  # Usage: probe_headers "https://example.com/" [extra curl args...]
  local url="$1"; shift || true
  curl -ksSIL --connect-timeout 5 --max-time 12 "$@" "$url" 2>/dev/null || true
}

backup_file() {
  local f="$1"
  cp -a "$f" "${f}.bak.$(date +%F-%H%M%S-%N)"
}

service_for_slot() {
  case "$1" in
    blue)  printf '%s\n' "$BLUE_SVC" ;;
    green) printf '%s\n' "$GREEN_SVC" ;;
    *) return 1 ;;
  esac
}

upstream_for_slot() {
  local color="$1" mode="$2" svc
  case "$mode" in
    service)
      svc="$(service_for_slot "$color")" || return 1
      printf '%s:%s\n' "$svc" "$UPSTREAM_CONTAINER_PORT"
      ;;
    port)
      case "$color" in
        blue)  printf '127.0.0.1:%s\n' "$BLUE_PORT" ;;
        green) printf '127.0.0.1:%s\n' "$GREEN_PORT" ;;
        *) return 1 ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

# Return: blue|green|""
get_active_from_caddy_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1

  python3 - "$file" "$DOMAIN" "$SLOT_HEADER_NAME" "$BLUE_SVC" "$GREEN_SVC" "$BLUE_PORT" "$GREEN_PORT" "$UPSTREAM_CONTAINER_PORT" <<'PY'
import re, sys
from pathlib import Path

file_path, domain, slot_header, blue_svc, green_svc, blue_port, green_port, upstream_port = sys.argv[1:]
text = Path(file_path).read_text(encoding="utf-8", errors="ignore")

# Domain-specific block scan first
pat = re.compile(rf'(?ms)^\s*{re.escape(domain)}\s*\{{.*?^\s*\}}\s*', re.MULTILINE)
blocks = list(pat.finditer(text))

# 1) Header-based detection
hpat = re.compile(rf'(?im)^\s*header\s+{re.escape(slot_header)}\s+(blue|green)\b')
for m in reversed(blocks):
    blk = m.group(0)
    h = hpat.search(blk)
    if h:
        print(h.group(1).lower())
        raise SystemExit(0)

# 2) Upstream-based detection in domain block
for m in reversed(blocks):
    blk = m.group(0)
    if re.search(rf'(?i)reverse_proxy\s+{re.escape(blue_svc)}:{re.escape(upstream_port)}\b', blk):
        print("blue"); raise SystemExit(0)
    if re.search(rf'(?i)reverse_proxy\s+{re.escape(green_svc)}:{re.escape(upstream_port)}\b', blk):
        print("green"); raise SystemExit(0)
    if re.search(rf'(?i)reverse_proxy\s+(127\.0\.0\.1|localhost):{re.escape(blue_port)}\b', blk):
        print("blue"); raise SystemExit(0)
    if re.search(rf'(?i)reverse_proxy\s+(127\.0\.0\.1|localhost):{re.escape(green_port)}\b', blk):
        print("green"); raise SystemExit(0)

# 3) Fallback global (best effort)
if re.search(rf'(?i)reverse_proxy\s+{re.escape(blue_svc)}:{re.escape(upstream_port)}\b', text) or \
   re.search(rf'(?i)reverse_proxy\s+(127\.0\.0\.1|localhost):{re.escape(blue_port)}\b', text):
    print("blue"); raise SystemExit(0)
if re.search(rf'(?i)reverse_proxy\s+{re.escape(green_svc)}:{re.escape(upstream_port)}\b', text) or \
   re.search(rf'(?i)reverse_proxy\s+(127\.0\.0\.1|localhost):{re.escape(green_port)}\b', text):
    print("green"); raise SystemExit(0)

print("")
PY
}

# Return: service|port|unknown
get_proxy_mode_from_file() {
  local file="$1"
  [[ -f "$file" ]] || { echo "unknown"; return 0; }

  python3 - "$file" "$DOMAIN" "$BLUE_SVC" "$GREEN_SVC" "$BLUE_PORT" "$GREEN_PORT" "$UPSTREAM_CONTAINER_PORT" <<'PY'
import re, sys
from pathlib import Path

file_path, domain, blue_svc, green_svc, blue_port, green_port, upstream_port = sys.argv[1:]
text = Path(file_path).read_text(encoding="utf-8", errors="ignore")

pat = re.compile(rf'(?ms)^\s*{re.escape(domain)}\s*\{{.*?^\s*\}}\s*', re.MULTILINE)
blocks = [m.group(0) for m in pat.finditer(text)]
scan = "\n".join(blocks) if blocks else text

if re.search(rf'(?i)reverse_proxy\s+({re.escape(blue_svc)}|{re.escape(green_svc)}):{re.escape(upstream_port)}\b', scan):
    print("service")
elif re.search(rf'(?i)reverse_proxy\s+(127\.0\.0\.1|localhost):({re.escape(blue_port)}|{re.escape(green_port)})\b', scan):
    print("port")
else:
    print("unknown")
PY
}

# In-place switch:
# - edits ONLY the target DOMAIN block
# - removes duplicate blocks for DOMAIN
# - appends one canonical DOMAIN block
switch_target_file_in_place() {
  local file="$1" _from_color="$2" to_color="$3" mode="$4"
  local upstream_to

  [[ -f "$file" ]] || return 1
  upstream_to="$(upstream_for_slot "$to_color" "$mode")"

  backup_file "$file"

  python3 - "$file" "$DOMAIN" "$to_color" "$upstream_to" "$SLOT_HEADER_NAME" <<'PY'
import re, sys
from pathlib import Path

file_path, domain, to_color, upstream_to, slot_header = sys.argv[1:]
text = Path(file_path).read_text(encoding="utf-8", errors="ignore")

# Remove all DOMAIN blocks using brace-depth parser (handles nested braces)
lines = text.splitlines(keepends=True)
out = []
i = 0
start_re = re.compile(rf'^\s*{re.escape(domain)}\s*\{{\s*$')

while i < len(lines):
    line = lines[i]
    if start_re.match(line):
        depth = line.count('{') - line.count('}')
        i += 1
        while i < len(lines) and depth > 0:
            depth += lines[i].count('{') - lines[i].count('}')
            i += 1
        # skip trailing blank lines immediately after removed block
        while i < len(lines) and lines[i].strip() == "":
            i += 1
        continue
    out.append(line)
    i += 1

text = ''.join(out).rstrip() + "\n\n"

# Append one canonical DOMAIN block
block = (
    f"{domain} {{\n"
    f"    encode zstd gzip\n"
    f"    header {slot_header} {to_color}\n"
    f"    reverse_proxy {upstream_to}\n"
    f"}}\n"
)
text += block

# In-place write (same inode)
with open(file_path, 'r+', encoding='utf-8') as f:
    f.seek(0)
    f.write(text)
    f.truncate()
PY
}

caddy_points_to_slot() {
  local file="$1" color="$2" mode="$3"
  [[ -f "$file" ]] || return 1

  local expected
  expected="$(upstream_for_slot "$color" "$mode")" || return 1

  python3 - "$file" "$DOMAIN" "$expected" <<'PY'
import re, sys
from pathlib import Path

file_path, domain, expected = sys.argv[1:]
text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
pat = re.compile(rf'(?ms)^\s*{re.escape(domain)}\s*\{{.*?^\s*\}}\s*', re.MULTILINE)
blocks = [m.group(0) for m in pat.finditer(text)]
if not blocks:
    raise SystemExit(1)
for blk in reversed(blocks):
    if re.search(rf'(?i)reverse_proxy\s+{re.escape(expected)}\b', blk):
        raise SystemExit(0)
raise SystemExit(1)
PY
}

container_publishes_443() {
  local ctn="$1"
  docker ps --format '{{.Names}}\t{{.Ports}}' \
    | awk -F'\t' -v n="$ctn" '$1==n && $2 ~ /:443->443\/tcp/ {ok=1} END{exit ok?0:1}'
}

get_caddy_container_binding_443() {
  # First running container that looks like Caddy and publishes host :443->443/tcp
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' \
    | awk -F'\t' 'tolower($0) ~ /caddy/ && $3 ~ /:443->443\/tcp/ {print $1; exit}'
}

get_caddy_container() {
  if [[ -n "$CADDY_CTN" ]] && docker ps --format '{{.Names}}' | grep -Fxq "$CADDY_CTN"; then
    echo "$CADDY_CTN"
    return 0
  fi

  local edge
  edge="$(get_caddy_container_binding_443 || true)"
  if [[ -n "$edge" ]]; then
    echo "$edge"
    return 0
  fi

  docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($0) ~ /caddy/ {print $1; exit}'
}

host_443_owned_by_docker_proxy() {
  ss -ltnp 2>/dev/null | awk '/:443[[:space:]]/ && /docker-proxy/ {found=1} END{exit found?0:1}'
}

host_443_owned_by_caddy_process() {
  ss -ltnp 2>/dev/null | awk '/:443[[:space:]]/ && /caddy/ {found=1} END{exit found?0:1}'
}

# If Caddy is containerized and Caddyfile is bind-mounted, print host source path.
get_container_caddyfile_source() {
  local ctn="$1"
  docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$ctn" 2>/dev/null || true
}

container_networks() {
  local ctn="$1"
  docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$ctn" 2>/dev/null | sed '/^[[:space:]]*$/d'
}

container_has_network() {
  local ctn="$1" net="$2"
  [[ "$(docker inspect -f "{{if index .NetworkSettings.Networks \"$net\"}}yes{{else}}no{{end}}" "$ctn" 2>/dev/null || true)" == "yes" ]]
}

ensure_caddy_connected_to_service_networks() {
  local svc="$1" ctn="$2"
  local cid net

  [[ -n "$ctn" ]] || return 0
  cid="$(compose ps -q "$svc" || true)"
  [[ -n "$cid" ]] || { err "Cannot find container id for service: $svc"; return 1; }

  while IFS= read -r net; do
    [[ -z "$net" ]] && continue
    if ! container_has_network "$ctn" "$net"; then
      log "Connecting Caddy container '$ctn' to network '$net'"
      docker network connect "$net" "$ctn" 2>/dev/null || true
    fi
  done < <(container_networks "$cid")

  return 0
}

probe_service_from_caddy_networks() {
  # Return 0 if service reachable by name from at least one network shared with caddy container.
  local svc="$1" ctn="$2"
  local cid net attempt

  cid="$(compose ps -q "$svc" || true)"
  [[ -n "$cid" ]] || return 1

  for attempt in $(seq 1 "$UPSTREAM_PROBE_RETRIES"); do
    while IFS= read -r net; do
      [[ -z "$net" ]] && continue
      container_has_network "$ctn" "$net" || continue
      if docker run --rm --network "$net" "$UPSTREAM_PROBE_IMAGE" -fsS --max-time 3 "http://${svc}:${UPSTREAM_CONTAINER_PORT}${HEALTH_PATH}" >/dev/null 2>&1; then
        return 0
      fi
    done < <(container_networks "$cid")

    sleep "$UPSTREAM_PROBE_SLEEP_SECS"
  done

  return 1
}

run_public_check_loop() {
  PUBLIC_OK=0
  PUBLIC_CODE=""
  PUBLIC_SLOT=""
  PUBLIC_HEADERS=""

  if command -v curl >/dev/null 2>&1 && [[ -n "$PUBLIC_CHECK_URL" ]]; then
    for _ in $(seq 1 "$PUBLIC_CHECK_RETRIES"); do
      PUBLIC_HEADERS="$(probe_headers "$PUBLIC_CHECK_URL")"
      PUBLIC_CODE="$(http_code_from_headers <<< "$PUBLIC_HEADERS")"
      PUBLIC_SLOT="$(slot_from_headers <<< "$PUBLIC_HEADERS")"

      if is_http_2xx_or_3xx "$PUBLIC_CODE"; then
        # If slot header is absent, still count as pass.
        if [[ -z "$PUBLIC_SLOT" || "$PUBLIC_SLOT" == "$IDLE_COLOR" ]]; then
          PUBLIC_OK=1
          break
        fi
      fi

      sleep "$PUBLIC_CHECK_SLEEP_SECS"
    done
  fi
}

write_active_marker() {
  local color="$1"
  install -d -m 700 "$(dirname "$ACTIVE_MARKER")"
  printf "%s\n" "$color" > "$ACTIVE_MARKER"
  chmod 600 "$ACTIVE_MARKER"
}

select_caddy_target_file() {
  CADDY_TARGET_FILE=""

  if [[ -n "$CADDY_RUNTIME_FILE" && -f "$CADDY_RUNTIME_FILE" ]]; then
    CADDY_TARGET_FILE="$CADDY_RUNTIME_FILE"
    return 0
  fi

  if [[ -n "$CADDY_REPO_FILE" && -f "$CADDY_REPO_FILE" ]]; then
    CADDY_TARGET_FILE="$CADDY_REPO_FILE"
    return 0
  fi

  return 1
}

detect_edge_runtime() {
  EDGE_OWNER="none"
  CADDY_RUNTIME_MODE="none"
  CADDY_RUNTIME_FILE=""
  CADDY_CONTAINER_NAME=""

  if command -v systemctl >/dev/null 2>&1; then
    SERVICE_CADDY_ACTIVE="$(systemctl is-active caddy 2>/dev/null || true)"
    [[ -z "$SERVICE_CADDY_ACTIVE" ]] && SERVICE_CADDY_ACTIVE="inactive"
  else
    SERVICE_CADDY_ACTIVE="inactive"
  fi

  local forced=""
  if [[ -n "$CADDY_CTN" ]] && docker ps --format '{{.Names}}' | grep -Fxq "$CADDY_CTN"; then
    forced="$CADDY_CTN"
  fi

  local edge_ctn=""
  if [[ -n "$forced" ]] && container_publishes_443 "$forced"; then
    edge_ctn="$forced"
  else
    edge_ctn="$(get_caddy_container_binding_443 || true)"
  fi

  # Primary detection: if :443 is docker-proxy OR a Caddy container publishes :443, edge is Docker.
  if host_443_owned_by_docker_proxy || [[ -n "$edge_ctn" ]]; then
    EDGE_OWNER="docker"
    CADDY_CONTAINER_NAME="$edge_ctn"
    if [[ -z "$CADDY_CONTAINER_NAME" ]]; then
      CADDY_CONTAINER_NAME="$(get_caddy_container || true)"
    fi
    [[ -n "$CADDY_CONTAINER_NAME" ]] || die "Detected Docker edge on :443 but could not identify Caddy container."

    local src
    src="$(get_container_caddyfile_source "$CADDY_CONTAINER_NAME")"
    if [[ -n "$src" && -f "$src" ]]; then
      CADDY_RUNTIME_MODE="container-mounted"
      CADDY_RUNTIME_FILE="$src"
    else
      CADDY_RUNTIME_MODE="container-internal"
    fi
    return 0
  fi

  # Host edge only if service is active and host process owns :443.
  if [[ "$SERVICE_CADDY_ACTIVE" == "active" ]] && host_443_owned_by_caddy_process; then
    EDGE_OWNER="host"
    CADDY_RUNTIME_MODE="host"
    if [[ -f /etc/caddy/Caddyfile ]]; then
      CADDY_RUNTIME_FILE="/etc/caddy/Caddyfile"
    fi
    return 0
  fi

  EDGE_OWNER="none"
  CADDY_RUNTIME_MODE="none"
  CADDY_RUNTIME_FILE=""
  CADDY_CONTAINER_NAME=""
  return 0
}

reload_caddy() {
  # IMPORTANT: use the Caddy that actually owns :443.
  if [[ "$EDGE_OWNER" == "docker" ]]; then
    [[ -n "$CADDY_CONTAINER_NAME" ]] || die "EDGE_OWNER=docker but CADDY_CONTAINER_NAME is empty."

    # If not bind-mounted, copy target Caddyfile into container before validate/reload.
    if [[ "$CADDY_RUNTIME_MODE" == "container-internal" || -z "$CADDY_RUNTIME_FILE" || ! -f "$CADDY_RUNTIME_FILE" ]]; then
      [[ -f "$CADDY_TARGET_FILE" ]] || die "No Caddyfile available to copy into container: $CADDY_TARGET_FILE"
      docker cp "$CADDY_TARGET_FILE" "$CADDY_CONTAINER_NAME":/etc/caddy/Caddyfile
    fi

    if [[ "$CADDY_ENABLE_FMT" == "1" ]]; then
      docker exec "$CADDY_CONTAINER_NAME" caddy fmt --overwrite /etc/caddy/Caddyfile >/dev/null 2>&1 || true
    fi

    if docker exec "$CADDY_CONTAINER_NAME" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
      && docker exec "$CADDY_CONTAINER_NAME" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
      return 0
    fi

    if [[ "$CADDY_RESTART_ON_RELOAD_FAIL" == "1" ]]; then
      err "Caddy reload failed; attempting container restart fallback."
      docker restart "$CADDY_CONTAINER_NAME" >/dev/null
      docker exec "$CADDY_CONTAINER_NAME" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
      return $?
    fi

    return 1
  fi

  if [[ "$EDGE_OWNER" == "host" ]]; then
    if [[ "$SERVICE_CADDY_ACTIVE" != "active" ]]; then
      die "Host Caddy service is not active; refusing host reload."
    fi

    if [[ "$CADDY_ENABLE_FMT" == "1" ]] && command -v caddy >/dev/null 2>&1 && [[ -f /etc/caddy/Caddyfile ]]; then
      caddy fmt --overwrite /etc/caddy/Caddyfile >/dev/null 2>&1 || true
    fi

    if [[ -f /etc/caddy/Caddyfile ]] && command -v caddy >/dev/null 2>&1; then
      caddy validate --config /etc/caddy/Caddyfile
    fi

    if systemctl reload caddy; then
      return 0
    fi

    if [[ "$CADDY_RESTART_ON_RELOAD_FAIL" == "1" ]]; then
      err "Host Caddy reload failed; attempting systemctl restart caddy fallback."
      systemctl restart caddy
      return $?
    fi

    return 1
  fi

  return 1
}

wait_idle_ready() {
  local svc="$1" host_port="$2" timeout_sec=240
  local start_ts now_ts cid health running net

  start_ts="$(date +%s)"
  while true; do
    cid="$(compose ps -q "$svc" || true)"
    if [[ -n "$cid" ]]; then
      running="$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || echo false)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)"

      if [[ "$running" == "true" && "$health" == "healthy" ]]; then
        return 0
      fi

      if [[ "$running" == "true" && "$health" == "none" ]]; then
        # Try host-port readiness first
        if command -v curl >/dev/null 2>&1; then
          if curl -fsS --max-time 2 "http://127.0.0.1:${host_port}${HEALTH_PATH}" >/dev/null 2>&1; then
            return 0
          fi
        else
          return 0
        fi

        # Fallback: internal service check over compose network
        net="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$cid" | head -n1)"
        if [[ -n "$net" ]]; then
          if docker run --rm --network "$net" "$UPSTREAM_PROBE_IMAGE" -fsS --max-time 2 "http://${svc}:${UPSTREAM_CONTAINER_PORT}${HEALTH_PATH}" >/dev/null 2>&1; then
            return 0
          fi
        fi
      fi

      if [[ "$health" == "unhealthy" ]]; then
        err "$svc is unhealthy"
        return 1
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

rollback_traffic_switch() {
  local from_color="$1" to_color="$2"

  log "Rollback traffic in Caddy from $from_color -> $to_color"
  switch_target_file_in_place "$CADDY_TARGET_FILE" "$from_color" "$to_color" "$SWITCH_MODE"

  if reload_caddy; then
    write_active_marker "$to_color"
    echo "Rollback completed. Active slot restored to: $to_color"
    return 0
  fi

  err "Rollback failed to reload Caddy."
  return 1
}

# ===== Main =====
require_cmd docker
require_cmd git
require_cmd python3
acquire_lock

[[ -d "$REPO_DIR" ]] || die "Missing repo dir: $REPO_DIR"
REPO_DIR="$(cd "$REPO_DIR" && pwd -P)"

COMPOSE_FILE="$(to_abs_under_repo "$COMPOSE_FILE")"
ENV_LOADER="$(to_abs_under_repo "$ENV_LOADER")"
if [[ -n "${CADDY_REPO_FILE:-}" ]]; then
  CADDY_REPO_FILE="$(to_abs_under_repo "$CADDY_REPO_FILE")"
fi

require_file "$COMPOSE_FILE"
require_file "$ENV_LOADER"
if [[ -n "${CADDY_REPO_FILE:-}" && ! -f "$CADDY_REPO_FILE" ]]; then
  echo "[WARN] CADDY_REPO_FILE not found now: $CADDY_REPO_FILE (runtime Caddyfile may still be used)"
fi

COMPOSE_BASE=(docker compose -f "$COMPOSE_FILE")
if [[ -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
  COMPOSE_BASE+=(-p "$COMPOSE_PROJECT_NAME")
fi

cd "$REPO_DIR"

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

log "2) Load external env"
# shellcheck source=/dev/null
. "$ENV_LOADER"
if [[ -n "${REQUIRED_ENV_KEY:-}" ]]; then
  if [[ -z "${!REQUIRED_ENV_KEY:-}" ]]; then
    die "$REQUIRED_ENV_KEY missing after loading $ENV_LOADER"
  fi
  echo "Loaded $REQUIRED_ENV_KEY=${!REQUIRED_ENV_KEY}"
fi

detect_edge_runtime
echo "Caddy edge owner: $EDGE_OWNER"
echo "Systemd caddy state: $SERVICE_CADDY_ACTIVE"
echo "Caddy mode: $CADDY_RUNTIME_MODE"
[[ -n "$CADDY_CONTAINER_NAME" ]] && echo "Caddy container: $CADDY_CONTAINER_NAME"
[[ -n "$CADDY_RUNTIME_FILE" ]] && echo "Caddy runtime file: $CADDY_RUNTIME_FILE"
echo "Public check URL: $PUBLIC_CHECK_URL"

if [[ "$EDGE_OWNER" == "none" ]]; then
  die "Could not detect active Caddy edge on :443 (docker or host)."
fi

if ! select_caddy_target_file; then
  die "No editable Caddyfile found (runtime or repo)."
fi
echo "Caddy target file (single source of truth for this run): $CADDY_TARGET_FILE"

# Determine active color in safer priority:
# 1) live public slot header, 2) marker, 3) target file, 4) repo file, 5) default blue
ACTIVE_COLOR=""
BOOT_HEADERS="$(probe_headers "$PUBLIC_CHECK_URL")"
BOOT_SLOT="$(slot_from_headers <<< "$BOOT_HEADERS")"
if [[ "$BOOT_SLOT" == "blue" || "$BOOT_SLOT" == "green" ]]; then
  ACTIVE_COLOR="$BOOT_SLOT"
fi

if [[ -z "$ACTIVE_COLOR" && -f "$ACTIVE_MARKER" ]]; then
  marker_val="$(tr -d '[:space:]' < "$ACTIVE_MARKER" || true)"
  if [[ "$marker_val" == "blue" || "$marker_val" == "green" ]]; then
    ACTIVE_COLOR="$marker_val"
  fi
fi

if [[ -z "$ACTIVE_COLOR" ]]; then
  ACTIVE_COLOR="$(get_active_from_caddy_file "$CADDY_TARGET_FILE" 2>/dev/null || true)"
fi
if [[ -z "$ACTIVE_COLOR" && -n "${CADDY_REPO_FILE:-}" ]]; then
  ACTIVE_COLOR="$(get_active_from_caddy_file "$CADDY_REPO_FILE" 2>/dev/null || true)"
fi
if [[ -z "$ACTIVE_COLOR" ]]; then
  ACTIVE_COLOR="blue"
fi

if [[ "$ACTIVE_COLOR" == "blue" ]]; then
  IDLE_COLOR="green"
  ACTIVE_SVC="$BLUE_SVC";  IDLE_SVC="$GREEN_SVC"
  ACTIVE_PORT="$BLUE_PORT"; IDLE_PORT="$GREEN_PORT"
else
  IDLE_COLOR="blue"
  ACTIVE_SVC="$GREEN_SVC"; IDLE_SVC="$BLUE_SVC"
  ACTIVE_PORT="$GREEN_PORT"; IDLE_PORT="$BLUE_PORT"
fi

echo "Active slot: $ACTIVE_COLOR ($ACTIVE_SVC:$ACTIVE_PORT)"
echo "Deploy slot: $IDLE_COLOR ($IDLE_SVC:$IDLE_PORT)"

log "3) Build + start idle slot only"
compose up -d --build --no-deps "$IDLE_SVC"

log "4) Wait idle slot ready"
wait_idle_ready "$IDLE_SVC" "$IDLE_PORT"

# Determine switch mode from target file first.
SWITCH_MODE="$(get_proxy_mode_from_file "$CADDY_TARGET_FILE")"
if [[ "$SWITCH_MODE" == "unknown" && -n "${CADDY_REPO_FILE:-}" ]]; then
  SWITCH_MODE="$(get_proxy_mode_from_file "$CADDY_REPO_FILE")"
fi

# Safe defaults if unknown.
if [[ "$SWITCH_MODE" == "unknown" ]]; then
  if [[ "$EDGE_OWNER" == "docker" ]]; then
    SWITCH_MODE="service"
  else
    SWITCH_MODE="port"
  fi
fi

# Critical safety: host Caddy cannot resolve Docker service names.
if [[ "$EDGE_OWNER" == "host" && "$SWITCH_MODE" == "service" ]]; then
  err "Host Caddy + service-name upstream detected. Forcing port mode to avoid 502."
  SWITCH_MODE="port"
fi

echo "Caddy switch mode: $SWITCH_MODE"

log "5) Ensure Caddy can reach idle slot (service mode only)"
if [[ "$SWITCH_MODE" == "service" ]]; then
  if [[ "$EDGE_OWNER" == "docker" && -n "$CADDY_CONTAINER_NAME" ]]; then
    ensure_caddy_connected_to_service_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME"
    if ! probe_service_from_caddy_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME"; then
      err "Caddy network probe failed: cannot reach http://${IDLE_SVC}:${UPSTREAM_CONTAINER_PORT}${HEALTH_PATH} from shared Docker networks."
      echo "Diagnostics (copy/paste):"
      echo "  docker inspect '$CADDY_CONTAINER_NAME' --format '{{json .NetworkSettings.Networks}}' | jq"
      echo "  docker compose -f '$COMPOSE_FILE' ps"
      echo "  docker inspect \$(docker compose -f '$COMPOSE_FILE' ps -q '$IDLE_SVC') --format '{{json .NetworkSettings.Networks}}' | jq"
      die "Aborting before traffic switch to avoid public 502."
    fi
  else
    die "Service mode requires Docker edge Caddy container, but detection did not find one."
  fi
fi

log "6) Switch traffic in Caddy from $ACTIVE_COLOR -> $IDLE_COLOR (domain-scoped, in-place)"
echo "Updating: $CADDY_TARGET_FILE"
switch_target_file_in_place "$CADDY_TARGET_FILE" "$ACTIVE_COLOR" "$IDLE_COLOR" "$SWITCH_MODE"

if reload_caddy; then
  echo "Traffic switched to $IDLE_COLOR slot."
else
  die "Could not reload edge Caddy. Backups kept as .bak.<timestamp>."
fi

log "7) Verify status"

# 7a) Local direct slot check (required)
LOCAL_IDLE_OK=0
if command -v curl >/dev/null 2>&1; then
  local_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "http://127.0.0.1:${IDLE_PORT}${HEALTH_PATH}" || true)"
  if is_http_2xx_or_3xx "$local_code"; then
    LOCAL_IDLE_OK=1
  fi
else
  err "curl not found; local slot check skipped"
fi

# 7b) Caddy target file check
CADDY_TARGET_OK=0
if caddy_points_to_slot "$CADDY_TARGET_FILE" "$IDLE_COLOR" "$SWITCH_MODE"; then
  CADDY_TARGET_OK=1
fi

# 7c) Public HTTPS check (required)
run_public_check_loop

# 7d) Auto-remedy for common 502 case in containerized Caddy service-mode
if [[ "$PUBLIC_OK" -ne 1 && "$AUTO_REMEDY_502" == "1" && "$SWITCH_MODE" == "service" && "$EDGE_OWNER" == "docker" && -n "$CADDY_CONTAINER_NAME" && "$PUBLIC_CODE" == "502" ]]; then
  log "7d) Auto-remedy: reconnect Caddy to idle service network(s), reload, and re-check public endpoint"
  ensure_caddy_connected_to_service_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME" || true
  if probe_service_from_caddy_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME"; then
    reload_caddy || true
    run_public_check_loop
  else
    err "Auto-remedy probe failed: ${IDLE_SVC}:${UPSTREAM_CONTAINER_PORT} still unreachable from Caddy network context."
  fi
fi

echo ""
echo "Verification summary:"
printf "  - Idle slot local (127.0.0.1:%s): %s\n" "$IDLE_PORT" "$( [[ "$LOCAL_IDLE_OK" -eq 1 ]] && echo PASS || echo FAIL )"
printf "  - Caddy target file              : %s (expects %s)\n" "$( [[ "$CADDY_TARGET_OK" -eq 1 ]] && echo PASS || echo FAIL )" "$IDLE_COLOR"
printf "  - Public HTTPS (%s)  : %s (code=%s slot=%s)\n" "$PUBLIC_CHECK_URL" "$( [[ "$PUBLIC_OK" -eq 1 ]] && echo PASS || echo FAIL )" "${PUBLIC_CODE:-n/a}" "${PUBLIC_SLOT:-none}"

# Decide marker + rollback behavior
FINAL_ACTIVE_COLOR="$IDLE_COLOR"
FINAL_PREV_COLOR="$ACTIVE_COLOR"

if [[ "$LOCAL_IDLE_OK" -eq 1 && "$PUBLIC_OK" -eq 1 ]]; then
  echo "Deployment verified: local slot and public HTTPS are both healthy."
else
  err "Deployment switch done, but verification failed."
  [[ -n "${PUBLIC_HEADERS:-}" ]] && { echo "--- Public headers ---"; echo "$PUBLIC_HEADERS" | sed -n '1,30p'; }

  echo "Diagnostics (copy/paste):"
  echo "  curl -sS -o /dev/null -w 'idle slot HTTP %{http_code}\n' http://127.0.0.1:${IDLE_PORT}${HEALTH_PATH}"
  echo "  curl -ksSI '${PUBLIC_CHECK_URL}' | sed -n '1,30p'"
  [[ -n "$CADDY_CONTAINER_NAME" ]] && echo "  docker logs --tail=120 '$CADDY_CONTAINER_NAME'"

  if [[ "$AUTO_ROLLBACK_ON_VERIFY_FAIL" == "1" ]]; then
    err "AUTO_ROLLBACK_ON_VERIFY_FAIL=1 -> reverting traffic to $ACTIVE_COLOR"
    if rollback_traffic_switch "$IDLE_COLOR" "$ACTIVE_COLOR"; then
      FINAL_ACTIVE_COLOR="$ACTIVE_COLOR"
      FINAL_PREV_COLOR="$IDLE_COLOR"
      die "Rolled back due to failed verification."
    else
      die "Verification failed and rollback failed. Manual intervention required."
    fi
  fi
fi

# Persist active marker only after final decision
write_active_marker "$FINAL_ACTIVE_COLOR"

log "8) Final status"
compose ps
echo "Active slot is now: $FINAL_ACTIVE_COLOR"
echo "Previous slot kept running for rollback: $FINAL_PREV_COLOR"
