import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/backupRunner', () => ({
  shouldRunScheduledBackup: () => ({ run: false, reason: '測試用：不實際備份' }),
  performBackup: vi.fn(async () => []),
  // POST 在 secret 通過後第一件事就是呼叫這支——漏 mock 的話「正確 secret 通過」那條會炸
  loadScheduleContext: vi.fn(async () => ({
    settings: { backup_enabled: true, backup_targets: ['r2'], backup_frequency: 8 },
    lastSuccessAt: null,
    keepCount: 30,
  })),
}));
vi.mock('@/server/db', () => ({ db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }) }) } }));
vi.mock('@/server/db/schema', () => ({ configTable: {}, backupHistory: {} }));
vi.mock('@/lib/auth', () => ({ safeRequireAuth: async () => ({ session: null, error: 'UNAUTHORIZED' }) }));

const { POST } = await import('@/app/api/backup/route');

const post = (auth) =>
  POST(new Request('http://x/api/backup', { method: 'POST', headers: auth ? { authorization: auth } : {} }));

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => { process.env.CRON_SECRET = ORIGINAL; });

describe('/api/backup POST 的 CRON_SECRET 驗證（漏洞 B）', () => {
  it('CRON_SECRET 未設定時，送 "Bearer undefined" 必須被拒', async () => {
    delete process.env.CRON_SECRET;
    expect((await post('Bearer undefined')).status).toBe(401);
  });

  it('CRON_SECRET 未設定時，任何 header 都被拒', async () => {
    delete process.env.CRON_SECRET;
    expect((await post('Bearer anything')).status).toBe(401);
    expect((await post(null)).status).toBe(401);
  });

  it('CRON_SECRET 為空字串時一律拒絕', async () => {
    process.env.CRON_SECRET = '';
    expect((await post('Bearer ')).status).toBe(401);
  });

  it('CRON_SECRET 過短（<32 字元）時一律拒絕', async () => {
    process.env.CRON_SECRET = 'short';
    expect((await post('Bearer short')).status).toBe(401);
  });

  it('CRON_SECRET 正確設定且 header 相符時通過', async () => {
    process.env.CRON_SECRET = 'a'.repeat(48);
    expect((await post(`Bearer ${'a'.repeat(48)}`)).status).toBe(200);
  });

  it('CRON_SECRET 正確設定但 header 不符時拒絕', async () => {
    process.env.CRON_SECRET = 'a'.repeat(48);
    expect((await post(`Bearer ${'b'.repeat(48)}`)).status).toBe(401);
  });
});
