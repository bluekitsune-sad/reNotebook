'use client';

import Link from 'next/link';

export default function SyncStatus({ syncState, pendingCount, isOnline, onSync }) {
  const getStatusInfo = () => {
    if (!isOnline) return { label: 'Offline', className: 'offline' };
    if (syncState === 'error') return { label: 'Sync error', className: 'error' };
    if (syncState === 'checking' || syncState === 'pulling' || syncState === 'applying' || syncState === 'pushing')
      return { label: 'Syncing', className: 'syncing' };
    if (pendingCount > 0) return { label: `${pendingCount} pending`, className: 'syncing' };
    if (syncState === 'completed' || syncState === 'idle') return { label: 'Synced', className: 'synced' };
    return { label: 'Unknown', className: 'offline' };
  };

  const status = getStatusInfo();

  return (
    <div className="nav-right">
      {pendingCount > 0 && (
        <Link href="/conflicts" className="pending-badge" title={`${pendingCount} pending changes`}>
          {pendingCount}
        </Link>
      )}
      <button
        className={`sync-status sync-status--${status.className}`}
        onClick={onSync}
        title="Click to sync"
      >
        <span className="sync-dot" />
        {status.label}
      </button>
    </div>
  );
}
