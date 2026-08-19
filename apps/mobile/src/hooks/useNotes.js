import { useState, useEffect, useCallback, useRef } from 'react';
import { noteService } from '../services/noteService.js';

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef(null);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await noteService.listNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await noteService.searchNotes(query);
        setNotes(data);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const createNote = useCallback(async ({ title, content, folder, workspaceId }) => {
    const id = await noteService.createNote({ title, content, folder, workspaceId });
    await loadNotes();
    return id;
  }, [loadNotes]);

  const updateNote = useCallback(async (id, fields) => {
    await noteService.updateNote(id, fields);
    await loadNotes();
  }, [loadNotes]);

  const deleteNote = useCallback(async (id) => {
    await noteService.deleteNote(id);
    await loadNotes();
  }, [loadNotes]);

  const restoreNote = useCallback(async (id) => {
    await noteService.restoreNote(id);
    await loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return {
    notes,
    loading,
    searchQuery,
    search,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    refresh: loadNotes,
  };
}
