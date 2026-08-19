import { Router } from 'express';
import * as visibilityService from '../services/visibilityService.js';
import { logEvent } from '../services/auditService.js';
import { badRequest, ERROR_CODES } from '@synced-notepad/shared';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { noteId } = req.query;
    if (!noteId) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'noteId query parameter is required');
    }

    const { rules } = await visibilityService.getVisibilityRules(noteId);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

router.get('/device/:deviceId', async (req, res, next) => {
  try {
    const hiddenNoteIds = await visibilityService.getHiddenNoteIds(req.params.deviceId);
    res.json({ hiddenNoteIds });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { noteId, deviceId, visible } = req.body;

    if (!noteId || !deviceId || visible === undefined) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'noteId, deviceId, and visible are required');
    }

    const { rule } = await visibilityService.setVisibilityRule(
      req.workspace.id,
      noteId,
      deviceId,
      visible,
    );

    await logEvent(
      req.workspace.id,
      req.user.id,
      req.device.id,
      'note.visibility_changed',
      { noteId, deviceId, visible },
    );

    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const { noteId, deviceId } = req.body;

    if (!noteId || !deviceId) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'noteId and deviceId are required');
    }

    await visibilityService.removeVisibilityRule(noteId, deviceId);

    await logEvent(
      req.workspace.id,
      req.user.id,
      req.device.id,
      'note.visibility_changed',
      { noteId, deviceId, visible: null },
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
