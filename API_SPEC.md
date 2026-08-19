# API_SPEC.md

# Synced Notepad — API Specification

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial API Contract
**Backend:** Node.js + Express
**Database:** MongoDB
**Web:** Next.js + JavaScript
**Mobile:** React Native + JavaScript

---

# 1. Purpose

This document defines the API contract between:

```text
React Native App
        │
        │ HTTPS / WebSocket
        ▼
Node.js API
        │
        ▼
MongoDB
        ▲
        │
Next.js Web App
```

The API is responsible for:

* authentication
* device registration
* QR pairing
* ownership
* device authorization
* note creation
* note modification
* note deletion
* note visibility
* synchronization
* conflict detection
* conflict resolution
* audit history
* device management

---

# 2. API Principles

The API must be:

* authenticated
* authorization-aware
* idempotent where necessary
* offline-sync compatible
* versioned
* backwards compatible
* deterministic
* safe against replayed requests
* safe against duplicate requests
* safe against concurrent updates

---

# 3. Base URL

Development:

```text
http://localhost:4000/api/v1
```

Production:

```text
https://api.example.com/api/v1
```

The production domain is configurable.

---

# 4. API Versioning

All application endpoints use:

```text
/api/v1
```

Example:

```text
/api/v1/notes
```

Future breaking API changes should use:

```text
/api/v2
```

Do not silently change the behavior of an existing API contract.

---

# 5. Authentication

The API requires an authenticated identity for protected operations.

Conceptually:

```text
User
  │
  ▼
Authentication
  │
  ▼
Session
  │
  ▼
Device
  │
  ▼
Workspace
```

The API must know both:

```text
userId
deviceId
```

for normal device operations.

---

# 6. Device Identity

A device receives a stable:

```text
deviceId
```

during registration/pairing.

The device ID must not change when:

* the application restarts
* the user goes offline
* the device reconnects
* the user edits notes

A new installation should normally be treated as a new device.

---

# 7. Authentication Header

For APIs using bearer authentication:

```http
Authorization: Bearer <access-token>
```

The exact token implementation can be JWT or an opaque session token.

The API contract should not require clients to understand the token internals.

---

# 8. Device Header

For authenticated device requests:

```http
X-Device-Id: <device-id>
```

The server must verify that this device actually belongs to the authenticated user/session.

Never trust this header by itself.

---

# 9. Request ID

Clients should send:

```http
X-Request-Id: <uuid>
```

Example:

```text
X-Request-Id: 018f4c...
```

The server should log this ID.

This is useful for debugging synchronization problems.

---

# 10. Mutation ID

Every client-generated mutation must contain:

```text
changeId
```

Example:

```json
{
  "changeId": "018f1234-...",
  "noteId": "018f5678-..."
}
```

This is different from `X-Request-Id`.

---

# 11. Request ID vs Change ID

### Request ID

Identifies an HTTP request.

```text
requestId = request attempt
```

### Change ID

Identifies the logical mutation.

```text
changeId = actual note change
```

If a request is retried:

```text
requestId A
changeId X
```

then:

```text
requestId B
changeId X
```

The server must recognize that the same mutation is being retried.

---

# 12. Standard Response Format

Successful responses should generally use:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Example:

```json
{
  "success": true,
  "data": {
    "noteId": "note_123"
  },
  "meta": {}
}
```

---

# 13. Standard Error Format

Errors should use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "requestId": "request_123"
}
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "NOTE_REVISION_CONFLICT",
    "message": "The note was modified by another device.",
    "details": {
      "noteId": "note_123",
      "currentRevision": 8
    }
  },
  "requestId": "req_123"
}
```

---

# 14. Error Code Principles

Error codes must be stable.

Clients should make decisions based on:

```text
error.code
```

not:

```text
error.message
```

Messages may change.

Error codes should not.

---

# 15. Core Error Codes

Initial codes:

```text
AUTH_REQUIRED
AUTH_INVALID
AUTH_EXPIRED

DEVICE_NOT_FOUND
DEVICE_REVOKED
DEVICE_NOT_AUTHORIZED

WORKSPACE_NOT_FOUND
WORKSPACE_NOT_AUTHORIZED

NOTE_NOT_FOUND
NOTE_REVISION_CONFLICT
NOTE_ALREADY_DELETED

PAIRING_NOT_FOUND
PAIRING_EXPIRED
PAIRING_ALREADY_USED
PAIRING_REJECTED

CONFLICT_NOT_FOUND
CONFLICT_ALREADY_RESOLVED

INVALID_REQUEST
VALIDATION_ERROR

RATE_LIMITED
SERVER_ERROR
SYNC_PROTOCOL_UNSUPPORTED
```

---

# 16. Authentication Endpoints

Initial endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

The exact authentication provider can be swapped later.

---

# 17. Register

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user_123",
      "email": "user@example.com"
    }
  }
}
```

---

# 18. Login

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user_123",
      "displayName": "Alex"
    },
    "session": {
      "accessToken": "...",
      "expiresAt": "..."
    }
  }
}
```

---

# 19. Logout

```http
POST /api/v1/auth/logout
```

The server invalidates the appropriate session/token.

A device's local notes do not need to be deleted simply because the user logs out.

---

# 20. Current User

```http
GET /api/v1/auth/me
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user_123",
      "displayName": "Alex",
      "email": "user@example.com"
    }
  }
}
```

---

# 21. Device Endpoints

```text
GET  /devices
GET  /devices/:deviceId
PATCH /devices/:deviceId
POST /devices/:deviceId/revoke
```

---

# 22. List Devices

```http
GET /api/v1/devices
```

Response:

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "device_1",
        "name": "My Phone",
        "platform": "android",
        "status": "active",
        "lastSeenAt": "..."
      },
      {
        "deviceId": "device_2",
        "name": "Work Laptop",
        "platform": "web",
        "status": "active",
        "lastSeenAt": "..."
      }
    ]
  }
}
```

---

# 23. Rename Device

```http
PATCH /api/v1/devices/:deviceId
```

Request:

```json
{
  "name": "Work Laptop"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "device": {
      "deviceId": "device_2",
      "name": "Work Laptop"
    }
  }
}
```

---

# 24. Revoke Device

```http
POST /api/v1/devices/:deviceId/revoke
```

Response:

```json
{
  "success": true,
  "data": {
    "deviceId": "device_2",
    "status": "revoked"
  }
}
```

A revoked device must not be able to perform future synchronization.

---

# 25. Revoked Device Behavior

When a device tries:

```text
POST /sync/push
```

the server returns:

```json
{
  "success": false,
  "error": {
    "code": "DEVICE_REVOKED",
    "message": "This device has been revoked."
  }
}
```

The client must stop synchronization.

---

# 26. QR Pairing

QR pairing is one of the most important features.

The basic process is:

```text
Existing Device
      │
      │ Generate pairing session
      ▼
   Server
      │
      │ QR payload
      ▼
Existing Device displays QR
      │
      │ scan
      ▼
New Device
      │
      │ claim
      ▼
   Server
      │
      ▼
Existing Device approves
      │
      ▼
New Device authorized
```

---

# 27. QR Ownership Principle

The device that creates the pairing session is considered the:

```text
pairing owner / approving device
```

for that pairing transaction.

However, this does **not** mean the device permanently owns the workspace.

Permanent workspace ownership remains:

```text
workspace.ownerId
```

---

# 28. Create Pairing Session

```http
POST /api/v1/pairing/create
```

Authenticated existing device.

Request:

```json
{
  "deviceName": "My Laptop",
  "platform": "web"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "pairingId": "pair_123",
    "qrPayload": "...",
    "expiresAt": "..."
  }
}
```

---

# 29. QR Payload

The QR payload should contain only the minimum information needed.

Conceptually:

```text
notepad://pair?pairingId=PAIR_ID&secret=ONE_TIME_SECRET
```

The QR must not contain:

```text
password
notes
full authentication token
workspace contents
long-lived API token
```

---

# 30. QR Secret

The secret must be:

* cryptographically random
* short-lived
* single-use
* server-verifiable
* preferably stored only as a hash

Example:

```text
pairingId = pair_123
secret = random_256_bit_value
```

---

# 31. QR Expiration

Recommended initial lifetime:

```text
5 minutes
```

The exact duration can be configured.

The UI should display:

```text
QR expires in 04:32
```

---

# 32. Claim Pairing

The new device scans the QR.

```http
POST /api/v1/pairing/claim
```

Request:

```json
{
  "pairingId": "pair_123",
  "secret": "..."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "pairingId": "pair_123",
    "status": "claimed"
  }
}
```

---

# 33. Approval

The original device receives:

```text
New device wants access:
Work Laptop
Chrome
```

The owner can:

```text
Approve
Reject
```

Approval endpoint:

```http
POST /api/v1/pairing/:pairingId/approve
```

---

# 34. Reject Pairing

```http
POST /api/v1/pairing/:pairingId/reject
```

The new device receives:

```text
PAIRING_REJECTED
```

and must not receive workspace access.

---

# 35. Pairing Race Condition

Consider:

```text
Device A creates QR

Device B scans

Device C scans same QR
```

Only the first valid claim should be accepted.

Expected:

```text
Device B → claimed
Device C → PAIRING_ALREADY_USED
```

---

# 36. QR Screenshot Attack

If someone photographs the QR, they may attempt to use it before expiration.

Therefore:

* QR lifetime must be short
* secret must be high entropy
* pairing must require owner approval
* QR must be single-use
* approval must bind the new device
* server must log the event

For sensitive deployments, the QR can also display a verification code that both devices compare.

---

# 37. Pairing Verification Code

Optional additional protection:

Existing device displays:

```text
Verification code:

739 281
```

New device displays:

```text
739 281
```

The user confirms they match.

This helps defend against QR interception or UI manipulation.

---

# 38. Complete Pairing Flow

```text
Existing Device
      │
      ├── POST /pairing/create
      │
      ▼
     Server
      │
      ├── pairingId
      ├── secret
      └── expiration
      │
      ▼
      QR
      │
      ▼
New Device
      │
      ├── scan QR
      │
      └── POST /pairing/claim
                 │
                 ▼
               Server
                 │
                 ▼
        Existing Device notified
                 │
          ┌──────┴──────┐
          │             │
       APPROVE        REJECT
          │             │
          ▼             ▼
       Device        Pairing
       created       cancelled
```

---

# 39. Pairing Completion

After approval:

```text
New Device
    ↓
deviceId created
    ↓
authentication established
    ↓
workspace authorization granted
    ↓
initial synchronization
```

The new device should immediately begin:

```text
GET/PULL initial state
```

rather than relying on the existing device to transfer note data directly.

---

# 40. Important QR Design Decision

QR pairing should establish:

```text
authorization
```

not directly transfer:

```text
notes
```

This keeps the architecture simple.

The server remains the synchronization authority.

---

# 41. Workspace Endpoints

```text
GET /workspaces
GET /workspaces/:workspaceId
PATCH /workspaces/:workspaceId
```

---

# 42. Get Workspace

```http
GET /api/v1/workspaces/:workspaceId
```

Response:

```json
{
  "success": true,
  "data": {
    "workspace": {
      "workspaceId": "workspace_123",
      "name": "My Notes",
      "ownerId": "user_123"
    }
  }
}
```

---

# 43. Note Endpoints

The application can support normal CRUD endpoints:

```text
GET    /notes
GET    /notes/:noteId
POST   /notes
PATCH  /notes/:noteId
DELETE /notes/:noteId
POST   /notes/:noteId/restore
```

However, synchronization mutations should eventually use the sync protocol rather than treating ordinary CRUD requests as the complete synchronization system.

---

# 44. Create Note

```http
POST /api/v1/notes
```

Request:

```json
{
  "changeId": "change_123",
  "title": "Shopping List",
  "content": "Milk\nEggs\nBread"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "note": {
      "noteId": "note_123",
      "revision": 1,
      "title": "Shopping List",
      "content": "Milk\nEggs\nBread"
    },
    "change": {
      "changeId": "change_123",
      "sequence": 101
    }
  }
}
```

---

# 45. Update Note

```http
PATCH /api/v1/notes/:noteId
```

Request:

```json
{
  "changeId": "change_124",
  "baseRevision": 1,
  "title": "Shopping List",
  "content": "Milk\nEggs\nBread\nCoffee"
}
```

---

# 46. Successful Update

Response:

```json
{
  "success": true,
  "data": {
    "note": {
      "noteId": "note_123",
      "revision": 2,
      "title": "Shopping List",
      "content": "Milk\nEggs\nBread\nCoffee"
    },
    "change": {
      "changeId": "change_124",
      "sequence": 102
    }
  }
}
```

---

# 47. Delete Note

```http
DELETE /api/v1/notes/:noteId
```

Request:

```json
{
  "changeId": "change_125",
  "baseRevision": 2
}
```

The server creates a deletion revision/tombstone.

---

# 48. Restore Note

```http
POST /api/v1/notes/:noteId/restore
```

Request:

```json
{
  "changeId": "change_126",
  "baseRevision": 3
}
```

---

# 49. Why `baseRevision` Exists

Suppose:

```text
Server:
revision 5
```

Device A downloaded revision 5.

Device B updates it:

```text
revision 6
```

Device A then sends:

```text
baseRevision = 5
```

The server knows Device A is editing stale data.

This is how conflicts are detected.

---

# 50. Basic Conflict Detection

```text
Incoming baseRevision
        │
        ▼
Current server revision
        │
        ├── equal
        │      ↓
        │   accept
        │
        └── different
               ↓
            conflict
```

---

# 51. Important Conflict Rule

Do not automatically overwrite the server note when:

```text
baseRevision !== currentRevision
```

unless a deliberately designed merge strategy determines that it is safe.

The default MVP behavior should be:

```text
stale mutation
    ↓
conflict
```

---

# 52. Conflict Response

Example:

```json
{
  "success": false,
  "error": {
    "code": "NOTE_REVISION_CONFLICT",
    "message": "The note was modified by another device.",
    "details": {
      "conflictId": "conflict_123",
      "noteId": "note_123",
      "serverRevision": 8,
      "incomingBaseRevision": 7
    }
  }
}
```

---

# 53. Conflict Object

The client should receive enough information to display:

```text
Your version
+
Other device's version
```

Example:

```json
{
  "conflictId": "conflict_123",

  "noteId": "note_123",

  "serverVersion": {
    "revision": 8,
    "title": "Ideas",
    "content": "A\nB\nC",
    "deviceName": "Work Laptop"
  },

  "localVersion": {
    "revision": 7,
    "title": "Ideas",
    "content": "A\nB\nD",
    "deviceName": "My Phone"
  }
}
```

---

# 54. Conflict UI

The UI should show:

```text
Conflict detected

Work Laptop changed this note:
A
B
C

My Phone changed this note:
A
B
D

Choose:

[Keep Laptop]
[Keep Phone]
[Keep Both]
[Merge Manually]
```

---

# 55. "Keep Both"

Keep both should produce separate note content or a merged result according to the final product UX.

Recommended MVP:

```text
Keep both
    ↓
create a new note
```

rather than silently combining unrelated content.

---

# 56. Manual Merge

The application should eventually provide a comparison UI:

```text
REMOTE
A
B
C

LOCAL
A
B
D

RESULT
A
B
C
D
```

The user can edit the final result.

Submitting the result creates a new mutation.

---

# 57. Conflict Resolution Endpoint

```http
POST /api/v1/conflicts/:conflictId/resolve
```

Request:

```json
{
  "resolution": "manual_merge",
  "title": "Ideas",
  "content": "A\nB\nC\nD",
  "changeId": "change_999"
}
```

---

# 58. Conflict Resolution Types

Initial:

```text
keep_server
keep_incoming
keep_both
manual_merge
```

---

# 59. Conflict Resolution Principle

Resolution must create a new canonical revision.

Example:

```text
revision 7
     │
     ├── device A
     │
     └── device B
          ↓
       conflict
          ↓
      user resolves
          ↓
      revision 9
```

Do not rewrite revision 7 or 8.

---

# 60. Note Visibility API

```text
GET  /notes/:noteId/visibility
PUT  /notes/:noteId/visibility/:deviceId
```

---

# 61. Hide Note From Device

```http
PUT /api/v1/notes/:noteId/visibility/:deviceId
```

Request:

```json
{
  "visible": false
}
```

Response:

```json
{
  "success": true,
  "data": {
    "noteId": "note_123",
    "deviceId": "device_456",
    "visible": false
  }
}
```

---

# 62. Unhide Note

```json
{
  "visible": true
}
```

The note is not deleted.

It is simply not visible to that device.

---

# 63. Important Visibility Rule

Hiding a note from a device does not mean:

```text
delete note
```

It means:

```text
device cannot see note
```

The note remains part of the workspace.

---

# 64. Visibility and Existing Local Data

Suppose:

```text
Phone
already has Note A
```

Then the user hides Note A from Phone.

The server sends a visibility update.

The phone should:

```text
remove Note A from normal UI
```

but whether encrypted/local cached content is physically deleted should be an explicit privacy policy.

---

# 65. Privacy Mode

Future setting:

```text
When a note is hidden:
[ ] Remove local copy
[ ] Keep encrypted local cache
```

MVP recommendation:

```text
remove it from normal local display
```

and document the exact local-storage privacy behavior.

---

# 66. Audit API

```http
GET /api/v1/audit
GET /api/v1/notes/:noteId/history
```

---

# 67. Workspace Audit

```http
GET /api/v1/audit?workspaceId=workspace_123
```

Response:

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "auditId": "audit_1",
        "action": "note.created",
        "noteId": "note_123",
        "deviceId": "device_phone",
        "deviceName": "My Phone",
        "createdAt": "..."
      }
    ]
  }
}
```

---

# 68. Note History

```http
GET /api/v1/notes/:noteId/history
```

Response:

```json
{
  "success": true,
  "data": {
    "revisions": [
      {
        "revision": 3,
        "changedByDevice": "Work Laptop",
        "changedAt": "...",
        "operation": "update"
      },
      {
        "revision": 2,
        "changedByDevice": "My Phone",
        "changedAt": "...",
        "operation": "update"
      }
    ]
  }
}
```

---

# 69. Synchronization API

The most important API:

```text
POST /sync/push
GET  /sync/pull
POST /sync/ack
```

For the initial implementation, `push` and `pull` can be sufficient.

---

# 70. Sync Model

The synchronization system is:

```text
             SERVER
                │
       ┌────────┴────────┐
       │                 │
     PUSH              PULL
       ▲                 │
       │                 ▼
    CLIENT ───────── CLIENT
```

Clients:

1. upload local mutations
2. receive accepted results/conflicts
3. download remote changes
4. apply them locally
5. advance cursor

---

# 71. Push Endpoint

```http
POST /api/v1/sync/push
```

Request:

```json
{
  "protocolVersion": 1,
  "workspaceId": "workspace_123",
  "changes": [
    {
      "changeId": "change_101",
      "noteId": "note_1",
      "operation": "update",
      "baseRevision": 5,
      "payload": {
        "title": "Ideas",
        "content": "A\nB\nC"
      },
      "clientCreatedAt": "..."
    }
  ]
}
```

---

# 72. Push Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "changeId": "change_101",
        "status": "accepted",
        "sequence": 201,
        "revision": 6
      }
    ]
  }
}
```

---

# 73. Push Conflict Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "changeId": "change_102",
        "status": "conflict",
        "conflictId": "conflict_10",
        "noteId": "note_1"
      }
    ]
  }
}
```

The entire push batch should not necessarily fail because one change conflicts.

---

# 74. Batch Push

A client can send multiple changes:

```json
{
  "changes": [
    {},
    {},
    {},
    {}
  ]
}
```

The server should process them individually while maintaining transaction safety for each mutation.

---

# 75. Push Ordering

Client changes should normally be sent in local creation order.

Example:

```text
change 1
change 2
change 3
```

If:

```text
change 2
```

depends on:

```text
change 1
```

the server must not incorrectly apply change 2 first.

---

# 76. Independent Changes

Different notes may be processed independently.

Example:

```text
Note A → change 1
Note B → change 2
```

There is no need to serialize all workspace changes at the application layer.

The server sequence still establishes global ordering.

---

# 77. Pull Endpoint

```http
GET /api/v1/sync/pull?workspaceId=workspace_123&cursor=200&limit=500
```

Response:

```json
{
  "success": true,
  "data": {
    "changes": [
      {
        "sequence": 201,
        "changeId": "change_201",
        "noteId": "note_5",
        "operation": "update",
        "revision": 4,
        "payload": {
          "title": "Ideas",
          "content": "..."
        },
        "deviceId": "device_web"
      }
    ],
    "nextCursor": 201,
    "hasMore": false
  }
}
```

---

# 78. Pull Cursor

If the client currently has:

```text
cursor = 200
```

it requests:

```text
sequence > 200
```

If it receives:

```text
201
202
203
```

it can eventually advance to:

```text
cursor = 203
```

---

# 79. Cursor Advancement

The client must not advance the cursor before successfully applying the corresponding changes.

Correct:

```text
download
   ↓
validate
   ↓
apply transaction
   ↓
update cursor
   ↓
commit
```

Incorrect:

```text
download
   ↓
update cursor
   ↓
crash
   ↓
changes never applied
```

---

# 80. Pull Batching

Recommended initial maximum:

```text
500 changes
```

The exact value should be configurable.

If:

```text
hasMore = true
```

the client continues pulling.

---

# 81. Initial Sync

A newly paired device has:

```text
cursor = 0
```

It performs:

```text
pull(cursor=0)
```

until:

```text
hasMore = false
```

Then it is synchronized to the current server sequence.

---

# 82. Initial Sync Example

Server:

```text
sequence = 105
```

New device:

```text
cursor = 0
```

Requests:

```text
0 → 500
```

receives:

```text
1...105
```

applies them.

Final:

```text
cursor = 105
```

---

# 83. Offline Creation

Phone is offline.

User creates:

```text
Note A
Note B
```

Local state:

```text
pending:
  change_A
  change_B
```

No server request occurs.

---

# 84. Web Offline Creation

Web is also offline.

User creates:

```text
Note C
Note D
Note E
```

Local state:

```text
pending:
  change_C
  change_D
  change_E
```

---

# 85. Reconnection

Phone reconnects.

It pushes:

```text
A
B
```

Server accepts:

```text
A → sequence 101
B → sequence 102
```

Phone pulls remote changes if necessary.

---

# 86. Web Reconnection

Web reconnects.

It pushes:

```text
C
D
E
```

Server accepts:

```text
C → sequence 103
D → sequence 104
E → sequence 105
```

Both devices eventually pull:

```text
101
102
103
104
105
```

Result:

```text
5 notes
```

on both devices.

---

# 87. Duplicate Push

Client sends:

```text
change_101
```

Server accepts it.

Network fails before response reaches client.

Client retries:

```text
change_101
```

Server recognizes the existing `changeId`.

It must return the original result instead of creating another note/change.

---

# 88. Idempotent Push

Example:

```json
{
  "changeId": "change_101"
}
```

First request:

```text
accepted
sequence = 101
```

Second request:

```text
already_processed
sequence = 101
```

No duplicate revision is created.

---

# 89. Push Result States

Recommended:

```text
accepted
already_processed
conflict
rejected
invalid
```

---

# 90. Pull Must Include Sender Information

For audit/conflict UX, remote changes should include enough metadata:

```json
{
  "deviceId": "device_123",
  "deviceName": "Work Laptop",
  "userId": "user_123"
}
```

This allows the UI to display:

```text
Changed by Work Laptop
```

instead of:

```text
Changed by device_123
```

---

# 91. Device Name Changes

If a device changes its name:

```text
Work Laptop
```

to:

```text
Office Laptop
```

historical audit events should retain enough information to remain understandable.

Recommended:

```text
deviceId
+
deviceName snapshot
```

inside audit events.

---

# 92. Real-Time Synchronization

WebSocket support is recommended.

Endpoint:

```text
wss://api.example.com/api/v1/sync
```

WebSocket is an optimization.

It must not be the only synchronization mechanism.

---

# 93. Why WebSocket Is Not the Source of Truth

A device can:

* lose Wi-Fi
* close the app
* background the mobile app
* lose battery
* sleep
* change networks

Therefore:

```text
WebSocket
```

should provide:

```text
"something changed"
```

rather than being the only mechanism for delivering state.

---

# 94. WebSocket Event

Example:

```json
{
  "type": "workspace.changed",
  "workspaceId": "workspace_123",
  "latestSequence": 105
}
```

The client then calls:

```text
pull(cursor)
```

---

# 95. WebSocket Principle

Do not send the entire note state through WebSocket notifications unless necessary.

Prefer:

```text
WebSocket:
"new changes exist"

HTTP sync:
"give me changes after cursor 100"
```

This makes reconnecting much safer.

---

# 96. Offline Detection

The client should maintain:

```text
online
offline
syncing
error
```

Network connectivity does not guarantee server availability.

Therefore:

```text
network online
```

does not automatically mean:

```text
server available
```

---

# 97. Sync Retry

Use exponential backoff.

Example:

```text
1 sec
2 sec
4 sec
8 sec
16 sec
30 sec
60 sec
```

With jitter.

Do not retry hundreds of times per second.

---

# 98. Retryable Errors

Retry:

```text
network failure
timeout
HTTP 408
HTTP 429
HTTP 500
HTTP 502
HTTP 503
HTTP 504
```

Do not blindly retry:

```text
401
403
NOTE_REVISION_CONFLICT
DEVICE_REVOKED
VALIDATION_ERROR
```

---

# 99. Authentication Expiration During Sync

If access expires:

```text
sync
 ↓
401
 ↓
refresh authentication
 ↓
retry request
```

If refresh fails:

```text
stop sync
require authentication
```

Pending local notes should remain safe locally rather than being discarded.

---

# 100. Device Revocation During Offline Period

Scenario:

```text
Phone goes offline
Admin revokes phone
Phone reconnects
```

Phone sends:

```text
sync/push
```

Server responds:

```text
DEVICE_REVOKED
```

Phone must:

```text
stop synchronization
mark device revoked
notify user
```

It must not continue retrying indefinitely.

---

# 101. Server Restart During Push

Scenario:

```text
client → push
server → commits database transaction
server → crashes before response
client → retries
```

The second request finds:

```text
changeId already exists
```

and returns:

```text
already_processed
```

This is why idempotency is mandatory.

---

# 102. Client Crash During Pull

Scenario:

```text
client downloads:
201
202
203

client crashes
```

If transaction was not committed:

```text
cursor remains 200
```

On restart:

```text
pull > 200
```

The client downloads 201–203 again.

This is safe because applying changes must be idempotent.

---

# 103. Applying Remote Changes

When receiving a remote change:

```text
changeId
```

must be checked locally.

If already applied:

```text
skip
```

This prevents duplicate local application.

---

# 104. Local Applied Changes

The local database should maintain enough information to recognize:

```text
already applied changeId
```

This can be implemented through:

```text
local_revisions
```

or a dedicated local applied-change table.

---

# 105. Remote Change Must Not Become Pending

This is a critical rule.

When the client receives:

```text
remote update
```

it must update:

```text
local_notes
```

but must NOT create:

```text
pending_changes
```

Otherwise the device will echo remote changes back to the server.

---

# 106. Local User Change

User changes note:

```text
UI
 ↓
local database
 ↓
pending_changes
 ↓
sync engine
 ↓
server
```

---

# 107. Remote Change

Server changes note:

```text
server
 ↓
sync pull
 ↓
local database
 ↓
UI
```

No pending mutation is generated.

---

# 108. Sync Engine State Machine

```text
IDLE
 │
 ▼
CHECK_NETWORK
 │
 ▼
AUTHENTICATE
 │
 ▼
PUSH_PENDING
 │
 ├── conflict ──► HANDLE_CONFLICT
 │
 ▼
PULL_REMOTE
 │
 ├── more ──► PULL_REMOTE
 │
 ▼
UPDATE_CURSOR
 │
 ▼
IDLE
```

---

# 109. Conflict State

When a conflict occurs:

```text
PUSH_PENDING
      ↓
CONFLICT
      ↓
STORE_LOCAL_CONFLICT
      ↓
CONTINUE_OTHER_SYNC
```

A single conflict should not necessarily block unrelated notes from syncing.

---

# 110. Conflict Independence

Example:

```text
Note A → conflict
Note B → accepted
Note C → accepted
```

The client should ideally end with:

```text
Note A → needs user decision
Note B → synchronized
Note C → synchronized
```

---

# 111. Sync Order

Recommended:

```text
1. Push pending changes
2. Pull remote changes
3. Apply remote changes
4. Update cursor
5. Repeat if necessary
```

However, implementations can optimize this after correctness is established.

---

# 112. Pull After Push

After successfully pushing:

```text
A → sequence 100
```

the client may already know its own result.

It still needs to pull:

```text
101+
```

to receive changes from other devices.

---

# 113. Own Change Echo

When a client pulls its own change back:

```text
deviceId == currentDeviceId
```

it should recognize that the local mutation has already been applied.

The sync engine should reconcile it without duplicating the note.

---

# 114. Ownership Rules

The server is authoritative for ownership.

A client cannot send:

```json
{
  "ownerId": "another_user"
}
```

and change ownership.

Ownership changes require a dedicated authorized endpoint.

---

# 115. Initial Ownership Model

For MVP:

```text
User
  ↓
owns Workspace
  ↓
all paired devices
  ↓
access Workspace
```

---

# 116. Future Shared Ownership

The architecture should eventually support:

```text
Workspace
 ├── Owner
 ├── Editor
 ├── Viewer
 └── devices
```

This is not required for the MVP.

---

# 117. Device Permissions

Initial permissions:

```text
owner device
    full access

paired device
    workspace access
```

Future:

```text
read
write
manage_devices
manage_visibility
manage_workspace
```

---

# 118. Security Boundary

Never assume:

```text
paired device = trusted forever
```

The owner must be able to revoke it.

The server checks authorization on every protected request.

---

# 119. Rate Limiting

Rate limiting should exist for:

```text
login
pairing creation
pairing claim
sync push
sync pull
```

Especially:

```text
pairing claim
```

because it involves a secret.

---

# 120. QR Brute Force Protection

Pairing endpoints should implement:

```text
rate limiting
attempt limits
short expiration
single-use secrets
```

Never use a short numeric code as the only authentication secret.

---

# 121. Input Validation

Validate:

```text
note title length
note content size
device name length
workspace name length
change payload
operation type
revision number
UUID format
protocol version
```

Reject malformed requests before database mutation.

---

# 122. Server-Side Sanitization

Do not blindly trust:

```text
title
content
deviceName
workspaceName
```

If the frontend renders content as HTML, additional sanitization is required.

The MVP should preferably treat note content as plain text.

---

# 123. Note Content Model

MVP:

```text
plain text
```

Future:

```text
Markdown
rich text
blocks
```

Do not introduce rich text until the synchronization model supports it properly.

---

# 124. Pagination

List APIs should support:

```text
limit
cursor
```

rather than relying exclusively on:

```text
offset
```

For audit/history:

```text
GET /audit?cursor=...&limit=50
```

---

# 125. Sync Pagination

Sync pagination is based on:

```text
sequence cursor
```

not normal database pagination.

Example:

```text
cursor = 500
```

means:

```text
return sequence > 500
```

---

# 126. Maximum Sync Batch

Recommended:

```text
500 changes
```

Configurable server-side.

The client must handle:

```text
hasMore = true
```

correctly.

---

# 127. Sync Protocol Version

Every sync request contains:

```json
{
  "protocolVersion": 1
}
```

Server verifies compatibility.

If unsupported:

```json
{
  "success": false,
  "error": {
    "code": "SYNC_PROTOCOL_UNSUPPORTED"
  }
}
```

---

# 128. API Security Rules

Mandatory:

```text
HTTPS in production
secure authentication
server-side authorization
rate limiting
input validation
short-lived pairing secrets
idempotent mutations
audit logging
device revocation
```

---

# 129. API Logging

Every request should be traceable through:

```text
requestId
userId
deviceId
endpoint
statusCode
duration
```

Do not log:

```text
password
access token
refresh token
raw QR secret
full sensitive note content
```

---

# 130. Audit Logging

Important events should create audit entries:

```text
login
device paired
device revoked
note created
note updated
note deleted
note restored
note hidden
note unhidden
conflict created
conflict resolved
```

Authentication events may eventually use a separate security audit stream.

---

# 131. API Testing

Every endpoint should have tests for:

```text
valid request
invalid request
missing authentication
wrong user
wrong device
revoked device
duplicate request
network retry
concurrent request
stale revision
```

---

# 132. QR Testing

Required tests:

```text
valid QR
expired QR
already-used QR
invalid secret
tampered pairingId
wrong device
double claim
claim after rejection
claim after expiration
owner rejects
owner approves
network disconnect during approval
owner closes app
new device disconnects during pairing
```

---

# 133. Sync Testing

Required tests:

```text
offline creation
offline update
offline deletion
offline restore
reconnect
duplicate push
partial push
partial pull
crash during pull
crash during push
server restart
device revocation
authentication expiration
large sync backlog
multiple devices
simultaneous edits
```

---

# 134. Critical Multi-Device Test

Initial state:

```text
Phone:
Note A
Note B

Web:
Note A
Note B
```

Phone offline:

```text
Note C
Note D
```

Web offline:

```text
Note E
Note F
Note G
```

Reconnect both.

Expected final state:

```text
Note A
Note B
Note C
Note D
Note E
Note F
Note G
```

on both devices.

---

# 135. Critical Concurrent Edit Test

Initial:

```text
Note A
revision 5
```

Phone downloads revision 5.

Web downloads revision 5.

Phone changes:

```text
"Hello from phone"
```

Web changes:

```text
"Hello from web"
```

Phone syncs first:

```text
revision 6
```

Web syncs:

```text
baseRevision = 5
currentRevision = 6
```

Expected:

```text
CONFLICT
```

No silent overwrite.

---

# 136. Critical Same-Time Create Test

Phone:

```text
create Note A
```

Web:

```text
create Note B
```

Both offline.

Expected after sync:

```text
Note A
Note B
```

No conflict should occur because they are different notes.

---

# 137. Critical Same-Time Delete/Edit Test

Phone:

```text
delete Note A
baseRevision 5
```

Web:

```text
edit Note A
baseRevision 5
```

If delete arrives first:

```text
revision 6 = deleted
```

Web's update is now stale.

The server must apply the documented conflict policy.

Recommended:

```text
conflict
```

rather than silently resurrecting or overwriting the note.

---

# 138. Critical Hide/Edit Test

Phone hides Note A from Web.

Web is offline and edits Note A.

When Web reconnects:

```text
visibility update
+
note update
```

The system must distinguish:

```text
note data
```

from:

```text
visibility
```

The edit should not automatically remove the visibility rule.

---

# 139. Critical Revoke/Offline Test

Laptop goes offline.

Owner revokes Laptop.

Laptop reconnects.

Expected:

```text
sync rejected
device revoked
no further writes accepted
```

Pending local data should not be silently deleted.

---

# 140. Critical Duplicate Request Test

Client sends:

```text
changeId = ABC
```

Server accepts.

Response is lost.

Client retries:

```text
changeId = ABC
```

Expected:

```text
same result
no duplicate note
no duplicate revision
no duplicate change
```

---

# 141. Critical QR Replay Test

QR:

```text
PAIR-ABC
```

Device B successfully claims.

Device C tries the same QR.

Expected:

```text
PAIRING_ALREADY_USED
```

---

# 142. Critical QR Expiration Test

QR expires.

New device scans.

Expected:

```text
PAIRING_EXPIRED
```

No device is created.

---

# 143. Critical QR Reject Test

New device claims QR.

Owner rejects.

New device must receive:

```text
PAIRING_REJECTED
```

No workspace access is granted.

---

# 144. Critical Partial Pull Test

Server sends:

```text
101
102
103
```

Client applies:

```text
101
102
```

and crashes.

Cursor remains:

```text
100
```

On restart:

```text
pull > 100
```

Client safely re-applies:

```text
101
102
103
```

without duplication.

---

# 145. Critical Offline Sequence Test

Two devices independently create:

```text
Phone:
A
B

Web:
C
D
E
```

There is no global client sequence.

Server assigns:

```text
A → 101
B → 102
C → 103
D → 104
E → 105
```

depending on arrival order.

The final note set must be independent of which device reconnects first.

---

# 146. Important Synchronization Invariant

The system must guarantee:

```text
same accepted server changes
        +
same authorization/visibility state
        +
same conflict resolutions
        =
same canonical workspace state
```

on every synchronized device.

---

# 147. Eventual Consistency

The clients do not need to be identical immediately.

During offline operation:

```text
Phone ≠ Server
Web ≠ Server
```

is allowed.

After successful synchronization:

```text
Phone = Server
Web = Server
```

must eventually become true.

---

# 148. Sync Completion Definition

A device is considered synchronized when:

```text
pendingChanges = 0
open required sync errors = 0
localCursor >= server sequence observed during sync
```

and the device has successfully completed a pull cycle.

---

# 149. API Contract Summary

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

### Devices

```text
GET   /devices
GET   /devices/:deviceId
PATCH /devices/:deviceId
POST  /devices/:deviceId/revoke
```

### Pairing

```text
POST /pairing/create
POST /pairing/claim
POST /pairing/:pairingId/approve
POST /pairing/:pairingId/reject
```

### Workspaces

```text
GET   /workspaces
GET   /workspaces/:workspaceId
PATCH /workspaces/:workspaceId
```

### Notes

```text
GET    /notes
GET    /notes/:noteId
POST   /notes
PATCH  /notes/:noteId
DELETE /notes/:noteId
POST   /notes/:noteId/restore
```

### Visibility

```text
GET /notes/:noteId/visibility
PUT /notes/:noteId/visibility/:deviceId
```

### Conflicts

```text
GET  /conflicts
GET  /conflicts/:conflictId
POST /conflicts/:conflictId/resolve
```

### History

```text
GET /notes/:noteId/history
GET /audit
```

### Synchronization

```text
POST /sync/push
GET  /sync/pull
```

### Real-time

```text
WSS /sync
```

---

# 150. Final Synchronization Architecture

```text
                    ┌──────────────────────┐
                    │       MongoDB        │
                    │                      │
                    │ notes                │
                    │ revisions            │
                    │ changes              │
                    │ conflicts            │
                    │ devices              │
                    │ audit logs            │
                    └──────────┬───────────┘
                               │
                         Node.js API
                               │
               ┌───────────────┼────────────────┐
               │               │                │
             HTTPS          WebSocket          QR
               │               │                │
               ▼               ▼                ▼
        ┌────────────┐  ┌────────────┐   ┌────────────┐
        │   Next.js  │  │ React Native│   │ Pairing UI │
        │    Web     │  │    App      │   │            │
        └─────┬──────┘  └──────┬──────┘   └────────────┘
              │                │
          IndexedDB          SQLite
              │                │
              └───────┬────────┘
                      │
                 Sync Engine
                      │
             ┌────────┴────────┐
             │                 │
            PUSH              PULL
             │                 │
             └────────┬────────┘
                      ▼
                Canonical State
```

---

# 151. Most Important API Rules

The implementation must preserve these rules above everything else:

```text
1. MongoDB is authoritative.

2. Clients can work offline.

3. Every mutation has a unique changeId.

4. Every note mutation has a baseRevision.

5. Duplicate mutations are safe.

6. Server sequences are authoritative.

7. Cursors only advance after successful local application.

8. Remote changes never become outgoing pending changes.

9. Conflicting edits are never silently overwritten.

10. Conflicts create explicit resolution workflows.

11. QR codes establish authorization, not direct note transfer.

12. QR secrets are temporary and single-use.

13. Pairing requires owner approval.

14. Devices can be revoked.

15. Note visibility is independent of note ownership.

16. Audit history is append-only.

17. Revisions are immutable.

18. WebSocket is an optimization, not the source of truth.

19. Reconnecting clients must be able to recover using cursor-based synchronization.

20. The same server state must eventually produce the same workspace state on every authorized device.
```

---

# 152. Recommended Implementation Order

Do not implement every endpoint at once.

Implement in this order:

```text
Phase 1
Authentication
    ↓
Device registration
    ↓
Workspace creation
```

```text
Phase 2
Note CRUD
    ↓
Revision history
    ↓
Change log
```

```text
Phase 3
Sync pull
    ↓
Sync push
    ↓
Offline queue
    ↓
Cursor handling
```

```text
Phase 4
QR pairing
    ↓
Device authorization
    ↓
Device revocation
```

```text
Phase 5
Conflict detection
    ↓
Conflict UI
    ↓
Conflict resolution
```

```text
Phase 6
Device-specific visibility
    ↓
Audit history
    ↓
Real-time WebSocket notifications
```

---

# 153. Definition of API Completion

The API layer is considered MVP-complete when:

* a user can authenticate
* a device can be registered
* a workspace can be created
* a device can be paired through QR
* the owner can approve/reject pairing
* the owner can revoke devices
* notes can be created
* notes can be edited
* notes can be deleted/restored
* offline mutations can be queued
* mutations can be pushed after reconnecting
* remote changes can be pulled
* cursors survive crashes
* duplicate mutations are safe
* simultaneous edits produce conflicts
* conflicts can be resolved
* notes can be hidden from specific devices
* audit history records important actions
* Web and React Native eventually converge on the same canonical workspace state

---

# 154. Next Document

The next implementation document should be:

```text
SYNC_ENGINE.md
```

It should define the actual client synchronization algorithm in detail, including:

```text
local mutation queue
offline behavior
push algorithm
pull algorithm
cursor transactions
retry/backoff
duplicate detection
conflict handling
device revocation
WebSocket triggers
startup synchronization
background synchronization
app termination
crash recovery
network switching
simultaneous device updates
```

That document is the bridge between this API contract and the actual JavaScript code.
