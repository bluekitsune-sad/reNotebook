import { Router } from 'express';
import * as historyService from '../services/historyService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, eventType, noteId, deviceId } = req.query;

    const result = await historyService.getAuditEvents(req.workspace.id, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      eventType,
      noteId,
      deviceId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/note/:noteId', async (req, res, next) => {
  try {
    const result = await historyService.getNoteHistory(req.params.noteId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/revision/:noteId', async (req, res, next) => {
  try {
    const result = await historyService.getNoteRevisions(req.params.noteId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
