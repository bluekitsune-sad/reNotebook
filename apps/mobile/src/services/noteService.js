import { notesRepository } from '../repositories/notesRepository.js';
import { changesRepository } from '../repositories/changesRepository.js';
import { createChange } from '@synced-notepad/sync-core';
import { CHANGE_TYPES } from '@synced-notepad/shared';

export const noteService = {
  async createNote({ title, content, folder, workspaceId }) {
    const localId = await notesRepository.create({
      title: title || '',
      content: content || '',
      folder: folder || '',
      workspaceId,
    });

    const change = createChange({
      noteId: `local-${localId}`,
      type: CHANGE_TYPES.NOTE_CREATED,
      baseRevision: 0,
      payload: {
        title: title || '',
        content: content || '',
        folder: folder || '',
        workspaceId,
      },
    });

    await changesRepository.create(change);
    return localId;
  },

  async updateNote(id, { title, content, folder }) {
    const note = await notesRepository.get(id);
    if (!note) throw new Error('Note not found');

    const newRevision = await notesRepository.update(id, { title, content, folder });

    const change = createChange({
      noteId: note.server_id || `local-${id}`,
      type: CHANGE_TYPES.NOTE_UPDATED,
      baseRevision: (note.current_revision || 1) - 1,
      payload: {
        title: title !== undefined ? title : note.title,
        content: content !== undefined ? content : note.content,
        folder: folder !== undefined ? folder : note.folder,
      },
    });

    await changesRepository.create(change);
    return newRevision;
  },

  async deleteNote(id) {
    const note = await notesRepository.get(id);
    if (!note) throw new Error('Note not found');

    await notesRepository.delete(id);

    const change = createChange({
      noteId: note.server_id || `local-${id}`,
      type: CHANGE_TYPES.NOTE_DELETED,
      baseRevision: note.current_revision || 1,
      payload: {},
    });

    await changesRepository.create(change);
  },

  async restoreNote(id) {
    const note = await notesRepository.getById(id);
    if (!note) throw new Error('Note not found');

    await notesRepository.restore(id);

    const change = createChange({
      noteId: note.server_id || `local-${id}`,
      type: CHANGE_TYPES.NOTE_RESTORED,
      baseRevision: note.current_revision || 1,
      payload: {},
    });

    await changesRepository.create(change);
  },

  async getNote(id) {
    return notesRepository.get(id);
  },

  async listNotes() {
    return notesRepository.list();
  },

  async listDeletedNotes() {
    return notesRepository.listDeleted();
  },

  async searchNotes(query) {
    if (!query || !query.trim()) return notesRepository.list();
    return notesRepository.search(query.trim());
  },

  async getPendingCount() {
    return changesRepository.countPending();
  },

  async getNoteRevisions(id) {
    return notesRepository.getRevisions(id);
  },
};
