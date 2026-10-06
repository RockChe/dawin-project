import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import OverviewScreen from '../OverviewScreen';

const T = (id, o = {}) => ({ id, task: `task-${id}`, project: 'P', owner: 'Amy', status: '進行中', end: '2026-10-10', ...o });
const twp = [T('a'), T('b', { status: '待辦' }), T('c', { status: '已完成' }), T('d', { status: '進行中', end: '2026-11-20' })];
const setup = (props = {}) => render(
  <ThemeProvider><OverviewScreen twp={twp} today="2026-10-06" upcomingDays={30} upcomingLimit={5} pcMap={{}} {...props} /></ThemeProvider>
);

describe('OverviewScreen', () => {
  it('標題顯示任務數；Upcoming 排除已完成與超出天數', () => {
    setup();
    expect(screen.getByText(/全部專案 · 4 個任務/)).toBeTruthy();
    expect(screen.getByText('task-a')).toBeTruthy();
    expect(screen.getByText('task-b')).toBeTruthy();
    expect(screen.queryByText('task-c')).toBeNull();
    expect(screen.queryByText('task-d')).toBeNull();
  });
  it('選「進行中」chip 後 Upcoming 只剩進行中；再點「全部」還原', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '進行中' }));
    expect(screen.getByRole('button', { name: '進行中' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('task-a')).toBeTruthy();
    expect(screen.queryByText('task-b')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByText('task-b')).toBeTruthy();
  });
  it('剩 ≤7 天與其餘用不同顏色 token', () => {
    setup({ twp: [T('near', { end: '2026-10-08' }), T('mid', { end: '2026-10-20' })] });
    expect(screen.getByText('2d').style.color).not.toBe(screen.getByText('14d').style.color);
  });
  it('Status 圖例列出各狀態數量；無 Upcoming 顯示空狀態', () => {
    setup({ twp: [T('x', { end: null })] });
    expect(screen.getByText(/未來 30 天沒有到期任務/)).toBeTruthy();
    expect(screen.getByText(/進行中 1/)).toBeTruthy();
  });
});
