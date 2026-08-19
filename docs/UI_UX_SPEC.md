# UI_UX_SPEC.md

# Synced Notepad — UI/UX Specification

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Planning

---

## 1. Device Management UI

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

✗ Old Tablet
  Revoked
  Last active: 3 days ago

[ Add Device ]
```

### Device Detail (on selection)

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

Last synced: 2 minutes ago

[ Hide Notes ]
[ Revoke Device ]
```

### Device List Requirements:

```text
- Show device name (user-editable display name)
- Show device status (Active / Revoked / Pending)
- Show last seen timestamp
- Show "Owner" badge for owner device
- Allow adding new device (triggers QR pairing)
- Allow renaming device
- Allow revoking device
```

---

## 2. Note Visibility UI

### Per-note visibility controls:

```text
Visibility

✓ Phone
✓ Personal Laptop
✗ Work Laptop

[ Save ]
```

### Visibility states:

```text
✓ → visible to this device
✗ → hidden from this device
```

### Future option:

```text
Visible on:
  ○ All devices
  ● Selected devices
```

### Important behavior:

The visibility control is a permission rule, not just a UI flag. The server must enforce it. Hiding a note from a device prevents that device from receiving the note content through synchronization.

---

## 3. Conflict UI

### Conflict detected:

```text
┌──────────────────────────────────────┐
│ Conflict detected                    │
├──────────────────────────────────────┤
│ Shopping                             │
│                                      │
│ Original                             │
│ Buy milk                             │
│                                      │
│ 📱 John's Phone                      │
│ edited 2 minutes ago                 │
│ Buy milk and eggs                    │
│                                      │
│ 💻 John's Laptop                     │
│ edited 3 minutes ago                 │
│ Buy milk and bread                   │
│                                      │
│ [Keep Phone] [Keep Laptop]           │
│ [Merge] [Keep Both]                  │
└──────────────────────────────────────┘
```

### Attribution requirements:

Every conflicting version must show:

```text
device name
user name (if multi-user)
timestamp
```

Example:

```text
"John's Phone"
edited 2 minutes ago
```

### Action buttons:

```text
[Keep Phone Version]    → keeps Phone's version, creates new revision
[Keep Laptop Version]   → keeps Laptop's version, creates new revision
[Merge]                 → opens merge editor, creates new revision
[Keep Both]             → creates two separate notes
```

### Delete vs Edit conflict:

```text
┌──────────────────────────────────────┐
│ Conflict detected                    │
├──────────────────────────────────────┤
│ Shopping                             │
│                                      │
│ 📱 John's Phone                      │
│ deleted this note                    │
│                                      │
│ 💻 John's Laptop                     │
│ modified this note                   │
│ Buy milk and bread                   │
│                                      │
│ [Delete] [Restore Laptop Version]    │
│ [Keep Both]                          │
└──────────────────────────────────────┘
```

---

## 4. User-Visible Change History

```text
History

Today

10:42
John's Phone
Changed:
"Buy milk"
→
"Buy milk and eggs"

10:43
John's Laptop
Changed:
"Buy milk"
→
"Buy milk and bread"

10:44
John
Resolved conflict
Resolution: Merge

Yesterday

9:15
John's Phone
Created "Shopping"
```

### History displays:

```text
- timestamp
- device name
- action performed
- before/after values
- conflict participants
- resolution type
```

---

## 5. Undo Behavior

Undo creates a new revision rather than deleting history.

```text
Revision 15
  ↓
Undo
  ↓
Revision 16 (new change)
```

### Why:

```text
- Maintains auditability
- Works offline (becomes another queued change)
- Preserves history
- Safe for synchronization
```

### Offline undo:

```text
User undoes while offline
  ↓
New revision created locally
  ↓
Pending change queued
  ↓
Synced when online
```

---

## 6. Sync Status UI

### Status states:

```text
✓ Synced
  → All changes accepted
  → Cursor at latest server sequence
  → No pending changes

↻ Syncing...
  → Currently in sync cycle
  → Pulling or pushing changes

○ Offline
  → No network connection
  → Changes saved locally
  → Pending changes queued

! Conflict
  → One or more notes have unresolved conflicts
  → User action required

⚠ Sync failed
  → One or more changes permanently failed
  → User action may be required

🔒 Device revoked
  → This device has been removed from workspace
  → Cannot synchronize
  → Local data preserved
```

### Status display:

```text
● Synced           (green indicator)
● Syncing          (amber indicator)
● Offline          (gray indicator)
● Conflict         (orange indicator)
● Failed           (red indicator)
● Revoked          (red indicator with lock icon)
```

---

## 7. Pending Changes Indicator

```text
Offline
3 changes waiting to sync
```

### Expanded view:

```text
Pending:
• Created "Shopping"
• Edited "Ideas"
• Deleted "Old note"
```

### Purpose:

Provides confidence that edits were not lost. The user should always know the state of their unsynchronized work.

---

## 8. Offline Indicator

```text
┌──────────────────────────────────┐
│ ● Offline — changes saved        │
└──────────────────────────────────┘
```

### Expanded:

```text
Offline

Your notes are saved on this device.
3 changes will sync when you reconnect.

[ Sync when online ]
```

### Network recovery:

```text
● Offline → ● Syncing → ● Synced
```

---

## 9. QR Pairing UX

### Owner device (generating QR):

```text
Settings
  → Devices
  → Add Device
  → Show QR Code
```

Display:

```text
Scan this code with your new device.

QR Code displayed here

Expires in: 2:00

Verification code: 482 913
```

### New device (scanning QR):

```text
Scan QR
  → Verify workspace
  → Confirm
  → Pair
  → Initial sync
```

Display:

```text
Connect to:

"My Notes"

Owner:
John

You are adding:
Chrome on Windows

Verification code: 482 913

[ Cancel ]
[ Continue ]
```

### Owner approval:

```text
New device connection request

Chrome — Windows

[ Allow ] [ Reject ]
```

---

## 10. Core Screens

```text
Home
  → Note list
  → Sync status
  → Quick actions

Notes
  → Search
  → Sort
  → Filter

Note Editor
  → Title
  → Content
  → Metadata (device, timestamp)
  → Visibility controls

History
  → Timeline of changes
  → Device attribution
  → Conflict history

Conflicts
  → List of unresolved conflicts
  → Quick resolution actions

Devices
  → Device list
  → Device detail
  → Add/revoke device

Settings
  → Account
  → Workspace
  → Sync preferences
  → Data management
```

---

## 11. UX Principles Summary

| Principle | Implementation |
|-----------|---------------|
| Save confidence | "My note was saved" not "server accepted" |
| Offline is not loss | Local save ≠ server sync, shown separately |
| Failure clarity | "Saved on this device. Waiting for connection..." |
| Conflict transparency | Both versions shown with names and timestamps |
| Status visibility | Always show sync status, never leave user guessing |
| Pending confidence | Show count of unsynchronized changes |
| Consistent behavior | Same code path for online and offline editing |
