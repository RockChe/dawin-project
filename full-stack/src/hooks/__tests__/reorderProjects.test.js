import { describe, it, expect } from 'vitest';
import { planProjectReorder, runReorder } from '@/hooks/reorderProjects';

// Regression tests for BUG01 — Projects drag-reorder not persisting.
//
// Root cause: the old hook read `orderedIds` out of a setProjects updater
// side-effect and used it SYNCHRONOUSLY before any await. React only
// guarantees updater functions run during render (and runs them twice in
// Strict Mode), so when React defers the updater, `orderedIds` was undefined
// and the persist server action was never called — the optimistic UI stayed
// but the DB was never written, so order reverted on refresh.
//
// These tests lock the corrected contract: the persisted id order is derived
// purely from the current projects snapshot, independent of when (or whether)
// React executes the state updater.

const P = (id, sortOrder, extra = {}) => ({ id, sortOrder, name: id, ...extra });

describe('planProjectReorder', () => {
  it('moves active over target and renumbers sortOrder 1..N', () => {
    const projects = [P('a', 1), P('b', 2), P('c', 3)];
    const plan = planProjectReorder(projects, 'a', 'c'); // move a to c's slot
    expect(plan.orderedIds).toEqual(['b', 'c', 'a']);
    expect(plan.optimistic.map(p => [p.id, p.sortOrder])).toEqual([
      ['b', 1], ['c', 2], ['a', 3],
    ]);
  });

  it('sorts by sortOrder before computing (tolerates unsorted input)', () => {
    const projects = [P('c', 3), P('a', 1), P('b', 2)];
    const plan = planProjectReorder(projects, 'c', 'a'); // move c to front
    expect(plan.orderedIds).toEqual(['c', 'a', 'b']);
    expect(plan.optimistic.map(p => p.sortOrder)).toEqual([1, 2, 3]);
  });

  it('returns null for unknown ids (no-op)', () => {
    const projects = [P('a', 1), P('b', 2)];
    expect(planProjectReorder(projects, 'a', 'zzz')).toBe(null);
    expect(planProjectReorder(projects, 'zzz', 'b')).toBe(null);
  });

  it('is pure — does not mutate the input array or its objects', () => {
    const a = P('a', 1), b = P('b', 2), c = P('c', 3);
    const projects = [a, b, c];
    planProjectReorder(projects, 'a', 'c');
    expect(projects).toEqual([a, b, c]);   // array order untouched
    expect(a.sortOrder).toBe(1);           // element objects untouched
    expect(c.sortOrder).toBe(3);
  });
});

describe('runReorder', () => {
  it('persists the correct id order even when setProjects DEFERS its updater (regression)', async () => {
    const projects = [P('a', 1), P('b', 2), P('c', 3)];
    // Faithful to React's contract: setProjects is allowed to NOT run an
    // updater synchronously. This fake records the call but never executes any
    // updater — exactly the condition under which the old code lost orderedIds.
    let setCalls = 0;
    const setProjects = () => { setCalls++; };
    const persistArgs = [];
    const persist = async (ids) => { persistArgs.push(ids); return { success: true }; };

    const outcome = await runReorder({ projects, activeId: 'a', overId: 'c', setProjects, persist });

    expect(persistArgs).toHaveLength(1);
    expect(persistArgs[0]).toEqual(['b', 'c', 'a']);
    expect(setCalls).toBe(1);
    expect(outcome.orderedIds).toEqual(['b', 'c', 'a']);
    expect(outcome.result).toEqual({ success: true });
  });

  it('does NOT call persist for a no-op move', async () => {
    const projects = [P('a', 1), P('b', 2)];
    let persistCalled = false;
    const outcome = await runReorder({
      projects, activeId: 'a', overId: 'nope',
      setProjects: () => {},
      persist: async () => { persistCalled = true; return { success: true }; },
    });
    expect(persistCalled).toBe(false);
    expect(outcome).toBe(null);
  });

  it('surfaces the persist result so the caller can roll back on error', async () => {
    const projects = [P('a', 1), P('b', 2), P('c', 3)];
    const outcome = await runReorder({
      projects, activeId: 'c', overId: 'a',
      setProjects: () => {},
      persist: async () => ({ error: '無權限修改某些專案的排序' }),
    });
    expect(outcome.result).toEqual({ error: '無權限修改某些專案的排序' });
    expect(outcome.orderedIds).toEqual(['c', 'a', 'b']);
  });
});
