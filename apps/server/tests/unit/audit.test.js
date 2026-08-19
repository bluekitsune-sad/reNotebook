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

import { AuditEvent, Note, NoteRevision, Device, PairingSession, Change, Conflict, SyncCursor } from '../../src/models/index.js';
import * as auditService from '../../src/services/auditService.js';

const workspaceId = 'ws-1';
const userId = 'user-1';
const deviceId = 'device-1';

describe('Audit event logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Note creation logged', () => {
    it('creates audit event for note.created', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-1',
        eventType: 'note.created',
        workspaceId,
        userId,
        deviceId,
        serverTimestamp: new Date(),
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'note.created', {
        noteId: 'note-1',
        revision: 1,
      });

      expect(event).toBeDefined();
      expect(event.eventType).toBe('note.created');
      expect(AuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          userId,
          deviceId,
          eventType: 'note.created',
          details: { noteId: 'note-1', revision: 1 },
        })
      );
    });
  });

  describe('Note edit logged', () => {
    it('creates audit event for note.updated', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-2',
        eventType: 'note.updated',
        workspaceId,
        deviceId,
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'note.updated', {
        noteId: 'note-1',
        revision: 3,
      });

      expect(event.eventType).toBe('note.updated');
    });

    it('creates audit event for note.deleted', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-3',
        eventType: 'note.deleted',
        workspaceId,
        deviceId,
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'note.deleted', {
        noteId: 'note-1',
      });

      expect(event.eventType).toBe('note.deleted');
    });

    it('creates audit event for note.restored', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-4',
        eventType: 'note.restored',
        workspaceId,
        deviceId,
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'note.restored', {
        noteId: 'note-1',
      });

      expect(event.eventType).toBe('note.restored');
    });
  });

  describe('Device pairing logged', () => {
    it('creates audit event for device.paired', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-5',
        eventType: 'device.paired',
        workspaceId,
        deviceId,
        details: { newDeviceId: 'device-new' },
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'device.paired', {
        newDeviceId: 'device-new',
      });

      expect(event.eventType).toBe('device.paired');
      expect(event.details.newDeviceId).toBe('device-new');
    });
  });

  describe('Device revocation logged', () => {
    it('creates audit event for device.revoked', async () => {
      AuditEvent.create.mockResolvedValue({
        _id: 'event-6',
        eventType: 'device.revoked',
        workspaceId,
        deviceId,
        details: { revokedDeviceId: 'device-revoked' },
      });

      const event = await auditService.logEvent(workspaceId, userId, deviceId, 'device.revoked', {
        revokedDeviceId: 'device-revoked',
      });

      expect(event.eventType).toBe('device.revoked');
      expect(event.details.revokedDeviceId).toBe('device-revoked');
    });
  });

  describe('Events have correct timestamps and device attribution', () => {
    it('includes serverTimestamp in audit event', async () => {
      const before = new Date();
      AuditEvent.create.mockResolvedValue({
        _id: 'event-7',
        eventType: 'note.created',
        serverTimestamp: new Date(),
      });

      await auditService.logEvent(workspaceId, userId, deviceId, 'note.created', {});

      const createCall = AuditEvent.create.mock.calls[0][0];
      expect(createCall.serverTimestamp).toBeInstanceOf(Date);
      expect(createCall.serverTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('includes deviceId and userId in every event', async () => {
      AuditEvent.create.mockResolvedValue({ _id: 'event-8' });

      await auditService.logEvent(workspaceId, userId, deviceId, 'conflict.resolved', {
        conflictId: 'c-1',
      });

      const createCall = AuditEvent.create.mock.calls[0][0];
      expect(createCall.deviceId).toBe(deviceId);
      expect(createCall.userId).toBe(userId);
      expect(createCall.workspaceId).toBe(workspaceId);
    });

    it('preserves details object', async () => {
      AuditEvent.create.mockResolvedValue({ _id: 'event-9' });

      const details = { noteId: 'n-1', revision: 5, field: 'title' };
      await auditService.logEvent(workspaceId, userId, deviceId, 'note.updated', details);

      const createCall = AuditEvent.create.mock.calls[0][0];
      expect(createCall.details).toEqual(details);
    });
  });

  describe('Audit event creation is fault-tolerant', () => {
    it('returns null when AuditEvent.create fails', async () => {
      AuditEvent.create.mockRejectedValue(new Error('DB write failed'));

      const result = await auditService.logEvent(workspaceId, userId, deviceId, 'note.created', {});

      expect(result).toBeNull();
    });
  });

  describe('Conflict resolution logs audit', () => {
    it('syncService.pushChanges logs conflict.created when conflict occurs', async () => {
      const syncService = await import('../../src/services/syncService.js');

      Note.findOne.mockResolvedValue({
        _id: 'note-1', currentRevision: 3, title: 'Server Title',
        content: 'Server content', createdByDevice: 'device-srv',
      });
      AuditEvent.create.mockResolvedValue({ _id: 'event-conflict' });

      await syncService.pushChanges(workspaceId, deviceId, userId, [
        {
          id: 'change-c', noteId: 'note-1', type: 'note.updated',
          baseRevision: 1, payload: { title: 'Client' },
        },
      ]);

      const calls = AuditEvent.create.mock.calls;
      const conflictLog = calls.find(c => c[0].eventType === 'conflict.created');
      expect(conflictLog).toBeDefined();
    });

    it('syncService.pushChanges logs note.created for accepted creation', async () => {
      const syncService = await import('../../src/services/syncService.js');

      SyncCursor.findOne.mockResolvedValue({ lastServerSequence: 0 });
      Note.create.mockResolvedValue({
        _id: 'note-new', title: 'New', currentRevision: 1,
        save: vi.fn().mockResolvedValue(true),
      });
      NoteRevision.create.mockResolvedValue({});
      Change.findOneAndUpdate.mockResolvedValue({});
      AuditEvent.create.mockResolvedValue({});

      await syncService.pushChanges(workspaceId, deviceId, userId, [
        {
          id: 'change-create', noteId: 'client-1', type: 'note.created',
          baseRevision: 0, payload: { title: 'New' },
        },
      ]);

      expect(AuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'note.created' })
      );
    });
  });

  describe('getAuditEvents with filters', () => {
    it('filters by eventType', async () => {
      const chain = {
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockResolvedValue([
                  { _id: 'e1', eventType: 'note.created' },
                ]),
              }),
            }),
          }),
        }),
      };
      AuditEvent.find.mockReturnValue(chain);
      AuditEvent.countDocuments.mockResolvedValue(1);

      const result = await auditService.getAuditEvents(workspaceId, {
        eventType: 'note.created',
      });

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('supports pagination', async () => {
      const chain = {
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockResolvedValue([
                  { _id: 'e5', eventType: 'note.updated' },
                  { _id: 'e4', eventType: 'note.updated' },
                ]),
              }),
            }),
          }),
        }),
      };
      AuditEvent.find.mockReturnValue(chain);
      AuditEvent.countDocuments.mockResolvedValue(10);

      const result = await auditService.getAuditEvents(workspaceId, {
        limit: 2,
        offset: 4,
      });

      expect(result.events).toHaveLength(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(4);
      expect(result.total).toBe(10);
    });

    it('filters by noteId', async () => {
      const chain = {
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockResolvedValue([
                  { _id: 'e-note', noteId: 'note-filter-1' },
                ]),
              }),
            }),
          }),
        }),
      };
      AuditEvent.find.mockReturnValue(chain);
      AuditEvent.countDocuments.mockResolvedValue(1);

      const result = await auditService.getAuditEvents(workspaceId, {
        noteId: 'note-filter-1',
      });

      expect(result.events).toHaveLength(1);
    });
  });
});
