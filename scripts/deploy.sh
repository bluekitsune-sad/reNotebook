#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_FILE=""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

rollback() {
    error "Deployment failed. Rolling back..."
    if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
        log "Restoring MongoDB from $BACKUP_FILE"
        docker compose exec -T mongodb mongorestore --archive --gzip < "$BACKUP_FILE" 2>/dev/null || true
    fi
    docker compose up -d
    error "Rollback complete. Please investigate the failure."
    exit 1
}

trap rollback ERR

cd "$ROOT_DIR"

log "Starting deployment..."

log "Pulling latest code..."
if git rev-parse --is-inside-work-tree &>/dev/null; then
    git pull origin main || log "Git pull failed or not a git repo, continuing with local files..."
fi

log "Creating pre-deploy backup..."
BACKUP_FILE=$(mktemp)
docker compose exec -T mongodb mongodump --archive --gzip --db synced-notepad > "$BACKUP_FILE" 2>/dev/null || {
    log "No running MongoDB to backup (fresh deploy?)"
    BACKUP_FILE=""
}

log "Building Docker images..."
docker compose build --no-cache server web

log "Running database migrations..."
# Add migration commands here if needed in the future
# docker compose run --rm server node apps/server/src/migrate.js

log "Restarting services..."
docker compose up -d --force-recreate --no-deps server web

log "Waiting for services to be healthy..."
RETRIES=30
until docker compose ps server | grep -q "healthy" || [ $RETRIES -eq 0 ]; do
    log "Waiting for server... ($RETRIES retries left)"
    RETRIES=$((RETRIES - 1))
    sleep 2
done

RETRIES=30
until docker compose ps web | grep -q "healthy" || [ $RETRIES -eq 0 ]; do
    log "Waiting for web... ($RETRIES retries left)"
    RETRIES=$((RETRIES - 1))
    sleep 2
done

log "Running health checks..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
if [[ "$HTTP_STATUS" != "200" ]]; then
    error "Server health check failed (HTTP $HTTP_STATUS)"
    exit 1
fi

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "000")
if [[ "$HTTP_STATUS" != "200" ]]; then
    error "Web health check failed (HTTP $HTTP_STATUS)"
    exit 1
fi

log "Cleaning up pre-deploy backup..."
[[ -n "$BACKUP_FILE" ]] && rm -f "$BACKUP_FILE"

log "Deployment complete. All services healthy."
docker compose ps
