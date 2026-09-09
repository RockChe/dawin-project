import { describe, it, expect, vi, beforeEach } from 'vitest';

// 這個 mock 讓我們自由切換「現在是誰登入」
let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession
      ? { session: currentSession, error: null }
      : { session: null, error: 'UNAUTHORIZED' },
}));

const { withCap, withRouteCap } = await import('@/lib/withCap');

beforeEach(() => { currentSession = null; });

describe('withCap', () => {
  it('授權通過時呼叫 callback 並把 session 傳進去', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    const result = await withCap('write', async (session) => ({ ok: session.userId }));
    expect(result).toEqual({ ok: 'u1' });
  });

  // 這是整個方案的核心斷言：授權沒過，業務邏輯「完全沒被執行」，
  // 不是「執行了但結果被丟掉」。
  it('授權沒過時 callback 完全不會被呼叫', async () => {
    currentSession = { userId: 'u2', role: 'viewer' };
    const fn = vi.fn(async () => ({ ok: true }));
    const result = await withCap('write', fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ error: 'FORBIDDEN' });
  });

  it('未登入時 callback 完全不會被呼叫', async () => {
    currentSession = null;
    const fn = vi.fn(async () => ({ ok: true }));
    const result = await withCap('read', fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('未知角色一律拒絕', async () => {
    currentSession = { userId: 'u3', role: 'auditor' };
    const fn = vi.fn(async () => ({ ok: true }));
    expect(await withCap('read', fn)).toEqual({ error: 'FORBIDDEN' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('session 缺 role 一律拒絕', async () => {
    currentSession = { userId: 'u4' };
    const fn = vi.fn(async () => ({ ok: true }));
    expect(await withCap('read', fn)).toEqual({ error: 'FORBIDDEN' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('withRouteCap', () => {
  it('授權通過時呼叫 handler', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    const handler = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await withRouteCap('write', handler)(new Request('http://x/'), {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('viewer 打寫入 route → 403，handler 完全不會被呼叫', async () => {
    currentSession = { userId: 'u2', role: 'viewer' };
    const handler = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await withRouteCap('write', handler)(new Request('http://x/'), {});
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'FORBIDDEN' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('未登入 → 401，handler 完全不會被呼叫', async () => {
    currentSession = null;
    const handler = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await withRouteCap('read', handler)(new Request('http://x/'), {});
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
