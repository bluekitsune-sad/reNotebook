import { Conflict, Note, NoteRevision, Change } from '../models/index.js';
import { notFound, badRequest, ERROR_CODES, CONFLICT_STATUS, CONFLICT_RESOLUTION } from '@synced-notepad/shared';

export async function listConflicts(workspaceId) {
  const conflicts = await Conflict.find({ workspaceId, status: CONFLICT_STATUS.PENDING })
    .populate('noteId', 'title content currentRevision')
    .populate('deviceA', 'name type')
    .populate('deviceB', 'name type')
    .sort({ createdAt: -1 });

  return { conflicts };
}

export async function resolveConflict(conflictId, resolution, deviceId, chosenVersion) {
  const conflict = await Conflict.findById(conflictId);
  if (!conflict) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'Conflict not found');
  }

  if (conflict.status === CONFLICT_STATUS.RESOLVED) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Conflict already resolved');
  }

  if (!Object.values(CONFLICT_RESOLUTION).includes(resolution)) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Invalid resolution type');
  }

  const note = await Note.findById(conflict.noteId);
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note associated with conflict not found');
  }

  if (resolution === CONFLICT_RESOLUTION.KEEP_VERSION) {
    if (!chosenVersion) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'chosenVersion required for keep_version');
    }

    const changeId = chosenVersion === 'local' ? conflict.changeIdA : conflict.changeIdB;
    const change = await Change.findById(changeId);

    if (change && change.payload) {
      note.title = change.payload.title ?? note.title;
      note.content = change.payload.content ?? note.content;
      note.folder = change.payload.folder ?? note.folder;
    }
  } else if (resolution === CONFLICT_RESOLUTION.MERGE) {
    const changeA = await Change.findById(conflict.changeIdA);
    const changeB = await Change.findById(conflict.changeIdB);

    if (changeA?.payload || changeB?.payload) {
      const merged = mergeChanges(
        changeA?.payload || { title: note.title, content: note.content },
        changeB?.payload || { title: note.title, content: note.content },
      );
      note.title = merged.title ?? note.title;
      note.content = merged.content ?? note.content;
      note.folder = merged.folder ?? note.folder;
    }
  } else if (resolution === CONFLICT_RESOLUTION.KEEP_BOTH) {
    const newNote = await Note.create({
      workspaceId: conflict.workspaceId,
      title: `${note.title} (copy)`,
      content: note.content,
      folder: note.folder,
      status: 'active',
      createdByDevice: deviceId,
      currentRevision: 1,
    });

    await NoteRevision.create({
      noteId: newNote._id,
      workspaceId: conflict.workspaceId,
      revision: 1,
      title: newNote.title,
      content: newNote.content,
      folder: newNote.folder,
      createdByDevice: deviceId,
    });
  }

  const newRevision = note.currentRevision + 1;
  note.currentRevision = newRevision;
  note.createdByDevice = deviceId;
  await note.save();

  await NoteRevision.create({
    noteId: note._id,
    workspaceId: conflict.workspaceId,
    revision: newRevision,
    title: note.title,
    content: note.content,
    folder: note.folder,
    createdByDevice: deviceId,
  });

  conflict.status = CONFLICT_STATUS.RESOLVED;
  conflict.resolution = resolution;
  conflict.resolvedBy = deviceId;
  conflict.resolvedAt = new Date();
  await conflict.save();

  return { conflict, note };
}

function mergeChanges(payloadA, payloadB) {
  return {
    title: payloadA.title || payloadB.title,
    content: payloadA.content || payloadB.content,
    folder: payloadA.folder || payloadB.folder,
  };
}
