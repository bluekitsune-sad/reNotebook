import { Note, NoteRevision } from '../models/index.js';
import { notFound, badRequest, ERROR_CODES } from '@synced-notepad/shared';

export async function createNote(workspaceId, deviceId, data) {
  const note = await Note.create({
    workspaceId,
    title: data.title || '',
    content: data.content || '',
    folder: data.folder || '',
    status: 'active',
    createdByDevice: deviceId,
  });

  const revision = await NoteRevision.create({
    noteId: note._id,
    workspaceId,
    revision: 1,
    title: note.title,
    content: note.content,
    folder: note.folder,
    createdByDevice: deviceId,
  });

  note.currentRevision = 1;
  await note.save();

  return { note, revision };
}

export async function updateNote(workspaceId, noteId, deviceId, data) {
  const note = await Note.findOne({ _id: noteId, workspaceId, status: 'active' });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  if (data.baseRevision !== undefined && data.baseRevision !== note.currentRevision) {
    throw badRequest(ERROR_CODES.CONFLICT, 'Note has been modified by another device');
  }

  const newRevision = note.currentRevision + 1;

  if (data.title !== undefined) note.title = data.title;
  if (data.content !== undefined) note.content = data.content;
  if (data.folder !== undefined) note.folder = data.folder;
  note.currentRevision = newRevision;
  note.createdByDevice = deviceId;
  await note.save();

  const revision = await NoteRevision.create({
    noteId: note._id,
    workspaceId,
    revision: newRevision,
    title: note.title,
    content: note.content,
    folder: note.folder,
    createdByDevice: deviceId,
  });

  return { note, revision };
}

export async function deleteNote(workspaceId, noteId) {
  const note = await Note.findOne({ _id: noteId, workspaceId, status: 'active' });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  note.status = 'deleted';
  note.deletedAt = new Date();
  await note.save();

  return { success: true };
}

export async function restoreNote(workspaceId, noteId) {
  const note = await Note.findOne({ _id: noteId, workspaceId, status: 'deleted' });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found or not deleted');
  }

  note.status = 'active';
  note.deletedAt = undefined;
  await note.save();

  return { note };
}

export async function listNotes(workspaceId) {
  const notes = await Note.find({ workspaceId, status: 'active' }).sort({ updatedAt: -1 });
  return { notes };
}

export async function getNoteById(workspaceId, noteId) {
  const note = await Note.findOne({ _id: noteId, workspaceId });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }
  return { note };
}

export async function getNoteRevisions(workspaceId, noteId) {
  const note = await Note.findOne({ _id: noteId, workspaceId });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  const revisions = await NoteRevision.find({ noteId, workspaceId }).sort({ revision: -1 });
  return { revisions };
}
