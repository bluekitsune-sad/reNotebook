# TODO.md

Living task tracker for reNotebook / synced-notepad. Update checkboxes as work lands.
Last reviewed: 2026-02-13.

Legend: **[H]** high priority · **[M]** medium · **[L]** low / nice-to-have

## P0 / High — Broken or misleading now

- [ ] **[H] Fix mobile workspace dependencies.** `apps/mobile/package.json` does not declare `@synced-notepad/shared`, `@synced-notepad/sync-core`, or `@synced-notepad/validation`, but they are imported in `apps/mobile/src/services/noteService.js`, `src/repositories/notesRepository.js`, `src/hooks/useSync.js`. Fails under pnpm's strict node_modules. Fix: add `"@synced-notepad/*": "workspace:*"` deps and re-run `pnpm install`.
- [ ] **[H] Fix root E2E script.** `pnpm test:e2e` runs `playwright test` from repo root, but the config is at `tests/e2e/playwright.config.js`, so specs are not discovered. Either move config to root, add `-c tests/e2e/playwright.config.js` to the script, or set `PLAYWRIGHT_CONFIG` env.
- [ ] **[H] Wire `SyncEngine` into clients.** `packages/sync-core` `SyncEngine` is only used by tests; both `apps/web/hooks/useSync.js` and `apps/mobile/src/hooks/useSync.js` hand-roll their own sync loops (drift risk vs. `docs/SYNC_ENGINE.md`). Refactor both hooks to drive `SyncEngine`.
- [ ] **[H] Remove hardcoded `workspaceId: 'default'`.** Web files: `apps/web/hooks/useSync.js:52`, `apps/web/services/noteService.js:11`, `apps/web/hooks/useNotes.js:39`, `apps/web/app/devices/page.js:59`. Derive from authenticated user/workspace instead.
- [ ] **[H] Implement WebSocket push.** `apps/server/src/index.js:46-58` accepts `/ws` connections but only logs incoming messages — no real-time sync/notification push. Spec: `docs/SYNC_ENGINE.md`, protocol in `docs/API_SPEC.md`.

## P1 / Medium — Correctness, security, architecture

- [ ] **[M] Honor `CORS_ORIGIN` env var.** Server uses allow-all `cors()` at `apps/server/src/index.js:30`; the documented `CORS_ORIGIN` setting is never read.
- [ ] **[M] Real DB coverage for integration tests.** `apps/server/tests/integration/*` fully mock Mongoose — indexes, unique constraints, and cascade behavior are untested. Add a Mongo-memory-server suite (or a Docker-based test job).
- [ ] **[M] Add tests for web app.** `apps/web` has vitest + Playwright in devDeps but no `test` script and zero unit tests. Priority: `hooks/useSync.js`, `hooks/useNotes.js`, `repositories/index.js`.
- [ ] **[M] Add tests for `packages/validation` and `packages/shared`.** Vitest present, no test script (validation) / no tests (shared).
- [ ] **[M] Add mobile tests.** `apps/mobile` has vitest devDep, no `test` script, no tests. Start with `src/repositories/notesRepository.js` and `src/hooks/useSync.js`.
- [ ] **[M] Enable ESLint React/hooks plugins.** `eslint-plugin-react` and `eslint-plugin-react-hooks` are root devDeps but not wired into `eslint.config.js`; React rules never run.
- [ ] **[M] Add E2E + format check to CI.** `.github/workflows/ci.yml` runs only lint/test/build. Add `pnpm format:check` at minimum; consider Playwright job with `docker compose up -d mongodb`.
- [ ] **[M] Device rename/revoke + visibility parity check.** Verify web UI (`apps/web/app/devices/page.js`, `components/DeviceList.js`, `VisibilityToggle.js`) covers all endpoints in `docs/API_SPEC.md` (rename, revoke, visibility PUT).
- [ ] **[M] Conflict resolution UX completeness.** Confirm Keep Local / Keep Server / Merge all round-trip through `POST /conflicts/:id/resolve` and produce a new canonical revision (spec: `docs/CONFLICT_RESOLUTION.md`).

## P2 / Low — Hygiene, docs, DX

- [ ] **[L] Repo hygiene.** Remove tracked `clipboard.txt` (stray notes) and committed `web-output.log`; add `*.log` to `.gitignore`.
- [ ] **[L] Deduplicate `API_SPEC.md`.** Root `API_SPEC.md` is byte-identical to `docs/API_SPEC.md` — keep `docs/` copy, replace root with a pointer or delete.
- [ ] **[L] README fixes.**
  - Mobile is marked "(planned)" but `apps/mobile` is a full Expo implementation — update Tech Stack + Project Structure.
  - `cp .env.development .env.local` is wrong; the server reads `.env` — align with `scripts/setup.sh`.
  - Replace placeholder clone URL `your-org/synced-notepad` with `bluekitsune-sad/reNotebook`.
- [ ] **[L] Name alignment.** GitHub repo `reNotebook` vs workspace `synced-notepad` — pick one canonical name for README/docs/package naming.
- [ ] **[L] Remove empty server dirs.** `apps/server/src/{auth,pairing,sync,controllers}/` are empty leftovers; delete or note they're unused (logic lives in `routes/` + `services/`).
- [ ] **[L] Mobile dead code cleanup.** Remove vestigial `apps/mobile/src/screens/HomeScreen.js` and `src/navigation/RootLayout.js` (expo-router uses `app/`); verify `app.json` asset files exist.
- [ ] **[L] Conventional commits.** README mandates `feat:`/`fix:`/`docs:` but history uses phase-batch messages — start enforcing going forward.
- [ ] **[L] Fill in `docs/PLAN.md` / `docs/ROADMAP.md` checkboxes.** Phases 0–14 in `docs/PLAN.md` are all unchecked though much of the work exists — reconcile with reality.
- [ ] **[L] Root vitest config unused.** Root `vitest.config.js` includes `packages/**/*.test.js` but no root script runs it (`pnpm test` → `turbo test`). Either wire it up or drop it.
- [ ] **[L] Coverage upload.** Server has `@vitest/coverage-v8` configured; no CI coverage reporting/threshold.

## Done

- [x] MIT `LICENSE` file at repo root with correct copyright (2026 Saad Yousuf), renamed from `LICENCE`.
- [x] `"license": "MIT"` added to root + all 6 workspace `package.json` files.
- [x] README License section links to `LICENSE`.
- [x] `AGENTS.md` created with commands, layout, conventions, and known traps.
- [x] This `TODO.md` created from full codebase audit.
