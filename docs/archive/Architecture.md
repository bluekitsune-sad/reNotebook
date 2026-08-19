# ARCHITECTURE.md

# Synced Notepad — System Architecture

**Project:** Synced Notepad
**Frontend:** Next.js + JavaScript
**Mobile:** React Native + JavaScript
**Backend:** Node.js + Express + JavaScript
**Database:** MongoDB
**Web Local Storage:** IndexedDB
**Mobile Local Storage:** SQLite
**Architecture:** Offline-first, multi-device, eventually consistent synchronization
**Version:** 0.1

---

# 1. Overview

Synced Notepad is a single-notepad system that can be accessed from multiple authorized devices.

The user should experience it as:

```text
                ┌──────────────┐
                │  My Notepad  │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
       Mobile         Web        Future App
          │            │            │
          └────────────┼────────────┘
                       │
                    Syncing
```

Internally, however, each device maintains a local replica.

```text
Mobile Local DB
      │
      │
      ▼
   Sync Engine
      │
      │
      ▼
   Server/API
      │
      ▼
   MongoDB
      ▲
      │
   Server/API
      ▲
      │
   Sync Engine
      ▲
      │
 Web Local DB
```

The architecture is designed around the assumption that:

> Any device can be offline at any time.

---

# 2. Core Architectural Principles

The system follows these principles:

1. Local writes must work without internet.
2. Every local write creates a durable change.
3. Synchronization must be resumable.
4. Synchronization must be idempotent.
5. The server is authoritative for shared state.
6. Historical changes must be preserved.
7. Conflicts must never silently destroy user data.
8. Devices are authorized replicas, not owners of notes.
9. QR codes authorize devices rather than transfer permanent credentials.
10. Device-specific note hiding must be enforced server-side.
11. Realtime communication is an optimization, not a requirement for correctness.

---

# 3. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │       MongoDB       │
                         │                     │
                         │ Users               │
                         │ Workspaces          │
                         │ Devices             │
                         │ Notes               │
                         │ Revisions           │
                         │ Changes             │
                         │ Conflicts           │
                         │ Audit Logs          │
                         └──────────┬──────────┘
                                    │
                              Node.js API
                                    │
                   ┌────────────────┴────────────────┐
                   │                                 │
             REST API                          WebSocket
                   │                                 │
          ┌────────┴────────┐               Notifications
          │                 │
          ▼                 ▼
   Next.js Web        React Native
          │                 │
     IndexedDB            SQLite
          │                 │
          ▼                 ▼
     Web Sync          Mobile Sync
       Engine             Engine
          │                 │
          └────────┬────────┘
                   │
             Sync Protocol
```

---

# 4. Repository Structure

Use a monorepo.

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
│       │   ├── routes/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── models/
│       │   ├── middleware/
│       │   ├── sync/
│       │   ├── pairing/
│       │   ├── auth/
│       │   └── utils/
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
└── README.md
```

---

# 5. Why Use a Monorepo?

The web, mobile app, and server share important concepts.

For example:

```text
Change
Revision
Note
Conflict
Sync Cursor
```

Instead of implementing the same logic separately:

```text
web implementation
mobile implementation
server implementation
```

shared domain logic can live in:

```text
packages/sync-core
```

---

# 6. Important Boundary

Do not share database-specific code.

For example:

```text
Web:
IndexedDB

Mobile:
SQLite

Server:
MongoDB
```

The repositories can implement the same logical interface.

Example:

```js
notesRepository.get(noteId)

notesRepository.create(note)

notesRepository.update(note)

notesRepository.delete(note)
```

The underlying implementation differs by platform.

---

# 7. Client Architecture

Both clients should follow:

```text
UI
 ↓
Application Logic
 ↓
Domain Services
 ↓
Repositories
 ↓
Local Database
```

Synchronization is a separate subsystem:

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

---

# 8. Note Creation Flow

Suppose the user creates:

```text
Shopping List
```

while offline.

The flow is:

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
```

The user immediately sees the note.

No network request is required.

---

# 9. Local Transaction

Creating a note must be atomic locally.

Conceptually:

```js
await database.transaction(async () => {
  await notes.create(note);

  await revisions.create(revision);

  await pendingChanges.create(change);
});
```

Either everything succeeds or nothing does.

---

# 10. Why the Change Queue Matters

Never rely on:

```text
"Just upload the current note later."
```

Instead store the actual operation.

Example:

```js
{
  changeId: "change_123",
  noteId: "note_123",
  operation: "create",
  baseRevision: null,
  payload: {
    title: "Shopping",
    content: {
      type: "plain_text",
      text: "Milk"
    }
  }
}
```

This means the operation survives:

* app crashes
* device restarts
* network failures
* server failures

---

# 11. Sync Engine

The sync engine is one of the most important components.

Conceptually:

```text
SyncEngine
│
├── getStatus()
├── sync()
├── pull()
├── push()
├── applyRemoteChanges()
├── processPushResults()
├── handleConflict()
└── updateCursor()
```

---

# 12. Sync State Machine

The sync engine should have explicit states.

```text
idle
 │
 ▼
checking
 │
 ▼
pulling
 │
 ▼
applying
 │
 ▼
pushing
 │
 ▼
processing
 │
 ▼
completed
```

Failure:

```text
any state
   │
   ▼
error
   │
   ▼
retry_wait
   │
   ▼
checking
```

---

# 13. Sync Trigger Sources

Synchronization should be triggered by:

```text
application startup
network reconnect
manual refresh
periodic background sync
local change
WebSocket notification
device pairing completion
```

---

# 14. Important Rule

A local change should NOT wait for the network.

Correct:

```text
User edits
 ↓
Save locally
 ↓
UI updates
 ↓
Queue change
 ↓
Sync later
```

Incorrect:

```text
User edits
 ↓
Wait for server
 ↓
Update UI
```

---

# 15. Pull Flow

Example:

```text
Client cursor = 100
```

Client asks:

```http
POST /api/v1/sync/pull
```

with:

```json
{
  "workspaceId": "workspace_1",
  "cursor": 100
}
```

Server returns:

```text
changes 101 → 150
```

Client:

```text
validate
 ↓
apply changes
 ↓
update cursor to 150
```

---

# 16. Cursor Safety

The client must never advance the cursor before successfully applying the changes.

Wrong:

```text
receive changes
 ↓
save cursor
 ↓
apply changes
```

If the application crashes between those steps, changes can be lost.

Correct:

```text
receive changes
 ↓
apply transaction
 ↓
save cursor
```

---

# 17. Pull Transaction

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

If the operation fails:

```text
ROLLBACK
```

The client retries from cursor 100.

---

# 18. Push Flow

Suppose the client has:

```text
change A
change B
change C
```

It sends:

```text
A
B
C
```

The server processes each idempotently.

Possible result:

```text
A → accepted
B → conflict
C → accepted
```

The client must process results individually.

---

# 19. Partial Push

A failed change must not prevent unrelated changes from being processed unless there is a dependency.

Example:

```text
A create note
B update same note
```

B depends on A.

But:

```text
C create another note
```

does not.

The sync engine should eventually be able to process independent changes.

---

# 20. Change Dependencies

Initial MVP can keep ordering simple:

```text
same note → preserve order
different notes → independent
```

This significantly simplifies the first implementation.

---

# 21. Server Architecture

The backend should use:

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

Example:

```text
POST /sync/push
       ↓
SyncController
       ↓
SyncService
       ↓
NoteRepository
ChangeRepository
RevisionRepository
       ↓
MongoDB
```

---

# 22. Controllers

Controllers should remain thin.

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

# 23. Services

Services contain business rules.

Examples:

```text
SyncService
PairingService
DeviceService
NoteService
ConflictService
AuditService
WorkspaceService
```

---

# 24. Repositories

Repositories handle persistence.

Examples:

```text
UserRepository
WorkspaceRepository
DeviceRepository
NoteRepository
RevisionRepository
ChangeRepository
ConflictRepository
AuditRepository
```

---

# 25. Server Sync Processing

A single incoming change should conceptually go through:

```text
Receive
 ↓
Authenticate
 ↓
Authorize
 ↓
Validate
 ↓
Check idempotency
 ↓
Load note
 ↓
Check revision
 ↓
Detect conflict
 ↓
Apply or create conflict
 ↓
Create revision
 ↓
Create change record
 ↓
Create audit record
 ↓
Commit transaction
```

---

# 26. Server Transaction

For an accepted update:

```text
MongoDB transaction

notes
+
note_revisions
+
changes
+
audit_logs

COMMIT
```

This ensures that the server cannot report a successful change while only partially storing it.

---

# 27. Server Sequence

Each workspace maintains:

```text
currentSequence
```

Example:

```text
currentSequence = 500
```

Incoming accepted change:

```text
501
```

Next:

```text
502
```

Clients synchronize based on this sequence.

---

# 28. Why Sequence Instead of Timestamp?

Do not use:

```text
updatedAt > lastSyncTime
```

as the primary synchronization mechanism.

Timestamps introduce problems with:

* clock differences
* precision
* simultaneous changes
* ordering
* device clock manipulation

A server-controlled monotonically increasing sequence is safer.

---

# 29. WebSocket Architecture

WebSocket should not become a second synchronization system.

Use it as a notification channel.

Example:

```text
Device A changes note
       ↓
Server commits change
       ↓
Server sends:
workspace.changed
       ↓
Device B wakes sync engine
       ↓
Device B pulls changes
```

---

# 30. WebSocket Failure

If WebSocket disconnects:

```text
nothing is lost
```

because Device B can later execute:

```text
pull(cursor)
```

The server remains the source of synchronization history.

---

# 31. QR Pairing Architecture

Pairing has two stages.

```text
Stage 1:
Temporary pairing

Stage 2:
Permanent device authorization
```

---

# 32. QR Flow

```text
Existing Device
      │
      │ create pairing session
      ▼
    Server
      │
      │ pairing ID + secret
      ▼
Existing Device
      │
      │ display QR
      ▼
New Device
      │
      │ scan
      ▼
    Server
      │
      │ pending request
      ▼
Existing Device
      │
      │ approve
      ▼
    Server
      │
      │ create authorized device
      ▼
New Device
      │
      │ initial sync
      ▼
Local Database
```

---

# 33. Ownership Architecture

The ownership hierarchy is:

```text
User
 │
 └── Owner of Workspace
       │
       ├── Notes
       ├── Devices
       ├── Revisions
       ├── Conflicts
       └── Audit History
```

Devices do not own notes.

---

# 34. Why Devices Should Not Be Owners

Suppose:

```text
Phone creates 2 notes
Web creates 3 notes
```

Neither device should claim:

```text
"My 2 notes"
```

The server sees:

```text
Workspace
 ├── Note 1
 ├── Note 2
 ├── Note 3
 ├── Note 4
 └── Note 5
```

All authorized devices eventually receive the same workspace state.

---

# 35. Device-specific Hidden Notes

The system needs to distinguish:

```text
Workspace data
```

from:

```text
Device visibility
```

Example:

```text
Note A:
visible everywhere

Note B:
hidden from Device B

Note C:
visible everywhere
```

Server-side visibility filtering prevents Device B from receiving Note B.

---

# 36. Hidden Note Behavior

When a user hides a note from Device B:

```text
Server
 ↓
visibility rule
 ↓
Device B
```

Device B should not receive future note content.

If it already has the note locally, the next synchronization should cause the client to remove or quarantine its local copy according to the application's data policy.

---

# 37. Important Security Limitation

If a device previously received a note, the server cannot guarantee that the user did not:

* screenshot it
* copy it
* export it
* photograph it
* modify the application

Therefore:

> "Hide from device" means prevent future authorized synchronization, not guaranteed destruction of previously viewed information.

---

# 38. Conflict Architecture

Conflict detection occurs on the server.

Example:

```text
Server revision = 10

Device A:
baseRevision = 10
update → accepted
server revision = 11

Device B:
baseRevision = 10
update → conflict
```

Device B receives:

```text
conflictId
```

rather than silently overwriting revision 11.

---

# 39. Conflict UI Architecture

The UI should represent conflicts separately from normal notes.

Example:

```text
Notes
 ├── Shopping
 ├── Ideas
 └── Project

Conflicts
 └── Shopping — 2 versions
```

---

# 40. Conflict Resolution

User selects:

```text
Keep mine
Keep theirs
Merge
Keep both
```

The selected resolution creates a new revision.

Example:

```text
Revision 10
   │
   ├── Revision 11 — Phone
   │
   └── Revision 12 — Web
             │
             ▼
        Resolution
             │
             ▼
        Revision 13
```

---

# 41. Audit Architecture

Every important mutation generates an audit event.

Example:

```text
User A
Device: Chrome
Updated note
Revision: 14
Time: 10:32
```

The audit system answers:

```text
Who?
What?
When?
Which device?
Which note?
Which revision?
```

---

# 42. Audit vs Revision

These are different.

Revision:

```text
What did the note become?
```

Audit:

```text
What action happened and who performed it?
```

A revision is data history.

An audit log is activity history.

---

# 43. Application Startup

When the web app starts:

```text
Load application
 ↓
Load local database
 ↓
Display cached notes
 ↓
Check authentication
 ↓
Check network
 ↓
Start synchronization
```

The user should see notes before synchronization finishes.

---

# 44. Mobile Startup

Same principle:

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

Do not block the UI waiting for the server.

---

# 45. Offline Indicator

The application should clearly show:

```text
Offline
```

or:

```text
Syncing...
```

or:

```text
Synced
```

Potential UI:

```text
● Synced
```

```text
● Syncing
```

```text
● Offline — changes saved
```

---

# 46. Pending Changes Indicator

If the user has unsynchronized edits:

```text
3 changes waiting to sync
```

This provides confidence that their edits were not lost.

---

# 47. Sync Retry

Use exponential backoff.

Example:

```text
1 second
2 seconds
4 seconds
8 seconds
16 seconds
30 seconds
60 seconds
```

with jitter.

Do not retry infinitely at maximum speed.

---

# 48. Manual Sync

The user should have a way to manually trigger:

```text
Sync now
```

This is useful for troubleshooting.

---

# 49. Sync Status Model

Each local change can have:

```text
pending
uploading
accepted
conflict
failed
```

Example:

```text
Change A → accepted
Change B → pending
Change C → conflict
```

---

# 50. Error Recovery

A temporary error:

```text
SERVER_UNAVAILABLE
```

should not delete the change.

Instead:

```text
pending
```

A permanent validation error:

```text
INVALID_CHANGE
```

should move to:

```text
failed
```

and surface an actionable error to the user.

---

# 51. Network Detection

Network availability should not be considered proof that the server is reachable.

There are two states:

```text
Network appears available
```

and:

```text
Server successfully reachable
```

The sync engine should react to actual request results.

---

# 52. App Crash Recovery

Suppose the app crashes after:

```text
local note saved
```

but before:

```text
server upload
```

The pending change remains in the local database.

After restart:

```text
load pending changes
 ↓
sync
```

No user data is lost.

---

# 53. Duplicate Request Recovery

Suppose:

```text
server accepted change
```

but response was lost.

Client retries the same `changeId`.

Server responds:

```text
already_processed
```

No duplicate revision is created.

---

# 54. Pull Response Lost

Suppose:

```text
server sends changes 101–150
```

but client crashes before updating cursor.

After restart:

```text
client still has cursor 100
```

It requests 101–150 again.

The client must safely recognize already-applied changes.

This is why remote change application must be idempotent.

---

# 55. Idempotent Change Application

The local database should maintain enough information to determine:

```text
Has this change already been applied?
```

Possible mechanism:

```text
processedChanges
```

or a transaction that checks revision/sequence state.

---

# 56. Initial Sync

When a new device is paired:

```text
Device registration
 ↓
workspace authorization
 ↓
cursor = 0
 ↓
pull all available changes
 ↓
build local state
```

For very large workspaces, future versions can introduce snapshots.

---

# 57. Snapshot Architecture

If the workspace eventually contains millions of changes:

```text
Current state snapshot
+
changes after snapshot
```

Example:

```text
Snapshot at sequence 1,000,000
       +
Changes 1,000,001 → current
```

The new device does not need to replay every historical change.

This is a future optimization, not an MVP requirement.

---

# 58. Pagination

Never assume a workspace can be synchronized in one request.

Example:

```text
pull 0 → 500
pull 500 → 1000
pull 1000 → 1500
```

The client continues until:

```text
hasMore = false
```

---

# 59. Large Notes

The system should eventually define maximum:

```text
note size
title size
batch size
request size
```

This protects the server from accidental or malicious oversized payloads.

---

# 60. Search Architecture

Initial search can happen locally.

```text
User searches
 ↓
Local DB
 ↓
Results
```

This allows search while offline.

Future server-side search can be added for:

```text
very large datasets
cross-device indexing
advanced search
```

---

# 61. Notifications

Realtime notifications should not contain sensitive note content.

Prefer:

```json
{
  "type": "workspace.changed",
  "workspaceId": "workspace_123"
}
```

rather than:

```json
{
  "noteContent": "private information"
}
```

---

# 62. Authentication Boundary

Authentication answers:

```text
Who is this user?
```

Authorization answers:

```text
Can this device access this workspace?
```

These must remain separate.

---

# 63. Device Authorization Boundary

A valid account session is not enough.

The server should check:

```text
session valid
AND
device valid
AND
device belongs to user
AND
device authorized for workspace
```

---

# 64. Request Processing Example

A synchronization request:

```text
POST /sync/push
```

passes through:

```text
HTTP
 ↓
Authentication Middleware
 ↓
Device Middleware
 ↓
Workspace Authorization
 ↓
Validation
 ↓
SyncController
 ↓
SyncService
 ↓
MongoDB Transaction
```

---

# 65. Security Boundary

The client may send:

```text
deviceId
workspaceId
noteId
changeId
```

but the server must never blindly trust their ownership.

The server determines:

```text
authenticated user
```

and then verifies all referenced resources.

---

# 66. Client-to-Server Data Flow

```text
             LOCAL DEVICE
                  │
            User changes note
                  │
                  ▼
            Local transaction
             /          \
            /            \
       notes DB       change queue
                           │
                           ▼
                       Sync Engine
                           │
                           ▼
                        HTTPS
                           │
                           ▼
                       Node API
                           │
                           ▼
                    Authorization
                           │
                           ▼
                     Sync Service
                           │
                           ▼
                     MongoDB Tx
                           │
                 ┌─────────┴────────┐
                 │                  │
              accepted            conflict
                 │                  │
                 ▼                  ▼
              revision          conflict
                 │                  │
                 └─────────┬────────┘
                           ▼
                       API response
                           │
                           ▼
                      Sync Engine
                           │
                           ▼
                    Local database
```

---

# 67. Server-to-Client Data Flow

```text
Device A
   │
   │ update
   ▼
Server
   │
   │ create change sequence 501
   ▼
WebSocket notification
   │
   ▼
Device B
   │
   │ pull(cursor=500)
   ▼
Server
   │
   │ change 501
   ▼
Device B
   │
   ▼
Local transaction
   │
   ▼
UI updates
```

---

# 68. Multi-device Example

Initial state:

```text
Server:
0 notes

Mobile:
0 notes

Web:
0 notes
```

Mobile goes offline.

Creates:

```text
A
B
```

Mobile:

```text
2 notes
2 pending changes
```

Web goes offline.

Creates:

```text
C
D
E
```

Web:

```text
3 notes
3 pending changes
```

Both reconnect.

Server receives:

```text
A
B
C
D
E
```

Server becomes:

```text
5 notes
```

Both devices eventually pull all changes.

Final:

```text
Mobile = 5
Web = 5
Server = 5
```

---

# 69. Simultaneous Edit Example

Initial:

```text
Revision 10
"Buy milk"
```

Phone:

```text
baseRevision = 10
"Buy milk and eggs"
```

Web:

```text
baseRevision = 10
"Buy milk tomorrow"
```

Phone reaches server first:

```text
Revision 11
```

Web arrives:

```text
baseRevision 10
currentRevision 11
```

Server detects:

```text
10 != 11
```

and determines whether the changes can be merged.

If not:

```text
Conflict created
```

---

# 70. Device-specific Visibility Example

Workspace:

```text
Note A
Note B
Note C
```

Owner hides:

```text
Note B
```

from:

```text
Device Web
```

Web's next synchronization receives:

```text
Note A
Note C
```

but not:

```text
Note B
```

Mobile still receives:

```text
A
B
C
```

---

# 71. Revocation Example

Device:

```text
Web Chrome
```

is revoked.

Before revocation:

```text
Web = authorized
```

After revocation:

```text
Web = revoked
```

If Web attempts:

```text
POST /sync/push
```

server returns:

```text
DEVICE_REVOKED
```

If Web attempts:

```text
POST /sync/pull
```

same result.

---

# 72. QR Pairing Example

Existing device:

```text
Mobile
```

generates:

```text
Pairing Session #123
```

QR contains temporary credentials.

Web scans.

Server creates:

```text
Pending device request
```

Mobile displays:

```text
Chrome wants to connect
```

Owner approves.

Server creates:

```text
Device Web
```

Web receives authorization.

Initial sync starts.

---

# 73. QR Race Condition

Two browsers scan the same QR:

```text
Chrome A
Chrome B
```

Only one pairing request can successfully claim the pairing session if the design requires single-use QR pairing.

The second receives:

```text
PAIRING_ALREADY_CLAIMED
```

The owner can generate another QR.

---

# 74. Realtime Race Condition

Device A changes a note.

Device B receives WebSocket event.

Before B pulls:

```text
Device C also changes another note.
```

B pulls:

```text
all changes after cursor
```

not just the change associated with the notification.

This prevents missing changes.

---

# 75. Why Pull Must Remain Authoritative

WebSocket messages can:

* arrive late
* arrive out of order
* be duplicated
* be lost
* disconnect

The sync cursor handles all of these.

Therefore:

```text
WebSocket = notification
Pull API = synchronization
```

---

# 76. Background Sync

Mobile background synchronization should be treated as opportunistic.

The system must continue functioning if:

```text
background execution is delayed
```

The next foreground connection will synchronize.

---

# 77. Browser Background Sync

The web application may use available browser background mechanisms where supported.

However:

> Background execution must never be required for data correctness.

---

# 78. Data Consistency Model

The system uses:

```text
Local:
immediate consistency

Across devices:
eventual consistency

Server:
authoritative canonical state
```

---

# 79. What "Synced" Means

A device is considered synced when:

```text
local cursor
=
latest known server sequence
```

and:

```text
pendingChanges = 0
```

and:

```text
no unresolved synchronization errors
```

---

# 80. Sync Status Formula

Conceptually:

```text
SYNCED
=
online
AND
pendingChanges == 0
AND
cursor == serverLatestSequence
AND
no blockingErrors
```

The actual UI may simplify this.

---

# 81. Offline Status

A device can be:

```text
offline + fully locally saved
```

This is not data loss.

Example:

```text
Offline
3 pending changes
```

is a valid operating state.

---

# 82. Failure Philosophy

Never solve a failure by silently deleting user data.

Bad:

```text
sync failed
→ delete local change
```

Good:

```text
sync failed
→ retain change
→ retry
→ inform user if necessary
```

---

# 83. Migration Strategy

Database schemas will change.

The application needs migration support for:

```text
IndexedDB
SQLite
MongoDB
```

Never assume all installed clients are running the latest version.

---

# 84. Protocol Versioning

Each client should identify:

```text
appVersion
syncProtocolVersion
```

Example:

```json
{
  "appVersion": "1.4.0",
  "syncProtocolVersion": 1
}
```

---

# 85. Protocol Compatibility

The server should be able to reject unsupported protocol versions cleanly.

Example:

```text
SYNC_PROTOCOL_UNSUPPORTED
```

The client should show:

```text
Please update the app to continue syncing.
```

---

# 86. Observability

The server should track:

```text
sync requests
sync failures
average sync duration
conflict count
pairing attempts
device revocations
WebSocket connections
```

Do not log note content.

---

# 87. Metrics

Useful metrics:

```text
sync.success
sync.failure
sync.conflict
sync.duration
sync.batch_size

pairing.started
pairing.success
pairing.failure

device.revoked

websocket.connected
websocket.disconnected
```

---

# 88. Health Checks

Server should expose:

```text
GET /health
```

and optionally:

```text
GET /ready
```

Readiness can verify required dependencies such as MongoDB.

---

# 89. Graceful Server Shutdown

When the server shuts down:

```text
stop accepting new requests
 ↓
finish active transactions
 ↓
close WebSocket connections
 ↓
close MongoDB connection
 ↓
exit
```

Clients should automatically reconnect.

---

# 90. Deployment Architecture

Initial deployment:

```text
                 Internet
                    │
              Reverse Proxy
                    │
          ┌─────────┴─────────┐
          │                   │
       Next.js             Node.js
          │                   │
          │                MongoDB
          │
       Static/Web
```

For production, HTTPS must terminate at the reverse proxy/load balancer.

---

# 91. Scaling Later

The architecture should allow:

```text
             Load Balancer
              /    |    \
             /     |     \
        Node 1   Node 2   Node 3
             \     |     /
                MongoDB
```

Because synchronization state is stored durably rather than only in server memory.

---

# 92. WebSocket Scaling

When multiple backend instances are used, WebSocket events need a shared event mechanism.

Possible future technology:

```text
Redis Pub/Sub
```

Example:

```text
Node 1 receives change
       ↓
Redis event
       ↓
Node 2
       ↓
WebSocket client
```

This is not required for the first local development version.

---

# 93. MongoDB Scaling

MongoDB should initially be deployed as a normal replica set/managed cluster appropriate to the environment.

Do not prematurely introduce sharding.

Sharding should only be considered when real workload requires it.

---

# 94. Performance Priorities

Prioritize:

```text
1. Correctness
2. Data durability
3. Security
4. Sync reliability
5. User experience
6. Performance optimization
```

A fast sync engine that occasionally loses notes is unacceptable.

---

# 95. Architecture Anti-Patterns

Do not:

```text
store only current note state
```

without change history.

Do not:

```text
use timestamps as the primary sync cursor
```

Do not:

```text
trust device-supplied user IDs
```

Do not:

```text
put permanent tokens in QR codes
```

Do not:

```text
make WebSocket responsible for synchronization
```

Do not:

```text
delete failed local changes
```

Do not:

```text
block editing while offline
```

Do not:

```text
let each platform implement completely different sync logic
```

---

# 96. Architecture Decision Summary

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

# 97. Final Architecture

The complete system can be summarized as:

```text
                         USER
                          │
              ┌───────────┴───────────┐
              │                       │
           Mobile                     Web
        React Native                Next.js
              │                       │
            SQLite                 IndexedDB
              │                       │
              └───────────┬───────────┘
                          │
                     Sync Engine
                          │
                   Change Protocol
                          │
                       HTTPS
                          │
                    Node.js API
                          │
             ┌────────────┴────────────┐
             │                         │
         REST API                  WebSocket
             │                         │
             └────────────┬────────────┘
                          │
                     Sync Service
                          │
                    Authorization
                          │
                    MongoDB Transaction
                          │
          ┌───────────────┼────────────────┐
          │               │                │
        Notes          Changes          Revisions
          │               │                │
          ├───────────────┼────────────────┤
          │               │                │
       Devices         Conflicts       Audit Logs
                          │
                          │
                    Eventual Convergence
                          │
             ┌────────────┴────────────┐
             │                         │
          Mobile                      Web
        5 notes                     5 notes
```

---

# 98. Core Invariant

The most important invariant in the entire architecture is:

> Every accepted user mutation must either exist as durable synchronized state or remain as a recoverable local pending change.

There must never be a state where:

```text
User thinks change was saved
```

but:

```text
Local database lost it
AND
Server never received it
```

---

# 99. Final Product Model

The application is not fundamentally a:

```text
note-taking app + QR scanner
```

It is:

```text
offline-first replicated data system
```

with:

```text
note editor
+
device authorization
+
QR pairing
+
change log
+
revision history
+
conflict resolution
+
audit trail
```

The note editor is the visible part.

The synchronization system is the core product.
