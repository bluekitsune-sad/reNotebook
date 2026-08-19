#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="synced-notepad_${TIMESTAMP}"
KEEP_COUNT=7

MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_DB="${MONGO_DB:-synced-notepad}"
MONGO_USER="${MONGO_USERNAME:-admin}"
MONGO_PASS="${MONGO_PASSWORD:-password}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-synced-notepad-backups}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

mkdir -p "$BACKUP_DIR"

log "Starting MongoDB backup..."

log "Dumping database '$MONGO_DB'..."
docker compose exec -T "$MONGO_HOST" mongodump \
    --username="$MONGO_USER" \
    --password="$MONGO_PASS" \
    --authenticationDatabase=admin \
    --db="$MONGO_DB" \
    --archive \
    --gzip \
    > "${BACKUP_DIR}/${BACKUP_NAME}.gz"

DUMP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.gz" | cut -f1)
log "Backup created: ${BACKUP_NAME}.gz ($DUMP_SIZE)"

log "Rotating old backups (keeping last ${KEEP_COUNT})..."
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/synced-notepad_*.gz 2>/dev/null | wc -l)
if [[ $BACKUP_COUNT -gt $KEEP_COUNT ]]; then
    REMOVE_COUNT=$((BACKUP_COUNT - KEEP_COUNT))
    ls -1t "${BACKUP_DIR}"/synced-notepad_*.gz | tail -n "$REMOVE_COUNT" | while read -r file; do
        log "Removing old backup: $(basename "$file")"
        rm -f "$file"
    done
fi

if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading to S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_NAME}.gz"
    if command -v aws &>/dev/null; then
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.gz" \
            "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_NAME}.gz" \
            --storage-class STANDARD_IA
        log "S3 upload complete."
    else
        error "AWS CLI not found. Skipping S3 upload."
    fi
else
    log "No S3_BUCKET configured, skipping cloud upload."
fi

log "Backup complete: ${BACKUP_DIR}/${BACKUP_NAME}.gz"
ls -lh "${BACKUP_DIR}"/synced-notepad_*.gz
