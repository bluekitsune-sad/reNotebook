# TEST_PLAN.md

# Synced Notepad — Test Plan

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Testing Layers

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

Each layer builds on the confidence provided by the layer below it. The synchronization engine receives the highest test coverage priority.

---

## 2. Unit Tests

Unit tests validate pure logic without database or network dependencies.

### What to test:

```text
revision calculations
conflict detection
merge algorithm
permission evaluation
QR expiration logic
change deduplication
sync cursor handling
retry calculation
```

### Revision Calculations

Test that revisions increment correctly and that base revision comparison works.

Cases:

```text
baseRevision = serverRevision → accept
baseRevision < serverRevision → conflict
baseRevision > serverRevision → reject
```

### Conflict Detection

Test that the system correctly identifies conflicts when:

```text
incoming.baseRevision < currentRevision
```

and the change cannot be safely merged.

### Merge Logic

Test automatic field-level merging:

```text
unchanged + unchanged → base
changed + unchanged → changed value
unchanged + changed → changed value
same + same → shared value
different + different → conflict
```

### Permission Evaluation

Test that authorization checks correctly enforce:

```text
workspace membership
device active status
device authorization
note visibility rules
```

### QR Expiration

Test that QR codes are rejected after:

```text
expiration time
successful use
cancellation
```

### Change Deduplication

Test that sending the same `changeId` twice:

```text
first request → accepted
second request → already_processed
no duplicate revision created
```

### Sync Cursor

Test that the cursor only advances after changes are successfully applied locally.

---

## 3. Repository Tests

Test data access operations against the local database (IndexedDB / SQLite).

### What to test:

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

### Key invariant:

Every note operation must also create a corresponding change record within the same transaction.

---

## 4. Sync Engine Tests

These are mandatory tests for the core synchronization logic.

### Required scenarios:

```text
offline → online transition
online → offline transition
push success
pull success
duplicate push (idempotency)
duplicate pull (idempotency)
partial push failure (some accepted, some conflict)
partial pull failure
```

### Sync Loop Order

Test the pull → push → pull sequence:

```text
1. Pull remote changes
2. Apply remote changes
3. Push local changes
4. Pull again (to receive changes committed during push)
```

### Sync State Machine

Test transitions between:

```text
idle → checking → pulling → applying → pushing → processing → completed
```

and error paths:

```text
any state → error → retry_wait → checking
```

---

## 5. Crash Tests

Simulate crashes at critical points.

### Crash points:

```text
before local transaction
during local transaction
after local transaction

before push
during push
after push (response not received)

during pull
after pull before cursor commit
```

### Expected behavior:

```text
before local transaction → nothing lost (nothing saved yet)
during local transaction → transaction rolled back
after local transaction → pending change survives restart

before push → pending change remains
during push → pending change remains, retry is idempotent
after push (no response) → server already accepted, retry is idempotent

during pull → cursor unchanged, retry from same cursor
after pull before cursor commit → cursor unchanged, re-apply is idempotent
```

---

## 6. Network Tests

Simulate various network conditions.

### Conditions to test:

```text
instant disconnect
slow connection (high latency)
packet timeout
request duplication
server unavailable
DNS failure
intermittent connection
network switch (Wi-Fi → mobile → offline → Wi-Fi)
```

### Expected behavior:

```text
all conditions → local editing continues
all conditions → pending changes remain queued
all conditions → sync resumes when network is available
```

---

## 7. Multi-device Tests

### Minimum setup:

```text
Device A
Device B
Device C
```

### Preferred setup:

```text
5–20 simulated devices
```

### Core scenario:

```text
A offline: creates 2 notes
B offline: creates 3 notes
Reconnect both

Expected:
A = 5 notes
B = 5 notes
Server = 5 notes
```

### Extended scenarios:

```text
A and B both create notes offline → both converge
A edits, B creates → no conflict, both converge
A and B edit same note offline → conflict detected
```

---

## 8. Concurrent Editing Tests

### Same note, different changes:

```text
Base: "Hello"

A: "Hello A"
B: "Hello B"

Expected:
conflict exists
both versions preserved
```

### Delete vs edit:

```text
A: deletes note
B: edits note

Expected:
not silently lost
conflict presented to user
```

### Rename vs content:

```text
A: title changed
B: content changed

Expected:
automatic merge (non-overlapping fields)
```

### Three devices edit same note:

```text
All three offline
All three edit same note
All three reconnect

Expected:
conflict with three versions preserved
```

### Same content result:

```text
Both devices make identical changes

Expected:
no unnecessary conflict if resulting content is identical
```

---

## 9. QR Tests

### Scenarios to test:

```text
valid QR → pairing succeeds
expired QR → pairing rejected
used QR → pairing rejected
cancelled QR → pairing rejected
wrong workspace → pairing rejected
wrong user → pairing rejected
duplicate scan → first scan wins, second rejected
two simultaneous scans → only one authorization
network loss during pairing → appropriate error state
owner rejection → new device notified
QR photographed and reused later → rejected
QR intercepted by third device → owner approval prevents unauthorized pairing
```

---

## 10. Security Tests

### All of the following must fail:

```text
spoof user ID
spoof device ID
spoof workspace ID
reuse revoked session
reuse expired QR
reuse consumed QR
access hidden note via direct API call
access another workspace
access hidden note history
enumerate hidden notes via counts/pagination
```

### API Security Principle:

```text
Never rely on frontend hiding something for authorization.

Bad:  GET /notes → returns everything → frontend hides private notes
Good: GET /notes → server filters based on device permissions
```

---

## 11. Property-Based Testing

The synchronization engine is a strong candidate for property-based testing.

### Generate random sequences of:

```text
create
edit
delete
restore
rename
hide
unhide
offline
online
sync
crash
```

### Then verify invariants:

```text
No unauthorized access
No silent data loss
No duplicate operations
Eventual convergence
```

This is one of the most valuable test strategies for this product.

---

## 12. Convergence Test

### Setup:

```text
Device A
Device B
Device C
```

### Process:

```text
1. Run random operations on all devices
2. Include offline periods
3. Include reconnections
4. Include conflicts
5. Eventually: sync all
6. Compare canonical state
```

### Expected:

```text
All authorized replicas converge
```

except where:

```text
device-specific visibility rules
```

intentionally produce different views.

### Automated invariant:

```text
After all pending changes are synchronized
and all conflicts are resolved:

State(Device A) = State(Device B) = State(Device C)
```

---

## 13. Fuzz Testing

Send malformed data to the server.

### Fuzz payloads:

```text
malformed JSON
missing required fields
invalid revisions (negative, null, string)
huge content (oversized notes)
duplicate IDs in batch
negative sequences
invalid operations
extra unknown fields
```

### Expected:

```text
Server must reject safely.
No server crash.
No data corruption.
Appropriate error response.
```

---

## 14. Performance Testing

### Scale points:

```text
10 notes
1,000 notes
10,000 notes
100,000 revisions
```

### What to measure:

```text
initial sync time
incremental sync time
conflict creation time
pull performance
push performance
MongoDB query performance
large offline queue processing
```

### Large offline queue:

```text
1,000 pending changes
10,000 pending changes
```

Ensure:

```text
App remains usable
Queue survives restart
Sync processes changes incrementally
```

---

## 15. Storage Testing

### Scenarios:

```text
low disk space
IndexedDB quota exceeded
SQLite failure
large notes
many revisions per note
```

### Expected:

```text
Graceful degradation
User notified of storage issues
No silent data corruption
Pending changes preserved where possible
```

---

## 16. Acceptance Criteria

The application is not ready for production until:

```text
[ ] offline creation works
[ ] offline editing works
[ ] QR pairing works
[ ] revocation works
[ ] hidden notes work
[ ] duplicate changes are safe (idempotency)
[ ] concurrent edits are preserved
[ ] deletion synchronization works
[ ] crash recovery works
[ ] multi-device convergence works
[ ] conflict detection works
[ ] conflict resolution creates new revisions
[ ] audit history works
[ ] network failure tests pass
[ ] security tests pass
[ ] server restart recovery works
[ ] out-of-order changes handled correctly
[ ] multiple browser tabs don't corrupt state
[ ] long offline period catch-up works
```

---

## 17. Core Invariants to Verify

These must always hold in automated tests:

### Invariant 1 — No Silent Data Loss

If a local change was successfully persisted, synchronization must either accept it or preserve it as a conflict. It must never simply disappear.

### Invariant 2 — Idempotency

Applying the same change twice must have the same logical result as applying it once.

### Invariant 3 — Authorization

Unauthorized devices cannot obtain unauthorized workspace data.

### Invariant 4 — Conflict Preservation

Concurrent conflicting versions must both remain recoverable.

### Invariant 5 — Convergence

After synchronization and conflict resolution, all authorized devices converge to the same state except for intentional device-specific visibility.

### Invariant 6 — Cursor Safety

A cursor only advances after successful local application of changes.

### Invariant 7 — Remote Changes Don't Generate Outgoing Changes

Applying a remote mutation must not create a new outgoing change (sync loop prevention).

---

## 18. Testing Tools

```text
Unit testing:    Vitest
E2E (web):       Playwright
E2E (mobile):    Maestro / Detox
Property-based:  fast-check (or equivalent)
Fuzz testing:    Custom scripts / fast-check
```

---

## 19. Test-First Priority Order

The sync engine should receive the highest test coverage. Implementation order:

```text
1. Unit tests for sync logic
2. Repository tests for local database
3. Sync engine integration tests
4. Multi-device simulation
5. Crash and network failure tests
6. Security tests
7. Property-based / fuzz tests
8. Performance tests
9. E2E tests
```

Do not proceed to advanced UI until the synchronization engine passes all core tests.
