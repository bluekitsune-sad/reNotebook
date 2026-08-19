# PROJECT_STRUCTURE.md

# Synced Notepad — Project Structure

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Monorepo Structure

The project uses a monorepo structure with shared packages.

```text
synced-notepad/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── storage/
│   │   └── package.json
│   │
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── storage/
│   │   │   └── navigation/
│   │   └── package.json
│   │
│   └── server/
│       ├── src/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── models/
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── sync/
│       │   ├── pairing/
│       │   ├── auth/
│       │   └── utils/
│       ├── tests/
│       └── package.json
│
├── packages/
│   │
│   ├── sync-core/
│   │   ├── changes/
│   │   ├── conflicts/
│   │   ├── merge/
│   │   ├── cursor/
│   │   └── state-machine/
│   │
│   ├── validation/
│   │   ├── noteSchemas.js
│   │   ├── syncSchemas.js
│   │   └── pairingSchemas.js
│   │
│   └── shared/
│       ├── constants/
│       ├── errors/
│       └── utils/
│
├── docs/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 2. apps/ Directory

### apps/web/

```text
Next.js application
├── app/              → Next.js app router pages
├── components/       → React UI components
├── hooks/            → Custom React hooks
├── services/         → Domain service layer
├── repositories/     → IndexedDB data access (Dexie.js)
└── storage/          → Database setup and migrations
```

### apps/mobile/

```text
React Native + Expo application
├── src/
│   ├── screens/      → Screen components
│   ├── components/   → Reusable UI components
│   ├── hooks/        → Custom React hooks
│   ├── services/     → Domain service layer
│   ├── repositories/ → SQLite data access
│   ├── storage/      → Database setup and migrations
│   └── navigation/   → Navigation configuration
```

### apps/server/

```text
Node.js + Express backend
├── src/
│   ├── controllers/  → Request handlers (thin)
│   ├── services/     → Business logic
│   ├── repositories/ → MongoDB data access (Mongoose)
│   ├── models/       → Mongoose schemas
│   ├── middleware/    → Auth, device, validation middleware
│   ├── routes/       → API route definitions
│   ├── sync/         → SyncService and sync processing
│   ├── pairing/      → QR pairing logic
│   ├── auth/         → Authentication logic
│   └── utils/        → Shared server utilities
└── tests/
```

---

## 3. packages/ Directory

### packages/sync-core/

The most important shared package. Contains platform-independent synchronization logic.

```text
sync-core/
├── changes/          → Change creation, validation, deduplication
├── conflicts/        → Conflict detection logic
├── merge/            → Three-way merge algorithm
├── cursor/           → Sync cursor management
└── state-machine/    → Sync engine state machine
```

### What it contains:

```text
change creation
change validation
conflict detection
merge logic
sync state machine
retry logic
protocol types represented in JS schemas
```

Even though the project uses JavaScript, shared logic should be written once where practical.

### packages/validation/

```text
validation/
├── noteSchemas.js    → Note validation (Zod)
├── syncSchemas.js    → Sync payload validation (Zod)
└── pairingSchemas.js → QR pairing payload validation (Zod)
```

Use runtime validation. Every API payload should be validated.

### packages/shared/

```text
shared/
├── constants/        → Shared constants (error codes, statuses, limits)
├── errors/           → Shared error types and codes
└── utils/            → Shared utility functions
```

---

## 4. Why Monorepo?

The web, mobile app, and server share important concepts:

```text
Change
Revision
Note
Conflict
Sync Cursor
```

Instead of implementing the same logic separately in:

```text
web implementation
mobile implementation
server implementation
```

shared domain logic lives in:

```text
packages/sync-core
```

This ensures:

```text
- Consistent sync behavior across platforms
- Single source of truth for conflict detection
- One merge algorithm shared by all clients
- One set of validation schemas
```

---

## 5. Important Boundary: Don't Share Database-Specific Code

Each platform uses a different database:

```text
Web:     IndexedDB
Mobile:  SQLite
Server:  MongoDB
```

The repositories implement the same logical interface but with different underlying implementations.

### Shared interface:

```js
notesRepository.get(noteId)
notesRepository.create(note)
notesRepository.update(note)
notesRepository.delete(note)
notesRepository.list()
```

### Different implementations:

```text
Web repository     → uses Dexie.js / IndexedDB
Mobile repository  → uses SQLite / WatermelonDB
Server repository  → uses Mongoose / MongoDB
```

The UI and sync engine should not know which database is being used.

---

## 6. Shared Repository Interface Pattern

Both clients expose equivalent operations:

```js
// Notes
createNote()
getNote()
updateNote()
deleteNote()
restoreNote()
listNotes()

// Revisions
getRevisionHistory()

// Changes
queueChange()
markChangeProcessed()
getPendingChanges()

// Sync
getSyncCursor()
updateSyncCursor()
getConflict()
storeConflict()
```

This allows the sync engine to work against a consistent abstraction regardless of platform.

---

## 7. Server Structure

```text
server/
├── src/
│   │
│   ├── controllers/
│   │   ├── syncController.js
│   │   ├── noteController.js
│   │   ├── deviceController.js
│   │   ├── pairingController.js
│   │   └── conflictController.js
│   │
│   ├── services/
│   │   ├── syncService.js
│   │   ├── noteService.js
│   │   ├── deviceService.js
│   │   ├── pairingService.js
│   │   ├── conflictService.js
│   │   ├── auditService.js
│   │   └── workspaceService.js
│   │
│   ├── repositories/
│   │   ├── userRepository.js
│   │   ├── workspaceRepository.js
│   │   ├── deviceRepository.js
│   │   ├── noteRepository.js
│   │   ├── revisionRepository.js
│   │   ├── changeRepository.js
│   │   ├── conflictRepository.js
│   │   └── auditRepository.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Workspace.js
│   │   ├── Device.js
│   │   ├── Note.js
│   │   ├── NoteRevision.js
│   │   ├── Change.js
│   │   ├── Conflict.js
│   │   ├── VisibilityRule.js
│   │   ├── AuditEvent.js
│   │   ├── PairingSession.js
│   │   └── SyncCursor.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── device.js
│   │   ├── validation.js
│   │   └── errorHandler.js
│   │
│   ├── routes/
│   │   ├── sync.js
│   │   ├── notes.js
│   │   ├── devices.js
│   │   ├── pairing.js
│   │   ├── conflicts.js
│   │   └── health.js
│   │
│   ├── sync/
│   │   └── syncService.js
│   │
│   ├── auth/
│   │   └── authService.js
│   │
│   └── utils/
│       ├── logger.js
│       └── errors.js
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 8. Server Architecture Layers

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
MongoDB
```

### Controllers should remain thin:

Bad:

```js
async function updateNote(req, res) {
  // 300 lines of synchronization logic
}
```

Better:

```js
async function pushChanges(req, res) {
  const result = await syncService.pushChanges({
    userId: req.user.id,
    deviceId: req.device.id,
    workspaceId: req.body.workspaceId,
    changes: req.body.changes
  });
  return res.json(result);
}
```

---

## 9. Request Processing Pipeline

Every synchronization request passes through:

```text
HTTP
  ↓
Authentication Middleware
  ↓
Device Middleware
  ↓
Workspace Authorization
  ↓
Validation (Zod)
  ↓
Controller
  ↓
Service
  ↓
MongoDB Transaction
```

---

## 10. Development Tooling

```text
Package Manager:  pnpm
Monorepo:         Turborepo
Language:         JavaScript
Linting:          ESLint
Formatting:       Prettier
Testing:          Vitest (unit), Playwright (web E2E), Maestro (mobile E2E)
Validation:       Zod
```

---

## 11. Database Separation

```text
Development database
Testing database
Production database
```

Do not allow development code to accidentally connect to production.

---

## 12. MongoDB Indexing

Indexes designed around synchronization queries:

```text
changes:       workspaceId + serverSequence
notes:         workspaceId + updatedAt
notes:         workspaceId + id
devices:       workspaceId + status
pairing_sessions: id + expiresAt
conflicts:     workspaceId + status
```

Exact indexes should be validated against actual query patterns.

---

## 13. MongoDB Transactions

Use transactions for operations that require atomic changes:

```text
Update note
  +
Create revision
  +
Create change
  +
Create audit event
```

This should be treated as one logical operation.
