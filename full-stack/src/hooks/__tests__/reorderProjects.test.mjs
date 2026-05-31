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
//
// Run: node --test src/hooks/__tests__/reorderProjects.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProjectReorder, runReorder } from '../reorderProjects.mjs';

const P = (id, sortOrder, extra = {}) => ({ id, sortOrder, name: id, ...extra });

test('planProjectReorder moves active before/over target and renumbers sortOrder 1..N', () => {
  const projects = [P('a', 1), P('b', 2), P('c', 3)];
  const plan = planProjectReorder(projects, 'a', 'c'); // move a to c's slot
  assert.deepEqual(plan.orderedIds, ['b', 'c', 'a']);
  assert.deepEqual(plan.optimistic.map(p => [p.id, p.sortOrder]), [
    ['b', 1], ['c', 2], ['a', 3],
  ]);
});

test('planProjectReorder sorts by sortOrder before computing (tolerates unsorted input)', () => {
  const projects = [P('c', 3), P('a', 1), P('b', 2)];
  const plan = planProjectReorder(projects, 'c', 'a'); // move c to a's slot (front)
  assert.deepEqual(plan.orderedIds, ['c', 'a', 'b']);
  assert.deepEqual(plan.optimistic.map(p => p.sortOrder), [1, 2, 3]);
});

test('planProjectReorder returns null for unknown ids (no-op)', () => {
  const projects = [P('a', 1), P('b', 2)];
  assert.equal(planProjectReorder(projects, 'a', 'zzz'), null);
  assert.equal(planProjectReorder(projects, 'zzz', 'b'), null);
});

test('planProjectReorder is pure — does not mutate input array or its objects', () => {
  const a = P('a', 1), b = P('b', 2), c = P('c', 3);
  const projects = [a, b, c];
  const snapshot = projects.map(p => ({ ...p }));
  planProjectReorder(projects, 'a', 'c');
  assert.deepEqual(projects, [a, b, c]);                 // array order untouched
  assert.deepEqual(projects.map(p => p.sortOrder), snapshot.map(p => p.sortOrder));
  assert.equal(a.sortOrder, 1);                          // element objects untouched
});

test('runReorder persists the correct id order even when setProjects DEFERS its updater (regression)', async () => {
  const projects = [P('a', 1), P('b', 2), P('c', 3)];
  // Faithful to React's contract: setProjects is allowed to NOT run an updater
  // synchronously. This fake records the call but never executes any updater —
  // exactly the condition under which the old code lost orderedIds.
  let setCalls = 0;
  const setProjects = () => { setCalls++; };
  const persistArgs = [];
  const persist = async (ids) => { persistArgs.push(ids); return { success: true }; };

  const outcome = await runReorder({ projects, activeId: 'a', overId: 'c', setProjects, persist });

  assert.equal(persistArgs.length, 1, 'persist must be called exactly once');
  assert.deepEqual(persistArgs[0], ['b', 'c', 'a'], 'persist must receive the reordered ids');
  assert.equal(setCalls, 1, 'optimistic state set once');
  assert.deepEqual(outcome.orderedIds, ['b', 'c', 'a']);
  assert.deepEqual(outcome.result, { success: true });
});

test('runReorder does NOT call persist for a no-op move', async () => {
  const projects = [P('a', 1), P('b', 2)];
  let persistCalled = false;
  const outcome = await runReorder({
    projects, activeId: 'a', overId: 'nope',
    setProjects: () => {},
    persist: async () => { persistCalled = true; return { success: true }; },
  });
  assert.equal(persistCalled, false);
  assert.equal(outcome, null);
});

test('runReorder surfaces persist result so caller can roll back on error', async () => {
  const projects = [P('a', 1), P('b', 2), P('c', 3)];
  const outcome = await runReorder({
    projects, activeId: 'c', overId: 'a',
    setProjects: () => {},
    persist: async () => ({ error: '無權限修改某些專案的排序' }),
  });
  assert.deepEqual(outcome.result, { error: '無權限修改某些專案的排序' });
  assert.deepEqual(outcome.orderedIds, ['c', 'a', 'b']);
});
