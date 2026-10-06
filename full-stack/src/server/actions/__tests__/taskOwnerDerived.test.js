/**
 * tasks.owner 由子任務 owner 自動帶出（decision-task-owner-model 方案 A）的伺服端行為。
 *
 * neon-http 沒有互動式 transaction，所以「子任務寫入 + 父任務 owner 重算」必須是同一個
 * db.batch([...])；fake db 的 builder 若被直接 await（不經 batch）會記進 `direct`，
 * 測試據此證明沒有「兩次獨立寫入」的縫隙。
 * 這裡只能鎖住「發出什麼 statement」，SQL 本身的語意另以真 Postgres 驗過（見回報）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null } : { session: null, error: 'UNAUTHORIZED' },
}));

// sql 樣板 fake：保留字面文字與參數（巢狀片段攤平）
function sql(strings, ...items) {
  let text = strings[0]; const values = [];
  items.forEach((it, i) => {
    if (it && it.__sql) { text += it.text; values.push(...it.values); }
    else { values.push(it); text += '?'; }
    text += strings[i + 1];
  });
  return { __sql: true, text, values };
}
sql.raw = (t) => ({ __sql: true, text: t, values: [] });
vi.mock('drizzle-orm', () => ({
  eq: (f, v) => ({ f, v }), and: (...a) => a, asc: () => null, desc: () => null,
  inArray: (f, v) => ({ f, v }), sql,
}));
vi.mock('@/server/db/schema', () => ({
  tasks: { id: 'tasks.id', owner: 'tasks.owner', watchers: 'tasks.watchers', projectId: 'tasks.projectId' },
  subtasks: { id: 'subtasks.id', taskId: 'subtasks.taskId', owner: 'subtasks.owner' },
  links: {}, files: {}, projects: { id: 'projects.id', name: 'projects.name' }, users: { name: 'users.name' },
}));

const direct = [];          // 被直接 await（沒走 batch）的寫入
const batches = [];         // 每次 db.batch 收到的 statement 清單
let selectRows = [];        // select 一律回這份
const lazy = (item) => Object.assign(item, { then: (res, rej) => { direct.push(item); return Promise.resolve().then(res, rej); } });
const db = {
  select: vi.fn(() => {
    const p = () => Promise.resolve(selectRows);
    return { from: () => ({ where: () => Object.assign(p(), { limit: () => p() }), then: (r, j) => p().then(r, j) }) };
  }),
  insert: () => ({ values: (v) => ({ returning: () => ({ __op: 'insert', __v: v, __result: [{ id: 'new-sub', ...v }] }), ...lazy({ __op: 'insert', __v: v }) }) }),
  update: (t) => ({ set: (d) => ({ where: (c) => lazy({ __op: 'update', __t: t, __set: d, __where: c }) }) }),
  delete: (t) => ({ where: (c) => lazy({ __op: 'delete', __t: t, __where: c }) }),
  execute: vi.fn((q) => lazy({ __op: 'execute', q })),
  batch: vi.fn(async (list) => { batches.push(list); return list.map(i => i.__result ?? []); }),
};
vi.mock('@/server/db', () => ({ db }));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/r2', () => ({ deleteFromR2: vi.fn() }));

const T = await import('@/server/actions/tasks');

const TASK = '11111111-1111-4111-8111-111111111111';
const SUB = '33333333-3333-4333-8333-333333333333';
const PROJ = '22222222-2222-4222-8222-222222222222';

// 同步用的 statement：UPDATE tasks SET owner = COALESCE(<推得>, tasks.owner)
const isSync = (s) => s.__op === 'execute' && /UPDATE tasks SET owner = COALESCE\(/.test(s.q.text);
const derivedMarker = /string_agg/; // 推得子查詢的特徵

beforeEach(() => {
  vi.clearAllMocks();
  direct.length = 0; batches.length = 0; selectRows = [];
  currentSession = { userId: 'u1', role: 'admin' };
});

describe('推得 owner 的 SQL 規則', () => {
  it('依 sort_order → created_at 取 token、去重留首次、丟掉空與 "—"、無子任務 owner 時保留原值', async () => {
    await T.createSubtask({ taskId: TASK, name: 's', owner: 'Amy' });
    const sync = batches[0].find(isSync).q;
    expect(sync.text).toMatch(derivedMarker);
    expect(sync.text).toMatch(/string_to_array\(s\.owner, ','\)/);
    expect(sync.text).toMatch(/ORDER BY s\.sort_order, s\.created_at/);
    expect(sync.text).toMatch(/MIN\(x\.pos\)/);                 // 同名留第一次
    expect(sync.text).toMatch(/x\.tok <> ''/);
    expect(sync.text).toContain("x.tok <> '—'");
    expect(sync.text).toMatch(/CASE WHEN \(SELECT string_agg[\s\S]*IS NULL THEN NULL ELSE[\s\S]*tasks\.watchers[\s\S]*END, tasks\.owner\)/); // 沒推得值 → 保留；有 → 推得 ∪ 關注人
    expect(sync.text).toMatch(/s\.task_id = tasks\.id/);        // 相關子查詢綁在被更新的任務
  });
});

describe('createSubtask', () => {
  it('子任務 INSERT 與父任務 owner 重算在同一個 db.batch，沒有獨立寫入', async () => {
    const res = await T.createSubtask({ taskId: TASK, name: ' 子任務 ', owner: 'Amy' });
    expect(res.success).toBe(true);
    expect(res.subtask).toMatchObject({ name: '子任務', owner: 'Amy' });
    expect(batches).toHaveLength(1);
    expect(batches[0].map(s => s.__op)).toEqual(['insert', 'execute']);
    expect(isSync(batches[0][1])).toBe(true);
    expect(batches[0][1].q.values).toContain(TASK);
    expect(direct).toEqual([]);
  });

  it('viewer → FORBIDDEN，不碰 DB', async () => {
    currentSession = { userId: 'v', role: 'viewer' };
    await expect(T.createSubtask({ taskId: TASK, name: 'x' })).resolves.toEqual({ error: 'FORBIDDEN' });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('batch 丟錯 → 回 { error }', async () => {
    db.batch.mockRejectedValueOnce(new Error('boom'));
    await expect(T.createSubtask({ taskId: TASK, name: 'x' })).resolves.toEqual({ error: 'boom' });
  });
});

describe('updateSubtask', () => {
  it('改 owner → 同一個 batch 內重算父任務（以子任務 id 子查詢找父任務）', async () => {
    const res = await T.updateSubtask(SUB, { owner: 'Bob' });
    expect(res).toEqual({ success: true });
    expect(batches[0].map(s => s.__op)).toEqual(['update', 'execute']);
    expect(batches[0][0].__set).toEqual({ owner: 'Bob' });
    const sync = batches[0][1];
    expect(isSync(sync)).toBe(true);
    expect(sync.q.text).toMatch(/WHERE tasks\.id = \(SELECT task_id FROM subtasks WHERE id = \?\)/);
    expect(sync.q.values).toContain(SUB);
    expect(direct).toEqual([]);
  });

  it('改 sortOrder 也會影響推得順序 → 重算', async () => {
    await T.updateSubtask(SUB, { sortOrder: 3 });
    expect(batches[0].some(isSync)).toBe(true);
  });

  it('只改 name / notes / done → 不需要重算，維持單一 UPDATE', async () => {
    await T.updateSubtask(SUB, { name: 'x', notes: 'n', done: true });
    expect(db.batch).not.toHaveBeenCalled();
    expect(direct.map(d => d.__op)).toEqual(['update']);
  });
});

describe('deleteSubtask', () => {
  it('先讀出父任務 id，DELETE 與重算同一個 batch', async () => {
    selectRows = [{ taskId: TASK }];
    const res = await T.deleteSubtask(SUB);
    expect(res).toEqual({ success: true });
    expect(batches[0].map(s => s.__op)).toEqual(['delete', 'execute']);
    expect(isSync(batches[0][1])).toBe(true);
    expect(batches[0][1].q.values).toContain(TASK);
    expect(direct).toEqual([]);
  });

  it('子任務不存在 → 照舊成功，單純 DELETE（沒有父任務可重算）', async () => {
    selectRows = [];
    await expect(T.deleteSubtask(SUB)).resolves.toEqual({ success: true });
    expect(db.batch).not.toHaveBeenCalled();
  });
});

describe('toggleSubtask', () => {
  it('done 不影響 owner → 不做重算', async () => {
    selectRows = [{ id: SUB, taskId: TASK, done: false }];
    const res = await T.toggleSubtask(SUB);
    expect(res.success).toBe(true);
    expect(db.batch).not.toHaveBeenCalled();
    expect(direct.some(isSync)).toBe(false);
  });
});

describe('updateTask：推得值為準，傳進來的 owner 不報錯、交給 SQL 忽略', () => {
  it('owner 以 COALESCE(推得值, 傳入值) 寫入 → 有子任務 owner 時傳入值被忽略', async () => {
    selectRows = [{ name: 'Amy' }];
    const res = await T.updateTask(TASK, { owner: 'Amy', status: '進行中' });
    expect(res).toEqual({ success: true });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.status).toBe('進行中');
    expect(upd.__set.owner.text).toMatch(/string_agg/);
    expect(upd.__set.owner.text).toMatch(/tasks\.watchers/); // 關注人沿用資料庫現值
    expect(upd.__set.owner.values).toEqual(['Amy', 'Amy']); // 傳入的 owner（推得值缺席時的手動執行人；全空時的 fallback）
  });

  it('沒帶 owner → 不碰 owner 欄位', async () => {
    await T.updateTask(TASK, { status: '進行中' });
    const upd = direct.find(d => d.__op === 'update');
    expect('owner' in upd.__set).toBe(false);
  });

  it('owner 設成 null（清空）→ 仍走 COALESCE，無子任務 owner 時變 null', async () => {
    await T.updateTask(TASK, { owner: null });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.owner.values).toEqual([null, null]);
  });
});

describe('被忽略的 owner 不做驗證（有推得值時傳入的 owner 根本不會寫入）', () => {
  const TASK2 = '44444444-4444-4444-8444-444444444444';

  it('updateTask：任務有子任務 owner → 傳入未知使用者也成功，且不查 users', async () => {
    selectRows = [{ taskId: TASK, owner: 'Amy' }];
    const res = await T.updateTask(TASK, { owner: 'Ghost', status: '進行中' });
    expect(res).toEqual({ success: true });
    expect(db.select).toHaveBeenCalledTimes(1); // 只查了 subtasks
    expect(direct.find(d => d.__op === 'update').__set.status).toBe('進行中');
  });

  it('updateTask：沒有子任務 owner（含 "—"）→ owner 會被寫入，照常驗證', async () => {
    selectRows = [{ taskId: TASK, owner: '—' }]; // users 查詢也回這份 → 查無 Ghost
    const res = await T.updateTask(TASK, { owner: 'Ghost' });
    expect(res.error).toMatch(/Ghost/);
    expect(direct.some(d => d.__op === 'update')).toBe(false);
  });

  it('updateManyTasks：全部任務都有子任務 owner → 不驗證', async () => {
    selectRows = [{ taskId: TASK, owner: 'Amy' }, { taskId: TASK2, owner: 'Bob' }];
    const res = await T.updateManyTasks([TASK, TASK2], { owner: 'Ghost' });
    expect(res).toEqual({ success: true, updated: 2 });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('updateManyTasks：只要有一個任務會被寫入 owner → 照常驗證', async () => {
    selectRows = [{ taskId: TASK, owner: 'Amy' }]; // TASK2 沒有子任務 owner
    const res = await T.updateManyTasks([TASK, TASK2], { owner: 'Ghost' });
    expect(res.error).toMatch(/Ghost/);
    expect(direct.some(d => d.__op === 'update')).toBe(false);
  });
});

describe('updateManyTasks：有子任務 owner 的任務在 SQL 層被略過', () => {
  it('owner 以 COALESCE(推得值, 傳入值) 寫入同一個 UPDATE', async () => {
    selectRows = [{ name: 'Amy' }];
    const res = await T.updateManyTasks([TASK], { owner: 'Amy' });
    expect(res).toEqual({ success: true, updated: 1 });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.owner.text).toMatch(/string_agg/);
    expect(upd.__set.owner.values).toEqual(['Amy', 'Amy']);
  });

  it('改 status 時不動 owner', async () => {
    await T.updateManyTasks([TASK], { status: '已完成' });
    expect('owner' in direct.find(d => d.__op === 'update').__set).toBe(false);
  });
});

describe('upsertTasks（CSV 匯入）：覆寫既有任務時不蓋掉推得的 owner', () => {
  it('更新既有任務 → owner 走 COALESCE(推得值, CSV 值)', async () => {
    selectRows = [{ id: TASK, name: 'P', sortOrder: 1 }]; // projects 與 existing task 都回這筆
    const res = await T.upsertTasks([{ project: 'P', task: 'T', owner: 'Zed', status: '進行中' }]);
    expect(res).toMatchObject({ success: true, updated: 1, failed: 0 });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.owner.text).toMatch(/string_agg/);
    expect(upd.__set.owner.values).toEqual(['Zed', 'Zed']);
  });

  it('新增任務（沒有子任務）→ owner 照 CSV 寫入', async () => {
    // 專案存在、任務不存在：第一次 select（projects）有資料，第二次（tasks）空
    db.select
      .mockImplementationOnce(() => ({ from: () => Promise.resolve([{ id: PROJ, name: 'P', sortOrder: 1 }]) }))
      .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }));
    const res = await T.upsertTasks([{ project: 'P', task: 'New', owner: 'Zed' }]);
    expect(res).toMatchObject({ success: true, inserted: 1 });
    const ins = direct.find(d => d.__op === 'insert');
    expect(ins.__v.owner).toBe('Zed');
  });
});

describe('關注人 watchers（owner = 執行人 ∪ 關注人，單一語句寫入）', () => {
  it('updateTask({watchers})：驗證名字、正規化後與重算的 owner 在同一個 UPDATE', async () => {
    selectRows = [{ name: '幸真' }];
    const res = await T.updateTask(TASK, { watchers: ' 幸真 , ,—' });
    expect(res).toEqual({ success: true });
    const upds = direct.filter(d => d.__op === 'update');
    expect(upds).toHaveLength(1); // 沒有第二次獨立寫入
    expect(upds[0].__set.watchers).toBe('幸真');
    const o = upds[0].__set.owner;
    expect(o.text).toMatch(/string_agg/);
    expect(o.text).toMatch(/NOT EXISTS/);       // 沒帶 owner → 以「owner 扣掉舊關注人」復原手動執行人
    expect(o.text).toMatch(/tasks\.watchers/);  // 舊關注人
    expect(o.values).toContain('幸真');          // 新關注人
  });

  it('updateTask({watchers:""})：清空 → 寫 null、owner 同步重算', async () => {
    await T.updateTask(TASK, { watchers: '' });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.watchers).toBeNull();
    expect(upd.__set.owner.values).toEqual([null]);
  });

  it('updateTask({watchers})：未知使用者 → 回錯誤、不寫入', async () => {
    selectRows = [];
    const res = await T.updateTask(TASK, { watchers: 'Ghost' });
    expect(res.error).toMatch(/Ghost/);
    expect(direct.some(d => d.__op === 'update')).toBe(false);
  });

  it('updateTask({watchers})：有子任務 owner 時照樣驗證關注人（關注人不會被忽略）', async () => {
    selectRows = [{ taskId: TASK, owner: 'Amy' }]; // users 查詢也回這份 → 查無 Ghost
    const res = await T.updateTask(TASK, { watchers: 'Ghost' });
    expect(res.error).toMatch(/Ghost/);
  });

  it('updateTask({owner}) 沒帶 watchers → 重算時沿用資料庫的 tasks.watchers，不會把關注人蓋掉', async () => {
    selectRows = [{ name: 'Amy' }];
    await T.updateTask(TASK, { owner: 'Amy' });
    const upd = direct.find(d => d.__op === 'update');
    expect('watchers' in upd.__set).toBe(false);
    expect(upd.__set.owner.text).toMatch(/tasks\.watchers/);
  });

  it('updateTask({owner, watchers}) 同時帶 → 用新的關注人值重算', async () => {
    selectRows = [{ name: 'Amy' }];
    await T.updateTask(TASK, { owner: 'Amy', watchers: 'Amy' });
    const upd = direct.find(d => d.__op === 'update');
    expect(upd.__set.watchers).toBe('Amy');
    expect(upd.__set.owner.values).toEqual(['Amy', 'Amy', 'Amy']); // 手動執行人 ×2（缺席值 / fallback）+ 新關注人
  });

  describe('createTask', () => {
    // 這個 fake 的 insert().returning() 不是 thenable（給 batch 用）→ 這裡換成回傳插入值的版本
    let origInsert;
    beforeEach(() => {
      origInsert = db.insert;
      db.insert = () => ({ values: (v) => ({ returning: () => Promise.resolve([{ id: 'new-task', ...v }]) }) });
    });
    afterEach(() => { db.insert = origInsert; });

    it('關注人驗證後寫入，owner = 執行人 ∪ 關注人', async () => {
      selectRows = [{ id: PROJ, name: 'Amy' }, { id: PROJ, name: '幸真' }];
      const res = await T.createTask({ projectId: PROJ, task: 'T', owner: 'Amy', watchers: '幸真' });
      expect(res.success).toBe(true);
      expect(res.task.watchers).toBe('幸真');
      expect(res.task.owner).toBe('Amy,幸真');
    });

    it('只有關注人、owner 是 "—" → owner = 關注人', async () => {
      selectRows = [{ id: PROJ, name: '幸真' }];
      const res = await T.createTask({ projectId: PROJ, task: 'T', watchers: '幸真' });
      expect(res.task.owner).toBe('幸真');
    });

    it('沒有關注人 → owner 照舊、watchers null', async () => {
      selectRows = [{ id: PROJ, name: 'Amy' }];
      const res = await T.createTask({ projectId: PROJ, task: 'T', owner: 'Amy' });
      expect(res.task.owner).toBe('Amy');
      expect(res.task.watchers).toBeNull();
    });

    it('關注人不存在 → 錯誤', async () => {
      selectRows = [{ id: PROJ }];
      const res = await T.createTask({ projectId: PROJ, task: 'T', watchers: 'Ghost' });
      expect(res.error).toMatch(/Ghost/);
    });
  });

  it('updateManyTasks 不碰 watchers（即使傳入），owner 重算沿用 tasks.watchers', async () => {
    selectRows = [{ name: 'Amy' }];
    await T.updateManyTasks([TASK], { owner: 'Amy', watchers: 'X' });
    const upd = direct.find(d => d.__op === 'update');
    expect('watchers' in upd.__set).toBe(false);
    expect(upd.__set.owner.text).toMatch(/tasks\.watchers/);
  });

  it('CSV 匯入覆寫既有任務：不帶 watchers 欄位、owner 沿用 tasks.watchers', async () => {
    selectRows = [{ id: TASK, name: 'P', sortOrder: 1 }];
    await T.upsertTasks([{ project: 'P', task: 'T', owner: 'Zed' }]);
    const upd = direct.find(d => d.__op === 'update');
    expect('watchers' in upd.__set).toBe(false);
    expect(upd.__set.owner.text).toMatch(/tasks\.watchers/);
  });
});
