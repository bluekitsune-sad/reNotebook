import { generateId } from '@synced-notepad/shared';

export function createChange({ noteId, type, baseRevision, payload }) {
  return {
    id: generateId(),
    noteId,
    type,
    baseRevision,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function isDuplicateChange(existingChanges, newChange) {
  return existingChanges.some(
    (c) => c.noteId === newChange.noteId && c.baseRevision === newChange.baseRevision && c.type === newChange.type
  );
}
