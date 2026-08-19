import { VisibilityRule, Note } from '../models/index.js';
import { notFound, badRequest, ERROR_CODES } from '@synced-notepad/shared';

export async function getVisibilityRules(noteId) {
  const rules = await VisibilityRule.find({ noteId });
  return { rules };
}

export async function getHiddenNoteIds(deviceId) {
  const rules = await VisibilityRule.find({ deviceId, visible: false }).select('noteId');
  return rules.map((r) => r.noteId.toString());
}

export async function isNoteVisibleToDevice(noteId, deviceId) {
  const rule = await VisibilityRule.findOne({ noteId, deviceId });
  if (!rule) return true;
  return rule.visible;
}

export async function setVisibilityRule(workspaceId, noteId, deviceId, visible) {
  const note = await Note.findOne({ _id: noteId, workspaceId });
  if (!note) {
    throw notFound(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
  }

  const rule = await VisibilityRule.findOneAndUpdate(
    { noteId, deviceId },
    { workspaceId, noteId, deviceId, visible },
    { new: true, upsert: true },
  );

  return { rule };
}

export async function removeVisibilityRule(noteId, deviceId) {
  const rule = await VisibilityRule.findOneAndDelete({ noteId, deviceId });
  if (!rule) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'Visibility rule not found');
  }
  return { success: true };
}
