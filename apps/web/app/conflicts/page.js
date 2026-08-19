'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout.js';
import ConflictResolver from '../../components/ConflictResolver.js';
import useSync from '../../hooks/useSync.js';
import { apiFetch } from '../../services/api.js';

export default function ConflictsPage() {
  const syncContext = useSync();
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConflicts = useCallback(async () => {
    try {
      const result = await apiFetch('/api/sync/conflicts');
      setConflicts(result.conflicts || []);
    } catch {
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleResolve = useCallback(async (conflictId, resolution) => {
    try {
      await apiFetch(`/api/sync/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      });
      await loadConflicts();
    } catch {
      alert('Failed to resolve conflict');
    }
  }, [loadConflicts]);

  return (
    <Layout syncContext={syncContext}>
      <div className="page-header">
        <h1>Conflicts</h1>
        <button className="btn-secondary btn-sm" onClick={loadConflicts}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading conflicts...</p></div>
      ) : (
        <ConflictResolver conflicts={conflicts} onResolve={handleResolve} />
      )}
    </Layout>
  );
}
