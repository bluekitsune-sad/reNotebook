import { useState, useEffect, useCallback, useRef } from 'react';
import { changesRepository } from '../repositories/changesRepository.js';
import { notesRepository } from '../repositories/notesRepository.js';
import { apiFetch } from '../services/api.js';
import { getDatabase } from '../storage/database.js';
import { SYNC_STATE, SYNC_PROTOCOL_VERSION, APP_VERSION } from '@synced-notepad/shared';
import { canTransition } from '@synced-notepad/sync-core';

export function useSync(isOnline) {
  const [syncState, setSyncState] = useState(SYNC_STATE.IDLE);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const syncIntervalRef = useRef(null);

  const updatePendingCount = useCallback(async () => {
    const count = await changesRepository.countPending();
    setPendingCount(count);
  }, []);

  const transition = useCallback((to) => {
    setSyncState((from) => {
      if (canTransition(from, to)) return to;
      return from;
    });
  }, []);

  const sync = useCallback(async () => {
    if (!isOnline) {
      setSyncError('Offline');
      return;
    }

    try {
      transition(SYNC_STATE.CHECKING);
      setSyncError(null);

      const pendingChanges = await changesRepository.listPending();

      transition(SYNC_STATE.PUSHING);

      if (pendingChanges.length > 0) {
        const db = await getDatabase();
        const cursorRow = await db.getFirstAsync('SELECT * FROM sync_cursors LIMIT 1');

        const response = await apiFetch('/api/sync', {
          method: 'POST',
          body: JSON.stringify({
            cursor: cursorRow ? btoa(JSON.stringify({ s: cursorRow.last_server_sequence, d: null })) : undefined,
            changes: pendingChanges.map((c) => ({
              id: c.change_id,
              noteId: c.payload.workspaceId ? c.note_id : `local-${c.note_id}`,
              type: c.type,
              baseRevision: c.base_revision,
              payload: c.payload,
              createdAt: c.created_at,
            })),
            appVersion: APP_VERSION,
            syncProtocolVersion: SYNC_PROTOCOL_VERSION,
          }),
        });

        if (response.accepted && response.accepted.length > 0) {
          for (const changeId of response.accepted) {
            await changesRepository.markSynced(changeId);
          }
        }

        if (response.conflicts && response.conflicts.length > 0) {
          setConflicts(response.conflicts);
        }

        transition(SYNC_STATE.APPLYING);

        if (response.changes && response.changes.length > 0) {
          for (const change of response.changes) {
            await notesRepository.applyRemoteChange(change);
          }
        }

        if (response.cursor) {
          const decoded = JSON.parse(atob(response.cursor));
          const syncDb = await getDatabase();
          await syncDb.runAsync(
            `INSERT OR REPLACE INTO sync_cursors (workspace_id, last_server_sequence) VALUES (?, ?)`,
            ['default', decoded.s || 0]
          );
        }
      }

      transition(SYNC_STATE.COMPLETED);
      setLastSyncTime(new Date().toISOString());
      await updatePendingCount();
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncError(err.message || 'Sync failed');
      transition(SYNC_STATE.ERROR);
    }
  }, [isOnline, transition, updatePendingCount]);

  const resolveConflict = useCallback(async (conflictId, resolution, selectedVersion) => {
    setConflicts((prev) => prev.filter((c) => c.changeId !== conflictId));
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  useEffect(() => {
    if (syncState === SYNC_STATE.COMPLETED || syncState === SYNC_STATE.ERROR) {
      const timer = setTimeout(() => {
        transition(SYNC_STATE.IDLE);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [syncState, transition]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && syncState === SYNC_STATE.IDLE) {
      sync();
    }
  }, [isOnline, pendingCount, syncState, sync]);

  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        if (syncState === SYNC_STATE.IDLE) {
          sync();
        }
      }, 30000);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isOnline, syncState, sync]);

  return {
    syncState,
    pendingCount,
    lastSyncTime,
    syncError,
    conflicts,
    sync,
    resolveConflict,
    refreshPending: updatePendingCount,
  };
}
