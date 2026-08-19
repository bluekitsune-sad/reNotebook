# Audit Log

**Project:** Synced Notepad
**Version:** 0.1
**Status:** Initial Specification

---

## 1. Purpose

The audit log answers the questions:

- **Who** performed the action?
- **What** action was performed?
- **When** did it happen?
- **Which device** was used?
- **Which revision** resulted from the action?

Every major mutation should produce an audit event. The audit system provides a complete activity history for the workspace.

Example:

```text
10:30
John's Phone created "Shopping"

10:32
John's Laptop edited "Shopping"

10:35
John's Phone renamed "Shopping" → "Shopping List"

10:40
John's Laptop attempted conflicting edit

10:41
Conflict resolved by John
```

---

## 2. Audit Event Structure

Each event should contain:

```js
{
  _id: ObjectId,
  eventId: String,
  workspaceId: ObjectId,
  userId: ObjectId,
  deviceId: String,
  eventType: String,
  entityType: String,
  entityId: String,
  metadata: Object,
  createdAt: Date
}
```

Example:

```js
{
  eventType: "note.updated",
  metadata: {
    revision: 8
  }
}
```

---

## 3. Audit Event Types

Initial event types:

```text
note.created
note.updated
note.deleted
note.restored

device.paired
device.renamed
device.revoked

note.visibility_changed

conflict.created
conflict.resolved
```

Every major operation should produce an audit event: note creation, editing, deletion, restoration, device pairing, device revocation, conflict creation, conflict resolution, and visibility changes.

---

## 4. Audit vs Revision History

These are related but different concepts. Keep them separate.

### Revision History

Answers:

> What did the note look like?

A revision records the content state of a note at a specific point in time. Revisions are immutable — never update historical revisions.

### Audit Log

Answers:

> Who did what, when, and from which device?

An audit log records the activity that happened — the action, the actor, the device, and the timestamp. A revision is data history. An audit log is activity history.

Example of revision history:

```text
Revision 5
Title: Ideas
Content: Build a new app

Revision 6
Title: Project Ideas
Content: Build a new app with React
```

Example of audit history:

```text
10:42
John's Phone
Changed: "Buy milk" → "Buy milk and eggs"

10:43
John's Laptop
Changed: "Buy milk" → "Buy milk and bread"

10:44
John
Resolved conflict
```

---

## 5. Audit Ordering

Audit events should have a server-side timestamp. Prefer also associating the server sequence where useful.

Do not rely on client timestamps to establish authoritative ordering. Device clocks can be incorrect — one device may report 10:00 while the server time is 10:15, and another device may have an entirely wrong clock.

The server should use its own timestamps for authoritative history. Client timestamps may be stored as auxiliary metadata but must not determine synchronization order.

---

## 6. Audit Privacy

Audit history can itself contain sensitive content. Therefore permissions must apply to history too.

If a device cannot access a note, it should not necessarily receive its complete historical content. Otherwise:

```text
Current note hidden
History reveals old note
```

would defeat the privacy model. The visibility rules that protect notes must also protect their historical revisions and audit records.

---

## 7. User-Visible Change History

The audit system should eventually support a user-facing history view:

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
```

---

## 8. Conflict Resolution Audit

Resolving a conflict generates an audit event:

```js
{
  action: "conflict.resolved",
  conflictId: "conflict_123",
  resolution: "merge",
  deviceId: "device_web"
}
```

Store resolution metadata including:

```text
resolvedBy
resolvedAt
resolutionType
```

---

## 9. Append-Only Invariant

Audit logs are append-only. The following must always hold:

- Historical audit events cannot be modified or deleted by users
- Every accepted mutation produces a corresponding audit event
- Audit events maintain server-side authoritative ordering
- Audit records should distinguish the actor (user) from the device used

The audit system provides the foundation for debugging, user trust, and accountability across all workspace activity.
