import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import MyTasksTab from '@/components/dashboard/tabs/MyTasksTab';

const TODAY = '2026-10-06';
const task = (id, owner, end, status = '進行中', extra = {}) =>
  ({ id, task: `task-${id}`, project: 'Proj A', owner, end, status, progress: 40, ...extra });

function renderTab(props) {
  return render(
    <ThemeProvider>
      <PermissionProvider role="viewer">
        <MyTasksTab twp={[]} userName="Amy" isMobile={false} pcMap={{ 'Proj A': '#123456' }}
          setModalTask={() => {}} today={TODAY} {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

describe('MyTasksTab', () => {
  it('empty state when nothing is assigned to me', () => {
    renderTab({ twp: [task('1', 'Bob', '2026-10-07')] });
    expect(screen.getByText(/沒有指派給你的任務/)).toBeTruthy();
  });

  it('populated: KPI cards, group headers, only my rows; click opens modal', () => {
    const setModalTask = vi.fn();
    const mine = task('1', 'Bob, Amy', '2026-10-01');
    renderTab({
      setModalTask,
      twp: [mine, task('2', 'Amy', '2026-10-08'), task('3', 'Amy', '2026-12-01'),
            task('4', 'Bob', '2026-10-01'), task('5', 'Amy', '2026-10-02', '已完成')],
    });
    for (const l of ['已逾期', '7 天內到期', '進行中', '本月已完成']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    for (const h of ['逾期', '7 天內', '之後']) expect(screen.getAllByText(h).length).toBeGreaterThan(0);
    expect(screen.getByText('task-1')).toBeTruthy();
    expect(screen.getByText('task-2')).toBeTruthy();
    expect(screen.queryByText('task-4')).toBeNull();
    expect(screen.queryByText('task-5')).toBeNull();
    expect(screen.getByText('-5d')).toBeTruthy();
    fireEvent.click(screen.getByText('task-1'));
    expect(setModalTask).toHaveBeenCalledWith(mine);
  });
});
