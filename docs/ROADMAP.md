# Synced Notepad — Roadmap

**Version:** 0.1
**Status:** Draft

---

## 1. Milestone Structure

### Milestone 1 — Foundation

```text
Repository
CI
Apps
Backend
MongoDB
```

**Success criteria:** Everything runs locally.

---

### Milestone 2 — Local Notes

```text
Web notes
Mobile notes
SQLite
IndexedDB
```

**Success criteria:** Notes survive offline and application restart.

---

### Milestone 3 — First Sync

```text
Device A
Device B
Server
```

**Success criteria:** A creates a note and B receives it.

---

### Milestone 4 — Offline Sync

**Success criteria:** A and B can independently create notes offline and eventually converge.

---

### Milestone 5 — QR

**Success criteria:** B can securely join A's workspace using a temporary QR pairing flow.

---

### Milestone 6 — Device Management

**Success criteria:** Owner can see, rename and revoke devices.

---

### Milestone 7 — Conflicts

**Success criteria:** Concurrent edits never silently overwrite each other.

---

### Milestone 8 — Conflict Resolution

**Success criteria:** User can choose/merge conflicting versions and the resolution becomes a new revision.

---

### Milestone 9 — Visibility

**Success criteria:** Notes can be hidden from specific devices without leaking their content through the API.

---

### Milestone 10 — Audit

**Success criteria:** The application can show who created and modified notes and when.

---

### Milestone 11 — Security

**Success criteria:** Unauthorized devices cannot access workspace data.

---

### Milestone 12 — Beta

**Success criteria:** Real users can use the application without data loss.

---

## 2. Development Order

The actual implementation order:

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

## 3. Coding Sprints

### Sprint 1 — Local-First Foundation

Build the monorepo structure and core packages:

```text
apps/web
apps/mobile
packages/domain
packages/sync
packages/validation
server
```

Implement local note operations:

```text
Create note
Edit note
Delete note
Local persistence
Local change record
```

No server synchronization yet. The goal is to establish the local-first architecture.

### Sprint 2 — Server and First Connection

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

Then connect one client. Goal:

```text
Mobile
    ↓
API
    ↓
MongoDB
```

### Sprint 3 — Sync Engine

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

### Sprint 4 — Offline Synchronization

Test scenario:

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

### Sprint 5 — QR Pairing

Implement QR pairing flow:

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

### Sprint 6 — Device Management

Implement:

```text
Device management
Revocation
Ownership
Recovery
```

### Sprint 7 — Conflict Detection

Goal:

```text
A edits Note X
B edits Note X
both offline
both reconnect

→ conflict
→ both versions preserved
```

### Sprint 8 — Conflict Resolution

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

### Sprint 9 — Visibility and Audit

Implement:

```text
Device-specific visibility
Audit history
Revision history
```

### Sprint 10 — Security and Reliability

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

## 4. End-to-End Success Scenario

The project is successful when a user can perform this complete scenario:

```text
1.  Install mobile app.
          ↓
2.  Create workspace.
          ↓
3.  Create two notes offline.
          ↓
4.  Open web app.
          ↓
5.  Pair web using QR.
          ↓
6.  Create three notes on web.
          ↓
7.  Reconnect mobile.
          ↓
8.  Mobile receives all three.
          ↓
9.  Both devices contain five notes.
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

## 5. Most Important Engineering Rule

Do not measure progress by:

```text
"How many screens have we built?"
```

Measure progress by:

```text
"How many synchronization failure scenarios can we survive without losing data?"
```

The synchronization engine is the foundation of this product. The UI can be redesigned later. Lost data cannot.

---

## 6. Immediate Next Documents

The recommended documentation sequence:

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

The next document that should be written after this plan is **TECH_STACK.md**, followed by **SYNC_PROTOCOL.md**. `SYNC_PROTOCOL.md` is particularly important because it will define the exact behavior of the system when multiple devices are offline, reconnect at different times, retry requests, edit the same note, delete notes, or encounter conflicts.

---

## 7. Recommended MVP Scope

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

Avoid until the core synchronization system is stable:

```text
✗ Real-time character collaboration
✗ Attachments
✗ Complex rich-text editor
✗ Multi-user teams
✗ CRDT
✗ Advanced encryption
```

---

## 8. Phase 2 — Post-MVP Enhancements

```text
Rich conflict merge UI
Note history
Restore old revisions
Device-specific visibility
Advanced audit logs
Export/import
Better recovery
Push notifications
Background sync
```

---

## 9. Phase 3 — Future Features

```text
Real-time collaboration
CRDT-based editing
End-to-end encryption
Attachments
Shared workspaces
Multiple users
Roles/permissions
Advanced search
Cross-workspace features
```

These should not block the initial MVP. They represent long-term product evolution after the synchronization foundation is stable and proven.
