import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ThemeProvider } from '@/components/ThemeProvider';

const row = { id: 't1', task: '商品合作', project: '專案甲', owner: 'Amy', status: '進行中', end: '2099-01-01', startDate: '2098-01-01', sDone: 0, sTotal: 0 };
vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [], allT: [], allS: [], twp: [row], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, updateTask: () => {}, toggleSub: () => {}, addSub: () => {}, configOwners: [],
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({ default: d => ({ settings: d, updateSetting: () => {}, ready: true }) }));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

// iOS Safari 對 font-size < 16px 的輸入框會在 focus 時自動放大頁面。
// jsdom 算不出 cascade，所以測：樣式規則文字存在 + 抽屜在 .mobile-app 內。
describe('手機版輸入框字體 >= 16px（防 iOS 自動放大）', () => {
  it('globals.css 有 .mobile-app 的 input/select/textarea 16px !important 規則', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toMatch(/\.mobile-app\s+input\s*,\s*\.mobile-app\s+select\s*,\s*\.mobile-app\s+textarea\s*\{[^}]*font-size:\s*16px\s*!important/);
  });

  it('根容器有 mobile-app class，且任務抽屜在其內', () => {
    const { container } = render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
    const root = container.querySelector('.mobile-app');
    expect(root).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /商品合作/ }));
    expect(root.contains(screen.getByRole('dialog'))).toBe(true);
    expect(root.contains(screen.getByLabelText('狀態'))).toBe(true);
  });
});
