/**
 * Repository interface definitions for the sync engine.
 *
 * Clients must provide objects implementing these interfaces.
 * Web uses Dexie.js (IndexedDB), mobile uses SQLite via a wrapper.
 *
 * The engine never touches storage directly — it only calls these methods.
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string|null} serverId
 * @property {string} title
 * @property {string} content
 * @property {string} status - 'active' | 'deleted'
 * @property {number} localRevision
 * @property {number|null} serverRevision
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Change
 * @property {string} id
 * @property {string|null} noteId
 * @property {string} type - CHANGE_TYPES value
 * @property {number} baseRevision
 * @property {Object} payload
 * @property {string} createdAt
 * @property {'pending'|'accepted'|'conflict'|'applied'} status
 * @property {string|null} conflictData - JSON string of conflict details
 * @property {string|null} serverChangeId - ID assigned by server after push
 */

/**
 * @typedef {Object} Revision
 * @property {string} noteId
 * @property {number} revision
 * @property {Object} snapshot - Full note state at this revision
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SyncState
 * @property {string|null} cursor - Base64 encoded sync cursor
 * @property {string} state - SYNC_STATE value
 * @property {string|null} lastSyncedAt
 */

/**
 * Validate that a notes repository implements the required interface.
 * Throws descriptive errors on missing methods.
 */
export function validateNotesRepository(repo) {
  const required = ['create', 'get', 'update', 'delete', 'restore', 'list', 'getByServerId'];
  for (const method of required) {
    if (typeof repo[method] !== 'function') {
      throw new Error(`notesRepository must implement ${method}()`);
    }
  }
}

/**
 * Validate that a changes repository implements the required interface.
 */
export function validateChangesRepository(repo) {
  const required = ['queue', 'getPending', 'markAccepted', 'markConflict'];
  for (const method of required) {
    if (typeof repo[method] !== 'function') {
      throw new Error(`changesRepository must implement ${method}()`);
    }
  }
}

/**
 * Validate that a revisions repository implements the required interface.
 */
export function validateRevisionsRepository(repo) {
  const required = ['create', 'get', 'getLatest'];
  for (const method of required) {
    if (typeof repo[method] !== 'function') {
      throw new Error(`revisionsRepository must implement ${method}()`);
    }
  }
}

/**
 * Validate that a sync state repository implements the required interface.
 */
export function validateSyncStateRepository(repo) {
  const required = ['getCursor', 'setCursor'];
  for (const method of required) {
    if (typeof repo[method] !== 'function') {
      throw new Error(`syncStateRepository must implement ${method}()`);
    }
  }
}

/**
 * Validate all repositories at once.
 */
export function validateRepositories({ notesRepository, changesRepository, revisionsRepository, syncStateRepository }) {
  validateNotesRepository(notesRepository);
  validateChangesRepository(changesRepository);
  validateRevisionsRepository(revisionsRepository);
  validateSyncStateRepository(syncStateRepository);
}
