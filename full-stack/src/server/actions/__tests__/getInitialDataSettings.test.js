/**
 * getInitialData 一併回傳「目前使用者」的個人設定（省掉首屏後再打一次 getUserSettings 的 round trip）。
 * 設定查詢必須跟其他查詢同一個 Promise.all（不得串行），且只取 session.userId 的列。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

const calls = []; // 依發起順序記錄每次 select 的 table
let settingRows = [];

vi.mock('@/lib/withCap', () => ({
  withCap: (_cap, fn) => fn({ userId: 'u1', role: 'admin', name: 'Me', email: 'me@x.com' }),
}));
vi.mock('@/lib/r2', () => ({ getDownloadUrl: vi.fn() }));
vi.mock('@/server/db', () => {
  const chain = (table) => {
    const c = {
      leftJoin: () => c, orderBy: () => c, where: (w) => { c.w = w; return c; },
      then: (res, rej) => Promise.resolve(table.rows()).then(res, rej),
    };
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (t) => {
          calls.push(t);
          return chain({ rows: () => (globalThis.__rowsFor?.(t) ?? []) });
        },
      }),
    },
  };
});

const { getInitialData } = await import('@/server/actions/dashboard');

beforeEach(() => {
  calls.length = 0;
  settingRows = [];
  globalThis.__rowsFor = (t) => (getTableName(t) === 'user_settings' ? settingRows : []);
});

describe('getInitialData settings', () => {
  it('returns parsed settings keyed by key', async () => {
    settingRows = [
      { key: 'zoom', value: '120' },
      { key: 'hiddenProjects', value: '["a"]' },
      { key: 'activeTab', value: '"projects"' },
    ];
    const data = await getInitialData();
    expect(data.settings).toEqual({ zoom: 120, hiddenProjects: ['a'], activeTab: 'projects' });
  });

  it('returns {} when the user has no saved settings', async () => {
    const data = await getInitialData();
    expect(data.settings).toEqual({});
  });

  it('keeps a raw string when the stored value is not JSON (same as getUserSettings)', async () => {
    settingRows = [{ key: 'x', value: 'not json' }];
    const data = await getInitialData();
    expect(data.settings).toEqual({ x: 'not json' });
  });

  it('issues the settings query synchronously with the others (one parallel batch, no awaited gap)', async () => {
    await getInitialData();
    const names = calls.map(getTableName);
    expect(names).toContain('user_settings');
    // 全部 8 個查詢（含 settings）都在第一個 await 之前發出 → 同一個 Promise.all
    expect(names.length).toBe(8);
  });
});
