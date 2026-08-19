import { getDatabase } from '../storage/database.js';
import { generateId, timestamp } from '@synced-notepad/shared';
import { CHANGE_TYPES } from '@synced-notepad/shared';
import { noteCreateSchema, noteUpdateSchema } from '@synced-notepad/validation';

export const notesRepository = {
  async create(note) {
    const validated = noteCreateSchema.parse(note);
    const db = await getDatabase();
    const now = timestamp();
    const result = await db.runAsync(
      `INSERT INTO notes (server_id, workspace_id, title, content, folder, status, current_revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.serverId || null,
        note.workspaceId || null,
        validated.title || '',
        validated.content || '',
        validated.folder || '',
        'active',
        1,
        now,
        now,
      ]
    );
    const localId = result.lastInsertRowId;

    await db.runAsync(
      `INSERT INTO revisions (note_id, revision, title, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [localId, 1, validated.title || '', validated.content || '', now]
    );

    return localId;
  },

  async get(id) {
    const db = await getDatabase();
    return db.getFirstAsync('SELECT * FROM notes WHERE id = ? AND status = ?', [id, 'active']);
  },

  async getById(id) {
    const db = await getDatabase();
    return db.getFirstAsync('SELECT * FROM notes WHERE id = ?', [id]);
  },

  async getByServerId(serverId) {
    const db = await getDatabase();
    return db.getFirstAsync('SELECT * FROM notes WHERE server_id = ?', [serverId]);
  },

  async update(id, changes) {
    const db = await getDatabase();
    const note = await db.getFirstAsync('SELECT * FROM notes WHERE id = ?', [id]);
    if (!note) return;

    const fields = {};
    if (changes.title !== undefined) fields.title = changes.title;
    if (changes.content !== undefined) fields.content = changes.content;
    if (changes.folder !== undefined) fields.folder = changes.folder;

    const newRevision = (note.current_revision || 0) + 1;
    const now = timestamp();

    const sets = [];
    const vals = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    sets.push('current_revision = ?');
    vals.push(newRevision);
    sets.push('updated_at = ?');
    vals.push(now);
    vals.push(id);
    await db.runAsync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, vals);

    await db.runAsync(
      `INSERT INTO revisions (note_id, revision, title, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, newRevision, fields.title ?? note.title, fields.content ?? note.content, now]
    );

    return newRevision;
  },

  async delete(id) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE notes SET status = ?, updated_at = ? WHERE id = ?',
      ['deleted', timestamp(), id]
    );
  },

  async restore(id) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE notes SET status = ?, updated_at = ? WHERE id = ?',
      ['active', timestamp(), id]
    );
  },

  async list() {
    const db = await getDatabase();
    return db.getAllAsync(
      'SELECT * FROM notes WHERE status = ? ORDER BY updated_at DESC',
      ['active']
    );
  },

  async listDeleted() {
    const db = await getDatabase();
    return db.getAllAsync(
      'SELECT * FROM notes WHERE status = ? ORDER BY updated_at DESC',
      ['deleted']
    );
  },

  async search(query) {
    const db = await getDatabase();
    const pattern = `%${query}%`;
    return db.getAllAsync(
      'SELECT * FROM notes WHERE status = ? AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC',
      ['active', pattern, pattern]
    );
  },

  async getRevision(noteId, revision) {
    const db = await getDatabase();
    return db.getFirstAsync(
      'SELECT * FROM revisions WHERE note_id = ? AND revision = ?',
      [noteId, revision]
    );
  },

  async getRevisions(noteId) {
    const db = await getDatabase();
    return db.getAllAsync(
      'SELECT * FROM revisions WHERE note_id = ? ORDER BY revision DESC',
      [noteId]
    );
  },

  async setServerId(localId, serverId, workspaceId) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE notes SET server_id = ?, workspace_id = ? WHERE id = ?',
      [serverId, workspaceId, localId]
    );
  },

  async applyRemoteChange(change) {
    const db = await getDatabase();
    const note = await db.getFirstAsync('SELECT * FROM notes WHERE server_id = ?', [change.noteId]);
    const now = timestamp();

    if (change.type === CHANGE_TYPES.NOTE_CREATED) {
      if (note) return note.id;
      const result = await db.runAsync(
        `INSERT INTO notes (server_id, workspace_id, title, content, folder, status, current_revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          change.noteId,
          change.payload.workspaceId || null,
          change.payload.title || '',
          change.payload.content || '',
          change.payload.folder || '',
          'active',
          change.baseRevision + 1,
          change.createdAt,
          now,
        ]
      );
      return result.lastInsertRowId;
    }

    if (!note) return null;

    if (change.type === CHANGE_TYPES.NOTE_DELETED) {
      await db.runAsync(
        'UPDATE notes SET status = ?, updated_at = ? WHERE id = ?',
        ['deleted', now, note.id]
      );
      return note.id;
    }

    if (change.type === CHANGE_TYPES.NOTE_RESTORED) {
      await db.runAsync(
        'UPDATE notes SET status = ?, updated_at = ? WHERE id = ?',
        ['active', now, note.id]
      );
      return note.id;
    }

    if (change.type === CHANGE_TYPES.NOTE_UPDATED) {
      await db.runAsync(
        `UPDATE notes SET title = ?, content = ?, folder = ?, current_revision = ?, updated_at = ? WHERE id = ?`,
        [
          change.payload.title ?? note.title,
          change.payload.content ?? note.content,
          change.payload.folder ?? note.folder,
          change.baseRevision + 1,
          now,
          note.id,
        ]
      );
      await db.runAsync(
        `INSERT INTO revisions (note_id, revision, title, content, created_at) VALUES (?, ?, ?, ?, ?)`,
        [
          note.id,
          change.baseRevision + 1,
          change.payload.title ?? note.title,
          change.payload.content ?? note.content,
          now,
        ]
      );
      return note.id;
    }

    return null;
  },
};
