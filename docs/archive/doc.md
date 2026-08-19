# Synced Notepad — Initial Product & Technical Specification

**Status:** Initial Architecture / Product Specification
**Version:** 0.1
**Date:** 2026-08-10

---

# 1. Product Overview

The product is a cross-platform notepad system consisting of:

* Desktop/mobile application
* Web application
* Offline storage
* Internet synchronization
* QR-based device/session pairing
* Device/workspace ownership
* Multi-device note synchronization
* Per-device note visibility controls
* Change history and audit logs
* Concurrent editing/conflict detection
* Conflict resolution
* Device/session management

The core idea is:

> Multiple devices should behave as one synchronized notepad while still retaining knowledge of which device/user created or modified every piece of content.

For example:

### Device A — App

Creates:

* Note 1
* Note 2

### Device B — Web

Creates:

* Note 3
* Note 4
* Note 5

After synchronization:

**Device A:**

* Note 1
* Note 2
* Note 3
* Note 4
* Note 5

**Device B:**

* Note 1
* Note 2
* Note 3
* Note 4
* Note 5

However, the system should also know:

```text
Note 1
Created by: Phone
Created at: 10:20
Last modified by: Phone

Note 3
Created by: Web Browser
Created at: 10:32
Last modified by: Web Browser
```

The devices are therefore logically part of one workspace.

---

# 2. Core Design Principle

The system should be designed as:

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

A workspace is the logical owner of the data.

Devices are participants in that workspace.

This is preferable to treating one physical device as the permanent owner of the data.

---

# 3. Terminology

## 3.1 Workspace

A workspace is the synchronized notepad environment.

Example:

```text
Workspace:
"My Notes"
```

It contains:

* Notes
* Folders/notebooks
* Devices
* Device permissions
* Change history
* Sync metadata
* Conflict information

---

## 3.2 Owner

The owner is the authority responsible for the workspace.

The owner can:

* Add devices
* Remove devices
* Hide notes from devices
* Restore devices
* Revoke sessions
* Resolve certain administrative conflicts
* Change workspace settings

Ownership should be represented cryptographically where possible rather than merely by a database boolean.

---

## 3.3 Device

Every installation/browser session receives a unique device identity.

Example:

```text
device_id:
dev_7f2c...
```

Examples:

```text
John's iPhone
John's Laptop
Chrome on Work PC
Android Tablet
```

The user should be able to rename devices.

---

## 3.4 Session

A session represents a currently authenticated connection.

A device may have multiple sessions.

For example:

```text
Laptop
 ├── Chrome session
 └── Firefox session
```

Depending on implementation, these can either share the same device identity or be treated as separate devices.

For security, browser profiles should generally be treated as separate devices unless the user explicitly links them.

---

## 3.5 Note

A note is the primary content object.

Example:

```json
{
  "note_id": "note_123",
  "title": "Shopping",
  "content": "Milk\nEggs\nBread",
  "created_by": "device_phone",
  "updated_by": "device_laptop"
}
```

---

## 3.6 Change

A change is an individual modification to the workspace.

Examples:

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

# 4. Main User Experience

## 4.1 First Device

User installs the application.

The application generates:

```text
Workspace
Device identity
Cryptographic identity
Local database
```

The user becomes the initial workspace owner.

Example:

```text
Welcome to Notepad

[ Create Workspace ]

Workspace created.

Device:
John's iPhone

[ Add another device ]
```

---

# 5. QR Pairing

QR pairing is one of the most security-sensitive parts of the system.

The QR code should **not simply contain a permanent password or workspace secret in plain text**.

Instead, it should contain a short-lived pairing payload.

Example concept:

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

The exact format can change depending on the authentication architecture.

---

# 6. QR Pairing Flow

## Step 1 — Owner Opens Pairing

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

The application generates a temporary pairing session.

---

## Step 2 — New Device Scans QR

The new device scans the QR code.

It should display:

```text
Connect to:

"My Notes"

Owner:
John

You are adding:
Chrome on Windows

[ Cancel ]
[ Continue ]
```

The user should explicitly confirm.

---

## Step 3 — Mutual Verification

For stronger security, both devices should display a short verification code.

Example:

```text
Owner device:

Verification code:
482 913
```

New device:

```text
Verification code:
482 913
```

User confirms that the codes match.

This protects against some QR interception / man-in-the-middle scenarios.

---

## Step 4 — Device Registration

The new device receives its own device identity.

```text
device_id = dev_new_device
```

It is associated with the workspace.

The owner device receives:

```text
New device connected:

Chrome — Windows

[ Allow ]
[ Reject ]
```

For sensitive deployments, explicit owner approval should be required.

---

# 7. QR Code Security Requirements

QR codes must be:

* Short-lived
* Single-use
* Random
* Revocable
* Bound to a specific pairing request
* Invalidated after successful pairing
* Invalidated after expiration

Recommended expiration:

```text
1–5 minutes
```

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

# 8. QR Replay Attack

### Scenario

Owner generates QR.

Attacker photographs it.

Owner successfully pairs their laptop.

Attacker tries scanning the same QR later.

### Expected result

```text
Pairing expired or already completed.
```

No access should be granted.

---

# 9. QR Screenshot Attack

### Scenario

User screenshots a valid QR code.

Someone receives the screenshot.

### Requirement

The QR should expire quickly.

For higher security:

```text
QR
 ↓
Pairing session
 ↓
Mutual approval
 ↓
Device-specific key exchange
```

A screenshot should therefore have a very small attack window.

---

# 10. Device Ownership Model

Do not model ownership as:

```text
device.owner = true
```

alone.

Instead use:

```text
Workspace
 ├── owner identity
 ├── devices
 ├── permissions
 └── cryptographic authorization
```

Example:

```text
Workspace A

Owner:
    Device A

Devices:
    Device A
    Device B
    Device C
```

If Device A disappears, ownership should not automatically disappear.

---

# 11. Owner Device Lost

This is an important edge case.

### Scenario

The original phone is lost.

The user still has their laptop.

The system must support recovery.

Possible mechanism:

```text
Recovery credentials
+
authenticated account
+
approved device
```

The user should be able to promote an existing trusted device to owner/recovery authority.

Do not make:

```text
Original device = permanent owner forever
```

because this creates a catastrophic single point of failure.

---

# 12. Device Removal

Owner can remove a device:

```text
Settings
→ Devices
→ John's Old Laptop
→ Remove Device
```

Expected behavior:

```text
Old Laptop
    ↓
Authentication revoked
    ↓
Cannot synchronize
    ↓
Cannot make new workspace changes
```

The local data question should be explicit.

Recommended behavior:

```text
Remove device from workspace?

[ Revoke access only ]
[ Revoke + erase workspace data ]
[ Cancel ]
```

---

# 13. Device Hiding

The user specifically wants the ability to hide notes from a specific device.

This should be implemented carefully.

Example:

```text
Note: Private Journal

Visible to:
✓ Phone
✓ Personal Laptop
✗ Work Laptop
```

However:

> "Hidden from device" is a permission rule, not simply a UI flag.

The server must enforce it.

---

# 14. Important Security Rule for Hidden Notes

Suppose:

```text
Phone:
Can see Note A

Laptop:
Cannot see Note A
```

The laptop should not receive Note A from the server and merely hide it in the UI.

Otherwise someone could inspect:

* Network traffic
* Browser storage
* Local database
* Application memory
* Developer tools

and recover the supposedly hidden note.

The synchronization layer should therefore avoid sending unauthorized content to that device.

---

# 15. Hidden Note Synchronization

Example:

```text
Phone:
Note A
Note B
Note C

Laptop:
Note B
Note C
```

If Note A is hidden from Laptop:

```text
Phone creates Note A
        ↓
Server
        ↓
Laptop receives:
"Workspace changed"
        ↓
Laptop does NOT receive Note A
```

The laptop may receive only the minimum metadata necessary to maintain synchronization.

---

# 16. Important Metadata Leak

Even if content is hidden, metadata can leak information.

For example:

```text
Note count increased from 20 → 21
```

This reveals that a hidden note exists.

Therefore the system should define whether hidden content means:

### Level 1

Hide content but allow metadata.

or:

### Level 2

Hide both content and existence.

For a privacy-focused design, Level 2 is preferable.

---

# 17. Offline-First Architecture

The application should work without internet.

Each device maintains a local database.

Example:

```text
                 Local Database
                       │
        ┌──────────────┴──────────────┐
        │                             │
    Notes                         Changes
        │                             │
        └──────────────┬──────────────┘
                       │
                  Sync Engine
                       │
                  Internet
                       │
                    Server
```

The user should never need an internet connection merely to write a note.

---

# 18. Offline Creation

Example:

### Phone is offline

User creates:

```text
Note 1
Note 2
```

Local state:

```text
Pending changes:
2
```

The application should immediately show the notes.

When internet returns:

```text
Pending changes
       ↓
Upload
       ↓
Server
       ↓
Download missing changes
       ↓
Local database updated
```

---

# 19. Offline Web Application

The web version should be a Progressive Web App (PWA) or equivalent offline-capable application if offline functionality is required.

The browser needs:

* Local persistent storage
* Service worker/app shell
* Local database
* Sync queue

A simple website that depends entirely on server requests cannot provide true offline note editing.

---

# 20. Sync Model

A robust synchronization model should be based on changes/events rather than repeatedly uploading the entire database.

Example:

```text
Device A

Change 101:
Create Note A

Change 102:
Update Note A

Change 103:
Create Note B
```

Server stores the changes.

Device B asks:

```text
Give me changes after sequence 100
```

Server returns:

```text
101
102
103
```

---

# 21. Change/Event Structure

A conceptual change record:

```json
{
  "change_id": "chg_123",
  "workspace_id": "ws_123",
  "device_id": "dev_phone",
  "actor_id": "actor_123",
  "entity_type": "note",
  "entity_id": "note_456",
  "operation": "update",
  "timestamp": "2026-08-10T10:30:00Z",
  "base_revision": 14,
  "new_revision": 15,
  "payload": {},
  "client_sequence": 102
}
```

The exact schema can evolve.

---

# 22. Idempotency

This is critical.

Networks fail.

A device may send:

```text
Change 100
```

and receive no response.

The device does not know whether the server received it.

It may send Change 100 again.

The server must not create duplicate changes.

Therefore every change needs a globally unique ID.

Example:

```text
change_id = UUID
```

Server behavior:

```text
if change_id already exists:
    return existing result

else:
    process change
```

---

# 23. Sync Retry

Synchronization should be retry-safe.

Example:

```text
Upload
 ↓
Timeout
 ↓
Retry
 ↓
Server detects duplicate
 ↓
No duplicate note
```

Never assume:

```text
request timeout = server did not receive request
```

It may have succeeded.

---

# 24. Two Devices Creating Notes Simultaneously

This is the easiest conflict.

### Phone

Creates:

```text
Note A
```

### Laptop

Creates:

```text
Note B
```

Both are offline.

When they reconnect:

```text
Phone → Server
Laptop → Server
```

Expected final state:

```text
Note A
Note B
```

There is no conflict because they are different entities.

---

# 25. Two Devices Editing the Same Note

This is much more complicated.

Initial:

```text
Note:

Buy milk
```

Phone goes offline.

Phone changes:

```text
Buy milk and eggs
```

Laptop also goes offline.

Laptop changes:

```text
Buy milk and bread
```

Both reconnect.

The system must NOT simply do:

```text
last write wins
```

because one person's work disappears.

---

# 26. Conflict Detection

The server should compare the revision from which each device edited.

Initial:

```text
revision = 10
```

Phone:

```text
base_revision = 10
new content = "Buy milk and eggs"
```

Laptop:

```text
base_revision = 10
new content = "Buy milk and bread"
```

Phone arrives first:

```text
revision 10 → 11
```

Laptop arrives:

```text
base revision = 10
server revision = 11
```

Therefore:

```text
CONFLICT
```

---

# 27. Conflict Resolution UI

The user specifically requested that both changes be presented with names.

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

# 28. Conflict Attribution

Every conflicting version should display:

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

If multiple users exist, display the actor identity.

---

# 29. Conflict History

Conflict resolution should itself become a change.

Example:

```text
Conflict created
    ↓
User selected merge
    ↓
Conflict resolved
    ↓
Final note revision created
```

The audit trail should retain:

```text
Conflict participants
Original versions
Resolution
Resolver
Timestamp
```

---

# 30. Never Destroy Conflict Data Immediately

If the user chooses:

```text
Keep Phone Version
```

the laptop version should not necessarily be permanently deleted from history.

Instead:

```text
Current version:
Phone version

History:
Laptop version
```

This makes accidental loss recoverable.

---

# 31. Three-Way Merge

For text notes, a three-way merge is preferable.

Example:

```text
Original:

Milk
Eggs
Bread
```

Phone changes:

```text
Milk
Eggs
Bread
Apples
```

Laptop changes:

```text
Milk
Eggs
Bread
Cheese
```

These changes can potentially be merged automatically:

```text
Milk
Eggs
Bread
Apples
Cheese
```

But if both changed the same section:

```text
Original:
Meeting at 5 PM

Phone:
Meeting at 6 PM

Laptop:
Meeting at 7 PM
```

the application should ask the user.

---

# 32. Conflict Categories

The system should distinguish:

### Non-conflicting changes

Can merge automatically.

### Same-field conflict

Requires user decision.

### Delete vs edit

Requires user decision.

### Delete vs delete

Usually safe to merge.

### Move vs edit

Potentially mergeable.

### Permission conflict

Should be handled by authorization rules rather than ordinary note merging.

---

# 33. Delete vs Edit Scenario

Phone:

```text
Deletes Note A
```

Laptop offline:

```text
Edits Note A
```

Laptop reconnects later.

The system must not silently destroy the edit.

Show:

```text
Conflict:

Phone deleted this note.

Laptop modified this note.

[ Delete ]
[ Restore Laptop Version ]
[ Keep Both ]
```

---

# 34. Edit vs Restore Scenario

Example:

```text
Phone:
Restores old version

Laptop:
Edits current version
```

This should be treated as a version conflict.

---

# 35. Rename Conflict

Phone:

```text
Rename note:
Shopping
→
Shopping List
```

Laptop:

```text
Rename note:
Shopping
→
Groceries
```

Expected:

```text
Conflict detected

Shopping List
vs
Groceries
```

Do not silently pick one.

---

# 36. Folder/Notebook Conflicts

If notebooks are supported later:

```text
Phone:
Moves Note A → Work

Laptop:
Moves Note A → Personal
```

This also requires conflict handling.

The synchronization engine should therefore be entity/operation aware rather than assuming that only note text can conflict.

---

# 37. Audit Log

The system should maintain a history of important actions.

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

# 38. Audit Log Requirements

Each event should contain:

```text
event_id
workspace_id
actor_id
device_id
action
entity
timestamp
revision
```

Potentially:

```text
previous_value
new_value
```

for recoverable/versioned content.

---

# 39. Audit Log Privacy

Audit history can itself contain sensitive content.

Therefore permissions must apply to history too.

If a device cannot access a note, it should not necessarily receive its complete historical content.

Otherwise:

```text
Current note hidden
History reveals old note
```

would defeat the privacy model.

---

# 40. Device-Specific Visibility

A recommended model:

```text
Note
 ├── default_visibility
 ├── allow_devices
 └── deny_devices
```

However, a simpler implementation may use:

```text
visibility rules
```

at the workspace level.

Avoid embedding permanent device-specific rules directly into every note if the permission model may become more complex later.

---

# 41. Permission Precedence

Define explicit precedence.

Recommended:

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

Example:

```text
Device revoked
```

must override:

```text
Note allowed
```

because a revoked device has no workspace access.

---

# 42. Device-Specific Hide vs Delete

These are completely different operations.

### Hide

```text
Note remains in workspace.
Device cannot access it.
Other devices can access it.
```

### Delete

```text
Note is deleted from workspace.
All authorized devices eventually see deletion.
```

Never implement "hide" as delete.

---

# 43. Offline Device That Was Later Revoked

Important edge case.

Scenario:

```text
Laptop goes offline.

Owner revokes Laptop.

Laptop remains offline.

Laptop edits notes.
```

What happens?

The laptop cannot know it was revoked.

Therefore:

```text
Local changes can exist locally
BUT
they must not automatically regain workspace authority.
```

When the laptop reconnects:

```text
Server:
Device revoked.

Upload:
REJECTED / quarantine

Download:
Access denied
```

The user should be informed.

---

# 44. Offline Revoked Device Security

A malicious user could intentionally keep a device offline.

Therefore revocation cannot physically erase information already stored on that device.

This is a fundamental limitation:

> You cannot remotely revoke knowledge that has already been downloaded.

You can prevent future synchronization, but you cannot guarantee that a previously authorized device has forgotten data unless the data was protected with revocable encryption keys and the device is online enough to receive revocation.

Even then, screenshots, exports, copies, etc. cannot be remotely controlled.

This should be explicitly documented.

---

# 45. Device Name Changes

Device names should not be used as identity.

Bad:

```text
device = "John's Laptop"
```

Good:

```text
device_id = UUID
display_name = "John's Laptop"
```

The display name can change without changing the underlying identity.

---

# 46. Device Clock Problems

Never rely solely on device timestamps for ordering.

A device can have:

```text
Phone time:
10:00
```

while server time is:

```text
10:15
```

Another device may have an incorrect clock.

Therefore synchronization should use:

* Server sequence
* Revision numbers
* Logical clocks/version vectors
* Unique change IDs

Wall-clock timestamps should primarily be for display/audit purposes.

---

# 47. Ordering Changes

Consider:

```text
A:
Create note

B:
Edit note
```

If network delivery happens in reverse order:

```text
B arrives first
A arrives second
```

The server must still understand the causal relationship.

This is why the system should track:

```text
base_revision
```

and/or a stronger causal ordering mechanism such as:

```text
version vector
```

for advanced synchronization.

---

# 48. Recommended Initial Sync Strategy

For version 1, use:

```text
Local database
+
append-only change log
+
entity revisions
+
base revision checks
+
conflict records
```

This is significantly easier to reason about than attempting a full CRDT architecture immediately.

CRDTs may be considered later if real-time collaborative editing becomes a major requirement.

---

# 49. Real-Time vs Synchronization

The initial product does NOT need Google-Docs-style character-by-character collaboration.

There are two different requirements:

### Requirement A

Multiple devices synchronize notes.

### Requirement B

Multiple users edit the same note simultaneously in real time.

Requirement A is substantially easier.

The proposed system should initially target:

> Offline-first multi-device synchronization with explicit conflict resolution.

Real-time collaboration can be a later feature.

---

# 50. Sync States

The UI should expose a simple synchronization state.

Possible states:

```text
✓ Synced

↻ Syncing...

○ Offline

! Sync conflict

⚠ Sync failed

🔒 Device revoked
```

Do not make the user guess whether their changes have been uploaded.

---

# 51. Pending Changes

Example:

```text
Offline

3 changes waiting to sync
```

Clicking the status can show:

```text
Pending:
• Created "Shopping"
• Edited "Ideas"
• Deleted "Old note"
```

---

# 52. Sync Failure

If the network fails:

```text
Sync failed.

Your changes are safe on this device.

[ Retry ]
```

Never display:

```text
Save failed
```

if the note was successfully saved locally.

Local persistence and server synchronization should be separate concepts.

---

# 53. Data Safety Model

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

# 54. Initial Synchronization

When a new device joins:

```text
Pair
 ↓
Authenticate
 ↓
Receive workspace metadata
 ↓
Receive authorized notes
 ↓
Receive relevant history
 ↓
Build local database
 ↓
Mark synced
```

For large workspaces, use incremental synchronization rather than one massive request.

---

# 55. Large Workspace

Eventually the user may have:

```text
100,000 notes
```

Do not assume:

```text
download everything
```

The system should support:

* Pagination
* Incremental sync
* Compression
* Lazy loading
* Attachment streaming
* History pruning/archiving

---

# 56. Attachment Support

If images/files are added later, do not put large binary data directly inside every sync event.

Instead:

```text
Note
 ↓
Attachment metadata
 ↓
Object/file storage
```

Synchronization event:

```text
attachment_added
```

followed by a separate attachment download.

---

# 57. Encryption

At minimum:

```text
TLS in transit
+
encrypted server storage
+
secure local storage
```

For a privacy-oriented product, consider end-to-end encryption.

However, E2EE significantly complicates:

* Server-side search
* Conflict resolution
* Device recovery
* Key management
* Note visibility
* Audit logs
* Device revocation

Therefore encryption architecture should be decided before implementation.

---

# 58. E2EE Design Consideration

If the server can decrypt notes:

```text
Server sees note contents.
```

If the product promises true end-to-end encryption:

```text
Server should not be able to read note contents.
```

That changes the architecture substantially.

The product should not advertise "end-to-end encrypted" unless this has actually been implemented and independently reviewed.

---

# 59. QR + E2EE

If E2EE is eventually used, QR pairing could establish or transfer access to workspace encryption keys.

This requires particularly careful handling.

The QR should not expose a permanent master key through a long-lived QR code.

Instead:

```text
Short-lived pairing
+
authenticated key exchange
+
device key registration
+
encrypted workspace key provisioning
```

---

# 60. Device Key Model

A device can generate:

```text
private_key
public_key
```

The private key stays on the device.

The server stores the public key.

Example:

```text
Device A
private key ── stays local

public key ──→ server

Device B
private key ── stays local

public key ──→ server
```

This gives the architecture a foundation for stronger device authentication.

---

# 61. Account Authentication vs Device Authentication

These should be separate concepts.

### Account

Answers:

```text
Who is the user?
```

### Device identity

Answers:

```text
Which installation is making this request?
```

### Workspace permission

Answers:

```text
What is this device allowed to do?
```

This separation is important for audit logs.

---

# 62. Actor Identity

Audit records should ideally distinguish:

```text
Actor:
John

Device:
John's Laptop
```

rather than merely:

```text
Changed by:
John's Laptop
```

This becomes important if one user has multiple devices.

---

# 63. Future Multi-User Support

Even if version 1 is mostly personal use, design the data model so that it can eventually support:

```text
Workspace
 ├── Owner
 ├── User A
 ├── User B
 ├── Device A
 ├── Device B
 └── Device C
```

Then the same synchronization architecture can support family/team notebooks later.

---

# 64. Ownership Transfer

Owner should be able to transfer ownership.

Example:

```text
Transfer workspace ownership to:

John's Laptop

Warning:
The new device will become the workspace owner.

[ Confirm ]
```

Require strong confirmation.

Potentially require:

```text
Current owner authentication
+
new owner confirmation
```

---

# 65. Owner Removal

The owner cannot simply be removed like an ordinary device.

There should be:

```text
Transfer ownership
OR
Delete workspace
```

rather than:

```text
Remove owner
```

---

# 66. Workspace Deletion

Workspace deletion should be deliberately difficult.

Recommended:

```text
Delete Workspace

This will delete the workspace and eventually
remove synchronization access from all devices.

Type workspace name to confirm:

MY NOTES

[ Delete permanently ]
```

For important data, consider a recovery period.

---

# 67. Sync Edge Cases — Required Test Matrix

The following cases should be tested before release.

---

## Test 1 — Basic Creation

Device A creates one note.

Expected:

```text
A = note
Server = note
```

Device B syncs.

Expected:

```text
B = note
```

---

## Test 2 — Offline Creation

A offline:

```text
Create A
Create B
```

B offline:

```text
Create C
Create D
Create E
```

Both reconnect.

Expected:

```text
A:
A B C D E

B:
A B C D E
```

---

## Test 3 — Simultaneous Creation

Two devices create notes at exactly the same time.

Expected:

```text
Both notes survive.
```

---

## Test 4 — Same Note, Different Changes

Both edit the same note offline.

Expected:

```text
Conflict detected.
Both versions preserved.
User chooses resolution.
```

---

## Test 5 — Same Note, Same Content

Both devices make the same logical change.

Expected:

```text
No unnecessary conflict if the resulting content is identical.
```

---

## Test 6 — Delete vs Edit

A deletes.

B edits.

Expected:

```text
Conflict.
```

---

## Test 7 — Delete vs Delete

Both delete.

Expected:

```text
One logical deletion.
No duplicate conflict required.
```

---

## Test 8 — Rename vs Rename

Different names.

Expected:

```text
Conflict.
```

---

## Test 9 — Edit While Offline, Device Revoked

Expected:

```text
Local changes remain visible locally.

Server refuses synchronization after revocation.

User is notified.
```

---

## Test 10 — QR Expiration

Generate QR.

Wait until expiration.

Scan.

Expected:

```text
Rejected.
```

---

## Test 11 — QR Replay

Pair Device B.

Scan same QR again.

Expected:

```text
Rejected.
```

---

## Test 12 — QR Screenshot

Screenshot QR.

Wait past expiration.

Expected:

```text
Rejected.
```

---

## Test 13 — QR Interception

Another device scans QR before intended device.

Expected:

```text
Owner approval / verification prevents unauthorized pairing.
```

---

## Test 14 — Device Removal

Owner removes Device B.

Expected:

```text
B can no longer sync.
```

---

## Test 15 — Removed Device Offline

B is offline when removed.

B edits notes.

Later reconnects.

Expected:

```text
Changes rejected/quarantined.
Workspace is not modified by unauthorized device.
```

---

## Test 16 — Hidden Note

Phone can see Note A.

Laptop cannot.

Expected:

```text
Phone:
Note A visible.

Laptop:
Note A unavailable.
```

---

## Test 17 — Hidden Note Created Offline

Phone creates hidden note while offline.

Laptop synchronizes later.

Expected:

```text
Laptop cannot obtain the hidden note content.
```

---

## Test 18 — Unhide Note

Owner changes:

```text
Laptop:
hidden → visible
```

Expected:

```text
Laptop receives note after authorization.
```

---

## Test 19 — Hide Existing Note

Owner hides an existing note from Laptop.

Expected:

```text
Laptop loses access according to privacy model.
```

---

## Test 20 — History Privacy

Laptop cannot access hidden Note A.

Expected:

```text
Laptop cannot retrieve Note A's historical content either.
```

---

## Test 21 — Duplicate Upload

Device sends same change twice.

Expected:

```text
Only one logical change.
```

---

## Test 22 — Timeout After Server Acceptance

Server accepts request.

Network drops before response.

Client retries.

Expected:

```text
No duplicate operation.
```

---

## Test 23 — Out-of-Order Changes

Changes arrive in a different order from creation.

Expected:

```text
Causal ordering remains correct.
```

---

## Test 24 — Device Clock Incorrect

Device clock is several hours wrong.

Expected:

```text
Synchronization remains correct.
```

---

## Test 25 — Server Restart

Server restarts during synchronization.

Expected:

```text
No data duplication.
No lost acknowledged changes.
Clients retry safely.
```

---

## Test 26 — Client Crash

App crashes immediately after local save.

Expected:

```text
Note remains locally.
Pending change remains recoverable.
```

---

## Test 27 — Client Crash During Upload

App crashes during upload.

Expected:

```text
Retry is safe.
No duplicate note/change.
```

---

## Test 28 — Network Changes

Switch:

```text
Wi-Fi
→ mobile
→ offline
→ Wi-Fi
```

Expected:

```text
Sync resumes automatically.
```

---

## Test 29 — Server Unavailable

Expected:

```text
Local editing continues.
Pending changes remain queued.
Sync resumes later.
```

---

## Test 30 — Massive Offline Queue

Create thousands of changes offline.

Expected:

```text
Application remains usable.
Queue survives restart.
Sync processes changes incrementally.
```

---

# 68. Critical Security Tests

The following must also be tested.

### Authentication bypass

Attempt to access another workspace.

Expected:

```text
403 / unauthorized
```

---

### Device ID spoofing

Attempt to pretend to be another registered device.

Expected:

```text
Rejected.
```

---

### Revoked token

Use an old authentication token after revocation.

Expected:

```text
Rejected.
```

---

### Expired QR

Expected:

```text
Rejected.
```

---

### Reused QR

Expected:

```text
Rejected.
```

---

### Hidden note API access

Even if the UI hides a note, directly request its API endpoint.

Expected:

```text
Authorization failure.
```

This is an extremely important test.

---

# 69. API Security Principle

Never rely on:

```text
frontend hiding something
```

for authorization.

Bad:

```text
GET /notes
→ returns everything
→ frontend hides private notes
```

Good:

```text
GET /notes
→ server filters based on device permissions
```

The server must be authoritative.

---

# 70. Data Model — Initial Concept

Possible database entities:

```text
users
workspaces
workspace_members
devices
sessions
notes
note_revisions
changes
conflicts
visibility_rules
audit_events
sync_cursors
pairing_sessions
```

---

# 71. Notes

Conceptually:

```text
notes

id
workspace_id
title
content
current_revision
created_by
created_at
updated_by
updated_at
deleted_at
```

---

# 72. Note Revisions

```text
note_revisions

id
note_id
revision_number
content
created_by
created_at
parent_revision
```

This supports:

* History
* Undo
* Conflict resolution
* Recovery

---

# 73. Changes

```text
changes

id
workspace_id
device_id
actor_id
entity_type
entity_id
operation
base_revision
result_revision
payload
created_at
```

---

# 74. Conflicts

```text
conflicts

id
workspace_id
entity_id
base_revision
version_a
version_b
status
resolved_by
resolved_at
resolution
```

Possible status:

```text
OPEN
RESOLVED
DISMISSED
```

---

# 75. Devices

```text
devices

id
workspace_id
actor_id
display_name
platform
created_at
last_seen_at
status
public_key
```

Status:

```text
ACTIVE
REVOKED
PENDING
```

---

# 76. Pairing Sessions

```text
pairing_sessions

id
workspace_id
created_by_device
nonce
expires_at
used_at
status
```

Status:

```text
PENDING
APPROVED
COMPLETED
EXPIRED
CANCELLED
```

---

# 77. Sync Cursor

Every device needs to know what it has processed.

Example:

```text
device:
dev_123

last_server_sequence:
10982
```

Then:

```text
GET changes after 10982
```

The server returns later changes.

---

# 78. Important Cursor Rule

A client should only advance its cursor after successfully applying the corresponding changes.

Bad:

```text
download changes
advance cursor
crash before applying
```

This can cause data loss.

Good:

```text
download
 ↓
validate
 ↓
apply transactionally
 ↓
commit
 ↓
advance cursor
```

---

# 79. Transactional Sync

Applying a group of changes should ideally be atomic.

Example:

```text
BEGIN TRANSACTION

apply change 100
apply change 101
apply change 102
update sync cursor

COMMIT
```

If something fails:

```text
ROLLBACK
```

Then retry safely.

---

# 80. Sync Protocol

Conceptual flow:

```text
Client
  │
  │ Authenticate
  ▼
Server
  │
  │ Determine permissions
  ▼
Server
  │
  │ Return changes
  ▼
Client
  │
  │ Apply changes
  ▼
Client
  │
  │ Upload local changes
  ▼
Server
  │
  │ Validate revisions
  ▼
Accepted / Conflict
```

---

# 81. Recommended Sync Endpoint Concepts

Possible APIs:

```text
POST /pairing/start
POST /pairing/complete

GET  /workspace
GET  /sync
POST /sync

GET  /devices
POST /devices/revoke

GET  /notes
POST /notes

GET  /notes/:id/history

GET  /conflicts
POST /conflicts/:id/resolve
```

These are conceptual and should be refined during API design.

---

# 82. Conflict Response

The server should be able to respond with something conceptually like:

```json
{
  "status": "conflict",
  "entity_id": "note_123",
  "base_revision": 10,
  "server_revision": 11,
  "client_version": {},
  "server_version": {}
}
```

The client can then present the conflict UI.

---

# 83. Conflict Resolution Should Create a New Revision

Do not mutate historical revisions.

Instead:

```text
Revision 10
     │
     ├── Revision 11 — Phone
     │
     └── Revision 12 — Laptop
              │
           conflict
              │
        Resolution revision
              │
             13
```

This creates a reliable history.

---

# 84. Audit Log vs Revision History

These are related but different.

### Revision history

Answers:

> What did the note look like?

### Audit log

Answers:

> Who did what, when, and from which device?

Keep the concepts separate.

---

# 85. UI — Device Management

Example:

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

---

# 86. UI — Note Visibility

On a note:

```text
Visibility

✓ Phone
✓ Personal Laptop
✗ Work Laptop

[ Save ]
```

Potential future option:

```text
Visible on:
All devices
Selected devices
```

---

# 87. UI — Conflict

Recommended visual design:

```text
┌─────────────────────────────┐
│ Conflict detected           │
├─────────────────────────────┤
│ Shopping                    │
│                             │
│ Original                    │
│ Buy milk                    │
│                             │
│ 📱 John's Phone             │
│ Buy milk and eggs           │
│                             │
│ 💻 John's Laptop            │
│ Buy milk and bread          │
│                             │
│ [Phone] [Laptop] [Merge]    │
│ [Keep Both]                 │
└─────────────────────────────┘
```

---

# 88. User-Visible Change History

Example:

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

# 89. Undo

Undo should ideally create another revision rather than deleting history.

Example:

```text
Revision 15
   ↓
Undo
   ↓
Revision 16
```

This maintains auditability.

---

# 90. Offline Undo

Undo must also work offline.

It becomes another queued change.

---

# 91. Important Edge Case — Repeated Offline Editing

A device might do:

```text
Edit A
Edit B
Edit C
Edit D
```

while offline.

Do not necessarily send four complete copies of the entire note.

Depending on the editor architecture, changes can potentially be compacted.

However, for version 1, correctness should take priority over aggressive optimization.

---

# 92. Important Edge Case — Rapid Device Switching

User:

```text
Phone → Laptop → Phone → Tablet
```

within seconds.

All devices should converge to the same workspace state.

This should be part of automated testing.

---

# 93. Important Edge Case — Two Devices Reconnect at Different Times

```text
Phone offline for 3 days
Laptop online
Tablet online
```

Phone reconnects later.

Expected:

```text
Phone downloads all relevant changes
and resolves/reports conflicts where necessary.
```

Do not assume devices are continuously connected.

---

# 94. Important Edge Case — Very Old Device

A device may be offline for months.

The server may have compacted old change history.

Therefore the sync protocol needs a fallback:

```text
incremental sync unavailable
        ↓
full authorized snapshot
        ↓
rebuild local state
        ↓
resume incremental sync
```

---

# 95. Snapshot + Change Log Architecture

A scalable design is:

```text
Current Workspace Snapshot
+
Recent Change Log
```

Example:

```text
Snapshot revision:
100,000

Change log:
100,001
100,002
...
100,500
```

A very old device can download:

```text
snapshot 100,000
+
changes 100,001–100,500
```

instead of downloading the entire history.

---

# 96. Server as Source of Truth

The server should be the authoritative synchronization authority.

However:

> The server should not be the user's only source of truth for unsynchronized local work.

Therefore:

```text
Local database
+
Server workspace
```

both matter.

The client owns its unsynced local changes until they are accepted.

---

# 97. Data Loss Prevention

Before destructive operations:

```text
Delete
Overwrite
Resolve conflict
Remove device
Transfer ownership
```

the system should ensure the operation is represented in durable state.

For critical actions, consider requiring explicit confirmation.

---

# 98. Export / Backup

A notepad application should eventually provide:

```text
Export workspace
```

Formats:

```text
JSON
Markdown
TXT
ZIP
```

This is also useful as an emergency recovery mechanism.

---

# 99. Import

Import should create normal workspace changes rather than bypassing the synchronization engine.

For example:

```text
Import 50 notes
```

should produce an understandable audit event:

```text
Imported 50 notes
by John's Laptop
```

---

# 100. Testing Strategy

Testing should happen at multiple levels.

## Unit Tests

Test:

* Revision calculations
* Conflict detection
* Permission rules
* QR expiration
* QR replay prevention
* Change deduplication
* Sync cursor behavior
* Merge logic

---

## Integration Tests

Test:

```text
Client ↔ Server
Client ↔ Client via Server
```

including:

* Offline mode
* Reconnect
* Concurrent changes
* Revocation
* Device hiding
* Conflict resolution

---

## End-to-End Tests

Automate scenarios involving:

```text
Phone simulator
Browser
Backend
Database
```

where possible.

---

# 101. Property-Based Sync Testing

This is strongly recommended.

Generate random operations:

```text
create
edit
delete
restore
rename
hide
unhide
```

across multiple simulated devices.

Randomly:

```text
disconnect
reconnect
delay
duplicate
reorder
drop network responses
```

Then verify:

> All authorized devices eventually converge to the same valid state.

This is one of the most valuable tests for this product.

---

# 102. Convergence Invariant

For any set of authorized devices:

```text
After all pending changes are synchronized
and all conflicts are resolved:

State(Device A)
=
State(Device B)
=
State(Device C)
```

except where:

```text
device-specific visibility rules
```

intentionally produce different views.

This should be a fundamental automated test invariant.

---

# 103. Conflict Preservation Invariant

When concurrent edits conflict:

```text
No user change is silently destroyed.
```

At minimum:

```text
Version A preserved
Version B preserved
Resolution recorded
```

---

# 104. Idempotency Invariant

Applying the same change twice should produce the same logical result as applying it once.

```text
apply(change)
apply(change)
```

must equal:

```text
apply(change)
```

---

# 105. Authorization Invariant

For every API endpoint:

```text
Unauthorized device
```

must never be able to access:

```text
workspace data
hidden note data
history
conflict versions
device management
```

unless explicitly authorized.

---

# 106. QR Security Invariant

A QR pairing code should:

```text
expire
be single-use
be bound to a pairing session
require appropriate authorization
```

A copied old QR should not provide indefinite access.

---

# 107. Recommended MVP

Do NOT build every possible feature at once.

The first production-quality MVP should contain:

### Core

* Workspace
* Notes
* Local persistence
* Web app
* App
* Authentication
* Device identity
* QR pairing
* Basic device management
* Server synchronization
* Offline queue
* Change IDs
* Revision numbers
* Conflict detection
* Basic conflict resolution
* Audit metadata

---

# 108. Phase 2

Add:

* Rich conflict merge UI
* Note history
* Restore old revisions
* Device-specific visibility
* Advanced audit logs
* Export/import
* Better recovery
* Push notifications
* Background sync

---

# 109. Phase 3

Potentially add:

* Real-time collaboration
* CRDT-based editing
* End-to-end encryption
* Attachments
* Shared workspaces
* Multiple users
* Roles/permissions
* Advanced search
* Cross-workspace features

---

# 110. Recommended Initial Architecture

A practical architecture could look like:

```text
                    ┌──────────────────┐
                    │                  │
                    │    Web Client    │
                    │                  │
                    └────────┬─────────┘
                             │
                             │ HTTPS/WebSocket
                             │
                    ┌────────▼─────────┐
                    │                  │
                    │   API / Sync     │
                    │     Server       │
                    │                  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐  ┌─────▼─────┐ ┌────▼─────┐
        │ Workspace │  │ Change Log │ │  Auth    │
        │ Database  │  │ / Sync     │ │ / Device │
        └───────────┘  └────────────┘ └──────────┘
              ▲
              │
              │
        ┌─────┴─────┐
        │   App     │
        │  Client   │
        └───────────┘
```

---

# 111. Client Architecture

Each client should conceptually contain:

```text
UI
 │
 ├── Note Editor
 ├── Note List
 ├── Device Manager
 ├── Conflict UI
 └── Sync Status
 │
 ▼
Application State
 │
 ▼
Local Database
 │
 ▼
Sync Engine
 │
 ▼
Network Layer
```

The UI should not directly manipulate the server.

---

# 112. Local Database

The local database should contain:

```text
notes
revisions
pending_changes
devices
sync_state
conflicts
permissions/cache
```

For the web, use a browser-supported persistent database such as IndexedDB through an appropriate abstraction.

For native applications, use a durable embedded database appropriate to the platform.

---

# 113. Critical Architectural Rule

All note modifications should pass through the same local mutation pipeline:

```text
User edits note
      ↓
Local transaction
      ↓
Update note
      ↓
Create change
      ↓
Commit
      ↓
UI updates immediately
      ↓
Sync engine uploads later
```

Do not create one code path for online editing and another for offline editing.

That creates synchronization bugs.

---

# 114. Online Mode

Even when online, prefer:

```text
User action
 ↓
Local save
 ↓
UI immediately updates
 ↓
Background sync
```

rather than:

```text
User action
 ↓
Wait for server
 ↓
Update UI
```

This provides a consistent offline-first architecture.

---

# 115. Important UX Principle

The user should feel:

> "My note was saved."

not:

> "The server accepted my note."

The synchronization status can be displayed separately.

---

# 116. Failure UX

Bad:

```text
ERROR 500
```

Good:

```text
Saved on this device.

Waiting for connection...
```

If conflict occurs:

```text
Saved, but another device changed this note.

Review conflict
```

---

# 117. Recommended First Technical Milestone

Before building the polished UI, implement a synchronization simulator.

Simulate:

```text
Device A
Device B
Device C
Server
```

Then test:

```text
A creates
B creates
C edits
A deletes
B edits
C goes offline
A reconnects
B reconnects
C reconnects
```

The simulator should be able to introduce:

```text
delays
duplicates
reordering
network failures
```

If synchronization works correctly here, the UI implementation becomes much safer.

---

# 118. Definition of Done for Sync MVP

The synchronization engine should not be considered complete until it passes:

### Functional

* [ ] Create offline
* [ ] Edit offline
* [ ] Delete offline
* [ ] Sync after reconnect
* [ ] Multiple devices
* [ ] Concurrent creation
* [ ] Concurrent editing
* [ ] Conflict detection
* [ ] Conflict resolution
* [ ] History preservation
* [ ] Device revocation
* [ ] Device-specific visibility

### Reliability

* [ ] Duplicate request handling
* [ ] Retry handling
* [ ] Crash recovery
* [ ] Server restart recovery
* [ ] Offline queue persistence
* [ ] Out-of-order changes
* [ ] Long offline periods

### Security

* [ ] QR expiration
* [ ] QR single-use
* [ ] QR replay protection
* [ ] Device authentication
* [ ] Revocation
* [ ] Server-side authorization
* [ ] Hidden-note API protection
* [ ] Audit attribution

### Convergence

* [ ] Authorized devices converge
* [ ] Hidden data remains hidden
* [ ] Conflicts preserve both versions
* [ ] Duplicate operations remain idempotent

---

# 119. Biggest Risks in the Idea

The concept is viable, but the difficult parts are **not the note editor or QR code**.

The major engineering risks are:

## 1. Synchronization correctness

This is the biggest risk.

A system that appears to work for simple cases can still lose data during:

```text
offline editing
+
concurrent modification
+
network failure
+
retry
```

---

## 2. Conflict handling

"Last write wins" is easy but dangerous for your requirements.

Your requirement that both changes be shown means the architecture must explicitly support versioning and conflict records.

---

## 3. Device-specific privacy

Hiding a note from one device cannot merely be a frontend feature.

The server and synchronization layer must enforce it.

---

## 4. QR security

QR pairing is convenient, but a QR code is effectively an authorization mechanism.

It must therefore be:

```text
short-lived
single-use
authenticated
revocable
```

---

## 5. Ownership recovery

If ownership depends entirely on one physical device, losing that device can permanently break account/workspace management.

Recovery must be designed from the beginning.

---

## 6. Offline revocation

A device that is already offline cannot be remotely forced to forget information.

This limitation must be accepted and clearly represented in the security model.

---

# 120. Final Recommended Product Model

The cleanest mental model for this application is:

```text
                  WORKSPACE
                      │
        ┌─────────────┼─────────────┐
        │             │             │
      Notes         Devices       History
        │             │             │
        │             │             │
        └─────────────┼─────────────┘
                      │
                 Sync Engine
                      │
          ┌───────────┼───────────┐
          │           │           │
        Phone       Laptop      Tablet
          │           │           │
       Offline      Online      Offline
          │           │           │
          └───────────┼───────────┘
                      │
                 Synchronize
                      │
                Conflict?
                 /       \
               No         Yes
               │           │
             Merge      Preserve
               │        both versions
               │           │
               └─────┬─────┘
                     │
                User resolves
                     │
                New revision
```

The fundamental guarantees should be:

> **1. Never silently lose a locally saved change.**

> **2. Never trust the client to enforce permissions.**

> **3. Never use a permanent QR code as authentication.**

> **4. Never use wall-clock time alone to determine synchronization order.**

> **5. Never overwrite a concurrent edit without preserving the other version.**

> **6. Every important change should have an actor, device, timestamp, and revision context.**

> **7. Authorized devices should eventually converge to the same workspace state, except where intentionally different visibility rules apply.**

> **8. Offline mode should be a normal operating mode, not an error state.**

---

# 121. Initial Product Definition

In one sentence:

> **A privacy-aware, offline-first, multi-device notepad where devices join a shared workspace through secure QR pairing, synchronize automatically when connected, preserve complete change attribution, support device-specific visibility, and never silently discard conflicting edits.**

That is a solid foundation for the product.

The next implementation document should be a **Sync Protocol Specification** defining the exact database schema, change/event format, revision algorithm, sync API, conflict algorithm, QR handshake, device authentication, and state machines. That should be written before substantial UI development because those rules become the foundation shared by the mobile/desktop app and web client.
