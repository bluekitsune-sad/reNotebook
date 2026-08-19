import { Router } from 'express';
import * as conflictService from '../services/conflictService.js';
import { logEvent } from '../services/auditService.js';
import { badRequest, ERROR_CODES } from '@synced-notepad/shared';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { conflicts } = await conflictService.listConflicts(req.workspace.id);
    res.json({ conflicts });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resolve', async (req, res, next) => {
  try {
    const { resolution, chosenVersion } = req.body;

    if (!resolution) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'resolution is required');
    }

    const { conflict, note } = await conflictService.resolveConflict(
      req.params.id,
      resolution,
      req.device.id,
      chosenVersion,
    );

    await logEvent(
      req.workspace.id,
      req.user.id,
      req.device.id,
      'conflict.resolved',
      { conflictId: conflict._id, noteId: note._id, resolution },
    );

    res.json({ conflict, note });
  } catch (err) {
    next(err);
  }
});

export default router;
