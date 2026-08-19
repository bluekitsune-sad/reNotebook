'use client';

import Layout from '../components/Layout.js';
import NoteList from '../components/NoteList.js';
import useNotes from '../hooks/useNotes.js';
import Link from 'next/link';

export default function Home() {
  const { notes, searchQuery, setSearchQuery } = useNotes();

  return (
    <Layout>
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
