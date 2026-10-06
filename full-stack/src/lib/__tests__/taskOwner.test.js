import { describe, it, expect } from 'vitest';
import { deriveTaskOwner, hasSubOwners, planOwnerBackfill } from '@/lib/taskOwner';
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
    expect(plan[0]).toEqual({ id: 't1', task: 'A 任務', from: null, to: 'Amy' });
    expect(plan[1]).toEqual({ id: 't2', task: 'B 任務', from: 'Zed', to: 'Bob' });
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
