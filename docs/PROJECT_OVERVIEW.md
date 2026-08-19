# Synced Notepad — Project Overview

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Product & Technical Specification

---

## 1. What Is Synced Notepad?

Synced Notepad is a cross-platform notepad system consisting of:

- Desktop/mobile application
- Web application
- Offline storage
- Internet synchronization
- QR-based device/session pairing
- Device/workspace ownership
- Multi-device note synchronization
- Per-device note visibility controls
- Change history and audit logs
- Concurrent editing/conflict detection
- Conflict resolution
- Device/session management

The core idea is:

> Multiple devices should behave as one synchronized notepad while still retaining knowledge of which device/user created or modified every piece of content.

For example, a phone creates Note 1 and Note 2 while a web browser creates Note 3, Note 4, and Note 5. After synchronization, both devices see all five notes, and the system knows exactly which device created each one and which device last modified it.

---

## 2. Core Design Principle

The system is designed as **workspace-centric**:

```text
                 ┌──────────────────┐
                 │     Workspace    │
                 │                  │
                 │ Notes            │
                 │ Devices          │
                 │ Members/Owners   │
                 │ Change History   │
                 │ Sync State       │
                 └────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        ┌─────▼─────┐           ┌─────▼─────┐
        │   Phone   │           │    Web    │
        │   App     │           │   App     │
        └───────────┘           └───────────┘
              │                       │
              └───────────┬───────────┘
                          │
                    Synchronization
```

A workspace is the logical owner of the data. Devices are participants in that workspace. This is preferable to treating one physical device as the permanent owner of the data.

---

## 3. Terminology

### 3.1 Workspace

A workspace is the synchronized notepad environment. It contains:

- Notes
- Folders/notebooks
- Devices
- Device permissions
- Change history
- Sync metadata
- Conflict information

Example:

```text
Workspace: "My Notes"
```

### 3.2 Owner

The owner is the authority responsible for the workspace. The owner can:

- Add devices
- Remove devices
- Hide notes from devices
- Restore devices
- Revoke sessions
- Resolve certain administrative conflicts
- Change workspace settings

Ownership should be represented cryptographically where possible rather than merely by a database boolean.

### 3.3 Device

Every installation/browser session receives a unique device identity. Users should be able to rename devices.

Examples:

```text
John's iPhone
John's Laptop
Chrome on Work PC
Android Tablet
```

### 3.4 Session

A session represents a currently authenticated connection. A device may have multiple sessions.

For example:

```text
Laptop
 ├── Chrome session
 └── Firefox session
```

For security, browser profiles should generally be treated as separate devices unless the user explicitly links them.

### 3.5 Note

A note is the primary content object.

```json
{
  "note_id": "note_123",
  "title": "Shopping",
  "content": "Milk\nEggs\nBread",
  "created_by": "device_phone",
  "updated_by": "device_laptop"
}
```

### 3.6 Change

A change is an individual modification to the workspace. Examples:

```text
NOTE_CREATED
NOTE_UPDATED
NOTE_DELETED
NOTE_RESTORED
NOTE_HIDDEN
NOTE_UNHIDDEN
DEVICE_ADDED
DEVICE_REMOVED
DEVICE_REVOKED
CONFLICT_CREATED
CONFLICT_RESOLVED
```

---

## 4. The Core Promise

> A user's notes should be available across all authorized devices while preserving offline changes and never silently destroying conflicting work.

This promise drives every architectural decision:

1. **Local writes must work without internet.** Every local write creates a durable change.
2. **Synchronization must be resumable and idempotent.** Networks fail; the system handles this gracefully.
3. **The server is authoritative for shared state.** Historical changes must be preserved.
4. **Conflicts must never silently destroy user data.** Devices are authorized replicas, not owners of notes.
5. **QR codes authorize devices rather than transfer permanent credentials.**
6. **Device-specific note hiding must be enforced server-side.**

---

## 5. Final Product Model

The application is not fundamentally a note-taking app with a QR scanner. It is an **offline-first replicated data system** with:

- Note editor
- Device authorization
- QR pairing
- Change log
- Revision history
- Conflict resolution
- Audit trail

The note editor is the visible part. The synchronization system is the core product.
