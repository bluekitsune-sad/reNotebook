'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout.js';
import ConflictResolver from '../../components/ConflictResolver.js';
import { apiFetch } from '../../services/api.js';

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/sync/conflicts');
      setConflicts(result.conflicts || []);
    } catch {
      setConflicts([]);
      setError('Could not load conflicts. Make sure you are logged in and the server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleResolve = useCallback(
    async (conflictId, resolution) => {
      try {
        await apiFetch(`/api/sync/conflicts/${conflictId}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ resolution }),
        });
        await loadConflicts();
      } catch {
        alert('Failed to resolve conflict');
      }
    },
    [loadConflicts]
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Conflicts</h1>
        <button className="btn-secondary btn-sm" onClick={loadConflicts}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading conflicts...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <p style={{ color: '#e74c3c' }}>{error}</p>
          <button className="btn-secondary btn-sm" onClick={loadConflicts}>
            Retry
          </button>
        </div>
      ) : (
        <ConflictResolver conflicts={conflicts} onResolve={handleResolve} />
      )}
    </Layout>
  );
}
