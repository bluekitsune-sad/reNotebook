'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout.js';
import VisibilityToggle from '../../components/VisibilityToggle.js';
import useSync from '../../hooks/useSync.js';
import useNotes from '../../hooks/useNotes.js';
import { apiFetch } from '../../services/api.js';

export default function VisibilityPage() {
  const syncContext = useSync();
  const { notes, loading: notesLoading } = useNotes();
  const [devices, setDevices] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [visibility, setVisibility] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    apiFetch('/api/devices')
      .then((r) => setDevices((r.devices || []).filter((d) => d.status === 'active')))
      .catch(() => setDevices([]));
  }, []);

  const loadVisibility = useCallback(async (noteId) => {
    try {
      const result = await apiFetch(`/api/notes/${noteId}/visibility`);
      setVisibility(result.visibility || {});
    } catch {
      setVisibility({});
    }
  }, []);

  const handleSelectNote = useCallback((note) => {
    setSelectedNote(note);
    loadVisibility(note._id || note.id);
  }, [loadVisibility]);

  const handleToggle = useCallback(async (deviceId, visible) => {
    if (!selectedNote) return;
    const noteId = selectedNote._id || selectedNote.id;
    const prev = { ...visibility };
    const next = { ...visibility, [deviceId]: visible };
    setVisibility(next);
    setSaving(true);
    try {
      await apiFetch(`/api/notes/${noteId}/visibility`, {
        method: 'PUT',
        body: JSON.stringify({ visibility: next }),
      });
      setToast('Visibility updated');
      setTimeout(() => setToast(null), 2000);
    } catch {
      setVisibility(prev);
      setToast('Failed to update visibility');
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [selectedNote, visibility]);

  return (
    <Layout syncContext={syncContext}>
      <div className="page-header">
        <h1>Note Visibility</h1>
      </div>
      <p className="page-description">
        Control which devices can see each note. Hidden notes won&apos;t sync to that device.
      </p>

      <div className="visibility-layout">
        <div className="visibility-notes-panel">
          <h3 className="panel-title">Notes</h3>
          {notesLoading ? (
            <p className="panel-empty">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="panel-empty">No notes yet</p>
          ) : (
            <ul className="visibility-note-list">
              {notes.map((note) => {
                const noteId = note._id || note.id;
                const isSelected = selectedNote && (selectedNote._id || selectedNote.id) === noteId;
                return (
                  <li key={noteId}>
                    <button
                      className={`visibility-note-item ${isSelected ? 'visibility-note-item--selected' : ''}`}
                      onClick={() => handleSelectNote(note)}
                    >
                      <span className="visibility-note-title">
                        {note.title || 'Untitled'}
                      </span>
                      <span className="visibility-note-preview">
                        {(note.content || '').slice(0, 60)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="visibility-devices-panel">
          {selectedNote ? (
            <VisibilityToggle
              devices={devices}
              visibility={visibility}
              noteTitle={selectedNote.title || 'Untitled'}
              onToggle={handleToggle}
              saving={saving}
            />
          ) : (
            <div className="empty-state">
              <p>Select a note to configure device visibility</p>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast toast--visible">{toast}</div>}
    </Layout>
  );
}
