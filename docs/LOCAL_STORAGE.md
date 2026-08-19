# Local Storage

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Specification

---

## 1. Overview

The application follows an offline-first architecture. Each device maintains a local database that allows the user to create, edit, and delete notes without an internet connection. Synchronization is a separate subsystem that operates alongside the local data layer.

```text
Local Database
      │
      ▼
   Sync Engine
      │
      ▼
   Server/API
      │
      ▼
   MongoDB
```

The user should never need an internet connection merely to write a note.

---

## 2. Mobile Local Storage

Mobile uses SQLite as the persistent local database.

```text
React Native
    ↓
Repository
    ↓
SQLite
```

Recommended database abstraction:

```text
WatermelonDB
```

or a simpler SQLite layer for the first implementation.

The UI must never directly manipulate raw SQLite queries. All access goes through the repository pattern.

---

## 3. Web Local Storage

Web uses IndexedDB as the persistent local database.

```text
Next.js
    ↓
Repository
    ↓
IndexedDB
```

Recommended local database abstraction:

```text
Dexie.js
```

The web version should be a Progressive Web App (PWA) or equivalent offline-capable application if offline functionality is required. The browser needs:

- Local persistent storage
- Service worker / app shell
- Local database
- Sync queue

A simple website that depends entirely on server requests cannot provide true offline note editing.

---

## 4. Shared Repository Interface

Both clients should expose equivalent operations through the repository pattern. The UI should not know whether it is using SQLite or IndexedDB.

```js
notesRepository.create(note)
notesRepository.get(noteId)
notesRepository.update(note)
notesRepository.delete(note)
notesRepository.restore(note)
notesRepository.list()
notesRepository.getRevisionHistory(noteId)
```

This allows the sync engine to work against a consistent abstraction regardless of the underlying storage engine. The implementations do not need identical storage engines — only identical logical interfaces.

---

## 5. Local Database Schema

Both platforms maintain equivalent logical stores:

```text
notes
revisions
pending_changes
processed_changes
conflicts
sync_state
```

### Processed Changes

A local processed-change store prevents duplicate application of remote changes:

```js
{
  changeId: String,
  serverSequence: NumberLong,
  processedAt: Date
}
```

Old entries may eventually be compacted once safe.

---

## 6. Local Mutation Pipeline

Every note modification — whether online or offline — must follow the same pipeline:

```text
User action
    ↓
Validate
    ↓
Local transaction
    ↓
Update note
    ↓
Create change
    ↓
Commit
    ↓
UI update
    ↓
Sync queue
```

This pipeline must work whether the device is online or offline. Do not create one code path for online editing and another for offline editing — that creates synchronization bugs.

### Step by Step

1. **User action** — The user creates, edits, or deletes a note.
2. **Validate** — The input is validated against local rules.
3. **Local transaction** — An atomic transaction begins.
4. **Update note** — The note record is updated in the local database.
5. **Create change** — A pending change record is created with a globally unique `changeId`.
6. **Commit** — The local transaction is committed. Either everything succeeds or nothing does.
7. **UI update** — The user interface updates immediately. The user should feel "my note was saved."
8. **Sync queue** — The change is queued for asynchronous synchronization with the server.

---

## 7. Local Transaction

Creating a note must be atomic locally:

```js
await database.transaction(async () => {
  await notesRepository.create(note);
  await revisionsRepository.create(revision);
  await pendingChangesRepository.create(change);
});
```

Either everything succeeds or nothing does. This prevents partial states where a note exists without a corresponding revision or change record.

---

## 8. Why the Change Queue Matters

Never rely on:

```text
"Just upload the current note later."
```

Instead store the actual operation:

```js
{
  changeId: "change_123",
  noteId: "note_123",
  operation: "create",
  baseRevision: null,
  payload: {
    title: "Shopping",
    content: { type: "plain_text", text: "Milk" }
  }
}
```

This means the operation survives:

- App crashes
- Device restarts
- Network failures
- Server failures

The pending change remains in the local database until the server accepts it. If the server already accepted it but the response was lost, the client retries with the same `changeId` and the server responds with `already_processed`. No duplicate note or revision is created.

---

## 9. Local MVP Features

The first working local notepad should implement:

- Create note
- Edit note
- Delete note
- Restore note
- Search notes
- Note list
- Note editor
- Revision metadata
- Local persistence
- Application restart recovery

No server synchronization is needed for this phase. The goal is to establish the local-first architecture and ensure that all note modifications follow the local mutation pipeline.

---

## 10. Offline Indicator

The application should clearly show the synchronization state:

```text
● Synced
● Syncing
● Offline — changes saved
```

If the user has unsynchronized edits:

```text
3 changes waiting to sync
```

This provides confidence that their edits were not lost. A local save is a successful save — synchronization status is a separate concern.

---

## 11. Crash Recovery

If the app crashes after a local save but before server upload, the pending change remains in the local database. After restart:

```text
load pending changes → sync
```

No user data is lost. If the transaction did not commit before the crash, the cursor and local state remain consistent — the user simply retries.
