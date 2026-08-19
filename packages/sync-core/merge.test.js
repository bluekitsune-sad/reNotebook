import { describe, it, expect } from 'vitest';
import { threeWayMerge, mergeTextContent } from './merge/index.js';
import { detectConflict, classifyConflict } from './conflicts/index.js';

describe('threeWayMerge — field-level merge', () => {
  it('merges when A changes title, B changes content', () => {
    const base = { title: 'Original', content: 'Original content', folder: '' };
    const versionA = { title: 'Title A', content: 'Original content', folder: '' };
    const versionB = { title: 'Original', content: 'Content B', folder: '' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged.title).toBe('Title A');
    expect(result.merged.content).toBe('Content B');
    expect(result.conflictFields).toHaveLength(0);
  });

  it('detects conflict when both change the same field', () => {
    const base = { title: 'Original', content: 'Original content' };
    const versionA = { title: 'Title A', content: 'Original content' };
    const versionB = { title: 'Title B', content: 'Original content' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictFields).toContain('title');
  });

  it('detects conflict when both change title and content', () => {
    const base = { title: 'Original', content: 'Original content' };
    const versionA = { title: 'Title A', content: 'Content A' };
    const versionB = { title: 'Title B', content: 'Content B' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictFields).toContain('title');
    expect(result.conflictFields).toContain('content');
  });

  it('detects conflict when both change the same fields even if values differ from base', () => {
    const base = { title: 'Original', content: 'Original content' };
    const versionA = { title: 'Same', content: 'Same content' };
    const versionB = { title: 'Same', content: 'Same content' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictFields).toContain('title');
    expect(result.conflictFields).toContain('content');
  });

  it('returns base when neither version changed', () => {
    const base = { title: 'Original', content: 'Original content' };
    const versionA = { title: 'Original', content: 'Original content' };
    const versionB = { title: 'Original', content: 'Original content' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toEqual(base);
  });

  it('handles A changes nothing, B changes content', () => {
    const base = { title: 'Original', content: 'Base content' };
    const versionA = { title: 'Original', content: 'Base content' };
    const versionB = { title: 'Original', content: 'B content' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged.content).toBe('B content');
  });

  it('handles empty content in all versions', () => {
    const base = { title: '', content: '' };
    const versionA = { title: 'A', content: '' };
    const versionB = { title: '', content: 'B' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged.title).toBe('A');
    expect(result.merged.content).toBe('B');
  });

  it('preserves extra fields in base', () => {
    const base = { title: 'Original', content: 'Base', folder: 'work' };
    const versionA = { title: 'A', content: 'Base', folder: 'work' };
    const versionB = { title: 'Original', content: 'B', folder: 'work' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged.folder).toBe('work');
  });

  it('detects conflict on folder field', () => {
    const base = { title: 'T', content: 'C', folder: 'work' };
    const versionA = { title: 'T', content: 'C', folder: 'personal' };
    const versionB = { title: 'T', content: 'C', folder: 'archive' };

    const result = threeWayMerge(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictFields).toContain('folder');
  });
});

describe('mergeTextContent — line-level merge', () => {
  it('merges when A edits line 1 and B edits line 3', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const versionA = 'Line 1 modified\nLine 2\nLine 3';
    const versionB = 'Line 1\nLine 2\nLine 3 modified';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('Line 1 modified\nLine 2\nLine 3 modified');
  });

  it('detects conflict when both edit same line', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const versionA = 'Line 1 A\nLine 2\nLine 3';
    const versionB = 'Line 1 B\nLine 2\nLine 3';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictLines).toContain(0);
  });

  it('handles A adds new line at end, B unchanged', () => {
    const base = 'Line 1\nLine 2';
    const versionA = 'Line 1\nLine 2\nLine 3';
    const versionB = 'Line 1\nLine 2';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles A adds line in middle, B unchanged', () => {
    const base = 'Line 1\nLine 3';
    const versionA = 'Line 1\nLine 2\nLine 3';
    const versionB = 'Line 1\nLine 3';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles A changes line 1, B unchanged', () => {
    const base = 'Line 1\nLine 2';
    const versionA = 'Line 1 modified\nLine 2';
    const versionB = 'Line 1\nLine 2';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('Line 1 modified\nLine 2');
  });

  it('detects conflict when both add to same position', () => {
    const base = 'Line 1';
    const versionA = 'Line 1\nLine 2';
    const versionB = 'Line 1\nLine 3';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictLines).toContain(1);
  });

  it('returns empty for all empty inputs', () => {
    const result = mergeTextContent('', '', '');

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('');
  });

  it('handles null/undefined content', () => {
    const result = mergeTextContent(null, null, null);

    expect(result.autoMergeable).toBe(true);
  });

  it('detects conflict when both change same line differently', () => {
    const base = 'AAA\nBBB\nCCC';
    const versionA = 'AAA\nBBB modified\nCCC';
    const versionB = 'AAA\nBBB different\nCCC';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
    expect(result.conflictLines).toContain(1);
  });

  it('single line — both edit', () => {
    const base = 'Only line';
    const versionA = 'Only line A';
    const versionB = 'Only line B';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(false);
  });

  it('single line — only A edits', () => {
    const base = 'Only line';
    const versionA = 'Only line edited';
    const versionB = 'Only line';

    const result = mergeTextContent(base, versionA, versionB);

    expect(result.autoMergeable).toBe(true);
    expect(result.merged).toBe('Only line edited');
  });
});

describe('Conflict detection and classification', () => {
  it('detects conflict correctly across revisions', () => {
    expect(detectConflict(2, 1)).toBe(true);
    expect(detectConflict(1, 2)).toBe(false);
    expect(detectConflict(1, 1)).toBe(false);
    expect(detectConflict(0, 0)).toBe(false);
  });

  it('classifies all conflict types', () => {
    const del = { type: 'note.deleted', payload: {} };
    const upd = { type: 'note.updated', payload: { title: 'X' } };

    expect(classifyConflict(del, upd)).toBe('delete_vs_edit');
    expect(classifyConflict(upd, del)).toBe('edit_vs_delete');
    expect(classifyConflict(del, del)).toBe('delete_vs_delete');

    const updA = { type: 'note.updated', payload: { title: 'A', content: 'same' } };
    const updB = { type: 'note.updated', payload: { title: 'B', content: 'same' } };
    expect(classifyConflict(updA, updB)).toBe('rename_vs_rename');

    const sameA = { type: 'note.updated', payload: { title: 'Same', content: 'Same' } };
    const sameB = { type: 'note.updated', payload: { title: 'Same', content: 'Same' } };
    expect(classifyConflict(sameA, sameB)).toBe('same_field');
  });

  it('classifies content-only difference as same_field', () => {
    const a = { type: 'note.updated', payload: { title: 'T', content: 'A content' } };
    const b = { type: 'note.updated', payload: { title: 'T', content: 'B content' } };
    expect(classifyConflict(a, b)).toBe('same_field');
  });
});
