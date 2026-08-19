import { Router } from 'express';
import { syncRequestSchema } from '@synced-notepad/validation';
import { validate } from '../middleware/validation.js';
import * as syncService from '../services/syncService.js';

const router = Router();

router.post('/', validate(syncRequestSchema), async (req, res, next) => {
  try {
    const { workspaceId, cursor, changes: clientChanges, appVersion, syncProtocolVersion } = req.validated;

    if (syncProtocolVersion !== 1) {
      return res.status(400).json({
        error: { code: 'SYNC_PROTOCOL_UNSUPPORTED', message: 'Unsupported sync protocol version' },
      });
    }

    const { changes: serverChanges, lastSeq } = await syncService.pullChanges(
      workspaceId,
      req.device.id,
      cursor,
    );

    const { accepted, conflicts, cursor: newCursor } = await syncService.pushChanges(
      workspaceId,
      req.device.id,
      req.user.id,
      clientChanges || [],
    );

    res.json({
      changes: serverChanges.map((c) => ({
        id: c._id,
        noteId: c.noteId,
        type: c.type,
        baseRevision: c.baseRevision,
        payload: c.payload,
        createdAt: c.createdAt,
      })),
      cursor: newCursor,
      accepted,
      conflicts,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
