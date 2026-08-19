import { describe, it, expect, vi } from 'vitest';
import { parseCursor, encodeCursor } from '@synced-notepad/sync-core';
import { detectConflict, classifyConflict } from '@synced-notepad/sync-core';
import { isDuplicateChange } from '@synced-notepad/sync-core';
import { isRetryableError, computeDelay } from '@synced-notepad/sync-core';
import { ERROR_CODES } from '@synced-notepad/shared';

describe('Cursor encoding/decoding', () => {
  it('encodes and decodes a cursor round-trip', () => {
    const serverSequence = 42;
    const deviceId = 'device-abc';
    const cursor = encodeCursor(serverSequence, deviceId);
    const decoded = parseCursor(cursor);
    expect(decoded.serverSequence).toBe(42);
    expect(decoded.deviceId).toBe('device-abc');
  });

  it('returns defaults for null cursor', () => {
    const decoded = parseCursor(null);
    expect(decoded.serverSequence).toBe(0);
    expect(decoded.deviceId).toBeNull();
  });

  it('returns defaults for empty string cursor', () => {
    const decoded = parseCursor('');
    expect(decoded.serverSequence).toBe(0);
    expect(decoded.deviceId).toBeNull();
  });

  it('returns defaults for invalid base64', () => {
    const decoded = parseCursor('!!!not-base64!!!');
    expect(decoded.serverSequence).toBe(0);
    expect(decoded.deviceId).toBeNull();
  });

  it('encodes zero sequence correctly', () => {
    const cursor = encodeCursor(0, 'dev-1');
    const decoded = parseCursor(cursor);
    expect(decoded.serverSequence).toBe(0);
    expect(decoded.deviceId).toBe('dev-1');
  });

  it('encodes large sequence numbers', () => {
    const cursor = encodeCursor(999999, 'dev-large');
    const decoded = parseCursor(cursor);
    expect(decoded.serverSequence).toBe(999999);
    expect(decoded.deviceId).toBe('dev-large');
  });
});

describe('Conflict detection', () => {
  it('detects conflict when server revision > client base revision', () => {
    expect(detectConflict(5, 3)).toBe(true);
  });

  it('no conflict when server revision <= client base revision', () => {
    expect(detectConflict(3, 5)).toBe(false);
  });

  it('no conflict when revisions are equal', () => {
    expect(detectConflict(5, 5)).toBe(false);
  });

  it('conflict at revision 1 vs 0', () => {
    expect(detectConflict(1, 0)).toBe(true);
  });
});

describe('Conflict classification', () => {
  it('classifies delete vs edit', () => {
    const a = { type: 'note.deleted', payload: {} };
    const b = { type: 'note.updated', payload: { title: 'x' } };
    expect(classifyConflict(a, b)).toBe('delete_vs_edit');
  });

  it('classifies edit vs delete', () => {
    const a = { type: 'note.updated', payload: { title: 'x' } };
    const b = { type: 'note.deleted', payload: {} };
    expect(classifyConflict(a, b)).toBe('edit_vs_delete');
  });

  it('classifies delete vs delete', () => {
    const a = { type: 'note.deleted', payload: {} };
    const b = { type: 'note.deleted', payload: {} };
    expect(classifyConflict(a, b)).toBe('delete_vs_delete');
  });

  it('classifies rename vs rename', () => {
    const a = { type: 'note.updated', payload: { title: 'A', content: 'same' } };
    const b = { type: 'note.updated', payload: { title: 'B', content: 'same' } };
    expect(classifyConflict(a, b)).toBe('rename_vs_rename');
  });

  it('classifies same_field for identical payloads', () => {
    const a = { type: 'note.updated', payload: { title: 'Same', content: 'same' } };
    const b = { type: 'note.updated', payload: { title: 'Same', content: 'same' } };
    expect(classifyConflict(a, b)).toBe('same_field');
  });
});

describe('Change deduplication', () => {
  it('detects duplicate change', () => {
    const existing = [
      { noteId: 'n1', baseRevision: 2, type: 'note.updated' },
    ];
    const newChange = { noteId: 'n1', baseRevision: 2, type: 'note.updated' };
    expect(isDuplicateChange(existing, newChange)).toBe(true);
  });

  it('does not flag different noteId as duplicate', () => {
    const existing = [
      { noteId: 'n1', baseRevision: 2, type: 'note.updated' },
    ];
    const newChange = { noteId: 'n2', baseRevision: 2, type: 'note.updated' };
    expect(isDuplicateChange(existing, newChange)).toBe(false);
  });

  it('does not flag different revision as duplicate', () => {
    const existing = [
      { noteId: 'n1', baseRevision: 2, type: 'note.updated' },
    ];
    const newChange = { noteId: 'n1', baseRevision: 3, type: 'note.updated' };
    expect(isDuplicateChange(existing, newChange)).toBe(false);
  });

  it('does not flag different type as duplicate', () => {
    const existing = [
      { noteId: 'n1', baseRevision: 2, type: 'note.updated' },
    ];
    const newChange = { noteId: 'n1', baseRevision: 2, type: 'note.created' };
    expect(isDuplicateChange(existing, newChange)).toBe(false);
  });

  it('returns false for empty existing list', () => {
    const newChange = { noteId: 'n1', baseRevision: 1, type: 'note.updated' };
    expect(isDuplicateChange([], newChange)).toBe(false);
  });
});

describe('Retry logic', () => {
  it('marks network errors as retryable', () => {
    const err = new Error('ECONNRESET');
    expect(isRetryableError(err)).toBe(true);
  });

  it('marks 500 status as retryable', () => {
    const err = { statusCode: 500, message: 'Server Error' };
    expect(isRetryableError(err)).toBe(true);
  });

  it('marks 429 status as retryable', () => {
    const err = { statusCode: 429, message: 'Rate limited' };
    expect(isRetryableError(err)).toBe(true);
  });

  it('marks non-retryable AppError codes as not retryable', () => {
    const err = { code: ERROR_CODES.AUTH_ERROR, statusCode: 401 };
    expect(isRetryableError(err)).toBe(false);
  });

  it('marks 400 status as not retryable', () => {
    const err = { statusCode: 400, message: 'Bad request' };
    expect(isRetryableError(err)).toBe(false);
  });

  it('marks null as not retryable', () => {
    expect(isRetryableError(null)).toBe(false);
  });

  it('computes delay within expected range', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const delay = computeDelay(attempt, 1000);
      const maxExpected = Math.min(1000 * Math.pow(2, attempt), 30000);
      expect(delay).toBeGreaterThanOrEqual(maxExpected * 0.5);
      expect(delay).toBeLessThanOrEqual(maxExpected);
    }
  });
});
