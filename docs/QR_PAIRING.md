# Synced Notepad — QR Pairing Protocol

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Technical Specification

---

## 1. Pairing Goal

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

## 2. Important Security Principle

The QR code must **not** contain permanent authentication credentials. Do NOT put passwords, long-lived access tokens, refresh tokens, or private keys directly inside the QR code.

The QR code should be treated as a **temporary invitation**, not as the user's identity. The permanent identity is User + Workspace + Device + Session.

---

## 3. QR Contents

The QR should contain a short-lived pairing payload:

```text
synced-notepad://pair?session=PAIRING_ID&secret=TEMP_SECRET
```

Example JSON payload:

```json
{
  "version": 1,
  "pairing_id": "pair_abc123",
  "workspace_hint": "ws_xyz",
  "expires_at": 1780000000,
  "nonce": "random-value",
  "server_endpoint": "..."
}
```

The secret must expire quickly. Recommended initial lifetime: **2-5 minutes**.

---

## 4. Full Pairing Flow

### Step 1 — Owner Opens Pairing

On the existing device:

```text
Settings
    ↓
Devices
    ↓
Add Device
    ↓
Show QR Code
```

The application generates a temporary pairing session. The server creates a pairing session with a random secret, stores a hash of the secret, and returns the pairing session details to the owner device.

### Step 2 — New Device Scans QR

The new device scans the QR code and extracts the pairing session. It contacts the server to verify the pairing session is valid and not expired.

The new device displays:

```text
Connect to:

"My Notes"

Owner:
John's Account

You are adding:
Chrome on Windows

[ Cancel ]
[ Continue ]
```

The user must explicitly confirm.

### Step 3 — Mutual Verification

For stronger security, both devices display a short verification code:

```text
Owner device:
Verification code: 482 913

New device:
Verification code: 482 913
```

User confirms that the codes match. This protects against QR interception and man-in-the-middle scenarios.

### Step 4 — Device Registration

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

The new device receives: deviceId, session, workspaceId, sync cursor. It then performs initial synchronization.

---

## 5. QR Security Requirements

QR codes must be:

- **Short-lived** — Expires in 1-5 minutes
- **Single-use** — After successful pairing, `pairingSession.status = claimed`
- **Random** — Cryptographically random pairing IDs and secrets
- **Revocable** — Owner can cancel at any time
- **Bound to a specific pairing request** — Linked to workspace and owner device
- **Invalidated after successful pairing**
- **Invalidated after expiration**

The system should never rely on `QR = workspace_password` or `QR = permanent authentication token`.

The server stores `hash(secret)`, not the secret itself.

---

## 6. QR Replay Attack

### Scenario

Owner generates QR. Attacker photographs it. Owner successfully pairs their laptop. Attacker tries scanning the same QR later.

### Expected Result

```text
Pairing expired or already completed.
```

No access is granted because the pairing session status is `claimed`.

---

## 7. QR Screenshot Attack

### Scenario

User screenshots a valid QR code. Someone receives the screenshot.

### Defense

The QR expires quickly. For higher security, the full flow is:

```text
QR
    ↓
Pairing session
    ↓
Mutual approval
    ↓
Device-specific key exchange
```

A screenshot has a very small attack window (1-5 minutes) and still requires owner approval on the existing device.

---

## 8. QR Theft Before Approval

### Scenario

Attacker gets QR while it is still active.

### Defense

The existing device must visibly show the pending pairing request. Owner can reject it:

```text
New device wants to connect:

Android Phone

[Approve] [Reject]
```

---

## 9. Pairing Completion

After owner approval, the server:

1. Creates a device record
2. Creates a session
3. Authorizes the device for the workspace
4. Returns initial synchronization information

The new device receives:

```text
deviceId
session
workspaceId
sync cursor
```

It should then perform initial synchronization starting from cursor 0 (or an appropriate workspace snapshot cursor).

---

## 10. Two-Sided Confirmation

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

## 11. QR Does Not Transfer Existing Session

The QR is for **device authorization**, not copying an existing login session. This distinction makes device management safer.

---

## 12. Pairing Edge Cases

The following must be tested:

- QR expires while scanning
- QR expires after scanning
- Owner rejects request
- User closes pairing screen
- QR scanned twice
- Two devices scan simultaneously
- Network disappears during pairing
- Existing device disconnects
- New device disconnects
- Server restarts during pairing
- Owner revokes device immediately after pairing

---

## 13. Pairing Race Condition

Two devices scan the same QR. Only one should be able to claim it. Use an atomic server operation:

```text
pending → claimed
```

The second claim fails with `PAIRING_ALREADY_CLAIMED`. The owner can generate another QR.

---

## 14. Pairing Cancellation

The existing device can cancel:

```http
POST /api/v1/pairing/:pairingId/cancel
```

The session becomes `cancelled`.

---

## 15. Pairing Audit

Record all pairing events:

```text
device.pairing_started
device.pairing_approved
device.pairing_rejected
device.pairing_expired
```

This makes QR-based device management traceable.

---

## 16. Pairing Session Structure

```js
{
  pairingId: "pair_123",
  workspaceId: "workspace_123",
  ownerDeviceId: "device_owner",
  secretHash: "...",
  status: "pending",    // pending → claimed → completed | cancelled | expired
  expiresAt: "..."
}
```

Possible statuses:

```text
PENDING     — QR generated, awaiting scan
CLAIMED     — Device scanned and claimed the pairing
COMPLETED   — Device fully registered
EXPIRED     — QR expired before use
CANCELLED   — Owner cancelled the pairing
```

---

## 17. Summary

The QR pairing system is designed around three principles:

1. **QR = temporary invitation, not identity.** The permanent identity is established through device registration and session authentication.
2. **Mutual verification.** Both owner and new device must confirm the pairing.
3. **Defense in depth.** Short expiration, single-use, owner approval, and verification codes provide layered protection against replay, screenshot, and interception attacks.
