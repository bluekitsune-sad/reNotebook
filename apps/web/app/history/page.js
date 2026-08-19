'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout.js';
import HistoryList from '../../components/HistoryList.js';
import { apiFetch } from '../../services/api.js';

export default function HistoryPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (pageNum) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch(`/api/audit?page=${pageNum}&limit=50`);
      const items = result.events || result.auditLog || [];
      if (pageNum === 1) {
        setEvents(items);
      } else {
        setEvents((prev) => [...prev, ...items]);
      }
      setHasMore(items.length >= 50);
    } catch {
      setEvents([]);
      setError('Could not load history. Make sure you are logged in and the server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(page);
  }, [page, loadHistory]);

  return (
    <Layout>
      <div className="page-header">
        <h1>History</h1>
      </div>
      <p className="page-description">
        Audit log of all changes made across your devices.
      </p>

      {error ? (
        <div className="empty-state">
          <p style={{ color: '#e74c3c' }}>{error}</p>
          <button className="btn-secondary btn-sm" onClick={() => loadHistory(page)}>
            Retry
          </button>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="empty-state">
          <p>Loading history...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128221;</div>
          <h3>No history yet</h3>
          <p>Changes to your notes will appear here</p>
        </div>
      ) : (
        <>
          <HistoryList events={events} />
          {hasMore && (
            <div className="history-load-more">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
