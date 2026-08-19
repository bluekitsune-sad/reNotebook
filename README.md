# Synced Notepad

Offline-first notepad with multi-device sync, QR-based device pairing, and conflict resolution.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 15, React 19, JavaScript |
| Mobile | React Native, Expo (planned) |
| Backend | Node.js, Express 5, WebSocket |
| Database | MongoDB 7 |
| Local Storage | IndexedDB (web), SQLite (mobile) |
| Validation | Zod |
| Monorepo | pnpm, Turborepo |
| Testing | Vitest, Playwright |
| Containerization | Docker, Docker Compose |

## Prerequisites

- Node.js >= 22
- pnpm >= 9.15
- MongoDB >= 7 (or use Docker)
- Git

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/synced-notepad.git
cd synced-notepad

# Install dependencies
pnpm install

# Start MongoDB (if not using Docker)
# Or use Docker:
docker compose up -d mongodb

# Set up environment
cp .env.development .env.local

# Build shared packages
pnpm build

# Start development servers
pnpm dev
```

The web app runs at `http://localhost:3000` and the API server at `http://localhost:3001`.

## Project Structure

```
synced-notepad/
├── apps/
│   ├── web/              # Next.js web application
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API and auth services
│   │   └── repositories/ # IndexedDB repositories
│   ├── mobile/           # React Native + Expo (planned)
│   └── server/           # Node.js + Express API server
│       ├── src/
│       │   ├── models/       # Mongoose schemas
│       │   ├── routes/       # Express route handlers
│       │   ├── services/     # Business logic
│       │   ├── middleware/   # Auth, validation, error handling
│       │   └── utils/        # Logging, health checks, metrics
│       └── ...
├── packages/
│   ├── shared/           # Shared constants, errors, utils
│   ├── sync-core/        # Shared sync engine logic
│   └── validation/       # Zod schemas
├── tests/
│   └── e2e/              # Playwright end-to-end tests
├── docs/                 # Documentation
├── docker-compose.yml    # Docker services
├── turbo.json            # Turborepo config
└── package.json          # Root workspace config
```

## Available Scripts

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run unit tests (Vitest)
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm test:e2e:ui      # Run E2E tests with Playwright UI
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier
pnpm format:check     # Check formatting
```

### Make Targets

```bash
make dev              # Start dev servers
make build            # Build all packages
make test             # Run unit tests
make lint             # Lint all packages
make docker-up        # Start Docker services
make docker-down      # Stop Docker services
make docker-build     # Build Docker images
make backup           # Backup MongoDB
make restore          # Restore MongoDB
make deploy           # Build and deploy with Docker
make setup            # Install deps and build
make clean            # Remove node_modules and build artifacts
```

## Docker Setup

```bash
# Start all services (MongoDB, Mongo Express, Server, Web)
docker compose up -d

# Start only MongoDB
docker compose up -d mongodb

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Production build
docker compose -f docker-compose.prod.yml up -d
```

Services:
- **mongodb**: MongoDB 7 on port 27017
- **mongo-express**: DB admin UI on port 8081
- **server**: API server on port 3001
- **web**: Next.js app on port 3000

## Testing

### Unit Tests (Vitest)

```bash
pnpm test                    # Run all unit tests
pnpm --filter @synced-notepad/server test   # Server tests only
```

### E2E Tests (Playwright)

```bash
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e:ui             # Run with Playwright UI mode
npx playwright show-report   # View HTML test report
```

E2E test suites:
- **auth.spec.js** — Registration, login, session management
- **notes.spec.js** — CRUD operations, search, UI interactions
- **sync.spec.js** — Sync status, offline mode, pending changes
- **devices.spec.js** — Device list, QR pairing, device management
- **conflicts.spec.js** — Conflict detection, resolution UI

## Architecture

### Local-First

All writes happen locally first using IndexedDB (web) or SQLite (mobile). The app works fully offline — notes are created, edited, and deleted locally without any network dependency.

### Sync Engine

The sync engine uses a cursor-based pull model with a change log:

1. **Local mutations** are queued as pending changes
2. **Push** sends pending changes to the server
3. **Pull** fetches remote changes since last cursor
4. **Apply** merges remote changes into local state
5. **Ack** advances the sync cursor

### Conflict Resolution

When two devices modify the same note concurrently:

1. Server detects revision mismatch (`baseRevision !== currentRevision`)
2. Conflict is created with both local and server versions
3. User resolves via UI: Keep Local, Keep Server, or Merge
4. Resolution creates a new canonical revision

### Device Pairing

QR-based pairing establishes device authorization:

1. Existing device generates a time-limited QR code
2. New device scans QR and claims the pairing
3. Owner approves/rejects the new device
4. New device receives workspace authorization
5. Initial sync pulls all workspace data

## API Overview

Base URL: `http://localhost:3001/api`

### Authentication
- `POST /auth/register` — Create account
- `POST /auth/login` — Get access token
- `GET /auth/me` — Current user info

### Notes
- `GET /notes` — List notes
- `GET /notes/:id` — Get note
- `POST /notes` — Create note
- `PATCH /notes/:id` — Update note
- `DELETE /notes/:id` — Delete note
- `POST /notes/:id/restore` — Restore deleted note

### Sync
- `POST /sync` — Push changes and pull remote
- `GET /sync/pull` — Pull remote changes

### Devices
- `GET /devices` — List devices
- `POST /devices/pair` — Generate pairing QR
- `POST /devices/:id/rename` — Rename device
- `POST /devices/:id/revoke` — Revoke device

### Conflicts
- `GET /conflicts` — List conflicts
- `POST /conflicts/:id/resolve` — Resolve conflict

### Visibility
- `GET /visibility` — Get visibility rules
- `PUT /visibility` — Set note visibility for device

### History
- `GET /history` — Audit log
- `GET /history/:noteId` — Note revision history

### Health
- `GET /health/health` — Health check
- `GET /health/ready` — Readiness check
- `GET /health/metrics` — Server metrics

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test && pnpm test:e2e`)
5. Run linter (`pnpm lint`)
6. Format code (`pnpm format`)
7. Commit changes (`git commit -m 'feat: add amazing feature'`)
8. Push to branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Style

- Use JavaScript (not TypeScript)
- Follow existing code patterns
- Write tests for new features
- Keep commits focused and atomic
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, etc.)

## License

MIT
