import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import Sidebar from '@/components/dashboard/Sidebar';

vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));

const renderSidebar = () =>
  render(<ThemeProvider><Sidebar user={{ name: 'A', email: 'a@x.com', role: 'admin' }} /></ThemeProvider>);

describe('Sidebar 手機版連結', () => {
  it('收合時也有「手機版」連結，指向 /api/device?to=mobile', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: '手機版' }).getAttribute('href')).toBe('/api/device?to=mobile');
  });

  it('展開後顯示「手機版」文字', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('▸'));
    expect(screen.getByText('手機版').closest('a').getAttribute('href')).toBe('/api/device?to=mobile');
  });
});
