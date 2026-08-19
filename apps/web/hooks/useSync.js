'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { changesRepository } from '../repositories/index.js';
import { isAuthenticated } from '../services/auth.js';
import { SYNC_STATE } from '@synced-notepad/shared';

export default function useSync() {
  const [syncState, setSyncState] = useState(SYNC_STATE.IDLE);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const syncingRef = useRef(false);
  const intervalRef = useRef(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await changesRepository.getPending();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const performSync = useCallback(async () => {
    if (syncingRef.current) return;
    if (!isAuthenticated()) return;
    syncingRef.current = true;

    try {
      const { apiFetch } = await import('../services/api.js');

      setSyncState(SYNC_STATE.CHECKING);
      setError(null);

      const pending = await changesRepository.getPending();

      if (pending.length === 0) {
        setSyncState(SYNC_STATE.COMPLETED);
        await refreshPendingCount();
        syncingRef.current = false;
        setTimeout(() => setSyncState(SYNC_STATE.IDLE), 1500);
        return;
      }

      setSyncState(SYNC_STATE.PUSHING);

      const { SYNC_PROTOCOL_VERSION, APP_VERSION } = await import('@synced-notepad/shared');
      const response = await apiFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'default',
          changes: pending.map((c) => ({
            id: c.id,
            noteId: c.noteId,
            type: c.type,
            baseRevision: c.baseRevision,
            payload: c.payload,
            createdAt: c.createdAt,
          })),
          appVersion: APP_VERSION,
          syncProtocolVersion: SYNC_PROTOCOL_VERSION,
        }),
      });

      if (response.accepted) {
        for (const changeId of response.accepted) {
          await changesRepository.markAccepted(changeId);
        }
      }

      if (response.conflicts) {
        for (const conflict of response.conflicts) {
          await changesRepository.markConflict(conflict.changeId, conflict);
        }
      }

      if (response.changes && response.changes.length > 0) {
        setSyncState(SYNC_STATE.APPLYING);
      }

      setSyncState(SYNC_STATE.COMPLETED);
      setLastSyncAt(new Date().toISOString());
      await refreshPendingCount();
    } catch (err) {
      setError(err.message || 'Sync failed');
      setSyncState(SYNC_STATE.ERROR);
    } finally {
      syncingRef.current = false;
      setTimeout(() => setSyncState(SYNC_STATE.IDLE), 1500);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    intervalRef.current = setInterval(() => {
      if (navigator.onLine && !syncingRef.current && isAuthenticated()) {
        performSync();
      }
    }, 30000);
    return () => clearInterval(intervalRef.current);
  }, [performSync]);

  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated()) {
        performSync();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [performSync]);

  const syncNow = useCallback(() => {
    if (!syncingRef.current && isAuthenticated()) {
      performSync();
    }
  }, [performSync]);

  return {
    syncState,
    pendingCount,
    error,
    lastSyncAt,
    syncNow,
    refreshPendingCount,
    isSyncing:
      syncState !== SYNC_STATE.IDLE &&
      syncState !== SYNC_STATE.COMPLETED &&
      syncState !== SYNC_STATE.ERROR,
  };
}
