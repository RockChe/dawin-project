import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null } : { session: null, error: 'UNAUTHORIZED' },
}));
vi.mock('drizzle-orm', () => ({
  eq: (f, v) => ({ f, v }), asc: () => null, inArray: (f, v) => ({ f, v }),
  sql: Object.assign((s, ...v) => ({ s, v }), { raw: (t) => t, join: () => null }),
}));
vi.mock('@/server/db/schema', () => ({
  projects: { id: 'id', archivedAt: 'archivedAt', updatedAt: 'updatedAt' }, tasks: {}, subtasks: {}, users: {},
}));

let updated = [{ id: 'p' }];            // .returning() 的結果（空陣列 = 沒有這個專案）
const returning = vi.fn(async () => updated);
const where = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const update = vi.fn(() => ({ set }));
const boom = () => { throw new Error('不該呼叫'); };
vi.mock('@/server/db', () => ({ db: { update, select: boom, insert: boom, delete: boom, execute: boom } }));
const logAudit = vi.fn(async () => {});
vi.mock('@/lib/audit', () => ({ logAudit }));
vi.mock('@/lib/r2', () => ({ deleteFromR2: vi.fn() }));

const { archiveProject, unarchiveProject } = await import('@/server/actions/projects');

const PID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  currentSession = { userId: 'u1', role: 'admin' };
  updated = [{ id: PID }];
});

describe.each([
  ['archiveProject', archiveProject, 'PROJECT_ARCHIVE'],
  ['unarchiveProject', unarchiveProject, 'PROJECT_UNARCHIVE'],
])('%s', (_name, fn, auditAction) => {
  it('viewer → FORBIDDEN，不碰 DB', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    await expect(fn(PID)).resolves.toEqual({ error: 'FORBIDDEN' });
    expect(update).not.toHaveBeenCalled();
  });

  it('未登入 → UNAUTHORIZED', async () => {
    currentSession = null;
    await expect(fn(PID)).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it.each([['非 UUID', 'x'], ['undefined', undefined], ['陣列', [PID]]])('id 不合法（%s）→ error，不寫入', async (_n, id) => {
    const res = await fn(id);
    expect(res.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it('專案不存在（UPDATE 0 列）→ error，不寫 audit', async () => {
    updated = [];
    const res = await fn(PID);
    expect(res.error).toBeTruthy();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('成功 → {success:true}，單一 UPDATE 帶 id 守門，寫 audit', async () => {
    await expect(fn(PID)).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith({ f: 'id', v: PID });
    expect(logAudit).toHaveBeenCalledWith(auditAction, 'u1', { resourceType: 'project', resourceId: PID });
  });

  it('DB 例外 → { error }，不丟出', async () => {
    returning.mockRejectedValueOnce(new Error('db down'));
    await expect(fn(PID)).resolves.toEqual({ error: 'db down' });
  });
});

describe('archived_at 值', () => {
  it('archiveProject 寫入 Date（現在時間）', async () => {
    await archiveProject(PID);
    expect(set.mock.calls[0][0].archivedAt).toBeInstanceOf(Date);
  });
  it('unarchiveProject 清成 null', async () => {
    await unarchiveProject(PID);
    expect(set.mock.calls[0][0].archivedAt).toBeNull();
  });
});
