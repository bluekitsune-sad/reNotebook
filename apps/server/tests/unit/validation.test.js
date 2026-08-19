import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const noteCreateSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(100_000).optional().default(''),
  folder: z.string().max(500).optional().default(''),
});

const noteUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(100_000).optional(),
  folder: z.string().max(500).optional(),
});

const syncRequestSchema = z.object({
  workspaceId: z.string().min(1),
  cursor: z.string().max(1024).nullable().optional(),
  changes: z.array(z.object({
    id: z.string().min(1),
    noteId: z.string().nullable().optional(),
    type: z.string().min(1),
    baseRevision: z.number().int().min(0),
    payload: z.record(z.any()).optional(),
  })).max(100).optional(),
  appVersion: z.string().optional(),
  syncProtocolVersion: z.number().int(),
});

const pairingRequestSchema = z.object({
  workspaceId: z.string().min(1),
  deviceName: z.string().min(1).max(200),
  devicePlatform: z.enum(['web', 'ios', 'android']),
});

describe('Note create schema', () => {
  it('accepts valid note', () => {
    const result = noteCreateSchema.safeParse({ title: 'My Note' });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = noteCreateSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const result = noteCreateSchema.safeParse({ content: 'hello' });
    expect(result.success).toBe(false);
  });

  it('accepts note with max title length', () => {
    const result = noteCreateSchema.safeParse({ title: 'a'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('rejects title exceeding max length', () => {
    const result = noteCreateSchema.safeParse({ title: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('applies default values for optional fields', () => {
    const result = noteCreateSchema.safeParse({ title: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe('');
      expect(result.data.folder).toBe('');
    }
  });
});

describe('Note update schema', () => {
  it('accepts partial update with title only', () => {
    const result = noteUpdateSchema.safeParse({ title: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with content only', () => {
    const result = noteUpdateSchema.safeParse({ content: 'New content' });
    expect(result.success).toBe(true);
  });

  it('accepts empty update object', () => {
    const result = noteUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects title that is too long', () => {
    const result = noteUpdateSchema.safeParse({ title: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects content that is too long', () => {
    const result = noteUpdateSchema.safeParse({ content: 'x'.repeat(100_001) });
    expect(result.success).toBe(false);
  });
});

describe('Sync request schema', () => {
  it('accepts valid sync request with changes', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: 'ws-1',
      syncProtocolVersion: 1,
      changes: [
        { id: 'c1', noteId: 'n1', type: 'note.updated', baseRevision: 1, payload: { title: 'Test' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts sync request without changes', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: 'ws-1',
      syncProtocolVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null cursor', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: 'ws-1',
      syncProtocolVersion: 1,
      cursor: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty workspaceId', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: '',
      syncProtocolVersion: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing syncProtocolVersion', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: 'ws-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects change with negative baseRevision', () => {
    const result = syncRequestSchema.safeParse({
      workspaceId: 'ws-1',
      syncProtocolVersion: 1,
      changes: [
        { id: 'c1', type: 'note.updated', baseRevision: -1 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('Pairing request schema', () => {
  it('accepts valid pairing request', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: 'My iPhone',
      devicePlatform: 'ios',
    });
    expect(result.success).toBe(true);
  });

  it('accepts web platform', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: 'Browser',
      devicePlatform: 'web',
    });
    expect(result.success).toBe(true);
  });

  it('accepts android platform', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: 'Pixel',
      devicePlatform: 'android',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid platform', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: 'Device',
      devicePlatform: 'windows',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty device name', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: '',
      devicePlatform: 'ios',
    });
    expect(result.success).toBe(false);
  });

  it('rejects device name exceeding max length', () => {
    const result = pairingRequestSchema.safeParse({
      workspaceId: 'ws-1',
      deviceName: 'a'.repeat(201),
      devicePlatform: 'ios',
    });
    expect(result.success).toBe(false);
  });
});
