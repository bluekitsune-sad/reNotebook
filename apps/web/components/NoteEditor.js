'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function NoteEditor({ note, onSave, onDelete, onRestore }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const titleRef = useRef(title);
  const contentRef = useRef(content);

  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setSaveStatus('saved');
    }
  }, [note?.id]);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleSave = useCallback(async () => {
    if (!note) return;
    setSaveStatus('saving');
    try {
      await onSave(note.id, { title: titleRef.current, content: contentRef.current });
      setSaveStatus('saved');
      showToast('Note saved');
    } catch {
      setSaveStatus('error');
      showToast('Failed to save');
    }
  }, [note, onSave, showToast]);

  useEffect(() => {
    if (!note) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus('unsaved');
    timerRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, content, note?.id, handleSave]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleDelete = async () => {
    if (!note) return;
    if (window.confirm('Delete this note?')) {
      await onDelete(note.id);
      showToast('Note deleted');
    }
  };

  const handleRestore = async () => {
    if (!note) return;
    await onRestore(note.id);
    showToast('Note restored');
  };

  if (!note) {
    return (
      <div className="empty-state">
        <h3>Note not found</h3>
        <p>This note may have been deleted.</p>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <input
        className="title-input"
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="content-input"
        placeholder="Start writing..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <span className={`save-indicator ${saveStatus === 'saving' ? 'save-indicator--saving' : ''}`}>
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Save failed'}
          </span>
          {note.currentRevision > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              v{note.currentRevision}
            </span>
          )}
        </div>
        <div className="editor-toolbar-right">
          <button className="btn-primary btn-sm" onClick={handleSave}>
            Save
          </button>
          {note.status === 'active' ? (
            <button className="btn-danger btn-sm" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <button className="btn-secondary btn-sm" onClick={handleRestore}>
              Restore
            </button>
          )}
        </div>
      </div>

      <div className={`toast ${toast ? 'toast--visible' : ''}`}>
        {toast}
      </div>
    </div>
  );
}
