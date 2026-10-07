import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import V2AppLayout, { viewport as appViewport } from '@/app/(v2-app)/layout';
import V2PublicLayout, { viewport as pubViewport } from '@/app/(v2-public)/layout';
import PreviewPage from '@/app/(v2-public)/v2/preview/[screen]/page';
import V2Root from '@/components/v2/V2Root';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('(v2-app) layout', () => {
  it('viewport 固定 1280', () => { expect(appViewport).toEqual({ width: 1280 }); });
  it('未登入 → /v2/login', async () => {
    getSession.mockResolvedValue(null);
    await expect(V2AppLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/v2/login');
  });
  it('getSession 丟錯 → /v2/login', async () => {
    getSession.mockRejectedValue(new Error('boom'));
    await expect(V2AppLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/v2/login');
  });
  it('需改密碼 → /set-password', async () => {
    getSession.mockResolvedValue({ role: 'admin', mustChangePassword: true });
    await expect(V2AppLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/set-password');
  });
  it('已登入 → V2Root 包 children，role 取自 session', async () => {
    getSession.mockResolvedValue({ role: 'viewer', mustChangePassword: false });
    const el = await V2AppLayout({ children: 'kid' });
    expect(el.type).toBe(V2Root);
    expect(el.props.role).toBe('viewer');
    expect(el.props.children).toBe('kid');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('(v2-public) layout', () => {
  it('viewport 固定 1280；不查 session（登入頁公開）', () => {
    expect(pubViewport).toEqual({ width: 1280 });
    const el = V2PublicLayout({ children: 'kid' });
    expect(el.type).toBe(V2Root);
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('/v2/preview/[screen]', () => {
  const call = (screen = 'shell', sp = {}) => PreviewPage({ params: Promise.resolve({ screen }), searchParams: Promise.resolve(sp) });

  it('production：有／無 session 皆 404，且不碰 session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const s of [null, { role: 'admin' }]) {
      getSession.mockResolvedValue(s);
      await expect(call()).rejects.toThrow('NOT_FOUND');
    }
    expect(getSession).not.toHaveBeenCalled();
  });
  it('非 production：shell 可渲染；未知畫面 404', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const el = await call('shell', { theme: 'dark' });
    expect(el).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
    expect(await call('login', { clouds: 'off' })).toBeTruthy();
    await expect(call('nope')).rejects.toThrow('NOT_FOUND');
  });
  it('project（專案詳情預覽）：只認 p+數字的 pid；empty／exp／alldone 轉成 pj 參數', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect((await call('project', {})).props.pj).toEqual({ id: 'p1', empty: false, expanded: [], alldone: undefined });
    expect((await call('project', { pid: 'p5', empty: '1', exp: 't1,t2', alldone: 't19' })).props.pj).toEqual({ id: 'p5', empty: true, expanded: ['t1', 't2'], alldone: 't19' });
    expect((await call('project', { pid: '../x', exp: 'zz,t3', alldone: 'x' })).props.pj).toEqual({ id: 'p1', empty: false, expanded: ['t3'], alldone: undefined });
  });
});

describe('/v2/login 路由', () => {
  it('渲染 LoginScreen（公開，不查 session）', async () => {
    const { default: LoginPage } = await import('@/app/(v2-public)/v2/login/page');
    const { default: LoginScreen } = await import('@/components/v2/LoginScreen');
    expect(LoginPage().type).toBe(LoginScreen);
    expect(getSession).not.toHaveBeenCalled();
  });
});
