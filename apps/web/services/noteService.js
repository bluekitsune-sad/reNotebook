import { notesRepository, changesRepository } from '../repositories/index.js';
import { generateId, timestamp } from '@synced-notepad/shared';
import { CHANGE_TYPES } from '@synced-notepad/shared';

const noteService = {
  async create(title = '', content = '') {
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

    return notesRepository.get(localId);
  },

  async update(id, changes) {
    const existing = await notesRepository.get(id);
    if (!existing) throw new Error('Note not found');

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

    return notesRepository.get(id);
  },

  async remove(id) {
    const existing = await notesRepository.get(id);
    if (!existing) throw new Error('Note not found');

    await notesRepository.update(id, { status: 'deleted' });

    await changesRepository.queue({
      noteId: existing.serverId,
      type: CHANGE_TYPES.NOTE_DELETED,
      baseRevision: existing.currentRevision || 0,
      payload: {},
    });
  },

  async restore(id) {
    const existing = await notesRepository.get(id);
    if (!existing) throw new Error('Note not found');

    const newRevision = (existing.currentRevision || 0) + 1;
    await notesRepository.update(id, { status: 'active', currentRevision: newRevision });

    await changesRepository.queue({
      noteId: existing.serverId,
      type: CHANGE_TYPES.NOTE_RESTORED,
      baseRevision: existing.currentRevision || 0,
      payload: { title: existing.title, content: existing.content },
    });
  },

  async get(id) {
    return notesRepository.get(id);
  },

  async list() {
    return notesRepository.list();
  },

  async search(query) {
    return notesRepository.search(query);
  },
};

export default noteService;
