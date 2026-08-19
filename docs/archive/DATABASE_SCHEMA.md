# DATABASE_SCHEMA.md

# Synced Notepad — Database Schema

**Project:** Synced Notepad
**Version:** 0.1
**Database:** MongoDB
**Web Local Database:** IndexedDB
**React Native Local Database:** SQLite
**Backend:** Node.js + Express
**Purpose:** Define the persistent data model used by the server and client applications.

---

# 1. Database Architecture

The application uses two database layers.

```text
                    ┌─────────────────────┐
                    │      MongoDB        │
                    │   Authoritative DB  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Web Application       React Native App
                    │                     │
               IndexedDB              SQLite
                    │                     │
                    └──────────┬──────────┘
                               │
                         Sync Engine
```

MongoDB is the **authoritative server database**.

Client databases are local replicas.

---

# 2. Important Principle

MongoDB is the source of truth for synchronized workspace state.

Client databases are designed to:

* work offline
* provide instant UI updates
* store pending mutations
* store synchronization cursors
* cache permitted notes
* survive application restarts
* recover from interrupted synchronization

A client must never assume that its local state is authoritative simply because it exists locally.

---

# 3. MongoDB Collections

Initial collections:

```text
users
workspaces
devices
pairing_sessions
notes
note_revisions
changes
conflicts
note_visibility
audit_logs
```

Potential future collections:

```text
sessions
refresh_tokens
notifications
workspace_snapshots
attachments
shared_workspaces
```

---

# 4. Collection Overview

| Collection         | Purpose                         |
| ------------------ | ------------------------------- |
| `users`            | User accounts                   |
| `workspaces`       | User's synchronized notepad     |
| `devices`          | Authorized devices              |
| `pairing_sessions` | Temporary QR pairing            |
| `notes`            | Current canonical notes         |
| `note_revisions`   | Immutable note history          |
| `changes`          | Synchronization event log       |
| `conflicts`        | Unresolved/resolved conflicts   |
| `note_visibility`  | Device-specific visibility      |
| `audit_logs`       | Human-readable activity history |

---

# 5. ID Strategy

Do not rely exclusively on MongoDB `_id` for client-generated entities.

Important entities should have explicit IDs:

```text
userId
workspaceId
deviceId
noteId
changeId
revisionId
conflictId
pairingId
auditId
```

Recommended format:

```text
UUID
```

or:

```text
ULID
```

ULIDs are particularly useful when sortable identifiers are desirable.

For the initial implementation, UUID/UUIDv7 is a good choice.

---

# 6. User Schema

Collection:

```text
users
```

Example:

```js
{
  _id: ObjectId("..."),

  userId: "018f...",

  email: "user@example.com",

  displayName: "Alex",

  status: "active",

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

---

# 7. User Fields

| Field         | Type     | Required | Description           |
| ------------- | -------- | -------: | --------------------- |
| `_id`         | ObjectId |      Yes | MongoDB internal ID   |
| `userId`      | UUID     |      Yes | Public/application ID |
| `email`       | String   |      Yes | Account email         |
| `displayName` | String   |      Yes | Display name          |
| `status`      | String   |      Yes | `active`, `disabled`  |
| `createdAt`   | Date     |      Yes | Creation time         |
| `updatedAt`   | Date     |      Yes | Last update           |

---

# 8. User Indexes

```js
db.users.createIndex(
  { userId: 1 },
  { unique: true }
)

db.users.createIndex(
  { email: 1 },
  { unique: true }
)
```

Email uniqueness should use normalized email values.

---

# 9. Workspace Schema

Collection:

```text
workspaces
```

Example:

```js
{
  _id: ObjectId("..."),

  workspaceId: "workspace_123",

  ownerId: "user_123",

  name: "My Notes",

  currentSequence: 105,

  status: "active",

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

---

# 10. Workspace Fields

| Field             | Type       | Description             |
| ----------------- | ---------- | ----------------------- |
| `workspaceId`     | UUID       | Workspace identifier    |
| `ownerId`         | UUID       | User who owns workspace |
| `name`            | String     | Workspace name          |
| `currentSequence` | NumberLong | Global change sequence  |
| `status`          | String     | Workspace state         |
| `createdAt`       | Date       | Creation                |
| `updatedAt`       | Date       | Last update             |

---

# 11. Workspace Sequence

The `currentSequence` is the authoritative synchronization position.

Example:

```text
currentSequence = 500
```

means the workspace has committed changes through:

```text
sequence 500
```

Every accepted synchronization mutation receives a new sequence.

---

# 12. Sequence Requirements

Sequences must be:

* monotonically increasing within a workspace
* generated server-side
* never generated by clients
* safe under concurrent writes

Example:

```text
499
500
501
502
```

Do not use client timestamps for synchronization ordering.

---

# 13. Workspace Indexes

```js
db.workspaces.createIndex(
  { workspaceId: 1 },
  { unique: true }
)

db.workspaces.createIndex(
  { ownerId: 1 }
)
```

---

# 14. Device Schema

Collection:

```text
devices
```

Example:

```js
{
  _id: ObjectId("..."),

  deviceId: "device_123",

  userId: "user_123",

  workspaceId: "workspace_123",

  name: "Chrome on Windows",

  platform: "web",

  appVersion: "1.0.0",

  status: "active",

  lastSeenAt: ISODate("..."),

  createdAt: ISODate("..."),

  revokedAt: null
}
```

---

# 15. Device Platforms

Allowed values:

```text
web
android
ios
desktop
```

Initially:

```text
web
android
ios
```

may be sufficient.

---

# 16. Device Status

Possible states:

```text
active
revoked
```

Pairing states should not be stored here.

They belong to `pairing_sessions`.

---

# 17. Device Ownership

The device belongs to a user:

```text
device.userId
```

and has access to:

```text
device.workspaceId
```

A device is not the owner of notes.

---

# 18. Device Indexes

```js
db.devices.createIndex(
  { deviceId: 1 },
  { unique: true }
)

db.devices.createIndex(
  { userId: 1, status: 1 }
)

db.devices.createIndex(
  { workspaceId: 1, status: 1 }
)
```

---

# 19. Device Name

The user can rename a device.

Example:

```text
Chrome on Windows
```

becomes:

```text
Work Laptop
```

The `deviceId` does not change.

---

# 20. Pairing Session Schema

Collection:

```text
pairing_sessions
```

Example:

```js
{
  _id: ObjectId("..."),

  pairingId: "pair_123",

  workspaceId: "workspace_123",

  ownerUserId: "user_123",

  secretHash: "...",

  status: "pending",

  requestedDevice: {
    name: "Chrome on Windows",
    platform: "web",
    appVersion: "1.0.0"
  },

  claimedDeviceId: null,

  expiresAt: ISODate("..."),

  createdAt: ISODate("..."),

  claimedAt: null,

  approvedAt: null,

  rejectedAt: null
}
```

---

# 21. QR Secret Storage

Never store the raw QR secret if it is not necessary.

Prefer:

```text
QR secret
   ↓
hash
   ↓
MongoDB
```

When the new device presents the secret:

```text
hash(incomingSecret)
```

compare against the stored hash.

---

# 22. Pairing Session Expiration

Create a TTL index:

```js
db.pairing_sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)
```

However, application-level status validation is still required.

MongoDB TTL deletion should not be treated as the only expiration mechanism.

---

# 23. Pairing Status

Allowed states:

```text
pending
claimed
approved
rejected
expired
```

The actual implementation may collapse some states, but the lifecycle must be deterministic.

---

# 24. Pairing Uniqueness

A pairing session must only result in one authorized device.

Use atomic operations when claiming/approving.

Two devices racing to claim the same QR must not both succeed.

---

# 25. Note Schema

Collection:

```text
notes
```

Example:

```js
{
  _id: ObjectId("..."),

  noteId: "note_123",

  workspaceId: "workspace_123",

  title: "Shopping List",

  content: "Milk\nEggs\nBread",

  revision: 7,

  createdByDeviceId: "device_mobile",

  createdByUserId: "user_123",

  createdAt: ISODate("..."),

  updatedAt: ISODate("..."),

  deletedAt: null
}
```

---

# 26. Note Ownership

The note belongs to:

```text
workspaceId
```

not:

```text
deviceId
```

and not:

```text
createdByDeviceId
```

The creator fields are historical information.

---

# 27. Note Revision

`revision` represents the current canonical revision.

Example:

```text
revision = 10
```

A new accepted modification becomes:

```text
revision = 11
```

---

# 28. Note Deletion

Do not immediately remove deleted notes.

Use:

```js
deletedAt: ISODate("...")
```

This creates a tombstone.

---

# 29. Note Indexes

```js
db.notes.createIndex(
  { noteId: 1 },
  { unique: true }
)

db.notes.createIndex(
  { workspaceId: 1, updatedAt: -1 }
)

db.notes.createIndex(
  { workspaceId: 1, deletedAt: 1 }
)
```

---

# 30. Note Revision Schema

Collection:

```text
note_revisions
```

Example:

```js
{
  _id: ObjectId("..."),

  revisionId: "revision_123",

  noteId: "note_123",

  workspaceId: "workspace_123",

  revision: 7,

  operation: "update",

  snapshot: {
    title: "Shopping List",
    content: "Milk\nEggs\nBread"
  },

  changedByUserId: "user_123",

  changedByDeviceId: "device_mobile",

  changeId: "change_123",

  createdAt: ISODate("...")
}
```

---

# 31. Revision Immutability

Once inserted:

```text
note_revisions
```

should never be updated.

Only new revisions should be inserted.

This gives reliable historical information.

---

# 32. Revision Unique Index

```js
db.note_revisions.createIndex(
  {
    noteId: 1,
    revision: 1
  },
  {
    unique: true
  }
)
```

This prevents duplicate revisions.

---

# 33. Revision Lookup

Common query:

```js
db.note_revisions.find({
  noteId: "note_123"
}).sort({
  revision: -1
})
```

This retrieves note history.

---

# 34. Change Schema

Collection:

```text
changes
```

This is the primary synchronization event log.

Example:

```js
{
  _id: ObjectId("..."),

  changeId: "change_123",

  workspaceId: "workspace_123",

  sequence: NumberLong(105),

  noteId: "note_123",

  operation: "update",

  baseRevision: 6,

  resultingRevision: 7,

  payload: {
    title: "Shopping List",
    content: "Milk\nEggs\nBread"
  },

  userId: "user_123",

  deviceId: "device_mobile",

  createdAt: ISODate("..."),

  processedAt: ISODate("..."),

  metadata: {
    clientCreatedAt: ISODate("...")
  }
}
```

---

# 35. Change Operations

Allowed values:

```text
create
update
delete
restore
```

Potential future operations:

```text
move
rename
attachment_add
attachment_remove
```

---

# 36. Change ID Uniqueness

This is critical.

```js
db.changes.createIndex(
  { changeId: 1 },
  { unique: true }
)
```

This guarantees idempotent retries at the database level.

---

# 37. Workspace Sequence Index

```js
db.changes.createIndex(
  {
    workspaceId: 1,
    sequence: 1
  },
  {
    unique: true
  }
)
```

This is the main pull query index.

---

# 38. Change Query

A device at cursor:

```text
100
```

requests:

```js
db.changes.find({
  workspaceId: "workspace_123",
  sequence: {
    $gt: 100
  }
})
.sort({
  sequence: 1
})
.limit(500)
```

---

# 39. Change Retention

The change log may eventually be large.

MVP:

```text
retain indefinitely
```

Later:

```text
retention policy
+
snapshots
+
cursor expiration
```

can be introduced.

---

# 40. Conflict Schema

Collection:

```text
conflicts
```

Example:

```js
{
  _id: ObjectId("..."),

  conflictId: "conflict_123",

  workspaceId: "workspace_123",

  noteId: "note_123",

  incomingChangeId: "change_web",

  currentRevision: 21,

  incomingBaseRevision: 20,

  serverVersion: {
    revision: 21,
    title: "Shopping",
    content: "Milk\nEggs"
  },

  incomingVersion: {
    title: "Shopping",
    content: "Milk\nEggs\nCoffee"
  },

  createdByDeviceId: "device_web",

  status: "open",

  resolution: null,

  resolvedByDeviceId: null,

  resolvedAt: null,

  createdAt: ISODate("...")
}
```

---

# 41. Conflict Status

Possible:

```text
open
resolved
cancelled
```

---

# 42. Conflict Resolution

Example:

```js
{
  type: "merge"
}
```

Other values:

```text
keep_server
keep_incoming
keep_both
manual_merge
```

---

# 43. Conflict Indexes

```js
db.conflicts.createIndex(
  { conflictId: 1 },
  { unique: true }
)

db.conflicts.createIndex(
  { workspaceId: 1, status: 1 }
)

db.conflicts.createIndex(
  { noteId: 1, status: 1 }
)
```

---

# 44. One Open Conflict Per Incoming Mutation

A change should not create multiple conflicts.

Use:

```js
db.conflicts.createIndex(
  { incomingChangeId: 1 },
  { unique: true }
)
```

---

# 45. Visibility Schema

Collection:

```text
note_visibility
```

Example:

```js
{
  _id: ObjectId("..."),

  noteId: "note_123",

  workspaceId: "workspace_123",

  deviceId: "device_web",

  visible: false,

  changedByUserId: "user_123",

  createdAt: ISODate("..."),

  updatedAt: ISODate("...")
}
```

---

# 46. Visibility Default

Do not create a record for every visible note/device pair.

Default should be:

```text
visible = true
```

unless an explicit rule says otherwise.

This avoids a massive amount of data.

---

# 47. Visibility Index

```js
db.note_visibility.createIndex(
  {
    noteId: 1,
    deviceId: 1
  },
  {
    unique: true
  }
)
```

---

# 48. Device Visibility Query

When returning notes to a device:

```text
note
+
visibility rule
```

must be evaluated.

The server should not simply return every workspace note.

---

# 49. Audit Log Schema

Collection:

```text
audit_logs
```

Example:

```js
{
  _id: ObjectId("..."),

  auditId: "audit_123",

  workspaceId: "workspace_123",

  userId: "user_123",

  deviceId: "device_mobile",

  action: "note.updated",

  noteId: "note_123",

  changeId: "change_123",

  revision: 7,

  metadata: {
    titleChanged: true
  },

  createdAt: ISODate("...")
}
```

---

# 50. Audit Actions

Initial actions:

```text
note.created
note.updated
note.deleted
note.restored

device.paired
device.revoked
device.renamed

note.hidden
note.unhidden

conflict.created
conflict.resolved
```

Potential future actions:

```text
workspace.created
workspace.renamed
account.updated
```

---

# 51. Audit Log Immutability

Audit records should be append-only.

Do not modify historical audit events.

If something needs correction, create another audit event.

---

# 52. Audit Indexes

```js
db.audit_logs.createIndex(
  {
    workspaceId: 1,
    createdAt: -1
  }
)

db.audit_logs.createIndex(
  {
    noteId: 1,
    createdAt: -1
  }
)

db.audit_logs.createIndex(
  {
    deviceId: 1,
    createdAt: -1
  }
)
```

---

# 53. Client Database Architecture

The client has different requirements from MongoDB.

Web:

```text
IndexedDB
```

React Native:

```text
SQLite
```

The schemas should be logically equivalent.

---

# 54. Client Tables

Both platforms should conceptually contain:

```text
local_notes
local_revisions
pending_changes
sync_state
local_conflicts
local_visibility
device_state
```

---

# 55. `local_notes`

Example:

```text
local_notes
```

Fields:

```text
note_id
workspace_id
title
content
revision
created_at
updated_at
deleted_at
sync_state
```

---

# 56. Local Note Sync State

Possible:

```text
synced
pending
conflict
deleted
hidden
```

The exact implementation can simplify this because pending mutations should primarily be tracked separately.

---

# 57. `pending_changes`

Example:

```text
pending_changes
```

Fields:

```text
change_id
workspace_id
note_id
operation
base_revision
payload
created_at
retry_count
last_error
status
```

---

# 58. Pending Change Status

Possible:

```text
pending
uploading
conflict
failed
```

A successful change should be removed or archived from the pending queue.

---

# 59. Local Change Payload

Store enough information to retry without reconstructing the original operation.

Example:

```json
{
  "title": "Shopping List",
  "content": "Milk\nEggs"
}
```

---

# 60. `sync_state`

One row per workspace/device.

Example:

```text
workspace_id
cursor
sync_status
last_sync_at
last_error
```

---

# 61. Sync Status

Possible:

```text
idle
syncing
offline
error
revoked
```

---

# 62. Cursor Storage

Example:

```text
workspace_id = workspace_123
cursor = 105
```

The cursor must be updated transactionally with the changes it represents.

---

# 63. Cursor Safety

Never do:

```text
apply change
commit

update cursor
commit
```

as separate operations.

Instead:

```text
transaction:
    apply changes
    update cursor
commit
```

Otherwise a crash can produce an inconsistent cursor.

---

# 64. Local Conflict Table

Fields:

```text
conflict_id
workspace_id
note_id
incoming_change_id
server_version
local_version
status
created_at
```

This allows conflict UI to work even when offline.

---

# 65. Local Visibility Table

Fields:

```text
note_id
device_id
visible
updated_at
```

This lets the local UI hide notes immediately after receiving visibility changes.

---

# 66. Device State

Local device state may contain:

```text
device_id
workspace_id
user_id
device_name
platform
status
last_server_contact
```

Credentials should be stored using the platform's secure credential mechanism, not in ordinary application tables.

---

# 67. Web Credential Storage

Avoid storing long-lived authentication credentials in:

```text
localStorage
```

Use a secure session architecture appropriate for the web application.

---

# 68. Mobile Credential Storage

Use:

```text
iOS Keychain
Android Keystore
```

through the React Native secure-storage mechanism selected by the project.

---

# 69. MongoDB Transactions

Some operations require transactions.

Especially:

```text
create/update note
+
create revision
+
create change
+
increment workspace sequence
+
audit event
```

These should be committed atomically where practical.

---

# 70. Atomic Note Update

Conceptually:

```text
BEGIN TRANSACTION

1. Read note
2. Validate base revision
3. Allocate sequence
4. Update note
5. Insert revision
6. Insert change
7. Insert audit event
8. Commit

ROLLBACK if any step fails
```

---

# 71. Sequence Allocation

Never use:

```text
clientSequence
```

for server synchronization.

The server should allocate:

```text
workspace.currentSequence + 1
```

atomically.

A transaction or atomic counter strategy should be used.

---

# 72. Concurrent Sequence Allocation

Two requests:

```text
Request A
Request B
```

must never both receive:

```text
sequence = 105
```

Expected:

```text
A → 105
B → 106
```

---

# 73. MongoDB Document Size

MongoDB documents have a size limit.

Do not allow unlimited note content.

The application must define:

```text
maximum note size
```

before production.

For example:

```text
1–5 MB
```

may be reasonable depending on the product.

The final value should be decided based on expected use and sync performance.

---

# 74. Large Notes

Large notes increase:

* sync bandwidth
* conflict payload size
* revision storage
* memory usage
* mobile battery usage

Potential future architecture:

```text
note metadata
+
content storage
```

or chunking.

MVP can keep note content directly in MongoDB if a sensible maximum is enforced.

---

# 75. Attachments

Attachments should not initially be embedded directly into notes.

Future architecture:

```text
MongoDB
   │
   └── attachment metadata

Object Storage
   │
   └── actual file
```

Examples:

```text
S3-compatible storage
Cloudflare R2
AWS S3
```

---

# 76. Search

For MVP:

```text
client-side search
```

may be sufficient for the user's visible notes.

Server-side full-text search can be introduced later.

---

# 77. Soft Deleted Notes

Queries for normal note lists should use:

```js
{
  workspaceId,
  deletedAt: null
}
```

unless requesting trash/history.

---

# 78. Deleted Note Visibility

A deleted note should not normally appear in normal synchronization views.

However, its tombstone/change must remain available for synchronization.

---

# 79. Hidden Note Queries

When querying notes for a device:

```text
workspace
+
device authorization
+
visibility rules
+
deleted status
```

must all be evaluated.

---

# 80. Authorization Query Principle

Never trust:

```text
workspaceId
```

provided by the client.

The server must derive authorization from the authenticated device/user.

Example:

```text
authenticated device
        ↓
device.userId
device.workspaceId
        ↓
authorized workspace
```

---

# 81. Device Workspace Consistency

A device should belong to the same workspace it is requesting.

Example:

```text
device.workspaceId = A
request.workspaceId = B
```

must fail.

---

# 82. User Workspace Consistency

If users can eventually have multiple workspaces:

```text
user
 ├── workspace A
 └── workspace B
```

the server must verify workspace membership.

For the MVP, one workspace per user is acceptable, but the schema should not prevent future expansion.

---

# 83. Cascading Deletes

Avoid automatic cascading deletes for important history.

Deleting a device should not automatically delete:

```text
notes
revisions
changes
audit logs
```

Device revocation is preferable.

---

# 84. Account Deletion

Account deletion is a future operation and needs a dedicated data-retention policy.

Do not implement it as:

```text
delete user
```

without considering:

```text
workspace
notes
revisions
audit logs
devices
pairing sessions
```

---

# 85. Audit Privacy

Audit logs should not unnecessarily duplicate full note content.

Prefer:

```text
action
noteId
revision
device
user
metadata
```

instead of storing complete content in every audit record.

The revision system already contains historical content where appropriate.

---

# 86. Revision Storage Growth

If a user edits a note 10,000 times:

```text
1 note
10,000 revisions
10,000 changes
```

This is acceptable for correctness but may become expensive.

Potential future optimizations:

```text
snapshots
revision compaction
retention policies
delta storage
```

Do not optimize this prematurely.

---

# 87. Change vs Revision

These are different concepts.

### Change

Synchronization event.

```text
Device A changed Note X
```

### Revision

Version of the note.

```text
Note X is now revision 7
```

One accepted change normally produces one new revision.

---

# 88. Change vs Audit

### Change

Machine-readable synchronization data.

### Audit

Human-readable history.

They should not be merged into one collection because their purposes differ.

---

# 89. Conflict vs Revision

A conflict does not itself become a revision.

Instead:

```text
Conflict
 ↓
User resolution
 ↓
New accepted mutation
 ↓
New revision
```

---

# 90. Example Complete Note Lifecycle

Initial:

```text
Note A
revision 1
```

Update:

```text
revision 2
```

Update:

```text
revision 3
```

Delete:

```text
revision 4
deleted
```

Restore:

```text
revision 5
active
```

History:

```text
1 create
2 update
3 update
4 delete
5 restore
```

---

# 91. Example Database State

After creating one note:

```text
notes
 └── note_1

note_revisions
 └── revision_1

changes
 └── change_1

audit_logs
 └── audit_1
```

---

# 92. After One Update

```text
notes
 └── note_1 revision 2

note_revisions
 ├── revision_1
 └── revision_2

changes
 ├── change_1
 └── change_2

audit_logs
 ├── audit_1
 └── audit_2
```

---

# 93. After Device Hides Note

```text
note_visibility
 └── note_1 + device_web = hidden

audit_logs
 └── note.hidden
```

The note itself remains:

```text
active
```

---

# 94. After Device Revocation

```text
devices
 └── device_web
      status = revoked
```

Notes remain unchanged.

---

# 95. Recommended MongoDB Collections — Final

```text
users
workspaces
devices
pairing_sessions

notes
note_revisions
changes
conflicts
note_visibility
audit_logs
```

This is the recommended initial production-oriented schema.

---

# 96. Recommended Local Tables — Final

```text
local_notes
local_revisions
pending_changes
sync_state
local_conflicts
local_visibility
device_state
```

---

# 97. Server-to-Client Relationship

```text
MongoDB
│
├── notes
│      ↓
│   local_notes
│
├── note_revisions
│      ↓
│   local_revisions
│
├── changes
│      ↓
│   pending_changes / applied changes
│
├── conflicts
│      ↓
│   local_conflicts
│
├── note_visibility
│      ↓
│   local_visibility
│
└── devices
       ↓
    device_state
```

---

# 98. Database Rules

The following rules are mandatory.

1. `noteId` must be globally unique.
2. `changeId` must be globally unique.
3. `revisionId` must be globally unique.
4. A note revision must be unique per note.
5. A change sequence must be unique per workspace.
6. A device must belong to a workspace.
7. A device must belong to a user.
8. A note belongs to a workspace.
9. A note creator is not the note owner.
10. Revision history is immutable.
11. Audit history is append-only.
12. Visibility rules are independent of note deletion.
13. Device revocation does not delete notes.
14. Pairing secrets are short-lived.
15. Pairing secrets should not be stored in plaintext.
16. Client mutations must be idempotent.
17. Client cursors must only advance after successful application.
18. Remote changes must not become local outgoing changes.
19. Server-generated sequence numbers determine synchronization order.
20. Authorization must always be verified server-side.

---

# 99. Database Testing Requirements

Every collection should have tests for:

```text
create
read
update
delete
duplicate IDs
invalid references
unauthorized access
concurrent writes
transaction rollback
```

Synchronization-specific tests must additionally cover:

```text
duplicate changeId
duplicate sequence
stale revision
conflicting revision
cursor recovery
partial batch
replayed mutation
revoked device
hidden note
```

---

# 100. Migration Strategy

Database changes must use migrations.

Never assume a production database can simply be deleted and recreated.

Migration examples:

```text
001_initial_schema
002_add_device_visibility
003_add_conflicts
004_add_audit_indexes
```

---

# 101. Schema Version

The API and database should eventually expose schema versions.

Example:

```text
databaseSchemaVersion = 1
syncProtocolVersion = 1
```

This becomes important when old mobile applications remain installed for months.

---

# 102. Mobile Backward Compatibility

An old mobile application may reconnect after the backend has changed.

The server should know:

```text
clientVersion
syncProtocolVersion
```

and reject unsupported protocol versions cleanly rather than corrupting data.

---

# 103. Web Backward Compatibility

Because web clients can update frequently, backward compatibility is easier, but an open browser tab can still run an old JavaScript bundle.

The sync API should therefore remain backward compatible across reasonable client versions.

---

# 104. Recommended Next Database Milestone

Before implementing the application, create:

```text
server/
  models/
    User.js
    Workspace.js
    Device.js
    PairingSession.js
    Note.js
    NoteRevision.js
    Change.js
    Conflict.js
    NoteVisibility.js
    AuditLog.js

client/
  database/
    notes
    revisions
    pendingChanges
    syncState
    conflicts
    visibility
```

The exact folder structure can be changed to match the project's architecture.

---

# 105. Final Architecture

The final database model is:

```text
                         USER
                          │
                          ▼
                      WORKSPACE
                          │
          ┌───────────────┼────────────────┐
          │               │                │
          ▼               ▼                ▼
       DEVICES          NOTES          AUDIT LOGS
          │               │
          │               ├──────────────┐
          │               │              │
          │               ▼              ▼
          │          REVISIONS        CHANGES
          │                              │
          │                              ▼
          │                          CONFLICTS
          │
          ▼
   NOTE VISIBILITY

PAIRING SESSIONS
        │
        ▼
     DEVICES
```

The key architectural distinction is:

```text
Workspace ownership
        ≠
Device ownership
        ≠
Note creation
        ≠
Synchronization state
        ≠
Visibility
        ≠
Audit history
```

Keeping these concepts separate is what allows the application to support offline synchronization, multiple devices, ownership, device-specific hiding, conflict resolution, and complete change history without turning the database into an unmanageable state machine.
