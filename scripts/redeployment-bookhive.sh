#!/usr/bin/env bash
set -Eeuo pipefail

# ===== Config (override via env vars if needed) =====
REPO_DIR="${REPO_DIR:-$HOME/book-hive}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.frontend.yml}"
ENV_LOADER="${ENV_LOADER:-scripts/load-external-env.sh}"
CADDY_REPO_FILE="${CADDY_REPO_FILE:-infra/Caddyfile}"
ACTIVE_MARKER="${ACTIVE_MARKER:-/opt/bookhive-env/bookhive.active}"
DOMAIN="${DOMAIN:-bookhive.jrmsu-tc.cloud}"
CADDY_CTN="${CADDY_CTN:-}"   # optional: force container name (e.g. workloadhub_caddy_1002)
PUBLIC_CHECK_RETRIES="${PUBLIC_CHECK_RETRIES:-30}"
PUBLIC_CHECK_SLEEP_SECS="${PUBLIC_CHECK_SLEEP_SECS:-2}"

BLUE_SVC="bookhive-blue"
GREEN_SVC="bookhive-green"
BLUE_PORT="18081"
GREEN_PORT="18082"

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

get_caddy_container() {
  if [[ -n "$CADDY_CTN" ]]; then
    if docker ps --format '{{.Names}}' | grep -Fxq "$CADDY_CTN"; then
      echo "$CADDY_CTN"
      return 0
    fi
    return 1
  fi

  docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /caddy/ {print $1; exit}'
}

# If Caddy is containerized and Caddyfile is bind-mounted, print host source path.
get_container_caddyfile_source() {
  local ctn="$1"
  docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$ctn" 2>/dev/null || true
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

reload_caddy() {
  local runtime_file="$1"
  local ctn

  # Host Caddy service first
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy; then
    if [[ -f /etc/caddy/Caddyfile ]] && command -v caddy >/dev/null 2>&1; then
      caddy validate --config /etc/caddy/Caddyfile
    fi
    systemctl reload caddy
    return 0
  fi

  # Container Caddy fallback
  ctn="$(get_caddy_container || true)"
  if [[ -n "$ctn" ]]; then
    # If not bind-mounted, push repo file into container before reload.
    if [[ -z "$runtime_file" || ! -f "$runtime_file" ]]; then
      [[ -f "$CADDY_REPO_FILE" ]] || die "No Caddyfile to copy into container."
      docker cp "$CADDY_REPO_FILE" "$ctn":/etc/caddy/Caddyfile
    fi

    docker exec "$ctn" caddy validate --config /etc/caddy/Caddyfile
    docker exec "$ctn" caddy reload --config /etc/caddy/Caddyfile
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
          if docker run --rm --network "$net" curlimages/curl:8.11.1 -fsS --max-time 2 "http://${svc}:8080/" >/dev/null 2>&1; then
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

ensure_caddy_on_idle_network_if_needed() {
  local idle_svc="$1"
  local ctn="$2"
  local mode="$3"
  local cid net

  [[ "$mode" == "service" || "$mode" == "unknown" ]] || return 0
  [[ -n "$ctn" ]] || return 0

  cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$idle_svc" || true)"
  [[ -n "$cid" ]] || return 0

  net="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$cid" | head -n1)"
  [[ -n "$net" ]] || return 0

  docker network connect "$net" "$ctn" 2>/dev/null || true
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

# Detect runtime Caddy context (host service or container)
CADDY_RUNTIME_FILE=""
CADDY_RUNTIME_MODE="none"  # host|container-mounted|container-internal|none
CADDY_CONTAINER_NAME=""

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy && [[ -f /etc/caddy/Caddyfile ]]; then
  CADDY_RUNTIME_MODE="host"
  CADDY_RUNTIME_FILE="/etc/caddy/Caddyfile"
else
  CADDY_CONTAINER_NAME="$(get_caddy_container || true)"
  if [[ -n "$CADDY_CONTAINER_NAME" ]]; then
    src="$(get_container_caddyfile_source "$CADDY_CONTAINER_NAME")"
    if [[ -n "$src" && -f "$src" ]]; then
      CADDY_RUNTIME_MODE="container-mounted"
      CADDY_RUNTIME_FILE="$src"
    else
      CADDY_RUNTIME_MODE="container-internal"
    fi
  fi
fi

echo "Caddy mode: $CADDY_RUNTIME_MODE"
[[ -n "$CADDY_CONTAINER_NAME" ]] && echo "Caddy container: $CADDY_CONTAINER_NAME"
[[ -n "$CADDY_RUNTIME_FILE" ]] && echo "Caddy runtime file: $CADDY_RUNTIME_FILE"

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
ensure_caddy_on_idle_network_if_needed "$IDLE_SVC" "$CADDY_CONTAINER_NAME" "$SWITCH_MODE"

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

if reload_caddy "$CADDY_RUNTIME_FILE"; then
  echo "Traffic switched to $IDLE_COLOR slot."
else
  die "Could not reload Caddy. Your Caddyfile backups were kept with .bak.<timestamp>."
fi

install -d -m 700 "$(dirname "$ACTIVE_MARKER")"
printf "%s\n" "$IDLE_COLOR" > "$ACTIVE_MARKER"
chmod 600 "$ACTIVE_MARKER"

log "7) Verify public + runtime status"

# 7a) Local direct slot check (idle target)
LOCAL_IDLE_OK=0
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 4 "http://127.0.0.1:${IDLE_PORT}/" >/dev/null 2>&1; then
    LOCAL_IDLE_OK=1
  fi
fi

# 7b) Runtime Caddy target check
CADDY_TARGET_OK=0
for target in "${CADDY_TARGET_FILES[@]}"; do
  if caddy_points_to_slot "$target" "$IDLE_COLOR"; then
    CADDY_TARGET_OK=1
    break
  fi
done

# 7c) Public DNS path check
PUBLIC_OK=0
PUBLIC_CODE=""
PUBLIC_SLOT=""
PUBLIC_HEADERS=""

if command -v curl >/dev/null 2>&1 && [[ -n "$DOMAIN" ]]; then
  for _ in $(seq 1 "$PUBLIC_CHECK_RETRIES"); do
    PUBLIC_HEADERS="$(probe_headers "https://${DOMAIN}/")"
    PUBLIC_CODE="$(http_code_from_headers <<< "$PUBLIC_HEADERS")"
    PUBLIC_SLOT="$(slot_from_headers <<< "$PUBLIC_HEADERS")"

    if is_http_2xx_or_3xx "$PUBLIC_CODE"; then
      if [[ -z "$PUBLIC_SLOT" || "$PUBLIC_SLOT" == "$IDLE_COLOR" ]]; then
        PUBLIC_OK=1
        break
      fi
    fi

    sleep "$PUBLIC_CHECK_SLEEP_SECS"
  done
fi

# 7d) Local ingress check via forced host mapping (bypasses external DNS path)
LOCAL_INGRESS_TESTED=0
LOCAL_INGRESS_OK=0
LOCAL_INGRESS_CODE=""
LOCAL_INGRESS_SLOT=""
LOCAL_INGRESS_HEADERS=""

if command -v curl >/dev/null 2>&1 && [[ -n "$DOMAIN" ]]; then
  LOCAL_INGRESS_TESTED=1
  LOCAL_INGRESS_HEADERS="$(probe_headers "https://${DOMAIN}/" --resolve "${DOMAIN}:443:127.0.0.1")"
  LOCAL_INGRESS_CODE="$(http_code_from_headers <<< "$LOCAL_INGRESS_HEADERS")"
  LOCAL_INGRESS_SLOT="$(slot_from_headers <<< "$LOCAL_INGRESS_HEADERS")"

  if is_http_2xx_or_3xx "$LOCAL_INGRESS_CODE"; then
    if [[ -z "$LOCAL_INGRESS_SLOT" || "$LOCAL_INGRESS_SLOT" == "$IDLE_COLOR" ]]; then
      LOCAL_INGRESS_OK=1
    fi
  fi
fi

echo ""
echo "Verification summary:"
printf "  - Idle slot local     : %s (%s:%s)\n" "$( [[ "$LOCAL_IDLE_OK" -eq 1 ]] && echo PASS || echo FAIL )" "$IDLE_SVC" "$IDLE_PORT"
printf "  - Caddy target file   : %s (expects %s)\n" "$( [[ "$CADDY_TARGET_OK" -eq 1 ]] && echo PASS || echo FAIL )" "$IDLE_COLOR"
printf "  - Public HTTPS        : %s (code=%s slot=%s)\n" "$( [[ "$PUBLIC_OK" -eq 1 ]] && echo PASS || echo FAIL )" "${PUBLIC_CODE:-n/a}" "${PUBLIC_SLOT:-none}"
if [[ "$LOCAL_INGRESS_TESTED" -eq 1 ]]; then
  printf "  - Local ingress(443)  : %s (code=%s slot=%s)\n" "$( [[ "$LOCAL_INGRESS_OK" -eq 1 ]] && echo PASS || echo FAIL )" "${LOCAL_INGRESS_CODE:-n/a}" "${LOCAL_INGRESS_SLOT:-none}"
else
  printf "  - Local ingress(443)  : SKIP\n"
fi

if [[ "$PUBLIC_OK" -eq 1 ]]; then
  echo "Public live status confirmed for https://${DOMAIN}"
elif [[ "$LOCAL_IDLE_OK" -eq 1 && "$CADDY_TARGET_OK" -eq 1 && ( "$LOCAL_INGRESS_TESTED" -eq 0 || "$LOCAL_INGRESS_OK" -eq 1 ) ]]; then
  err "Public DNS/edge path not confirmed yet, but switch is confirmed internally."
  echo "Diagnostics (copy/paste):"
  echo "  curl -ksSI https://${DOMAIN} | sed -n '1,30p'"
  echo "  curl -ksS -o /dev/null -w 'HTTP %{http_code}\n' https://${DOMAIN}"
  echo "  curl -sSI http://127.0.0.1:${IDLE_PORT} | sed -n '1,10p'"
  if [[ -n "$CADDY_RUNTIME_FILE" ]]; then
    echo "  grep -nE 'bookhive.jrmsu-tc.cloud|reverse_proxy|18081|18082|bookhive-blue|bookhive-green' '$CADDY_RUNTIME_FILE'"
  else
    echo "  grep -nE 'bookhive.jrmsu-tc.cloud|reverse_proxy|18081|18082|bookhive-blue|bookhive-green' '$CADDY_REPO_FILE'"
  fi
else
  err "Deployment switch done, but verification failed. Review diagnostics below."
  [[ -n "$PUBLIC_HEADERS" ]] && { echo "--- Public headers ---"; echo "$PUBLIC_HEADERS" | sed -n '1,30p'; }
  [[ -n "$LOCAL_INGRESS_HEADERS" ]] && { echo "--- Local ingress headers ---"; echo "$LOCAL_INGRESS_HEADERS" | sed -n '1,30p'; }
fi

log "8) Final status"
docker compose -f "$COMPOSE_FILE" ps
echo "Active slot is now: $IDLE_COLOR"
echo "Previous slot kept running for rollback: $ACTIVE_COLOR"
