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
const usersT = T('users'), tasksT = T('tasks'), subtasksT = T('subtasks'), configT = T('config');
vi.mock('@/server/db/schema', () => ({ users: usersT, tasks: tasksT, subtasks: subtasksT, configTable: configT }));

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
    subtasks: [
      { id: 's1', owner: 'Amy' },
      { id: 's2', owner: 'Bob,Amy,Cat' },
      { id: 's3', owner: 'Amy Lin' },
      { id: 's4', owner: null },
      { id: 's5', owner: 'Amy2, Amy ,Bob' },
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

  it('subtasks.owner 也同步（整個 token 才換、保留順序與分隔，相似前綴不誤中），且在同一個 batch', async () => {
    await updateUser(UID, { name: 'Amanda' });
    expect(batchCalls).toHaveLength(1);
    expect(tables.subtasks.map((s) => s.owner)).toEqual(['Amanda', 'Bob,Amanda,Cat', 'Amy Lin', null, 'Amy2, Amanda ,Bob']);
  });

  it('subtasks.owner 守衛：讀寫之間被別人改過的列不被蓋掉', async () => {
    mockDb.batch.mockImplementationOnce(async (list) => {
      tables.subtasks[0].owner = 'Amy,Zed'; // 讀完之後別人改了
      batchCalls.push(list.length);
      list.forEach((b) => b.__apply());
      return [];
    });
    await updateUser(UID, { name: 'Amanda' });
    expect(tables.subtasks[0].owner).toBe('Amy,Zed');
    expect(tables.subtasks[1].owner).toBe('Bob,Amanda,Cat');
  });

  it('改名後 subtasks.owner 會超過 varchar(255) → 回錯誤、整個 batch 不執行（不留下半套）', async () => {
    tables.subtasks[1].owner = 'Amy,' + 'x'.repeat(250);
    const res = await updateUser(UID, { name: 'A'.repeat(20) });
    expect(res.error).toBeTruthy();
    expect(mockDb.batch).not.toHaveBeenCalled();
    expect(tables.users[0].name).toBe('Amy');
  });

  it('名字沒變 → 不動 subtasks', async () => {
    await updateUser(UID, { name: 'Amy' });
    expect(tables.subtasks[0].owner).toBe('Amy');
  });
});
