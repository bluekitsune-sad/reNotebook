import { Change, Note, NoteRevision, SyncCursor, Conflict } from '../models/index.js';
import { badRequest, notFound, ERROR_CODES } from '@synced-notepad/shared';

export async function pullChanges(workspaceId, deviceId, cursor) {
  let serverChanges = [];
  let lastSeq = 0;

  const deviceCursor = await SyncCursor.findOne({ workspaceId, deviceId });
  lastSeq = deviceCursor?.lastServerSequence || 0;

  if (cursor) {
    const parsed = parseCursor(cursor);
    serverChanges = await Change.find({
      workspaceId,
      serverSequence: { $gt: parsed.serverSequence },
      status: 'accepted',
    })
      .sort({ serverSequence: 1 })
      .limit(500);
  }

  return { changes: serverChanges, lastSeq };
}

export async function pushChanges(workspaceId, deviceId, userId, changes) {
  const deviceCursor = await SyncCursor.findOne({ workspaceId, deviceId });
  let lastSeq = deviceCursor?.lastServerSequence || 0;

  const accepted = [];
  const conflicts = [];
  let seq = lastSeq;

  for (const change of changes) {
    const result = await processChange(workspaceId, deviceId, userId, change, seq);

    if (result.accepted) {
      seq++;
      accepted.push(change.id);
    } else if (result.conflict) {
      conflicts.push(result.conflict);
    }
  }

  const newCursor = encodeCursor(seq, deviceId);

  await SyncCursor.findOneAndUpdate(
    { workspaceId, deviceId },
    { lastServerSequence: seq, updatedAt: new Date() },
    { upsert: true }
  );

  return { accepted, conflicts, cursor: newCursor, lastSeq: seq };
}

export async function processChange(workspaceId, deviceId, userId, change, currentSeq) {
  if (change.type === 'note.created') {
    const newNote = await Note.create({
      workspaceId,
      title: change.payload.title || '',
      content: change.payload.content || '',
      folder: change.payload.folder || '',
      status: 'active',
      createdByDevice: deviceId,
    });

    await NoteRevision.create({
      noteId: newNote._id,
      workspaceId,
      revision: 1,
      title: newNote.title,
      content: newNote.content,
      folder: newNote.folder,
      createdByDevice: deviceId,
    });

    const seq = currentSeq + 1;
    await Change.findOneAndUpdate(
      { _id: change.id },
      { status: 'accepted', serverSequence: seq, processedAt: new Date() }
    );

    return { accepted: true, noteId: newNote._id, revision: 1 };
  }

  const note = await Note.findOne({ _id: change.noteId, workspaceId });
  if (!note) {
    return { accepted: false, reason: 'Note not found' };
  }

  const isConflict = detectConflict(note.currentRevision, change.baseRevision);
  if (isConflict) {
    const conflict = await createConflict(workspaceId, note._id, change, note);
    return { accepted: false, conflict };
  }

  const newRevision = note.currentRevision + 1;
  if (change.payload.title !== undefined) note.title = change.payload.title;
  if (change.payload.content !== undefined) note.content = change.payload.content;
  if (change.payload.folder !== undefined) note.folder = change.payload.folder;
  note.currentRevision = newRevision;
  note.createdByDevice = deviceId;
  await note.save();

  await NoteRevision.create({
    noteId: note._id,
    workspaceId,
    revision: newRevision,
    title: note.title,
    content: note.content,
    folder: note.folder,
    createdByDevice: deviceId,
  });

  const seq = currentSeq + 1;
  await Change.findOneAndUpdate(
    { _id: change.id },
    { status: 'accepted', serverSequence: seq, processedAt: new Date() }
  );

  return { accepted: true, noteId: note._id, revision: newRevision };
}

export function detectConflict(serverRevision, clientBaseRevision) {
  return serverRevision !== clientBaseRevision;
}

export async function createConflict(workspaceId, noteId, incomingChange, currentNote) {
  const conflict = await Conflict.create({
    workspaceId,
    noteId,
    changeIdA: incomingChange.id,
    changeIdB: null,
    deviceA: incomingChange.deviceId || incomingChange.createdByDevice,
    deviceB: currentNote.createdByDevice,
    status: 'pending',
  });

  await Change.findOneAndUpdate(
    { _id: incomingChange.id },
    { status: 'conflict', conflictId: conflict._id }
  );

  return {
    conflictId: conflict._id,
    changeId: incomingChange.id,
    noteId,
    serverVersion: {
      title: currentNote.title,
      content: currentNote.content,
      revision: currentNote.currentRevision,
    },
  };
}

export function encodeCursor(serverSequence, deviceId) {
  return Buffer.from(JSON.stringify({ serverSequence, deviceId })).toString('base64url');
}

export function parseCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Invalid sync cursor');
  }
}
