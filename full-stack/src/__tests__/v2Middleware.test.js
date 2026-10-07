import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const req = (path, { cookie = '', method = 'GET' } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { method, headers: { cookie } });
const loc = (res) => { const l = res.headers.get('location'); return l ? new URL(l).pathname : null; };

describe('middleware /v2', () => {
  it('/v2/login 無 session 也放行（精確比對，含尾斜線）', () => {
    expect(loc(middleware(req('/v2/login')))).toBeNull();
    expect(loc(middleware(req('/v2/login/')))).toBeNull();
  });
  it('/v2/preview/* 一律放行（production 由 page 自己回 404，不靠 middleware）', () => {
    expect(loc(middleware(req('/v2/preview/shell')))).toBeNull();
  });
  it.each(['/v2', '/v2/', '/v2/projects', '/v2/loginx', '/v2/login/extra'])('%s 無 session → /v2/login', (p) => {
    expect(loc(middleware(req(p)))).toBe('/v2/login');
  });
  it('/v2 有 session cookie → 放行', () => {
    expect(loc(middleware(req('/v2', { cookie: 'session_token=abc' })))).toBeNull();
  });
  it('/v2login 不是 v2 路由，仍走舊的 /login', () => {
    expect(loc(middleware(req('/v2login')))).toBe('/login');
  });
  it('舊路線不受影響：/dashboard 無 session → /login；/login 仍公開', () => {
    expect(loc(middleware(req('/dashboard')))).toBe('/login');
    expect(loc(middleware(req('/login')))).toBeNull();
  });
});
