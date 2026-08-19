# Synced Notepad — Technology Stack

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Selected Technology Stack

### Web

```text
Next.js
React
JavaScript
```

### Mobile

```text
React Native
Expo
JavaScript
```

### Backend

```text
Node.js
JavaScript
REST API
WebSocket/realtime layer
```

### Database

```text
MongoDB
```

### Local Storage

Mobile:

```text
SQLite
```

Web:

```text
IndexedDB
```

### Validation

```text
Zod
```

### Monorepo

```text
pnpm
Turborepo
```

### Testing

```text
Vitest          (unit testing)
Playwright      (end-to-end, web)
Maestro / Detox (end-to-end, mobile)
```

### Desktop (Future)

```text
Tauri 2
```

---

## 2. Architecture Decision Summary

| Area                | Decision                  |
| ------------------- | ------------------------- |
| Web                 | Next.js + JavaScript      |
| Mobile              | React Native + JavaScript |
| Backend             | Node.js + Express         |
| Database            | MongoDB                   |
| Web local DB        | IndexedDB                 |
| Mobile local DB     | SQLite                    |
| API                 | REST                      |
| Realtime            | WebSocket                 |
| Sync                | Cursor + change log       |
| Conflict model      | Revision-based            |
| Pairing             | Temporary QR session      |
| Ownership           | User → Workspace          |
| Device role         | Authorized replica        |
| History             | Immutable revisions       |
| Activity            | Audit logs                |
| Offline             | First-class               |
| Server authority    | Yes                       |
| Client writes       | Local-first               |
| Realtime dependency | No                        |

---

## 3. Monorepo Structure

```text
synced-notepad/
│
├── apps/
│   ├── web/           (Next.js)
│   ├── mobile/        (React Native + Expo)
│   └── server/        (Node.js + Express)
│
├── packages/
│   ├── sync-core/     (shared sync logic)
│   ├── validation/    (Zod schemas)
│   └── shared/        (constants, errors, utils)
│
├── docs/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The web, mobile app, and server share important concepts (Change, Revision, Note, Conflict, Sync Cursor). Shared domain logic lives in `packages/sync-core` rather than being implemented separately on each platform.

**Important boundary:** Database-specific code is not shared. Web uses IndexedDB, mobile uses SQLite, server uses MongoDB. Each implements the same logical repository interface.

---

## 4. Development Philosophy

The project should be developed in this order:

```text
Correctness
    ↓
Synchronization
    ↓
Security
    ↓
Data integrity
    ↓
Offline support
    ↓
Conflict resolution
    ↓
Core UX
    ↓
Visual polish
```

Do not prioritize animations, themes, or advanced editor features before the synchronization system is reliable.

A slower synchronization system that never loses user data is preferable to a fast synchronization system that occasionally destroys edits.

---

## 5. Local Storage Architecture

Both clients follow the same layered architecture:

```text
UI
    ↓
Application Logic
    ↓
Domain Services
    ↓
Repositories (shared interface)
    ↓
Local Database (platform-specific)
```

Both clients expose equivalent operations:

```js
createNote()
getNote()
updateNote()
deleteNote()
restoreNote()
listNotes()
getRevisionHistory()
```

This allows the sync engine to work against a consistent abstraction regardless of platform.

---

## 6. Future Desktop Application

After web/mobile are stable:

```text
Tauri
   ↓
Shared React UI
   ↓
Shared domain/sync logic
   ↓
Local SQLite
```

Do not start desktop development until the synchronization architecture has proven itself on web and mobile.
