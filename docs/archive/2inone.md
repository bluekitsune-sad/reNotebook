# API.md

# Synced Notepad — API Specification

**API Style:** REST + optional WebSocket
**Format:** JSON
**Authentication:** Token/session based
**Version:** `/api/v1`

---

# 1. API Structure

```text
/api/v1
    /auth
    /workspaces
    /devices
    /pairing
    /notes
    /sync
    /conflicts
    /audit
```

---

# 2. Authentication

Protected endpoints require an authenticated session.

Conceptually:

```http
Authorization: Bearer <access-token>
```

The exact authentication mechanism can be changed later without changing the synchronization model.

---

# 3. Authentication Context

The backend must derive:

```text
userId
deviceId
sessionId
```

from the authenticated session.

Never trust:

```json
{
  "userId": "...",
  "deviceId": "..."
}
```

from an arbitrary client request.

---

# 4. Health Check

```http
GET /api/v1/health
```

Response:

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

This endpoint should not require authentication.

---

# 5. Create Workspace

```http
POST /api/v1/workspaces
```

Request:

```json
{
  "name": "My Notes"
}
```

Response:

```json
{
  "workspaceId": "workspace_123",
  "name": "My Notes"
}
```

---

# 6. Get Workspace

```http
GET /api/v1/workspaces/:workspaceId
```

The server verifies membership.

---

# 7. List Devices

```http
GET /api/v1/workspaces/:workspaceId/devices
```

Response:

```json
{
  "devices": [
    {
      "deviceId": "device_phone",
      "name": "My Phone",
      "platform": "android",
      "status": "active",
      "lastSeenAt": "..."
    }
  ]
}
```

---

# 8. Rename Device

```http
PATCH /api/v1/devices/:deviceId
```

Request:

```json
{
  "name": "My Android Phone"
}
```

---

# 9. Revoke Device

```http
POST /api/v1/devices/:deviceId/revoke
```

The server:

```text
marks device revoked
invalidates sessions
stops synchronization
disconnects realtime connections
```

---

# 10. Sync Pull

```http
POST /api/v1/sync/pull
```

Request:

```json
{
  "workspaceId": "workspace_123",
  "cursor": 1250,
  "limit": 500
}
```

Response:

```json
{
  "changes": [],
  "nextCursor": 1300,
  "hasMore": false
}
```

---

# 11. Sync Push

```http
POST /api/v1/sync/push
```

Request:

```json
{
  "workspaceId": "workspace_123",
  "changes": [
    {
      "changeId": "change_123",
      "noteId": "note_123",
      "operation": "update",
      "baseRevision": 4,
      "payload": {
        "title": "Shopping",
        "content": {
          "type": "plain_text",
          "text": "Milk"
        }
      }
    }
  ]
}
```

---

# 12. Push Response

```json
{
  "results": [
    {
      "changeId": "change_123",
      "status": "accepted",
      "revision": 5,
      "serverSequence": 1301
    }
  ]
}
```

---

# 13. Conflict Response

```json
{
  "results": [
    {
      "changeId": "change_123",
      "status": "conflict",
      "conflictId": "conflict_456"
    }
  ]
}
```

---

# 14. Idempotent Push

If the same `changeId` is submitted again:

```json
{
  "changeId": "change_123",
  "status": "already_processed",
  "revision": 5,
  "serverSequence": 1301
}
```

It must not create revision 6.

---

# 15. Get Conflicts

```http
GET /api/v1/workspaces/:workspaceId/conflicts
```

Optional:

```text
?status=open
```

---

# 16. Resolve Conflict

```http
POST /api/v1/conflicts/:conflictId/resolve
```

Request:

```json
{
  "resolution": {
    "type": "keep_version",
    "revision": 11
  }
}
```

Or:

```json
{
  "resolution": {
    "type": "merge",
    "title": "Final",
    "content": {
      "type": "plain_text",
      "text": "Merged result"
    }
  }
}
```

The server creates a new revision.

---

# 17. Audit API

```http
GET /api/v1/workspaces/:workspaceId/audit
```

Query examples:

```text
?noteId=note_123
?deviceId=device_phone
?eventType=note.updated
```

The server must still enforce authorization.

---

# 18. Error Format

All API errors should use a predictable structure.

```json
{
  "error": {
    "code": "DEVICE_REVOKED",
    "message": "This device is no longer authorized.",
    "requestId": "req_123"
  }
}
```

---

# 19. Error Codes

Initial codes:

```text
INVALID_REQUEST
UNAUTHORIZED
FORBIDDEN
NOT_FOUND

DEVICE_REVOKED
SESSION_EXPIRED

CONFLICT
INVALID_CHANGE

RATE_LIMITED
SERVER_ERROR
TEMPORARY_UNAVAILABLE
```

---

# 20. Request IDs

Every API request should receive a request ID.

Example:

```text
X-Request-ID: req_123
```

This is extremely useful for debugging synchronization problems.

---

# 21. WebSocket

Realtime communication can use:

```text
/ws
```

The WebSocket should only notify clients that new changes exist.

Example event:

```json
{
  "type": "workspace.changed",
  "workspaceId": "workspace_123"
}
```

The client then performs normal pull synchronization.

---

# 22. Why WebSocket Does Not Send Full Changes

Avoid:

```text
WebSocket:
"Here is the note."
```

Prefer:

```text
WebSocket:
"Workspace changed."

Client:
"Give me changes after sequence 1200."
```

This makes reconnects and missed WebSocket events safe.

---

# 23. API Security

The server must verify:

```text
authenticated user
+
device
+
session
+
workspace membership
+
device permission
```

before processing synchronization.

---

# 24. Rate Limits

Rate-limit:

```text
authentication
QR pairing
sync requests
conflict resolution
device operations
```

Do not make normal offline synchronization impossible because of aggressive rate limits.

---

# 25. Sync Batch Limits

The server should limit:

```text
maximum changes per push
maximum changes per pull
maximum payload size
```

This prevents one malformed client from consuming excessive resources.

---

# 26. API Versioning

All production APIs should start with:

```text
/api/v1
```

Breaking changes should create:

```text
/api/v2
```

rather than silently changing synchronization semantics.

---

# 27. API Principle

The API should expose the synchronization protocol rather than expose raw MongoDB operations.

The client should never think:

```text
"Update MongoDB note."
```

It should think:

```text
"Submit change."
```

---

# QR_PAIRING.md

# Synced Notepad — QR Pairing Protocol

**Purpose:** Securely connect a new device to an existing workspace.

---

# 1. Pairing Goal

A user should be able to:

```text
Existing device
      ↓
Generate QR
      ↓
New device scans QR
      ↓
Authenticate pairing
      ↓
New device becomes authorized
      ↓
Initial sync
```

---

# 2. Important Security Principle

The QR code must not contain permanent authentication credentials.

Do NOT put:

```text
password
long-lived access token
refresh token
private key
```

directly inside the QR code.

---

# 3. QR Contents

The QR should contain a short-lived pairing payload.

Example:

```text
synced-notepad://pair?session=PAIRING_ID&secret=TEMP_SECRET
```

The secret must expire quickly.

Recommended initial lifetime:

```text
2–5 minutes
```

---

# 4. Pairing Flow

Existing device:

```text
Generate pairing request
        ↓
Server creates pairing session
        ↓
Existing device displays QR
```

New device:

```text
Scan QR
   ↓
Extract pairing session
   ↓
Contact server
   ↓
Server verifies pairing session
```

---

# 5. User Confirmation

Do not automatically trust a QR scan.

New device should display:

```text
Connect to:

"My Notes"

Owner:
John's Account

Device:
Android Phone
```

Then:

```text
[Cancel] [Connect]
```

The existing device should also display:

```text
New device wants to connect:

Android Phone

[Approve] [Reject]
```

---

# 6. Two-Sided Confirmation

For stronger security:

```text
New device scans
        ↓
Existing device sees request
        ↓
Owner approves
        ↓
New device receives authorization
```

This prevents someone who briefly obtains a QR code from silently pairing.

---

# 7. QR Expiration

After expiration:

```text
QR → invalid
```

The user must generate a new QR.

---

# 8. Single Use

A pairing token should normally be single-use.

After successful pairing:

```text
pairingSession.status = claimed
```

A second device cannot reuse it.

---

# 9. QR Replay Attack

Scenario:

```text
Attacker photographs QR
Owner already used QR
Attacker scans later
```

Result:

```text
Rejected
```

because:

```text
pairing session = claimed
```

---

# 10. QR Theft Before Approval

Scenario:

```text
Attacker gets QR
QR still active
```

The attacker may attempt pairing.

The existing device must visibly show the pending pairing request.

Owner can reject it.

---

# 11. Pairing Secret Storage

Server stores:

```text
hash(secret)
```

not:

```text
secret
```

The secret is only known by:

```text
existing device
new device
```

during the short pairing window.

---

# 12. Pairing Session Example

```js
{
  pairingId: "pair_123",

  workspaceId: "workspace_123",

  ownerDeviceId: "device_owner",

  secretHash: "...",

  status: "pending",

  expiresAt: "..."
}
```

---

# 13. Pairing Completion

After owner approval:

```text
Server
 ↓
Create device record
 ↓
Create session
 ↓
Authorize device
 ↓
Return initial synchronization information
```

---

# 14. New Device Registration

New device receives:

```text
deviceId
session
workspaceId
sync cursor
```

It should then perform initial synchronization.

---

# 15. QR Does Not Transfer Existing Session

The QR is for:

```text
device authorization
```

not:

```text
copying an existing login session
```

This distinction makes device management safer.

---

# 16. QR Pairing Edge Cases

Test:

* QR expires while scanning
* QR expires after scanning
* Owner rejects request
* User closes pairing screen
* QR scanned twice
* Two devices scan simultaneously
* Network disappears during pairing
* Existing device disconnects
* New device disconnects
* Server restarts
* Owner revokes device immediately after pairing

---

# 17. Pairing Race

Two devices scan the same QR.

Only one should be able to claim it.

Use an atomic server operation:

```text
pending → claimed
```

The second claim must fail.

---

# 18. Pairing Cancellation

Existing device can cancel:

```http
POST /api/v1/pairing/:pairingId/cancel
```

The session becomes:

```text
cancelled
```

---

# 19. Pairing Audit

Record:

```text
device.pairing_started
device.pairing_approved
device.pairing_rejected
device.pairing_expired
```

This makes QR-based device management traceable.

---

# 20. QR Principle

The QR code should be treated as a **temporary invitation**, not as the user's identity.

The permanent identity is:

```text
User
+
Workspace
+
Device
+
Session
```
