#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/backups"

MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_DB="${MONGO_DB:-synced-notepad}"
MONGO_USER="${MONGO_USERNAME:-admin}"
MONGO_PASS="${MONGO_PASSWORD:-password}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

if [[ -n "${1:-}" ]]; then
    BACKUP_FILE="$1"
    [[ -f "$BACKUP_FILE" ]] || error "File not found: $BACKUP_FILE"
else
    BACKUP_FILE=$(ls -1t "${BACKUP_DIR}"/synced-notepad_*.gz 2>/dev/null | head -1)
    [[ -n "$BACKUP_FILE" ]] || error "No backups found in ${BACKUP_DIR}"
fi

log "Restoring from: $(basename "$BACKUP_FILE")"
log "Target database: $MONGO_DB"

read -rp "This will overwrite the current database. Continue? (y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }

log "Dropping existing database..."
docker compose exec -T "$MONGO_HOST" mongosh \
    --username="$MONGO_USER" \
    --password="$MONGO_PASS" \
    --authenticationDatabase=admin \
    --eval "db.getSiblingDB('$MONGO_DB').dropDatabase()" \
    --quiet

log "Restoring from backup..."
docker compose exec -T "$MONGO_HOST" mongorestore \
    --username="$MONGO_USER" \
    --password="$MONGO_PASS" \
    --authenticationDatabase=admin \
    --db="$MONGO_DB" \
    --archive \
    --gzip \
    < "$BACKUP_FILE"

log "Verifying restoration..."
DOC_COUNT=$(docker compose exec -T "$MONGO_HOST" mongosh \
    --username="$MONGO_USER" \
    --password="$MONGO_PASS" \
    --authenticationDatabase=admin \
    --eval "db.getSiblingDB('$MONGO_DB').stats().collections" \
    --quiet 2>/dev/null | tail -1 | tr -d '[:space:]')

log "Database '$MONGO_DB' restored successfully."
log "Restoration verified: ${DOC_COUNT} collections."
