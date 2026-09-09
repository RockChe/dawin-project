/**
 * TDD tests for updateUser 的 role 欄位 + super_admin 保護，以及 deleteUser 的同款保護。
 *
 * Strategy: in-memory fake store（沿用 userSettings.test.js 的作法），但 role 變更走的是
 * 一支自成一體的原子 SQL（WITH ... FOR UPDATE + UPDATE/DELETE ... RETURNING，見 users.js
 * 內的註解與 role-change-report.md），單元測試無法真的驗證 Postgres 鎖語意，所以這裡的
 * db.execute fake 用「鏡射同一組不變量」的 JS 邏輯模擬 DB 的判定結果——
 * 測的是 users.js 拿到 RETURNING 結果之後的分派是否正確，而不是重新證明 SQL 本身的鎖。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory store ────────────────────────────────────────────────────────
let store = [];

function seedUser(u) {
  store.push({ mustChangePassword: false, email: `${u.id}@x.com`, name: u.id, ...u });
}

// ── drizzle-orm fake ────────────────────────────────────────────────────────
function eq(field, value) {
  return (row) => row[field] === value;
}

// production 的 sql`` 樣板：把字面字串留下來判斷這次呼叫是 UPDATE（role 變更）還是
// DELETE（刪除）；sql.raw() 包的片段（守護條件文字）併回字面字串，不算進 values，
// 這樣 values 才會單純是「真正的參數」（UPDATE: [role, userId]；DELETE: [userId]），
// 跟 users.js 裡兩支語句的寫法對齊。
function raw(text) {
  return { __raw: text };
}
function sql(strings, ...items) {
  let text = strings[0];
  const values = [];
  items.forEach((item, i) => {
    if (item && item.__raw !== undefined) {
      text += item.__raw;
    } else {
      values.push(item);
      text += '?';
    }
    text += strings[i + 1];
  });
  return { text, values };
}
sql.raw = raw;

vi.mock('drizzle-orm', () => ({ eq, sql }));

const usersMock = {
  id: 'id',
  email: 'email',
  name: 'name',
  role: 'role',
  mustChangePassword: 'mustChangePassword',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

vi.mock('@/server/db/schema', () => ({ users: usersMock }));

// db.execute fake：鏡射「目標若是 super_admin，且降級/刪除後 super_admin 會歸零，就擋下」
// 這條不變量。
const mockExecute = vi.fn(async (query) => {
  const isDelete = query.text.includes('DELETE FROM');
  const userId = isDelete ? query.values[0] : query.values[1];
  const target = store.find((u) => u.id === userId);
  if (!target) return { rows: [] };

  if (target.role === 'super_admin') {
    const remaining = store.filter((u) => u.role === 'super_admin').length;
    if (remaining <= 1) return { rows: [] };
  }

  if (isDelete) {
    store = store.filter((u) => u.id !== userId);
    return { rows: [{ id: target.id, email: target.email }] };
  }

  const newRole = query.values[0];
  target.role = newRole;
  target.updatedAt = new Date();
  return { rows: [{ id: target.id, role: target.role }] };
});

const mockUpdate = vi.fn((_table) => ({
  set: vi.fn((data) => ({
    where: vi.fn((predFn) => {
      store = store.map((row) => (predFn(row) ? { ...row, ...data } : row));
      return Promise.resolve();
    }),
  })),
}));

const mockDb = { execute: mockExecute, update: mockUpdate };
vi.mock('@/server/db', () => ({ db: mockDb }));

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null } : { session: null, error: 'UNAUTHORIZED' },
}));

const { updateUser, deleteUser } = await import('@/server/actions/users');

const SA1 = '11111111-1111-1111-1111-111111111111';
const SA2 = '22222222-2222-2222-2222-222222222222';
const ADMIN1 = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  store = [];
  currentSession = null;
  vi.clearAllMocks();
});

function asSuperAdmin(userId) {
  currentSession = { userId, role: 'super_admin' };
}

describe('updateUser：role 變更', () => {
  it('super_admin 可以把 admin 改成 viewer', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: ADMIN1, role: 'admin' });
    asSuperAdmin(SA1);

    const res = await updateUser(ADMIN1, { role: 'viewer' });

    expect(res).toEqual({ success: true });
    expect(store.find((u) => u.id === ADMIN1).role).toBe('viewer');
  });

  it('不能變更自己的角色 → 回錯誤', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: SA2, role: 'super_admin' });
    asSuperAdmin(SA1);

    const res = await updateUser(SA1, { role: 'admin' });

    expect(res).toEqual({ error: '不能變更自己的角色' });
    expect(store.find((u) => u.id === SA1).role).toBe('super_admin');
  });

  it('降掉最後一個 super_admin → 回錯誤', async () => {
    // SA1 是僅存的 super_admin；ADMIN1 是另一個有 manage 權限的操作者（情境上假設它
    // 曾是 super_admin、剛被降級，藉此避開「不能改自己」的分支，單純測最後一人保護）
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: ADMIN1, role: 'admin' });
    currentSession = { userId: ADMIN1, role: 'super_admin' };

    const res = await updateUser(SA1, { role: 'viewer' });

    expect(res).toEqual({ error: '系統必須至少保留一個 Super Admin' });
    expect(store.find((u) => u.id === SA1).role).toBe('super_admin');
  });

  it('還有兩個 super_admin 時，降掉其中一個 → 成功', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: SA2, role: 'super_admin' });
    asSuperAdmin(SA1);

    const res = await updateUser(SA2, { role: 'admin' });

    expect(res).toEqual({ success: true });
    expect(store.find((u) => u.id === SA2).role).toBe('admin');
  });

  it('無效角色（不在 ROLES 裡）→ 回錯誤', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: ADMIN1, role: 'admin' });
    asSuperAdmin(SA1);

    const res = await updateUser(ADMIN1, { role: 'god_mode' });

    expect(res).toEqual({ error: '無效的角色: god_mode' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('admin 呼叫 updateUser → FORBIDDEN（這支是 manage）', async () => {
    seedUser({ id: ADMIN1, role: 'admin' });
    currentSession = { userId: ADMIN1, role: 'admin' };

    const res = await updateUser(ADMIN1, { role: 'viewer' });

    expect(res).toEqual({ error: 'FORBIDDEN' });
  });

  it('viewer 呼叫 updateUser → FORBIDDEN', async () => {
    const VIEWER1 = '55555555-5555-5555-5555-555555555555';
    seedUser({ id: VIEWER1, role: 'viewer' });
    currentSession = { userId: VIEWER1, role: 'viewer' };

    const res = await updateUser(ADMIN1, { role: 'admin' });

    expect(res).toEqual({ error: 'FORBIDDEN' });
  });
});

describe('deleteUser：super_admin 保護', () => {
  it('刪掉最後一個 super_admin → 回錯誤', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    const OTHER = '66666666-6666-6666-6666-666666666666';
    seedUser({ id: OTHER, role: 'admin' });
    currentSession = { userId: OTHER, role: 'super_admin' }; // 假設 OTHER 也有 manage 權限（角色僅供測試情境）

    const res = await deleteUser(SA1);

    expect(res).toEqual({ error: '系統必須至少保留一個 Super Admin' });
    expect(store.find((u) => u.id === SA1)).toBeTruthy();
  });

  it('還有兩個 super_admin 時，刪掉其中一個 → 成功', async () => {
    seedUser({ id: SA1, role: 'super_admin' });
    seedUser({ id: SA2, role: 'super_admin' });
    asSuperAdmin(SA1);

    const res = await deleteUser(SA2);

    expect(res).toEqual({ success: true });
    expect(store.find((u) => u.id === SA2)).toBeFalsy();
  });
});
