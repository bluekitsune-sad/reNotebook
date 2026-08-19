# Device Management

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Specification

---

## 1. Device Identity

Every installation or browser session receives a unique device identity.

```text
deviceId: dev_7f2c...
```

This identity must remain stable for that installation unless the user explicitly resets or re-registers it.

The user-facing name is separate from the identity:

```text
deviceId: device_8f72...
name: "My Phone"
```

Device names should never be used as identity. Use a UUID-style `deviceId` for identity and a `display_name` for the user-facing label. The display name can change without changing the underlying identity.

Examples:

```text
John's iPhone
John's Laptop
Chrome on Work PC
Android Tablet
```

---

## 2. Device States

Devices have the following lifecycle states:

```text
pending
active
revoked
```

Future states may include:

```text
suspended
expired
```

### Pending

The device has been introduced via QR pairing but has not yet been approved by the owner.

### Active

The device is fully authorized to participate in workspace synchronization.

### Revoked

The device's authorization has been withdrawn. Sessions are invalidated, synchronization is rejected, and WebSocket connections are disconnected.

---

## 3. Device Ownership Model

The workspace owns the data. Devices are authorized replicas, not owners of notes.

The ownership hierarchy is:

```text
User
  └── Owner of Workspace
        │
        ├── Notes
        ├── Devices
        ├── Revisions
        ├── Conflicts
        └── Audit History
```

Devices do not own notes. A note created on a device does not belong to that device. If Device A creates a note and Device B later edits it, the note is not "owned" by either device — it belongs to the workspace.

Do not model ownership as:

```text
device.owner = true
```

Instead use:

```text
Workspace
 ├── owner identity
 ├── devices
 ├── permissions
 └── cryptographic authorization
```

If Device A disappears, ownership should not automatically disappear. The workspace and its data persist independently of any single device.

---

## 4. Device Revocation

### Online Revocation

When the owner revokes a device that is currently connected:

```text
device.status = revoked
    ↓
sessions invalidated
    ↓
sync rejected
    ↓
WebSocket disconnected
    ↓
future pairing credentials rejected
```

If the revoked device has an active WebSocket:

```text
server → device.revoked → client → clear credentials/session → disconnect
```

### Offline Revocation

A revoked device may still contain local data. Revocation cannot physically erase data from a device that is offline.

> Server revocation means the device can no longer participate in synchronization.

When the offline device eventually reconnects:

```text
sync request → DEVICE_REVOKED → local session invalidated
```

The device's uploads are rejected and its downloads are denied. The user should be informed.

A malicious user could intentionally keep a device offline. This is a fundamental limitation:

> You cannot remotely revoke knowledge that has already been downloaded.

You can prevent future synchronization, but you cannot guarantee that a previously authorized device has forgotten data unless the data was protected with revocable encryption keys and the device is online enough to receive revocation. This should be explicitly documented.

---

## 5. Lost Owner Device Recovery

This is an important edge case. If the original phone is lost and the user still has their laptop, the system must support recovery.

Do not make:

```text
Original device = permanent owner forever
```

because this creates a catastrophic single point of failure.

Possible recovery mechanism:

```text
Recovery credentials
+
authenticated account
+
approved device
```

The user should be able to promote an existing trusted device to owner/recovery authority. Ownership transfer should require strong confirmation:

```text
Transfer workspace ownership to:
John's Laptop

Warning:
The new device will become the workspace owner.

[ Confirm ]
```

The owner cannot simply be removed like an ordinary device. There should be either "Transfer ownership" or "Delete workspace" rather than "Remove owner."

---

## 6. Device Removal Options

When the owner removes a device, the UI should present explicit options:

```text
Remove device from workspace?

[ Revoke access only ]
[ Revoke + erase workspace data ]
[ Cancel ]
```

### Revoke Only

The device loses authentication and cannot synchronize or make new workspace changes. Local data remains on the device but becomes stale.

### Revoke + Erase

The device loses authentication and is instructed to remove workspace data from its local storage. Note that this cannot be guaranteed if the device is offline or modified.

Removing a device should not delete notes from the workspace. The operation revokes the device's authorization — it does not remove content that belongs to the workspace.

---

## 7. Device-Specific Hide vs Delete

These are completely different operations and must be implemented as such.

### Hide

```text
Note remains in workspace.
Device cannot access it.
Other devices can access it.
```

"Hidden from device" is a permission rule, not a UI flag. The server must enforce it. The synchronization layer should avoid sending unauthorized content to that device.

### Delete

```text
Note is deleted from workspace.
All authorized devices eventually see deletion.
```

Never implement "hide" as delete. If a note is hidden from a device and that device later synchronizes, the server should cause the client to remove or quarantine its local copy — but the canonical note remains in the workspace for all other authorized devices.

---

## 8. Device Name Changes

Device names can change without affecting the underlying device identity or authorization.

```text
device_id = UUID
display_name = "John's Laptop"
```

Renaming a device should create an audit event:

```text
device.updated
```

The device ID remains unchanged.

---

## 9. Device Management UI

### Device List

```text
Devices

✓ John's Phone
  Owner
  Last active: Now

✓ John's Laptop
  Active
  Last active: 2 minutes ago

✓ Work Computer
  Active
  Last active: Yesterday

[ Add Device ]
```

### Device Detail

Selecting a device:

```text
John's Laptop

Status:
Active

Permissions:
✓ Notes
✓ Create
✓ Edit
✓ Delete

Hidden notes:
3

[ Hide Notes ]
[ Revoke Device ]
```

### Note Visibility

On a note:

```text
Visibility

✓ Phone
✓ Personal Laptop
✗ Work Laptop

[ Save ]
```

The system should define whether hidden content means:

**Level 1** — Hide content but allow metadata, or:

**Level 2** — Hide both content and existence.

For a privacy-focused design, Level 2 is preferable. A hidden note should be invisible to the device — the device should not receive note content, revision content, conflict content, or metadata that reveals the note's existence.

---

## 10. Permission Precedence

Define explicit precedence:

```text
Workspace access
    ↓
Device active?
    ↓
User permission
    ↓
Note visibility
    ↓
Operation permission
```

A revoked device must override note-level permissions because a revoked device has no workspace access at all.
