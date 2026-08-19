import db from '../storage/db.js';

export const notesRepository = {
  async create(note) {
    const id = await db.notes.add({
      serverId: note._id,
      workspaceId: note.workspaceId,
      title: note.title,
      content: note.content,
      folder: note.folder,
      status: note.status,
      currentRevision: note.currentRevision,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
    return id;
  },

  async get(id) {
    return db.notes.get(id);
  },

  async getByServerId(serverId) {
    return db.notes.where('serverId').equals(serverId).first();
  },

  async update(id, changes) {
    await db.notes.update(id, { ...changes, updatedAt: new Date().toISOString() });
  },

  async delete(id) {
    await db.notes.delete(id);
  },

  async list() {
    return db.notes.where('status').equals('active').sortBy('updatedAt');
  },

  async search(query) {
    const lower = query.toLowerCase();
    return db.notes
      .where('status')
      .equals('active')
      .filter((note) => note.title.toLowerCase().includes(lower) || note.content.toLowerCase().includes(lower))
      .toArray();
  },
};

export const changesRepository = {
  async queue(change) {
    return db.changes.add({ ...change, status: 'pending', createdAt: new Date().toISOString() });
  },

  async getPending() {
    return db.changes.where('status').equals('pending').toArray();
  },

  async markAccepted(id) {
    await db.changes.update(id, { status: 'accepted' });
  },

  async markConflict(id, conflictData) {
    await db.changes.update(id, { status: 'conflict', conflict: conflictData });
  },
};
