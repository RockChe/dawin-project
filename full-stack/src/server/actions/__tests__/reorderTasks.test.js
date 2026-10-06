import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null } : { session: null, error: 'UNAUTHORIZED' },
}));

// sql 樣板 fake：保留字面文字與參數，方便斷言「單一 statement、帶 project_id 守門、寫了哪個順序」
function sql(strings, ...items) {
  let text = strings[0]; const values = [];
  items.forEach((it, i) => {
    if (it && it.__join) { text += it.text; values.push(...it.values); }
    else { values.push(it); text += '?'; }
    text += strings[i + 1];
  });
  return { text, values, __join: true };
}
sql.raw = (t) => ({ __join: true, text: t, values: [] });
sql.join = (chunks, sep) => ({
  __join: true,
  text: chunks.map(c => c.text).join(sep.text),
  values: chunks.flatMap(c => c.values),
});
vi.mock('drizzle-orm', () => ({
  eq: (f, v) => ({ f, v }), and: (...a) => a, asc: () => null, desc: () => null,
  inArray: (f, v) => ({ f, v }), sql,
}));
vi.mock('@/server/db/schema', () => ({
  tasks: { id: 'id', projectId: 'projectId' }, subtasks: {}, links: {}, files: {}, projects: {}, users: {},
}));

let projectTasks = [];           // DB 內該專案的 task id
const execute = vi.fn(async () => ({ rows: [] }));
const select = vi.fn(() => ({ from: () => ({ where: async (cond) => {
  // cond = and(eq(projectId), inArray(id, ids))：只回「請求的 id 中屬於該專案的」
  const wanted = cond.find(c => Array.isArray(c.v))?.v ?? [];
  return projectTasks.filter(id => wanted.includes(id)).map(id => ({ id }));
} }) }));
vi.mock('@/server/db', () => ({ db: { select, execute, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), batch: vi.fn() } }));
const logAudit = vi.fn(async () => {});
vi.mock('@/lib/audit', () => ({ logAudit }));
vi.mock('@/lib/r2', () => ({ deleteFromR2: vi.fn() }));

const { reorderTasks } = await import('@/server/actions/tasks');

const PID = '22222222-2222-4222-8222-222222222222';
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '44444444-4444-4444-8444-444444444444';
const T3 = '55555555-5555-4555-8555-555555555555';
const OTHER = '66666666-6666-4666-8666-666666666666';

beforeEach(() => {
  vi.clearAllMocks();
  currentSession = { userId: 'u1', role: 'admin' };
  projectTasks = [T1, T2, T3];
});

describe('reorderTasks', () => {
  it('viewer → FORBIDDEN，不碰 DB', async () => {
    currentSession = { userId: 'u1', role: 'viewer' };
    await expect(reorderTasks(PID, [T1])).resolves.toEqual({ error: 'FORBIDDEN' });
    expect(select).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('未登入 → UNAUTHORIZED', async () => {
    currentSession = null;
    await expect(reorderTasks(PID, [T1])).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it.each([
    ['projectId 非 UUID', ['x', [T1]]],
    ['orderedTaskIds 非陣列', [PID, 'nope']],
    ['空陣列', [PID, []]],
    ['含非 UUID', [PID, [T1, 'bad']]],
    ['重複 id', [PID, [T1, T1]]],
  ])('參數不合法（%s）→ error，不寫入', async (_n, args) => {
    const res = await reorderTasks(...args);
    expect(res.error).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  it('含不屬於該專案的 task → error，不寫入', async () => {
    const res = await reorderTasks(PID, [T1, OTHER]);
    expect(res.error).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  it('合法 → 單一 UPDATE statement，依序寫 1..N，且帶 project_id 守門 + audit', async () => {
    const res = await reorderTasks(PID, [T3, T1, T2]);
    expect(res).toEqual({ success: true });
    expect(execute).toHaveBeenCalledTimes(1);
    const q = execute.mock.calls[0][0];
    expect(q.text).toMatch(/UPDATE tasks SET sort_order/);
    expect(q.text).toMatch(/project_id = \?/);
    // WHEN id=T3 THEN 1, T1 THEN 2, T2 THEN 3
    expect(q.values.slice(0, 6)).toEqual([T3, 1, T1, 2, T2, 3]);
    expect(q.values).toContain(PID);
    expect(logAudit).toHaveBeenCalledWith('TASK_REORDER', 'u1', expect.objectContaining({ resourceType: 'project', resourceId: PID }));
  });

  it('DB 丟錯 → 回 { error }', async () => {
    execute.mockRejectedValueOnce(new Error('boom'));
    const res = await reorderTasks(PID, [T1]);
    expect(res).toEqual({ error: 'boom' });
  });
});
