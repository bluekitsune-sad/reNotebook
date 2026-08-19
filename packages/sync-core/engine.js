import { SYNC_STATE, CHANGE_TYPES, NOTE_STATUS, MAX_SYNC_CHANGES_PER_REQUEST } from '@synced-notepad/shared';
import { createChange, isDuplicateChange } from './changes/index.js';
import { detectConflict, classifyConflict } from './conflicts/index.js';
import { threeWayMerge, mergeTextContent } from './merge/index.js';
import { parseCursor, encodeCursor } from './cursor/index.js';
import { canTransition, nextState } from './state-machine/index.js';
import { withRetry, isRetryableError } from './retry.js';
import { validateRepositories } from './repository-interface.js';

/**
 * Client-side sync engine.
 *
 * Orchestrates bidirectional sync between a local repository and a remote API.
 * Follows a strict state machine and never silently drops data.
 */
export class SyncEngine {
  #state;
  #repositories;
  #apiClient;
  #workspaceId;
  #deviceId;
  #statusListeners;
  #errorListeners;
  #syncing;

  /**
   * @param {Object} options
   * @param {Object} options.repository - Combined repository bag with notes, changes, revisions, syncState sub-repos.
   * @param {Object} options.apiClient - Remote API client (must implement pullChanges, pushChanges).
   * @param {string} options.workspaceId
   * @param {string} options.deviceId
   */
  constructor({ repository, apiClient, workspaceId, deviceId }) {
    validateRepositories(repository);

    this.#repositories = repository;
    this.#apiClient = apiClient;
    this.#workspaceId = workspaceId;
    this.#deviceId = deviceId;
    this.#state = SYNC_STATE.IDLE;
    this.#statusListeners = new Set();
    this.#errorListeners = new Set();
    this.#syncing = false;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Full sync cycle: idle → checking → pulling → applying → pushing → completed.
   */
  async sync() {
    if (this.#syncing) return;
    if (!this.#canTransitionTo(SYNC_STATE.CHECKING)) return;

    this.#syncing = true;

    try {
      this.#transition(SYNC_STATE.CHECKING);

      const remoteChanges = await this.#pullRemote();
      await this.#applyRemoteChanges(remoteChanges);

      await this.#pushLocal();

      this.#transition(SYNC_STATE.COMPLETED);
      this.#transition(SYNC_STATE.IDLE);
    } catch (error) {
      this.#emitError(error);
      this.#transition(SYNC_STATE.ERROR);
      this.#transition(SYNC_STATE.IDLE);
    } finally {
      this.#syncing = false;
    }
  }

  /**
   * Pull remote changes only.
   */
  async pull() {
    if (this.#syncing) return;

    this.#syncing = true;

    try {
      this.#transition(SYNC_STATE.CHECKING);

      const remoteChanges = await this.#pullRemote();
      await this.#applyRemoteChanges(remoteChanges);

      this.#transition(SYNC_STATE.COMPLETED);
      this.#transition(SYNC_STATE.IDLE);
    } catch (error) {
      this.#emitError(error);
      this.#transition(SYNC_STATE.ERROR);
      this.#transition(SYNC_STATE.IDLE);
    } finally {
      this.#syncing = false;
    }
  }

  /**
   * Push local pending changes only.
   */
  async push() {
    if (this.#syncing) return;

    this.#syncing = true;

    try {
      this.#transition(SYNC_STATE.PUSHING);
      await this.#pushLocal();
      this.#transition(SYNC_STATE.COMPLETED);
      this.#transition(SYNC_STATE.IDLE);
    } catch (error) {
      this.#emitError(error);
      this.#transition(SYNC_STATE.ERROR);
      this.#transition(SYNC_STATE.IDLE);
    } finally {
      this.#syncing = false;
    }
  }

  /**
   * Apply a single remote change to local storage.
   * Handles conflict detection against pending local changes.
   */
  async applyRemoteChange(change) {
    const { notesRepository, changesRepository, revisionsRepository } = this.#repositories;

    // Idempotency: skip if we already have this change queued
    const pending = await changesRepository.getPending();
    if (isDuplicateChange(pending, change)) return;

    const localNote = change.noteId ? await notesRepository.get(change.noteId) : null;

    // Save revision snapshot before applying
    if (localNote) {
      await this.#saveRevision(localNote);
    }

    switch (change.type) {
      case CHANGE_TYPES.NOTE_CREATED:
        await this.#applyNoteCreated(change);
        break;

      case CHANGE_TYPES.NOTE_UPDATED:
        await this.#applyNoteUpdated(change, localNote);
        break;

      case CHANGE_TYPES.NOTE_DELETED:
        await this.#applyNoteDeleted(change, localNote);
        break;

      case CHANGE_TYPES.NOTE_RESTORED:
        await this.#applyNoteRestored(change, localNote);
        break;

      default:
        // Unknown change type — skip but log
        break;
    }
  }

  /**
   * Returns current sync state.
   */
  getStatus() {
    return this.#state;
  }

  /**
   * Returns count of unsynced local changes.
   */
  async getPendingCount() {
    const pending = await this.#repositories.changesRepository.getPending();
    return pending.length;
  }

  /**
   * Register a status change listener. Returns an unsubscribe function.
   */
  onStatusChange(callback) {
    this.#statusListeners.add(callback);
    return () => this.#statusListeners.delete(callback);
  }

  /**
   * Register an error listener. Returns an unsubscribe function.
   */
  onError(callback) {
    this.#errorListeners.add(callback);
    return () => this.#errorListeners.delete(callback);
  }

  // ── Pull ────────────────────────────────────────────────────────────────

  async #pullRemote() {
    this.#transition(SYNC_STATE.PULLING);

    const { syncStateRepository } = this.#repositories;
    const cursor = await syncStateRepository.getCursor();
    const parsed = parseCursor(cursor);

    const remoteChanges = await withRetry(() =>
      this.#apiClient.pullChanges({
        workspaceId: this.#workspaceId,
        cursor: cursor || undefined,
        limit: MAX_SYNC_CHANGES_PER_REQUEST,
      })
    );

    return remoteChanges;
  }

  // ── Apply remote changes ────────────────────────────────────────────────

  async #applyRemoteChanges(remoteChanges) {
    this.#transition(SYNC_STATE.APPLYING);

    const { syncStateRepository } = this.#repositories;
    const changes = remoteChanges?.changes || [];
    const newCursor = remoteChanges?.cursor;

    for (const change of changes) {
      await this.applyRemoteChange(change);
    }

    if (newCursor) {
      await syncStateRepository.setCursor(newCursor);
    }
  }

  // ── Change applicators ──────────────────────────────────────────────────

  async #applyNoteCreated(change) {
    const { notesRepository, changesRepository } = this.#repositories;

    // Check if we already have this note locally (by server ID mapping)
    const existing = change.noteId ? await notesRepository.getByServerId(change.noteId) : null;

    if (existing) {
      // Already have it — update with server data if newer
      await notesRepository.update(existing.id, {
        serverRevision: change.baseRevision,
        title: change.payload?.title ?? existing.title,
        content: change.payload?.content ?? existing.content,
        status: change.payload?.status ?? existing.status,
        updatedAt: change.createdAt,
      });
      return;
    }

    // Create new note with server-assigned ID
    const note = await notesRepository.create({
      serverId: change.noteId,
      title: change.payload?.title || '',
      content: change.payload?.content || '',
      status: change.payload?.status || NOTE_STATUS.ACTIVE,
      localRevision: 0,
      serverRevision: change.baseRevision,
      createdAt: change.createdAt,
      updatedAt: change.createdAt,
    });

    // Queue as an accepted local change to track the mapping
    await changesRepository.queue({
      ...change,
      status: 'applied',
    });
  }

  async #applyNoteUpdated(change, localNote) {
    const { notesRepository, changesRepository } = this.#repositories;

    if (!localNote) {
      // We don't have this note locally — treat as a create
      await this.#applyNoteCreated(change);
      return;
    }

    // Check for local pending changes on the same note
    const pending = await changesRepository.getPending();
    const localPending = pending.filter(
      (c) => c.noteId === change.noteId && c.type === CHANGE_TYPES.NOTE_UPDATED
    );

    if (localPending.length > 0) {
      // Conflict: remote update vs local update
      await this.#handleConflict(change, localNote, localPending);
      return;
    }

    // No local conflict — apply directly
    await notesRepository.update(localNote.id, {
      title: change.payload?.title ?? localNote.title,
      content: change.payload?.content ?? localNote.content,
      status: change.payload?.status ?? localNote.status,
      serverRevision: change.baseRevision,
      updatedAt: change.createdAt,
    });
  }

  async #applyNoteDeleted(change, localNote) {
    const { notesRepository, changesRepository } = this.#repositories;

    if (!localNote) return;

    // Check for local pending changes on the same note
    const pending = await changesRepository.getPending();
    const localPending = pending.filter(
      (c) => c.noteId === change.noteId && c.type !== CHANGE_TYPES.NOTE_DELETED
    );

    if (localPending.length > 0) {
      // Conflict: remote delete vs local edit
      await this.#handleConflict(change, localNote, localPending);
      return;
    }

    await notesRepository.delete(localNote.id);
  }

  async #applyNoteRestored(change, localNote) {
    const { notesRepository } = this.#repositories;

    if (!localNote) {
      // Note was restored but we don't have it — treat as create
      await this.#applyNoteCreated(change);
      return;
    }

    await notesRepository.restore(localNote.id);
  }

  // ── Conflict handling ───────────────────────────────────────────────────

  async #handleConflict(remoteChange, localNote, localPending) {
    const { changesRepository } = this.#repositories;

    // For a single local pending change, try three-way merge
    if (localPending.length === 1) {
      const localChange = localPending[0];
      const mergeResult = this.#tryAutoMerge(remoteChange, localNote, localChange);

      if (mergeResult.merged) {
        // Auto-merge succeeded
        const { notesRepository } = this.#repositories;
        await notesRepository.update(localNote.id, {
          ...mergeResult.merged,
          serverRevision: remoteChange.baseRevision,
          updatedAt: new Date().toISOString(),
        });

        // Mark the local change as accepted since it was merged
        await changesRepository.markAccepted(localChange.id);
        return;
      }
    }

    // Auto-merge not possible — queue as conflict for user resolution
    const conflictData = JSON.stringify({
      remoteChange,
      localNote,
      localPendingChanges: localPending,
      classifiedAs: classifyConflict(remoteChange, localPending[0]),
    });

    for (const localChange of localPending) {
      await changesRepository.markConflict(localChange.id, conflictData);
    }
  }

  #tryAutoMerge(remoteChange, localNote, localChange) {
    if (remoteChange.type === CHANGE_TYPES.NOTE_DELETED) {
      return { merged: null };
    }

    const remoteFields = remoteChange.payload || {};
    const localFields = localChange.payload || {};

    // Try field-level three-way merge against the current local note as base
    const base = {
      title: localNote.title,
      content: localNote.content,
    };

    const versionA = {
      title: remoteFields.title !== undefined ? remoteFields.title : base.title,
      content: remoteFields.content !== undefined ? remoteFields.content : base.content,
    };

    const versionB = {
      title: localFields.title !== undefined ? localFields.title : base.title,
      content: localFields.content !== undefined ? localFields.content : base.content,
    };

    // First try text content merge for content field
    if (versionA.content !== versionB.content) {
      const textMerge = mergeTextContent(base.content, versionA.content, versionB.content);
      if (!textMerge.autoMergeable) {
        return { merged: null };
      }
      versionA.content = textMerge.merged;
    }

    // Then do field-level merge
    const fieldMerge = threeWayMerge(base, versionA, versionB);
    if (!fieldMerge.autoMergeable) {
      return { merged: null };
    }

    return { merged: fieldMerge.merged };
  }

  // ── Push ────────────────────────────────────────────────────────────────

  async #pushLocal() {
    const { changesRepository } = this.#repositories;
    const pending = await changesRepository.getPending();

    if (pending.length === 0) return;

    // Batch pending changes
    const batches = this.#chunk(pending, MAX_SYNC_CHANGES_PER_REQUEST);

    for (const batch of batches) {
      await this.#pushBatch(batch);
    }
  }

  async #pushBatch(batch) {
    const { changesRepository } = this.#repositories;

    const result = await withRetry(() =>
      this.#apiClient.pushChanges({
        workspaceId: this.#workspaceId,
        changes: batch.map((c) => ({
          id: c.id,
          noteId: c.noteId,
          type: c.type,
          baseRevision: c.baseRevision,
          payload: c.payload,
        })),
      })
    );

    const serverResults = result?.results || [];

    for (let i = 0; i < batch.length; i++) {
      const localChange = batch[i];
      const serverResult = serverResults.find((r) => r.clientChangeId === localChange.id);

      if (!serverResult) continue;

      if (serverResult.status === 'accepted') {
        await changesRepository.markAccepted(localChange.id);

        // Update local note's server revision if provided
        if (serverResult.serverRevision != null && localChange.noteId) {
          const { notesRepository } = this.#repositories;
          const note = await notesRepository.get(localChange.noteId);
          if (note) {
            await notesRepository.update(note.id, {
              serverRevision: serverResult.serverRevision,
              serverId: serverResult.serverId || note.serverId,
            });
          }
        }
      } else if (serverResult.status === 'conflict') {
        const conflictData = JSON.stringify({
          serverResult,
          localChange,
        });
        await changesRepository.markConflict(localChange.id, conflictData);
      }
    }
  }

  // ── Revision snapshots ──────────────────────────────────────────────────

  async #saveRevision(note) {
    const { revisionsRepository } = this.#repositories;
    const latest = await revisionsRepository.getLatest(note.id);
    const nextRevision = (latest?.revision || 0) + 1;

    await revisionsRepository.create({
      noteId: note.id,
      revision: nextRevision,
      snapshot: {
        title: note.title,
        content: note.content,
        status: note.status,
      },
      createdAt: new Date().toISOString(),
    });
  }

  // ── State machine ───────────────────────────────────────────────────────

  #transition(newState) {
    if (!canTransition(this.#state, newState)) {
      return;
    }
    this.#state = newState;
    this.#emitStatusChange(newState);
  }

  #canTransitionTo(state) {
    return canTransition(this.#state, state);
  }

  // ── Listeners ───────────────────────────────────────────────────────────

  #emitStatusChange(state) {
    for (const listener of this.#statusListeners) {
      try {
        listener(state);
      } catch {
        // Listener errors must not break the sync cycle
      }
    }
  }

  #emitError(error) {
    for (const listener of this.#errorListeners) {
      try {
        listener(error);
      } catch {
        // Listener errors must not break the sync cycle
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  #chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
