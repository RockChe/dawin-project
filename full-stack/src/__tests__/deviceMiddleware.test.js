import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const req = (path, { ua = DESKTOP, cookie = 'session_token=abc', method = 'GET' } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { method, headers: { 'user-agent': ua, cookie } });

describe('middleware 裝置導向', () => {
  it('手機開 /dashboard → 302 /m', () => {
    const res = middleware(req('/dashboard', { ua: IPHONE }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')).pathname).toBe('/m');
  });
  it('桌機開 /dashboard → 放行', () => {
    const res = middleware(req('/dashboard'));
    expect(res.headers.get('location')).toBeNull();
  });
  it('手機但手動選了桌機 → 放行', () => {
    const res = middleware(req('/dashboard', { ua: IPHONE, cookie: 'session_token=abc; device_pref=desktop' }));
    expect(res.headers.get('location')).toBeNull();
  });
  it('桌機手動選手機 → /m', () => {
    const res = middleware(req('/dashboard', { cookie: 'session_token=abc; device_pref=mobile' }));
    expect(new URL(res.headers.get('location')).pathname).toBe('/m');
  });
  it('直接開 /m 不會被導走（明確網址永遠尊重）', () => {
    const res = middleware(req('/m'));
    expect(res.headers.get('location')).toBeNull();
  });
  it('沒登入先去 /login，不先做裝置導向', () => {
    const res = middleware(req('/dashboard', { ua: IPHONE, cookie: '' }));
    expect(new URL(res.headers.get('location')).pathname).toBe('/login');
  });
  it('非 GET 的 /dashboard 不導向', () => {
    const res = middleware(req('/dashboard', { ua: IPHONE, method: 'POST' }));
    expect(res.headers.get('location')).toBeNull();
  });
  it('/api/device 不是公開路徑：沒登入 → /login', () => {
    const res = middleware(req('/api/device?to=mobile', { cookie: '' }));
    expect(new URL(res.headers.get('location')).pathname).toBe('/login');
  });
});
