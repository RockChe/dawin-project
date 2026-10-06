/**
 * updateUser 改名同步：users.name + 每筆 tasks.owner 的 token + config 'owners' 陣列，
 * 必須走同一個 db.batch([...])（neon-http 沒有互動式 transaction，batch 是單次往返的原子）。
 *
 * fake db：update() 回傳「不可 await 的惰性 builder」，只有被丟進 db.batch 才會生效——
 * 所以若實作裡有人直接 await db.update(...)，狀態不會變、測試會紅。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let tables;
const batchCalls = [];

const eq = (f, v) => (row) => row[f] === v;
const and = (...fns) => (row) => fns.every((f) => f(row));
const isNotNull = (f) => (row) => row[f] != null;
function sql() { return { text: '', values: [] }; }
sql.raw = () => ({});
vi.mock('drizzle-orm', () => ({ eq, and, isNotNull, sql }));

const T = (name) => ({ __t: name, id: 'id', name: 'name', owner: 'owner', key: 'key', value: 'value', updatedAt: 'updatedAt' });
const usersT = T('users'), tasksT = T('tasks'), configT = T('config');
vi.mock('@/server/db/schema', () => ({ users: usersT, tasks: tasksT, configTable: configT }));

const rowsOf = (t) => tables[t.__t];
const mockDb = {
  select: () => ({
    from: (t) => ({
      where: (pred) => {
        const rows = rowsOf(t).filter(pred).map((r) => ({ ...r }));
        return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows.slice(0, 1)) });
      },
    }),
  }),
  update: (t) => ({
    set: (data) => ({
      where: (pred) => ({
        __apply: () => rowsOf(t).forEach((r) => { if (pred(r)) Object.assign(r, data); }),
      }),
    }),
  }),
  batch: vi.fn(async (list) => {
    batchCalls.push(list.length);
    list.forEach((b) => b.__apply());
    return [];
  }),
  execute: vi.fn(async () => ({ rows: [{ id: 'x' }] })),
};
vi.mock('@/server/db', () => ({ db: mockDb }));

const logAudit = vi.fn(async () => {});
vi.mock('@/lib/audit', () => ({ logAudit }));
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () => ({ session: { userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'super_admin' }, error: null }),
}));

const { updateUser } = await import('@/server/actions/users');

const UID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  batchCalls.length = 0;
  vi.clearAllMocks();
  tables = {
    users: [{ id: UID, name: 'Amy', role: 'admin' }],
    tasks: [
      { id: 't1', owner: 'Amy' },
      { id: 't2', owner: 'Bob, Amy, Cat' },
      { id: 't3', owner: 'Amy Lin' },
      { id: 't4', owner: null },
      { id: 't5', owner: 'Bob' },
    ],
    config: [{ key: 'owners', value: JSON.stringify(['Bob', 'Amy', 'Amy Lin']) }],
  };
});

describe('updateUser 改名同步', () => {
  it('同步 users / tasks.owner token / config owners，且全在同一個 db.batch', async () => {
    const res = await updateUser(UID, { name: 'Amanda' });

    expect(res).toEqual({ success: true });
    expect(batchCalls).toHaveLength(1);
    expect(tables.users[0].name).toBe('Amanda');
    expect(tables.tasks.map((t) => t.owner)).toEqual(['Amanda', 'Bob, Amanda, Cat', 'Amy Lin', null, 'Bob']);
    expect(JSON.parse(tables.config[0].value)).toEqual(['Bob', 'Amanda', 'Amy Lin']);
    expect(logAudit).toHaveBeenCalledTimes(1);
  });

  it('名字沒變 → 不動 tasks / config', async () => {
    await updateUser(UID, { name: 'Amy' });
    expect(tables.tasks.map((t) => t.owner)).toEqual(['Amy', 'Bob, Amy, Cat', 'Amy Lin', null, 'Bob']);
  });

  it('config 沒有 owners 列 / 不是陣列 → 略過但照樣改名', async () => {
    tables.config = [];
    expect((await updateUser(UID, { name: 'Amanda' })).success).toBe(true);
    expect(tables.tasks[0].owner).toBe('Amanda');
  });

  it('使用者不存在 → 回錯誤、不寫入', async () => {
    tables.users = [];
    const res = await updateUser(UID, { name: 'Amanda' });
    expect(res.error).toBeTruthy();
    expect(mockDb.batch).not.toHaveBeenCalled();
  });
});
