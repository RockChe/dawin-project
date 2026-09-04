/**
 * TDD tests for the Projects-detail Tasks list sort/filter helpers.
 * RED → GREEN → REFACTOR
 *
 * Functions under test (exported from ProjectsTab.jsx):
 *   filterProjectTasks — status / owner / priority, empty array = no constraint.
 *   sortProjectTasks   — single field, stable, missing values always last.
 *
 * Contract (架構文件 docs/design/dawin-dash.html §4 fs-t2):
 *   · 欄位內 OR、欄位間 AND
 *   · owner 是逗號分隔多人字串 → 比對「包含這個人」，不是子字串比對
 *   · 排序穩定：同鍵維持輸入順序（輸入本身是開始日排序的 pt）
 *   · 無日期一律排最後，不隨 dir 翻面
 */

import { describe, it, expect } from 'vitest';
import { filterProjectTasks, sortProjectTasks } from '@/components/dashboard/tabs/ProjectsTab';

const t = (id, over = {}) => ({
  id,
  task: `task-${id}`,
  status: '進行中',
  priority: '中',
  owner: 'Felien 車',
  start: '2026-06-01',
  end: '2026-06-30',
  ...over,
});

const ids = arr => arr.map(x => x.id);

describe('filterProjectTasks', () => {
  const tasks = [
    t('a', { status: '已完成', priority: '低', owner: 'Felien 車' }),
    t('b', { status: '進行中', priority: '高', owner: 'Karen, Felien 車, Rae' }),
    t('c', { status: '待辦', priority: '高', owner: 'Rae' }),
    t('d', { status: '進行中', priority: '中', owner: 'Raewyn' }),
  ];

  it('returns every task when no filter is set', () => {
    expect(ids(filterProjectTasks(tasks, {}))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats an empty array as no constraint on that field', () => {
    expect(ids(filterProjectTasks(tasks, { status: [], owner: [], priority: [] })))
      .toEqual(['a', 'b', 'c', 'd']);
  });

  it('ORs multiple values within the status field', () => {
    expect(ids(filterProjectTasks(tasks, { status: ['已完成', '待辦'] }))).toEqual(['a', 'c']);
  });

  it('ANDs across different fields', () => {
    expect(ids(filterProjectTasks(tasks, { status: ['進行中'], priority: ['高'] }))).toEqual(['b']);
  });

  it('matches an owner inside a comma-separated multi-owner string', () => {
    expect(ids(filterProjectTasks(tasks, { owner: ['Karen'] }))).toEqual(['b']);
  });

  it('does not substring-match a longer owner name', () => {
    // 'Rae' must not match the task owned by 'Raewyn'
    expect(ids(filterProjectTasks(tasks, { owner: ['Rae'] }))).toEqual(['b', 'c']);
  });

  it('ORs multiple owners', () => {
    expect(ids(filterProjectTasks(tasks, { owner: ['Karen', 'Raewyn'] }))).toEqual(['b', 'd']);
  });

  it('filters by priority', () => {
    expect(ids(filterProjectTasks(tasks, { priority: ['高'] }))).toEqual(['b', 'c']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterProjectTasks(tasks, { status: ['暫緩'] })).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...tasks];
    filterProjectTasks(input, { status: ['待辦'] });
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sortProjectTasks', () => {
  it('orders by the STATUSES sequence, not alphabetically', () => {
    const tasks = [t('a', { status: '待辦' }), t('b', { status: '已完成' }), t('c', { status: '進行中' })];
    expect(ids(sortProjectTasks(tasks, { field: 'status', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
  });

  it('is stable: equal keys keep their input order', () => {
    const tasks = [t('a'), t('b'), t('c')]; // all 進行中
    expect(ids(sortProjectTasks(tasks, { field: 'status', dir: 'asc' }))).toEqual(['a', 'b', 'c']);
  });

  it('sorts by end date ascending', () => {
    const tasks = [t('a', { end: '2026-09-15' }), t('b', { end: '2026-06-30' })];
    expect(ids(sortProjectTasks(tasks, { field: 'end', dir: 'asc' }))).toEqual(['b', 'a']);
  });

  it('sorts by start date descending', () => {
    const tasks = [t('a', { start: '2026-05-19' }), t('b', { start: '2026-09-01' })];
    expect(ids(sortProjectTasks(tasks, { field: 'start', dir: 'desc' }))).toEqual(['b', 'a']);
  });

  it('puts tasks without a date last when ascending', () => {
    const tasks = [t('a', { end: null }), t('b', { end: '2026-06-30' })];
    expect(ids(sortProjectTasks(tasks, { field: 'end', dir: 'asc' }))).toEqual(['b', 'a']);
  });

  it('still puts tasks without a date last when descending', () => {
    const tasks = [t('a', { end: null }), t('b', { end: '2026-06-30' })];
    expect(ids(sortProjectTasks(tasks, { field: 'end', dir: 'desc' }))).toEqual(['b', 'a']);
  });

  it('orders priority 高 → 中 → 低', () => {
    const tasks = [t('a', { priority: '低' }), t('b', { priority: '高' }), t('c', { priority: '中' })];
    expect(ids(sortProjectTasks(tasks, { field: 'priority', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
  });

  it('puts tasks without an owner last', () => {
    const tasks = [t('a', { owner: '' }), t('b', { owner: 'Karen' })];
    expect(ids(sortProjectTasks(tasks, { field: 'owner', dir: 'asc' }))).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const tasks = [t('a', { status: '待辦' }), t('b', { status: '已完成' })];
    sortProjectTasks(tasks, { field: 'status', dir: 'asc' });
    expect(ids(tasks)).toEqual(['a', 'b']);
  });
});
