import { z } from 'zod';

const changeSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
  type: z.enum([
    'note.created',
    'note.updated',
    'note.deleted',
    'note.restored',
    'note.visibility_changed',
  ]),
  baseRevision: z.number().int().min(0),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export const syncRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  cursor: z.string().optional(),
  changes: z.array(changeSchema).max(100).optional(),
  appVersion: z.string(),
  syncProtocolVersion: z.number().int(),
});

export const syncResponseSchema = z.object({
  changes: z.array(changeSchema),
  cursor: z.string(),
  accepted: z.array(z.string().uuid()),
  conflicts: z.array(z.object({
    changeId: z.string().uuid(),
    serverVersion: z.record(z.unknown()),
  })),
  serverTime: z.string().datetime(),
});
