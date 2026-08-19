import { getDatabase } from '../storage/database.js';
import { timestamp } from '@synced-notepad/shared';

export const changesRepository = {
  async create(change) {
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO changes (change_id, note_id, type, base_revision, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        change.id,
        change.noteId,
        change.type,
        change.baseRevision,
        JSON.stringify(change.payload),
        'pending',
        change.createdAt || timestamp(),
      ]
    );
    return result.lastInsertRowId;
  },

  async listPending() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM changes WHERE status = ? ORDER BY created_at ASC',
      ['pending']
    );
    return rows.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload || '{}'),
    }));
  },

  async listAll() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM changes ORDER BY created_at DESC'
    );
    return rows.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload || '{}'),
    }));
  },

  async countPending() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT COUNT(*) as count FROM changes WHERE status = ?',
      ['pending']
    );
    return row?.count || 0;
  },

  async markSynced(changeId) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE changes SET status = ?, synced_at = ? WHERE change_id = ?',
      ['synced', timestamp(), changeId]
    );
  },

  async markFailed(changeId) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE changes SET status = ? WHERE change_id = ?',
      ['failed', changeId]
    );
  },

  async deleteSynced() {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM changes WHERE status = ?', ['synced']);
  },

  async deleteByNoteId(noteId) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM changes WHERE note_id = ?', [noteId]);
  },

  async getLatestRevision(noteId) {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT MAX(base_revision) as max_rev FROM changes WHERE note_id = ? AND status = ?',
      [noteId, 'pending']
    );
    return row?.max_rev || 0;
  },
};
