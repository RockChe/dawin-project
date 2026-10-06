import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import MobileLayout, { viewport } from '@/app/(mobile)/layout';

describe('(mobile) layout', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('viewport 為 device-width（不鎖桌機寬度）', () => {
    expect(viewport).toEqual({ width: 'device-width', initialScale: 1 });
  });

  it('未登入 → redirect /login', async () => {
    getSession.mockResolvedValue(null);
    await expect(MobileLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('getSession 丟錯 → redirect /login', async () => {
    getSession.mockRejectedValue(new Error('boom'));
    await expect(MobileLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('mustChangePassword → redirect /set-password', async () => {
    getSession.mockResolvedValue({ name: 'A', mustChangePassword: true });
    await expect(MobileLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/set-password');
  });

  it('已登入 → 回傳 children 外殼（無 Sidebar）', async () => {
    getSession.mockResolvedValue({ name: 'A', mustChangePassword: false });
    const el = await MobileLayout({ children: 'kid' });
    expect(el.props.children).toBe('kid');
    expect(redirect).not.toHaveBeenCalled();
  });
});
