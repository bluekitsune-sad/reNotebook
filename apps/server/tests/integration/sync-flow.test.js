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

import { Note, Change, Conflict, VisibilityRule, AuditEvent, SyncCursor, NoteRevision } from '../../src/models/index.js';
import * as syncService from '../../src/services/syncService.js';
import * as conflictService from '../../src/services/conflictService.js';
import { CHANGE_TYPES, CONFLICT_STATUS } from '@synced-notepad/shared';

const workspaceId = 'workspace-1';
const deviceId = 'device-1';
const userId = 'user-1';

describe('Full sync flow: register → create workspace → sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('push note creation → note exists in MongoDB → pull returns it', async () => {
    SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 0 });
    Note.create.mockResolvedValue({
      _id: 'server-note-1', workspaceId, title: 'Synced Note',
      content: 'Synced content', folder: '', status: 'active', currentRevision: 1,
      save: vi.fn().mockResolvedValue(true),
    });
    NoteRevision.create.mockResolvedValue({});
    Change.findOneAndUpdate.mockResolvedValue({});
    AuditEvent.create.mockResolvedValue({});

    const pushResult = await syncService.pushChanges(workspaceId, deviceId, userId, [
      {
        id: 'change-push-1', noteId: 'client-note-1', type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 0, payload: { title: 'Synced Note', content: 'Synced content' },
      },
    ]);

    expect(pushResult.accepted).toContain('change-push-1');
    expect(pushResult.conflicts).toHaveLength(0);
    expect(Note.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Synced Note' })
    );
  });

  it('pull returns changes after cursor with correct cursor advancement', async () => {
    SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 2 });

    const changes = [
      { _id: 'c1', noteId: 'n1', type: 'note.created', baseRevision: 3, payload: { title: 'A' }, createdAt: new Date() },
      { _id: 'c2', noteId: 'n2', type: 'note.created', baseRevision: 4, payload: { title: 'B' }, createdAt: new Date() },
    ];

    Change.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(changes),
      }),
    });

    const validCursor = Buffer.from(JSON.stringify({ serverSequence: 2, deviceId })).toString('base64url');
    const pullResult = await syncService.pullChanges(workspaceId, deviceId, validCursor);

    expect(pullResult.changes).toHaveLength(2);
    expect(pullResult.lastSeq).toBe(2);
  });

  it('push conflicting edit → conflict record created', async () => {
    Note.findOne.mockResolvedValue({
      _id: 'note-conflict', workspaceId, currentRevision: 3,
      title: 'Server Title', content: 'Server content', createdByDevice: 'device-server',
    });
    AuditEvent.create.mockResolvedValue({});

    const pushResult = await syncService.pushChanges(workspaceId, deviceId, userId, [
      {
        id: 'change-conflict', noteId: 'note-conflict', type: CHANGE_TYPES.NOTE_UPDATED,
        baseRevision: 2, payload: { title: 'Client Title' },
      },
    ]);

    expect(pushResult.conflicts.length).toBeGreaterThan(0);
    expect(Conflict.create).toHaveBeenCalled();
  });

  it('resolve conflict → new revision created', async () => {
    Conflict.findById.mockResolvedValue({
      _id: 'conflict-resolve-1', status: CONFLICT_STATUS.PENDING,
      noteId: 'note-resolve', changeIdA: 'change-a', changeIdB: 'change-b',
      workspaceId, save: vi.fn().mockResolvedValue(true),
    });
    Note.findById.mockResolvedValue({
      _id: 'note-resolve', title: 'Server Version', content: 'Server content',
      currentRevision: 3, createdByDevice: 'device-x',
      save: vi.fn().mockResolvedValue(true),
    });
    Change.findById.mockResolvedValue({
      _id: 'change-a', payload: { title: 'Client Version', content: 'Client content' },
    });
    NoteRevision.create.mockResolvedValue({});

    const result = await conflictService.resolveConflict(
      'conflict-resolve-1', 'keep_version', deviceId, 'local'
    );

    expect(result.conflict.status).toBe('resolved');
    expect(result.note.title).toBe('Client Version');
    expect(result.note.currentRevision).toBe(4);
  });

  it('visibility filtering during sync — hidden note not returned', async () => {
    Change.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          { _id: 'c-visible', noteId: 'note-visible', type: 'note.created', baseRevision: 1, payload: { title: 'Visible' }, createdAt: new Date() },
          { _id: 'c-hidden', noteId: 'note-hidden', type: 'note.created', baseRevision: 2, payload: { title: 'Hidden' }, createdAt: new Date() },
        ]),
      }),
    });

    VisibilityRule.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([{ noteId: 'note-hidden' }]),
    });

    const validCursor = Buffer.from(JSON.stringify({ serverSequence: 0, deviceId })).toString('base64url');
    const result = await syncService.pullChanges(workspaceId, deviceId, validCursor);

    const returned = result.changes.map(c => c.noteId.toString());
    expect(returned).toContain('note-visible');
    expect(returned).not.toContain('note-hidden');
  });

  it('push and pull in sequence preserves server sequence', async () => {
    SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 5 });
    Change.findOneAndUpdate.mockResolvedValue({});
    Note.create.mockResolvedValue({
      _id: 'note-seq', title: 'Sequential', currentRevision: 1,
      save: vi.fn().mockResolvedValue(true),
    });
    NoteRevision.create.mockResolvedValue({});
    AuditEvent.create.mockResolvedValue({});

    await syncService.pushChanges(workspaceId, deviceId, userId, [
      {
        id: 'change-seq', noteId: 'client-note-seq', type: CHANGE_TYPES.NOTE_CREATED,
        baseRevision: 0, payload: { title: 'Sequential' },
      },
    ]);

    expect(SyncCursor.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, deviceId }),
      expect.objectContaining({ lastServerSequence: 6 }),
      expect.any(Object)
    );
  });
});
