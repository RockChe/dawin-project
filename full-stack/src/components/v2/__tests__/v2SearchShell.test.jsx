import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import V2Root from '@/components/v2/V2Root';
import Shell from '@/components/v2/Shell';
import { StaticSettingsProvider } from '@/components/v2/SettingsContext';
import { fixtureShellProps } from '@/components/v2/fixtures';

// 頁首搜尋：Shell 持有字串（300ms debounce），過濾 Overview 即將到期／My Tasks／專案詳情任務清單／Timeline 專案。
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const setup = (props = {}) => render(
  <ThemeProvider><V2Root role="admin"><StaticSettingsProvider settings={{}}><Shell {...fixtureShellProps()} {...props} /></StaticSettingsProvider></V2Root></ThemeProvider>
);
const box = () => screen.getByRole('searchbox');
const type = (v) => { fireEvent.change(box(), { target: { value: v } }); };
const settle = () => act(() => { vi.advanceTimersByTime(300); });
const go = (t) => fireEvent.click(within(screen.getByRole('navigation', { name: '主要分頁' })).getByText(t));
const upcoming = (c) => [...c.querySelectorAll('.lrow.lbtn .n')].map((n) => n.textContent);
const mine = (c) => [...c.querySelectorAll('.trw .n')].map((n) => n.firstChild.textContent);

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); boom.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('頁首搜尋', () => {
  it('輸入立即顯示在框裡，300ms 後才套用過濾（debounce）', () => {
    const { container } = setup();
    const before = upcoming(container);
    expect(before.length).toBeGreaterThan(1);
    type('商品');
    expect(box().value).toBe('商品');
    expect(upcoming(container)).toEqual(before);
    settle();
    expect(upcoming(container)).toEqual(['商品合作']);
  });

  it('有字才出現清除鈕；按下立即清空並還原（不等 debounce）', () => {
    const { container } = setup();
    expect(screen.queryByRole('button', { name: '清除搜尋' })).toBeNull();
    const before = upcoming(container);
    type('商品'); settle();
    fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }));
    expect(box().value).toBe('');
    expect(upcoming(container)).toEqual(before);
    expect(screen.queryByRole('button', { name: '清除搜尋' })).toBeNull();
  });

  it('規則沿用舊版：任務名／專案名／負責人／備註，不分大小寫', () => {
    const { container } = setup();
    type('yaya'); settle();
    expect(upcoming(container)).toEqual(["Yaya's Band 芽芽樂團"]);
    type('衛武'); settle(); // 專案名「27年衛武營」
    expect(upcoming(container)).toEqual(['衛武營場地勘查']);
    type('FAQ'); settle(); // 備註
    go('My Tasks');
    expect(mine(container)).toEqual(['票務展務相關']);
  });

  it('Overview 即將到期：搜尋沒有結果 → 空狀態；播報列與專案時程不受影響', () => {
    const { container } = setup();
    type('不存在的字串'); settle();
    expect(upcoming(container)).toEqual([]);
    expect(screen.getByText(/沒有符合篩選的到期項目/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '逾期 3 件，前往 My Tasks 對應分組' })).toBeTruthy();
  });

  it('My Tasks：只過濾清單，KPI 仍是全部；沒有結果顯示空狀態與「清除篩選」，按了連搜尋一起清掉', () => {
    const { container } = setup();
    go('My Tasks');
    const all = mine(container);
    expect(all.length).toBeGreaterThan(3);
    type('文化部'); settle();
    expect(mine(container)).toEqual(['文化部結案報告']);
    expect(container.querySelector('.kpi-n').textContent).toBe('3');
    type('zzz'); settle();
    expect(screen.getByText('沒有符合篩選的任務')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
    expect(box().value).toBe('');
    expect(mine(container)).toEqual(all);
  });

  it('專案詳情任務清單：只過濾清單（側欄統計仍是整個專案），計數顯示 n / 全部', () => {
    const { container } = setup({ initialTab: 'projects' });
    fireEvent.click(container.querySelector('.pgrid .pname'));
    const names = () => [...container.querySelectorAll('.trow .tnm')].map((n) => n.textContent);
    expect(names()).toHaveLength(8);
    type('商品'); settle();
    expect(names()).toEqual(['商品合作']);
    expect(container.querySelector('.tcard .h b').textContent).toContain('1 / 8');
    expect(container.querySelector('.dhead .meta').textContent).toBe('8 tasks · 15 subtasks · 8 done');
  });

  it('專案詳情沒有符合 → 空狀態「清除篩選」連搜尋一起清', () => {
    const { container } = setup({ initialTab: 'projects' });
    fireEvent.click(container.querySelector('.pgrid .pname'));
    type('zzz'); settle();
    expect(container.querySelectorAll('.trow')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
    expect(box().value).toBe('');
    expect(container.querySelectorAll('.trow')).toHaveLength(8);
  });

  it('Timeline：只留有符合任務的專案（配色與其他資料不變）', () => {
    const { container } = setup({ initialTab: 'timeline' });
    expect(container.querySelectorAll('.tlx .row.pj')).toHaveLength(10);
    type('yaya'); settle();
    const rows = container.querySelectorAll('.tlx .row.pj');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('虎姑婆和他的朋友');
    type('zzz'); settle();
    expect(container.querySelectorAll('.tlx .row.pj')).toHaveLength(0);
    expect(screen.getByText('沒有可顯示的專案')).toBeTruthy();
  });

  it('搜尋字串跨分頁保留；搜尋不呼叫 server action', () => {
    const { container } = setup();
    type('商品'); settle();
    go('My Tasks'); go('Overview');
    expect(box().value).toBe('商品');
    expect(upcoming(container)).toEqual(['商品合作']);
    expect(boom).not.toHaveBeenCalled();
  });
});
