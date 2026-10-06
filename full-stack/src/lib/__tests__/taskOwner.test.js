import { describe, it, expect } from 'vitest';
import { deriveTaskOwner, hasSubOwners, planOwnerBackfill, execTokens, watcherTokens, subOwnerTokens, taskRole } from '@/lib/taskOwner';
import { isMine, groupMyTasks } from '@/lib/myTasks';

const sub = (owner, sortOrder = 0, extra = {}) => ({ owner, sortOrder, ...extra });

describe('deriveTaskOwner', () => {
  it('依子任務 sortOrder 收集，同名只留第一次出現，以 "," 串接（跟 TagInput 存法一致）', () => {
    const subs = [sub('Bob', 2), sub('Amy', 1), sub('Bob,Cat', 3), sub('Amy', 4)];
    expect(deriveTaskOwner(subs, 'Zed')).toBe('Amy,Bob,Cat');
  });

  it('子任務的多人欄位逐 token 拆開：空白、尾逗號、空 token 都丟掉', () => {
    expect(deriveTaskOwner([sub(' Amy , ,Bob, ')], null)).toBe('Amy,Bob');
    expect(deriveTaskOwner([sub('Amy,'), sub(',Bob')], null)).toBe('Amy,Bob');
  });

  it('"—"（TagInput 清空時的佔位）不算負責人', () => {
    expect(deriveTaskOwner([sub('—'), sub('Amy')], null)).toBe('Amy');
    expect(deriveTaskOwner([sub('—')], '手動')).toBe('手動');
  });

  it('沒有任何子任務有 owner → 原樣回傳手動 owner（含 null / 空字串）', () => {
    expect(deriveTaskOwner([], 'Zed')).toBe('Zed');
    expect(deriveTaskOwner([sub(null), sub(''), sub('  ,  ')], 'Zed')).toBe('Zed');
    expect(deriveTaskOwner([], null)).toBe(null);
    expect(deriveTaskOwner(undefined, '')).toBe('');
  });

  it('子任務有 owner 時一律蓋過手動 owner', () => {
    expect(deriveTaskOwner([sub('Amy')], 'Zed')).toBe('Amy');
  });

  it('sortOrder 相同 → 看 createdAt，再相同 → 保持輸入順序（穩定）', () => {
    const subs = [
      sub('C', 0, { createdAt: '2026-01-03' }),
      sub('A', 0, { createdAt: '2026-01-01' }),
      sub('B', 0, { createdAt: '2026-01-02' }),
      sub('D', 0, { createdAt: '2026-01-02' }),
    ];
    expect(deriveTaskOwner(subs, null)).toBe('A,B,D,C');
  });

  it('不會改動傳入陣列的順序', () => {
    const subs = [sub('B', 2), sub('A', 1)];
    deriveTaskOwner(subs, null);
    expect(subs.map(s => s.owner)).toEqual(['B', 'A']);
  });
});

describe('hasSubOwners', () => {
  it('只要有一個子任務含非空 token 就是 true', () => {
    expect(hasSubOwners([sub(null), sub('Amy')])).toBe(true);
    expect(hasSubOwners([sub(null), sub('—'), sub(' , ')])).toBe(false);
    expect(hasSubOwners([])).toBe(false);
    expect(hasSubOwners(undefined)).toBe(false);
  });
});

describe('planOwnerBackfill', () => {
  const tasks = [
    { id: 't1', task: 'A 任務', owner: null },
    { id: 't2', task: 'B 任務', owner: 'Zed' },
    { id: 't3', task: 'C 任務', owner: 'Amy,Bob' },
    { id: 't4', task: 'D 任務', owner: 'Bob, Amy' },
    { id: 't5', task: 'E 任務', owner: 'Manual' },
  ];
  const subs = [
    { taskId: 't1', owner: 'Amy', sortOrder: 1 },
    { taskId: 't2', owner: 'Bob', sortOrder: 1 },
    { taskId: 't3', owner: 'Amy', sortOrder: 1 },
    { taskId: 't3', owner: 'Bob', sortOrder: 2 },
    { taskId: 't4', owner: 'Amy', sortOrder: 1 },
    { taskId: 't4', owner: 'Bob', sortOrder: 2 },
    { taskId: 't5', owner: null, sortOrder: 1 },
  ];

  it('只回報推得值跟現值不同的任務（from/to 都給）', () => {
    const plan = planOwnerBackfill(tasks, subs);
    expect(plan.map(p => p.id)).toEqual(['t1', 't2', 't4']);
    expect(plan[0]).toMatchObject({ id: 't1', task: 'A 任務', from: null, to: 'Amy' });
    expect(plan[1]).toMatchObject({ id: 't2', task: 'B 任務', from: 'Zed', to: 'Bob,Zed', toWatchers: 'Zed' }); // Zed 被擠掉 → 關注人
  });

  it('名單與順序相同、只是分隔空白不同（"Amy, Bob" vs "Amy,Bob"）→ 不算差異', () => {
    const plan = planOwnerBackfill(
      [{ id: 'x', task: 'X', owner: 'Amy, Bob' }],
      [{ taskId: 'x', owner: 'Amy', sortOrder: 1 }, { taskId: 'x', owner: 'Bob', sortOrder: 2 }],
    );
    expect(plan).toEqual([]);
  });

  it('順序不同算差異（t4: "Bob, Amy" → "Amy,Bob"）', () => {
    expect(planOwnerBackfill(tasks, subs).find(p => p.id === 't4').to).toBe('Amy,Bob');
  });

  it('沒有子任務 owner 的任務（手動 owner）完全不動', () => {
    expect(planOwnerBackfill(tasks, subs).some(p => p.id === 't5')).toBe(false);
  });
});

describe('deriveTaskOwner 加上關注人（owner = 執行人 ∪ 關注人，執行人在前）', () => {
  it('子任務有 owner：推得執行人 + 關注人（去重，關注人排後面）', () => {
    expect(deriveTaskOwner([sub('Felien')], 'Zed', '幸真')).toBe('Felien,幸真');
    expect(deriveTaskOwner([sub('Amy'), sub('Bob')], null, 'Bob,Cat')).toBe('Amy,Bob,Cat');
  });

  it('沒有子任務 owner：手動 owner 已含關注人 → 原樣不動（含空白格式）', () => {
    expect(deriveTaskOwner([], 'Felien, 幸真', '幸真')).toBe('Felien, 幸真');
    expect(deriveTaskOwner([], 'Zed', null)).toBe('Zed');
  });

  it('沒有子任務 owner：手動 owner 缺關注人 → 補在後面', () => {
    expect(deriveTaskOwner([], 'Zed', '幸真')).toBe('Zed,幸真');
    expect(deriveTaskOwner([], '—', '幸真')).toBe('幸真');
    expect(deriveTaskOwner([], null, '幸真')).toBe('幸真');
  });

  it('關注人參數省略 → 與舊行為完全相同（向下相容）', () => {
    expect(deriveTaskOwner([sub('Amy')], 'Zed')).toBe('Amy');
    expect(deriveTaskOwner([], 'Zed')).toBe('Zed');
  });
});

describe('execTokens / watcherTokens / subOwnerTokens', () => {
  it('有子任務 owner → 執行人 = 子任務聯集（不看手動 owner）', () => {
    expect(execTokens({ owner: 'Zed,幸真', watchers: '幸真' }, [sub('Felien')])).toEqual(['Felien']);
  });

  it('沒有子任務 owner → 執行人 = owner 去掉關注人（復原手動執行人）', () => {
    expect(execTokens({ owner: 'Zed,幸真', watchers: '幸真' }, [])).toEqual(['Zed']);
    expect(execTokens({ owner: '幸真', watchers: '幸真' }, [])).toEqual([]);
    expect(execTokens({ owner: 'Amy, Bob', watchers: null }, undefined)).toEqual(['Amy', 'Bob']);
    expect(execTokens({ owner: '—', watchers: null }, [])).toEqual([]);
  });

  it('watcherTokens 忽略空白與 "—"', () => {
    expect(watcherTokens({ watchers: ' A , ,—,B ' })).toEqual(['A', 'B']);
    expect(watcherTokens({ watchers: null })).toEqual([]);
    expect(watcherTokens({})).toEqual([]);
  });

  it('subOwnerTokens = 子任務聯集 token 陣列（沒有 → []）', () => {
    expect(subOwnerTokens([sub('B', 2), sub('A', 1)])).toEqual(['A', 'B']);
    expect(subOwnerTokens([sub(null)])).toEqual([]);
  });
});

describe('taskRole（我的任務身分徽章）', () => {
  it('關注人且不是執行人 → watcher', () => {
    expect(taskRole({ owner: 'Felien,幸真', watchers: '幸真' }, [sub('Felien')], '幸真')).toBe('watcher');
  });
  it('透過子任務執行 → executor；同時是關注人也算 executor', () => {
    expect(taskRole({ owner: 'Felien', watchers: null }, [sub('Felien')], 'Felien')).toBe('executor');
    expect(taskRole({ owner: 'Felien', watchers: 'Felien' }, [sub('Felien')], 'Felien')).toBe('executor');
  });
  it('單純任務 owner（沒有子任務 owner、不是關注人）→ null', () => {
    expect(taskRole({ owner: 'Amy', watchers: null }, [], 'Amy')).toBeNull();
    expect(taskRole({ owner: 'Amy', watchers: null }, [sub('Bob')], 'Cat')).toBeNull();
  });
  it('沒有子任務 owner、只掛關注人 → watcher', () => {
    expect(taskRole({ owner: 'Amy,幸真', watchers: '幸真' }, [], '幸真')).toBe('watcher');
  });
});

describe('planOwnerBackfill（新模型：被擠掉的人 → 關注人）', () => {
  it('現有 owner 有人不在推得執行人裡 → 變關注人（與既有關注人合併），新 owner = 執行人 ∪ 關注人', () => {
    const plan = planOwnerBackfill(
      [{ id: 't', task: "Yaya's Band", owner: '幸真,Felien', watchers: null }],
      [{ taskId: 't', owner: 'Felien', sortOrder: 1 }],
    );
    expect(plan).toEqual([{
      id: 't', task: "Yaya's Band", from: '幸真,Felien', to: 'Felien,幸真',
      fromWatchers: null, toWatchers: '幸真',
    }]);
  });

  it('既有關注人保留並合併；owner 本來就是推得 ∪ 關注人 → 不列入', () => {
    const tasks = [
      { id: 'a', task: 'A', owner: 'Zed', watchers: 'W' },
      { id: 'b', task: 'B', owner: 'Amy,W', watchers: 'W' },
    ];
    const subs = [{ taskId: 'a', owner: 'Amy', sortOrder: 1 }, { taskId: 'b', owner: 'Amy', sortOrder: 1 }];
    const plan = planOwnerBackfill(tasks, subs);
    expect(plan.map(p => p.id)).toEqual(['a']);
    expect(plan[0]).toMatchObject({ to: 'Amy,W,Zed', toWatchers: 'W,Zed' });
  });

  it('owner 空（沒有人被擠掉）→ 只改 owner，toWatchers 維持原值', () => {
    const plan = planOwnerBackfill([{ id: 'x', task: 'X', owner: null, watchers: null }], [{ taskId: 'x', owner: 'Cat', sortOrder: 1 }]);
    expect(plan[0]).toMatchObject({ from: null, to: 'Cat', fromWatchers: null, toWatchers: null });
  });

  it('沒有子任務 owner 的任務不動；watchers 欄位缺（undefined）視同 null', () => {
    expect(planOwnerBackfill([{ id: 'x', task: 'X', owner: 'Manual' }], [])).toEqual([]);
  });
});

describe('跟「我的任務」(lib/myTasks) 相容', () => {
  it('推得的 "Amy,Bob" 讓每個子任務負責人都在 isMine / groupMyTasks 看到這個任務', () => {
    const owner = deriveTaskOwner([sub('Amy', 1), sub('Bob', 2)], null);
    const task = { id: 't', owner, status: '進行中', end: '2026-10-08' };
    expect(isMine(task, 'Amy')).toBe(true);
    expect(isMine(task, 'Bob')).toBe(true);
    expect(isMine(task, 'Cat')).toBe(false);
    expect(groupMyTasks([task], 'Bob', '2026-10-06').soon).toHaveLength(1);
  });
});
