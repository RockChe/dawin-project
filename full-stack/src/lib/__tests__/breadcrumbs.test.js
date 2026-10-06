import { describe, it, expect, vi } from 'vitest';
import { tabCrumbs, detailCrumbs, HOME_LABEL } from '../breadcrumbs';

describe('tabCrumbs (desktop)', () => {
  it('Overview 只有「首頁」（當前頁，不可點）', () => {
    expect(tabCrumbs('overview', { onHome: vi.fn() })).toEqual([{ label: HOME_LABEL }]);
  });
  it.each([
    ['mytasks', 'My Tasks'], ['projects', 'Projects'], ['timeline', 'Timeline'], ['table', 'Data'], ['settings', 'Settings'],
  ])('%s → 首頁 › %s，首頁可點', (key, label) => {
    const onHome = vi.fn();
    const items = tabCrumbs(key, { onHome });
    expect(items.map(i => i.label)).toEqual([HOME_LABEL, label]);
    items[0].onClick();
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(items[1].onClick).toBeUndefined();
  });
  it('未知分頁退回只有「首頁」', () => {
    expect(tabCrumbs('nope', {})).toEqual([{ label: HOME_LABEL }]);
  });
});

describe('tabCrumbs (mobile)', () => {
  it('我的任務是手機首頁 → 只有「首頁」', () => {
    expect(tabCrumbs('mytasks', { mobile: true })).toEqual([{ label: HOME_LABEL }]);
  });
  it.each([['overview', '總覽'], ['projects', '專案'], ['timeline', '時程'], ['more', '更多']])('%s → 首頁 › %s', (key, label) => {
    const onHome = vi.fn();
    const items = tabCrumbs(key, { mobile: true, onHome });
    expect(items.map(i => i.label)).toEqual([HOME_LABEL, label]);
    items[0].onClick();
    expect(onHome).toHaveBeenCalled();
  });
});

describe('detailCrumbs', () => {
  it('桌機：首頁 › Projects › 專案名；Projects 可點（onTab）', () => {
    const onHome = vi.fn(), onTab = vi.fn();
    const items = detailCrumbs('projects', 'Alpha', { onHome, onTab });
    expect(items.map(i => i.label)).toEqual([HOME_LABEL, 'Projects', 'Alpha']);
    items[1].onClick();
    expect(onTab).toHaveBeenCalled();
    expect(items[2].onClick).toBeUndefined();
  });
  it('手機：首頁 › 專案 › 專案名', () => {
    expect(detailCrumbs('projects', 'Alpha', { mobile: true }).map(i => i.label)).toEqual([HOME_LABEL, '專案', 'Alpha']);
  });
  it('href 版（獨立路由頁）：首頁與分頁都是連結', () => {
    const items = detailCrumbs('projects', 'Alpha', { homeHref: '/dashboard', tabHref: '/dashboard' });
    expect(items[0].href).toBe('/dashboard');
    expect(items[1].href).toBe('/dashboard');
    expect(items[2].href).toBeUndefined();
  });
});
