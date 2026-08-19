'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SyncStatus from './SyncStatus.js';
import useNetwork from '../hooks/useNetwork.js';

export default function Layout({ children, syncContext }) {
  const pathname = usePathname();
  const { isOnline } = useNetwork();
  const { syncState, pendingCount, syncNow } = syncContext || {};

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <div className="app-shell">
      {!isOnline && <div className="offline-banner">You are offline. Changes will sync when connection is restored.</div>}

      <nav className="top-nav">
        <Link href="/" className="nav-brand">
          <span>&#9998;</span>
          Synced Notepad
        </Link>

        <div className="nav-links">
          <Link href="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            Notes
          </Link>
          <Link href="/devices" className={`nav-link ${isActive('/devices') ? 'active' : ''}`}>
            Devices
          </Link>
          <Link href="/conflicts" className={`nav-link ${isActive('/conflicts') ? 'active' : ''}`}>
            Conflicts
          </Link>
        </div>

        <SyncStatus
          syncState={syncState}
          pendingCount={pendingCount}
          isOnline={isOnline}
          onSync={syncNow}
        />
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}
