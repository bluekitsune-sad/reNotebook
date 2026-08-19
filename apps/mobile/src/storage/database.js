import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDatabase() {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('synced-notepad.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT UNIQUE,
      workspace_id TEXT,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      folder TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      current_revision INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      created_at TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id)
    );

    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id TEXT UNIQUE,
      note_id INTEGER,
      type TEXT,
      base_revision INTEGER DEFAULT 0,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      synced_at TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id)
    );

    CREATE TABLE IF NOT EXISTS sync_cursors (
      workspace_id TEXT PRIMARY KEY,
      last_server_sequence INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER,
      change_id TEXT,
      local_payload TEXT,
      server_payload TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      resolved_at TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE,
      name TEXT,
      type TEXT,
      status TEXT DEFAULT 'active',
      last_synced_at TEXT,
      created_at TEXT
    );
  `);

  return db;
}
