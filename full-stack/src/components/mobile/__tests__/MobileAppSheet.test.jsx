import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

let role = 'admin';
const row = { id: 't1', task: '商品合作', project: '專案甲', owner: 'Amy', status: '進行中', end: '2099-01-01', startDate: '2098-01-01', sDone: 0, sTotal: 0 };
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: [], allS: [{ id: 's1', taskId: 't1', name: '子一', owner: '', done: false }], twp: [row], loading: false, userRole: role,
    toast: null, showToast: () => {}, updateTask: () => {}, toggleSub: () => {}, addSub: () => {}, configOwners: [],
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({ default: d => ({ settings: d, updateSetting: () => {}, ready: true }) }));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

const setup = (r = 'admin') => {
  role = r;
  render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
};

describe('MobileApp 任務抽屜', () => {
  it('點任務卡開抽屜（含子任務），點背景關閉', () => {
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /商品合作/ }));
    expect(screen.getByRole('dialog', { name: '商品合作' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '子一' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('viewer 開抽屜是唯讀', () => {
    setup('viewer');
    fireEvent.click(screen.getByRole('button', { name: /商品合作/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '儲存' })).toBeNull();
  });
});
