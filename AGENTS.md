# AGENTS.md

Guidance for AI coding agents (and human contributors) working in this repository.

## Project Overview

**reNotebook / synced-notepad** — an offline-first notepad with multi-device sync, QR-based device pairing, and conflict resolution.

- **Monorepo:** pnpm 9.15 workspaces + Turborepo 2.4
- **Language:** 100% JavaScript (ESM, `"type": "module"`). **No TypeScript** — see `README.md` > Code Style.
- **Stack:** Next.js 15 / React 19 (web), Express 5 + Mongoose 8 + `ws` (server), Expo ~52 / React Native (mobile), MongoDB 7, Zod validation, Dexie/IndexedDB (web), expo-sqlite (mobile).
- **Ports:** web `3000`, server `3001` (HTTP + WebSocket at `/ws`), MongoDB `27017`, mongo-express `8081`.
- **License:** MIT (see `LICENSE`). Copyright (c) 2026 Saad Yousuf.

## Commands

Run from the repo root:

```bash
pnpm install            # Install all workspace deps
pnpm dev                # Start all dev servers (turbo dev)
pnpm build              # Build all packages (turbo build)
pnpm lint               # Lint all packages (turbo lint)
pnpm test               # Unit tests (turbo test → vitest)
pnpm format             # Prettier write
pnpm format:check       # Prettier check
pnpm test:e2e           # Playwright E2E — see gotcha below
```

Single package:

```bash
pnpm --filter @synced-notepad/server test
pnpm --filter @synced-notepad/server dev
pnpm --filter @synced-notepad/sync-core test
```

Also available: `make dev|build|test|lint|docker-up|docker-down|backup|restore|deploy|setup|clean`.

### Gotchas when running commands

- **E2E config is not at repo root.** The Playwright config lives at `tests/e2e/playwright.config.js`, but the root script runs `playwright test` from the root. If tests are not discovered, run `npx playwright test -c tests/e2e/playwright.config.js`. E2E auto-starts web (3000) and server (3001) dev servers and registers real users — needs MongoDB running (`docker compose up -d mongodb`).
- **Server env file is `.env`, not `.env.local`.** The server loads `.env` via `dotenv/config` (`apps/server/src/index.js:1`). Copy with `cp .env.development .env` (as `scripts/setup.sh` does).
- **Build shared packages before running apps that import them:** `pnpm build` (turbo `test`/`lint` depend on `^build`).
- CI (`.github/workflows/ci.yml`) runs only `pnpm lint`, `pnpm test`, `pnpm build` on Node 22. No E2E or format check in CI.

## Repository Layout

```
apps/
  web/        @synced-notepad/web     — Next.js App Router client (offline-first, Dexie)
  server/     @synced-notepad/server  — Express API + WebSocket (routes/ + services/ pattern)
  mobile/     @synced-notepad/mobile  — Expo app (expo-router app/ + src/)
packages/
  shared/     @synced-notepad/shared     — constants, errors (AppError, ERROR_CODES), utils
  sync-core/  @synced-notepad/sync-core  — SyncEngine, 3-way merge, conflict detection, retry, state machine
  validation/ @synced-notepad/validation — Zod schemas (note, sync, pairing)
tests/e2e/    Playwright specs (auth, notes, sync, devices, conflicts)
docs/         19 design/spec docs (API_SPEC.md is canonical — see gotchas)
scripts/      setup.sh, backup.sh, restore.sh, deploy.sh
```

Key entry points:

- Server: `apps/server/src/index.js` → `routes/` (auth, notes, sync, devices, conflicts, visibility, history, health) → `services/` → `models/` (12 Mongoose models).
- Web: `apps/web/app/` (pages), `components/`, `hooks/` (`useSync`, `useNotes`, `useAuth`), `repositories/index.js` (Dexie), `storage/db.js` (IndexedDB schema v1).
- Mobile: `apps/mobile/app/` (expo-router screens), `apps/mobile/src/` (repositories over expo-sqlite, hooks, services).
- Empty leftover dirs in server (do not add logic there): `src/auth/`, `src/pairing/`, `src/sync/`, `src/controllers/` — real logic lives in `routes/` + `services/`.

## Conventions

- **JavaScript only.** No `.ts` files, no tsconfig.
- **ESM everywhere.** Use `import`/`export`; within apps, relative imports keep explicit `.js` extensions.
- **Workspace imports by package name:** `import { ERROR_CODES } from '@synced-notepad/shared'` (declared as `"workspace:*"`). Never deep-path into another package's internals.
- **Prettier** (`.prettierrc`): single quotes, semicolons, 2-space indent, trailing commas `all`, printWidth 100. Run `pnpm format` before committing.
- **ESLint** — single root flat config (`eslint.config.js`): `@eslint/js` recommended + prettier-disabling rules. `no-unused-vars: warn` (ignore args prefixed `_`), `no-console: warn` (allow `warn`/`error`). React/hooks plugins are installed but **not wired into the config**.
- **File naming:** camelCase files (`noteService.js`, `useSync.js`); Next.js pages are `page.js`/`layout.js`; Mongoose models PascalCase (`Note.js`); barrels via `index.js`.
- **Commits:** README asks for conventional commits (`feat:`, `fix:`, `docs:`). Keep commits focused; do not commit `.env*`, logs, or `node_modules`.
- **Tests:** unit tests colocated (`*.test.js`) or under `apps/server/tests/{unit,integration}`; E2E under `tests/e2e/*.spec.js`. Write tests for new features.

## Testing

- **Vitest** — 10 unit/integration files, ~177 cases. Configs: root `vitest.config.js`, `apps/server/vitest.config.js`, `packages/sync-core/vitest.config.js`.
  - Server integration tests fully **mock Mongoose** — they do not touch a real MongoDB.
  - Coverage: `@vitest/coverage-v8` over server `src/**` (excludes `src/index.js`, `src/utils/db.js`).
- **Playwright** — `tests/e2e/` with 5 specs (auth, notes, sync, devices, conflicts; 37 tests). Chromium + Firefox, workers=1, retries=1 (2 in CI), baseURL `http://localhost:3000`.
- **No tests exist yet for:** `apps/web`, `apps/mobile`, `packages/shared`, `packages/validation`. (Web/mobile have vitest in devDeps but no `test` script.)

## Architecture Notes (read before touching sync)

- **Local-first:** all writes go to local storage first (IndexedDB via Dexie on web, SQLite on mobile). The app works fully offline.
- **Sync engine** (`packages/sync-core`): cursor-based pull with a change log — queue local mutations → push → pull since cursor → apply/merge → ack (advance cursor).
- **Conflict flow:** server detects `baseRevision !== currentRevision` → creates Conflict with local + server versions → user resolves (Keep Local / Keep Server / Merge) → new canonical revision.
- **Pairing:** time-limited QR → new device claims → owner approves → workspace authorization → initial sync pull.
- Full API contract: `docs/API_SPEC.md`. Architecture docs: `docs/SYNC_ENGINE.md`, `docs/DATABASE_SCHEMA.md`, `docs/FRONTEND_ARCHITECTURE.md`, `docs/CONFLICT_RESOLUTION.md`.

## Known Traps / Current State

Verify against `TODO.md` for the live list. Highlights:

1. **`SyncEngine` is only exercised by tests.** Neither `apps/web/hooks/useSync.js` nor `apps/mobile/src/hooks/useSync.js` instantiate it — both hand-roll sync loops. Web hardcodes `workspaceId: 'default'` in several files (`apps/web/hooks/useSync.js:52`, `services/noteService.js:11`, `hooks/useNotes.js:39`, `app/devices/page.js:59`).
2. **Mobile workspace deps are missing:** `apps/mobile` imports `@synced-notepad/shared|sync-core|validation` but does not declare them in `package.json` — breaks under pnpm's strict node_modules.
3. **WebSocket server is a stub:** `apps/server/src/index.js:46-58` accepts `/ws` connections but only logs messages (no real-time push).
4. **`CORS_ORIGIN` env var is never read** — server uses allow-all `cors()` at `apps/server/src/index.js:30`.
5. **README drift:** mobile is labeled "(planned)" but a full Expo implementation exists; README suggests `.env.local` but server reads `.env`.
6. **Repo hygiene:** tracked `clipboard.txt`, committed `web-output.log`, duplicate `API_SPEC.md` (root copy identical to `docs/API_SPEC.md`).
7. **Naming mismatch:** GitHub repo is `reNotebook`; workspace/package names are `synced-notepad`.

## Environment Variables

Keys (never commit values; `.env.development` / `.env.production` are tracked templates — prefer `.env` overrides):

`MONGODB_URI`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `LOG_LEVEL`, `NEXT_PUBLIC_API_URL`, `ME_EXPRESS_USER`, `ME_EXPRESS_PASSWORD` (+ optional `S3_BUCKET`, `S3_PREFIX` in production).

Per-app examples: `apps/server/.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example`.

## Definition of Done

Before handing work back:

1. `pnpm lint` passes.
2. `pnpm test` passes (and add/extend tests for new behavior).
3. `pnpm format` applied (or `pnpm format:check` passes).
4. `pnpm build` succeeds if shared packages or configs changed.
5. Update `TODO.md` / docs if behavior or public API changed.
