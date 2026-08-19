'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout.js';
import NoteEditor from '../../../components/NoteEditor.js';
import useNotes from '../../../hooks/useNotes.js';
import useSync from '../../../hooks/useSync.js';

export default function NewNotePage() {
  const router = useRouter();
  const { createNote, updateNote, getNote, deleteNote } = useNotes();
  const syncContext = useSync();
  const [note, setNote] = useState(null);
  const [creating, setCreating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const created = await createNote('', '');
      if (!cancelled) {
        setNote(created);
        setCreating(false);
        router.replace(`/notes/${created.id}`, { scroll: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async (_id, changes) => {
    if (!note) return;
    await updateNote(note.id, changes);
    const updated = await getNote(note.id);
    setNote(updated);
  }, [note, updateNote, getNote]);

  const handleDelete = useCallback(async () => {
    if (note) {
      await deleteNote(note.id);
    }
    router.push('/');
  }, [note, deleteNote, router]);

  if (creating) {
    return (
      <Layout syncContext={syncContext}>
        <div className="empty-state">
          <p>Creating note...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout syncContext={syncContext}>
      <NoteEditor
        note={note}
        onSave={handleSave}
        onDelete={handleDelete}
        onRestore={() => {}}
      />
    </Layout>
  );
}
