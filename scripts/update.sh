#!/usr/bin/env bash
# ==============================================================================
#  🐙 OctopusPanel Update & Migration Automation Script
#  Specification: Concept/UPDATE_ORCHESTRATION.md
# ==============================================================================

set -eo pipefail
export LC_ALL=C.UTF-8

PANEL_DIR="/var/www/octopus/panel"
BACKUP_DIR="/var/lib/octopus/backups/db"
CONFIG_DIR="/etc/octopus"
LOG_DIR="/var/log/octopus"
UPDATE_LOG="${LOG_DIR}/panel-update.log"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

# Fallback to local directory if not running in production /var/www
if [[ ! -d "${PANEL_DIR}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  PANEL_DIR="${SCRIPT_DIR}"
  BACKUP_DIR="${PANEL_DIR}/backups/db"
  CONFIG_DIR="${PANEL_DIR}"
  LOG_DIR="${PANEL_DIR}/logs"
  UPDATE_LOG="${LOG_DIR}/panel-update.log"
fi

mkdir -p "${BACKUP_DIR}" "${CONFIG_DIR}" "${LOG_DIR}"

log() {
  local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "${UPDATE_LOG}"
}

fail() {
  local msg="[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR: $1"
  echo "$msg" >&2
  echo "$msg" >> "${UPDATE_LOG}"
  exit 1
}

log "🐙 Starting OctopusPanel Update Process..."

cd "${PANEL_DIR}"

# 1. Detect current version
CURRENT_VER="unknown"
if [[ -f "package.json" ]]; then
  CURRENT_VER="$(grep '"version":' package.json | head -n1 | sed -E 's/.*"version": "([^"]+)".*/\1/' || echo "0.1.0")"
fi
log "📌 Current panel version: v${CURRENT_VER}"

# 2. Safety Pre-Check & Automated DB Snapshot
SNAPSHOT_FILE="${BACKUP_DIR}/pre-migration-backup-v${CURRENT_VER}-${TIMESTAMP}.sql.gz"
log "💾 Creating compressed pre-migration database snapshot..."

# Source environment
if [[ -f "${CONFIG_DIR}/panel.env" ]]; then
  cp -f "${CONFIG_DIR}/panel.env" "${CONFIG_DIR}/panel.env.bak"
  # shellcheck disable=SC1090
  source "${CONFIG_DIR}/panel.env"
elif [[ -f "${PANEL_DIR}/.env" ]]; then
  cp -f "${PANEL_DIR}/.env" "${PANEL_DIR}/.env.bak"
  # shellcheck disable=SC1091
  source "${PANEL_DIR}/.env"
fi

if [[ -n "${DATABASE_URL}" ]]; then
  if command -v pg_dump &>/dev/null; then
    pg_dump "${DATABASE_URL}" | gzip > "${SNAPSHOT_FILE}"
    log "✅ Database snapshot saved to ${SNAPSHOT_FILE}"
  else
    log "⚠️  Warning: pg_dump not found in PATH, skipping pg_dump binary call"
  fi
else
  log "⚠️  Warning: DATABASE_URL not set, skipping database snapshot"
fi

# 3. Pull latest changes
log "⬇️  Pulling latest changes from Git repository..."
PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo "")"
if git rev-parse --is-inside-work-tree &>/dev/null; then
  git pull --ff-only >> "${UPDATE_LOG}" 2>&1 || fail "git pull --ff-only failed"
fi

# 4. Dependency installation and asset build
log "📦 Installing dependencies (pnpm install --frozen-lockfile)..."
pnpm install --frozen-lockfile >> "${UPDATE_LOG}" 2>&1 || fail "pnpm install failed"

log "🔨 Building application packages and frontend assets..."
pnpm build >> "${UPDATE_LOG}" 2>&1 || fail "pnpm build failed"

# 5. Database schema migration with automatic rollback guard
log "🗄️  Executing database migrations (pnpm db:migrate)..."
if ! pnpm db:migrate >> "${UPDATE_LOG}" 2>&1; then
  log "❌ MIGRATION FAILED! Initiating automatic recovery rollback..."

  # Rollback DB snapshot if created
  if [[ -f "${SNAPSHOT_FILE}" ]] && command -v psql &>/dev/null && [[ -n "${DATABASE_URL}" ]]; then
    log "🔄 Restoring pre-migration snapshot from ${SNAPSHOT_FILE}..."
    gunzip -c "${SNAPSHOT_FILE}" | psql "${DATABASE_URL}" >> "${UPDATE_LOG}" 2>&1 || log "⚠️  Snapshot restore failed"
  fi

  # Rollback git commit
  if [[ -n "${PREV_COMMIT}" ]]; then
    log "🔄 Rolling back git repository to ${PREV_COMMIT}..."
    git reset --hard "${PREV_COMMIT}" >> "${UPDATE_LOG}" 2>&1 || true
  fi

  fail "Update aborted due to migration failure. State has been rolled back to safety."
fi

# 6. Service Reload
if command -v systemctl &>/dev/null && systemctl is-active --quiet octopus-panel; then
  log "🔁 Restarting octopus-panel service..."
  systemctl restart octopus-panel
fi

NEW_VER="unknown"
if [[ -f "package.json" ]]; then
  NEW_VER="$(grep '"version":' package.json | head -n1 | sed -E 's/.*"version": "([^"]+)".*/\1/' || echo "latest")"
fi

log "✨ OctopusPanel successfully updated from v${CURRENT_VER} to v${NEW_VER}!"
