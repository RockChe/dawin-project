/** 帳號管理／備份頁的麵包屑：首頁（href=/dashboard）› 頁名（當前頁）。 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';

vi.mock('@/server/actions/users', () => ({
  getUsers: vi.fn(async () => ({ users: [], currentUserId: 'u1' })),
  createUser: vi.fn(), resetUserPassword: vi.fn(), deleteUser: vi.fn(), updateUser: vi.fn(),
}));
vi.mock('@/server/actions/backup', () => ({
  getBackupSettings: vi.fn(async () => ({ data: {} })),
  saveBackupSettings: vi.fn(), getBackupHistory: vi.fn(async () => ({ data: [] })), triggerBackup: vi.fn(),
  testR2ConnectionAction: vi.fn(), testGDriveConnectionAction: vi.fn(), getAuditLogs: vi.fn(async () => ({ data: [] })),
}));

import UsersPage from '../(admin)/users/page';
import BackupPage from '../(admin)/backup/page';

const crumbs = () => {
  const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
  return { nav, items: [...nav.querySelectorAll('li')].map(li => li.textContent.replace('›', '')) };
};

describe('admin 頁麵包屑', () => {
  it('帳號管理：首頁 › 帳號管理，首頁連到 /dashboard', () => {
    render(<ThemeProvider><UsersPage /></ThemeProvider>);
    const { nav, items } = crumbs();
    expect(items).toEqual(['首頁', '帳號管理']);
    expect(screen.getByRole('link', { name: '首頁' }).getAttribute('href')).toBe('/dashboard');
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('帳號管理');
  });

  it('備份：首頁 › 備份，首頁連到 /dashboard', async () => {
    render(<ThemeProvider><BackupPage /></ThemeProvider>);
    await screen.findByRole('navigation', { name: 'breadcrumb' });
    expect(crumbs().items).toEqual(['首頁', '備份']);
    expect(screen.getByRole('link', { name: '首頁' }).getAttribute('href')).toBe('/dashboard');
  });
});
