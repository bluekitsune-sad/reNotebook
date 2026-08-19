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

import { Conflict, Note, Change, NoteRevision } from '../../src/models/index.js';
import * as conflictService from '../../src/services/conflictService.js';
import { CONFLICT_STATUS, CONFLICT_RESOLUTION } from '@synced-notepad/shared';

const workspaceId = 'ws-1';
const deviceId = 'device-resolver';

function setupConflict(overrides = {}) {
  return {
    _id: overrides.conflictId || 'conflict-1',
    status: CONFLICT_STATUS.PENDING,
    noteId: overrides.noteId || 'note-1',
    changeIdA: overrides.changeIdA || 'change-a',
    changeIdB: overrides.changeIdB || 'change-b',
    workspaceId,
    save: vi.fn().mockResolvedValue(true),
  };
}

function setupNote(overrides = {}) {
  return {
    _id: overrides.noteId || 'note-1',
    workspaceId,
    title: overrides.title || 'Original Title',
    content: overrides.content || 'Original content',
    folder: overrides.folder || '',
    currentRevision: overrides.currentRevision || 2,
    createdByDevice: 'device-other',
    save: vi.fn().mockResolvedValue(true),
  };
}

describe('Conflict resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('keep_version: chosen version becomes new revision', () => {
    it('keeps local version when chosenVersion is local', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Change.findById.mockResolvedValue({
        _id: 'change-a',
        payload: { title: 'Local Version', content: 'Local content' },
      });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_VERSION, deviceId, 'local'
      );

      expect(result.conflict.status).toBe(CONFLICT_STATUS.RESOLVED);
      expect(result.conflict.resolution).toBe('keep_version');
      expect(result.conflict.resolvedBy).toBe(deviceId);
      expect(result.conflict.resolvedAt).toBeDefined();
      expect(result.note.title).toBe('Local Version');
      expect(result.note.content).toBe('Local content');
    });

    it('keeps remote version when chosenVersion is remote', async () => {
      Conflict.findById.mockResolvedValue(setupConflict({
        changeIdA: 'change-a',
        changeIdB: 'change-b',
      }));
      Note.findById.mockResolvedValue(setupNote());
      Change.findById.mockResolvedValue({
        _id: 'change-b',
        payload: { title: 'Remote Version', content: 'Remote content' },
      });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_VERSION, deviceId, 'remote'
      );

      expect(result.note.title).toBe('Remote Version');
      expect(result.note.content).toBe('Remote content');
    });

    it('increments revision number', async () => {
      Conflict.findById.mockResolvedValue(setupConflict({ noteId: 'note-rev' }));
      Note.findById.mockResolvedValue(setupNote({ noteId: 'note-rev', currentRevision: 5 }));
      Change.findById.mockResolvedValue({
        _id: 'change-a',
        payload: { title: 'Kept' },
      });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_VERSION, deviceId, 'local'
      );

      expect(result.note.currentRevision).toBe(6);
    });

    it('requires chosenVersion', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());

      await expect(
        conflictService.resolveConflict('conflict-1', CONFLICT_RESOLUTION.KEEP_VERSION, deviceId)
      ).rejects.toThrow('chosenVersion required');
    });
  });

  describe('merge: merged content becomes new revision', () => {
    it('merges payloads from both changes', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Change.findById
        .mockResolvedValueOnce({
          _id: 'change-a',
          payload: { title: 'Merged Title', content: 'From A' },
        })
        .mockResolvedValueOnce({
          _id: 'change-b',
          payload: { title: 'Title B', content: 'From B' },
        });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.MERGE, deviceId
      );

      expect(result.conflict.status).toBe(CONFLICT_STATUS.RESOLVED);
      expect(result.conflict.resolution).toBe('merge');
      expect(result.note.currentRevision).toBe(3);
    });

    it('handles null payloads gracefully', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Change.findById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.MERGE, deviceId
      );

      expect(result.conflict.status).toBe(CONFLICT_STATUS.RESOLVED);
    });
  });

  describe('keep_both: duplicate note created', () => {
    it('creates a copy of the note', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Note.create.mockResolvedValue({
        _id: 'note-copy',
        title: 'Original Title (copy)',
        content: 'Original content',
        save: vi.fn().mockResolvedValue(true),
      });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_BOTH, deviceId
      );

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('(copy)'),
          status: 'active',
          workspaceId,
        })
      );
      expect(result.conflict.status).toBe(CONFLICT_STATUS.RESOLVED);
    });

    it('creates revision for the copy', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Note.create.mockResolvedValue({
        _id: 'note-copy',
        title: 'Copy',
        content: 'Content',
        save: vi.fn().mockResolvedValue(true),
      });
      NoteRevision.create.mockResolvedValue({});

      await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_BOTH, deviceId
      );

      expect(NoteRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          revision: 1,
        })
      );
    });

    it('increments revision on original note', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      const note = setupNote();
      Note.findById.mockResolvedValue(note);
      Note.create.mockResolvedValue({ _id: 'copy', save: vi.fn() });
      NoteRevision.create.mockResolvedValue({});

      await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_BOTH, deviceId
      );

      expect(note.currentRevision).toBe(3);
    });
  });

  describe('Conflict status changes to resolved', () => {
    it('sets resolved status and timestamp', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());
      Note.findById.mockResolvedValue(setupNote());
      Change.findById.mockResolvedValue({
        _id: 'change-a',
        payload: { title: 'Kept' },
      });
      NoteRevision.create.mockResolvedValue({});

      const result = await conflictService.resolveConflict(
        'conflict-1', CONFLICT_RESOLUTION.KEEP_VERSION, deviceId, 'local'
      );

      expect(result.conflict.status).toBe('resolved');
      expect(result.conflict.resolvedAt).toBeInstanceOf(Date);
      expect(result.conflict.resolvedBy).toBe(deviceId);
    });
  });

  describe('Error cases', () => {
    it('rejects non-existent conflict', async () => {
      Conflict.findById.mockResolvedValue(null);

      await expect(
        conflictService.resolveConflict('missing', 'keep_version', deviceId, 'local')
      ).rejects.toThrow('Conflict not found');
    });

    it('rejects already-resolved conflict', async () => {
      Conflict.findById.mockResolvedValue({
        _id: 'conflict-done',
        status: CONFLICT_STATUS.RESOLVED,
      });

      await expect(
        conflictService.resolveConflict('conflict-done', 'keep_version', deviceId, 'local')
      ).rejects.toThrow('already resolved');
    });

    it('rejects invalid resolution type', async () => {
      Conflict.findById.mockResolvedValue(setupConflict());

      await expect(
        conflictService.resolveConflict('conflict-1', 'invalid_type', deviceId)
      ).rejects.toThrow('Invalid resolution type');
    });
  });
});
