import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import TimelineScreen from '../TimelineScreen';

const projects = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }, { id: 'p3', name: 'NoDates' }];
const T = (id, projectId, start, end, progress = 50) => ({ id, projectId, task: id, start, end, progress });
const twp = [T('a', 'p1', '2026-04-01', '2026-09-30'), T('b', 'p2', '2026-06-01', '2027-08-31'), T('c', 'p3', null, null)];

function setup(props = {}) {
  const onSelectProject = vi.fn();
  render(<ThemeProvider><TimelineScreen projects={projects} twp={twp} today="2026-10-06" pcMap={{ Alpha: '#3b8fd0' }} onSelectProject={onSelectProject} {...props} /></ThemeProvider>);
  return { onSelectProject };
}

describe('TimelineScreen', () => {
  it('每個有日期的專案一列，無日期的略過；標題顯示範圍與今天', () => {
    setup();
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Beta/ })).toBeTruthy();
    expect(screen.queryByText('NoDates')).toBeNull();
    expect(screen.getByText(/2026\/04 — 2027\/08 · 今天 10\/06/)).toBeTruthy();
  });
  it('點某列呼叫 onSelectProject(專案 id)', () => {
    const { onSelectProject } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onSelectProject).toHaveBeenCalledWith('p2');
  });
  it('頁尾提示完整甘特圖請用平板或桌機；沒有資料顯示空狀態', () => {
    setup();
    expect(screen.getByText(/完整甘特圖請用平板或桌機/)).toBeTruthy();
  });
  it('沒有任何日期 → 空狀態', () => {
    setup({ twp: [T('c', 'p3', null, null)] });
    expect(screen.getByText(/沒有可顯示的時程/)).toBeTruthy();
  });
});
