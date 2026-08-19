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

import { VisibilityRule, Note } from '../../src/models/index.js';
import * as visibilityService from '../../src/services/visibilityService.js';

const workspaceId = 'ws-1';
const noteId = 'note-1';
const deviceA = 'device-A';
const deviceB = 'device-B';

describe('Visibility rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Set visibility rule → note hidden from device', () => {
    it('creates a rule that hides note from a specific device', async () => {
      Note.findOne.mockResolvedValue({ _id: noteId, workspaceId });
      VisibilityRule.findOneAndUpdate.mockResolvedValue({
        _id: 'rule-1',
        workspaceId,
        noteId,
        deviceId: deviceA,
        visible: false,
      });

      const result = await visibilityService.setVisibilityRule(
        workspaceId, noteId, deviceA, false
      );

      expect(result.rule.visible).toBe(false);
      expect(result.rule.noteId).toBe(noteId);
      expect(result.rule.deviceId).toBe(deviceA);
    });

    it('upserts rule for same note+device pair', async () => {
      Note.findOne.mockResolvedValue({ _id: noteId, workspaceId });
      VisibilityRule.findOneAndUpdate.mockResolvedValue({
        _id: 'rule-existing',
        workspaceId,
        noteId,
        deviceId: deviceA,
        visible: true,
      });

      await visibilityService.setVisibilityRule(
        workspaceId, noteId, deviceA, true
      );

      expect(VisibilityRule.findOneAndUpdate).toHaveBeenCalledWith(
        { noteId, deviceId: deviceA },
        expect.objectContaining({ visible: true }),
        expect.any(Object)
      );
    });

    it('throws if note does not exist', async () => {
      Note.findOne.mockResolvedValue(null);

      await expect(
        visibilityService.setVisibilityRule(workspaceId, 'missing-note', deviceA, false)
      ).rejects.toThrow('Note not found');
    });
  });

  describe('Get hidden note IDs', () => {
    it('returns list of hidden note IDs for a device', async () => {
      const chain = {
        select: vi.fn().mockResolvedValue([
          { noteId: 'note-hidden-1' },
          { noteId: 'note-hidden-2' },
        ]),
      };
      VisibilityRule.find.mockReturnValue(chain);

      const hidden = await visibilityService.getHiddenNoteIds(deviceA);

      expect(hidden).toEqual(['note-hidden-1', 'note-hidden-2']);
    });

    it('returns empty list when no rules exist', async () => {
      const chain = {
        select: vi.fn().mockResolvedValue([]),
      };
      VisibilityRule.find.mockReturnValue(chain);

      const hidden = await visibilityService.getHiddenNoteIds(deviceA);

      expect(hidden).toEqual([]);
    });
  });

  describe('Remove visibility rule → note visible again', () => {
    it('removes rule and returns success', async () => {
      VisibilityRule.findOneAndDelete.mockResolvedValue({
        _id: 'rule-1',
        noteId,
        deviceId: deviceA,
      });

      const result = await visibilityService.removeVisibilityRule(noteId, deviceA);

      expect(result.success).toBe(true);
      expect(VisibilityRule.findOneAndDelete).toHaveBeenCalledWith({ noteId, deviceId: deviceA });
    });

    it('throws when rule does not exist', async () => {
      VisibilityRule.findOneAndDelete.mockResolvedValue(null);

      await expect(
        visibilityService.removeVisibilityRule('missing-note', deviceA)
      ).rejects.toThrow('Visibility rule not found');
    });
  });

  describe('isNoteVisibleToDevice', () => {
    it('returns true when no rule exists', async () => {
      VisibilityRule.findOne.mockReturnValue({
        then: (resolve) => resolve(null),
      });

      const visible = await visibilityService.isNoteVisibleToDevice(noteId, deviceA);

      expect(visible).toBe(true);
    });

    it('returns false when rule says hidden', async () => {
      VisibilityRule.findOne.mockReturnValue({
        then: (resolve) => resolve({ visible: false }),
      });

      const visible = await visibilityService.isNoteVisibleToDevice(noteId, deviceA);

      expect(visible).toBe(false);
    });

    it('returns true when rule says visible', async () => {
      VisibilityRule.findOne.mockReturnValue({
        then: (resolve) => resolve({ visible: true }),
      });

      const visible = await visibilityService.isNoteVisibleToDevice(noteId, deviceA);

      expect(visible).toBe(true);
    });
  });

  describe('Multiple devices, different visibility per device', () => {
    it('device A sees hidden, device B does not', async () => {
      const chainA = {
        select: vi.fn().mockResolvedValue([{ noteId: 'note-1' }]),
      };
      const chainB = {
        select: vi.fn().mockResolvedValue([]),
      };

      VisibilityRule.find
        .mockReturnValueOnce(chainA)
        .mockReturnValueOnce(chainB);

      const hiddenA = await visibilityService.getHiddenNoteIds(deviceA);
      const hiddenB = await visibilityService.getHiddenNoteIds(deviceB);

      expect(hiddenA).toContain('note-1');
      expect(hiddenB).toHaveLength(0);
    });

    it('different notes hidden per device', async () => {
      const chainA = {
        select: vi.fn().mockResolvedValue([{ noteId: 'note-x' }]),
      };
      const chainB = {
        select: vi.fn().mockResolvedValue([{ noteId: 'note-y' }]),
      };

      VisibilityRule.find
        .mockReturnValueOnce(chainA)
        .mockReturnValueOnce(chainB);

      const hiddenA = await visibilityService.getHiddenNoteIds(deviceA);
      const hiddenB = await visibilityService.getHiddenNoteIds(deviceB);

      expect(hiddenA).toEqual(['note-x']);
      expect(hiddenB).toEqual(['note-y']);
    });
  });

  describe('Sync pull filters hidden notes', () => {
    it('sync service filters out notes hidden from the requesting device', async () => {
      const syncService = await import('../../src/services/syncService.js');
      const { Change, SyncCursor } = await import('../../src/models/index.js');

      SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 0 });

      Change.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { _id: 'c1', noteId: 'note-visible', type: 'note.created', baseRevision: 1, payload: { title: 'Visible' }, createdAt: new Date() },
            { _id: 'c2', noteId: 'note-hidden', type: 'note.created', baseRevision: 2, payload: { title: 'Hidden' }, createdAt: new Date() },
          ]),
        }),
      });

      const hiddenChain = {
        select: vi.fn().mockResolvedValue([{ noteId: 'note-hidden' }]),
      };
      VisibilityRule.find.mockReturnValue(hiddenChain);

      const validCursor = Buffer.from(JSON.stringify({ serverSequence: 0, deviceId: deviceA })).toString('base64url');
      const result = await syncService.pullChanges(workspaceId, deviceA, validCursor);

      const noteIds = result.changes.map(c => c.noteId.toString());
      expect(noteIds).toContain('note-visible');
      expect(noteIds).not.toContain('note-hidden');
    });
  });
});
