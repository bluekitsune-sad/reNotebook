'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { notesRepository, changesRepository } from '../repositories/index.js';
import { generateId, timestamp } from '@synced-notepad/shared';
import { CHANGE_TYPES } from '@synced-notepad/shared';

export default function useNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef(searchQuery);

  searchQueryRef.current = searchQuery;

  const refresh = useCallback(async () => {
    const q = searchQueryRef.current;
    const result = q
      ? await notesRepository.search(q)
      : await notesRepository.list();
    setNotes(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(refresh, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, refresh]);

  const createNote = useCallback(async (title = '', content = '') => {
    const now = timestamp();
    const serverId = generateId();
    const localId = await notesRepository.create({
      _id: serverId,
      workspaceId: 'default',
      title,
      content,
      folder: '',
      status: 'active',
      currentRevision: 0,
      createdAt: now,
      updatedAt: now,
    });

    await changesRepository.queue({
      noteId: serverId,
      type: CHANGE_TYPES.NOTE_CREATED,
      baseRevision: 0,
      payload: { title, content, folder: '' },
    });

    const note = await notesRepository.get(localId);
    await refresh();
    return note;
  }, [refresh]);

  const updateNote = useCallback(async (id, changes) => {
    const existing = await notesRepository.get(id);
    if (!existing) return;

    const newRevision = (existing.currentRevision || 0) + 1;
    await notesRepository.update(id, { ...changes, currentRevision: newRevision });

    await changesRepository.queue({
      noteId: existing.serverId,
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: existing.currentRevision || 0,
      payload: {
        title: changes.title !== undefined ? changes.title : existing.title,
        content: changes.content !== undefined ? changes.content : existing.content,
        folder: changes.folder !== undefined ? changes.folder : existing.folder,
      },
    });

    await refresh();
  }, [refresh]);

  const deleteNote = useCallback(async (id) => {
    const existing = await notesRepository.get(id);
    if (!existing) return;

    await notesRepository.update(id, { status: 'deleted' });

    await changesRepository.queue({
      noteId: existing.serverId,
      type: CHANGE_TYPES.NOTE_DELETED,
      baseRevision: existing.currentRevision || 0,
      payload: {},
    });

    await refresh();
  }, [refresh]);

  const restoreNote = useCallback(async (id) => {
    const existing = await notesRepository.get(id);
    if (!existing) return;

    const newRevision = (existing.currentRevision || 0) + 1;
    await notesRepository.update(id, { status: 'active', currentRevision: newRevision });

    await changesRepository.queue({
      noteId: existing.serverId,
      type: CHANGE_TYPES.NOTE_RESTORED,
      baseRevision: existing.currentRevision || 0,
      payload: { title: existing.title, content: existing.content },
    });

    await refresh();
  }, [refresh]);

  const getNote = useCallback(async (id) => {
    return notesRepository.get(id);
  }, []);

  return {
    notes,
    loading,
    searchQuery,
    setSearchQuery,
    refresh,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    getNote,
  };
}
