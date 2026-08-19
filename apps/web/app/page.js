'use client';

import Layout from '../components/Layout.js';
import NoteList from '../components/NoteList.js';
import useNotes from '../hooks/useNotes.js';
import useSync from '../hooks/useSync.js';
import Link from 'next/link';

export default function Home() {
  const { notes, loading, searchQuery, setSearchQuery } = useNotes();
  const syncContext = useSync();

  return (
    <Layout syncContext={syncContext}>
      <div className="page-header">
        <h1>My Notes</h1>
        <Link href="/notes/new" className="btn-primary btn-sm">
          + New Note
        </Link>
      </div>
      <NoteList
        notes={notes}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </Layout>
  );
}
