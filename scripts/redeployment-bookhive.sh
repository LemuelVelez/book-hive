#!/usr/bin/env bash
set -Eeuo pipefail

# ===== Config (override via env vars if needed) =====
REPO_DIR="${REPO_DIR:-$HOME/book-hive}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.frontend.yml}"
ENV_LOADER="${ENV_LOADER:-scripts/load-external-env.sh}"
CADDY_REPO_FILE="${CADDY_REPO_FILE:-infra/Caddyfile}"
ACTIVE_MARKER="${ACTIVE_MARKER:-/opt/bookhive-env/bookhive.active}"
DOMAIN="${DOMAIN:-bookhive.jrmsu-tc.cloud}"
PUBLIC_CHECK_URL="${PUBLIC_CHECK_URL:-https://${DOMAIN}}"
CADDY_CTN="${CADDY_CTN:-}"   # optional preferred Caddy container name

PUBLIC_CHECK_RETRIES="${PUBLIC_CHECK_RETRIES:-30}"
PUBLIC_CHECK_SLEEP_SECS="${PUBLIC_CHECK_SLEEP_SECS:-2}"

UPSTREAM_PROBE_IMAGE="${UPSTREAM_PROBE_IMAGE:-curlimages/curl:8.11.1}"
UPSTREAM_PROBE_RETRIES="${UPSTREAM_PROBE_RETRIES:-8}"
UPSTREAM_PROBE_SLEEP_SECS="${UPSTREAM_PROBE_SLEEP_SECS:-2}"

AUTO_REMEDY_502="${AUTO_REMEDY_502:-1}"                  # 1=try auto network fix + reload on 502
AUTO_ROLLBACK_ON_VERIFY_FAIL="${AUTO_ROLLBACK_ON_VERIFY_FAIL:-0}"  # 1=rollback Caddy target if verify fails

BLUE_SVC="bookhive-blue"
GREEN_SVC="bookhive-green"
BLUE_PORT="18081"
GREEN_PORT="18082"

EDGE_OWNER="none"               # docker|host|none
SERVICE_CADDY_ACTIVE="inactive" # active|inactive|failed|...
CADDY_RUNTIME_MODE="none"       # host|container-mounted|container-internal|none
CADDY_RUNTIME_FILE=""           # path to editable runtime Caddyfile (if available)
CADDY_CONTAINER_NAME=""         # edge Caddy container (when EDGE_OWNER=docker)

log(){ printf "\n[%s] %s\n" "$(date '+%F %T')" "$*"; }
err(){ printf "\n[ERROR] %s\n" "$*" >&2; }
die(){ err "$*"; exit 1; }

require_file() {
  local f="$1"
  [[ -f "$f" ]] || die "Missing file: $f"
}

is_http_2xx_or_3xx() {
  [[ "${1:-}" =~ ^[23][0-9][0-9]$ ]]
}

http_code_from_headers() {
  awk 'toupper($1) ~ /^HTTP\// {code=$2} END{print code}'
}

slot_from_headers() {
  awk -F': ' 'tolower($1)=="x-bookhive-slot"{gsub("\r","",$2); slot=tolower($2)} END{print slot}'
}

probe_headers() {
  # Usage: probe_headers "https://example.com/" [extra curl args...]
  local url="$1"; shift || true
  curl -ksSIL --connect-timeout 5 --max-time 12 "$@" "$url" 2>/dev/null || true
}

# Return: blue|green|""
get_active_from_caddy_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1

  if grep -Eqi 'reverse_proxy[[:space:]]+bookhive-blue:8080\b' "$file"; then
    echo "blue"; return 0
  fi
  if grep -Eqi 'reverse_proxy[[:space:]]+bookhive-green:8080\b' "$file"; then
    echo "green"; return 0
  fi
  if grep -Eqi 'reverse_proxy[[:space:]]+(127\.0\.0\.1|localhost):18081\b' "$file"; then
    echo "blue"; return 0
  fi
  if grep -Eqi 'reverse_proxy[[:space:]]+(127\.0\.0\.1|localhost):18082\b' "$file"; then
    echo "green"; return 0
  fi

  return 1
}

# Return: service|port|unknown
get_proxy_mode_from_file() {
  local file="$1"
  [[ -f "$file" ]] || { echo "unknown"; return 0; }

  if grep -Eqi 'reverse_proxy[[:space:]]+bookhive-(blue|green):8080\b' "$file"; then
    echo "service"
    return 0
  fi
  if grep -Eqi 'reverse_proxy[[:space:]]+(127\.0\.0\.1|localhost):(18081|18082)\b' "$file"; then
    echo "port"
    return 0
  fi
  echo "unknown"
}

backup_file() {
  local f="$1"
  cp -a "$f" "${f}.bak.$(date +%F-%H%M%S)"
}

caddy_points_to_slot() {
  local file="$1" color="$2" mode expected_port
  [[ -f "$file" ]] || return 1

  mode="$(get_proxy_mode_from_file "$file")"
  case "$color" in
    blue)  expected_port="$BLUE_PORT" ;;
    green) expected_port="$GREEN_PORT" ;;
    *) return 1 ;;
  esac

  if [[ "$mode" == "service" ]]; then
    grep -Eqi "reverse_proxy[[:space:]]+bookhive-${color}:8080\\b" "$file"
    return $?
  fi

  if [[ "$mode" == "port" ]]; then
    grep -Eqi "reverse_proxy[[:space:]]+(127\\.0\\.0\\.1|localhost):${expected_port}\\b" "$file"
    return $?
  fi

  return 1
}

# switch_target_file <file> <from_color> <to_color>
switch_target_file() {
  local file="$1" from_color="$2" to_color="$3"
  local mode from_port to_port tmp
  [[ -f "$file" ]] || return 1

  mode="$(get_proxy_mode_from_file "$file")"
  case "$from_color" in
    blue)  from_port="$BLUE_PORT";  to_port="$GREEN_PORT" ;;
    green) from_port="$GREEN_PORT"; to_port="$BLUE_PORT"  ;;
    *) return 1 ;;
  esac

  tmp="${file}.tmp"
  backup_file "$file"

  if [[ "$mode" == "service" ]]; then
    # Swap only BookHive service upstream targets.
    sed -E "s#(reverse_proxy[[:space:]]+)bookhive-${from_color}(:8080\\b)#\\1bookhive-${to_color}\\2#g" "$file" > "$tmp"
  elif [[ "$mode" == "port" ]]; then
    # Swap localhost/127.0.0.1 upstream port targets.
    sed -E "s#(reverse_proxy[[:space:]]+(127\\.0\\.0\\.1|localhost):)${from_port}(\\b)#\\1${to_port}\\3#g" "$file" > "$tmp"
  else
    # Self-heal: append a BookHive domain block using service-based upstream.
    cat "$file" > "$tmp"
    {
      printf "\n%s {\n" "$DOMAIN"
      printf "    header X-BookHive-Slot %s\n" "$to_color"
      printf "    reverse_proxy bookhive-%s:8080\n" "$to_color"
      printf "}\n"
    } >> "$tmp"
  fi

  mv "$tmp" "$file"
  return 0
}

container_publishes_443() {
  local ctn="$1"
  docker ps --format '{{.Names}}\t{{.Ports}}' \
    | awk -F'\t' -v n="$ctn" '$1==n && $2 ~ /:443->443\/tcp/ {ok=1} END{exit ok?0:1}'
}

get_caddy_container_binding_443() {
  # Returns the first running container that looks like Caddy and publishes host :443->443/tcp
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' \
    | awk -F'\t' 'tolower($0) ~ /caddy/ && $3 ~ /:443->443\/tcp/ {print $1; exit}'
}

get_caddy_container() {
  if [[ -n "$CADDY_CTN" ]] && docker ps --format '{{.Names}}' | grep -Fxq "$CADDY_CTN"; then
    echo "$CADDY_CTN"
    return 0
  fi

  # Prefer the edge container actually publishing :443
  local edge
  edge="$(get_caddy_container_binding_443 || true)"
  if [[ -n "$edge" ]]; then
    echo "$edge"
    return 0
  fi

  # Last resort: first running container that looks like caddy
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
  cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" || true)"
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

  cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" || true)"
  [[ -n "$cid" ]] || return 1

  for attempt in $(seq 1 "$UPSTREAM_PROBE_RETRIES"); do
    while IFS= read -r net; do
      [[ -z "$net" ]] && continue
      container_has_network "$ctn" "$net" || continue
      if docker run --rm --network "$net" "$UPSTREAM_PROBE_IMAGE" -fsS --max-time 3 "http://${svc}:8080/" >/dev/null 2>&1; then
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
        # If slot header is absent, still count as pass (some edge hosts won't expose it).
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

# Build a unique list of target files to edit (runtime first, then repo file).
build_caddy_target_files() {
  local runtime_file="$1"
  local -n out_ref=$2
  out_ref=()

  if [[ -n "$runtime_file" && -f "$runtime_file" ]]; then
    out_ref+=("$runtime_file")
  fi

  if [[ -f "$CADDY_REPO_FILE" ]]; then
    local exists=0
    for f in "${out_ref[@]}"; do
      [[ "$f" == "$CADDY_REPO_FILE" ]] && exists=1 && break
    done
    [[ "$exists" -eq 0 ]] && out_ref+=("$CADDY_REPO_FILE")
  fi
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
      # Fallback to any running caddy-like container (for unusual setups)
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

    # If not bind-mounted, copy repo Caddyfile into container before validate/reload.
    if [[ "$CADDY_RUNTIME_MODE" == "container-internal" || -z "$CADDY_RUNTIME_FILE" || ! -f "$CADDY_RUNTIME_FILE" ]]; then
      [[ -f "$CADDY_REPO_FILE" ]] || die "No Caddyfile available to copy into container: $CADDY_REPO_FILE"
      docker cp "$CADDY_REPO_FILE" "$CADDY_CONTAINER_NAME":/etc/caddy/Caddyfile
    fi

    docker exec "$CADDY_CONTAINER_NAME" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    docker exec "$CADDY_CONTAINER_NAME" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    return 0
  fi

  if [[ "$EDGE_OWNER" == "host" ]]; then
    # Skip /etc/caddy checks when service is inactive (handled by EDGE_OWNER detection).
    if [[ "$SERVICE_CADDY_ACTIVE" != "active" ]]; then
      die "Host Caddy service is not active; refusing host reload."
    fi

    if [[ -f /etc/caddy/Caddyfile ]] && command -v caddy >/dev/null 2>&1; then
      caddy validate --config /etc/caddy/Caddyfile
    fi
    systemctl reload caddy
    return 0
  fi

  return 1
}

wait_idle_ready() {
  local svc="$1" host_port="$2" timeout_sec=240
  local start_ts now_ts cid health running net

  start_ts="$(date +%s)"
  while true; do
    cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" || true)"
    if [[ -n "$cid" ]]; then
      running="$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || echo false)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)"

      if [[ "$running" == "true" && "$health" == "healthy" ]]; then
        return 0
      fi

      if [[ "$running" == "true" && "$health" == "none" ]]; then
        # Try host-port readiness first
        if command -v curl >/dev/null 2>&1; then
          if curl -fsS --max-time 2 "http://127.0.0.1:${host_port}/" >/dev/null 2>&1; then
            return 0
          fi
        else
          # No curl on host: best effort when container is running
          return 0
        fi

        # Fallback: internal service check over compose network
        net="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$cid" | head -n1)"
        if [[ -n "$net" ]]; then
          if docker run --rm --network "$net" "$UPSTREAM_PROBE_IMAGE" -fsS --max-time 2 "http://${svc}:8080/" >/dev/null 2>&1; then
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
  local target

  log "Rollback traffic in Caddy from $from_color -> $to_color"
  for target in "${CADDY_TARGET_FILES[@]}"; do
    echo "Reverting: $target"
    switch_target_file "$target" "$from_color" "$to_color"
  done

  if reload_caddy; then
    write_active_marker "$to_color"
    echo "Rollback completed. Active slot restored to: $to_color"
    return 0
  fi

  err "Rollback failed to reload Caddy."
  return 1
}

# ===== Main =====
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

ACTIVE_COLOR=""
if [[ -f "$ACTIVE_MARKER" ]]; then
  marker_val="$(tr -d '[:space:]' < "$ACTIVE_MARKER" || true)"
  if [[ "$marker_val" == "blue" || "$marker_val" == "green" ]]; then
    ACTIVE_COLOR="$marker_val"
  fi
fi

if [[ -z "$ACTIVE_COLOR" && -n "$CADDY_RUNTIME_FILE" ]]; then
  ACTIVE_COLOR="$(get_active_from_caddy_file "$CADDY_RUNTIME_FILE" 2>/dev/null || true)"
fi
if [[ -z "$ACTIVE_COLOR" ]]; then
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
docker compose -f "$COMPOSE_FILE" up -d --build --no-deps "$IDLE_SVC"

log "4) Wait idle slot ready"
wait_idle_ready "$IDLE_SVC" "$IDLE_PORT"

# Determine switch mode from runtime file first, else repo file.
SWITCH_MODE="unknown"
if [[ -n "$CADDY_RUNTIME_FILE" ]]; then
  SWITCH_MODE="$(get_proxy_mode_from_file "$CADDY_RUNTIME_FILE")"
fi
if [[ "$SWITCH_MODE" == "unknown" ]]; then
  SWITCH_MODE="$(get_proxy_mode_from_file "$CADDY_REPO_FILE")"
fi
echo "Caddy switch mode: $SWITCH_MODE"

log "5) Ensure Caddy can reach idle slot (service mode only)"
if [[ "$SWITCH_MODE" == "service" ]]; then
  if [[ "$EDGE_OWNER" == "host" ]]; then
    die "Detected host Caddy + service upstream mode. This causes 502 because host Caddy can't resolve Docker service names. Use port mode upstream (127.0.0.1:18081/18082) for host Caddy."
  fi

  if [[ "$EDGE_OWNER" == "docker" && -n "$CADDY_CONTAINER_NAME" ]]; then
    ensure_caddy_connected_to_service_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME"
    if ! probe_service_from_caddy_networks "$IDLE_SVC" "$CADDY_CONTAINER_NAME"; then
      err "Caddy network probe failed: cannot reach http://${IDLE_SVC}:8080 from shared Docker networks."
      echo "Diagnostics (copy/paste):"
      echo "  docker inspect '$CADDY_CONTAINER_NAME' --format '{{json .NetworkSettings.Networks}}' | jq"
      echo "  docker compose -f '$COMPOSE_FILE' ps"
      echo "  docker inspect \$(docker compose -f '$COMPOSE_FILE' ps -q '$IDLE_SVC') --format '{{json .NetworkSettings.Networks}}' | jq"
      die "Aborting before traffic switch to avoid public 502."
    fi
  fi
fi

log "6) Switch traffic in Caddy from $ACTIVE_COLOR -> $IDLE_COLOR"
CADDY_TARGET_FILES=()
build_caddy_target_files "$CADDY_RUNTIME_FILE" CADDY_TARGET_FILES

if [[ "${#CADDY_TARGET_FILES[@]}" -eq 0 ]]; then
  die "No Caddyfile target found (runtime or repo)."
fi

for target in "${CADDY_TARGET_FILES[@]}"; do
  echo "Updating: $target"
  switch_target_file "$target" "$ACTIVE_COLOR" "$IDLE_COLOR"
done

if reload_caddy; then
  echo "Traffic switched to $IDLE_COLOR slot."
else
  die "Could not reload edge Caddy. Backups were kept as .bak.<timestamp>."
fi

log "7) Verify status"

# 7a) Local direct slot check (required)
LOCAL_IDLE_OK=0
if command -v curl >/dev/null 2>&1; then
  local_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "http://127.0.0.1:${IDLE_PORT}/" || true)"
  if is_http_2xx_or_3xx "$local_code"; then
    LOCAL_IDLE_OK=1
  fi
else
  err "curl not found; local slot check skipped"
fi

# 7b) Runtime Caddy target check
CADDY_TARGET_OK=0
for target in "${CADDY_TARGET_FILES[@]}"; do
  if caddy_points_to_slot "$target" "$IDLE_COLOR"; then
    CADDY_TARGET_OK=1
    break
  fi
done

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
    err "Auto-remedy probe failed: ${IDLE_SVC}:8080 still unreachable from Caddy network context."
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
  [[ -n "$PUBLIC_HEADERS" ]] && { echo "--- Public headers ---"; echo "$PUBLIC_HEADERS" | sed -n '1,30p'; }

  echo "Diagnostics (copy/paste):"
  echo "  curl -sS -o /dev/null -w 'idle slot HTTP %{http_code}\n' http://127.0.0.1:${IDLE_PORT}/"
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
docker compose -f "$COMPOSE_FILE" ps
echo "Active slot is now: $FINAL_ACTIVE_COLOR"
echo "Previous slot kept running for rollback: $FINAL_PREV_COLOR"
