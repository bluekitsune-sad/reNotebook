# PLAN.md

# Synced Notepad — Development Plan

**Project:** Synced Notepad
**Document:** Development Plan
**Version:** 0.1
**Status:** Initial Planning
**Date:** 2026-08-10

---

# 1. Project Goal

Build a cross-platform notepad system consisting of:

* Web application
* Mobile application
* Offline-first local storage
* Automatic synchronization
* QR-based device pairing
* Workspace ownership
* Device management
* Device-specific note visibility
* Complete change attribution
* Note revision history
* Concurrent editing detection
* Conflict resolution
* Reliable synchronization after reconnecting

The core promise is:

> A user's notes should be available across all authorized devices while preserving offline changes and never silently destroying conflicting work.

---

# 2. Selected Technology Stack

## Web

```text
Next.js
React
JavaScript
```

## Mobile

```text
React Native
Expo
JavaScript
```

## Backend

```text
Node.js
JavaScript
REST API
WebSocket/realtime layer
```

## Database

```text
MongoDB
```

## Local Storage

Mobile:

```text
SQLite
```

Web:

```text
IndexedDB
```

## Validation

```text
Zod
```

## Monorepo

```text
pnpm
Turborepo
```

## Testing

```text
Vitest
Playwright
Maestro / Detox
```

## Desktop

Future:

```text
Tauri 2
```

---

# 3. Development Philosophy

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

---

# 4. High-Level Development Phases

```text
Phase 0   Project foundation
    ↓
Phase 1   Data/domain model
    ↓
Phase 2   Local-first notes
    ↓
Phase 3   Backend
    ↓
Phase 4   Basic synchronization
    ↓
Phase 5   QR pairing
    ↓
Phase 6   Device ownership
    ↓
Phase 7   Conflict detection
    ↓
Phase 8   Conflict resolution
    ↓
Phase 9   Device visibility
    ↓
Phase 10  Audit/history
    ↓
Phase 11  Security hardening
    ↓
Phase 12  Automated testing
    ↓
Phase 13  Beta
    ↓
Phase 14  Production
```

---

# 5. Phase 0 — Project Foundation

## Objectives

Create the repository and development environment.

## Tasks

* [ ] Create Git repository
* [ ] Initialize pnpm
* [ ] Initialize Turborepo
* [ ] Configure JavaScript
* [ ] Configure ESLint
* [ ] Configure Prettier
* [ ] Configure environment variables
* [ ] Create development documentation
* [ ] Create `.gitignore`
* [ ] Create CI pipeline
* [ ] Create development branch strategy

---

# 6. Initial Repository

Recommended structure:

```text
notepad/
│
├── apps/
│   ├── web/
│   └── mobile/
│
├── packages/
│   ├── domain/
│   ├── sync/
│   ├── api-client/
│   ├── validation/
│   ├── crypto/
│   └── ui/
│
├── server/
│   ├── api/
│   ├── sync/
│   ├── auth/
│   └── database/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

# 7. Phase 1 — Domain Model

Before building UI, define the core entities.

Entities:

```text
User
Workspace
Device
Session
Note
NoteRevision
Change
Conflict
VisibilityRule
AuditEvent
PairingSession
SyncCursor
```

---

# 8. User

Initial conceptual structure:

```js
{
  id,
  email,
  displayName,
  createdAt
}
```

Authentication-specific fields should not be unnecessarily duplicated.

---

# 9. Workspace

```js
{
  id,
  name,
  ownerId,
  createdAt,
  updatedAt
}
```

A workspace is the logical synchronization boundary.

---

# 10. Device

```js
{
  id,
  workspaceId,
  userId,
  name,
  platform,
  status,
  publicKey,
  createdAt,
  lastSeenAt
}
```

Possible statuses:

```text
PENDING
ACTIVE
REVOKED
```

---

# 11. Note

```js
{
  id,
  workspaceId,
  title,
  content,
  revision,
  createdBy,
  updatedBy,
  createdAt,
  updatedAt,
  deletedAt
}
```

Do not embed all note history directly into the note document.

---

# 12. Note Revision

```js
{
  id,
  noteId,
  workspaceId,
  revision,
  content,
  createdBy,
  deviceId,
  parentRevision,
  createdAt
}
```

---

# 13. Change

```js
{
  id,
  workspaceId,
  deviceId,
  actorId,
  entityType,
  entityId,
  operation,
  baseRevision,
  payload,
  createdAt
}
```

Every change must have a unique ID.

---

# 14. Conflict

```js
{
  id,
  workspaceId,
  entityId,
  entityType,
  baseRevision,
  versions,
  status,
  resolvedBy,
  resolution,
  createdAt,
  resolvedAt
}
```

---

# 15. Visibility Rule

```js
{
  id,
  workspaceId,
  entityId,
  deviceId,
  visible,
  createdBy,
  createdAt
}
```

The authorization model may evolve after the first implementation.

---

# 16. Audit Event

```js
{
  id,
  workspaceId,
  actorId,
  deviceId,
  action,
  entityType,
  entityId,
  metadata,
  createdAt
}
```

---

# 17. Pairing Session

```js
{
  id,
  workspaceId,
  ownerDeviceId,
  nonce,
  status,
  expiresAt,
  usedAt,
  createdAt
}
```

---

# 18. Sync Cursor

Each device needs a synchronization position.

Conceptually:

```js
{
  deviceId,
  workspaceId,
  lastServerSequence
}
```

---

# 19. Phase 2 — Local-First Note System

Before synchronization, build a fully functional local notepad.

The application must work without a server.

---

# 20. Mobile Local Storage

Implement:

```text
React Native
    ↓
Repository
    ↓
SQLite
```

The UI must never directly manipulate raw SQLite queries.

---

# 21. Web Local Storage

Implement:

```text
Next.js
    ↓
Repository
    ↓
IndexedDB
```

Again, keep the database behind a repository interface.

---

# 22. Shared Repository Interface

Both clients should expose equivalent operations:

```js
createNote()
getNote()
updateNote()
deleteNote()
restoreNote()
listNotes()
getRevisionHistory()
```

This allows the sync engine to work against a consistent abstraction.

---

# 23. Local Mutation Pipeline

Every modification must follow:

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

This pipeline must work whether the device is online or offline.

---

# 24. Local MVP Features

Implement:

* [ ] Create note
* [ ] Edit note
* [ ] Delete note
* [ ] Restore note
* [ ] Search notes
* [ ] Note list
* [ ] Note editor
* [ ] Revision metadata
* [ ] Local persistence
* [ ] Application restart recovery

---

# 25. Phase 3 — Backend Foundation

Create Node.js backend.

Responsibilities:

```text
Authentication
Workspace management
Device management
Notes
Changes
Sync
Conflicts
Permissions
Audit
Pairing
```

---

# 26. MongoDB Setup

Create:

```text
Development database
Testing database
Production database
```

Do not allow development code to accidentally connect to production.

---

# 27. MongoDB Collections

Initial collections:

```text
users
workspaces
devices
sessions
notes
note_revisions
changes
conflicts
visibility_rules
audit_events
pairing_sessions
```

---

# 28. MongoDB Indexing

Indexes should be designed around synchronization queries.

Examples:

```text
changes:
    workspaceId + serverSequence

notes:
    workspaceId + updatedAt

notes:
    workspaceId + id

devices:
    workspaceId + status

pairing_sessions:
    id + expiresAt

conflicts:
    workspaceId + status
```

Exact indexes should be validated against actual query patterns.

---

# 29. MongoDB Transactions

Use transactions for operations that require atomic changes.

Example:

```text
Update note
+
Create revision
+
Create change
+
Create audit event
```

should be treated as one logical operation where appropriate.

---

# 30. Server Sequence

The backend needs a reliable ordering mechanism for changes.

Conceptually:

```text
Change 1001
Change 1002
Change 1003
Change 1004
```

Clients can synchronize using:

```text
give me changes after 1001
```

The implementation must ensure sequence assignment is safe under concurrency.

---

# 31. Phase 4 — Basic Synchronization

This is the most important phase.

Do not proceed to advanced UI until this phase is reliable.

---

# 32. Sync Protocol

Initial conceptual protocol:

```text
Client
  ↓
Authenticate
  ↓
Send sync cursor
  ↓
Server returns authorized changes
  ↓
Client applies changes
  ↓
Client uploads pending changes
  ↓
Server validates changes
  ↓
Server accepts or creates conflict
  ↓
Client updates cursor
```

---

# 33. Pull Synchronization

Client requests:

```text
changes after cursor X
```

Server returns:

```text
changes X+1 → Y
```

The client applies them transactionally.

---

# 34. Push Synchronization

Client uploads:

```text
pending changes
```

The server:

```text
validates
deduplicates
authorizes
checks revision
accepts
or creates conflict
```

---

# 35. Idempotency

Every uploaded change must have a unique ID.

If the same change arrives twice:

```text
First request:
accepted

Second request:
already processed
```

No duplicate note or revision should be created.

---

# 36. Sync Cursor Safety

The client must only advance its cursor after changes are successfully applied.

Correct:

```text
Download
 ↓
Validate
 ↓
Apply
 ↓
Commit
 ↓
Advance cursor
```

Incorrect:

```text
Download
 ↓
Advance cursor
 ↓
Crash
 ↓
Changes lost
```

---

# 37. Basic Sync Tests

Before moving forward:

* [ ] Device A creates note
* [ ] Device B receives note
* [ ] Device B creates note
* [ ] Device A receives note
* [ ] Both create notes offline
* [ ] Both reconnect
* [ ] Both eventually converge
* [ ] Duplicate uploads do not duplicate notes
* [ ] Client crash does not lose queued changes

---

# 38. Phase 5 — QR Pairing

Once basic synchronization works, implement device pairing.

---

# 39. QR Flow

```text
Owner device
    ↓
Create pairing session
    ↓
Generate temporary QR
    ↓
New device scans
    ↓
Pairing session validated
    ↓
User confirms
    ↓
Optional verification code
    ↓
Device registered
    ↓
Initial synchronization
```

---

# 40. QR Requirements

QR pairing must be:

* [ ] Short-lived
* [ ] Single-use
* [ ] Random
* [ ] Bound to pairing session
* [ ] Revocable
* [ ] Authenticated
* [ ] Invalid after successful use

Recommended initial expiration:

```text
1–5 minutes
```

---

# 41. QR Tests

* [ ] Valid QR works
* [ ] Expired QR fails
* [ ] Reused QR fails
* [ ] Cancelled QR fails
* [ ] Invalid QR fails
* [ ] Wrong workspace cannot be accessed
* [ ] Pairing cannot bypass authentication
* [ ] Owner can reject pairing

---

# 42. Phase 6 — Device Ownership

Implement workspace ownership and device management.

Features:

* [ ] List devices
* [ ] Rename device
* [ ] View device status
* [ ] Revoke device
* [ ] Restore/re-authorize device if supported
* [ ] Transfer ownership
* [ ] Recovery mechanism

---

# 43. Device Revocation

When revoked:

```text
Device
    ↓
Authentication rejected
    ↓
Sync rejected
```

Offline changes from the revoked device must not automatically regain workspace authority.

---

# 44. Lost Owner Device

Implement a recovery strategy before production.

Potential mechanisms:

```text
Authenticated account
+
trusted existing device
+
recovery credential
```

The exact mechanism should be finalized during the security phase.

---

# 45. Phase 7 — Conflict Detection

Implement revision-aware synchronization.

Example:

```text
Server:
revision 10

Phone:
baseRevision 10
content A

Laptop:
baseRevision 10
content B
```

First change:

```text
10 → 11
```

Second change:

```text
base 10
server 11
```

Result:

```text
CONFLICT
```

---

# 46. Conflict Storage

Never overwrite the losing version.

Store:

```text
Original
Version A
Version B
Conflict metadata
```

---

# 47. Conflict Tests

Test:

* [ ] Same note edited on two devices
* [ ] Three devices edit same note
* [ ] Delete vs edit
* [ ] Delete vs delete
* [ ] Rename vs rename
* [ ] Same resulting content
* [ ] Offline edits for long periods
* [ ] Conflict after device reconnect
* [ ] Conflict after retry

---

# 48. Phase 8 — Conflict Resolution

Create conflict UI.

Example:

```text
Conflict detected

Original:
Buy milk

Phone:
Buy milk and eggs

Laptop:
Buy milk and bread

[ Keep Phone ]
[ Keep Laptop ]
[ Merge ]
[ Keep Both ]
```

---

# 49. Resolution Rules

Resolution should create a new revision.

Never rewrite historical revisions.

Example:

```text
Revision 10
   ├── Revision 11
   └── Revision 12
          ↓
      Conflict
          ↓
      Revision 13
```

---

# 50. Three-Way Merge

Implement basic text merge.

Inputs:

```text
Base
Version A
Version B
```

Automatically merge independent changes.

Require user intervention for overlapping changes.

---

# 51. Phase 9 — Device-Specific Visibility

Implement:

```text
Visible
Hidden
```

per device.

Example:

```text
Note A

Phone:
VISIBLE

Laptop:
HIDDEN

Tablet:
VISIBLE
```

---

# 52. Security Requirement

Hidden note content must not be sent to an unauthorized device merely to hide it in the UI.

The server must enforce access.

---

# 53. Visibility Tests

* [ ] Hide note
* [ ] Unhide note
* [ ] Create hidden note offline
* [ ] Hide existing note
* [ ] Hidden note cannot be requested through API
* [ ] Hidden note history cannot be accessed
* [ ] Revoked device cannot access hidden note
* [ ] Visibility changes synchronize correctly

---

# 54. Phase 10 — Audit and History

Implement:

```text
Who
What
When
Which device
Which revision
```

Example:

```text
John's Phone
created "Shopping"
10:32 AM

John's Laptop
edited "Shopping"
10:40 AM
```

---

# 55. Audit Tests

* [ ] Creation recorded
* [ ] Edit recorded
* [ ] Delete recorded
* [ ] Restore recorded
* [ ] Device pairing recorded
* [ ] Device revocation recorded
* [ ] Conflict creation recorded
* [ ] Conflict resolution recorded
* [ ] Visibility change recorded

---

# 56. Phase 11 — Security

Perform a dedicated security pass.

---

# 57. Authentication

Implement:

* [ ] Account authentication
* [ ] Session management
* [ ] Device identity
* [ ] Device credentials
* [ ] Token expiration
* [ ] Token revocation

---

# 58. Authorization

Every request should validate:

```text
Who is making request?
        ↓
Which device?
        ↓
Which workspace?
        ↓
Is device active?
        ↓
Is user authorized?
        ↓
Is note visible?
        ↓
Is operation allowed?
```

---

# 59. QR Security

Test:

```text
QR replay
QR expiration
QR interception
QR reuse
QR brute force
Pairing cancellation
Unauthorized pairing
```

---

# 60. API Security

Attempt:

```text
Access another workspace
Access hidden note
Access revoked device
Modify another user's note
Resolve unauthorized conflict
Revoke another device
Transfer ownership
```

All must fail.

---

# 61. Phase 12 — Automated Testing

The sync engine should receive the highest test coverage.

---

# 62. Unit Testing

Test:

```text
revision comparison
conflict detection
merge
change IDs
permissions
visibility
QR expiration
cursor management
```

---

# 63. Integration Testing

Test:

```text
Client
  ↕
API
  ↕
MongoDB
```

Test actual database behavior.

---

# 64. End-to-End Testing

Web:

```text
Playwright
```

Mobile:

```text
Maestro
or
Detox
```

---

# 65. Sync Simulation

Create a simulated environment:

```text
Server

Device A
Device B
Device C
```

Allow tests to randomly:

```text
disconnect
reconnect
delay
duplicate
reorder
drop requests
crash clients
```

Then verify convergence.

---

# 66. Property-Based / Fuzz Testing

Generate random sequences:

```text
create
edit
delete
restore
rename
hide
unhide
```

Across multiple devices.

The test should verify:

```text
No unauthorized access
No silent data loss
No duplicate operations
Eventual convergence
```

---

# 67. Core Invariants

These must always hold.

## Invariant 1 — No Silent Data Loss

If a local change was successfully persisted, synchronization must either:

```text
accept it
```

or:

```text
preserve it as a conflict
```

It must never simply disappear.

---

## Invariant 2 — Idempotency

Applying the same change twice must have the same logical result as applying it once.

---

## Invariant 3 — Authorization

Unauthorized devices cannot obtain unauthorized workspace data.

---

## Invariant 4 — Conflict Preservation

Concurrent conflicting versions must both remain recoverable.

---

## Invariant 5 — Convergence

After synchronization and conflict resolution:

```text
Authorized Device A
=
Authorized Device B
=
Authorized Device C
```

except for intentional device-specific visibility.

---

# 68. Phase 13 — Performance

Once correctness is established, optimize.

Measure:

```text
Startup time
Note load time
Sync latency
Sync throughput
Database size
Memory usage
Network usage
Large workspace performance
```

---

# 69. Large Workspace Testing

Test with:

```text
1,000 notes
10,000 notes
100,000 notes
```

Test:

```text
initial sync
incremental sync
search
history
conflicts
offline queues
```

---

# 70. Large Offline Queue Testing

Test:

```text
1,000 pending changes
10,000 pending changes
```

Ensure:

```text
App remains usable
Queue survives restart
Sync resumes safely
```

---

# 71. Phase 14 — UX Development

After the core synchronization engine is reliable, polish the interface.

Core screens:

```text
Home
Notes
Note Editor
Search
History
Conflicts
Devices
Settings
Sync Status
```

---

# 72. Sync Status UI

Possible states:

```text
✓ Synced

↻ Syncing...

○ Offline

! Conflict

⚠ Sync failed

🔒 Device revoked
```

---

# 73. QR UX

Owner:

```text
Settings
→ Devices
→ Add Device
→ Show QR
```

New device:

```text
Scan QR
→ Verify workspace
→ Confirm
→ Pair
→ Initial sync
```

---

# 74. Phase 15 — Beta

Before public release:

* [ ] Invite small group of testers
* [ ] Collect sync failures
* [ ] Collect conflict cases
* [ ] Monitor server errors
* [ ] Monitor sync latency
* [ ] Test device recovery
* [ ] Test QR pairing
* [ ] Test offline behavior
* [ ] Test browser storage limitations

---

# 75. Beta Telemetry

Do not collect note contents unless explicitly required and appropriately disclosed.

Prefer anonymous operational metrics:

```text
sync success/failure
sync duration
conflict count
API errors
app version
platform
device type
```

Privacy should be treated as a product feature.

---

# 76. Phase 16 — Production Readiness

Before production:

* [ ] Database backups
* [ ] Backup restoration tested
* [ ] Monitoring
* [ ] Error tracking
* [ ] Rate limiting
* [ ] Authentication hardening
* [ ] QR abuse protection
* [ ] API abuse protection
* [ ] Database indexes verified
* [ ] Disaster recovery plan
* [ ] Security review
* [ ] Privacy policy
* [ ] Terms if required
* [ ] Data deletion process

---

# 77. Backup Testing

A backup is not enough.

Test:

```text
Backup
 ↓
Destroy test database
 ↓
Restore backup
 ↓
Verify workspace
 ↓
Verify revisions
 ↓
Verify changes
 ↓
Verify conflicts
```

---

# 78. Disaster Recovery

Document:

```text
What happens if MongoDB fails?
What happens if API fails?
What happens if realtime fails?
What happens if web deployment fails?
What happens if a device loses local data?
What happens if owner device is lost?
```

---

# 79. Production Architecture

Target architecture:

```text
                         Internet
                            │
               ┌────────────┴────────────┐
               │                         │
          Next.js Web              Mobile App
               │                         │
               └────────────┬────────────┘
                            │
                       API Gateway
                            │
                    ┌───────▼────────┐
                    │ Node.js Server │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
             Auth          Sync        Realtime
              │             │             │
              └─────────────┼─────────────┘
                            │
                       MongoDB
                            │
                    ┌───────┴────────┐
                    │                │
                 Changes           Notes
```

---

# 80. Future Desktop Application

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

---

# 81. Future Features

Potential future features:

```text
Folders
Tags
Rich text
Markdown
Attachments
Images
Voice notes
Shared workspaces
Multiple users
Roles
Real-time collaboration
CRDT
End-to-end encryption
Public/private notebooks
Advanced search
Import/export
Version comparison
```

These should not block the initial MVP.

---

# 82. Recommended MVP Scope

The first release should contain only:

```text
✓ Account
✓ Workspace
✓ Notes
✓ Mobile app
✓ Web app
✓ Local offline storage
✓ Automatic synchronization
✓ QR pairing
✓ Device management
✓ Device ownership
✓ Device revocation
✓ Basic visibility controls
✓ Change attribution
✓ Revision history
✓ Conflict detection
✓ Basic conflict resolution
```

Avoid:

```text
✗ Real-time character collaboration
✗ Attachments
✗ Complex rich-text editor
✗ Multi-user teams
✗ CRDT
✗ Advanced encryption
```

until the core synchronization system is stable.

---

# 83. Milestone Structure

## Milestone 1 — Foundation

```text
Repository
CI
Apps
Backend
MongoDB
```

Success:

> Everything runs locally.

---

## Milestone 2 — Local Notes

```text
Web notes
Mobile notes
SQLite
IndexedDB
```

Success:

> Notes survive offline and application restart.

---

## Milestone 3 — First Sync

```text
Device A
Device B
Server
```

Success:

> A creates a note and B receives it.

---

## Milestone 4 — Offline Sync

Success:

> A and B can independently create notes offline and eventually converge.

---

## Milestone 5 — QR

Success:

> B can securely join A's workspace using a temporary QR pairing flow.

---

## Milestone 6 — Device Management

Success:

> Owner can see, rename and revoke devices.

---

## Milestone 7 — Conflicts

Success:

> Concurrent edits never silently overwrite each other.

---

## Milestone 8 — Conflict Resolution

Success:

> User can choose/merge conflicting versions and the resolution becomes a new revision.

---

## Milestone 9 — Visibility

Success:

> Notes can be hidden from specific devices without leaking their content through the API.

---

## Milestone 10 — Audit

Success:

> The application can show who created and modified notes and when.

---

## Milestone 11 — Security

Success:

> Unauthorized devices cannot access workspace data.

---

## Milestone 12 — Beta

Success:

> Real users can use the application without data loss.

---

# 84. Development Order

The actual implementation order should be:

```text
1. Repository
       ↓
2. Domain models
       ↓
3. Local database abstraction
       ↓
4. Local note CRUD
       ↓
5. Change/event system
       ↓
6. Backend
       ↓
7. Sync cursor
       ↓
8. Push/pull synchronization
       ↓
9. Offline queue
       ↓
10. Idempotency
       ↓
11. QR pairing
       ↓
12. Device management
       ↓
13. Revision conflicts
       ↓
14. Conflict UI
       ↓
15. Visibility
       ↓
16. Audit history
       ↓
17. Security hardening
       ↓
18. Automated stress testing
       ↓
19. UX polish
       ↓
20. Beta
```

---

# 85. First Coding Sprint

The first sprint should **not** start with QR codes.

Build:

```text
apps/web
apps/mobile
packages/domain
packages/sync
packages/validation
server
```

Then implement:

```text
Create note
Edit note
Delete note
Local persistence
Local change record
```

No server synchronization yet.

The goal is to establish the local-first architecture.

---

# 86. Second Coding Sprint

Implement:

```text
MongoDB
Node.js API
Workspace
Device
Note
Change
Revision
```

Then connect one client.

Goal:

```text
Mobile
    ↓
API
    ↓
MongoDB
```

---

# 87. Third Coding Sprint

Implement:

```text
Sync cursor
Push changes
Pull changes
Retry
Idempotency
```

Goal:

```text
Device A ↔ Server ↔ Device B
```

---

# 88. Fourth Coding Sprint

Implement offline synchronization.

Test:

```text
A offline
B offline

A creates 2 notes
B creates 3 notes

Reconnect

A = 5 notes
B = 5 notes
```

This is the first major product milestone.

---

# 89. Fifth Coding Sprint

Implement QR pairing.

Goal:

```text
Device A
   ↓
QR
   ↓
Device B
   ↓
Workspace joined
   ↓
Initial sync
```

---

# 90. Sixth Coding Sprint

Implement:

```text
Device management
Revocation
Ownership
Recovery
```

---

# 91. Seventh Coding Sprint

Implement conflict detection.

Goal:

```text
A edits Note X
B edits Note X
both offline
both reconnect

→ conflict
→ both versions preserved
```

---

# 92. Eighth Coding Sprint

Implement conflict resolution.

Goal:

```text
Phone version
Laptop version
       ↓
User chooses
       ↓
New revision
       ↓
All devices converge
```

---

# 93. Ninth Coding Sprint

Implement:

```text
Device-specific visibility
Audit history
Revision history
```

---

# 94. Tenth Coding Sprint

Security and reliability testing.

Focus on:

```text
authorization
QR
revocation
offline queues
duplicate requests
crashes
network failures
conflicts
```

---

# 95. Success Criteria

The project is successful when a user can perform this complete scenario:

```text
1. Install mobile app.
        ↓
2. Create workspace.
        ↓
3. Create two notes offline.
        ↓
4. Open web app.
        ↓
5. Pair web using QR.
        ↓
6. Create three notes on web.
        ↓
7. Reconnect mobile.
        ↓
8. Mobile receives all three.
        ↓
9. Both devices contain five notes.
        ↓
10. Disconnect both devices.
        ↓
11. Edit the same note on both.
        ↓
12. Reconnect.
        ↓
13. Conflict appears.
        ↓
14. Both versions are shown.
        ↓
15. User resolves conflict.
        ↓
16. Resolution becomes new revision.
        ↓
17. Both devices converge.
        ↓
18. Hide a note from web.
        ↓
19. Web cannot retrieve that note.
        ↓
20. Audit history shows who changed what.
```

If this scenario works reliably, the core product is working.

---

# 96. Most Important Engineering Rule

Do not measure progress by:

```text
"How many screens have we built?"
```

Measure progress by:

```text
"How many synchronization failure scenarios can we survive without losing data?"
```

The synchronization engine is the foundation of this product.

The UI can be redesigned later.

Lost data cannot.

---

# 97. Immediate Next Documents

The recommended documentation sequence is:

```text
PLAN.md
   ↓
TECH_STACK.md
   ↓
ARCHITECTURE.md
   ↓
DATABASE.md
   ↓
SYNC_PROTOCOL.md
   ↓
API.md
   ↓
QR_PAIRING.md
   ↓
SECURITY.md
   ↓
TESTING.md
   ↓
IMPLEMENTATION.md
```

The next document that should be written after this plan is **`TECH_STACK.md`**, followed by **`SYNC_PROTOCOL.md`**.

`SYNC_PROTOCOL.md` is particularly important because it will define the exact behavior of the system when multiple devices are offline, reconnect at different times, retry requests, edit the same note, delete notes, or encounter conflicts.


gitrepo:https://github.com/bluekitsune-sad/Slate.git