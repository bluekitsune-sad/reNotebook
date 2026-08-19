'use client';

import Link from 'next/link';

export default function NoteList({ notes, searchQuery, onSearchChange }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPreview = (content) => {
    if (!content) return 'Empty note';
    const firstLine = content.split('\n')[0].trim();
    return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
  };

  return (
    <div>
      <div className="search-bar">
        <span className="search-icon">&#128269;</span>
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128221;</div>
          <h3>{searchQuery ? 'No notes found' : 'No notes yet'}</h3>
          <p>{searchQuery ? 'Try a different search term' : 'Create your first note to get started'}</p>
          {!searchQuery && (
            <Link href="/notes/new" className="btn-primary" style={{ display: 'inline-block' }}>
              New Note
            </Link>
          )}
        </div>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note-item">
              <Link href={`/notes/${note.id}`} className="note-item-content">
                <div className="note-title">{note.title || 'Untitled'}</div>
                <div className="note-preview">{getPreview(note.content)}</div>
                <div className="note-meta">{formatDate(note.updatedAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
