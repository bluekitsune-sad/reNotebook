import mongoose from 'mongoose';
import { logger } from './logger.js';

const INDEX_DEFINITIONS = [
  {
    collection: 'changes',
    indexes: [
      { key: { workspaceId: 1, serverSequence: 1 }, name: 'changes_workspace_sequence' },
      { key: { deviceId: 1, status: 1 }, name: 'changes_device_status' },
      { key: { noteId: 1 }, name: 'changes_note' },
    ],
  },
  {
    collection: 'notes',
    indexes: [
      { key: { workspaceId: 1, updatedAt: -1 }, name: 'notes_workspace_updated' },
      { key: { workspaceId: 1, _id: 1 }, name: 'notes_workspace_id' },
    ],
  },
  {
    collection: 'devices',
    indexes: [
      { key: { workspaceId: 1, status: 1 }, name: 'devices_workspace_status' },
    ],
  },
  {
    collection: 'pairingsessions',
    indexes: [
      { key: { pairingToken: 1, expiresAt: 1 }, name: 'pairing_token_expires' },
      { key: { workspaceId: 1, status: 1 }, name: 'pairing_workspace_status' },
    ],
  },
  {
    collection: 'conflicts',
    indexes: [
      { key: { workspaceId: 1, status: 1 }, name: 'conflicts_workspace_status' },
    ],
  },
  {
    collection: 'noterevisions',
    indexes: [
      { key: { noteId: 1, revision: 1 }, name: 'revisions_note_revision' },
      { key: { workspaceId: 1 }, name: 'revisions_workspace' },
    ],
  },
  {
    collection: 'auditevents',
    indexes: [
      { key: { workspaceId: 1, serverTimestamp: -1 }, name: 'audit_workspace_timestamp' },
      { key: { noteId: 1 }, name: 'audit_note' },
    ],
  },
  {
    collection: 'visibilityrules',
    indexes: [
      { key: { noteId: 1, deviceId: 1 }, options: { unique: true }, name: 'visibility_note_device' },
      { key: { workspaceId: 1 }, name: 'visibility_workspace' },
    ],
  },
  {
    collection: 'synccursors',
    indexes: [
      { key: { workspaceId: 1, deviceId: 1 }, options: { unique: true }, name: 'cursor_workspace_device' },
    ],
  },
  {
    collection: 'users',
    indexes: [
      { key: { email: 1 }, options: { unique: true }, name: 'user_email_unique' },
    ],
  },
];

export async function ensureIndexes() {
  const db = mongoose.connection.db;
  if (!db) {
    logger.error('Cannot create indexes: database not connected');
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { collection, indexes } of INDEX_DEFINITIONS) {
    for (const indexDef of indexes) {
      const { key, options = {}, name } = indexDef;
      try {
        await db.collection(collection).createIndex(key, { name, ...options });
        created++;
      } catch (err) {
        if (err.code === 86 || err.codeName === 'IndexOptionsConflict' || err.message.includes('already exists')) {
          skipped++;
          logger.debug(`Index already exists: ${name}`);
        } else {
          failed++;
          logger.error(`Failed to create index ${name} on ${collection}:`, err.message);
        }
      }
    }
  }

  logger.info(`Indexes: ${created} created, ${skipped} skipped, ${failed} failed`);
  return { created, skipped, failed };
}
