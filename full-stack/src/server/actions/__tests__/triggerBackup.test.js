import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null }
                   : { session: null, error: 'UNAUTHORIZED' },
}));
vi.mock('@/lib/backupRunner', () => ({
  performBackup: vi.fn(async () => [{ target: 'r2', success: true }]),
  // 讀設定被抽到 backupRunner，所以這裡 mock 得到——不再需要同模組 spy
  loadScheduleContext: vi.fn(async () => ({
    settings: { backup_targets: ['r2'], backup_keep_count: 30 },
    lastSuccessAt: null,
    keepCount: 30,
  })),
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/db/schema', () => ({ configTable: {}, backupHistory: {} }));

const backup = await import('@/server/actions/backup');

beforeEach(() => { currentSession = null; });

describe('triggerBackup 回傳契約', () => {
  it('成功時回 { success: true, results }，不是裸 array（備份頁依賴這個）', async () => {
    currentSession = { userId: 's1', role: 'super_admin' };
    const r = await backup.triggerBackup();
    expect(r).toHaveProperty('success', true);
    expect(Array.isArray(r.results)).toBe(true);
    expect(Array.isArray(r)).toBe(false);
  });

  it('viewer 呼叫 → FORBIDDEN', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect(await backup.triggerBackup()).toEqual({ error: 'FORBIDDEN' });
  });

  it('admin 呼叫也 → FORBIDDEN（備份是 manage）', async () => {
    currentSession = { userId: 'a1', role: 'admin' };
    expect(await backup.triggerBackup()).toEqual({ error: 'FORBIDDEN' });
  });
});

// ── cronBackup 已移除 ──
// 原因：'use server' 檔的每支 export 都會變成可從瀏覽器呼叫的 endpoint，
// 無授權的 export 等於開後門。cron 路徑改由 /api/backup 的 POST 直接呼叫 backupRunner。
