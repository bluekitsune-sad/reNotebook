export function detectConflict(serverRevision, clientBaseRevision) {
  return serverRevision > clientBaseRevision;
}

export function classifyConflict(changeA, changeB) {
  if (changeA.type === 'note.deleted' && changeB.type === 'note.updated') {
    return 'delete_vs_edit';
  }
  if (changeA.type === 'note.updated' && changeB.type === 'note.deleted') {
    return 'edit_vs_delete';
  }
  if (changeA.type === 'note.deleted' && changeB.type === 'note.deleted') {
    return 'delete_vs_delete';
  }
  if (changeA.payload?.title !== changeB.payload?.title) {
    return 'rename_vs_rename';
  }
  return 'same_field';
}
