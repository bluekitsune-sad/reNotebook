# Conflict Resolution

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Specification

---

## 1. Objective

Conflicts must be:

- Detected
- Preserved
- Explained
- Resolvable
- Auditable

Never silently discard one user's or device's work.

---

## 2. Conflict Definition

A conflict exists when:

```text
incoming.baseRevision < currentRevision
```

and the incoming change cannot safely be merged.

The server compares the revision from which each device edited. When a device submits a change whose `baseRevision` does not match the server's current revision for that note, a conflict is detected.

Example:

```text
Note revision = 10

Phone:  baseRevision = 10, content = "Buy milk and eggs"
Laptop: baseRevision = 10, content = "Buy milk and bread"

Phone arrives first → revision 10 → 11
Laptop arrives: baseRevision = 10, serverRevision = 11

Result: CONFLICT
```

The system must never use "last write wins" because one person's work would disappear.

---

## 3. Three-Way Merge Concept

For text notes, a three-way merge is preferable. The system compares:

```text
BASE
 /  \
A    B
```

It determines:

- What changed from BASE → A?
- What changed from BASE → B?

If the changes affect different parts of the content, they can potentially be merged automatically. If both changed the same section, the application must ask the user.

Example of automatic merge:

```text
Original:
Milk
Eggs
Bread

Phone adds:
Milk
Eggs
Bread
Apples

Laptop adds:
Milk
Eggs
Bread
Cheese

Merged result:
Milk
Eggs
Bread
Apples
Cheese
```

Example requiring user intervention:

```text
Original: Meeting at 5 PM
Phone:    Meeting at 6 PM
Laptop:   Meeting at 7 PM
```

Both changed the same line — the application should ask the user.

---

## 4. Conflict Categories

The system should distinguish between the following categories:

### Non-Conflicting Changes

Changes that can merge automatically. For example, one device changes the title while the other changes the content:

```text
Base:    title = Shopping,  content = Milk
Device A: title = Groceries, content = Milk
Device B: title = Shopping,  content = Milk and Eggs

Merged: title = Groceries, content = Milk and Eggs
```

### Same-Field Conflict

Both devices changed the same field. Requires user decision.

### Delete vs Edit

One device deletes a note while another edits it. Requires user decision. The system must not silently destroy the edit.

### Delete vs Delete

Both devices delete the same note. Usually safe to merge — the result is a single logical deletion.

### Rename Conflict

Both devices rename the same note to different names. Requires user decision — do not silently pick one.

### Folder/Notebook Conflict

If notebooks are supported, moving the same note to different folders also requires conflict handling. The synchronization engine should be entity/operation-aware rather than assuming only note text can conflict.

---

## 5. Conflict Detection Levels

The server should categorize conflicts into detection levels:

### Same Result

Both devices produced identical content. No user-facing conflict is needed — the system can accept one and treat the other as already applied.

### Auto-Mergeable

The changes affect different fields or different regions of the text. The system can automatically combine them without user intervention.

### Unmergeable

Both devices changed the same field or region. The system must present both versions to the user and request a resolution.

---

## 6. Conflict UI

The user should see both versions presented with device names.

Recommended UI:

```text
Conflict detected

Note: Shopping

Original:
Buy milk

John's Phone:
Buy milk and eggs

John's Laptop:
Buy milk and bread

Choose how to resolve:

[ Keep Phone Version ]
[ Keep Laptop Version ]
[ Merge ]
[ Keep Both as Copies ]
```

The system should preserve the conflicting versions until resolution.

---

## 7. Conflict Attribution

Every conflicting version must show:

```text
device name
user name
timestamp
```

Example:

```text
Created by:
John's Phone

Modified by:
John's Phone

Modified:
10:42 AM
```

and:

```text
Modified by:
John's Laptop

Modified:
10:43 AM
```

If multiple users exist, display the actor identity alongside the device name. The system should use `user display name + device name` where available.

---

## 8. Resolution Rules

### Keep Version

```text
Keep Version A
```

creates a new revision. Do not simply change the current note pointer without recording the resolution.

### Merge

The merged result becomes a new revision with parent revisions from both conflicting versions. This is useful for future audit/history features.

### Keep Both

Choosing "Keep Both" creates two separate notes:

```text
Shopping List
Shopping List — Web version
```

The exact naming can be made configurable later.

---

## 9. Resolution Creates New Revision

Conflict resolution should itself become a change. The selected resolution creates a new revision:

```text
Conflict created
    ↓
User selected merge
    ↓
Conflict resolved
    ↓
Final note revision created
```

Example:

```text
Revision 10
   │
   ├── Revision 11 — Phone
   │
   └── Revision 12 — Web
             │
          Conflict
             │
       Resolution revision 13
```

Never rewrite historical revisions. The audit trail should retain:

- Conflict participants
- Original versions
- Resolution
- Resolver
- Timestamp

---

## 10. Conflict Preservation Invariant

If the user chooses "Keep Phone Version," the laptop version should not be permanently deleted from history. Instead:

```text
Current version: Phone version
History: Laptop version
```

This makes accidental loss recoverable. When concurrent edits conflict:

- No user change is silently destroyed
- Version A is preserved
- Version B is preserved
- Resolution is recorded

---

## 11. Conflict Does Not Block Workspace Sync

If:

```text
Note A = conflict
Note B = normal
Note C = normal
```

the system should still synchronize B and C while leaving A unresolved. A single conflict must not prevent other notes from being synchronized.

---

## 12. Conflict Race

Two devices may attempt to resolve the same conflict. Only one resolution should become canonical. Use server-side conflict state checks:

```text
open → resolved
```

The second attempt receives:

```text
CONFLICT_ALREADY_RESOLVED
```

and then synchronizes the resulting revision.

---

## 13. Conflict Persistence

Conflicts should survive:

- App restart
- Device restart
- Offline period
- Browser refresh

They are durable records. If the user is offline, a conflict can still be reviewed. If the user selects "Keep mine," the client can create a local resolution mutation that is uploaded when online.

---

## 14. Future CRDT Option

For highly collaborative rich-text editing, eventually consider:

```text
CRDT
```

instead of revision-level conflict resolution.

Do not introduce CRDTs into the first implementation unless real-time collaborative editing becomes a core requirement. The current application is fundamentally:

```text
offline-first synchronization
```

rather than:

```text
Google Docs-style simultaneous editing
```

For version 1, use:

```text
Local database + append-only change log + entity revisions + base revision checks + conflict records
```

This is significantly easier to reason about than attempting a full CRDT architecture immediately.
