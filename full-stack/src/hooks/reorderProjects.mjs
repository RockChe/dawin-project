// Pure, React-free reorder logic for Projects drag-sort (BUG01 fix).
//
// The persisted id order is computed synchronously from the current projects
// snapshot — NOT extracted from a setProjects updater side-effect — so it can
// never be lost when React defers or double-invokes the state updater.

/**
 * Compute the new project order from a drag (active dropped over target).
 * @param {Array<{id:string, sortOrder?:number}>} projects current snapshot
 * @param {string} activeId dragged project id
 * @param {string} overId   drop-target project id
 * @returns {null | { orderedIds: string[], optimistic: Array<object> }}
 *          null when the move is a no-op (unknown id); otherwise the persisted
 *          id order plus the optimistic list with sortOrder renumbered 1..N.
 */
export function planProjectReorder(projects, activeId, overId) {
  const sorted = [...projects].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const oldIdx = sorted.findIndex(pr => pr.id === activeId);
  const newIdx = sorted.findIndex(pr => pr.id === overId);
  if (oldIdx === -1 || newIdx === -1) return null;
  const [moved] = sorted.splice(oldIdx, 1);
  sorted.splice(newIdx, 0, moved);
  return {
    orderedIds: sorted.map(pr => pr.id),
    optimistic: sorted.map((pr, i) => ({ ...pr, sortOrder: i + 1 })),
  };
}

/**
 * Drive an optimistic reorder + persistence. Reads the id order up front
 * (pure), applies the optimistic state, then persists — independent of React's
 * updater timing. Returns null for a no-op; otherwise { result, orderedIds } so
 * the caller can roll back / surface errors.
 */
export async function runReorder({ projects, activeId, overId, setProjects, persist }) {
  const plan = planProjectReorder(projects, activeId, overId);
  if (!plan) return null;
  setProjects(plan.optimistic);
  const result = await persist(plan.orderedIds);
  return { result, orderedIds: plan.orderedIds };
}
