import { Router } from 'express';
import { noteCreateSchema, noteUpdateSchema } from '@synced-notepad/validation';
import { validate } from '../middleware/validation.js';
import { Note, NoteRevision } from '../models/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const notes = await Note.find({
      workspaceId: req.workspace.id,
      status: 'active',
    }).sort({ updatedAt: -1 });

    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      workspaceId: req.workspace.id,
    });

    if (!note) {
      return res.status(404).json({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found' } });
    }

    res.json({ note });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(noteCreateSchema), async (req, res, next) => {
  try {
    const note = new Note({
      workspaceId: req.workspace.id,
      title: req.validated.title || '',
      content: req.validated.content || '',
      folder: req.validated.folder || '',
      createdByDevice: req.device.id,
    });

    await note.save();

    const revision = new NoteRevision({
      noteId: note._id,
      workspaceId: req.workspace.id,
      revision: 1,
      title: note.title,
      content: note.content,
      folder: note.folder,
      createdByDevice: req.device.id,
    });

    await revision.save();
    note.currentRevision = 1;
    await note.save();

    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(noteUpdateSchema), async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      workspaceId: req.workspace.id,
      status: 'active',
    });

    if (!note) {
      return res.status(404).json({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found' } });
    }

    const newRevision = note.currentRevision + 1;

    if (req.validated.title !== undefined) note.title = req.validated.title;
    if (req.validated.content !== undefined) note.content = req.validated.content;
    if (req.validated.folder !== undefined) note.folder = req.validated.folder;
    note.currentRevision = newRevision;
    await note.save();

    const revision = new NoteRevision({
      noteId: note._id,
      workspaceId: req.workspace.id,
      revision: newRevision,
      title: note.title,
      content: note.content,
      folder: note.folder,
      createdByDevice: req.device.id,
    });

    await revision.save();
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      workspaceId: req.workspace.id,
      status: 'active',
    });

    if (!note) {
      return res.status(404).json({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found' } });
    }

    note.status = 'deleted';
    note.deletedAt = new Date();
    await note.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/revisions', async (req, res, next) => {
  try {
    const revisions = await NoteRevision.find({
      noteId: req.params.id,
      workspaceId: req.workspace.id,
    }).sort({ revision: -1 });

    res.json({ revisions });
  } catch (err) {
    next(err);
  }
});

export default router;
