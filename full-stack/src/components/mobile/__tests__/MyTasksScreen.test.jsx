import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import MyTasksScreen from '@/components/mobile/MyTasksScreen';

const today = '2026-10-06';
const mk = (id, task, o = {}) => ({ id, task, project: '專案甲', owner: 'Amy', status: '進行中', end: '2026-12-31', sDone: 0, sTotal: 0, ...o });
const twp = [
  mk('a', '逾期任務', { end: '2026-10-01' }),
  mk('b', '近期任務', { end: '2026-10-09' }),
  mk('c', '之後任務', { end: '2026-10-26' }),
  mk('d', '已完成任務', { end: '2026-10-01', status: '已完成' }),
  mk('e', '別人任務', { owner: 'Bob', end: '2026-10-01' }),
];

const setup = (props = {}) => {
  const openTask = vi.fn();
  const utils = render(
    <ThemeProvider><MyTasksScreen twp={twp} userName="Amy" today={today} pcMap={{}} openTask={openTask} {...props} /></ThemeProvider>,
  );
  return { openTask, ...utils };
};
const group = name => screen.getByRole('heading', { name: new RegExp(name) }).parentElement;

describe('MyTasksScreen', () => {
  it('KPI 三格：逾期 1／7 天內 1／進行中 3', () => {
    setup();
    const kpi = screen.getByTestId('kpi');
    expect(within(kpi).getByText('逾期').previousSibling.textContent).toBe('1');
    expect(within(kpi).getByText('7 天內').previousSibling.textContent).toBe('1');
    expect(within(kpi).getByText('進行中').previousSibling.textContent).toBe('3');
  });

  it('三組各一張卡片，已完成與別人的任務不出現', () => {
    setup();
    expect(within(group('逾期')).getAllByRole('button')).toHaveLength(1);
    expect(within(group('7 天內')).getAllByRole('button')).toHaveLength(1);
    expect(within(group('之後')).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('已完成任務')).toBeNull();
    expect(screen.queryByText('別人任務')).toBeNull();
  });

  it('剩餘天數：逾期 -5d、7 天內 3d', () => {
    setup();
    expect(screen.getByText('-5d')).toBeTruthy();
    expect(screen.getByText('3d')).toBeTruthy();
  });

  it('點卡片呼叫 openTask(id)', () => {
    const { openTask } = setup();
    fireEvent.click(screen.getByRole('button', { name: /近期任務/ }));
    expect(openTask).toHaveBeenCalledWith('b');
  });

  it('沒有任務 → 空狀態', () => {
    setup({ twp: [] });
    expect(screen.getByText('沒有指派給你的任務 🎉')).toBeTruthy();
  });

  it('關注人（非執行人）顯示「我關注」、子任務執行人顯示「我執行」＋子任務進度', () => {
    setup({
      twp: [
        mk('w', '關注任務', { owner: 'Bob,Amy', watchers: 'Amy', subOwner: 'Bob' }),
        mk('x', '執行任務', { owner: 'Amy', subOwner: 'Amy', sDone: 1, sTotal: 2 }),
      ],
    });
    expect(within(screen.getByRole('button', { name: /關注任務/ })).getByText('我關注')).toBeTruthy();
    const x = screen.getByRole('button', { name: /執行任務/ });
    expect(within(x).getByText('我執行')).toBeTruthy();
    expect(within(x).getByText(/子任務 1\/2/)).toBeTruthy();
  });
});
