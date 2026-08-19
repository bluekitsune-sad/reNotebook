# Synced Notepad — Development Plan

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. High-Level Development Phases

```text
Phase 0    Project foundation
    ↓
Phase 1    Data/domain model
    ↓
Phase 2    Local-first notes
    ↓
Phase 3    Backend
    ↓
Phase 4    Basic synchronization
    ↓
Phase 5    QR pairing
    ↓
Phase 6    Device ownership
    ↓
Phase 7    Conflict detection
    ↓
Phase 8    Conflict resolution
    ↓
Phase 9    Device visibility
    ↓
Phase 10   Audit/history
    ↓
Phase 11   Security hardening
    ↓
Phase 12   Automated testing
    ↓
Phase 13   Beta
    ↓
Phase 14   Production
```

---

## 2. Phase 0 — Project Foundation

**Objectives:** Create the repository and development environment.

**Tasks:**

- [ ] Create Git repository
- [ ] Initialize pnpm
- [ ] Initialize Turborepo
- [ ] Configure JavaScript
- [ ] Configure ESLint
- [ ] Configure Prettier
- [ ] Configure environment variables
- [ ] Create development documentation
- [ ] Create `.gitignore`
- [ ] Create CI pipeline
- [ ] Create development branch strategy

---

## 3. Phase 1 — Domain Model

Before building UI, define the core entities:

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

Each entity is defined with clear fields, relationships, and constraints. The domain model lives in `packages/domain` and is shared across all platforms.

---

## 4. Phase 2 — Local-First Note System

Before synchronization, build a fully functional local notepad. The application must work without a server.

**Mobile:** React Native → Repository → SQLite
**Web:** Next.js → Repository → IndexedDB

**Local mutation pipeline (works online or offline):**

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

**Local MVP features:**

- [ ] Create note
- [ ] Edit note
- [ ] Delete note
- [ ] Restore note
- [ ] Search notes
- [ ] Note list
- [ ] Note editor
- [ ] Revision metadata
- [ ] Local persistence
- [ ] Application restart recovery

---

## 5. Phase 3 — Backend Foundation

Create Node.js backend. Responsibilities:

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

**Database:** MongoDB with separate development, testing, and production databases.

**Initial collections:**

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

## 6. Phase 4 — Basic Synchronization

This is the most important phase. Do not proceed to advanced UI until this phase is reliable.

**Sync protocol:**

```text
Client authenticates
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

**Basic sync tests:**

- [ ] Device A creates note, Device B receives it
- [ ] Device B creates note, Device A receives it
- [ ] Both create notes offline, both reconnect, both converge
- [ ] Duplicate uploads do not duplicate notes
- [ ] Client crash does not lose queued changes

---

## 7. Phase 5 — QR Pairing

Once basic synchronization works, implement device pairing.

**Flow:** Owner device creates pairing session → generates temporary QR → new device scans → pairing session validated → user confirms → optional verification code → device registered → initial synchronization.

**QR requirements:**

- [ ] Short-lived (1-5 minutes)
- [ ] Single-use
- [ ] Random
- [ ] Bound to pairing session
- [ ] Revocable
- [ ] Authenticated
- [ ] Invalid after successful use

**QR tests:**

- [ ] Valid QR works
- [ ] Expired QR fails
- [ ] Reused QR fails
- [ ] Cancelled QR fails
- [ ] Wrong workspace cannot be accessed
- [ ] Owner can reject pairing

---

## 8. Phase 6 — Device Ownership

Implement workspace ownership and device management.

**Features:**

- [ ] List devices
- [ ] Rename device
- [ ] View device status
- [ ] Revoke device
- [ ] Restore/re-authorize device
- [ ] Transfer ownership
- [ ] Recovery mechanism

When a device is revoked: authentication rejected → sync rejected. Offline changes from the revoked device must not automatically regain workspace authority.

---

## 9. Phase 7 — Conflict Detection

Implement revision-aware synchronization. The server compares the revision from which each device edited. If the base revision is older than the server's current revision, a conflict is detected.

**Conflict storage:** Never overwrite the losing version. Store original, Version A, Version B, and conflict metadata.

**Conflict tests:**

- [ ] Same note edited on two devices
- [ ] Three devices edit same note
- [ ] Delete vs edit
- [ ] Delete vs delete
- [ ] Rename vs rename
- [ ] Offline edits for long periods
- [ ] Conflict after device reconnect

---

## 10. Phase 8 — Conflict Resolution

Create conflict UI presenting both changes with device names. Supported actions:

```text
Keep Phone Version
Keep Laptop Version
Merge
Keep Both as Copies
```

Resolution creates a new revision. Never rewrite historical revisions. Implement basic three-way merge for text notes — automatically merge independent changes, require user intervention for overlapping changes.

---

## 11. Phase 9 — Device-Specific Visibility

Implement per-device visible/hidden controls. Hidden note content must not be sent to an unauthorized device — the server must enforce access.

**Visibility tests:**

- [ ] Hide note
- [ ] Unhide note
- [ ] Hidden note cannot be requested through API
- [ ] Hidden note history cannot be accessed
- [ ] Visibility changes synchronize correctly

---

## 12. Phase 10 — Audit and History

Implement: Who, What, When, Which device, Which revision.

**Audit tests:**

- [ ] Creation recorded
- [ ] Edit recorded
- [ ] Delete recorded
- [ ] Device pairing recorded
- [ ] Device revocation recorded
- [ ] Conflict creation recorded
- [ ] Conflict resolution recorded

---

## 13. Phase 11 — Security Hardening

Perform a dedicated security pass covering:

- Account authentication and session management
- Device identity and credentials
- Token expiration and revocation
- Authorization on every request
- QR security (replay, expiration, interception, brute force)
- API security (access another workspace, hidden note, revoked device)

---

## 14. Phase 12 — Automated Testing

The sync engine receives the highest test coverage.

- **Unit tests:** revision comparison, conflict detection, merge, change IDs, permissions, visibility, QR expiration, cursor management
- **Integration tests:** Client ↔ API ↔ MongoDB
- **End-to-end tests:** Playwright (web), Maestro/Detox (mobile)
- **Sync simulation:** Test with random disconnects, reconnections, delays, duplications, reordering, dropped requests, and client crashes, then verify convergence
- **Property-based/fuzz testing:** Generate random operation sequences across multiple devices and verify: no unauthorized access, no silent data loss, no duplicate operations, eventual convergence

---

## 15. Phase 13 — Beta

- [ ] Invite small group of testers
- [ ] Collect sync failures and conflict cases
- [ ] Monitor server errors and sync latency
- [ ] Test device recovery and QR pairing
- [ ] Test offline behavior and browser storage limitations
- [ ] Collect anonymous operational metrics (never note contents)

---

## 16. Phase 14 — Production

- [ ] Database backups and tested restoration
- [ ] Monitoring and error tracking
- [ ] Rate limiting
- [ ] Authentication hardening
- [ ] QR abuse protection
- [ ] Database indexes verified
- [ ] Disaster recovery plan
- [ ] Security review
- [ ] Privacy policy
- [ ] Data deletion process

---

## 17. Core Invariants

These must always hold:

1. **No Silent Data Loss** — A locally persisted change must either be accepted or preserved as a conflict. It must never simply disappear.
2. **Idempotency** — Applying the same change twice must have the same logical result as applying it once.
3. **Authorization** — Unauthorized devices cannot obtain unauthorized workspace data.
4. **Conflict Preservation** — Concurrent conflicting versions must both remain recoverable.
5. **Convergence** — After synchronization and conflict resolution, all authorized devices converge to the same state (except for intentional device-specific visibility).
