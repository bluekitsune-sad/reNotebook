import { AuditEvent, NoteRevision, Note } from '../models/index.js';
import { notFound, ERROR_CODES } from '@synced-notepad/shared';

export async function getAuditEvents(workspaceId, { limit = 50, offset = 0, eventType, noteId, deviceId } = {}) {
  const query = { workspaceId };

  if (eventType) query.eventType = eventType;
  if (noteId) query.noteId = noteId;
  if (deviceId) query.deviceId = deviceId;

  const events = await AuditEvent.find(query)
    .sort({ serverTimestamp: -1 })
    .skip(offset)
    .limit(limit)
    .populate('deviceId', 'name type')
    .populate('userId', 'displayName');

  const total = await AuditEvent.countDocuments(query);

  return { events, total, limit, offset };
}

export async function getNoteHistory(noteId) {
  const note = await Note.findById(noteId);
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  const revisions = await NoteRevision.find({ noteId }).sort({ revision: -1 });
  const auditEvents = await AuditEvent.find({ noteId }).sort({ serverTimestamp: -1 });

  return { note, revisions, auditEvents };
}

export async function getNoteRevisions(noteId) {
  const note = await Note.findById(noteId);
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  const revisions = await NoteRevision.find({ noteId })
    .sort({ revision: -1 })
    .populate('createdByDevice', 'name type');

  return { note, revisions };
}
