'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '../../../components/Layout.js';
import NoteEditor from '../../../components/NoteEditor.js';
import useNotes from '../../../hooks/useNotes.js';

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const { getNote, updateNote, deleteNote, restoreNote } = useNotes();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadNote = useCallback(async () => {
    const loaded = await getNote(params.id);
    setNote(loaded);
    setLoading(false);
  }, [getNote, params.id]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleSave = useCallback(
    async (id, changes) => {
      await updateNote(id, changes);
      const updated = await getNote(id);
      setNote(updated);
    },
    [updateNote, getNote]
  );

  const handleDelete = useCallback(
    async (id) => {
      await deleteNote(id);
      router.push('/');
    },
    [deleteNote, router]
  );

  const handleRestore = useCallback(
    async (id) => {
      await restoreNote(id);
      const restored = await getNote(id);
      setNote(restored);
    },
    [restoreNote, getNote]
  );

  if (loading) {
    return (
      <Layout>
        <div className="empty-state">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <NoteEditor
        note={note}
        onSave={handleSave}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />
    </Layout>
  );
}
