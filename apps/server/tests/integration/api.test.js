import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockModels } = vi.hoisted(() => {
  function createModelMock() {
    const chainable = () => {
      const self = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        then: (resolve) => resolve([]),
      };
      return self;
    };

    return {
      find: vi.fn().mockReturnValue(chainable()),
      findOne: vi.fn().mockReturnValue(chainable()),
      findOneAndUpdate: vi.fn().mockReturnValue(chainable()),
      findByIdAndUpdate: vi.fn().mockReturnValue(chainable()),
      findById: vi.fn().mockResolvedValue(null),
      findOneAndDelete: vi.fn().mockResolvedValue({ _id: 'mock-deleted' }),
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({ _id: 'mock-created', ...data, save: vi.fn().mockResolvedValue(true) })
      ),
      countDocuments: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({}),
    };
  }

  return {
    mockModels: {
      User: createModelMock(),
      Workspace: createModelMock(),
      Device: createModelMock(),
      Note: createModelMock(),
      NoteRevision: createModelMock(),
      Change: createModelMock(),
      Conflict: createModelMock(),
      VisibilityRule: createModelMock(),
      AuditEvent: createModelMock(),
      PairingSession: createModelMock(),
      SyncCursor: createModelMock(),
    },
  };
});

vi.mock('../../src/models/index.js', () => mockModels);
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as authService from '../../src/services/authService.js';
import * as noteService from '../../src/services/noteService.js';
import * as syncService from '../../src/services/syncService.js';
import * as deviceService from '../../src/services/deviceService.js';
import * as visibilityService from '../../src/services/visibilityService.js';
import * as conflictService from '../../src/services/conflictService.js';
import * as auditService from '../../src/services/auditService.js';
import { Note, AuditEvent, Conflict, Change, VisibilityRule } from '../../src/models/index.js';
import { generateToken } from '../../src/middleware/auth.js';
import { CHANGE_TYPES } from '@synced-notepad/shared';

describe('Auth flow: register → login → get /me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a new user and returns token', async () => {
    const { User, Workspace, Device } = await import('../../src/models/index.js');
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: 'user-new',
      email: 'test@example.com',
      displayName: 'Test User',
      passwordHash: 'hashed',
    });
    Workspace.create.mockResolvedValue({ _id: 'ws-new', name: "Test's Workspace" });
    Device.create.mockResolvedValue({ _id: 'dev-new', name: 'First Device', type: 'web' });

    const result = await authService.register('test@example.com', 'password123', 'Test User');

    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.displayName).toBe('Test User');
    expect(result.workspace.name).toBe("Test's Workspace");
    expect(result.device.name).toBe('First Device');
  });

  it('rejects duplicate email on register', async () => {
    const { User } = await import('../../src/models/index.js');
    User.findOne.mockResolvedValue({ _id: 'existing', email: 'taken@example.com' });

    await expect(
      authService.register('taken@example.com', 'password123', 'Taken')
    ).rejects.toThrow('Email already registered');
  });

  it('logs in with correct credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('password123', 4);

    const { User, Workspace, Device } = await import('../../src/models/index.js');
    User.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'login@example.com',
      displayName: 'Login User',
      passwordHash: hash,
    });
    Workspace.findOne.mockResolvedValue({ _id: 'ws-1', name: 'My Workspace' });
    Device.create.mockResolvedValue({ _id: 'dev-login', name: 'New Session', type: 'web' });

    const result = await authService.login('login@example.com', 'password123');

    expect(result).toHaveProperty('token');
    expect(result.user.id).toBe('user-1');
  });

  it('rejects login with wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct', 4);

    const { User } = await import('../../src/models/index.js');
    User.findOne.mockResolvedValue({
      _id: 'user-1',
      email: 'login@example.com',
      passwordHash: hash,
    });

    await expect(
      authService.login('login@example.com', 'wrong')
    ).rejects.toThrow('Invalid email or password');
  });

  it('gets current user via /me', async () => {
    const { User, Workspace } = await import('../../src/models/index.js');
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: 'user-1',
        email: 'me@example.com',
        displayName: 'Me User',
      }),
    });
    Workspace.findOne.mockResolvedValue({ _id: 'ws-1', name: 'Me Workspace' });

    const result = await authService.getCurrentUser('user-1');

    expect(result.user.email).toBe('me@example.com');
    expect(result.workspace.name).toBe('Me Workspace');
  });
});

describe('Note CRUD: create → get → update → list → delete', () => {
  const testDevice = 'device-1';
  const testWorkspace = 'workspace-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a note with revision', async () => {
    const { Note } = await import('../../src/models/index.js');
    Note.create
      .mockResolvedValueOnce({
        _id: 'note-1', workspaceId: testWorkspace, title: 'Test Note', content: 'Hello',
        folder: '', status: 'active', currentRevision: 0, createdByDevice: testDevice,
        save: vi.fn().mockResolvedValue(true),
      })
      .mockResolvedValueOnce({ _id: 'rev-1' })
      .mockResolvedValueOnce({
        _id: 'note-1', title: 'Test Note', currentRevision: 1,
        save: vi.fn().mockResolvedValue(true),
      });

    const result = await noteService.createNote(testWorkspace, testDevice, {
      title: 'Test Note', content: 'Hello',
    });

    expect(result.note.title).toBe('Test Note');
    expect(result.revision).toBeDefined();
  });

  it('lists notes in workspace', async () => {
    const { Note } = await import('../../src/models/index.js');
    Note.find.mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'note-1', title: 'Note 1' },
        { _id: 'note-2', title: 'Note 2' },
      ]),
    });

    const result = await noteService.listNotes(testWorkspace);

    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].title).toBe('Note 1');
  });

  it('updates a note and creates revision', async () => {
    const { Note } = await import('../../src/models/index.js');
    const mockNote = {
      _id: 'note-1', workspaceId: testWorkspace, title: 'Old Title',
      content: 'Old content', currentRevision: 1, createdByDevice: testDevice,
      save: vi.fn().mockResolvedValue(true),
    };

    Note.findOne.mockResolvedValue(mockNote);
    Note.create.mockResolvedValue({ _id: 'rev-2' });

    const result = await noteService.updateNote(testWorkspace, 'note-1', testDevice, {
      title: 'New Title',
    });

    expect(mockNote.title).toBe('New Title');
    expect(mockNote.currentRevision).toBe(2);
  });

  it('deletes a note (soft delete)', async () => {
    const { Note } = await import('../../src/models/index.js');
    const mockNote = {
      _id: 'note-1', status: 'active', deletedAt: undefined,
      save: vi.fn().mockResolvedValue(true),
    };

    Note.findOne.mockResolvedValue(mockNote);

    const result = await noteService.deleteNote(testWorkspace, 'note-1');

    expect(result.success).toBe(true);
    expect(mockNote.status).toBe('deleted');
    expect(mockNote.deletedAt).toBeDefined();
  });

  it('returns 404 for non-existent note', async () => {
    const { Note } = await import('../../src/models/index.js');
    Note.findOne.mockResolvedValue(null);

    await expect(
      noteService.getNoteById(testWorkspace, 'note-missing')
    ).rejects.toThrow('Note not found');
  });
});

describe('Sync flow: push change → pull changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes a note creation change and accepts it', async () => {
    const { Note, NoteRevision, Change, SyncCursor, AuditEvent } = await import('../../src/models/index.js');

    SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 0 });
    Note.create.mockResolvedValue({
      _id: 'server-note-1', workspaceId: 'workspace-1', title: 'Synced Note',
      content: '', folder: '', status: 'active', currentRevision: 1,
      save: vi.fn().mockResolvedValue(true),
    });
    NoteRevision.create.mockResolvedValue({});
    Change.findOneAndUpdate.mockResolvedValue({});
    AuditEvent.create.mockResolvedValue({});

    const changes = [{
      id: 'client-change-1', noteId: 'note-1', type: 'note.created',
      baseRevision: 0, payload: { title: 'Synced Note', content: '' },
    }];

    const result = await syncService.pushChanges('workspace-1', 'device-1', 'user-1', changes);

    expect(result.accepted).toContain('client-change-1');
    expect(result.conflicts).toHaveLength(0);
  });

  it('detects conflict on push when server revision differs', async () => {
    const { Note, Conflict } = await import('../../src/models/index.js');

    Note.findOne.mockResolvedValue({
      _id: 'note-1', currentRevision: 2, title: 'Server Version',
      content: '', folder: '', createdByDevice: 'device-srv',
    });
    Conflict.create.mockResolvedValue({ _id: 'conflict-1', noteId: 'note-1' });

    const changes = [{
      id: 'client-change-2', noteId: 'note-1', type: 'note.updated',
      baseRevision: 1, payload: { title: 'Client Version' },
    }];

    const result = await syncService.pushChanges('workspace-1', 'device-1', 'user-1', changes);

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.accepted).not.toContain('client-change-2');
  });

  it('pulls changes after cursor', async () => {
    const { Change, SyncCursor } = await import('../../src/models/index.js');
    SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 5 });

    Change.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          { _id: 'c1', noteId: 'n1', type: 'note.created', baseRevision: 6, payload: { title: 'New' }, createdAt: new Date() },
        ]),
      }),
    });

    const validCursor = Buffer.from(JSON.stringify({ serverSequence: 5, deviceId: 'device-1' })).toString('base64url');
    const result = await syncService.pullChanges('workspace-1', 'device-1', validCursor);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('note.created');
  });
});

describe('Device flow: list → pair → confirm → revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists devices in workspace', async () => {
    const { Device } = await import('../../src/models/index.js');
    Device.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          { _id: 'dev-1', name: 'Phone', type: 'mobile', status: 'active' },
          { _id: 'dev-2', name: 'Browser', type: 'web', status: 'active' },
        ]),
      }),
    });

    const result = await deviceService.listDevices('workspace-1');

    expect(result.devices).toHaveLength(2);
    expect(result.devices[0].name).toBe('Phone');
  });

  it('initiates pairing and returns token', async () => {
    const { Device, PairingSession } = await import('../../src/models/index.js');
    Device.findOne.mockResolvedValue({ _id: 'dev-owner', status: 'active' });
    PairingSession.create.mockResolvedValue({
      _id: 'session-1', pairingToken: 'token-abc', verificationCode: '123456',
      expiresAt: new Date(Date.now() + 300000),
    });

    const result = await deviceService.initiatePairing('workspace-1', 'dev-owner');

    expect(result.pairingToken).toBe('token-abc');
    expect(result.verificationCode).toBe('123456');
  });

  it('confirms pairing with verification code', async () => {
    const { PairingSession, Device } = await import('../../src/models/index.js');
    PairingSession.findById.mockResolvedValue({
      _id: 'session-1', status: 'pending', expiresAt: new Date(Date.now() + 300000),
      verificationCode: '123456', newDeviceId: 'dev-new',
      save: vi.fn().mockResolvedValue(true),
    });
    const mockDevice = { _id: 'dev-new', name: 'New Phone', type: 'mobile', status: 'active' };
    Device.findByIdAndUpdate.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockDevice),
    });

    const result = await deviceService.confirmPairing('session-1', '123456');

    expect(result.device.status).toBe('active');
  });

  it('revokes a device', async () => {
    const { Device } = await import('../../src/models/index.js');
    const mockDevice = { _id: 'dev-revoke', name: 'Revoked', status: 'revoked' };
    Device.findOneAndUpdate.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockDevice),
    });

    const result = await deviceService.revokeDevice('workspace-1', 'dev-revoke');

    expect(result.device.status).toBe('revoked');
  });
});

describe('Visibility: set rule → pull filters hidden notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a visibility rule', async () => {
    const { VisibilityRule, Note } = await import('../../src/models/index.js');
    Note.findOne.mockResolvedValue({ _id: 'note-1' });
    VisibilityRule.findOneAndUpdate.mockResolvedValue({
      _id: 'rule-1', noteId: 'note-1', deviceId: 'device-hidden', visible: false,
    });

    const result = await visibilityService.setVisibilityRule(
      'workspace-1', 'note-1', 'device-hidden', false
    );

    expect(result.rule.visible).toBe(false);
  });

  it('gets hidden note IDs for a device', async () => {
    const { VisibilityRule } = await import('../../src/models/index.js');
    VisibilityRule.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { noteId: 'note-hidden-1' },
        { noteId: 'note-hidden-2' },
      ]),
    });

    const hidden = await visibilityService.getHiddenNoteIds('device-hidden');

    expect(hidden).toHaveLength(2);
    expect(hidden).toContain('note-hidden-1');
  });

  it('removes a visibility rule', async () => {
    const { VisibilityRule } = await import('../../src/models/index.js');
    VisibilityRule.findOneAndDelete.mockResolvedValue({ _id: 'rule-1' });

    const result = await visibilityService.removeVisibilityRule('note-1', 'device-hidden');

    expect(result.success).toBe(true);
  });

  it('throws when removing non-existent rule', async () => {
    const { VisibilityRule } = await import('../../src/models/index.js');
    VisibilityRule.findOneAndDelete.mockResolvedValue(null);

    await expect(
      visibilityService.removeVisibilityRule('note-1', 'device-x')
    ).rejects.toThrow('Visibility rule not found');
  });
});

describe('Conflicts: push conflicting changes → resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists pending conflicts', async () => {
    const { Conflict } = await import('../../src/models/index.js');
    Conflict.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([
              { _id: 'conf-1', noteId: 'n1', status: 'pending' },
            ]),
          }),
        }),
      }),
    });

    const result = await conflictService.listConflicts('workspace-1');

    expect(result.conflicts).toHaveLength(1);
  });

  it('resolves conflict with keep_version', async () => {
    const { Conflict, Note, Change, NoteRevision } = await import('../../src/models/index.js');
    Conflict.findById.mockResolvedValue({
      _id: 'conf-1', status: 'pending', noteId: 'note-1',
      changeIdA: 'change-a', changeIdB: 'change-b', workspaceId: 'workspace-1',
      save: vi.fn().mockResolvedValue(true),
    });
    Note.findById.mockResolvedValue({
      _id: 'note-1', title: 'Original', content: 'Content',
      currentRevision: 2, createdByDevice: 'device-x',
      save: vi.fn().mockResolvedValue(true),
    });
    Change.findById.mockResolvedValue({
      _id: 'change-a', payload: { title: 'Kept Version', content: 'Kept content' },
    });
    NoteRevision.create.mockResolvedValue({});

    const result = await conflictService.resolveConflict(
      'conf-1', 'keep_version', 'device-resolver', 'local'
    );

    expect(result.conflict.status).toBe('resolved');
    expect(result.note.title).toBe('Kept Version');
  });

  it('resolves conflict with merge', async () => {
    const { Conflict, Note, Change, NoteRevision } = await import('../../src/models/index.js');
    Conflict.findById.mockResolvedValue({
      _id: 'conf-2', status: 'pending', noteId: 'note-2',
      changeIdA: 'change-ma', changeIdB: 'change-mb', workspaceId: 'workspace-1',
      save: vi.fn().mockResolvedValue(true),
    });
    Note.findById.mockResolvedValue({
      _id: 'note-2', title: 'Original', content: 'Base',
      currentRevision: 1, createdByDevice: 'device-x',
      save: vi.fn().mockResolvedValue(true),
    });
    Change.findById
      .mockResolvedValueOnce({ _id: 'change-ma', payload: { title: 'Version A' } })
      .mockResolvedValueOnce({ _id: 'change-mb', payload: { content: 'Version B content' } });
    NoteRevision.create.mockResolvedValue({});

    const result = await conflictService.resolveConflict('conf-2', 'merge', 'device-resolver');

    expect(result.conflict.status).toBe('resolved');
    expect(result.conflict.resolution).toBe('merge');
  });

  it('resolves conflict with keep_both creates duplicate', async () => {
    const { Conflict, Note, NoteRevision } = await import('../../src/models/index.js');
    Conflict.findById.mockResolvedValue({
      _id: 'conf-3', status: 'pending', noteId: 'note-3', workspaceId: 'workspace-1',
      save: vi.fn().mockResolvedValue(true),
    });
    Note.findById.mockResolvedValue({
      _id: 'note-3', title: 'Original', content: 'Content', folder: '',
      currentRevision: 1, createdByDevice: 'device-x',
      save: vi.fn().mockResolvedValue(true),
    });
    Note.create.mockResolvedValue({ _id: 'note-3-copy', title: 'Original (copy)' });
    NoteRevision.create.mockResolvedValue({});

    const result = await conflictService.resolveConflict('conf-3', 'keep_both', 'device-resolver');

    expect(result.conflict.status).toBe('resolved');
    expect(Note.create).toHaveBeenCalled();
  });

  it('rejects resolution on already-resolved conflict', async () => {
    const { Conflict } = await import('../../src/models/index.js');
    Conflict.findById.mockResolvedValue({
      _id: 'conf-4', status: 'resolved',
    });

    await expect(
      conflictService.resolveConflict('conf-4', 'keep_version', 'device-x', 'local')
    ).rejects.toThrow('already resolved');
  });
});

describe('Audit: events are logged for operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logEvent creates an audit event', async () => {
    const { AuditEvent } = await import('../../src/models/index.js');
    AuditEvent.create.mockResolvedValue({
      _id: 'event-1', eventType: 'note.created', workspaceId: 'ws-1',
    });

    const event = await auditService.logEvent('ws-1', 'user-1', 'device-1', 'note.created', {
      noteId: 'note-1', revision: 1,
    });

    expect(event).toBeDefined();
    expect(AuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'note.created',
        details: { noteId: 'note-1', revision: 1 },
      })
    );
  });

  it('getAuditEvents returns events with filters', async () => {
    const { AuditEvent } = await import('../../src/models/index.js');
    AuditEvent.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            populate: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue([
                { _id: 'evt-1', eventType: 'note.created' },
              ]),
            }),
          }),
        }),
      }),
    });
    AuditEvent.countDocuments.mockResolvedValue(1);

    const result = await auditService.getAuditEvents('ws-1', {
      eventType: 'note.created', limit: 10, offset: 0,
    });

    expect(result.events).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
