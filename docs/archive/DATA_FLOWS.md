# DATA_FLOWS.md

# Synced Notepad — Data Flows & State Transitions

**Project:** Synced Notepad
**Version:** 0.1
**Purpose:** Define how data moves through the system for every major user and synchronization scenario.

---

# 1. Purpose

This document describes the behavior of the system during:

* note creation
* note editing
* note deletion
* offline operation
* reconnection
* synchronization
* QR pairing
* device authorization
* device revocation
* device-specific note hiding
* simultaneous editing
* conflicts
* conflict resolution
* crashes
* duplicate requests
* partial synchronization
* long-term offline devices

The goal is to make every important behavior deterministic enough to implement and test.

---

# 2. Core Data Model

The system has five major layers of data.

```text
User
 │
 ▼
Workspace
 │
 ├── Devices
 │
 ├── Notes
 │
 ├── Revisions
 │
 ├── Changes
 │
 ├── Conflicts
 │
 └── Audit Logs
```

---

# 3. User

A user represents the account holder.

Conceptually:

```js
{
  _id: "user_123",
  email: "user@example.com",
  createdAt: Date,
  updatedAt: Date
}
```

The user is the owner of their workspace.

---

# 4. Workspace

The workspace represents the synchronized notepad.

```js
{
  _id: "workspace_123",
  ownerId: "user_123",
  currentSequence: 105,
  createdAt: Date,
  updatedAt: Date
}
```

A user can eventually have multiple workspaces, although the initial application may expose only one.

---

# 5. Device

A device is an authorized replica of the workspace.

```js
{
  _id: "device_123",
  userId: "user_123",
  workspaceId: "workspace_123",

  name: "Chrome on Windows",

  platform: "web",

  status: "active",

  createdAt: Date,
  lastSeenAt: Date,
  revokedAt: null
}
```

---

# 6. Note

A note represents the current canonical version of a note.

```js
{
  _id: "note_123",

  workspaceId: "workspace_123",

  title: "Shopping List",

  content: "Milk\nEggs\nBread",

  revision: 7,

  createdByDeviceId: "device_mobile",

  createdAt: Date,
  updatedAt: Date,

  deletedAt: null
}
```

---

# 7. Revision

Every accepted change to a note creates a revision.

```js
{
  _id: "revision_123",

  noteId: "note_123",

  revision: 7,

  content: {
    title: "Shopping List",
    content: "Milk\nEggs\nBread"
  },

  createdByDeviceId: "device_mobile",

  createdAt: Date
}
```

Revisions should be immutable.

---

# 8. Change

A change represents a synchronization operation.

```js
{
  _id: "change_123",

  changeId: "change_123",

  workspaceId: "workspace_123",

  noteId: "note_123",

  deviceId: "device_mobile",

  operation: "update",

  baseRevision: 6,

  payload: {
    title: "Shopping List",
    content: "Milk\nEggs\nBread"
  },

  sequence: 107,

  createdAt: Date
}
```

---

# 9. Audit Log

Audit logs describe what happened.

```js
{
  _id: "audit_123",

  workspaceId: "workspace_123",

  userId: "user_123",

  deviceId: "device_mobile",

  action: "note.updated",

  noteId: "note_123",

  revision: 7,

  createdAt: Date
}
```

---

# 10. Visibility Rule

Device-specific visibility should be represented independently from the note.

Conceptually:

```js
{
  noteId: "note_123",
  deviceId: "device_web",
  visible: false
}
```

This prevents device visibility from changing the canonical note.

---

# 11. General Write Flow

Every local write follows:

```text
User action
   ↓
Validate input
   ↓
Generate changeId
   ↓
Read current local revision
   ↓
Write local note
   ↓
Write local revision
   ↓
Write pending change
   ↓
Update UI
   ↓
Sync asynchronously
```

---

# 12. Create Note — Online

User creates:

```text
Title: Ideas
Content: Build a new app
```

Flow:

```text
User
 ↓
Create Note
 ↓
Generate noteId
 ↓
Generate changeId
 ↓
Local transaction
 ├── create note
 ├── create revision
 └── create pending change
 ↓
UI updates immediately
 ↓
Sync engine starts
 ↓
POST /sync/push
 ↓
Server validates
 ↓
Server creates canonical note
 ↓
Server creates revision
 ↓
Server creates change sequence
 ↓
Server creates audit log
 ↓
Server response
 ↓
Client marks change accepted
```

---

# 13. Create Note — Offline

User creates a note while offline.

```text
User
 ↓
Create Note
 ↓
Local transaction
 ├── note
 ├── revision
 └── pending change
 ↓
UI updates
```

No network request is required.

The UI should show:

```text
Offline
Changes saved locally
```

When internet becomes available:

```text
Network reconnect
 ↓
Sync engine
 ↓
Push pending change
```

---

# 14. Create Two Notes Offline

Suppose the phone is offline.

User creates:

```text
Note A
Note B
```

Local database:

```text
Notes:
A
B

Pending:
change_A
change_B
```

When the phone reconnects:

```text
push(change_A, change_B)
```

Server assigns:

```text
sequence 101 → A
sequence 102 → B
```

Phone becomes:

```text
cursor = 102
pending = 0
```

---

# 15. Edit Note — Online

Existing note:

```text
revision = 10
```

User changes it.

Local operation:

```text
baseRevision = 10
```

Local revision:

```text
11
```

Pending change:

```js
{
  operation: "update",
  noteId: "note_123",
  baseRevision: 10
}
```

The UI updates immediately.

---

# 16. Edit Note — Offline

Same process:

```text
User edits
 ↓
Local database
 ↓
Pending change
```

The server is not involved yet.

---

# 17. Multiple Offline Edits to Same Note

Suppose:

```text
Revision 10
```

User makes three edits while offline.

```text
Edit 1 → local revision 11
Edit 2 → local revision 12
Edit 3 → local revision 13
```

The implementation has two possible strategies.

### MVP Strategy

Keep all changes:

```text
change_11
change_12
change_13
```

Advantages:

* easiest to reason about
* complete history
* simple recovery

### Optimization Later

Collapse compatible changes before uploading.

For MVP:

> Keep the changes individually.

---

# 18. Delete Note

Delete is a synchronization operation.

Do not immediately physically remove the note from every database.

Instead:

```js
{
  operation: "delete",
  noteId: "note_123",
  baseRevision: 13
}
```

Server marks:

```text
deletedAt = timestamp
```

---

# 19. Why Soft Delete?

Because another device may be offline.

Example:

```text
Phone:
delete note

Web:
offline
still has note
```

If the server physically deletes the record immediately, future synchronization becomes harder.

A tombstone allows the delete operation to propagate.

---

# 20. Tombstone

A deleted note remains represented as:

```js
{
  noteId: "note_123",
  deletedAt: "...",
  revision: 14
}
```

Clients can learn:

```text
Note 123 was deleted.
```

Later, tombstones can be garbage-collected safely when the retention rules allow it.

---

# 21. Delete Conflict

Initial state:

```text
Revision 10
```

Phone:

```text
delete
baseRevision = 10
```

Web:

```text
edit
baseRevision = 10
```

If phone reaches server first:

```text
Revision 11 = deleted
```

Web's update references revision 10.

The server detects the stale base revision.

The conflict policy should be explicit.

Recommended MVP behavior:

```text
delete vs edit = conflict
```

Do not silently choose one.

---

# 22. Offline → Online Flow

This is one of the most important flows.

```text
Offline
   │
   ├── User creates note
   ├── User edits note
   └── User deletes note
        │
        ▼
Pending changes
        │
        ▼
Network reconnects
        │
        ▼
Connectivity check
        │
        ▼
Sync starts
```

---

# 23. Reconnection Detection

When connectivity appears:

```text
network online
```

the client should not assume synchronization has succeeded.

Instead:

```text
network online
 ↓
schedule sync
 ↓
server request
 ↓
if successful → sync
if failed → retry
```

---

# 24. Sync Loop

Conceptually:

```js
async function sync() {
  if (syncAlreadyRunning()) {
    return;
  }

  try {
    await pull();
    await push();
    await pull();
  } finally {
    releaseSyncLock();
  }
}
```

The second pull is important because other devices may have created changes while the push was occurring.

---

# 25. Why Pull → Push → Pull?

Consider:

```text
Device A:
pushes change

Device B:
changes another note at the same time
```

A final pull ensures A receives changes committed during synchronization.

---

# 26. Sync Cursor

Each device stores:

```js
{
  workspaceId: "workspace_123",
  cursor: 100
}
```

If the server's latest sequence is:

```text
105
```

the device pulls:

```text
101
102
103
104
105
```

After applying them:

```text
cursor = 105
```

---

# 27. Pull Flow

```text
Client
 ↓
GET changes after cursor
 ↓
Server
 ↓
authorize workspace
 ↓
find changes
 ↓
apply device visibility filtering
 ↓
return batch
 ↓
Client validates
 ↓
local transaction
 ↓
update cursor
```

---

# 28. Pull Batch

Example response:

```json
{
  "changes": [
    {
      "sequence": 101,
      "changeId": "change_101",
      "noteId": "note_a",
      "operation": "create"
    },
    {
      "sequence": 102,
      "changeId": "change_102",
      "noteId": "note_b",
      "operation": "update"
    }
  ],
  "nextCursor": 102,
  "hasMore": false
}
```

---

# 29. Pull Visibility Filtering

Suppose:

```text
Server:
A visible to Web
B hidden from Web
C visible to Web
```

Web requests changes.

The server must ensure that changes revealing B are not returned.

This includes:

```text
create
update
content
title
metadata that reveals sensitive information
```

---

# 30. Important Visibility Edge Case

Hiding a note should not merely hide its content.

For a hidden note, the client should not receive enough metadata to infer:

```text
A hidden note exists
```

unless the product explicitly intends to reveal that information.

---

# 31. Push Flow

Client sends:

```json
{
  "workspaceId": "workspace_123",
  "changes": [
    {
      "changeId": "change_a",
      "noteId": "note_a",
      "operation": "update",
      "baseRevision": 4,
      "payload": {}
    }
  ]
}
```

Server processes each change.

---

# 32. Push Result

Possible result:

```json
{
  "results": [
    {
      "changeId": "change_a",
      "status": "accepted",
      "sequence": 105,
      "revision": 5
    }
  ]
}
```

---

# 33. Conflict Result

```json
{
  "results": [
    {
      "changeId": "change_a",
      "status": "conflict",
      "conflictId": "conflict_123"
    }
  ]
}
```

The client retains the conflict information.

---

# 34. Duplicate Push

Client sends:

```text
change_123
```

Server accepts it.

Response is lost.

Client sends:

```text
change_123
```

again.

Server checks:

```text
changeId = change_123
```

and finds it already processed.

Result:

```text
already_processed
```

No second revision is created.

---

# 35. Idempotency Requirement

Every client-generated mutation must have a globally unique:

```text
changeId
```

This ID must remain unchanged across retries.

Never generate a new ID for a retry.

---

# 36. App Crash During Push

Scenario:

```text
Client sends change
 ↓
Server accepts
 ↓
Server stores change
 ↓
Client crashes
 ↓
Client never receives response
```

After restart:

```text
pending change still exists
```

Client retries.

Server identifies:

```text
already processed
```

Client marks the change complete.

---

# 37. App Crash During Pull

Scenario:

```text
Client receives changes 101–110
 ↓
starts local transaction
 ↓
app crashes
```

If transaction did not commit:

```text
cursor remains 100
```

Client retries.

If transaction committed:

```text
cursor = 110
```

No duplication occurs.

---

# 38. Partial Pull

Suppose server has:

```text
1,000 changes
```

Client receives:

```text
1–500
```

The response:

```text
hasMore = true
```

Client updates:

```text
cursor = 500
```

Then requests:

```text
501–1000
```

---

# 39. Partial Push

Client has:

```text
A
B
C
D
```

Server results:

```text
A → accepted
B → accepted
C → conflict
D → accepted
```

The client should:

```text
A → remove from pending
B → remove from pending
C → mark conflict
D → remove from pending
```

Only C remains unresolved.

---

# 40. Push Ordering

For changes to the same note:

```text
A
B
C
```

preserve order.

For unrelated notes:

```text
A(note1)
B(note2)
C(note3)
```

parallel processing may be possible later.

MVP should process a batch in deterministic order.

---

# 41. Simultaneous Editing

This is a primary conflict scenario.

Initial:

```text
Revision 20
```

Phone:

```text
baseRevision 20
change P
```

Web:

```text
baseRevision 20
change W
```

Both are valid locally.

---

# 42. First Writer

Phone reaches server first.

Server:

```text
revision 21
```

Web arrives afterward.

Server sees:

```text
web.baseRevision = 20
server.revision = 21
```

Therefore:

```text
stale write detected
```

---

# 43. Conflict Decision

The server should determine whether the changes can be automatically merged.

For simple plain text notes, MVP should avoid pretending that every text change can be safely merged.

Recommended:

```text
if baseRevision !== currentRevision
    → conflict
```

Then allow explicit user resolution.

---

# 44. Conflict Object

Example:

```js
{
  _id: "conflict_123",

  workspaceId: "workspace_123",

  noteId: "note_123",

  originalRevision: 20,

  currentRevision: 21,

  incomingChangeId: "change_web",

  localVersion: {...},

  remoteVersion: {...},

  status: "open",

  createdAt: Date
}
```

---

# 45. Conflict UI

The user should see both versions.

Example:

```text
Conflict — Shopping List

PHONE
Milk
Eggs
Bread

WEB
Milk
Eggs
Coffee
```

Actions:

```text
Keep Phone
Keep Web
Merge
Keep Both
```

---

# 46. Conflict Names

Since the user wants names associated with changes, display:

```text
Alex — Phone
changed this at 10:31

Alex — Chrome
changed this at 10:32
```

If multiple users are introduced later:

```text
Alex — iPhone
```

and:

```text
Sam — Chrome
```

The system should use:

```text
user display name
+
device name
```

where available.

---

# 47. "Keep Both"

For a conflict:

```text
Version A
Version B
```

the user can choose:

```text
Keep both
```

This should create two separate notes.

Example:

```text
Shopping List
Shopping List — Web version
```

The exact naming can be made configurable later.

---

# 48. "Merge"

Merge creates a new revision.

```text
Revision 20
     │
 ┌───┴────┐
 ▼        ▼
Phone    Web
 │        │
 └───┬────┘
     ▼
  Manual Merge
     │
     ▼
 Revision 22
```

Both historical versions remain available.

---

# 49. Conflict Resolution Audit

Resolving a conflict generates an audit event:

```js
{
  action: "conflict.resolved",
  conflictId: "conflict_123",
  resolution: "merge",
  deviceId: "device_web"
}
```

---

# 50. Device Pairing Flow

Existing device:

```text
Generate QR
```

Server creates:

```text
pairingSession
```

with:

```text
expiresAt
status = pending
```

---

# 51. QR Payload

The QR should contain only short-lived pairing information.

Conceptually:

```json
{
  "pairingId": "pair_123",
  "secret": "temporary-secret"
}
```

The QR must not contain:

```text
permanent access token
password
full workspace data
long-lived session credential
```

---

# 52. QR Expiration

Recommended initial expiration:

```text
2 minutes
```

After expiration:

```text
PAIRING_EXPIRED
```

The user generates another QR.

---

# 53. QR Single Use

Once claimed:

```text
pairingSession.status = claimed
```

The QR should not authorize another device.

---

# 54. QR Approval

Scanning alone should not necessarily equal authorization.

Recommended:

```text
Scan
 ↓
Request
 ↓
Owner sees device
 ↓
Approve
 ↓
Device authorized
```

This gives the owner control.

---

# 55. Pairing Request Information

Owner should see:

```text
Device:
Chrome on Windows

Location:
optional / coarse if implemented

Requested:
10:31 AM

Platform:
Web
```

Avoid collecting unnecessary location information.

---

# 56. Pairing Rejection

Owner selects:

```text
Reject
```

Server marks:

```text
pairingSession.status = rejected
```

New device receives:

```text
PAIRING_REJECTED
```

---

# 57. Pairing Timeout

If owner does nothing:

```text
expiresAt reached
```

Session becomes:

```text
expired
```

The new device must scan a new QR.

---

# 58. Device Authorization Flow

After approval:

```text
pairing session
 ↓
create device
 ↓
associate user
 ↓
associate workspace
 ↓
issue device credentials
 ↓
device stores credentials securely
 ↓
initial sync
```

---

# 59. Device Credentials

Long-lived device credentials should not be stored in:

```text
localStorage
```

for the web.

Use appropriate secure browser mechanisms and session architecture.

For mobile:

```text
secure storage / keychain / keystore
```

should be used.

---

# 60. Device Revocation

Owner selects:

```text
Settings
 → Devices
 → Chrome on Windows
 → Revoke
```

Server:

```text
device.status = revoked
```

Future requests fail.

---

# 61. Revocation Realtime

If the revoked device has an active WebSocket:

```text
server
 ↓
device.revoked
 ↓
client
 ↓
clear credentials/session
 ↓
disconnect
```

---

# 62. Revocation Without WebSocket

If the device is offline:

```text
device revoked
```

When it reconnects:

```text
sync request
 ↓
DEVICE_REVOKED
 ↓
local session invalidated
```

---

# 63. Re-pairing a Revoked Device

A revoked device should be treated as a new authorization.

It must go through:

```text
new QR
new approval
new device authorization
```

---

# 64. Hide Note From Device

Owner selects:

```text
Note
 → Hide from device
 → Chrome
```

Server creates:

```text
visibility rule
```

Web will no longer receive future synchronization data for that note.

---

# 65. Hide Note That Already Exists Locally

This is important.

Web already has:

```text
Note A
```

Owner hides it.

On next sync:

```text
server
 ↓
visibility revoked
 ↓
web receives visibility update
 ↓
web removes/quarantines local note
```

---

# 66. Local Deletion After Hide

The client should distinguish:

```text
user deleted note
```

from:

```text
server revoked visibility
```

Do not create a normal delete mutation when the server simply tells the device it should no longer see a note.

Otherwise:

```text
hidden note
 ↓
client creates delete
 ↓
server
```

could accidentally delete the canonical note.

---

# 67. Visibility Revocation Event

Conceptually:

```json
{
  "type": "visibility.revoked",
  "noteId": "note_123"
}
```

The client then removes its local representation without sending a note deletion.

---

# 68. Re-enable Visibility

Owner can later select:

```text
Show on device
```

The server restores visibility.

The device can then receive the current permitted version.

---

# 69. Hidden Note and Offline Device

Suppose:

```text
Web goes offline
```

Owner hides a note from Web using mobile.

Web continues to display its cached copy while offline.

This is unavoidable if the device already has the data.

When Web reconnects:

```text
server policy wins
```

and the local copy is removed/quarantined.

---

# 70. Audit Flow

Every major operation should produce:

```text
mutation
 ↓
audit event
```

Examples:

```text
note.created
note.updated
note.deleted
note.restored
device.paired
device.revoked
note.visibility_changed
conflict.created
conflict.resolved
```

---

# 71. Audit Ordering

Audit events should have a server-side timestamp.

Prefer also associating:

```text
sequence
```

where useful.

Do not rely on client timestamps to establish authoritative ordering.

---

# 72. Client Clock Difference

Device A:

```text
10:00
```

Device B:

```text
09:45
```

Both may be wrong.

The server should use its own timestamps for authoritative history.

Client timestamps may be stored as auxiliary metadata but must not determine synchronization order.

---

# 73. Device Renaming

Owner can rename:

```text
Chrome
```

to:

```text
Work Laptop
```

This should create an audit event:

```text
device.updated
```

The device ID remains unchanged.

---

# 74. Note Rename

Renaming a note is a normal revision.

```text
Revision 4
Title: Ideas

Revision 5
Title: Project Ideas
```

---

# 75. Note Restore

If deleted notes are restorable:

```text
deleted note
 ↓
restore
 ↓
new revision
```

Never mutate historical revisions.

---

# 76. Empty Note

A note may legitimately contain:

```text
title = ""
content = ""
```

unless the product explicitly forbids it.

Validation should be defined before implementation.

---

# 77. Duplicate Note Names

Two notes may have:

```text
Shopping
Shopping
```

The `noteId`, not title, determines identity.

Do not use title as a unique key.

---

# 78. Duplicate Content

Two notes can contain identical content.

They are still different notes.

---

# 79. Note IDs

IDs should be generated independently from:

```text
title
content
device
timestamp
```

A client can generate the note ID before synchronization.

This allows offline creation.

---

# 80. Change IDs

Every mutation receives a unique ID.

Example:

```text
change_01H...
```

A UUID/ULID-style identifier is appropriate.

The important property is:

```text
globally unique
```

---

# 81. Offline Device for Months

Suppose:

```text
Phone last synced:
January 1
```

It goes offline for six months.

During that period:

```text
Web:
creates 500 notes
updates 100 notes
deletes 20 notes
```

Phone eventually reconnects.

The server should support:

```text
cursor from January
```

and return changes in batches.

---

# 82. Very Old Cursor

If old changes are eventually deleted due to retention:

```text
client cursor = 100
server only retains from 10,000
```

The server cannot replay the complete history.

Return:

```text
SYNC_CURSOR_EXPIRED
```

Client performs:

```text
full resync
```

---

# 83. Full Resync

Full resync should:

```text
download current permitted workspace state
```

without blindly trusting stale local state.

Process:

```text
pause local synchronization
 ↓
download snapshot/current state
 ↓
reconcile pending local changes
 ↓
replace/rebuild local state
 ↓
set cursor
 ↓
resume synchronization
```

The exact reconciliation rules need to be implemented carefully.

---

# 84. Long Offline + Local Changes

Hard case:

```text
Phone offline for 6 months

Phone:
edited Note A

Server:
Note A changed 20 times
```

Phone reconnects.

The phone's local change is based on an old revision.

Therefore:

```text
conflict detection
```

must still work.

Never assume:

```text
offline = latest
```

---

# 85. Server Data Retention

The system should define retention policies for:

```text
changes
revisions
audit logs
tombstones
conflicts
pairing sessions
```

MVP can keep everything.

Production can later introduce cleanup policies.

---

# 86. Pairing Security Edge Cases

The implementation must test:

```text
expired QR
used QR
invalid QR
tampered QR
wrong secret
QR scanned by multiple devices
owner rejects request
owner closes application
owner loses internet
new device loses internet
server restarts during pairing
```

---

# 87. Pairing Server Restart

If the pairing state is stored only in memory:

```text
server restart
 ↓
pairing disappears
```

Avoid this.

Pairing sessions should be persisted or stored in a durable short-lived store.

---

# 88. QR Replay Attack

Suppose someone captures a QR.

After it has been used:

```text
same QR
```

must fail.

After expiration:

```text
same QR
```

must fail.

---

# 89. QR Secret Guessing

Pairing secrets must be sufficiently random.

Do not use:

```text
123456
```

or:

```text
timestamp
```

as the secret.

---

# 90. Unauthorized Workspace Request

A malicious client attempts:

```text
workspaceId = someone else's workspace
```

The server must respond:

```text
FORBIDDEN
```

without revealing workspace contents.

---

# 91. Unauthorized Note Request

A malicious client attempts:

```text
noteId = another user's note
```

The server must verify workspace/device authorization.

---

# 92. Hidden Note Enumeration

A device must not be able to determine:

```text
there are 15 hidden notes
```

unless the product intentionally exposes that information.

Responses should avoid leaking hidden records through:

```text
counts
pagination
error messages
timestamps
IDs
search results
```

---

# 93. Conflict Information Leakage

A device should only receive conflict versions it is authorized to see.

If a note is hidden from a device:

```text
its content
```

must not appear in conflict payloads sent to that device.

---

# 94. Delete vs Hidden

These are different:

```text
DELETE
```

means:

```text
canonical note no longer exists
```

while:

```text
HIDE
```

means:

```text
canonical note still exists
but this device cannot access it
```

This distinction must exist throughout the system.

---

# 95. Revoke vs Hide

These are also different.

### Revoke device

```text
device loses workspace access
```

### Hide note

```text
device remains authorized
but cannot access one note
```

---

# 96. Device Removal

Removing a device should not delete notes.

Example:

```text
Remove Web
```

does:

```text
device = revoked
```

not:

```text
delete all notes created on Web
```

---

# 97. Device Ownership

A note created on a device does not belong to that device.

Example:

```text
Mobile creates Note A
```

Server stores:

```text
owner = User
creator = Mobile Device
```

This distinction is essential.

---

# 98. Creator vs Current Editor

Audit history may show:

```text
Created by:
Alex — Phone
```

and later:

```text
Updated by:
Alex — Work Laptop
```

The note itself remains owned by the workspace/user.

---

# 99. Concurrent Note Creation

Two devices create notes simultaneously.

Phone:

```text
note A
```

Web:

```text
note B
```

There is no conflict because note IDs differ.

Both should be accepted.

---

# 100. Concurrent Note Deletion

Two devices delete the same note.

First:

```text
delete accepted
```

Second:

```text
delete already applied
```

This should be idempotent.

It does not need to become a user-facing conflict.

---

# 101. Concurrent Same-Note Delete

If both devices delete the same current revision:

```text
Device A delete
Device B delete
```

The server should treat the second operation as:

```text
already deleted / idempotent
```

rather than creating a confusing conflict.

---

# 102. Concurrent Restore

If restore is introduced later, restore/delete interactions need explicit rules.

For MVP:

```text
restore
```

can be treated as a new revision based on the tombstone revision.

---

# 103. Sync Loop Prevention

When a client applies a remote change:

```text
remote update
 ↓
local database
```

it must NOT create a new outgoing change.

Otherwise:

```text
Server
 ↓
Device A
 ↓
new local change
 ↓
Server
 ↓
Device B
 ↓
...
```

would create an infinite loop.

---

# 104. Local vs Remote Mutation

The local database layer should distinguish:

```text
applyLocalMutation()
```

from:

```text
applyRemoteMutation()
```

Local:

```text
creates outgoing change
```

Remote:

```text
does not create outgoing change
```

---

# 105. Sync Lock

Only one sync process should operate on a workspace/device at a time.

Example:

```text
sync #1 running
sync #2 requested
```

The second request should:

```text
return / queue
```

rather than running a second competing sync loop.

---

# 106. Multiple Browser Tabs

The web application may be opened in:

```text
Tab A
Tab B
```

Both represent the same device/session.

The system must avoid:

```text
Tab A cursor = 100
Tab B cursor = 120
```

causing corruption.

Use a browser coordination mechanism such as:

```text
BroadcastChannel
```

or another tab coordination strategy.

---

# 107. Multiple Mobile App Instances

Normally only one mobile app instance exists.

Still, the local database must be transaction-safe.

---

# 108. Browser Refresh During Sync

User refreshes while syncing.

Expected:

```text
pending changes remain
```

After reload:

```text
sync resumes
```

No change should disappear.

---

# 109. Closing Laptop During Sync

Same principle.

If the server accepted the change:

```text
retry = idempotent
```

If it did not:

```text
pending change remains
```

---

# 110. Server Timeout

Client sends:

```text
POST /sync/push
```

Server takes too long.

Client receives timeout.

The client must assume:

```text
unknown outcome
```

not:

```text
definitely failed
```

Therefore:

```text
retry with same changeId
```

---

# 111. HTTP 500

A server error should generally result in:

```text
retry later
```

unless the server identifies the request as permanently invalid.

---

# 112. HTTP 401

Authentication/session failure:

```text
refresh/re-authenticate
```

Do not blindly retry indefinitely.

---

# 113. HTTP 403

Authorization failure:

```text
stop synchronization
```

Example:

```text
DEVICE_REVOKED
```

requires user-facing action.

---

# 114. HTTP 409

Potentially:

```text
conflict
```

However, the sync API may return structured per-change results instead of relying exclusively on HTTP 409.

---

# 115. HTTP 413

Payload too large.

Client should:

```text
split batch
```

or report an oversized note.

---

# 116. HTTP 429

Rate limited.

Client should:

```text
respect Retry-After
```

and back off.

---

# 117. Sync Ordering

Recommended order:

```text
1. Authenticate
2. Pull remote changes
3. Apply remote changes
4. Push local changes
5. Pull again
6. Update status
```

However, the implementation can optimize this later.

The important requirement is that correctness must not depend on a single network round trip.

---

# 118. Why Pull Before Push?

Consider:

```text
Local note revision = 5
Server revision = 6
```

The client does not know about revision 6.

Pulling first lets it learn the latest server state before attempting the local mutation.

This can reduce avoidable conflicts.

---

# 119. But What If Local Changes Exist?

Local pending changes must remain untouched.

Pulling remote changes should not delete or overwrite them.

The sync engine must preserve:

```text
local pending mutation
```

while applying remote state.

---

# 120. Local Pending Change vs Remote Change

Suppose:

```text
Local:
Note A revision 5
pending update from 5 → 6

Remote:
Note A revision 6
```

The local change is now based on a stale revision.

The sync engine should preserve it and let the server determine whether it conflicts.

Do not silently discard it.

---

# 121. User Experience During Conflict

The note should remain usable.

Possible UI:

```text
⚠ Conflict

This note was changed on another device.

[Review conflict]
```

The user should not lose the local version.

---

# 122. Conflict Persistence

Conflicts should survive:

```text
app restart
device restart
offline period
browser refresh
```

They are durable records.

---

# 123. Conflict Resolution While Offline

Ideally, a conflict can be reviewed offline.

If the user selects:

```text
Keep mine
```

the client can create a local resolution mutation.

When online:

```text
resolution
 ↓
server
```

The server validates it against the current conflict.

---

# 124. Stale Conflict Resolution

Suppose:

```text
Conflict created
```

then another device resolves it first.

A second device tries to resolve it.

Server returns:

```text
CONFLICT_ALREADY_RESOLVED
```

The client refreshes the conflict state.

---

# 125. Audit History Example

A note's history might look like:

```text
10:00
Created
Alex — Phone

10:05
Updated
Alex — Phone

10:20
Updated
Alex — Laptop

10:21
Conflict created

10:23
Conflict resolved
Alex — Laptop
Resolution: Merge
```

This is useful for debugging and user trust.

---

# 126. Full End-to-End Scenario

Initial:

```text
Phone = 0 notes
Web = 0 notes
Server = 0 notes
```

---

## Step 1 — Phone Offline

Phone creates:

```text
A
B
```

Phone:

```text
2 notes
2 pending
```

---

## Step 2 — Web Offline

Web creates:

```text
C
D
E
```

Web:

```text
3 notes
3 pending
```

---

## Step 3 — Phone Reconnects

Phone pushes:

```text
A
B
```

Server:

```text
A
B
```

---

## Step 4 — Web Reconnects

Web pushes:

```text
C
D
E
```

Server:

```text
A
B
C
D
E
```

---

## Step 5 — Phone Pulls

Phone pulls:

```text
C
D
E
```

Phone:

```text
A
B
C
D
E
```

---

## Step 6 — Web Pulls

Web pulls:

```text
A
B
```

Web:

```text
A
B
C
D
E
```

Final:

```text
Server = 5
Phone = 5
Web = 5
```

---

# 127. End-to-End Conflict Scenario

Initial:

```text
Note A
Revision 10
```

Phone offline:

```text
"Hello Phone"
```

Web offline:

```text
"Hello Web"
```

Phone reconnects first.

Server:

```text
Revision 11
```

Web reconnects.

Server sees:

```text
baseRevision 10
currentRevision 11
```

Conflict:

```text
Phone:
Hello Phone

Web:
Hello Web
```

User selects:

```text
Keep both
```

Result:

```text
Note A
Note A — Web Version
```

History remains intact.

---

# 128. End-to-End Hidden Note Scenario

Initial:

```text
A
B
C
```

Mobile:

```text
A B C
```

Web:

```text
A B C
```

Owner hides B from Web.

Server:

```text
B hidden from Web
```

Web reconnects.

Web receives:

```text
visibility revoked for B
```

Web local state:

```text
A
C
```

Mobile:

```text
A
B
C
```

Server:

```text
A
B
C
```

---

# 129. End-to-End Revocation Scenario

Web is active.

Owner revokes Web.

Server:

```text
device = revoked
```

WebSocket:

```text
device.revoked
```

Web:

```text
clear session
disconnect
```

If Web is offline:

```text
next sync
 ↓
DEVICE_REVOKED
 ↓
clear local authorization
```

---

# 130. Critical Invariants

The implementation must preserve these invariants.

### Invariant 1

Every local mutation is durable before UI success is shown.

### Invariant 2

Every server mutation has a unique change ID.

### Invariant 3

Retrying a change cannot create duplicate revisions.

### Invariant 4

Remote changes never create new outgoing changes.

### Invariant 5

A cursor only advances after successful local application.

### Invariant 6

A device cannot synchronize an unauthorized workspace.

### Invariant 7

A hidden note cannot leak through synchronization metadata.

### Invariant 8

Device revocation does not delete workspace data.

### Invariant 9

Conflict resolution creates a new revision.

### Invariant 10

Historical revisions are immutable.

---

# 131. State Transition — Note

```text
                ┌─────────┐
                │  None   │
                └────┬────┘
                     │
                   create
                     │
                     ▼
                ┌─────────┐
                │ Active  │
                └────┬────┘
                     │
              ┌──────┴──────┐
              │             │
            update         delete
              │             │
              ▼             ▼
           Active        Deleted
              │
              │ conflict
              ▼
          Conflict
              │
           resolve
              │
              ▼
           Active
```

---

# 132. State Transition — Device

```text
Pending Pairing
      │
    approve
      ▼
   Active
      │
    revoke
      ▼
   Revoked
```

Alternative:

```text
Pending Pairing
      │
    reject
      ▼
   Rejected
```

---

# 133. State Transition — Sync Change

```text
Pending
   │
 upload
   ▼
Uploading
   │
 ┌─┴──────────────┐
 ▼                ▼
Accepted        Conflict
   │                │
   ▼                ▼
Complete         Resolved
```

Error:

```text
Uploading
   │
 transient error
   ▼
Pending
```

Permanent error:

```text
Uploading
   │
 permanent error
   ▼
Failed
```

---

# 134. State Transition — Pairing

```text
Created
  │
  ├── claim → Claimed
  │              │
  │            approve
  │              ▼
  │          Authorized
  │
  ├── reject → Rejected
  │
  └── timeout → Expired
```

---

# 135. State Transition — Visibility

For each device/note pair:

```text
Visible
   │
 hide
   ▼
Hidden
   │
 show
   ▼
Visible
```

This state is independent of the note's canonical lifecycle.

---

# 136. Data Flow Testing Matrix

The following scenarios must eventually have automated tests.

| Scenario              | Expected                  |
| --------------------- | ------------------------- |
| Create online         | Synced                    |
| Create offline        | Saved locally             |
| Edit online           | Synced                    |
| Edit offline          | Queued                    |
| Delete offline        | Queued                    |
| Reconnect             | Pending changes upload    |
| Duplicate push        | No duplicate              |
| Lost push response    | Retry succeeds            |
| Crash during push     | Recovery                  |
| Crash during pull     | Recovery                  |
| Two devices create    | Both preserved            |
| Two devices edit      | Conflict                  |
| Delete vs edit        | Conflict                  |
| Two devices delete    | Idempotent                |
| Hide note             | Device stops receiving it |
| Unhide note           | Device can receive it     |
| Revoke device         | Access denied             |
| Expired QR            | Rejected                  |
| Reused QR             | Rejected                  |
| QR race               | One authorization         |
| WebSocket loss        | Sync still works          |
| Long offline          | Catch-up                  |
| Old cursor            | Full resync               |
| Large batch           | Pagination                |
| Multiple browser tabs | No corruption             |

---

# 137. Most Dangerous Edge Cases

The following deserve special attention during implementation.

## 1. Server accepted but response was lost

Must be safe through idempotency.

## 2. Client crashes after applying remote changes

Cursor must remain consistent.

## 3. Two devices edit simultaneously

Neither version should disappear silently.

## 4. Device is revoked while offline

Revocation must take effect on reconnect.

## 5. Note is hidden while device is offline

Device must stop receiving it after reconnect.

## 6. QR is reused

Must not create unauthorized devices.

## 7. Remote changes are applied locally

Must not generate outgoing changes.

## 8. Multiple tabs synchronize simultaneously

Must not corrupt the local database/cursor.

## 9. Very old device reconnects

Must handle expired cursors.

## 10. User changes note while conflict is unresolved

The new local mutation must not destroy the existing conflict record.

---

# 138. Implementation Order

Implement flows in this order:

```text
1. Local note creation
2. Local note editing
3. Local note deletion
4. Local change queue
5. Basic server API
6. Server change processing
7. Pull synchronization
8. Push synchronization
9. Cursor management
10. Idempotency
11. Offline/reconnect handling
12. Revisions
13. Conflict detection
14. Conflict UI
15. QR pairing
16. Device authorization
17. Device revocation
18. Device-specific visibility
19. Audit logs
20. WebSocket notifications
21. Background synchronization
22. Advanced recovery
```

Do not begin with QR codes or WebSockets.

The synchronization engine should be correct before realtime features are added.

---

# 139. Development Milestone

The first complete milestone should be:

```text
Phone
   │
   │ offline
   ▼
Create 2 notes
   │
   │ reconnect
   ▼
Server
   ▲
   │
   │ sync
   ▼
Web
```

Expected:

```text
Phone = 2
Web = 2
Server = 2
```

Then:

```text
Web offline
 ↓
create 3 notes
 ↓
reconnect
```

Expected:

```text
Phone = 5
Web = 5
Server = 5
```

Only after this works reliably should advanced conflict and visibility behavior be layered on.

---

# 140. Final Data Flow Model

The complete product loop is:

```text
                 USER ACTION
                     │
                     ▼
              LOCAL TRANSACTION
              /        |        \
             /         |         \
          Note       Revision    Change
             \         |         /
              \        |        /
                     ▼
                  LOCAL UI
                     │
              ┌──────┴──────┐
              │             │
           Offline        Online
              │             │
              │             ▼
              │          Sync Engine
              │             │
              │        ┌────┴────┐
              │        │         │
              │       Pull      Push
              │        │         │
              │        └────┬────┘
              │             │
              │          Server
              │             │
              │        Authorization
              │             │
              │       Conflict Check
              │             │
              │       MongoDB Tx
              │             │
              │       Change Sequence
              │             │
              └─────────────┘
                            │
                            ▼
                     Other Devices
                            │
                            ▼
                     Local Database
                            │
                            ▼
                           UI
```

---

# 141. Final Rule

The system should always prefer:

```text
preserve → synchronize → resolve
```

over:

```text
overwrite → discard → hope
```

When uncertainty exists, retain enough information to recover the user's data.

That principle should guide every synchronization, conflict, QR, device, and offline implementation decision.
