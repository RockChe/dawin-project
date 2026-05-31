/**
 * TDD tests for GanttTimeline pure helper functions.
 * RED → GREEN → REFACTOR
 *
 * Functions under test (exported from GanttTimeline.jsx):
 *   filterVisibleTasks, computeProjectProgress, sortProjectNames,
 *   toggleCollapsed, isCollapsed
 */

import { describe, it, expect } from 'vitest';
import {
  filterVisibleTasks,
  computeProjectProgress,
  sortProjectNames,
  toggleCollapsed,
  isCollapsed,
  uniqueProjectIds,
} from '@/components/dashboard/GanttTimeline';

// ── filterVisibleTasks ────────────────────────────────────────────────────────

describe('filterVisibleTasks', () => {
  const tasks = [
    { id: '1', projectId: 'p1', project: 'Alpha' },
    { id: '2', projectId: 'p2', project: 'Beta' },
    { id: '3', projectId: 'p1', project: 'Alpha' },
    { id: '4', projectId: 'p3', project: 'Gamma' },
  ];

  it('returns all tasks when hiddenProjects is empty array', () => {
    expect(filterVisibleTasks(tasks, [])).toHaveLength(4);
  });

  it('returns all tasks when hiddenProjects is undefined', () => {
    expect(filterVisibleTasks(tasks, undefined)).toHaveLength(4);
  });

  it('returns all tasks when hiddenProjects is null', () => {
    expect(filterVisibleTasks(tasks, null)).toHaveLength(4);
  });

  it('excludes tasks whose projectId is in hiddenProjects', () => {
    const result = filterVisibleTasks(tasks, ['p1']);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(['2', '4']);
  });

  it('excludes multiple hidden projects', () => {
    const result = filterVisibleTasks(tasks, ['p1', 'p3']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when all projects are hidden', () => {
    const result = filterVisibleTasks(tasks, ['p1', 'p2', 'p3']);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when input tasks is empty', () => {
    expect(filterVisibleTasks([], ['p1'])).toHaveLength(0);
  });

  it('returns a new array (does not mutate input)', () => {
    const original = [...tasks];
    const result = filterVisibleTasks(tasks, ['p1']);
    expect(tasks).toHaveLength(4); // unchanged
    expect(result).not.toBe(tasks);
  });

  it('hiddenProjects with unknown id does not filter anything', () => {
    const result = filterVisibleTasks(tasks, ['pXYZ']);
    expect(result).toHaveLength(4);
  });
});

// ── computeProjectProgress ────────────────────────────────────────────────────

describe('computeProjectProgress', () => {
  it('returns 0 for empty array', () => {
    expect(computeProjectProgress([])).toBe(0);
  });

  it('returns 0 for null input', () => {
    expect(computeProjectProgress(null)).toBe(0);
  });

  it('returns correct average for single task', () => {
    expect(computeProjectProgress([{ progress: 50 }])).toBe(50);
  });

  it('returns rounded integer average', () => {
    // (30 + 40 + 50) / 3 = 40
    expect(computeProjectProgress([
      { progress: 30 },
      { progress: 40 },
      { progress: 50 },
    ])).toBe(40);
  });

  it('rounds correctly (0.5 → 1)', () => {
    // (0 + 1) / 2 = 0.5 → rounds to 1
    expect(computeProjectProgress([
      { progress: 0 },
      { progress: 1 },
    ])).toBe(1);
  });

  it('handles all 100% tasks', () => {
    expect(computeProjectProgress([
      { progress: 100 },
      { progress: 100 },
    ])).toBe(100);
  });

  it('handles all 0% tasks', () => {
    expect(computeProjectProgress([
      { progress: 0 },
      { progress: 0 },
    ])).toBe(0);
  });

  it('returns integer (not float)', () => {
    const result = computeProjectProgress([{ progress: 33 }, { progress: 34 }]);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ── sortProjectNames ──────────────────────────────────────────────────────────

describe('sortProjectNames', () => {
  const names = ['Gamma', 'Alpha', 'Beta'];

  // ── "name" mode ────────────────────────────────────────────────────────────
  describe('mode: "name"', () => {
    it('sorts ascending by name (ASCII)', () => {
      const result = sortProjectNames(names, 'name');
      expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('does not mutate the input array', () => {
      const orig = [...names];
      sortProjectNames(names, 'name');
      expect(names).toEqual(orig);
    });

    it('handles empty array', () => {
      expect(sortProjectNames([], 'name')).toEqual([]);
    });

    it('handles Chinese names ascending (zh-Hant localeCompare order)', () => {
      const cn = ['甲', '乙', '丙'];
      const result = sortProjectNames(cn, 'name');
      // Verify it uses localeCompare('zh-Hant') — actual order: 乙 丙 甲
      expect(result).toEqual(['乙', '丙', '甲']);
    });
  });

  // ── "progress" mode ────────────────────────────────────────────────────────
  describe('mode: "progress"', () => {
    it('sorts descending by progressByName', () => {
      const result = sortProjectNames(['A', 'B', 'C'], 'progress', {
        progressByName: { A: 30, B: 80, C: 50 },
      });
      expect(result).toEqual(['B', 'C', 'A']);
    });

    it('tiebreaks by name localeCompare ascending', () => {
      // A and C both 50; B=80
      const result = sortProjectNames(['C', 'B', 'A'], 'progress', {
        progressByName: { A: 50, B: 80, C: 50 },
      });
      expect(result).toEqual(['B', 'A', 'C']); // A < C alphabetically
    });

    it('missing progressByName entry treated as 0', () => {
      const result = sortProjectNames(['X', 'Y'], 'progress', {
        progressByName: { X: 40 },
      });
      expect(result).toEqual(['X', 'Y']); // X=40 > Y=0
    });

    it('all zero → stable name order (tiebreak by localeCompare)', () => {
      const result = sortProjectNames(['C', 'A', 'B'], 'progress', {
        progressByName: {},
      });
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('returns a new array', () => {
      const orig = ['A', 'B'];
      const result = sortProjectNames(orig, 'progress', { progressByName: { A: 10, B: 20 } });
      expect(result).not.toBe(orig);
    });

    it('handles empty progressByName (opts omitted)', () => {
      const result = sortProjectNames(['B', 'A'], 'progress');
      // both 0, tiebreak by name: A < B
      expect(result).toEqual(['A', 'B']);
    });
  });

  // ── "manual" mode ──────────────────────────────────────────────────────────
  describe('mode: "manual"', () => {
    it('sorts by sortOrderByName ascending', () => {
      const result = sortProjectNames(['C', 'A', 'B'], 'manual', {
        sortOrderByName: { A: 1, B: 2, C: 3 },
      });
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('unknown project (not in sortOrderByName) goes last', () => {
      const result = sortProjectNames(['X', 'A', 'B'], 'manual', {
        sortOrderByName: { A: 1, B: 2 }, // X not present
      });
      expect(result).toEqual(['A', 'B', 'X']);
    });

    it('returns original order when sortOrderByName is not provided', () => {
      const orig = ['C', 'A', 'B'];
      const result = sortProjectNames(orig, 'manual');
      expect(result).toEqual(['C', 'A', 'B']);
    });

    it('returns original order when sortOrderByName is empty', () => {
      const orig = ['C', 'A', 'B'];
      const result = sortProjectNames(orig, 'manual', { sortOrderByName: {} });
      expect(result).toEqual(['C', 'A', 'B']);
    });

    it('returns a new array even when order unchanged', () => {
      const orig = ['A', 'B'];
      const result = sortProjectNames(orig, 'manual', { sortOrderByName: { A: 1, B: 2 } });
      expect(result).not.toBe(orig);
    });
  });

  // ── unknown mode ───────────────────────────────────────────────────────────
  describe('unknown mode (fallback to manual)', () => {
    it('treats unknown mode as manual — returns original order', () => {
      const orig = ['C', 'A', 'B'];
      const result = sortProjectNames(orig, 'foobar');
      expect(result).toEqual(['C', 'A', 'B']);
    });

    it('treats unknown mode as manual — uses sortOrderByName if provided', () => {
      const result = sortProjectNames(['C', 'A', 'B'], 'xyz', {
        sortOrderByName: { A: 1, B: 2, C: 3 },
      });
      expect(result).toEqual(['A', 'B', 'C']);
    });
  });
});

// ── toggleCollapsed ───────────────────────────────────────────────────────────

describe('toggleCollapsed', () => {
  it('appends id when not present', () => {
    expect(toggleCollapsed([], 'p1')).toEqual(['p1']);
  });

  it('removes id when present', () => {
    expect(toggleCollapsed(['p1', 'p2'], 'p1')).toEqual(['p2']);
  });

  it('removes from middle', () => {
    expect(toggleCollapsed(['p1', 'p2', 'p3'], 'p2')).toEqual(['p1', 'p3']);
  });

  it('does not mutate input array', () => {
    const orig = ['p1', 'p2'];
    toggleCollapsed(orig, 'p1');
    expect(orig).toEqual(['p1', 'p2']);
  });

  it('handles undefined collapsedIds → treats as []', () => {
    expect(toggleCollapsed(undefined, 'p1')).toEqual(['p1']);
  });

  it('is idempotent for add then remove', () => {
    const after = toggleCollapsed(toggleCollapsed([], 'p1'), 'p1');
    expect(after).toEqual([]);
  });

  it('returns new array reference', () => {
    const orig = ['p1'];
    const result = toggleCollapsed(orig, 'p2');
    expect(result).not.toBe(orig);
  });
});

// ── isCollapsed ───────────────────────────────────────────────────────────────

describe('isCollapsed', () => {
  it('returns true when id is in array', () => {
    expect(isCollapsed(['p1', 'p2'], 'p1')).toBe(true);
  });

  it('returns false when id is not in array', () => {
    expect(isCollapsed(['p2'], 'p1')).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isCollapsed([], 'p1')).toBe(false);
  });

  it('returns false when collapsedIds is undefined', () => {
    expect(isCollapsed(undefined, 'p1')).toBe(false);
  });

  it('returns false when collapsedIds is null', () => {
    expect(isCollapsed(null, 'p1')).toBe(false);
  });

  it('returns a boolean (not a truthy/falsy value)', () => {
    expect(typeof isCollapsed(['p1'], 'p1')).toBe('boolean');
    expect(typeof isCollapsed(['p1'], 'p99')).toBe('boolean');
  });
});

// ── uniqueProjectIds ──────────────────────────────────────────────────────────

describe('uniqueProjectIds', () => {
  const tasks = [
    { id: '1', projectId: 'p1' },
    { id: '2', projectId: 'p2' },
    { id: '3', projectId: 'p1' }, // duplicate p1
    { id: '4', projectId: 'p3' },
    { id: '5', projectId: 'p2' }, // duplicate p2
  ];

  it('returns [] for empty tasks', () => {
    expect(uniqueProjectIds([], [])).toEqual([]);
  });

  it('deduplicates projectIds preserving first-seen order', () => {
    expect(uniqueProjectIds(tasks, [])).toEqual(['p1', 'p2', 'p3']);
  });

  it('excludes ids in hiddenProjects', () => {
    expect(uniqueProjectIds(tasks, ['p1'])).toEqual(['p2', 'p3']);
  });

  it('excludes multiple hidden ids', () => {
    expect(uniqueProjectIds(tasks, ['p1', 'p3'])).toEqual(['p2']);
  });

  it('returns [] when all projects are hidden', () => {
    expect(uniqueProjectIds(tasks, ['p1', 'p2', 'p3'])).toEqual([]);
  });

  it('treats undefined hiddenProjects as no exclusion', () => {
    expect(uniqueProjectIds(tasks, undefined)).toEqual(['p1', 'p2', 'p3']);
  });

  it('preserves first-seen order (not alphabetical)', () => {
    const ordered = [
      { id: 'a', projectId: 'zz' },
      { id: 'b', projectId: 'aa' },
      { id: 'c', projectId: 'mm' },
    ];
    expect(uniqueProjectIds(ordered, [])).toEqual(['zz', 'aa', 'mm']);
  });

  it('hiddenProjects with unknown id does not filter anything', () => {
    expect(uniqueProjectIds(tasks, ['pXYZ'])).toEqual(['p1', 'p2', 'p3']);
  });
});
