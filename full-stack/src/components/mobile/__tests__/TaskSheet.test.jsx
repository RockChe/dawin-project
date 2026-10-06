import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import TaskSheet from '@/components/mobile/TaskSheet';

const task = { id: 't1', task: '商品合作', status: '進行中', owner: 'Amy', watchers: null, startDate: '2026-06-01', endDate: '2026-09-16' };
const subs = [
  { id: 's1', taskId: 't1', name: '虎姑婆娃娃', owner: '', done: false, sortOrder: 0 },
  { id: 's2', taskId: 't1', name: '蜜友冰棒', owner: '', done: true, sortOrder: 1 },
];
const subsWithOwner = subs.map((s, i) => (i === 0 ? { ...s, owner: 'Rae' } : s));

const setup = (props = {}) => {
  const p = { task, subs, configOwners: ['Amy', 'Bob', 'Rae'], canWrite: true, onClose: vi.fn(), updateTask: vi.fn().mockResolvedValue(undefined), toggleSub: vi.fn(), ...props };
  render(<ThemeProvider><TaskSheet {...p} /></ThemeProvider>);
  return p;
};
const saveBtn = () => screen.getByRole('button', { name: '儲存' });

describe('TaskSheet', () => {
  it('role=dialog，aria-label 為任務名，顯示日期', () => {
    setup();
    expect(screen.getByRole('dialog', { name: '商品合作' })).toBeTruthy();
    expect(screen.getByText('2026.06.01 → 2026.09.16')).toBeTruthy();
  });

  it('沒變動時儲存為 disabled', () => {
    setup();
    expect(saveBtn().disabled).toBe(true);
  });

  it('改狀態後儲存只送 status，然後關閉', async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText('狀態'), { target: { value: '待辦' } });
    expect(saveBtn().disabled).toBe(false);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.updateTask).toHaveBeenCalledTimes(1);
    expect(p.updateTask).toHaveBeenCalledWith('t1', 'status', '待辦');
  });

  it('新增關注人 → 只送 watchers', async () => {
    const p = setup();
    const input = screen.getByPlaceholderText('新增關注人...');
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(saveBtn());
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.updateTask).toHaveBeenCalledTimes(1);
    expect(p.updateTask).toHaveBeenCalledWith('t1', 'watchers', 'Bob');
  });

  it('子任務沒有負責人 → 執行人可編（TagInput，已有人時顯示 tag）', () => {
    setup();
    expect(screen.getByText('Amy')).toBeTruthy();
    expect(screen.queryByText('由子任務自動帶出')).toBeNull();
  });

  it('子任務有負責人 → 執行人唯讀並提示「由子任務自動帶出」，儲存不送 owner', () => {
    setup({ subs: subsWithOwner, task: { ...task, owner: '—' } });
    expect(screen.queryByPlaceholderText('新增執行人...')).toBeNull();
    expect(screen.getByText('由子任務自動帶出')).toBeTruthy();
    expect(screen.getAllByText('Rae').length).toBeGreaterThan(0);
    expect(saveBtn().disabled).toBe(true);
  });

  it('viewer：唯讀，沒有儲存、狀態下拉、子任務勾選', () => {
    setup({ canWrite: false });
    expect(screen.queryByRole('button', { name: '儲存' })).toBeNull();
    expect(screen.queryByLabelText('狀態')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('進行中')).toBeTruthy();
    expect(screen.getByText('虎姑婆娃娃')).toBeTruthy();
  });

  it('點背景、點把手都呼叫 onClose', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });

  it('子任務勾選呼叫 toggleSub(id)', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: /虎姑婆娃娃/ }));
    expect(p.toggleSub).toHaveBeenCalledWith('s1');
  });
});
