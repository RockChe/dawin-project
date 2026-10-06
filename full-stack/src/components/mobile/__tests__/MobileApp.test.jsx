import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

let role = 'admin';
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: [], allS: [], twp: [], loading: false, userRole: role,
    toast: null, showToast: () => {}, updateTask: () => {}, toggleSub: () => {}, addSub: () => {},
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({
  default: (d) => ({ settings: d, updateSetting: () => {}, ready: true }),
}));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

const setup = (r = 'admin') => {
  role = r;
  return render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
};
const btn = name => screen.getByRole('button', { name });

describe('MobileApp 外殼', () => {
  it('預設顯示「我的任務」分頁', () => {
    setup();
    expect(btn('我的任務').getAttribute('aria-current')).toBe('page');
    expect(btn('總覽').getAttribute('aria-current')).toBeNull();
  });

  it('點「總覽」→ aria-current 換到總覽', () => {
    setup();
    fireEvent.click(btn('總覽'));
    expect(btn('總覽').getAttribute('aria-current')).toBe('page');
    expect(btn('我的任務').getAttribute('aria-current')).toBeNull();
  });

  it('五個分頁按鈕齊全', () => {
    setup();
    for (const n of ['我的任務', '總覽', '專案', '時程', '更多']) expect(btn(n)).toBeTruthy();
  });

  it('「更多」含切到桌機版連結、登出按鈕、桌機提示，沒有平板入口', () => {
    setup();
    fireEvent.click(btn('更多'));
    expect(screen.getByRole('link', { name: /切到桌機版/ }).getAttribute('href')).toBe('/api/device?to=desktop');
    expect(screen.getByRole('button', { name: /登出/ })).toBeTruthy();
    expect(screen.getByText(/資料表、設定、帳號管理請使用桌機版/)).toBeTruthy();
    expect(screen.queryByText(/平板/)).toBeNull();
  });

  it('viewer 角色渲染不出錯', () => {
    setup('viewer');
    expect(btn('我的任務').getAttribute('aria-current')).toBe('page');
  });
});
