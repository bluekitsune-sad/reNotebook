# DATABASE.md

# Synced Notepad — Database Architecture

**Project:** Synced Notepad
**Database:** MongoDB
**Client Local Storage:** SQLite / IndexedDB depending on platform
**Status:** Initial Technical Specification
**Version:** 0.1

---

# 1. Purpose

This document defines the persistent data model for the Synced Notepad system.

The database must support:

* Multiple users
* Workspaces
* Device ownership
* QR pairing
* Device sessions
* Notes
* Note revisions
* Offline synchronization
* Change logs
* Conflicts
* Audit logs
* Device-specific visibility
* Device revocation
* Ownership transfers
* Soft deletion
* Sync cursors

The server uses MongoDB as its primary persistent database.

The clients maintain their own local databases.

---

# 2. Database Architecture

The system has two database layers.

```text
                 SERVER
                   │
                   ▼
                MongoDB
                   │
        ┌──────────┼───────────┐
        │          │           │
      Users      Notes       Changes
        │          │           │
      Devices   Revisions   Conflicts
```

Each client has a local database:

```text
Mobile
  │
  ▼
SQLite
  ├── notes
  ├── revisions
  ├── pending_changes
  ├── conflicts
  └── sync_state

Web
  │
  ▼
IndexedDB
  ├── notes
  ├── revisions
  ├── pending_changes
  ├── conflicts
  └── sync_state
```

---

# 3. Server Collections

Initial MongoDB collections:

```text
users
workspaces
workspace_members
devices
sessions
notes
note_revisions
changes
conflicts
audit_logs
note_permissions
sync_cursors
pairing_sessions
```

---

# 4. Users

```js
{
  _id: ObjectId,

  email: String,
  username: String,

  passwordHash: String,

  createdAt: Date,
  updatedAt: Date,

  status: "active"
}
```

Possible statuses:

```text
active
suspended
deleted
```

---

# 5. Workspaces

A workspace represents one synchronized collection of notes.

```js
{
  _id: ObjectId,

  ownerId: ObjectId,

  name: String,

  createdAt: Date,
  updatedAt: Date,

  currentSequence: NumberLong,

  status: "active"
}
```

A user's main notepad can be represented by a default workspace.

---

# 6. Workspace Members

Although the first version may primarily support one owner, the model should allow additional users later.

```js
{
  _id: ObjectId,

  workspaceId: ObjectId,
  userId: ObjectId,

  role: "owner",

  status: "active",

  joinedAt: Date
}
```

Future roles:

```text
owner
editor
viewer
```

---

# 7. Devices

Every paired device receives a persistent device identity.

```js
{
  _id: ObjectId,

  deviceId: String,

  userId: ObjectId,

  workspaceId: ObjectId,

  name: String,

  platform: "ios" | "android" | "web" | "desktop",

  status: "active",

  pairedAt: Date,
  lastSeenAt: Date,

  revokedAt: Date | null,

  metadata: {
    appVersion: String,
    syncProtocolVersion: Number
  }
}
```

`deviceId` must be unique.

---

# 8. Device Ownership

The workspace owner is the ultimate owner of synchronized data.

The device is not the owner of the data.

Important distinction:

```text
User
  ↓ owns
Workspace
  ↓ contains
Notes
  ↓ synchronized to
Devices
```

A device is an authorized replica.

It should not become the permanent authority simply because it created a note.

---

# 9. Sessions

Sessions represent authenticated device/application sessions.

```js
{
  _id: ObjectId,

  sessionId: String,

  userId: ObjectId,
  deviceId: String,

  createdAt: Date,
  lastUsedAt: Date,

  expiresAt: Date,

  status: "active"
}
```

Sessions must be revocable.

---

# 10. Notes

```js
{
  _id: ObjectId,

  noteId: String,

  workspaceId: ObjectId,

  title: String,

  content: Object,

  revision: NumberLong,

  createdBy: ObjectId,
  updatedBy: ObjectId,

  createdAt: Date,
  updatedAt: Date,

  deletedAt: Date | null
}
```

`noteId` should be generated client-side.

---

# 11. Note Content

Do not permanently design the database around:

```js
content: String
```

Instead, allow structured content.

Initial version:

```js
content: {
  type: "plain_text",
  text: "Hello world"
}
```

Future:

```js
content: {
  type: "document",
  blocks: []
}
```

This gives the editor room to evolve.

---

# 12. Note Revisions

Revisions are immutable.

```js
{
  _id: ObjectId,

  revisionId: String,

  noteId: String,
  workspaceId: ObjectId,

  revision: NumberLong,

  parentRevision: NumberLong | null,

  title: String,
  content: Object,

  actorId: ObjectId,
  deviceId: String,

  changeId: String,

  createdAt: Date
}
```

Never update historical revisions.

---

# 13. Changes

The changes collection is the server synchronization log.

```js
{
  _id: ObjectId,

  changeId: String,

  workspaceId: ObjectId,

  noteId: String,

  operation: "create" | "update" | "delete" | "restore",

  actorId: ObjectId,
  deviceId: String,

  baseRevision: NumberLong,

  revision: NumberLong,

  payload: Object,

  serverSequence: NumberLong,

  createdAt: Date
}
```

---

# 14. Change ID

Create a unique index:

```text
workspaceId + changeId
```

This prevents duplicate logical changes.

---

# 15. Server Sequence

Each workspace maintains:

```text
currentSequence
```

When an accepted change is committed:

```text
currentSequence + 1
```

The resulting number becomes the change's `serverSequence`.

---

# 16. Sequence Generation

Sequence generation must be atomic.

Do not do:

```js
read currentSequence
currentSequence++
save
```

without concurrency protection.

Two simultaneous requests could otherwise receive the same sequence.

Use MongoDB atomic operations or a transaction-safe sequence mechanism.

---

# 17. Conflicts

```js
{
  _id: ObjectId,

  conflictId: String,

  workspaceId: ObjectId,
  noteId: String,

  baseRevision: NumberLong,

  versions: [
    {
      revision: NumberLong,

      actorId: ObjectId,
      deviceId: String,

      title: String,
      content: Object,

      createdAt: Date
    }
  ],

  status: "open" | "resolved",

  resolution: {
    type: "keep_version" | "merge" | "keep_both",
    revision: NumberLong,
    resolvedBy: ObjectId,
    resolvedAt: Date
  },

  createdAt: Date,
  resolvedAt: Date | null
}
```

---

# 18. Conflict Versions

Conflict versions must remain accessible until the conflict is resolved.

After resolution, historical versions should still remain in `note_revisions`.

---

# 19. Note Permissions

Device-specific visibility:

```js
{
  _id: ObjectId,

  noteId: String,
  workspaceId: ObjectId,

  deviceId: String,

  visibility: "visible" | "hidden",

  changedBy: ObjectId,

  createdAt: Date,
  updatedAt: Date
}
```

---

# 20. Better Permission Model

For scalability, consider representing only exceptions.

Example:

```text
Default:
visible

Exceptions:
device_123 → hidden
device_456 → hidden
```

This avoids creating permission records for every device-note combination.

---

# 21. Audit Logs

```js
{
  _id: ObjectId,

  eventId: String,

  workspaceId: ObjectId,

  actorId: ObjectId,
  deviceId: String,

  eventType: String,

  entityType: String,
  entityId: String,

  metadata: Object,

  createdAt: Date
}
```

Example:

```js
{
  eventType: "note.updated",

  metadata: {
    revision: 8
  }
}
```

---

# 22. Audit Events

Initial event types:

```text
workspace.created
workspace.owner_changed

device.paired
device.renamed
device.revoked

note.created
note.updated
note.deleted
note.restored

note.visibility_changed

conflict.created
conflict.resolved
```

---

# 23. Pairing Sessions

QR pairing should use a temporary pairing session.

```js
{
  _id: ObjectId,

  pairingId: String,

  ownerDeviceId: String,

  workspaceId: ObjectId,

  secretHash: String,

  status: "pending" | "claimed" | "expired" | "cancelled",

  expiresAt: Date,

  createdAt: Date,

  claimedAt: Date | null
}
```

The raw secret should not be stored.

---

# 24. Sync Cursors

The server may optionally store device synchronization state.

```js
{
  _id: ObjectId,

  workspaceId: ObjectId,
  deviceId: String,

  lastSequence: NumberLong,

  updatedAt: Date
}
```

However, the client should also maintain its own cursor.

The server cursor is useful for:

* Diagnostics
* Device management
* Stale-device detection
* Operational monitoring

---

# 25. MongoDB Indexes

Required initial indexes:

```text
users.email UNIQUE

devices.deviceId UNIQUE

notes.noteId UNIQUE

changes.changeId UNIQUE

changes:
  workspaceId + serverSequence

note_revisions:
  noteId + revision

audit_logs:
  workspaceId + createdAt

conflicts:
  workspaceId + status

pairing_sessions:
  pairingId UNIQUE

pairing_sessions:
  expiresAt TTL
```

---

# 26. TTL Indexes

Temporary data should automatically expire.

Good candidates:

```text
pairing_sessions
temporary authentication challenges
temporary rate-limit state
```

Do not use TTL indexes for:

```text
notes
revisions
audit logs
changes
```

unless the retention architecture explicitly supports it.

---

# 27. MongoDB Transactions

Transactions should be used when one logical synchronization operation requires multiple collections to change atomically.

Example accepted note update:

```text
notes
+
note_revisions
+
changes
+
audit_logs
```

These should be committed together.

---

# 28. Transaction Failure

If any required operation fails:

```text
rollback
```

The client can retry.

The server must not return `accepted` unless the complete operation was committed.

---

# 29. Soft Deletes

Do not physically delete notes immediately.

Use:

```js
deletedAt: Date
```

This provides synchronization information.

---

# 30. Permanent Deletion

Permanent deletion should be a separate administrative operation.

It should only happen when:

* Retention requirements permit it
* No synchronization device still needs the data
* Required audit information is preserved
* Conflict/recovery requirements are satisfied

---

# 31. Local Database Schema

The mobile SQLite database should approximately mirror:

```text
notes
revisions
pending_changes
processed_changes
conflicts
sync_state
```

The web IndexedDB schema should provide equivalent logical stores.

The implementations do not need identical storage engines.

---

# 32. Processed Changes

A local processed-change store can prevent duplicate application.

```js
{
  changeId: String,
  serverSequence: NumberLong,
  processedAt: Date
}
```

Old entries may eventually be compacted once safe.

---

# 33. Data Ownership Model

The hierarchy is:

```text
User
 │
 └── owns Workspace
       │
       ├── Notes
       ├── Devices
       ├── Revisions
       ├── Changes
       ├── Conflicts
       └── Audit History
```

Devices do not own notes.

They hold authorized replicas.

---

# 34. Important Database Invariants

The following must always be true:

```text
note.revision
=
latest persisted note revision
```

and:

```text
revision.noteId
=
note.noteId
```

and:

```text
change.revision
=
revision.revision
```

and:

```text
change.changeId
=
the logical operation represented by that change
```

---

# 35. Database Design Principle

The current note is optimized for reads.

The revision/change collections are optimized for:

* synchronization
* history
* conflict resolution
* auditability

Do not attempt to make one MongoDB document perform all roles.

---

# 36. Recommended Future Collections

Potential future additions:

```text
workspace_snapshots
encryption_keys
notifications
webhook_events
sync_metrics
device_activity
```

These should be added only when required.

---

# 37. Final Database Rule

MongoDB stores the authoritative synchronized state.

Clients store working replicas.

A local database must never be treated as proof that the server accepted a change.
