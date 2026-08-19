import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from './engine.js';
import { SYNC_STATE, CHANGE_TYPES, NOTE_STATUS } from '@synced-notepad/shared';

function createMockRepos(overrides = {}) {
  return {
    notesRepository: {
      create: vi.fn().mockResolvedValue({ id: 'local-1', serverId: null, title: '', content: '', status: NOTE_STATUS.ACTIVE, localRevision: 0, serverRevision: null }),
      get: vi.fn().mockResolvedValue(null),
      getByServerId: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      restore: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue([]),
      ...overrides.notesRepository,
    },
    changesRepository: {
      queue: vi.fn().mockResolvedValue({}),
      getPending: vi.fn().mockResolvedValue([]),
      markAccepted: vi.fn().mockResolvedValue({}),
      markConflict: vi.fn().mockResolvedValue({}),
      ...overrides.changesRepository,
    },
    revisionsRepository: {
      create: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(null),
      getLatest: vi.fn().mockResolvedValue(null),
      ...overrides.revisionsRepository,
    },
    syncStateRepository: {
      getCursor: vi.fn().mockResolvedValue(null),
      setCursor: vi.fn().mockResolvedValue({}),
      ...overrides.syncStateRepository,
    },
  };
}

function createMockApiClient(overrides = {}) {
  return {
    pullChanges: vi.fn().mockResolvedValue({ changes: [], cursor: null }),
    pushChanges: vi.fn().mockResolvedValue({ results: [] }),
    ...overrides,
  };
}

describe('SyncEngine state machine transitions', () => {
  it('starts in IDLE state', () => {
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient: createMockApiClient(),
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('transitions to IDLE after successful sync', async () => {
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient: createMockApiClient(),
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });
    await engine.sync();
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('transitions to IDLE after error', async () => {
    const err = new Error('invalid input');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockRejectedValue(err),
    });
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });
    await engine.sync();
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('does not start sync if already syncing', async () => {
    let resolvePull;
    const apiClient = createMockApiClient({
      pullChanges: vi.fn(() => new Promise((r) => { resolvePull = r; })),
    });
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    const p1 = engine.sync();
    await engine.sync();
    resolvePull({ changes: [], cursor: null });
    await p1;

    expect(apiClient.pullChanges).toHaveBeenCalledTimes(1);
  });
});

describe('SyncEngine pull changes', () => {
  it('applies remote created notes', async () => {
    const repos = createMockRepos();
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockResolvedValue({
        changes: [
          {
            id: 'remote-1',
            noteId: 'server-note-1',
            type: CHANGE_TYPES.NOTE_CREATED,
            baseRevision: 1,
            payload: { title: 'Remote Note', content: 'content', status: 'active' },
            createdAt: new Date().toISOString(),
          },
        ],
        cursor: 'next-cursor',
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(repos.notesRepository.create).toHaveBeenCalledTimes(1);
    expect(repos.syncStateRepository.setCursor).toHaveBeenCalledWith('next-cursor');
  });

  it('applies remote updates to existing notes', async () => {
    const localNote = { id: 'local-1', serverId: 'server-1', title: 'Old', content: 'old', status: 'active', localRevision: 1, serverRevision: 1 };
    const repos = createMockRepos({
      notesRepository: {
        get: vi.fn().mockResolvedValue(localNote),
        getByServerId: vi.fn().mockResolvedValue(localNote),
      },
      changesRepository: {
        getPending: vi.fn().mockResolvedValue([]),
      },
    });
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockResolvedValue({
        changes: [
          {
            id: 'remote-2',
            noteId: 'server-1',
            type: CHANGE_TYPES.NOTE_UPDATED,
            baseRevision: 2,
            payload: { title: 'Updated Title' },
            createdAt: new Date().toISOString(),
          },
        ],
        cursor: null,
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(repos.notesRepository.update).toHaveBeenCalled();
  });

  it('does nothing when no remote changes', async () => {
    const repos = createMockRepos();
    const engine = new SyncEngine({
      repository: repos,
      apiClient: createMockApiClient(),
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(repos.notesRepository.create).not.toHaveBeenCalled();
    expect(repos.notesRepository.update).not.toHaveBeenCalled();
  });
});

describe('SyncEngine push changes', () => {
  it('pushes pending local changes', async () => {
    const pendingChange = {
      id: 'local-change-1',
      noteId: 'note-1',
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: 1,
      payload: { title: 'Changed' },
    };
    const repos = createMockRepos({
      changesRepository: {
        getPending: vi.fn().mockResolvedValue([pendingChange]),
      },
    });
    const apiClient = createMockApiClient({
      pushChanges: vi.fn().mockResolvedValue({
        results: [{ clientChangeId: 'local-change-1', status: 'accepted', serverRevision: 2 }],
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.push();
    expect(apiClient.pushChanges).toHaveBeenCalledTimes(1);
    expect(repos.changesRepository.markAccepted).toHaveBeenCalledWith('local-change-1');
  });

  it('skips push when no pending changes', async () => {
    const apiClient = createMockApiClient();
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.push();
    expect(apiClient.pushChanges).not.toHaveBeenCalled();
  });

  it('marks conflict when server rejects a change', async () => {
    const pendingChange = {
      id: 'local-change-2',
      noteId: 'note-1',
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: 1,
      payload: { title: 'Conflicted' },
    };
    const repos = createMockRepos({
      changesRepository: {
        getPending: vi.fn().mockResolvedValue([pendingChange]),
      },
    });
    const apiClient = createMockApiClient({
      pushChanges: vi.fn().mockResolvedValue({
        results: [{ clientChangeId: 'local-change-2', status: 'conflict' }],
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.push();
    expect(repos.changesRepository.markConflict).toHaveBeenCalledWith('local-change-2', expect.any(String));
  });
});

describe('SyncEngine conflict detection', () => {
  it('detects conflict between remote update and local pending change', async () => {
    const localNote = { id: 'local-1', serverId: 'server-1', title: 'Base Title', content: 'base content', status: 'active', localRevision: 1, serverRevision: 1 };
    const localPending = {
      id: 'local-pending-1',
      noteId: 'server-1',
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: 1,
      payload: { title: 'Local Edit Title' },
      status: 'pending',
    };
    const repos = createMockRepos({
      notesRepository: {
        get: vi.fn().mockResolvedValue(localNote),
        getByServerId: vi.fn().mockResolvedValue(localNote),
      },
      changesRepository: {
        getPending: vi.fn().mockResolvedValue([localPending]),
      },
    });
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockResolvedValue({
        changes: [
          {
            id: 'remote-update',
            noteId: 'server-1',
            type: CHANGE_TYPES.NOTE_UPDATED,
            baseRevision: 2,
            payload: { title: 'Remote Edit Title' },
            createdAt: new Date().toISOString(),
          },
        ],
        cursor: null,
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(repos.changesRepository.markConflict).toHaveBeenCalled();
  });

  it('skips duplicate changes (idempotency)', async () => {
    const existingPending = {
      id: 'existing-1',
      noteId: 'n1',
      baseRevision: 1,
      type: CHANGE_TYPES.NOTE_UPDATED,
      status: 'pending',
    };
    const repos = createMockRepos({
      changesRepository: {
        getPending: vi.fn().mockResolvedValue([existingPending]),
      },
    });
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockResolvedValue({
        changes: [
          {
            id: 'remote-dup',
            noteId: 'n1',
            type: CHANGE_TYPES.NOTE_UPDATED,
            baseRevision: 1,
            payload: { title: 'Dup' },
            createdAt: new Date().toISOString(),
          },
        ],
        cursor: null,
      }),
    });

    const engine = new SyncEngine({
      repository: repos,
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(repos.notesRepository.update).not.toHaveBeenCalled();
  });
});

describe('SyncEngine retry logic', () => {
  it('retries on network error and succeeds', async () => {
    let callCount = 0;
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('ECONNRESET');
          err.name = 'TypeError';
          throw err;
        }
        return Promise.resolve({ changes: [], cursor: null });
      }),
    });

    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    await engine.sync();
    expect(callCount).toBe(2);
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });

  it('emits error after max retries exhausted', async () => {
    const apiClient = createMockApiClient({
      pullChanges: vi.fn().mockRejectedValue(new Error('permanent failure')),
    });

    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient,
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    const errorHandler = vi.fn();
    engine.onError(errorHandler);

    await engine.sync();
    expect(errorHandler).toHaveBeenCalled();
    expect(engine.getStatus()).toBe(SYNC_STATE.IDLE);
  });
});

describe('SyncEngine status listeners', () => {
  it('registers and unsubscribes status listener', () => {
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient: createMockApiClient(),
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    const listener = vi.fn();
    const unsubscribe = engine.onStatusChange(listener);
    unsubscribe();

    engine.onStatusChange(listener);
  });

  it('registers and unsubscribes error listener', () => {
    const engine = new SyncEngine({
      repository: createMockRepos(),
      apiClient: createMockApiClient(),
      workspaceId: 'ws-1',
      deviceId: 'dev-1',
    });

    const listener = vi.fn();
    const unsubscribe = engine.onError(listener);
    unsubscribe();

    engine.onError(listener);
  });
});
