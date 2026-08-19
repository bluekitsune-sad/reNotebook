# Security

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Specification

---

## 1. Security Model

The application has three major security layers:

```text
Authentication
     ↓
Device Authorization
     ↓
Workspace Permissions
```

A valid user account does not automatically mean every device has unlimited access. Every security decision happens on the server because any client can be modified or malicious.

---

## 2. Local Storage Security

### Mobile

```text
SQLite + OS secure storage for secrets
```

### Web

```text
IndexedDB + browser-managed secure authentication
```

Do not store long-lived secrets in plain `localStorage` unless there is a very deliberate security model. Long-lived device credentials should be stored in the platform's safest available mechanism:

- Mobile: secure storage / keychain / keystore
- Web: appropriate secure browser mechanisms and session architecture

---

## 3. Session Tokens

Access credentials should have appropriate expiration. Refresh credentials, if used, should be stored in the platform's safest available mechanism.

Sessions must be revocable. Each session represents an authenticated device/application session and should track:

- User association
- Device association
- Creation time
- Last used time
- Expiration time
- Active/revoked status

---

## 4. Device Logout

Logout should invalidate the local session but should not automatically delete local notes unless the product explicitly defines logout that way.

Account deletion is separate from logout and must define what happens to:

- Workspace ownership
- Notes
- Devices
- Audit history
- Pending changes

before implementation.

---

## 5. Authorization Checks

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

For every API endpoint:

```text
Who is making the request?
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

The server must never blindly trust client-supplied `deviceId`, `workspaceId`, or `noteId`. The server determines the authenticated user and then verifies all referenced resources.

---

## 6. Note Visibility Security

If a note is hidden from a device, that device should not receive:

- Note content
- Revision content
- Conflict content

unless explicitly allowed by the security model. The server must enforce access — never rely on the frontend hiding something for authorization.

Bad:

```text
GET /notes → returns everything → frontend hides private notes
```

Good:

```text
GET /notes → server filters based on device permissions
```

---

## 7. Metadata Leakage Prevention

Be careful not to leak:

- Note title
- Note existence
- updatedAt
- Author
- Revision count
- Conflict status

through APIs if the note itself is hidden. The visibility policy should explicitly define whether metadata is visible.

A device must not be able to determine "there are 15 hidden notes" unless the product intentionally exposes that information. Responses should avoid leaking hidden records through counts, pagination, error messages, timestamps, IDs, and search results.

A device should only receive conflict versions it is authorized to see. If a note is hidden from a device, its content must not appear in conflict payloads sent to that device.

Recommended initial behavior:

```text
hidden note = invisible
```

---

## 8. Audit Security

Audit logs should be append-only from the application perspective. Users should not be able to rewrite historical audit events. Audit history can itself contain sensitive content, so permissions must apply to history too. If a device cannot access a note, it should not receive its complete historical content.

---

## 9. QR Security

Never use permanent passwords, permanent refresh tokens, or full workspace secrets inside QR payloads.

Use:

```text
short-lived, single-use, random pairing secret
```

QR codes must be:

- Short-lived (1–5 minutes recommended expiration)
- Single-use
- Random
- Revocable
- Bound to a specific pairing request
- Invalidated after successful pairing
- Invalidated after expiration

The system should never rely on:

```text
QR = workspace_password
```

or:

```text
QR = permanent authentication token
```

If someone photographs an old QR code, it should not give them access later.

---

## 10. Brute Force Protection

Pairing endpoints should be rate-limited. Authentication endpoints should also use:

- Rate limiting
- Attempt tracking
- Temporary lockouts where appropriate

Pairing secrets must be sufficiently random. Do not use sequential numbers or timestamps as the secret.

---

## 11. Transport Security

Production synchronization must use encrypted transport:

```text
HTTPS
WSS
```

Never send authentication or note data over plain HTTP in production.

---

## 12. Logging Restrictions

Server logs must not contain:

- Passwords
- Access tokens
- Refresh tokens
- QR secrets
- Note content

unless explicitly required for debugging under controlled conditions. Do not log note content.

---

## 13. API Security Principle

Attempt the following — all must fail:

- Access another workspace
- Access hidden note via direct API request
- Access revoked device endpoints
- Modify another user's note
- Resolve unauthorized conflict
- Revoke another device
- Transfer ownership without authorization
- Spoof user ID
- Spoof device ID
- Spoof workspace ID
- Reuse revoked session
- Reuse expired QR
- Reuse consumed QR

The server must be authoritative for all security decisions.

---

## 14. Security Principle

Assume:

> Any client can be modified or malicious.

Therefore, all security decisions happen on the server. Never rely on:

- Frontend hiding something for authorization
- Client-side permission checks alone
- Device-supplied user IDs
- Permanent tokens in QR codes
