# SYNC_PROTOCOL.md

# Synced Notepad — Synchronization Protocol

**Project:** Synced Notepad
**Document:** Synchronization Protocol
**Version:** 0.1
**Status:** Initial Technical Specification
**Date:** 2026-08-10

---

# 1. Purpose

This document defines how notes and related state synchronize between:

* Mobile applications
* Web applications
* Future desktop applications
* The synchronization server
* MongoDB

The synchronization system must support:

* Offline operation
* Multiple devices
* Delayed synchronization
* Automatic reconnection
* Concurrent edits
* Conflict detection
* Conflict preservation
* Conflict resolution
* Device-specific visibility
* Device revocation
* Change attribution
* Revision history
* Retry after network failures
* Duplicate requests
* Application crashes
* Server failures

The most important requirement is:

> **A successfully persisted local change must never silently disappear.**

---

# 2. Core Concepts

The synchronization system is based on five concepts:

```text
Note
Revision
Change
Sync Cursor
Conflict
```

These concepts must remain separate.

---

# 3. Note

A note represents the current logical state.

Example:

```js
{
  id: "note_123",
  workspaceId: "workspace_1",
  title: "Shopping",
  content: "Milk and eggs",
  revision: 8,
  createdBy: "user_1",
  updatedBy: "user_1",
  createdAt: "...",
  updatedAt: "..."
}
```

The note represents the current state.

It does not contain the complete historical record.

---

# 4. Revision

A revision represents a historical state of a note.

Example:

```js
{
  id: "revision_8",
  noteId: "note_123",
  workspaceId: "workspace_1",
  revision: 8,
  parentRevision: 7,
  title: "Shopping",
  content: "Milk and eggs",
  actorId: "user_1",
  deviceId: "device_phone",
  createdAt: "..."
}
```

Revisions are immutable.

Once created, a revision must never be modified.

---

# 5. Change

A change represents an operation performed by a device.

Example:

```js
{
  id: "change_abc123",
  workspaceId: "workspace_1",
  deviceId: "device_phone",
  actorId: "user_1",

  entityType: "note",
  entityId: "note_123",

  operation: "update",

  baseRevision: 7,

  payload: {
    title: "Shopping",
    content: "Milk and eggs"
  },

  createdAt: "..."
}
```

The change is the synchronization unit.

---

# 6. Sync Cursor

A sync cursor tells a device how far through the server's change stream it has synchronized.

Example:

```js
{
  workspaceId: "workspace_1",
  deviceId: "device_phone",
  lastServerSequence: 1250
}
```

If the device has processed changes through sequence `1250`, it requests changes after `1250`.

---

# 7. Conflict

A conflict occurs when a change is based on an older revision than the server's current revision and cannot safely be automatically merged.

Example:

```text
Server:
Revision 10

Phone:
baseRevision = 10

Laptop:
baseRevision = 10
```

Phone synchronizes first:

```text
10 → 11
```

Laptop then sends:

```text
baseRevision = 10
```

The server sees:

```text
currentRevision = 11
baseRevision = 10
```

This requires conflict evaluation.

---

# 8. Fundamental Rules

The synchronization system must obey these rules.

## Rule 1 — Local First

User actions are first committed locally.

```text
User action
    ↓
Local database
    ↓
Change queue
    ↓
Server
```

Never require an active network connection to create or edit a note.

---

## Rule 2 — Local Persistence Before Network

This is invalid:

```text
User edit
    ↓
Send API request
    ↓
Save locally
```

The network request may fail before the local save occurs.

Correct:

```text
User edit
    ↓
Local transaction
    ├── Update note
    └── Create pending change
          ↓
       Commit
          ↓
       Network
```

---

## Rule 3 — Changes Are Durable

A pending change must survive:

* Application restart
* Device restart
* Network failure
* API timeout
* Server restart

---

## Rule 4 — Changes Are Idempotent

Every change has a globally unique `changeId`.

Submitting the same change multiple times must not create multiple logical operations.

---

## Rule 5 — History Is Immutable

Never rewrite an existing revision.

Conflict resolution creates a new revision.

---

## Rule 6 — Server Is the Synchronization Authority

Clients can create local changes optimistically.

The server determines whether those changes can become part of the synchronized workspace state.

---

# 9. Client Architecture

Each client contains:

```text
UI
 │
 ▼
Domain Layer
 │
 ▼
Local Repository
 │
 ├── Notes
 ├── Revisions
 ├── Pending Changes
 └── Sync Cursor
 │
 ▼
Sync Engine
 │
 ▼
Network
```

The UI should not communicate directly with the sync API.

---

# 10. Local Database

The local database must contain at least:

```text
notes
revisions
pending_changes
sync_state
conflicts
devices
```

---

# 11. Pending Change

Example:

```js
{
  changeId: "change_123",

  workspaceId: "workspace_1",
  deviceId: "device_phone",
  actorId: "user_1",

  entityType: "note",
  entityId: "note_123",

  operation: "update",

  baseRevision: 4,

  payload: {
    title: "Shopping",
    content: "Milk"
  },

  status: "pending",

  createdAt: "...",
  lastAttemptAt: null,
  attemptCount: 0
}
```

Possible statuses:

```text
pending
sending
accepted
conflict
failed
```

---

# 12. Local Transaction

Every user mutation should be one local transaction.

For example:

```text
UPDATE notes
+
INSERT pending_changes
```

Both succeed or both fail.

Never allow:

```text
Note updated
but change not queued
```

because that creates unsynchronizable local state.

---

# 13. Creating a Note

User creates:

```text
Shopping
```

Client performs:

```text
1. Generate note ID
2. Create note locally
3. Create local revision
4. Create change
5. Add change to pending queue
6. Commit transaction
7. UI updates
```

No network is required.

---

# 14. Editing a Note

Suppose:

```text
Revision = 4
```

User changes content.

The client:

```text
1. Read current revision
2. Update local note
3. Create local revision
4. Create change with baseRevision = 4
5. Queue change
6. Commit
```

---

# 15. Deleting a Note

Deletion should initially use a tombstone rather than immediately removing the record.

Example:

```js
{
  id: "note_123",
  deletedAt: "...",
  revision: 9
}
```

This allows deletion to synchronize correctly across offline devices.

---

# 16. Tombstones

A tombstone is a record indicating that an entity was deleted.

Without tombstones, this scenario becomes dangerous:

```text
Device A:
delete note

Device B:
offline
still has old note

Device B:
reconnects
```

Without deletion information, Device B may incorrectly recreate the note.

---

# 17. Restore

Restoring a deleted note creates a new revision.

Example:

```text
Revision 8
    ↓
Delete → Revision 9
    ↓
Restore → Revision 10
```

---

# 18. Synchronization Overview

The synchronization cycle is:

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

The exact pull/push ordering may be optimized later, but correctness must remain equivalent.

---

# 19. Sync Lock

Only one synchronization process should operate against a local database at a time.

Example:

```text
Sync #1 running

Sync #2 requested

→ Sync #2 waits
```

This prevents duplicate concurrent local processing.

---

# 20. Pull Operation

Client sends:

```http
POST /sync/pull
```

Conceptual payload:

```json
{
  "workspaceId": "workspace_1",
  "cursor": 1200,
  "limit": 500
}
```

Server returns:

```json
{
  "changes": [],
  "nextCursor": 1250,
  "hasMore": true
}
```

---

# 21. Pull Authorization

The server must filter changes based on the device's current permissions.

A device must not receive:

* Revoked workspace data
* Hidden note content
* Unauthorized revisions
* Unauthorized audit information

---

# 22. Pull Processing

The client must process the response transactionally.

```text
Receive changes
    ↓
Validate
    ↓
Check permissions
    ↓
Apply changes
    ↓
Update local state
    ↓
Update cursor
    ↓
Commit
```

The cursor must not advance before successful application.

---

# 23. Crash During Pull

Scenario:

```text
Download changes 1001–1100

Apply 1001–1050

Application crashes
```

After restart:

```text
Cursor remains 1000
```

The client downloads:

```text
1001–1100
```

again.

Already-applied changes must be safely ignored using change IDs/revision checks.

This is why idempotency is required.

---

# 24. Push Operation

Client sends:

```http
POST /sync/push
```

Payload:

```json
{
  "workspaceId": "workspace_1",
  "changes": [
    {
      "changeId": "change_123",
      "entityType": "note",
      "entityId": "note_1",
      "operation": "update",
      "baseRevision": 4,
      "payload": {}
    }
  ]
}
```

---

# 25. Server Push Processing

For each change:

```text
Authenticate
    ↓
Authorize
    ↓
Check change ID
    ↓
Check entity
    ↓
Check base revision
    ↓
Determine conflict
    ↓
Accept OR reject/conflict
    ↓
Persist result
```

---

# 26. Duplicate Change

If:

```text
changeId = ABC
```

has already been processed:

```text
POST ABC
```

again should return the original logical result.

Example:

```json
{
  "changeId": "ABC",
  "status": "already_processed",
  "serverSequence": 1500
}
```

---

# 27. Server Atomicity

An accepted change should atomically perform:

```text
Update current note
+
Create revision
+
Create change record
+
Assign server sequence
+
Create audit event
```

If any required operation fails, the transaction should not partially apply.

---

# 28. Server Sequence

Every accepted synchronization event receives a monotonically increasing server sequence.

Example:

```text
1501
1502
1503
1504
```

This provides a stable synchronization cursor.

The sequence must be assigned by the server.

Clients must never invent server sequences.

---

# 29. Sequence Scope

Initial implementation should use:

```text
workspace-level sequence
```

Example:

```text
Workspace A:
1001
1002
1003

Workspace B:
5001
5002
```

This keeps synchronization scoped to a workspace.

---

# 30. Basic Synchronization Example

Initial state:

```text
Server:
0 notes

Phone:
0 notes

Web:
0 notes
```

Phone offline:

```text
Note A
Note B
```

Local phone:

```text
2 notes
2 pending changes
```

Web offline:

```text
Note C
Note D
Note E
```

Web:

```text
3 notes
3 pending changes
```

Both reconnect.

After synchronization:

```text
Phone:
A
B
C
D
E

Web:
A
B
C
D
E

Server:
A
B
C
D
E
```

This is a mandatory acceptance test.

---

# 31. Concurrent Note Creation

If two devices create different notes:

```text
Phone:
Note A

Web:
Note B
```

No conflict exists.

Both changes are accepted.

Result:

```text
A
B
```

---

# 32. Concurrent Updates

Initial:

```text
Revision 10
Content:
Hello
```

Phone:

```text
baseRevision = 10
content = Hello Phone
```

Laptop:

```text
baseRevision = 10
content = Hello Laptop
```

Phone arrives first.

Server:

```text
10 → 11
```

Laptop arrives.

Server sees:

```text
baseRevision = 10
currentRevision = 11
```

Conflict detection begins.

---

# 33. Conflict Detection Levels

Use three levels.

## Level 1 — Exact Same Result

If both changes result in identical content:

```text
Phone:
Hello world

Laptop:
Hello world
```

No meaningful conflict.

The server may treat the second change as already converged.

---

## Level 2 — Automatically Mergeable

Example:

Base:

```text
Hello
```

Phone:

```text
Hello world
```

Laptop:

```text
Hello!
```

If changes occur in independent regions, a three-way merge may be possible.

---

## Level 3 — Unmergeable

Example:

Base:

```text
Hello world
```

Phone:

```text
Hello phone
```

Laptop:

```text
Hello laptop
```

The system should preserve both versions and request user resolution.

---

# 34. Conflict Object

Example:

```js
{
  id: "conflict_123",

  workspaceId: "workspace_1",
  noteId: "note_1",

  baseRevision: 10,

  versions: [
    {
      revision: 11,
      deviceId: "phone",
      actorId: "user_1",
      content: "Hello phone"
    },
    {
      revision: 12,
      deviceId: "laptop",
      actorId: "user_1",
      content: "Hello laptop"
    }
  ],

  status: "open",

  createdAt: "..."
}
```

---

# 35. Conflict Preservation

The losing version must never simply be deleted.

A conflict must remain recoverable until resolved.

---

# 36. Conflict Resolution

Supported initial actions:

```text
Keep Phone
Keep Laptop
Merge
Keep Both
```

The resolution creates a new revision.

---

# 37. Resolution Example

```text
Base revision 10

Phone revision 11
Laptop revision 12

Conflict

User selects Phone

New revision 13
```

Revision 13 becomes the current canonical version.

---

# 38. Keep Both

If the user chooses:

```text
Keep Both
```

the application may create a new note from one of the versions.

Example:

```text
Original note
Original note — Phone version
```

This behavior should be explicit and auditable.

---

# 39. Conflict Resolution Synchronization

After resolving:

```text
Device A
    ↓
resolution change
    ↓
Server
    ↓
new canonical revision
    ↓
Device B
```

All devices eventually converge.

---

# 40. Delete vs Edit

This is a critical edge case.

Initial:

```text
Revision 10
```

Phone:

```text
DELETE
baseRevision = 10
```

Laptop:

```text
EDIT
baseRevision = 10
```

Possible server result:

```text
CONFLICT
```

Do not silently allow the delete to destroy the edit.

---

# 41. Delete vs Delete

If both devices delete the same note:

```text
Phone DELETE
Laptop DELETE
```

This should normally converge to:

```text
deleted
```

without creating a user-visible conflict.

---

# 42. Restore vs Delete

Example:

```text
Phone:
restore

Laptop:
delete
```

If both are based on the same revision, treat this as a conflict requiring explicit resolution unless deterministic policy is established.

---

# 43. Rename vs Content Edit

If the note has separate fields:

```text
title
content
```

and devices independently modify different fields:

```text
Phone:
title changed

Laptop:
content changed
```

the system should be able to automatically merge these changes.

---

# 44. Field-Level Merge

Where safe, compare:

```text
Base
Phone
Laptop
```

For each field:

```text
Phone changed?
Laptop changed?
Both changed?
```

Rules:

```text
Neither:
use base

Phone only:
use phone

Laptop only:
use laptop

Both same:
use either

Both different:
conflict
```

This is safer than blindly choosing one entire document.

---

# 45. Future Rich Text

The initial protocol should treat note content as a structured field.

Do not design the protocol specifically around plain text only.

Future content could contain:

```js
{
  type: "document",
  blocks: []
}
```

This allows the editor to evolve without completely replacing synchronization.

---

# 46. Offline Queue

Pending changes must remain ordered.

Example:

```text
Change 1
Change 2
Change 3
```

If Change 2 depends on Change 1 locally, the client must not send them in a way that breaks their logical dependency.

---

# 47. Queue Compaction

Later optimization may combine changes.

Example:

```text
Edit:
A
↓
AB
↓
ABC
↓
ABCD
```

could potentially become:

```text
final state:
ABCD
```

However, do not implement aggressive compaction until the basic protocol is proven.

Historical revision requirements may prevent certain compactions.

---

# 48. Retry Strategy

Network failures should use exponential backoff.

Conceptually:

```text
1 sec
2 sec
4 sec
8 sec
16 sec
...
```

Add jitter to avoid many clients reconnecting simultaneously.

---

# 49. Retry Limits

Do not permanently delete a failed change merely because retries have failed.

A change may enter:

```text
failed
```

but must remain recoverable.

---

# 50. Permanent Failure

Examples:

```text
device revoked
workspace deleted
authorization failure
invalid change
```

These require special handling.

The client must explain the failure rather than endlessly retrying.

---

# 51. Network Recovery

When connectivity returns:

```text
network online
    ↓
schedule sync
    ↓
acquire lock
    ↓
pull
    ↓
push
    ↓
repeat if necessary
```

Do not assume a network-online event guarantees the network is actually usable.

---

# 52. Realtime Notifications

Realtime should be treated as an optimization.

Example:

```text
Server
  ↓
Realtime event
  ↓
"Workspace changed"
  ↓
Client starts sync
```

If realtime fails:

```text
Client still synchronizes
```

using:

```text
manual sync
startup sync
periodic sync
network recovery sync
```

---

# 53. Realtime Must Not Carry the Source of Truth

Do not depend on:

```text
WebSocket event = complete state
```

Instead:

```text
WebSocket:
"new changes exist"

Sync API:
"here are the authoritative changes"
```

---

# 54. Sync Triggers

Synchronization should occur on:

```text
Application startup
Login
Workspace opened
Network reconnect
Manual refresh
Realtime notification
Periodic background opportunity
After local change while online
```

---

# 55. Background Sync

Background synchronization is platform-dependent.

It should be treated as a best-effort optimization.

The system must remain correct even if background execution is unavailable.

---

# 56. Device Revocation

If the server determines:

```text
device.status = REVOKED
```

then:

```text
push → rejected
pull → rejected
realtime → disconnected
```

The local application should transition to:

```text
Device access revoked
```

---

# 57. Revoked Device With Offline Changes

This is a critical edge case.

Scenario:

```text
Phone goes offline

Phone creates:
A
B
C

Owner revokes Phone

Phone reconnects
```

The server must not accept those changes merely because they were created while the device was previously authorized.

The device must be re-authorized before its pending changes can be incorporated.

However:

> The local changes must not be deleted automatically.

They should remain recoverable/exportable or be presented through a recovery flow.

---

# 58. Device-Specific Visibility

Suppose:

```text
Note A
```

is hidden from:

```text
Laptop
```

The server must ensure the laptop does not receive:

```text
Note A content
Note A revisions
Note A conflict versions
```

unless the authorization policy explicitly allows metadata-only visibility.

---

# 59. Visibility Change

If Phone changes:

```text
Note A:
visible → hidden
```

for Laptop:

```text
Server
    ↓
visibility change
    ↓
Laptop synchronizes
    ↓
Note removed from accessible local dataset
```

---

# 60. Local Deletion Due to Visibility

When a device loses permission to a note, its local copy should be removed or cryptographically rendered inaccessible according to the chosen security model.

For the initial implementation:

```text
remove accessible local copy
```

and retain only minimal metadata if needed.

---

# 61. Hidden Note Reappears

If visibility changes:

```text
hidden → visible
```

the device performs a normal authorized pull and receives the current accessible state.

---

# 62. Ownership Changes

If workspace ownership changes:

```text
Owner A
   ↓
Owner B
```

the server updates workspace authorization.

Devices should not assume ownership forever.

Authorization must be checked server-side.

---

# 63. Audit Events

Every important synchronization operation should be auditable.

Examples:

```text
note.created
note.updated
note.deleted
note.restored
device.paired
device.revoked
visibility.changed
conflict.created
conflict.resolved
workspace.owner_changed
```

---

# 64. Audit vs Change Log

These are different.

### Change log

Used for:

```text
synchronization
```

### Audit log

Used for:

```text
human-readable history
security
accountability
```

Do not assume they are interchangeable.

---

# 65. Authentication

Every sync request must be authenticated.

The request should identify:

```text
user
device
workspace
session
```

The server must not trust IDs supplied by the client without verification.

---

# 66. Device Identity

Each registered device receives a unique device ID.

Example:

```text
device_phone_abc
```

The ID should not simply be a user-controlled name.

The display name can be:

```text
"My Phone"
```

while the internal identity remains immutable.

---

# 67. Pairing and Synchronization

Pairing establishes authorization.

Synchronization uses that authorization.

They are separate processes.

```text
QR pairing
    ↓
Device authorized
    ↓
Device receives credentials
    ↓
Initial sync
```

---

# 68. Initial Sync

A newly paired device starts with:

```text
cursor = 0
```

or an appropriate workspace snapshot cursor.

It then downloads all data it is authorized to access.

---

# 69. Large Initial Sync

For large workspaces:

```text
batch 1
batch 2
batch 3
...
```

The client must persist progress.

If it crashes at batch 5:

```text
resume
```

rather than restarting unnecessarily.

---

# 70. Snapshot Optimization

Future optimization:

```text
Workspace snapshot
+
changes after snapshot
```

This may be required for very large workspaces.

Do not implement until normal incremental synchronization is proven.

---

# 71. Data Ordering

The server's change sequence provides ordering.

Clients should not depend on:

```text
client timestamps
```

for synchronization ordering.

Client clocks can be incorrect.

---

# 72. Timestamps

Use server timestamps for authoritative events.

Client timestamps can still be retained for:

```text
local UX
```

but must not determine synchronization correctness.

---

# 73. Clock Skew

The protocol must work if:

```text
Phone clock:
wrong by 2 hours

Laptop clock:
wrong by 1 day
```

Synchronization must still be correct.

---

# 74. Change IDs

Change IDs must be unique enough to prevent collisions.

Recommended approach:

```text
UUID
```

or another cryptographically strong unique identifier.

---

# 75. Client-Generated IDs

Notes and changes should use client-generated IDs where possible.

This allows offline creation without waiting for the server.

Example:

```text
Phone offline
    ↓
generate note ID
    ↓
create locally
```

Later:

```text
server accepts same ID
```

---

# 76. Collision Handling

If a client-generated ID somehow collides:

```text
server detects collision
```

The operation must fail safely rather than overwriting another entity.

---

# 77. Server Validation

Never trust the client to correctly report:

```text
workspaceId
deviceId
actorId
baseRevision
visibility
permissions
```

The server determines these from authenticated context and stored state.

---

# 78. Malicious Client

Assume clients can be modified.

A malicious client might send:

```json
{
  "workspaceId": "someone_else",
  "deviceId": "owner_device",
  "actorId": "owner"
}
```

The server must ignore spoofed identity fields.

---

# 79. Synchronization Error Categories

Errors should be classified.

```text
NETWORK_ERROR
AUTH_ERROR
DEVICE_REVOKED
PERMISSION_DENIED
INVALID_CHANGE
CONFLICT
SERVER_ERROR
RATE_LIMITED
STORAGE_ERROR
```

---

# 80. Client Handling

### Network error

Retry.

### Server error

Retry with backoff.

### Rate limited

Respect retry-after.

### Authentication failure

Refresh/re-authenticate.

### Device revoked

Stop synchronization.

### Conflict

Store conflict.

### Invalid change

Do not endlessly retry.

---

# 81. Sync State Machine

Client synchronization can be modeled as:

```text
IDLE
 │
 ▼
STARTING
 │
 ▼
AUTHENTICATING
 │
 ▼
PULLING
 │
 ▼
APPLYING
 │
 ▼
PUSHING
 │
 ├── ACCEPTED
 │
 ├── CONFLICT
 │
 └── ERROR
 │
 ▼
FINALIZING
 │
 ▼
IDLE
```

---

# 82. Conflict State

A workspace may have:

```text
sync status = conflict
```

but synchronization should continue for unrelated notes.

One conflict must not block all synchronization.

---

# 83. Partial Failure

Example:

```text
10 pending changes

1–7 accepted
8 conflict
9–10 accepted
```

The client should preserve:

```text
1–7 complete
8 conflict
9–10 complete
```

rather than treating the entire batch as failed.

---

# 84. Batch Processing

Batches should be used for performance.

However:

> A batch is not one logical transaction if its changes are independent.

The server should return per-change results.

---

# 85. Example Push Response

```json
{
  "results": [
    {
      "changeId": "A",
      "status": "accepted",
      "serverSequence": 1001
    },
    {
      "changeId": "B",
      "status": "conflict",
      "conflictId": "conflict_1"
    },
    {
      "changeId": "C",
      "status": "accepted",
      "serverSequence": 1003
    }
  ]
}
```

---

# 86. Client Queue After Push

After processing:

```text
A → remove from pending
B → move to conflicts
C → remove from pending
```

No unrelated change should be lost.

---

# 87. Infinite Loop Prevention

Avoid:

```text
download
apply
upload
download
apply
upload
...
```

Changes received from the server should be marked as remote and should not automatically generate new equivalent outgoing changes.

---

# 88. Remote Change Application

A remote change should:

```text
update local note
+
store revision
+
record change as processed
```

but must not create a new outbound change.

---

# 89. Echo Prevention

If:

```text
Device A
creates Change X
```

and later receives Change X from the server, it must recognize that it originated locally.

Do not create:

```text
Change X'
```

from the server echo.

---

# 90. Server Change Log Retention

The change log should not necessarily be kept forever in the same operational collection.

Future policies may include:

```text
hot changes
archived changes
snapshots
```

Retention must never compromise devices that have not synchronized yet.

---

# 91. Stale Device

A device that has not synchronized for a very long time may have an old cursor.

Example:

```text
Server:
10 million changes

Device:
cursor 10
```

The server may require:

```text
full snapshot
```

instead of replaying millions of changes.

---

# 92. Snapshot Recovery

If incremental synchronization is no longer practical:

```text
Server snapshot
    ↓
Device replaces local synchronized state
    ↓
Pending local changes preserved
    ↓
Pending changes re-evaluated
```

This must be implemented carefully.

---

# 93. Local Storage Failure

If SQLite/IndexedDB becomes corrupted:

The application should not blindly upload potentially inconsistent state.

Possible recovery:

```text
detect corruption
    ↓
preserve/export pending changes if possible
    ↓
rebuild local database
    ↓
perform initial sync
```

---

# 94. Browser Storage

Web applications must account for browser storage limitations.

The web client should:

* Detect storage availability
* Handle quota errors
* Avoid assuming unlimited IndexedDB
* Provide recovery behavior
* Never silently discard pending changes

---

# 95. Mobile Storage

The mobile application should handle:

```text
low disk space
database errors
application termination
OS background termination
```

The sync system must assume the app can be killed at any time.

---

# 96. Application Crash Safety

Every important local state transition should be transactional.

If the application crashes:

```text
before commit:
old state

after commit:
new state
```

Never:

```text
half updated note
+
missing change
```

---

# 97. Security Boundary

The server is the final authority for:

```text
workspace membership
device authorization
visibility
ownership
revocation
```

The local database is not a security boundary.

---

# 98. End-to-End Encryption

E2EE is not part of the initial synchronization protocol.

However, the architecture should avoid making it impossible later.

Potential future model:

```text
encrypted note payload
+
encrypted revisions
+
device keys
```

This would significantly change search, conflict resolution, server-side validation, and recovery.

It should therefore be designed separately.

---

# 99. Initial Consistency Model

The application uses:

> **Eventual consistency with server-authoritative conflict resolution.**

This means devices may temporarily contain different states while offline.

After synchronization:

```text
authorized devices
        ↓
eventually converge
```

---

# 100. What "Synced" Means

A device is considered synced when:

```text
No pending changes
+
No unapplied remote changes
+
Current sync cursor processed
+
No unresolved synchronization errors
```

A device may still have user-visible unresolved conflicts.

Therefore:

```text
Synced
```

does not necessarily mean:

```text
No conflicts exist
```

---

# 101. Sync Status Model

Recommended:

```text
OFFLINE
SYNCING
SYNCED
ERROR
CONFLICT
REVOKED
```

---

# 102. Example User Experience

### Offline

```text
○ Offline

Changes saved locally.
```

### Syncing

```text
↻ Syncing...
```

### Synced

```text
✓ Synced just now
```

### Conflict

```text
! 1 conflict requires attention
```

### Error

```text
⚠ Sync failed
Retry
```

---

# 103. Testing Strategy

The sync protocol must be tested independently from the UI.

Tests should simulate:

```text
Device A
Device B
Device C
Server
```

---

# 104. Mandatory Test Cases

## Basic

* [ ] Create note online
* [ ] Create note offline
* [ ] Edit note online
* [ ] Edit note offline
* [ ] Delete note
* [ ] Restore note

## Multi-device

* [ ] A creates → B receives
* [ ] B creates → A receives
* [ ] A creates 2 offline
* [ ] B creates 3 offline
* [ ] Both reconnect → 5 total

## Reliability

* [ ] Request timeout
* [ ] Duplicate request
* [ ] Server restart
* [ ] Client restart
* [ ] Crash during pull
* [ ] Crash during push
* [ ] Network disconnect during sync

## Conflicts

* [ ] Concurrent edit
* [ ] Delete vs edit
* [ ] Rename vs rename
* [ ] Field-level merge
* [ ] Conflict resolution

## Security

* [ ] Revoked device
* [ ] Unauthorized workspace
* [ ] Hidden note
* [ ] Spoofed device ID
* [ ] Spoofed actor ID

---

# 105. Randomized Synchronization Testing

Create a simulation engine.

Example:

```text
Device A:
create
edit
disconnect
edit
reconnect

Device B:
create
disconnect
edit
reconnect

Device C:
delete
reconnect
```

Randomize:

```text
operation order
network delays
packet duplication
network failures
client crashes
```

Then verify invariants.

---

# 106. Core Test Invariants

After all devices synchronize:

### Invariant A

No accepted change disappears.

### Invariant B

No change is applied twice logically.

### Invariant C

No unauthorized data reaches a device.

### Invariant D

All resolvable changes converge.

### Invariant E

Unresolvable conflicts remain recoverable.

### Invariant F

Server sequence remains valid.

---

# 107. Example Full Simulation

Initial:

```text
Note:
"Hello"

Revision:
1
```

Device A offline:

```text
"Hello A"
```

Device B offline:

```text
"Hello B"
```

Device C offline:

```text
"Hello C"
```

Reconnect order:

```text
B
C
A
```

The system must preserve all three versions.

Expected:

```text
Revision 1
   ├── Revision 2 (B)
   ├── Revision 3 (C)
   └── Revision 4 (A)
```

Depending on merge results, the server may create conflict records.

Nothing is silently overwritten.

---

# 108. Performance Goals

Initial targets:

```text
Local note save:
< 50ms target

Normal sync:
< 2 seconds target

Small workspace initial sync:
< 5 seconds target

UI should remain responsive during synchronization.
```

These are engineering targets, not correctness requirements.

---

# 109. Future Optimization

After correctness:

```text
parallel pull processing
batch compression
snapshot synchronization
change compaction
delta updates
binary transport
background sync
WebSocket optimization
```

Do not optimize prematurely.

---

# 110. Protocol Versioning

Every sync API should support protocol versioning.

Example:

```text
syncVersion: 1
```

Future versions can introduce:

```text
syncVersion: 2
```

without immediately breaking older clients.

---

# 111. Client Compatibility

The server should know:

```text
clientVersion
platform
syncProtocolVersion
```

This allows incompatible clients to be blocked or migrated safely.

---

# 112. Migration Principle

Database schema changes must not break existing offline clients.

This is especially important because:

```text
Client may be offline for weeks.
```

Therefore, protocol changes must be backward-compatible where practical.

---

# 113. Final Protocol Summary

The synchronization model is:

```text
                 ┌───────────────┐
                 │  Local Client │
                 └───────┬───────┘
                         │
                  Local transaction
                         │
                         ▼
                Pending Change Queue
                         │
                         ▼
                    Sync Engine
                         │
                  ┌──────┴──────┐
                  │             │
                PULL           PUSH
                  │             │
                  ▼             ▼
              Server       Server
                  │             │
                  └──────┬──────┘
                         │
                      MongoDB
                         │
                    Change Log
                         │
                         ▼
                  Other Devices
```

The essential lifecycle is:

```text
USER ACTION
    ↓
LOCAL TRANSACTION
    ↓
PENDING CHANGE
    ↓
SYNC
    ↓
SERVER VALIDATION
    ↓
┌───────────────┬────────────────┐
│               │                │
ACCEPTED       MERGE           CONFLICT
│               │                │
REVISION       REVISION         PRESERVE
│               │                │
└───────────────┴────────────────┘
                ↓
          EVENTUAL CONVERGENCE
```

---

# 114. Non-Negotiable Requirements

The implementation must never violate these requirements:

1. **Offline note creation must work.**
2. **Offline edits must work.**
3. **Local changes must survive app restarts.**
4. **Every local mutation must have a durable change record.**
5. **Every change must be idempotent.**
6. **The server must authorize every synchronization operation.**
7. **The server must be authoritative for synchronized state.**
8. **Remote changes must not generate outbound echo changes.**
9. **The cursor must advance only after successful local application.**
10. **Conflicting versions must never be silently discarded.**
11. **Deleted notes must use a synchronization-safe tombstone.**
12. **Revoked devices must lose server synchronization access.**
13. **Hidden notes must not be leaked through synchronization.**
14. **Audit history must preserve attribution.**
15. **Realtime must never be the only mechanism keeping clients synchronized.**
16. **A client crash must not corrupt synchronization state.**
17. **A network failure must not cause local data loss.**
18. **Conflict resolution must create a new revision.**
19. **The protocol must tolerate duplicate requests.**
20. **After successful synchronization and conflict resolution, authorized devices must converge.**

---

# 115. Implementation Priority

When a design decision is unclear, prioritize in this order:

```text
1. Data safety
2. Authorization
3. Correct synchronization
4. Conflict preservation
5. Crash safety
6. Offline reliability
7. Performance
8. User experience
9. Convenience
```

A slower synchronization system that never loses user data is preferable to a fast synchronization system that occasionally destroys edits.

---

# 116. Next Technical Documents

After this protocol, implement documentation in this order:

```text
SYNC_PROTOCOL.md
       ↓
DATABASE.md
       ↓
API.md
       ↓
QR_PAIRING.md
       ↓
DEVICE_SECURITY.md
       ↓
CONFLICT_RESOLUTION.md
       ↓
TESTING.md
       ↓
IMPLEMENTATION.md
```

`DATABASE.md` should translate this protocol into the exact MongoDB collections, document structures, indexes, transaction boundaries, and sequence-generation strategy.

`API.md` should then expose the synchronization protocol through concrete HTTP/WebSocket endpoints.

---

# 117. Final Principle

The application should be designed around one promise:

> **The user's local data is valuable even when the network is not available.**

The network exists to synchronize that data.

It must never become a prerequisite for safely editing it.
