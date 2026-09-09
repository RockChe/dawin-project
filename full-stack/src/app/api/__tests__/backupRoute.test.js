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

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null }
                   : { session: null, error: 'UNAUTHORIZED' },
}));
vi.mock('@/lib/backup', () => ({ exportAllTables: vi.fn(async () => ({ meta: { counts: {} } })) }));

const { POST, GET } = await import('@/app/api/backup/route');

beforeEach(() => { currentSession = null; });

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

describe('/api/backup GET 權限與下載行為', () => {
  it('admin 打 GET → 403（整庫備份是 manage，只有 super_admin 可以）', async () => {
    currentSession = { userId: 'a1', role: 'admin' };
    expect((await GET(new Request('http://x/api/backup'), {})).status).toBe(403);
  });

  it('viewer 打 GET → 403', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect((await GET(new Request('http://x/api/backup'), {})).status).toBe(403);
  });

  it('super_admin 打 GET → 200，且回傳附件標頭而非裸 JSON', async () => {
    currentSession = { userId: 's1', role: 'super_admin' };
    const res = await GET(new Request('http://x/api/backup'), {});
    expect(res.status).toBe(200);
    // 檔名格式是 ISO 時間戳去掉 - : 與毫秒/Z，保留 T（例："20260908T134609"），不是純數字
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="dawin-backup-\d{8}T\d{6}\.json"$/);
  });
});
