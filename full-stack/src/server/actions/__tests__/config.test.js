import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null }
                   : { session: null, error: 'UNAUTHORIZED' },
}));

// DB 不該被碰到——所有 FORBIDDEN 案例都必須在查 DB 之前就短路。
const selectSpy = vi.fn();
vi.mock('@/server/db', () => ({
  db: {
    select: (...a) => { selectSpy(...a); return { from: () => ({ where: () => ({ limit: async () => [] }) }) }; },
    insert: () => ({ values: async () => {} }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  },
}));
vi.mock('@/server/db/schema', () => ({ configTable: { key: 'key', value: 'value' } }));

const { getConfig, getConfigs, saveConfig } = await import('@/server/actions/config');

beforeEach(() => { currentSession = null; selectSpy.mockClear(); });

describe('config key 白名單（漏洞 C）', () => {
  it('admin 讀不到備份憑證，而且根本不會去查 DB', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    expect(await getConfig('backup_r2_bucket')).toEqual({ error: 'FORBIDDEN' });
    expect(await getConfig('backup_r2_secret_key')).toEqual({ error: 'FORBIDDEN' });
    expect(await getConfig('backup_gdrive_email')).toEqual({ error: 'FORBIDDEN' });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('viewer 讀不到備份憑證', async () => {
    currentSession = { userId: 'u2', role: 'viewer' };
    expect(await getConfig('backup_r2_bucket')).toEqual({ error: 'FORBIDDEN' });
  });

  it('getConfigs 只要含一個非白名單 key 就整批拒絕（不靜默過濾）', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    expect(await getConfigs(['owners', 'backup_r2_bucket'])).toEqual({ error: 'FORBIDDEN' });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('白名單內的 key 正常可讀', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    const r = await getConfig('owners');
    expect(r).not.toHaveProperty('error');
  });

  it('viewer 可讀 owners（篩選下拉需要）', async () => {
    currentSession = { userId: 'u2', role: 'viewer' };
    const r = await getConfig('owners');
    expect(r).not.toHaveProperty('error');
  });

  it('viewer 不能寫任何 config', async () => {
    currentSession = { userId: 'u2', role: 'viewer' };
    expect(await saveConfig('owners', ['A'])).toEqual({ error: 'FORBIDDEN' });
  });

  it('admin 不能透過 saveConfig 覆寫備份憑證', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    expect(await saveConfig('backup_r2_bucket', 'evil-bucket')).toEqual({ error: 'FORBIDDEN' });
  });

  it('admin 可寫白名單內的 config', async () => {
    currentSession = { userId: 'u1', role: 'admin' };
    expect(await saveConfig('owners', ['A'])).toEqual({ success: true });
  });
});
