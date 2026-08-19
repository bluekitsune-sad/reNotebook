'use client';

export default function ConflictResolver({ conflicts, onResolve }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  };

  if (conflicts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#10003;</div>
        <h3>No conflicts</h3>
        <p>All your changes are in sync</p>
      </div>
    );
  }

  return (
    <div>
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="conflict-card">
          <h3>Conflict on note: {conflict.localVersion?.title || 'Untitled'}</h3>
          <div className="conflict-versions">
            <div className="conflict-version">
              <div className="conflict-version-label">Local Version</div>
              <div className="conflict-version-title">{conflict.localVersion?.title || 'Untitled'}</div>
              <div className="conflict-version-content">
                {conflict.localVersion?.content || 'Empty'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                {formatDate(conflict.localVersion?.updatedAt)}
              </div>
            </div>
            <div className="conflict-version">
              <div className="conflict-version-label">Server Version</div>
              <div className="conflict-version-title">{conflict.serverVersion?.title || 'Untitled'}</div>
              <div className="conflict-version-content">
                {conflict.serverVersion?.content || 'Empty'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                {formatDate(conflict.serverVersion?.updatedAt)}
              </div>
            </div>
          </div>
          <div className="conflict-actions">
            <button
              className="btn-primary btn-sm"
              onClick={() => onResolve(conflict.id, 'keep_local')}
            >
              Keep Local
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => onResolve(conflict.id, 'keep_server')}
            >
              Keep Server
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => onResolve(conflict.id, 'merge')}
            >
              Merge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
