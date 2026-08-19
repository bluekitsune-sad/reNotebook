import { AuditEvent } from '../models/index.js';
import { logger } from '../utils/logger.js';

export async function logEvent(workspaceId, userId, deviceId, eventType, details = {}) {
  try {
    const event = await AuditEvent.create({
      workspaceId,
      userId,
      deviceId,
      eventType,
      details,
      serverTimestamp: new Date(),
    });

    logger.debug(`Audit: ${eventType} by device ${deviceId} in workspace ${workspaceId}`);

    return event;
  } catch (err) {
    logger.error('Failed to create audit event:', err.message);
    return null;
  }
}

export async function getAuditEvents(workspaceId, { limit = 50, offset = 0, eventType, noteId } = {}) {
  const query = { workspaceId };

  if (eventType) query.eventType = eventType;
  if (noteId) query.noteId = noteId;

  const events = await AuditEvent.find(query)
    .sort({ serverTimestamp: -1 })
    .skip(offset)
    .limit(limit)
    .populate('deviceId', 'name type')
    .populate('userId', 'displayName');

  const total = await AuditEvent.countDocuments(query);

  return { events, total, limit, offset };
}
