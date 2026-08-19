import Dexie from 'dexie';

const db = new Dexie('SyncedNotepad');

db.version(1).stores({
  notes: '++id, workspaceId, title, folder, status, updatedAt',
  changes: '++id, noteId, type, status, createdAt',
  syncCursors: 'workspaceId',
});

export default db;
