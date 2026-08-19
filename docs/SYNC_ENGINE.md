# Synced Notepad — Synchronization Engine

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Technical Specification

---

## 1. Purpose

This document defines how notes and related state synchronize between mobile applications, web applications, future desktop applications, the synchronization server, and MongoDB.

The most important requirement is:

> **A successfully persisted local change must never silently disappear.**

---

## 2. Core Concepts

The synchronization system is based on five concepts:

```text
Note
Revision
Change
Sync Cursor
Conflict
```

### Note

Represents the current logical state. Does not contain the complete historical record.

### Revision

Represents a historical state of a note. Revisions are immutable — once created, a revision must never be modified.

### Change

Represents an operation performed by a device. The change is the synchronization unit.

### Sync Cursor

Tells a device how far through the server's change stream it has synchronized.

### Conflict

Occurs when a change is based on an older revision than the server's current revision and cannot safely be automatically merged.

---

## 3. Fundamental Rules

1. **Local First** — User actions are first committed locally. Never require an active network connection to create or edit a note.
2. **Local Persistence Before Network** — Save locally first, then sync. The network request may fail before the local save occurs.
3. **Changes Are Durable** — A pending change must survive application restart, device restart, network failure, API timeout, and server restart.
4. **Changes Are Idempotent** — Every change has a globally unique `changeId`. Submitting the same change multiple times must not create multiple logical operations.
5. **History Is Immutable** — Never rewrite an existing revision. Conflict resolution creates a new revision.
6. **Server Is the Synchronization Authority** — Clients can create local changes optimistically. The server determines whether those changes become part of the synchronized workspace state.

---

## 4. Offline-First Architecture

```text
                 Local Database
                       │
        ┌──────────────┴──────────────┐
        │                             │
    Notes                         Changes
        │                             │
        └──────────────┬──────────────┘
                       │
                  Sync Engine
                       │
                  Internet
                       │
                    Server
```

The user should never need an internet connection merely to write a note.

---

## 5. Sync Model (Change/Event Based)

Synchronization is based on changes/events rather than repeatedly uploading the entire database.

Device A creates Change 101, Change 102, Change 103. Server stores the changes. Device B asks "give me changes after sequence 100" and receives 101, 102, 103.

### Change Structure

```json
{
  "change_id": "chg_123",
  "workspace_id": "ws_123",
  "device_id": "dev_phone",
  "actor_id": "actor_123",
  "entity_type": "note",
  "entity_id": "note_456",
  "operation": "update",
  "timestamp": "2026-08-10T10:30:00Z",
  "base_revision": 14,
  "new_revision": 15,
  "payload": {},
  "client_sequence": 102
}
```

---

## 6. Idempotency

This is critical. Networks fail. A device may send Change 100 and receive no response. The device does not know whether the server received it. It may send Change 100 again.

**The server must not create duplicate changes.**

Every change needs a globally unique ID (UUID). Server behavior:

```text
if change_id already exists:
    return existing result
else:
    process change
```

---

## 7. Sync States

The sync engine has explicit states:

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

Failure from any state:

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

## 8. Sync Triggers

Synchronization is triggered by:

- Application startup
- Network reconnect
- Manual refresh
- Periodic background sync
- Local change
- WebSocket notification
- Device pairing completion

**Important rule:** A local change should NOT wait for the network.

```text
Correct:
User edits → Save locally → UI updates → Queue change → Sync later

Incorrect:
User edits → Wait for server → Update UI
```

---

## 9. Pull Flow

Client sends cursor position, server returns changes since that cursor.

```http
POST /api/v1/sync/pull
```

```json
{
  "workspaceId": "workspace_1",
  "cursor": 1200,
  "limit": 500
}
```

Server returns changes with next cursor and hasMore flag. Client validates, applies changes, updates cursor, and commits — all within a transaction.

---

## 10. Cursor Safety

The client must only advance its cursor after changes are successfully applied.

```text
Correct:
Download → Validate → Apply → Commit → Advance cursor

Incorrect:
Download → Advance cursor → Crash → Changes lost
```

The logical transaction is:

```text
BEGIN
  apply change 101
  apply change 102
  ...
  apply change 150
  update sync cursor
COMMIT
```

If the operation fails, ROLLBACK. The client retries from the original cursor.

---

## 11. Push Flow

Client uploads pending changes. The server processes each idempotently:

```text
A → accepted
B → conflict
C → accepted
```

The client must process results individually. A failed change must not prevent unrelated changes from being processed (unless there is a dependency).

---

## 12. Server Processing

For each incoming change:

```text
Receive → Authenticate → Authorize → Validate → Check idempotency
→ Load note → Check revision → Detect conflict → Apply or create conflict
→ Create revision → Create change record → Create audit record → Commit
```

An accepted change atomically performs: update current note + create revision + create change record + assign server sequence + create audit event.

---

## 13. Server Sequence

Every workspace maintains a monotonically increasing `currentSequence`. Every accepted synchronization event receives the next sequence number. Clients synchronize based on this sequence.

Do not use `updatedAt > lastSyncTime` as the primary synchronization mechanism — timestamps introduce problems with clock differences, precision, simultaneous changes, and ordering.

---

## 14. Retry Strategy

Network failures use exponential backoff:

```text
1 second → 2 seconds → 4 seconds → 8 seconds → 16 seconds → 30 seconds → 60 seconds
```

With jitter to avoid many clients reconnecting simultaneously. Do not permanently delete a failed change merely because retries have failed. A change may enter `failed` but must remain recoverable.

---

## 15. WebSocket as Notification Channel

WebSocket should not become a second synchronization system. Use it as a notification channel only.

```text
Device A changes note
    ↓
Server commits change
    ↓
Server sends: workspace.changed
    ↓
Device B wakes sync engine
    ↓
Device B pulls changes
```

If WebSocket disconnects, nothing is lost — Device B can later execute `pull(cursor)`. The server remains the source of synchronization history.

---

## 16. Sync Protocol Overview

The synchronization cycle:

```text
Connectivity detected
    ↓
Acquire sync lock
    ↓
Authenticate
    ↓
Pull remote changes
    ↓
Apply remote changes
    ↓
Push local changes
    ↓
Resolve server responses
    ↓
Update cursor
    ↓
Release sync lock
```

Only one synchronization process should operate against a local database at a time (sync lock).

---

## 17. Conflict Detection

Three levels:

1. **Exact Same Result** — Both changes result in identical content. No meaningful conflict.
2. **Automatically Mergeable** — Changes in independent regions; three-way merge may be possible.
3. **Unmergeable** — Same section changed. Preserve both versions and request user resolution.

---

## 18. Remote Change Application

Changes received from the server must be marked as remote and must not generate new outbound changes. If Device A creates Change X and later receives Change X from the server, it must recognize that it originated locally and not create an echo.

---

## 19. Core Invariants

After all devices synchronize:

1. **No accepted change disappears.**
2. **No change is applied twice logically.**
3. **No unauthorized data reaches a device.**
4. **All resolvable changes converge.**
5. **Unresolvable conflicts remain recoverable.**
6. **Server sequence remains valid.**

---

## 20. Non-Negotiable Requirements

1. Offline note creation must work.
2. Offline edits must work.
3. Local changes must survive app restarts.
4. Every local mutation must have a durable change record.
5. Every change must be idempotent.
6. The server must authorize every synchronization operation.
7. The server must be authoritative for synchronized state.
8. Remote changes must not generate outbound echo changes.
9. The cursor must advance only after successful local application.
10. Conflicting versions must never be silently discarded.
11. Deleted notes must use a synchronization-safe tombstone.
12. Revoked devices must lose server synchronization access.
13. Hidden notes must not be leaked through synchronization.
14. Audit history must preserve attribution.
15. Realtime must never be the only mechanism keeping clients synchronized.
16. A client crash must not corrupt synchronization state.
17. A network failure must not cause local data loss.
18. Conflict resolution must create a new revision.
19. The protocol must tolerate duplicate requests.
20. After successful synchronization and conflict resolution, authorized devices must converge.
