/** 手機版麵包屑：每個分頁恰好一列；首頁 = 我的任務；Projects 由 ProjectsScreen 自己畫。 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

vi.mock('@/hooks/useTaskManager', () => ({
  default: () => ({
    projects: [{ id: 'p1', name: 'Alpha', sortOrder: 1 }], allT: [], allS: [], twp: [], loading: false, userRole: 'admin',
    toast: null, showToast: () => {}, updateTask: () => {}, toggleSub: () => {}, addSub: () => {}, configOwners: [],
  }),
}));
vi.mock('@/hooks/useUserSettings', () => ({ default: (d) => ({ settings: d, updateSetting: () => {}, ready: true }) }));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

import MobileApp from '@/components/mobile/MobileApp';

const setup = () => render(<ThemeProvider><MobileApp initialData={{ session: { name: 'Amy' }, settings: {} }} /></ThemeProvider>);
const tabBar = name => screen.getAllByRole('button', { name }).find(b => b.hasAttribute('aria-current') || b.closest('nav:not([aria-label])'));
const crumbs = () => [...document.querySelectorAll('nav[aria-label="breadcrumb"] li')].map(li => li.textContent.replace('›', ''));

describe('MobileApp 麵包屑', () => {
  it('首頁（我的任務）只有「首頁」', () => {
    setup();
    expect(document.querySelectorAll('nav[aria-label="breadcrumb"]').length).toBe(1);
    expect(crumbs()).toEqual(['首頁']);
  });
  it.each([['總覽', '總覽'], ['專案', '專案'], ['時程', '時程'], ['更多', '更多']])('切到 %s：恰好一列「首頁 › %s」', (tab, label) => {
    setup();
    fireEvent.click(tabBar(tab));
    expect(document.querySelectorAll('nav[aria-label="breadcrumb"]').length).toBe(1);
    expect(crumbs()).toEqual(['首頁', label]);
  });
  it('點「首頁」回到我的任務', () => {
    setup();
    fireEvent.click(tabBar('時程'));
    fireEvent.click(within(document.querySelector('nav[aria-label="breadcrumb"]')).getByRole('button', { name: '首頁' }));
    expect(crumbs()).toEqual(['首頁']);
    expect(tabBar('我的任務').getAttribute('aria-current')).toBe('page');
  });
  it('專案詳情：三層、仍只有一列', () => {
    setup();
    fireEvent.click(tabBar('專案'));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(document.querySelectorAll('nav[aria-label="breadcrumb"]').length).toBe(1);
    expect(crumbs()).toEqual(['首頁', '專案', 'Alpha']);
  });
});
