# FRONTEND_ARCHITECTURE.md

# Synced Notepad — Frontend Architecture

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Web Application

```text
Framework:  Next.js
Language:   JavaScript
Rendering:  React
Local DB:   IndexedDB
DB Layer:   Dexie.js (recommended)
```

The web application must function as a Progressive Web App (PWA) or equivalent offline-capable application.

### Requirements:

```text
Local persistent storage
Service worker / app shell
Local database
Sync queue
Offline-first architecture
```

A simple website that depends entirely on server requests cannot provide true offline note editing.

---

## 2. Mobile Application

```text
Framework:  React Native + Expo
Language:   JavaScript
Local DB:   SQLite
DB Layer:   WatermelonDB or simpler SQLite wrapper
```

The mobile application must work fully offline and synchronize when connectivity is available.

### Requirements:

```text
Full offline CRUD
Local SQLite database
Background sync (opportunistic)
Platform-appropriate secure storage for credentials
```

Background synchronization should be treated as opportunistic. The system must continue functioning if background execution is delayed. The next foreground connection will synchronize.

---

## 3. Client Architecture Layers

Both clients follow the same layered architecture:

```text
UI
 ↓
Application Logic (Hooks / Controllers)
 ↓
Domain Services
 ↓
Repositories
 ↓
Local Database
```

### Layer responsibilities:

| Layer | Responsibility |
|-------|---------------|
| **UI** | Rendering, user interaction, display state |
| **Application Logic** | Orchestrate user actions, manage UI state |
| **Domain Services** | Business rules, validation, sync coordination |
| **Repositories** | Data access abstraction, local persistence |
| **Local Database** | Physical storage (IndexedDB / SQLite) |

### Critical rule:

The UI should never directly manipulate the local database or server. All operations pass through the domain layer.

---

## 4. Sync Engine as Separate Subsystem

The synchronization engine runs alongside the domain layer rather than being embedded into UI components.

```text
                ┌─────────────┐
                │     UI      │
                └──────┬──────┘
                       │
                Domain Services
                       │
             ┌─────────┴─────────┐
             │                   │
         Repository          Sync Engine
             │                   │
             ▼                   ▼
        Local Database       Network API
```

### Sync engine interface:

```js
syncEngine.getStatus()
syncEngine.sync()
syncEngine.pull()
syncEngine.push()
syncEngine.applyRemoteChanges()
syncEngine.processPushResults()
syncEngine.handleConflict()
syncEngine.updateCursor()
```

### Sync engine state machine:

```text
idle
  ↓
checking
  ↓
pulling
  ↓
applying
  ↓
pushing
  ↓
processing
  ↓
completed
```

Failure:

```text
any state
  ↓
error
  ↓
retry_wait
  ↓
checking
```

---

## 5. Application Startup Flow

### Web application:

```text
Load application
  ↓
Load local database (IndexedDB)
  ↓
Display cached notes
  ↓
Check authentication
  ↓
Check network
  ↓
Start synchronization
```

### Mobile application:

```text
Open app
  ↓
Load SQLite
  ↓
Render notes
  ↓
Check network
  ↓
Synchronize
```

### Key principle:

> The user should see notes before synchronization finishes.

Do not block the UI waiting for the server. The application must render immediately from local data.

---

## 6. Note Creation Flow

When a user creates a note:

```text
User
  ↓
Note Editor
  ↓
Note Service
  ↓
Database Transaction
  ├── Create note
  ├── Create revision
  └── Create pending change
  ↓
UI updates immediately
  ↓
Sync engine uploads later
```

### Local transaction:

```js
await database.transaction(async () => {
  await notes.create(note);
  await revisions.create(revision);
  await pendingChanges.create(change);
});
```

Either everything succeeds or nothing does.

### Critical architectural rule:

All note modifications must pass through the same local mutation pipeline:

```text
User edits note
  ↓
Local transaction
  ↓
Update note
  ↓
Create change
  ↓
Commit
  ↓
UI updates immediately
  ↓
Sync engine uploads later
```

Do not create one code path for online editing and another for offline editing. That creates synchronization bugs.

---

## 7. Online Mode Behavior

Even when online, prefer:

```text
User action
  ↓
Local save
  ↓
UI immediately updates
  ↓
Background sync
```

rather than:

```text
User action
  ↓
Wait for server
  ↓
Update UI
```

This provides a consistent offline-first architecture.

---

## 8. Offline Indicator

The application should clearly show connection status:

```text
● Synced            → green
● Syncing...        → yellow/amber
● Offline — changes saved → gray
```

### Potential UI:

```text
● Synced
● Syncing
● Offline — changes saved
```

---

## 9. Pending Changes Indicator

If the user has unsynchronized edits:

```text
3 changes waiting to sync
```

This provides confidence that their edits were not lost.

### Expanded view (on tap/click):

```text
Pending:
• Created "Shopping"
• Edited "Ideas"
• Deleted "Old note"
```

---

## 10. UX Principles

### Principle 1: "My note was saved"

The user should feel:

> "My note was saved."

not:

> "The server accepted my note."

The synchronization status is displayed separately from the save confirmation.

### Principle 2: Offline is not data loss

A device can be:

```text
offline + fully locally saved
```

This is not data loss. The UI must never show "Save failed" when the note was successfully saved locally.

### Principle 3: Failure UX

Bad:

```text
ERROR 500
```

Good:

```text
Saved on this device.
Waiting for connection...
```

If conflict occurs:

```text
Saved, but another device changed this note.

Review conflict
```

### Principle 4: Consistent code path

One code path for all mutations, whether online or offline. The sync engine handles network communication asynchronously.

---

## 11. Local Database Contents

The local database should contain:

```text
notes
revisions
pending_changes
devices
sync_state
conflicts
permissions/cache
```

### Web (IndexedDB):

Use a browser-supported persistent database through an appropriate abstraction (Dexie.js recommended).

### Mobile (SQLite):

Use a durable embedded database appropriate to the platform.

---

## 12. Repository Pattern

Both clients expose equivalent operations:

```js
notesRepository.create(note)
notesRepository.get(noteId)
notesRepository.update(note)
notesRepository.delete(note)
notesRepository.restore(note)
notesRepository.list()
notesRepository.getRevisionHistory(noteId)
```

The UI should not know whether it is using SQLite or IndexedDB. The underlying implementation differs by platform but the interface is consistent.

---

## 13. Local Transaction API

```js
database.transaction(async () => {
  await notesRepository.update(note);
  await changesRepository.insert(change);
});
```

Either everything commits or everything rolls back.

---

## 14. Multiple Browser Tabs

The web application may be opened in multiple tabs. Both represent the same device/session.

### Coordination:

Use a browser coordination mechanism such as:

```text
BroadcastChannel
```

or another tab coordination strategy.

### Problem to prevent:

```text
Tab A cursor = 100
Tab B cursor = 120
→ corruption
```

The local database must be transaction-safe across tabs.

---

## 15. Offline Undo

Undo must also work offline. It becomes another queued change.

```text
Revision 15
  ↓
Undo
  ↓
Revision 16 (new change queued for sync)
```

This maintains auditability. Undo creates a new revision rather than deleting history.

---

## 16. Application Layers Summary

```text
UI
  ├── Note Editor
  ├── Note List
  ├── Device Manager
  ├── Conflict UI
  └── Sync Status
  ↓
Application State (Hooks / Controllers)
  ↓
Domain Services
  ├── NoteService
  ├── SyncService
  ├── ConflictService
  └── DeviceService
  ↓
Repositories
  ├── NotesRepository
  ├── RevisionsRepository
  ├── ChangesRepository
  └── SyncStateRepository
  ↓
Local Database
  ├── IndexedDB (web)
  └── SQLite (mobile)
  ↓
Sync Engine
  ↓
Network Layer (HTTPS)
```

---

## 17. Sync Triggers

Synchronization should be triggered by:

```text
application startup
network reconnect
manual refresh
periodic background sync
local change (optional immediate attempt)
WebSocket notification (notification only, not authoritative)
device pairing completion
```

### WebSocket notification handling:

```text
Device A changes note
  ↓
Server commits change
  ↓
Server sends: workspace.changed
  ↓
Device B wakes sync engine
  ↓
Device B pulls changes via REST API
```

WebSocket is a notification channel, not the synchronization mechanism itself.

---

## 18. Technology Decisions

| Area | Decision |
|------|----------|
| Web framework | Next.js + JavaScript |
| Mobile framework | React Native + Expo + JavaScript |
| Web local DB | IndexedDB (Dexie.js) |
| Mobile local DB | SQLite (WatermelonDB or wrapper) |
| Sync engine | Shared platform-independent logic |
| Validation | Zod (runtime validation) |
| Monorepo | pnpm + Turborepo |
