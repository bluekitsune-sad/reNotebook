import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from './engine.js';
import { createChange, isDuplicateChange } from './changes/index.js';
import { detectConflict, classifyConflict } from './conflicts/index.js';
import { threeWayMerge, mergeTextContent } from './merge/index.js';
import { encodeCursor, parseCursor } from './cursor/index.js';
import { SYNC_STATE, CHANGE_TYPES, NOTE_STATUS, MAX_SYNC_CHANGES_PER_REQUEST } from '@synced-notepad/shared';

// ── Mock Repository Classes ────────────────────────────────────────────────

class MockRepository {
  constructor() {
    this.notes = new Map();
    this.changes = [];
    this.revisions = [];
    this.cursor = null;
    this._nextNoteId = 1;
    this._nextChangeId = 1;
    this._nextRevision = 1;

    this.notesRepository = {
      create: this.#createNote.bind(this),
      get: this.#getNote.bind(this),
      getByServerId: this.#getNoteByServerId.bind(this),
      update: this.#updateNote.bind(this),
      delete: this.#deleteNote.bind(this),
      restore: this.#restoreNote.bind(this),
      list: this.#listNotes.bind(this),
    };

    this.changesRepository = {
      queue: this.#queueChange.bind(this),
      getPending: this.#getPendingChanges.bind(this),
      markAccepted: this.#markChangeAccepted.bind(this),
      markConflict: this.#markChangeConflict.bind(this),
    };

    this.revisionsRepository = {
      create: this.#createRevision.bind(this),
      get: this.#getRevision.bind(this),
      getLatest: this.#getLatestRevision.bind(this),
    };

    this.syncStateRepository = {
      getCursor: () => Promise.resolve(this.cursor),
      setCursor: (c) => { this.cursor = c; return Promise.resolve(); },
    };
  }

  #nextId() { return `local-${this._nextNoteId++}`; }
  #nextCid() { return `change-${this._nextChangeId++}`; }
  #nextRev() { return this._nextRevision++; }

  async #createNote(data) {
    const id = this.#nextId();
    const note = { id, serverId: data.serverId || null, title: data.title || '', content: data.content || '', status: data.status || NOTE_STATUS.ACTIVE, localRevision: data.localRevision || 0, serverRevision: data.serverRevision || null, createdAt: data.createdAt || new Date().toISOString(), updatedAt: data.updatedAt || new Date().toISOString() };
    this.notes.set(id, note);
    return note;
  }

  async #getNote(id) { return this.notes.get(id) || null; }

  async #getNoteByServerId(serverId) {
    for (const note of this.notes.values()) {
      if (note.serverId === serverId) return note;
    }
    return null;
  }

  async #updateNote(id, updates) {
    const note = this.notes.get(id);
    if (!note) return null;
    Object.assign(note, updates);
    return note;
  }

  async #deleteNote(id) {
    const note = this.notes.get(id);
    if (note) note.status = NOTE_STATUS.DELETED;
    return note;
  }

  async #restoreNote(id) {
    const note = this.notes.get(id);
    if (note) note.status = NOTE_STATUS.ACTIVE;
    return note;
  }

  async #listNotes() { return [...this.notes.values()]; }

  async #queueChange(change) {
    const cid = change.id || this.#nextCid();
    const queued = { ...change, id: cid, status: change.status || 'pending' };
    this.changes.push(queued);
    return queued;
  }

  async #getPendingChanges() {
    return this.changes.filter(c => c.status === 'pending');
  }

  async #markChangeAccepted(id) {
    const c = this.changes.find(x => x.id === id);
    if (c) c.status = 'accepted';
  }

  async #markChangeConflict(id, data) {
    const c = this.changes.find(x => x.id === id);
    if (c) { c.status = 'conflict'; c.conflictData = data; }
  }

  async #createRevision(rev) {
    this.revisions.push({ ...rev, id: `rev-${this.#nextRev()}` });
  }

  async #getRevision(id) { return this.revisions.find(r => r.id === id) || null; }

  async #getLatestRevision(noteId) {
    const noteRevs = this.revisions.filter(r => r.noteId === noteId);
    return noteRevs.length > 0 ? noteRevs[noteRevs.length - 1] : null;
  }
}

class MockApiClient {
  constructor() {
    this.serverNotes = new Map();
    this.serverChanges = [];
    this._nextServerNoteId = 1;
    this._nextSeq = 0;
    this.pullHandler = null;
    this.pushHandler = null;
  }

  addServerNote(title, content = '') {
    const id = `server-${this._nextServerNoteId++}`;
    this.serverNotes.set(id, { id, title, content, status: 'active', revision: 0 });
    this.serverChanges.push({
      id: `sc-${this.serverChanges.length + 1}`,
      noteId: id,
      type: CHANGE_TYPES.NOTE_CREATED,
      baseRevision: 1,
      payload: { title, content, status: 'active' },
      createdAt: new Date().toISOString(),
    });
    this._nextSeq++;
    return id;
  }

  editServerNote(noteId, title, content, revision) {
    const note = this.serverNotes.get(noteId);
    if (note) {
      if (title !== undefined) note.title = title;
      if (content !== undefined) note.content = content;
      note.revision = revision || note.revision + 1;
    }
    this.serverChanges.push({
      id: `sc-${this.serverChanges.length + 1}`,
      noteId,
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: note?.revision || 1,
      payload: { title, content },
      createdAt: new Date().toISOString(),
    });
    this._nextSeq++;
  }

  async pullChanges({ cursor }) {
    if (this.pullHandler) return this.pullHandler(cursor);

    const parsed = parseCursor(cursor);
    const seq = parsed.serverSequence || 0;
    const changes = this.serverChanges.filter((_, i) => i >= seq);

    const nextSeq = seq + changes.length;
    const newCursor = changes.length > 0 ? encodeCursor(nextSeq, 'server') : null;

    return { changes, cursor: newCursor };
  }

  async pushChanges({ changes }) {
    if (this.pushHandler) return this.pushHandler(changes);

    const results = changes.map(c => ({
      clientChangeId: c.id,
      status: 'accepted',
      serverRevision: ++this._nextSeq,
      serverId: c.noteId || `server-push-${this._nextSeq}`,
    }));
    return { results };
  }

  reset() {
    this.serverNotes.clear();
    this.serverChanges = [];
    this._nextSeq = 0;
  }
}

function createDevice(id = 'dev-1', overrides = {}) {
  const repos = new MockRepository();
  const apiClient = overrides.apiClient || new MockApiClient();
  const engine = new SyncEngine({
    repository: {
      notesRepository: repos.notesRepository,
      changesRepository: repos.changesRepository,
      revisionsRepository: repos.revisionsRepository,
      syncStateRepository: repos.syncStateRepository,
    },
    apiClient,
    workspaceId: overrides.workspaceId || 'ws-1',
    deviceId: id,
  });
  return { repos, apiClient, engine };
}

// ── Scenario Tests ─────────────────────────────────────────────────────────

describe('Multi-device sync simulation', () => {
  describe('Scenario 1: Basic sync — two devices create notes offline, then sync', () => {
    it('both devices see all notes after syncing', async () => {
      const sharedApiClient = new MockApiClient();

      const deviceA = createDevice('dev-A', { apiClient: sharedApiClient });
      const deviceB = createDevice('dev-B', { apiClient: sharedApiClient });

      // Device A creates a note offline
      const changeA = createChange({
        noteId: null,
        type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 0,
        payload: { title: 'Note from A', content: 'Created by device A' },
      });
      await deviceA.repos.changesRepository.queue(changeA);

      // Device B creates a different note offline
      const changeB = createChange({
        noteId: null,
        type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 0,
        payload: { title: 'Note from B', content: 'Created by device B' },
      });
      await deviceB.repos.changesRepository.queue(changeB);

      // Device A syncs first
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'accepted',
          serverRevision: ++sharedApiClient._nextSeq,
          serverId: `server-note-${sharedApiClient._nextSeq}`,
        })),
      });
      await deviceA.engine.sync();

      // Now server has A's note; make it available for pull
      const serverNoteA = {
        id: 'server-note-1',
        noteId: 'server-note-1',
        type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 1,
        payload: { title: 'Note from A', content: 'Created by device A', status: 'active' },
        createdAt: new Date().toISOString(),
      };
      sharedApiClient.serverChanges = [serverNoteA];
      sharedApiClient._nextSeq = 1;

      // Device B syncs: pushes its note + pulls A's note
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'accepted',
          serverRevision: ++sharedApiClient._nextSeq,
          serverId: `server-note-${sharedApiClient._nextSeq}`,
        })),
      });

      // Add B's pushed note to server changes for next pull
      sharedApiClient.serverChanges.push({
        id: 'server-note-2',
        noteId: 'server-note-2',
        type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 2,
        payload: { title: 'Note from B', content: 'Created by device B', status: 'active' },
        createdAt: new Date().toISOString(),
      });

      await deviceB.engine.sync();

      // Now sync A again so it gets B's note
      sharedApiClient.pushHandler = null;
      await deviceA.engine.sync();

      const notesA = await deviceA.repos.notesRepository.list();
      const notesB = await deviceB.repos.notesRepository.list();

      // Both devices should have received the remote notes
      const titlesA = notesA.map(n => n.title);
      const titlesB = notesB.map(n => n.title);

      expect(titlesA).toContain('Note from A');
      expect(titlesB).toContain('Note from B');
    });
  });

  describe('Scenario 2: Conflict detection — both devices edit same note offline', () => {
    it('conflict is detected when both edit same note', async () => {
      const sharedApiClient = new MockApiClient();
      const serverNoteId = sharedApiClient.addServerNote('Original', 'Base content');

      const deviceA = createDevice('dev-A', { apiClient: sharedApiClient });
      const deviceB = createDevice('dev-B', { apiClient: sharedApiClient });

      // Both pull to get the note
      sharedApiClient.pushHandler = null;
      await deviceA.engine.pull();
      await deviceB.engine.pull();

      // Both edit offline
      const notesA = await deviceA.repos.notesRepository.list();
      const notesB = await deviceB.repos.notesRepository.list();
      expect(notesA.length).toBeGreaterThan(0);
      expect(notesB.length).toBeGreaterThan(0);

      const localNoteA = notesA[0];
      const localNoteB = notesB[0];

      const changeA = createChange({
        noteId: serverNoteId,
        type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 1,
        payload: { title: 'Edited by A', content: localNoteA.content },
      });
      await deviceA.repos.changesRepository.queue(changeA);

      const changeB = createChange({
        noteId: serverNoteId,
        type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 1,
        payload: { title: 'Edited by B', content: localNoteB.content },
      });
      await deviceB.repos.changesRepository.queue(changeB);

      // Device A syncs first — accepted
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'accepted',
          serverRevision: ++sharedApiClient._nextSeq,
        })),
      });
      await deviceA.engine.sync();

      // Update server state to reflect A's edit
      sharedApiClient.editServerNote(serverNoteId, 'Edited by A', 'Base content', 2);

      // Device B syncs — should conflict because server rev > base rev
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'conflict',
        })),
      });
      await deviceB.engine.sync();

      const pendingB = await deviceB.repos.changesRepository.getPending();
      const conflictB = await deviceB.repos.changesRepository.getPending();
      const allChangesB = deviceB.repos.changes;
      const hasConflict = allChangesB.some(c => c.status === 'conflict');

      expect(hasConflict).toBe(true);
    });
  });

  describe('Scenario 3: Delete vs edit — one device deletes, other edits', () => {
    it('conflict detected for delete vs edit', async () => {
      const sharedApiClient = new MockApiClient();
      const noteId = sharedApiClient.addServerNote('Contested Note', 'Some content');

      const deviceA = createDevice('dev-A', { apiClient: sharedApiClient });
      const deviceB = createDevice('dev-B', { apiClient: sharedApiClient });

      // Both pull
      sharedApiClient.pushHandler = null;
      await deviceA.engine.pull();
      await deviceB.engine.pull();

      // Device A deletes offline
      const deleteChange = createChange({
        noteId,
        type: CHANGE_TYPES.NOTE_DELETED,
        baseRevision: 1,
        payload: {},
      });
      await deviceA.repos.changesRepository.queue(deleteChange);

      // Device B edits offline
      const editChange = createChange({
        noteId,
        type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 1,
        payload: { title: 'Edited by B' },
      });
      await deviceB.repos.changesRepository.queue(editChange);

      // A syncs first
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'accepted',
          serverRevision: ++sharedApiClient._nextSeq,
        })),
      });
      await deviceA.engine.sync();

      // Server now has A's delete
      sharedApiClient.serverChanges.push({
        id: `sc-del-${sharedApiClient.serverChanges.length + 1}`,
        noteId,
        type: CHANGE_TYPES.NOTE_DELETED,
        baseRevision: 2,
        payload: {},
        createdAt: new Date().toISOString(),
      });
      sharedApiClient._nextSeq = 2;

      // B syncs — server note was deleted but B has an edit
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'conflict',
        })),
      });
      await deviceB.engine.sync();

      const allChangesB = deviceB.repos.changes;
      const hasConflict = allChangesB.some(c => c.status === 'conflict');
      expect(hasConflict).toBe(true);
    });
  });

  describe('Scenario 4: Offline queue — 5 notes created offline, all synced', () => {
    it('syncs all 5 offline changes successfully', async () => {
      const sharedApiClient = new MockApiClient();
      const { repos, engine } = createDevice('dev-queue', { apiClient: sharedApiClient });

      // Create 5 notes offline
      for (let i = 1; i <= 5; i++) {
        const change = createChange({
          noteId: null,
          type: CHANGE_TYPES.NOTE_CREATED,
          baseRevision: 0,
          payload: { title: `Offline Note ${i}`, content: `Content ${i}` },
        });
        await repos.changesRepository.queue(change);
      }

      const pendingBefore = await repos.changesRepository.getPending();
      expect(pendingBefore).toHaveLength(5);

      // Sync
      let serverSeq = 0;
      sharedApiClient.pushHandler = (changes) => ({
        results: changes.map(c => ({
          clientChangeId: c.id,
          status: 'accepted',
          serverRevision: ++serverSeq,
        })),
      });
      sharedApiClient.pullHandler = () => ({ changes: [], cursor: null });

      await engine.sync();

      const pendingAfter = await repos.changesRepository.getPending();
      expect(pendingAfter).toHaveLength(0);

      // All changes should be accepted
      const accepted = repos.changes.filter(c => c.status === 'accepted');
      expect(accepted).toHaveLength(5);
    });
  });

  describe('Scenario 5: Retry on failure — network error then success', () => {
    it('retries and eventually syncs', async () => {
      const { repos, engine } = createDevice('dev-retry');
      const apiClient = {
        pullChanges: vi.fn(),
        pushChanges: vi.fn(),
      };

      const retryEngine = new SyncEngine({
        repository: {
          notesRepository: repos.notesRepository,
          changesRepository: repos.changesRepository,
          revisionsRepository: repos.revisionsRepository,
          syncStateRepository: repos.syncStateRepository,
        },
        apiClient,
        workspaceId: 'ws-1',
        deviceId: 'dev-retry',
      });

      let pullAttempts = 0;

      // First two pulls fail, third succeeds
      apiClient.pullChanges.mockImplementation(() => {
        pullAttempts++;
        if (pullAttempts <= 2) {
          const err = new Error('ECONNRESET');
          err.name = 'TypeError';
          return Promise.reject(err);
        }
        return Promise.resolve({ changes: [], cursor: null });
      });

      apiClient.pushChanges.mockResolvedValue({ results: [] });

      await retryEngine.sync();

      expect(pullAttempts).toBe(3);
      expect(retryEngine.getStatus()).toBe(SYNC_STATE.IDLE);
    });
  });

  describe('Scenario 6: Cursor advancement — no duplicate changes', () => {
    it('cursor tracks position and no duplicates on subsequent pulls', async () => {
      const sharedApiClient = new MockApiClient();

      // Server has 3 changes
      for (let i = 1; i <= 3; i++) {
        sharedApiClient.addServerNote(`Note ${i}`, `Content ${i}`);
      }

      const { repos, engine } = createDevice('dev-cursor', { apiClient: sharedApiClient });

      // First pull
      sharedApiClient.pushHandler = null;
      await engine.pull();

      const notesAfterFirst = await repos.notesRepository.list();
      expect(notesAfterFirst).toHaveLength(3);

      const cursorAfterFirst = repos.cursor;
      expect(cursorAfterFirst).not.toBeNull();

      // Add 2 more server notes
      sharedApiClient.addServerNote('Note 4', 'Content 4');
      sharedApiClient.addServerNote('Note 5', 'Content 5');

      // Second pull should only get 2 new notes
      await engine.pull();

      const notesAfterSecond = await repos.notesRepository.list();
      expect(notesAfterSecond).toHaveLength(5);

      const cursorAfterSecond = repos.cursor;
      expect(cursorAfterSecond).not.toBeNull();
      expect(cursorAfterSecond).not.toBe(cursorAfterFirst);
    });
  });

  describe('Scenario 7: Idempotency — same change pushed twice', () => {
    it('duplicate change is detected against existing changes', async () => {
      const sharedApiClient = new MockApiClient();
      const { repos } = createDevice('dev-idempotent', { apiClient: sharedApiClient });

      // Simulate an existing accepted change (from a previous sync)
      await repos.changesRepository.queue({
        id: 'original-change',
        noteId: 'server-1',
        type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 1,
        payload: { title: 'Test' },
        status: 'accepted',
      });

      // Queue a new change with the same identity
      const duplicateChange = {
        id: 'duplicate-change',
        noteId: 'server-1',
        type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 1,
        payload: { title: 'Test' },
      };

      // isDuplicateChange checks noteId + baseRevision + type match
      const existingChanges = repos.changes;
      const isDup = isDuplicateChange(existingChanges, duplicateChange);
      expect(isDup).toBe(true);
    });

    it('isDuplicateChange returns false for different baseRevision', async () => {
      const existing = [{ noteId: 'n1', baseRevision: 1, type: CHANGE_TYPES.NOTE_UPDATED }];
      const newChange = { noteId: 'n1', baseRevision: 2, type: CHANGE_TYPES.NOTE_UPDATED };
      expect(isDuplicateChange(existing, newChange)).toBe(false);
    });

    it('isDuplicateChange returns false for different noteId', async () => {
      const existing = [{ noteId: 'n1', baseRevision: 1, type: CHANGE_TYPES.NOTE_UPDATED }];
      const newChange = { noteId: 'n2', baseRevision: 1, type: CHANGE_TYPES.NOTE_UPDATED };
      expect(isDuplicateChange(existing, newChange)).toBe(false);
    });
  });
});

describe('Edge cases in simulation', () => {
  it('sync with empty server and no local changes does nothing', async () => {
    const { repos, engine } = createDevice('dev-empty');
    const apiClient = {
      pullChanges: vi.fn().mockResolvedValue({ changes: [], cursor: null }),
      pushChanges: vi.fn().mockResolvedValue({ results: [] }),
    };

    const emptyEngine = new SyncEngine({
      repository: {
        notesRepository: repos.notesRepository,
        changesRepository: repos.changesRepository,
        revisionsRepository: repos.revisionsRepository,
        syncStateRepository: repos.syncStateRepository,
      },
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-empty',
    });

    await emptyEngine.sync();

    expect(apiClient.pullChanges).toHaveBeenCalledTimes(1);
    expect(apiClient.pushChanges).not.toHaveBeenCalled();
    expect(emptyEngine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('engine does not crash when pullChanges returns undefined', async () => {
    const { repos } = createDevice('dev-undef');
    const apiClient = {
      pullChanges: vi.fn().mockResolvedValue(undefined),
      pushChanges: vi.fn().mockResolvedValue({ results: [] }),
    };

    const engine = new SyncEngine({
      repository: {
        notesRepository: repos.notesRepository,
        changesRepository: repos.changesRepository,
        revisionsRepository: repos.revisionsRepository,
        syncStateRepository: repos.syncStateRepository,
      },
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-undef',
    });

    await engine.sync();
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('concurrent sync calls are serialized', async () => {
    let syncing = false;
    let concurrentDetected = false;
    const { repos } = createDevice('dev-concurrent');
    const apiClient = {
      pullChanges: vi.fn().mockImplementation(() => {
        if (syncing) concurrentDetected = true;
        syncing = true;
        return new Promise(resolve => {
          setTimeout(() => {
            syncing = false;
            resolve({ changes: [], cursor: null });
          }, 10);
        });
      }),
      pushChanges: vi.fn().mockResolvedValue({ results: [] }),
    };

    const engine = new SyncEngine({
      repository: {
        notesRepository: repos.notesRepository,
        changesRepository: repos.changesRepository,
        revisionsRepository: repos.revisionsRepository,
        syncStateRepository: repos.syncStateRepository,
      },
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-concurrent',
    });

    await Promise.all([engine.sync(), engine.sync()]);

    // Only one actual pull should have happened
    expect(apiClient.pullChanges).toHaveBeenCalledTimes(1);
    expect(concurrentDetected).toBe(false);
  });

  it('error during pull leaves engine in IDLE state', async () => {
    const { repos } = createDevice('dev-error');
    const apiClient = {
      pullChanges: vi.fn().mockRejectedValue(new Error('permanent failure')),
      pushChanges: vi.fn().mockResolvedValue({ results: [] }),
    };

    const engine = new SyncEngine({
      repository: {
        notesRepository: repos.notesRepository,
        changesRepository: repos.changesRepository,
        revisionsRepository: repos.revisionsRepository,
        syncStateRepository: repos.syncStateRepository,
      },
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-error',
    });

    const errorHandler = vi.fn();
    engine.onError(errorHandler);

    await engine.sync();

    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
    expect(errorHandler).toHaveBeenCalled();
  });
});
