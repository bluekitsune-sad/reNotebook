# ERROR_HANDLING.md

# Synced Notepad — Error Handling & Recovery

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Error Recovery Philosophy

> Never silently delete user data.

This is the single most important principle. Every error handling decision must preserve the user's work.

### Core rule:

```text
sync failed
→ retain change
→ retry
→ inform user if necessary
```

### What must never happen:

```text
sync failed
→ delete local change
```

### Data safety model:

A successful local save means:

```text
Data exists locally.
```

A successful sync means:

```text
Data has been accepted by the workspace/server.
```

These must not be conflated.

---

## 2. Sync Retry with Exponential Backoff

Use exponential backoff with jitter for all retryable errors.

### Backoff sequence:

```text
1 second
2 seconds
4 seconds
8 seconds
16 seconds
30 seconds
60 seconds
```

### Rules:

```text
Do not retry infinitely at maximum speed.
Add jitter to prevent thundering herd.
Respect server-provided Retry-After headers.
Cap maximum backoff at 60 seconds.
```

### Manual sync:

The user should always have a way to manually trigger:

```text
Sync now
```

This is useful for troubleshooting and for users who prefer explicit control.

---

## 3. Sync Failure UX

If the network fails after a successful local save:

```text
Saved on this device.
Waiting for connection...
```

### What the user should never see:

```text
Save failed
ERROR 500
Sync error
```

if the note was successfully saved locally.

### If conflict occurs after save:

```text
Saved, but another device changed this note.

[Review conflict]
```

### Important UX principle:

The user should feel:

> "My note was saved."

not:

> "The server accepted my note."

The synchronization status can be displayed separately.

---

## 4. Error Categories

### NETWORK_ERROR

```text
Cause:    Network unavailable, timeout, DNS failure, connection refused
Severity: Transient
Client:   Retry with exponential backoff
UX:       "Saved on this device. Waiting for connection..."
Change:   Stays in pending state
```

### AUTH_ERROR (HTTP 401)

```text
Cause:    Session expired, invalid token, authentication failure
Severity: Action required
Client:   Attempt token refresh, then re-authenticate
UX:       Prompt to sign in again
Change:   Stays in pending state (not deleted)
```

### DEVICE_REVOKED (HTTP 403 — specific)

```text
Cause:    Owner revoked this device's access
Severity: Permanent
Client:   Stop synchronization immediately
UX:       "This device has been removed from the workspace."
Change:   Local changes preserved but cannot sync
Action:   User must re-pair with a new QR code
```

### PERMISSION_DENIED (HTTP 403)

```text
Cause:    Device not authorized for workspace, hidden note access attempt
Severity: Permanent for this operation
Client:   Stop the specific operation, do not retry
UX:       "You don't have permission to perform this action."
Change:   Operation blocked, local state preserved
```

### INVALID_CHANGE

```text
Cause:    Malformed payload, invalid revision, schema validation failure
Severity: Permanent for this specific change
Client:   Move change to failed state, surface actionable error
UX:       "This change could not be synced. Please review."
Change:   Moves to failed state
```

### CONFLICT

```text
Cause:    Concurrent edits on same note, stale base revision
Severity: Expected (not an error per se)
Client:   Store conflict record, present conflict UI
UX:       "Saved, but another device changed this note."
Change:   Original local change preserved, conflict record created
```

### SERVER_ERROR (HTTP 500)

```text
Cause:    Server-side failure
Severity: Transient (usually)
Client:   Retry with exponential backoff
UX:       "Saved on this device. Server temporarily unavailable..."
Change:   Stays in pending state
```

### RATE_LIMITED (HTTP 429)

```text
Cause:    Too many requests
Severity: Transient
Client:   Respect Retry-After header, back off accordingly
UX:       No user-facing message needed (silent retry)
Change:   Stays in pending state
```

### STORAGE_ERROR

```text
Cause:    Local database failure, quota exceeded, disk full
Severity: Action required
Client:   Attempt graceful degradation
UX:       "Local storage is full. Please free up space."
Change:   May not be able to save locally
```

---

## 5. Client Handling for Each Error Type

### On NETWORK_ERROR:

```text
1. Keep change in pending state
2. Show offline indicator
3. Start exponential backoff timer
4. On network recovery → retry sync
5. No data deleted
```

### On AUTH_ERROR:

```text
1. Attempt token refresh
2. If refresh succeeds → retry with new token
3. If refresh fails → prompt re-authentication
4. Keep all pending changes during re-auth flow
5. After re-auth → resume sync
```

### On DEVICE_REVOKED:

```text
1. Stop all synchronization
2. Invalidate local session
3. Mark workspace as revoked locally
4. Display clear message to user
5. Preserve all local data
6. Require new QR pairing to rejoin
```

### On PERMISSION_DENIED:

```text
1. Stop the specific operation
2. Do not retry automatically
3. Display permission error to user
4. Preserve all local data
5. Log for audit purposes
```

### On INVALID_CHANGE:

```text
1. Move the specific change to failed state
2. Do not affect other pending changes
3. Surface actionable error to user
4. Allow user to edit/fix and retry
5. Other independent changes continue syncing
```

### On CONFLICT:

```text
1. Store conflict record locally
2. Preserve both versions
3. Present conflict UI to user
4. Wait for user resolution
5. Resolution creates new revision
```

### On SERVER_ERROR:

```text
1. Keep change in pending state
2. Retry with exponential backoff
3. Do not assume permanent failure
4. Log error for server-side investigation
5. No data deleted
```

### On RATE_LIMITED:

```text
1. Parse Retry-After header
2. Wait the specified duration
3. Retry after wait
4. No user-facing message needed
5. Gradually increase wait time
```

### On STORAGE_ERROR:

```text
1. Attempt to notify user immediately
2. Suggest freeing up storage
3. Continue attempting to preserve data
4. If write fails, keep in-memory if possible
5. Never silently drop changes
```

---

## 6. Permanent Failure Handling

Some errors are permanent and should not be retried indefinitely.

### Permanent failure indicators:

```text
DEVICE_REVOKED
INVALID_CHANGE (after user acknowledgment)
PERMISSION_DENIED
SYNC_CURSOR_EXPIRED (requires full resync)
```

### Handling:

```text
1. Move affected changes to failed state
2. Surface clear message to user
3. Do not silently discard the change
4. Provide actionable next steps where possible
```

### Failed state behavior:

```text
Change remains in failed state indefinitely
User can:
  - Edit the change and retry
  - Discard explicitly (with confirmation)
  - Export for manual recovery
```

---

## 7. Network Recovery Flow

### When connectivity appears:

```text
network online
    ↓
do NOT assume server is reachable
    ↓
schedule sync attempt
    ↓
server request
    ↓
if successful → full sync cycle (pull → push → pull)
if failed → retry with backoff
```

### Network detection rules:

```text
Network available ≠ Server reachable

There are two states:
  - "Network appears available"
  - "Server successfully reachable"

The sync engine should react to actual request results,
not network status indicators.
```

### Reconnection sequence:

```text
1. Detect network change
2. Cancel pending backoff timers
3. Attempt immediate sync
4. If successful → resume normal sync loop
5. If failed → start backoff sequence
```

---

## 8. Sync Status Model

Each local change has a status:

```text
pending     → waiting to be uploaded
uploading   → currently being sent to server
accepted    → server accepted the change
conflict    → server detected a conflict
failed      → permanent failure, requires user action
```

### Status transitions:

```text
pending → uploading → accepted
pending → uploading → conflict
pending → uploading → pending (transient error, retry)
pending → uploading → failed (permanent error)
```

### Status indicators in UI:

```text
✓ Synced       → all changes accepted, cursor at latest
↻ Syncing      → currently in sync cycle
○ Offline      → no network, changes saved locally
! Conflict     → one or more notes have unresolved conflicts
⚠ Sync failed  → one or more changes permanently failed
🔒 Revoked     → device revoked from workspace
```

### Sync status formula:

```text
SYNCED =
  online AND
  pendingChanges == 0 AND
  cursor == serverLatestSequence AND
  no blockingErrors
```

---

## 9. Network Recovery Scenarios

### Scenario: Server restart during sync

```text
Client sends push
Server restarts before processing
Client receives connection error
Client retries → idempotent
No data loss, no duplication
```

### Scenario: Client timeout after server acceptance

```text
Client sends change
Server accepts, assigns sequence
Network drops before response
Client times out (outcome unknown)
Client retries same changeId
Server responds: already_processed
No duplicate revision created
```

### Scenario: Partial push failure

```text
Client sends: A, B, C, D
Server results: A→accepted, B→accepted, C→conflict, D→accepted

Client processing:
  A → remove from pending
  B → remove from pending
  C → mark conflict
  D → remove from pending

Only C remains unresolved.
```

### Scenario: Pull response lost

```text
Server sends changes 101–110
Client crashes before updating cursor
After restart: cursor still at 100
Client requests 101–110 again
Client must safely recognize already-applied changes
Idempotent change application is critical
```

---

## 10. Idempotent Change Application

The local database must maintain enough information to determine:

```text
Has this change already been applied?
```

### Possible mechanism:

```text
processedChanges table
or check revision/sequence state before applying
```

### Rule:

```text
apply(change) + apply(change) = apply(change)
```

---

## 11. Sync Loop Prevention

When a client applies a remote change:

```text
remote update → local database
```

it must NOT create a new outgoing change.

### Distinguish:

```text
applyLocalMutation()  → creates outgoing change
applyRemoteMutation() → does NOT create outgoing change
```

Without this distinction, the system would create an infinite loop:

```text
Server → Device A → new local change → Server → Device B → ...
```

---

## 12. Sync Lock

Only one sync process should operate on a workspace/device at a time.

```text
sync #1 running
sync #2 requested

Result: #2 returns / queues
```

This prevents:

```text
cursor corruption
duplicate processing
race conditions
```

---

## 13. Cursor Safety

The client must only advance its cursor after successfully applying changes.

### Correct:

```text
download changes
    ↓
validate
    ↓
apply transactionally
    ↓
commit
    ↓
advance cursor
```

### Incorrect (causes data loss):

```text
download changes
    ↓
advance cursor
    ↓
crash before applying
    ↓
changes lost forever
```

---

## 14. App Crash Recovery

### Crash after local save, before server upload:

```text
Pending change remains in local database
After restart:
  load pending changes → sync
No user data lost
```

### Crash during push (server accepted but response lost):

```text
Pending change still marked as pending
Client retries → server responds already_processed
Client marks change complete
No duplication
```

### Crash during pull (before cursor commit):

```text
Cursor unchanged at pre-pull value
Client retries pull from same cursor
Changes re-applied idempotently
No duplication
```

---

## 15. Error Recovery Priority

When multiple errors occur simultaneously:

```text
1. DEVICE_REVOKED → highest priority, stop everything
2. AUTH_ERROR → attempt re-auth before continuing
3. INVALID_CHANGE → move to failed, continue with others
4. CONFLICT → present to user, continue with other notes
5. NETWORK_ERROR → retry with backoff
6. SERVER_ERROR → retry with backoff
7. RATE_LIMITED → respect Retry-After
8. STORAGE_ERROR → notify user, attempt recovery
```

---

## 16. Error Logging

### Server logs must NOT contain:

```text
passwords
access tokens
refresh tokens
QR secrets
note content
```

### Server logs SHOULD contain:

```text
sync requests (anonymized)
sync failures with error type
conflict count
pairing attempts
device revocations
API errors with status codes
```

### Client logs:

```text
sync status changes
retry attempts
error categories (not content)
```

---

## 17. Disaster Recovery Considerations

### If MongoDB fails:

```text
Pending changes survive on all devices
When DB recovers → devices resume sync
```

### If API fails:

```text
All devices continue local editing
Pending changes queued
Sync resumes when API recovers
```

### If WebSocket fails:

```text
Nothing is lost
WebSocket = notification only
Pull API = authoritative synchronization
Devices can always pull manually
```

### If a device loses local data:

```text
Device must perform full resync
Downloads current workspace state from server
```
