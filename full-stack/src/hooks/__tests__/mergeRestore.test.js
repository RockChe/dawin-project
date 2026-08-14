import { describe, it, expect } from 'vitest';
import { mergeRestore } from '@/hooks/useTaskManager';

// Unit tests for the cascade-delete rollback merge.
//
// The helper's contract (per its own doc comment) is: put the removed rows back
// in their original relative position, WITHOUT clobbering edits made to other
// rows while the delete was in flight, and without resurrecting rows that some
// other operation deleted in the meantime.
//
// The "keeps its since-edited value" half of that contract was not actually
// implemented: surviving rows were taken from `originalSnapshot`, so a
// concurrent edit landing during the in-flight delete got reverted on rollback.

const R = (id, extra = {}) => ({ id, name: id, ...extra });

describe('mergeRestore', () => {
  it('returns current untouched when nothing was removed', () => {
    const current = [R('a'), R('b')];
    expect(mergeRestore(current, [R('a'), R('b')], [])).toBe(current);
  });

  it('puts a removed row back in its original position', () => {
    const snapshot = [R('a'), R('b'), R('c')];
    const current = [R('a'), R('c')]; // b was optimistically deleted
    const out = mergeRestore(current, snapshot, [R('b')]);
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves a concurrent edit to a surviving row', () => {
    const snapshot = [R('a', { name: 'old' }), R('b'), R('c')];
    // b deleted optimistically; meanwhile the user renamed a
    const current = [R('a', { name: 'EDITED' }), R('c')];
    const out = mergeRestore(current, snapshot, [R('b')]);
    expect(out.find(r => r.id === 'a').name).toBe('EDITED');
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('appends rows created after the snapshot', () => {
    const snapshot = [R('a'), R('b')];
    const current = [R('a'), R('new')];
    const out = mergeRestore(current, snapshot, [R('b')]);
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'new']);
  });

  it('does not resurrect a row deleted by another operation', () => {
    const snapshot = [R('a'), R('b'), R('c')];
    // b removed by THIS delete, c removed by something else concurrently
    const current = [R('a')];
    const out = mergeRestore(current, snapshot, [R('b')]);
    expect(out.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('restores multiple removed rows keeping snapshot order', () => {
    const snapshot = [R('a'), R('b'), R('c'), R('d')];
    const current = [R('b')];
    const out = mergeRestore(current, snapshot, [R('a'), R('c'), R('d')]);
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
