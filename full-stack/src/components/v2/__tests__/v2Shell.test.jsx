import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import V2Root from '@/components/v2/V2Root';
import Shell from '@/components/v2/Shell';
import { StaticSettingsProvider } from '@/components/v2/SettingsContext';
import { fixtureShellProps } from '@/components/v2/fixtures';

// 任何 server action 被呼叫都算違規（預覽／殼層不得有寫入副作用）
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

function Probe() { const { themeKey } = useTheme(); return <i data-testid="tk">{themeKey}</i>; }
const setup = (settings = {}) => render(
  <ThemeProvider>
    <Probe />
    <V2Root role="admin">
      <StaticSettingsProvider settings={settings}><Shell {...fixtureShellProps()} /></StaticSettingsProvider>
    </V2Root>
  </ThemeProvider>
);
const root = (c) => c.querySelector('.v2');

beforeEach(() => { localStorage.clear(); boom.mockClear(); });

describe('v2 Shell', () => {
  it('頁首：品牌、搜尋、Overall、日期與筆數', () => {
    setup();
    expect(screen.getByText('大雲文創專案管理系統')).toBeTruthy();
    expect(screen.getByRole('searchbox')).toBeTruthy();
    expect(screen.getByText('Overall')).toBeTruthy();
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('2026/10/07 · 33 tasks')).toBeTruthy();
  });

  it('分頁列 6 個，預設 Overview；點擊切換分頁與麵包屑與佔位內容', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: '主要分頁' });
    const labels = within(nav).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Overview', 'My Tasks', 'Projects', 'Timeline', 'Data', 'Settings']);
    expect(within(nav).getByText('Overview').getAttribute('aria-current')).toBe('page');
    const crumbs = screen.getByRole('navigation', { name: '麵包屑' });
    expect(crumbs.textContent).toBe('首頁');

    fireEvent.click(within(nav).getByText('Data'));
    expect(within(nav).getByText('Data').getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByText('Overview').getAttribute('aria-current')).toBeNull();
    expect(crumbs.textContent).toBe('首頁›Data');
    expect(screen.queryByTestId('v2-placeholder')).toBeNull(); // Data 已是真畫面（Task 9），六個分頁都不再有佔位

    fireEvent.click(within(crumbs).getByText('首頁'));
    expect(within(nav).getByText('Overview').getAttribute('aria-current')).toBe('page');
  });

  it('ThemeToggle：同步 ThemeProvider（warm↔dimmed）並映射 .v2[data-theme]（light↔dark）', () => {
    const { container } = setup();
    expect(root(container).getAttribute('data-theme')).toBe('light');
    expect(screen.getByTestId('tk').textContent).toBe('warm');
    const btn = screen.getByRole('button', { name: /切換主題/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(btn);
    expect(screen.getByTestId('tk').textContent).toBe('dimmed');
    expect(root(container).getAttribute('data-theme')).toBe('dark');
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(btn);
    expect(screen.getByTestId('tk').textContent).toBe('warm');
    expect(root(container).getAttribute('data-theme')).toBe('light');
  });

  it('固定桌機版：min-width 1280、不套用 zoom', () => {
    const { container } = setup();
    expect(root(container).style.minWidth).toBe('1280px');
    expect(root(container).style.zoom).toBeFalsy();
  });

  it('雲朵開（預設）頁首畫白雲；cloudLevel=off 退回「P」Logo', () => {
    const on = setup();
    expect(on.container.querySelector('.brand svg')).not.toBeNull();
    on.unmount();
    const off = setup({ cloudLevel: 'off' });
    expect(off.container.querySelector('.brand svg')).toBeNull();
    expect(off.container.querySelector('.brand .logo-fb').textContent).toBe('P');
  });

  it('殼層操作不呼叫任何 server action', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /切換主題/ }));
    fireEvent.click(screen.getByText('Timeline'));
    expect(boom).not.toHaveBeenCalled();
  });

  it('預設 Overview 內容；播報列「逾期」跳到 My Tasks 並聚焦逾期分組，手動切回再進不重複聚焦', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = setup();
    expect(screen.getByRole('region', { name: 'Upcoming Deadlines' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '逾期 3 件，前往 My Tasks 對應分組' }));
    const nav = screen.getByRole('navigation', { name: '主要分頁' });
    expect(within(nav).getByText('My Tasks').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('navigation', { name: '麵包屑' }).textContent).toBe('首頁›My Tasks');
    expect(document.activeElement).toBe(container.querySelector('.mgrp[data-g="overdue"]'));
    fireEvent.click(within(nav).getByText('Overview'));
    fireEvent.click(within(nav).getByText('My Tasks'));
    expect(document.activeElement).toBe(document.body);
  });

  it('onOpenTask 由 Shell 傳到 Overview 與 My Tasks（預設 no-op 不報錯）', () => {
    const onOpenTask = vi.fn();
    render(
      <ThemeProvider><V2Root role="admin"><StaticSettingsProvider settings={{}}><Shell {...fixtureShellProps()} onOpenTask={onOpenTask} /></StaticSettingsProvider></V2Root></ThemeProvider>
    );
    fireEvent.click(screen.getByText('商品合作'));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: '主要分頁' })).getByText('My Tasks'));
    fireEvent.click(screen.getByText('文化部結案報告'));
    expect(onOpenTask).toHaveBeenLastCalledWith(expect.objectContaining({ id: 't9' }));
  });
});

describe('v2 Shell：Timeline 分頁', () => {
  it('切到 Timeline 顯示甘特（不是佔位）；點「開啟專案」開專案詳情，分頁與麵包屑停在 Timeline（來源分頁）', () => {
    const { container } = setup();
    const nav = screen.getByRole('navigation', { name: '主要分頁' });
    fireEvent.click(within(nav).getByText('Timeline'));
    expect(screen.queryByTestId('v2-placeholder')).toBeNull();
    expect(screen.getByRole('toolbar', { name: 'Timeline 工具列' })).toBeTruthy();
    expect(container.querySelectorAll('.tlx .row.pj')).toHaveLength(10);
    fireEvent.click(container.querySelectorAll('.tlx .row.pj')[1]);
    fireEvent.click(screen.getByRole('button', { name: '開啟專案 ›' }));
    expect(within(nav).getByText('Timeline').getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('.dhead h2').textContent).toBe('科教館公益展廳');
    expect(screen.getByRole('navigation', { name: '麵包屑' }).textContent).toBe('首頁›Timeline›科教館公益展廳');
  });
});
