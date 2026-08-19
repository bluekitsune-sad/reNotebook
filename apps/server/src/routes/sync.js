import { Router } from 'express';
import { syncRequestSchema } from '@synced-notepad/validation';
import { validate } from '../middleware/validation.js';
import { Change, Note, NoteRevision, SyncCursor, Conflict } from '../models/index.js';
import { detectConflict } from '@synced-notepad/sync-core';
import { encodeCursor, parseCursor } from '@synced-notepad/sync-core';

const router = Router();

router.post('/', validate(syncRequestSchema), async (req, res, next) => {
  try {
    const { workspaceId, cursor, changes: clientChanges, appVersion, syncProtocolVersion } = req.validated;

    if (syncProtocolVersion !== 1) {
      return res.status(400).json({
        error: { code: 'SYNC_PROTOCOL_UNSUPPORTED', message: 'Unsupported sync protocol version' },
      });
    }

    const deviceCursor = await SyncCursor.findOne({ workspaceId, deviceId: req.device.id });
    const lastSeq = deviceCursor?.lastServerSequence || 0;

    let serverChanges = [];
    if (cursor) {
      const parsed = parseCursor(cursor);
      serverChanges = await Change.find({
        workspaceId,
        serverSequence: { $gt: parsed.serverSequence },
        status: 'accepted',
      }).sort({ serverSequence: 1 }).limit(100);
    }

    const accepted = [];
    const conflicts = [];

    if (clientChanges?.length) {
      for (const change of clientChanges) {
        const note = await Note.findOne({ _id: change.noteId, workspaceId });

        if (change.type === 'note.created') {
          const newNote = new Note({
            workspaceId,
            title: change.payload.title || '',
            content: change.payload.content || '',
            folder: change.payload.folder || '',
            status: 'active',
            createdByDevice: req.device.id,
          });
          await newNote.save();

          const rev = new NoteRevision({
            noteId: newNote._id,
            workspaceId,
            revision: 1,
            title: newNote.title,
            content: newNote.content,
            folder: newNote.folder,
            createdByDevice: req.device.id,
          });
          await rev.save();

          const seq = lastSeq + 1;
          const serverChange = await Change.findOneAndUpdate(
            { _id: change.id },
            {
              status: 'accepted',
              serverSequence: seq,
              processedAt: new Date(),
            },
            { new: true }
          );

          accepted.push(change.id);
          continue;
        }

        if (!note) {
          continue;
        }

        if (detectConflict(note.currentRevision, change.baseRevision)) {
          const conflict = new Conflict({
            workspaceId,
            noteId: note._id,
            changeIdA: change.id,
            changeIdB: null,
            deviceA: req.device.id,
            deviceB: note.createdByDevice,
            status: 'pending',
          });
          await conflict.save();

          await Change.findOneAndUpdate(
            { _id: change.id },
            { status: 'conflict', conflictId: conflict._id },
          );

          conflicts.push({ changeId: change.id, serverVersion: { title: note.title, content: note.content } });
          continue;
        }

        const newRevision = note.currentRevision + 1;
        if (change.payload.title !== undefined) note.title = change.payload.title;
        if (change.payload.content !== undefined) note.content = change.payload.content;
        if (change.payload.folder !== undefined) note.folder = change.payload.folder;
        note.currentRevision = newRevision;
        note.createdByDevice = req.device.id;
        await note.save();

        const rev = new NoteRevision({
          noteId: note._id,
          workspaceId,
          revision: newRevision,
          title: note.title,
          content: note.content,
          folder: note.folder,
          createdByDevice: req.device.id,
        });
        await rev.save();

        const seq = lastSeq + 1;
        await Change.findOneAndUpdate(
          { _id: change.id },
          { status: 'accepted', serverSequence: seq, processedAt: new Date() },
        );

        accepted.push(change.id);
      }
    }

    const newSeq = lastSeq + (clientChanges?.length || 0);
    const newCursor = encodeCursor(newSeq, req.device.id);

    await SyncCursor.findOneAndUpdate(
      { workspaceId, deviceId: req.device.id },
      { lastServerSequence: newSeq, updatedAt: new Date() },
      { upsert: true },
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
