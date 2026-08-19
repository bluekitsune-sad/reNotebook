'use client';

import { AuthProvider } from '../hooks/useAuthContext.js';
import { SyncProvider } from '../hooks/useSyncContext.js';

export default function ClientProviders({ children }) {
  return (
    <AuthProvider>
      <SyncProvider>{children}</SyncProvider>
    </AuthProvider>
  );
}
