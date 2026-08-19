#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
fail() { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }

cd "$ROOT_DIR"

# Check prerequisites
log "Checking prerequisites..."

command -v node &>/dev/null || fail "Node.js is not installed. Install from https://nodejs.org"
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
[[ $NODE_VERSION -ge 20 ]] || fail "Node.js v20+ required. Found: $(node -v)"

command -v pnpm &>/dev/null || fail "pnpm is not installed. Run: npm install -g pnpm"
PNPM_VERSION=$(pnpm -v | cut -d. -f1)
[[ $PNPM_VERSION -ge 9 ]] || fail "pnpm v9+ required. Found: $(pnpm -v)"

command -v docker &>/dev/null || warn "Docker is not installed. You can still develop locally without Docker."
command -v docker-compose &>/dev/null || command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1 || warn "Docker Compose is not available."

log "Node.js $(node -v) — OK"
log "pnpm $(pnpm -v) — OK"

# Install dependencies
log "Installing dependencies..."
pnpm install

# Copy env files if they don't exist
if [[ ! -f .env ]]; then
    log "Creating .env from .env.development..."
    cp .env.development .env
else
    warn ".env already exists, skipping."
fi

# Build packages
log "Building shared packages..."
pnpm build

# Start MongoDB via Docker if available
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    log "Starting MongoDB via Docker..."
    docker compose up -d mongodb
    log "Waiting for MongoDB to be ready..."
    RETRIES=30
    until docker compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null || [ $RETRIES -eq 0 ]; do
        RETRIES=$((RETRIES - 1))
        sleep 1
    done
    [[ $RETRIES -gt 0 ]] && log "MongoDB is ready." || warn "MongoDB may not be ready yet."
else
    warn "Docker not available. Ensure MongoDB is running on localhost:27017."
fi

log ""
log "============================================"
log "  Setup complete!"
log ""
log "  Start development:  pnpm dev"
log "  Or with Docker:     docker compose up -d"
log "  Web app:            http://localhost:3000"
log "  API server:         http://localhost:3001"
log "  Mongo Express:      http://localhost:8081"
log "============================================"
