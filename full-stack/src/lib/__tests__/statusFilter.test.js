import { describe, it, expect } from 'vitest';
import { toggleStatus, matchesStatusFilter } from '@/lib/statusFilter';

describe('toggleStatus (selection = array, [] = no filter)', () => {
  it('adds a status that is not selected', () => {
    expect(toggleStatus([], '進行中')).toEqual(['進行中']);
    expect(toggleStatus(['進行中'], '待辦')).toEqual(['進行中', '待辦']);
  });
  it('removes a status that is already selected', () => {
    expect(toggleStatus(['進行中', '待辦'], '進行中')).toEqual(['待辦']);
    expect(toggleStatus(['進行中'], '進行中')).toEqual([]);
  });
  it('「全部」clears the selection', () => {
    expect(toggleStatus(['進行中', '待辦'], '全部')).toEqual([]);
  });
  it('does not mutate its input', () => {
    const sel = ['進行中'];
    toggleStatus(sel, '待辦');
    expect(sel).toEqual(['進行中']);
  });
});

describe('matchesStatusFilter', () => {
  it('empty / missing selection matches everything', () => {
    expect(matchesStatusFilter('已完成', [])).toBe(true);
    expect(matchesStatusFilter('已完成', undefined)).toBe(true);
  });
  it('matches the union of selected statuses', () => {
    expect(matchesStatusFilter('進行中', ['進行中', '待辦'])).toBe(true);
    expect(matchesStatusFilter('待辦', ['進行中', '待辦'])).toBe(true);
    expect(matchesStatusFilter('已完成', ['進行中', '待辦'])).toBe(false);
  });
});
