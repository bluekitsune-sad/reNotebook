# DEVICE_SECURITY.md

# Synced Notepad — Device Security

---

# 1. Security Model

The application has three major security layers:

```text
Authentication
     ↓
Device Authorization
     ↓
Workspace Permissions
```

A valid user account does not automatically mean every device has unlimited access.

---

# 2. Device Identity

Each installation receives a device identity.

```text
deviceId
```

This identity must remain stable for that installation unless the user explicitly resets/re-registers it.

---

# 3. Device Name

The user-facing name is separate:

```text
deviceId:
device_8f72...

name:
"My Phone"
```

The name can change without changing device identity.

---

# 4. Device States

```text
pending
active
revoked
```

Future:

```text
suspended
expired
```

---

# 5. Revocation

When the owner revokes a device:

```text
device.status = revoked
```

Then:

```text
sessions invalidated
sync rejected
WebSocket disconnected
future pairing credentials rejected
```

---

# 6. Offline Revocation

A revoked device may still contain local data.

Revocation cannot physically erase data from a device that is offline.

Therefore:

> Server revocation means the device can no longer participate in synchronization.

Once the device reconnects, access should be removed.

---

# 7. Remote Data Removal

When a revoked device reconnects:

```text
server:
DEVICE_REVOKED
```

The application should:

1. Stop synchronization.
2. Prevent further edits from being uploaded.
3. Mark the local workspace as revoked.
4. Follow the configured local-data policy.

---

# 8. Pending Changes During Revocation

Pending changes should not simply disappear.

The user should have an appropriate recovery mechanism.

Possible future options:

```text
Export unsynced changes
Retry after reauthorization
Copy changes to another workspace
Discard explicitly
```

---

# 9. Local Storage Security

Mobile:

```text
SQLite
+
OS secure storage for secrets
```

Web:

```text
IndexedDB
+
browser-managed secure authentication
```

Do not store long-lived secrets in:

```text
plain localStorage
```

unless there is a very deliberate security model.

---

# 10. Session Tokens

Access credentials should have appropriate expiration.

Refresh credentials, if used, should be stored in the platform's safest available mechanism.

---

# 11. Device Logout

Logout should:

```text
invalidate local session
```

but should not automatically delete local notes unless the product explicitly defines logout that way.

---

# 12. Account Deletion

Account deletion is separate from logout.

It must define:

```text
workspace ownership
notes
devices
audit history
pending changes
```

before implementation.

---

# 13. Authorization Checks

Every server synchronization operation must check:

```text
user owns/is member of workspace
AND
device belongs to user
AND
device is active
AND
session is active
```

---

# 14. Note Visibility

If a note is hidden from a device, that device should not receive:

```text
note content
revision content
conflict content
```

unless explicitly allowed by the security model.

---

# 15. Metadata Leakage

Be careful not to leak:

```text
note title
note existence
updatedAt
author
revision count
conflict status
```

through APIs if the note itself is hidden.

The visibility policy should explicitly define whether metadata is visible.

Recommended initial behavior:

```text
hidden note = invisible
```

---

# 16. Audit Security

Audit logs should be append-only from the application perspective.

Users should not be able to rewrite historical audit events.

---

# 17. QR Security

Never use:

```text
permanent password
permanent refresh token
```

inside QR payloads.

Use:

```text
short-lived
single-use
random pairing secret
```

---

# 18. Brute Force Protection

Pairing endpoints should be rate-limited.

Authentication endpoints should also use:

```text
rate limiting
attempt tracking
temporary lockouts where appropriate
```

---

# 19. Transport Security

Production synchronization must use encrypted transport:

```text
HTTPS
WSS
```

Never send authentication or note data over plain HTTP in production.

---

# 20. Logging

Server logs must not contain:

```text
passwords
access tokens
refresh tokens
QR secrets
note content
```

unless explicitly required for debugging under controlled conditions.

---

# 21. Security Principle

Assume:

> Any client can be modified or malicious.

Therefore, all security decisions happen on the server.

---

# CONFLICT_RESOLUTION.md

# Synced Notepad — Conflict Resolution

---

# 1. Objective

Conflicts must be:

```text
detected
preserved
explained
resolvable
auditable
```

Never silently discard one user's/device's work.

---

# 2. Conflict Definition

A conflict exists when:

```text
incoming.baseRevision
<
currentRevision
```

and the incoming change cannot safely be merged.

---

# 3. Three-Way Merge

Compare:

```text
BASE
 /  \
A    B
```

The system determines:

```text
What changed from BASE → A?
What changed from BASE → B?
```

---

# 4. Example

Base:

```text
Hello world
```

A:

```text
Hello phone
```

B:

```text
Hello laptop
```

Both changed the same logical region.

Result:

```text
Conflict
```

---

# 5. Non-Conflict

Base:

```text
title = Shopping
content = Milk
```

A:

```text
title = Groceries
content = Milk
```

B:

```text
title = Shopping
content = Milk and Eggs
```

These changes can be merged:

```text
title = Groceries
content = Milk and Eggs
```

---

# 6. Automatic Merge Rules

Initial fields:

```text
title
content
```

For each field:

```text
unchanged + unchanged
→ base

changed + unchanged
→ changed value

unchanged + changed
→ changed value

same + same
→ shared value

different + different
→ conflict
```

---

# 7. Conflict UI

The user should see:

```text
Conflict detected

Shopping

Your version
----------------
Groceries

Other version
----------------
Shopping List

[Keep Yours]
[Keep Theirs]
[Merge]
```

---

# 8. Attribution

Every conflict version must show:

```text
device name
user name
timestamp
```

Example:

```text
"My Phone"
edited 2 minutes ago
```

This matches the requirement that changes can be understood by who/device made them.

---

# 9. Removeable Conflict Versions

When the user resolves a conflict:

```text
Conflict:
resolved
```

The historical revisions remain.

The conflict UI disappears from active conflicts.

---

# 10. Keep Version

```text
Keep Version A
```

creates:

```text
new revision
```

Do not simply change the current note pointer without recording the resolution.

---

# 11. Merge

The merged result becomes:

```text
new revision
```

with:

```text
parent revisions:
A
B
```

This is useful for future audit/history features.

---

# 12. Conflict Resolution Attribution

Store:

```text
resolvedBy
resolvedAt
resolutionType
```

Example:

```js
{
  resolutionType: "merge",
  resolvedBy: "user_123",
  resolvedAt: "..."
}
```

---

# 13. Conflict Race

Two devices may attempt to resolve the same conflict.

Only one resolution should become canonical.

Use server-side conflict state checks.

Example:

```text
open → resolved
```

The second attempt receives:

```text
CONFLICT_ALREADY_RESOLVED
```

and then synchronizes the resulting revision.

---

# 14. Conflict Does Not Block Workspace Sync

If:

```text
Note A = conflict
Note B = normal
Note C = normal
```

the system should still synchronize:

```text
B
C
```

while leaving A unresolved.

---

# 15. Future CRDT Option

For highly collaborative rich-text editing, eventually consider:

```text
CRDT
```

instead of revision-level conflict resolution.

Do not introduce CRDTs into the first implementation unless real-time collaborative editing becomes a core requirement.

The current application is fundamentally:

```text
offline-first synchronization
```

rather than:

```text
Google Docs-style simultaneous editing
```

---

# TESTING.md

# Synced Notepad — Testing Strategy

---

# 1. Testing Layers

```text
Unit Tests
    ↓
Repository Tests
    ↓
Sync Engine Tests
    ↓
API Tests
    ↓
Integration Tests
    ↓
Multi-device Simulation
    ↓
End-to-End Tests
```

---

# 2. Unit Tests

Test:

```text
change creation
revision creation
merge algorithm
conflict detection
cursor handling
retry calculation
permission evaluation
```

---

# 3. Repository Tests

Test:

```text
create note
update note
delete note
restore note
queue change
mark processed
store conflict
update cursor
```

---

# 4. Sync Engine Tests

Mandatory:

```text
offline → online
online → offline
push success
pull success
duplicate push
duplicate pull
partial push failure
partial pull failure
```

---

# 5. Crash Tests

Simulate crash:

```text
before local transaction
during local transaction
after local transaction

before push
during push
after push

during pull
after pull before cursor commit
```

---

# 6. Network Tests

Simulate:

```text
instant disconnect
slow connection
high latency
packet timeout
request duplication
server unavailable
DNS failure
intermittent connection
```

---

# 7. Multi-device Tests

Minimum:

```text
Device A
Device B
Device C
```

Preferred:

```text
5–20 simulated devices
```

---

# 8. Core Scenario

```text
A offline:
2 notes

B offline:
3 notes

Reconnect both
```

Expected:

```text
A = 5 notes
B = 5 notes
Server = 5 notes
```

---

# 9. Concurrent Editing

```text
Base:
Hello

A:
Hello A

B:
Hello B
```

Expected:

```text
conflict exists
both versions preserved
```

---

# 10. Delete/Edit

```text
A:
delete

B:
edit
```

Expected:

```text
not silently lost
```

---

# 11. Rename/Content

```text
A:
title changed

B:
content changed
```

Expected:

```text
automatic merge
```

---

# 12. QR Tests

Test:

```text
valid QR
expired QR
used QR
cancelled QR
wrong workspace
wrong user
duplicate scan
two simultaneous scans
network loss
owner rejection
```

---

# 13. Security Tests

Attempt:

```text
spoof user ID
spoof device ID
spoof workspace ID
reuse revoked session
reuse expired QR
reuse consumed QR
access hidden note
access another workspace
```

All must fail.

---

# 14. Property-Based Testing

The synchronization engine is a strong candidate for property-based testing.

Generate random sequences:

```text
create
edit
delete
restore
offline
online
sync
crash
```

Then verify invariants.

---

# 15. Convergence Test

Run:

```text
Device A
Device B
Device C
```

with random operations.

Eventually:

```text
sync all
```

Then compare canonical state.

Expected:

```text
all authorized replicas converge
```

except where unresolved user conflicts intentionally remain.

---

# 16. Fuzz Testing

Fuzz:

```text
malformed payloads
missing fields
invalid revisions
huge content
duplicate IDs
negative sequences
invalid operations
```

Server must reject safely.

---

# 17. Performance Testing

Measure:

```text
10 notes
1,000 notes
10,000 notes
100,000 revisions
```

Measure:

```text
initial sync
incremental sync
conflict creation
pull performance
push performance
MongoDB query performance
```

---

# 18. Storage Testing

Test:

```text
low disk
IndexedDB quota
SQLite failure
large notes
many revisions
```

---

# 19. Acceptance Criteria

The application is not ready for production until:

```text
offline creation works
offline editing works
QR pairing works
revocation works
hidden notes work
duplicate changes are safe
concurrent edits are preserved
deletion synchronization works
crash recovery works
multi-device convergence works
```

---

# IMPLEMENTATION.md

# Synced Notepad — Implementation Plan

---

# 1. Technology Stack

## Web

```text
Next.js
JavaScript
React
IndexedDB
```

Recommended local database abstraction:

```text
Dexie.js
```

---

# 2. Mobile

```text
React Native
JavaScript
SQLite
```

Recommended database abstraction:

```text
WatermelonDB
```

or a simpler SQLite layer for the first implementation.

---

# 3. Backend

Recommended:

```text
Node.js
Express.js
JavaScript
MongoDB
Mongoose
```

The backend should remain independent from the Next.js frontend.

---

# 4. Realtime

Initial:

```text
WebSocket
```

or:

```text
Socket.IO
```

Realtime is optional for correctness.

---

# 5. API

```text
REST
+
WebSocket notification channel
```

---

# 6. Monorepo

Recommended structure:

```text
synced-notepad/
│
├── apps/
│   ├── web/
│   ├── mobile/
│   └── server/
│
├── packages/
│   ├── sync-core/
│   ├── sync-protocol/
│   ├── validation/
│   └── shared/
│
├── docs/
│
└── package.json
```

---

# 7. Shared Sync Package

The most important shared package should contain platform-independent logic.

```text
packages/sync-core/
```

It can contain:

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

---

# 8. Validation

Use runtime validation.

Recommended:

```text
Zod
```

or:

```text
Joi
```

Every API payload should be validated.

---

# 9. Backend Structure

```text
server/
│
├── src/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── middleware/
│   ├── routes/
│   ├── sync/
│   ├── auth/
│   └── utils/
│
└── tests/
```

---

# 10. Sync Service

The server should have a dedicated:

```text
SyncService
```

Responsibilities:

```text
pullChanges()
pushChanges()
processChange()
detectConflict()
applyChange()
generateSequence()
```

---

# 11. Client Sync Engine

Both web and mobile should expose the same conceptual interface:

```js
syncEngine.sync()
```

Internally:

```text
load cursor
↓
pull
↓
apply
↓
push
↓
process results
↓
save cursor
```

---

# 12. Repository Pattern

The UI should not know whether it is using:

```text
SQLite
```

or:

```text
IndexedDB
```

Example:

```js
notesRepository.create()
notesRepository.update()
notesRepository.delete()
notesRepository.getById()
```

---

# 13. Local Transaction API

The repository should expose something similar to:

```js
database.transaction(async () => {
  await notesRepository.update(note);
  await changesRepository.insert(change);
});
```

---

# 14. Application Layers

Recommended:

```text
UI
 ↓
Hooks / Controllers
 ↓
Domain Services
 ↓
Repositories
 ↓
Local Database
```

Sync runs alongside the domain layer rather than being directly embedded into UI components.

---

# 15. Development Order

## Phase 1 — Local Notepad

Build:

```text
create note
edit note
delete note
restore note
search notes
```

No server initially.

---

# 16. Phase 2 — Local Change Queue

Add:

```text
revisions
pending changes
local transactions
sync status
```

Test offline behavior thoroughly.

---

# 17. Phase 3 — Server

Implement:

```text
users
workspaces
devices
notes
revisions
changes
```

---

# 18. Phase 4 — Basic Sync

Implement:

```text
pull
push
cursor
idempotency
server sequence
```

Before QR pairing.

---

# 19. Phase 5 — Multi-device

Test:

```text
Web A
Mobile B
```

with offline operation.

---

# 20. Phase 6 — QR Pairing

Implement:

```text
pairing session
QR generation
QR scanning
owner approval
device registration
initial sync
```

---

# 21. Phase 7 — Device Management

Implement:

```text
device list
device rename
last seen
revoke device
```

---

# 22. Phase 8 — Conflict System

Implement:

```text
base revisions
three-way comparison
automatic field merge
conflict objects
conflict UI
resolution
```

---

# 23. Phase 9 — Device-specific Visibility

Implement:

```text
hide note from device
unhide note
server authorization
local removal
```

---

# 24. Phase 10 — Audit

Implement:

```text
who created
who edited
which device
when
what revision
conflict resolution
device pairing
device revocation
```

---

# 25. Phase 11 — Realtime

Only after normal sync works:

```text
WebSocket
workspace.changed
automatic pull
```

---

# 26. Phase 12 — Hardening

Perform:

```text
security testing
load testing
failure testing
randomized synchronization testing
crash testing
QR attack testing
```

---

# 27. Recommended First MVP

Do NOT build everything at once.

The first working MVP should contain:

```text
Next.js web
React Native mobile
Node.js server
MongoDB

User
Workspace
Device
Note

Offline notes
Local change queue

Push
Pull
Cursor
Idempotency

QR pairing
Basic device list
Device revocation
```

Then add:

```text
conflicts
audit
device-specific visibility
realtime
```

---

# 28. First End-to-End Milestone

The first major milestone should be:

```text
1. Open mobile
2. Create workspace
3. Create two notes
4. Open web
5. Pair using QR
6. Web receives both notes
7. Disconnect web
8. Create three notes
9. Reconnect web
10. Mobile receives all three
11. Both contain five notes
```

If this works reliably, the fundamental architecture is working.

---

# 29. Second Milestone

Test:

```text
Mobile offline
Web offline

Both edit same note

Both reconnect
```

Expected:

```text
Conflict detected
Both versions preserved
User resolves conflict
All devices converge
```

---

# 30. Third Milestone

Test:

```text
Device A hidden from Note X

Device B edits Note X

Device A synchronizes
```

Expected:

```text
Device A never receives Note X content
```

---

# 31. Fourth Milestone

Test:

```text
Device A revoked offline

Device A creates notes

Device A reconnects
```

Expected:

```text
Server rejects synchronization
Local changes remain recoverable
```

---

# 32. Fifth Milestone

Test:

```text
QR generated
QR photographed
QR reused
QR expires
Owner rejects
```

Expected:

```text
No unauthorized device becomes a workspace replica.
```

---

# 33. Definition of Done

The synchronization engine is considered MVP-complete when:

```text
[ ] Offline-first architecture works
[ ] Local changes survive restart
[ ] Server synchronization works
[ ] Multiple devices converge
[ ] Duplicate requests are safe
[ ] Pull is resumable
[ ] Push is resumable
[ ] Conflicts are preserved
[ ] Conflict resolution creates revisions
[ ] Delete synchronization works
[ ] QR pairing works
[ ] QR expiration works
[ ] QR replay is rejected
[ ] Device revocation works
[ ] Hidden notes are protected
[ ] Audit history works
[ ] Crash tests pass
[ ] Network failure tests pass
[ ] Security tests pass
```

---

# 34. Most Important Engineering Rule

Do not begin by building the QR scanner.

The correct dependency order is:

```text
LOCAL DATA
    ↓
LOCAL CHANGE QUEUE
    ↓
SYNC ENGINE
    ↓
SERVER CHANGE PROCESSING
    ↓
MULTI-DEVICE SYNC
    ↓
CONFLICT HANDLING
    ↓
DEVICE AUTHORIZATION
    ↓
QR PAIRING
    ↓
REALTIME
```

QR pairing is only an authorization mechanism.

The actual product is the synchronization engine.

---

# 35. Final Architecture

```text
                         ┌──────────────────┐
                         │     MongoDB      │
                         │                  │
                         │ Users            │
                         │ Workspaces       │
                         │ Devices          │
                         │ Notes            │
                         │ Revisions        │
                         │ Changes          │
                         │ Conflicts        │
                         │ Audit Logs       │
                         └────────┬─────────┘
                                  │
                           Node.js API
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                 Next.js                   React Native
                   Web                         Mobile
                    │                           │
                IndexedDB                    SQLite
                    │                           │
                Sync Engine                 Sync Engine
                    │                           │
                    └───────────┬───────────────┘
                                │
                           Sync Protocol
                                │
                    ┌───────────┴───────────┐
                    │                       │
                 Offline                 Online
                    │                       │
              Local Changes             Server Sync
                    │                       │
                    └───────────┬───────────┘
                                │
                         Eventual Convergence
```

---

# 36. Final Product Principle

The system should behave as if the user has **one notepad that happens to have multiple interfaces**.

The user should not need to think about:

```text
Which device owns this note?
Which database has the latest copy?
Did the network work?
Which device edited this?
```

The system handles those problems.

The user's mental model should simply be:

```text
"My notes are here."
```

while the engineering model underneath is:

```text
local replicas
+
durable changes
+
server authority
+
revision history
+
conflict preservation
+
device authorization
+
eventual convergence
```
