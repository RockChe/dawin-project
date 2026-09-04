/**
 * TDD tests for GanttTimeline's task filter predicate.
 * RED → GREEN → REFACTOR
 *
 * Why this exists: the Projects detail gantt hardcoded fs="全部" and so never honoured
 * any status filter. Decision B (docs/design/dawin-dash-task-sortfilter-q-statesync.html)
 * makes it follow the project-level chip set, which is MULTI-select — so the predicate
 * has to accept arrays alongside the existing single-string form used by Overview/Timeline.
 *
 * Contract:
 *   · string form  — "全部" means no constraint (existing global filter bar)
 *   · array form   — [] means no constraint, otherwise OR within the field
 *   · owner        — comma-separated multi-owner string, matched by "包含", never substring
 *   · a task with no start date is always excluded (gantt needs a date to draw)
 */

import { describe, it, expect } from 'vitest';
import { matchesGanttFilters } from '@/components/dashboard/GanttTimeline';

const t = (over = {}) => ({
  project: 'TTXC', status: '進行中', priority: '中',
  owner: 'Felien 車', start: '2026-06-01', end: '2026-06-30', ...over,
});

describe('matchesGanttFilters', () => {
  it('excludes a task with no start date', () => {
    expect(matchesGanttFilters(t({ start: null }), {})).toBe(false);
  });

  it('passes everything when no filter is given', () => {
    expect(matchesGanttFilters(t(), {})).toBe(true);
  });

  // ── project (existing behaviour, must not regress) ──
  it('keeps the string form for project: 全部 means no constraint', () => {
    expect(matchesGanttFilters(t(), { fp: '全部' })).toBe(true);
  });

  it('keeps the string form for project: a name constrains', () => {
    expect(matchesGanttFilters(t(), { fp: 'Other' })).toBe(false);
  });

  it('keeps the Set form for project', () => {
    expect(matchesGanttFilters(t(), { fp: new Set(['TTXC']) })).toBe(true);
    expect(matchesGanttFilters(t(), { fp: new Set(['Other']) })).toBe(false);
  });

  it('treats an empty Set as no constraint', () => {
    expect(matchesGanttFilters(t(), { fp: new Set() })).toBe(true);
  });

  // ── status: string form (global bar) ──
  it('keeps the string form for status', () => {
    expect(matchesGanttFilters(t(), { fs: '進行中' })).toBe(true);
    expect(matchesGanttFilters(t(), { fs: '待辦' })).toBe(false);
    expect(matchesGanttFilters(t(), { fs: '全部' })).toBe(true);
  });

  // ── status: array form (project chips) ──
  it('accepts an array of statuses and ORs them', () => {
    expect(matchesGanttFilters(t(), { fs: ['進行中', '待辦'] })).toBe(true);
    expect(matchesGanttFilters(t({ status: '已完成' }), { fs: ['進行中', '待辦'] })).toBe(false);
  });

  it('treats an empty status array as no constraint', () => {
    expect(matchesGanttFilters(t(), { fs: [] })).toBe(true);
  });

  // ── priority ──
  it('accepts both forms for priority', () => {
    expect(matchesGanttFilters(t(), { fpr: '中' })).toBe(true);
    expect(matchesGanttFilters(t(), { fpr: '高' })).toBe(false);
    expect(matchesGanttFilters(t(), { fpr: ['高', '中'] })).toBe(true);
    expect(matchesGanttFilters(t(), { fpr: [] })).toBe(true);
  });

  // ── owner (new) ──
  it('matches an owner inside a comma-separated multi-owner string', () => {
    expect(matchesGanttFilters(t({ owner: 'Karen, Felien 車, Rae' }), { fow: ['Karen'] })).toBe(true);
  });

  it('does not substring-match a longer owner name', () => {
    expect(matchesGanttFilters(t({ owner: 'Raewyn' }), { fow: ['Rae'] })).toBe(false);
  });

  it('treats an empty owner array as no constraint', () => {
    expect(matchesGanttFilters(t(), { fow: [] })).toBe(true);
  });

  // ── combination ──
  it('ANDs across fields', () => {
    const task = t({ status: '進行中', priority: '高', owner: 'Rae' });
    expect(matchesGanttFilters(task, { fs: ['進行中'], fpr: ['高'], fow: ['Rae'] })).toBe(true);
    expect(matchesGanttFilters(task, { fs: ['進行中'], fpr: ['低'], fow: ['Rae'] })).toBe(false);
  });
});
