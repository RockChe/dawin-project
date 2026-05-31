/**
 * TDD tests for ProjectsTab pure helpers (W2-1).
 * RED → GREEN → REFACTOR
 *
 * Function under test (exported from ProjectsTab.jsx):
 *   toggleHidden — add/remove a project id in the hiddenProjects array.
 *
 * Contract mirrors GanttTimeline's toggleCollapsed: immutable, undefined-safe,
 * idempotent for add-then-remove. hiddenProjects uses project.id (stable).
 */

import { describe, it, expect } from 'vitest';
import { toggleHidden } from '@/components/dashboard/tabs/ProjectsTab';

describe('toggleHidden', () => {
  it('appends id when not present', () => {
    expect(toggleHidden([], 'p1')).toEqual(['p1']);
  });

  it('removes id when present', () => {
    expect(toggleHidden(['p1', 'p2'], 'p1')).toEqual(['p2']);
  });

  it('removes from middle', () => {
    expect(toggleHidden(['p1', 'p2', 'p3'], 'p2')).toEqual(['p1', 'p3']);
  });

  it('does not mutate input array', () => {
    const orig = ['p1', 'p2'];
    toggleHidden(orig, 'p1');
    expect(orig).toEqual(['p1', 'p2']);
  });

  it('handles undefined hiddenIds → treats as []', () => {
    expect(toggleHidden(undefined, 'p1')).toEqual(['p1']);
  });

  it('handles null hiddenIds → treats as []', () => {
    expect(toggleHidden(null, 'p1')).toEqual(['p1']);
  });

  it('is idempotent for add then remove', () => {
    const after = toggleHidden(toggleHidden([], 'p1'), 'p1');
    expect(after).toEqual([]);
  });

  it('returns a new array reference', () => {
    const orig = ['p1'];
    const result = toggleHidden(orig, 'p2');
    expect(result).not.toBe(orig);
  });
});
