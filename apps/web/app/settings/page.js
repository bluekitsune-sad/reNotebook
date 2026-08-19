'use client';

import { useState } from 'react';
import Layout from '../../components/Layout.js';
import useSync from '../../hooks/useSync.js';
import useAuth from '../../hooks/useAuth.js';
import useNotes from '../../hooks/useNotes.js';
import { notesRepository, changesRepository } from '../../repositories/index.js';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const syncContext = useSync();
  const { notes } = useNotes();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [workspaceName, setWorkspaceName] = useState(user?.workspaceName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { apiFetch } = await import('../../services/api.js');
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName }),
      });
      setMessage('Profile updated');
    } catch (err) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { apiFetch } = await import('../../services/api.js');
      await apiFetch('/api/auth/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceName }),
      });
      setMessage('Workspace updated');
    } catch (err) {
      setMessage(err.message || 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleExportNotes = async () => {
    const allNotes = await notesRepository.list();
    const blob = new Blob([JSON.stringify(allNotes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synced-notepad-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLocalData = async () => {
    if (!confirm('This will delete all local notes. Are you sure?')) return;
    const allNotes = await notesRepository.list();
    for (const note of allNotes) {
      await notesRepository.delete(note.id);
    }
    setMessage('Local data cleared');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { apiFetch } = await import('../../services/api.js');
      await apiFetch('/api/auth/account', { method: 'DELETE' });
      logout();
      router.push('/login');
    } catch (err) {
      setMessage(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  const lastSyncAt = syncContext?.lastSyncAt;
  const pendingCount = syncContext?.pendingCount || 0;
  const syncState = syncContext?.syncState || 'idle';

  return (
    <Layout syncContext={syncContext}>
      <div className="settings-page">
        <h1>Settings</h1>

        {message && (
          <div className={`settings-message ${message.includes('Failed') || message.includes('failed') ? 'settings-message--error' : 'settings-message--success'}`}>
            {message}
            <button className="settings-message-close" onClick={() => setMessage('')}>x</button>
          </div>
        )}

        <section className="settings-section">
          <h2 className="settings-section-title">Account</h2>
          <form onSubmit={handleSaveAccount} className="settings-form">
            <label className="settings-label">
              Display Name
              <input
                type="text"
                className="settings-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="settings-label">
              Email
              <input
                type="email"
                className="settings-input settings-input--readonly"
                value={user?.email || ''}
                readOnly
              />
            </label>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Workspace</h2>
          <form onSubmit={handleSaveWorkspace} className="settings-form">
            <label className="settings-label">
              Workspace Name
              <input
                type="text"
                className="settings-input"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Sync</h2>
          <div className="settings-detail-list">
            <div className="settings-detail">
              <span className="settings-detail-label">Status</span>
              <span className="settings-detail-value">{syncState}</span>
            </div>
            <div className="settings-detail">
              <span className="settings-detail-label">Last sync</span>
              <span className="settings-detail-value">
                {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
              </span>
            </div>
            <div className="settings-detail">
              <span className="settings-detail-label">Pending changes</span>
              <span className="settings-detail-value">{pendingCount}</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Data</h2>
          <div className="settings-actions">
            <button className="btn-secondary btn-sm" onClick={handleExportNotes}>
              Export Notes (JSON)
            </button>
            <button className="btn-secondary btn-sm" onClick={handleClearLocalData}>
              Clear Local Data
            </button>
          </div>
        </section>

        <section className="settings-section settings-section--danger">
          <h2 className="settings-section-title">Danger Zone</h2>
          {!showDeleteConfirm ? (
            <button
              className="btn-danger btn-sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </button>
          ) : (
            <div className="settings-danger-confirm">
              <p>This will permanently delete your account and all data. This cannot be undone.</p>
              <div className="settings-danger-actions">
                <button
                  className="btn-danger btn-sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
