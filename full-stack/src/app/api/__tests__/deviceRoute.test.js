import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/device/route';

const call = to => GET(new NextRequest(`http://localhost:3000/api/device${to === undefined ? '' : `?to=${to}`}`));

describe('GET /api/device', () => {
  it('to=mobile → 設 cookie 並導向 /m', async () => {
    const res = await call('mobile');
    expect(new URL(res.headers.get('location')).pathname).toBe('/m');
    const set = res.headers.get('set-cookie');
    expect(set).toMatch(/device_pref=mobile/);
    expect(set).toMatch(/Max-Age=31536000/i);
    expect(set).toMatch(/SameSite=lax/i);
  });
  it('to=desktop → /dashboard', async () => {
    const res = await call('desktop');
    expect(new URL(res.headers.get('location')).pathname).toBe('/dashboard');
  });
  it('to=tablet（未啟用）→ 400，不設 cookie', async () => {
    const res = await call('tablet');
    expect(res.status).toBe(400);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('缺參數或亂值 → 400', async () => {
    expect((await call(undefined)).status).toBe(400);
    expect((await call('//evil.com')).status).toBe(400);
  });
});
