/**
 * TDD tests for userSettings server actions.
 *
 * Strategy: in-memory fake store keyed by userId so set→get round-trips
 * realistically, testing behavioral contracts rather than call spying.
 *
 * The drizzle chained-builder (db.select().from().where().limit()) is faked
 * with a small fluent-builder stub that resolves against the in-memory store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory store shared across mock calls ──────────────────────────────
// rows: Array<{ id, userId, key, value, updatedAt }>
let store = [];
let idCounter = 0;

function makeId() {
  return `fake-id-${++idCounter}`;
}

// ── Drizzle chained-builder fake ──────────────────────────────────────────
// Supports:
//   db.select({...}).from(table).where(cond) → Promise<rows>
//   db.select({...}).from(table).where(cond).limit(n) → Promise<rows>
//   db.insert(table).values(data) → Promise<void>  (bare insert)
//   db.insert(table).values(data).onConflictDoUpdate({ target, set }) → upsert
//   db.update(table).set(data).where(cond) → Promise<void>  (kept for assertions)
//
// where() accepts a function (predicate) built by our eq/and helpers.
// The helpers are exported from the mock so the actions can import them.

// Push a fresh row into the store (used by bare insert + upsert-insert path).
function insertRow(data) {
  store.push({
    id: data.id ?? makeId(),
    userId: data.userId,
    key: data.key,
    value: data.value,
    updatedAt: data.updatedAt ?? new Date(),
  });
}

// Emulate ON CONFLICT (userId, key) DO UPDATE: if a row with the same
// (userId, key) exists, apply `set` to it; otherwise insert a new row.
function upsertRow(data, { target, set }) {
  // target is an array of column-key strings, e.g. ['userId', 'key']
  const idx = store.findIndex((row) => target.every((col) => row[col] === data[col]));
  if (idx >= 0) {
    store[idx] = { ...store[idx], ...set };
  } else {
    insertRow(data);
  }
  return Promise.resolve();
}

function makeValuesBuilder(data) {
  // The thenable lets a bare `await db.insert(t).values(d)` resolve (no conflict
  // clause), while `.onConflictDoUpdate(...)` drives the upsert path.
  const builder = {
    onConflictDoUpdate: vi.fn((opts) => upsertRow(data, opts)),
    then: (resolve, reject) => {
      try {
        insertRow(data);
        return Promise.resolve().then(resolve, reject);
      } catch (err) {
        return Promise.reject(err).then(resolve, reject);
      }
    },
  };
  return builder;
}

const mockDb = {
  select: vi.fn((_fields) => ({
    from: vi.fn((_table) => ({
      where: vi.fn((predFn) => {
        const filteredRows = store.filter(predFn);
        // Return both the array AND .limit() on it
        const result = Object.assign(Promise.resolve(filteredRows), {
          limit: vi.fn((n) => Promise.resolve(filteredRows.slice(0, n))),
        });
        return result;
      }),
    })),
  })),

  insert: vi.fn((_table) => ({
    values: vi.fn((data) => makeValuesBuilder(data)),
  })),

  update: vi.fn((_table) => ({
    set: vi.fn((data) => ({
      where: vi.fn((predFn) => {
        store = store.map((row) => (predFn(row) ? { ...row, ...data } : row));
        return Promise.resolve();
      }),
    })),
  })),
};

// ── Predicate helpers (mirrors drizzle eq/and shape) ──────────────────────
// Instead of mocking the real drizzle operators we provide simple
// function-based predicates that work against plain JS objects.

function eq(field, value) {
  // field is a string key name extracted from the drizzle column proxy
  // We encode the field name as a tagged function for the fake predicates
  return (row) => row[field] === value;
}

function and(...preds) {
  return (row) => preds.every((p) => p(row));
}

// ── Column proxy helpers ──────────────────────────────────────────────────
// The action imports column refs like `userSettings.userId`.
// We provide column proxies that carry the row-key string so our eq() above
// can look up the right field in the in-memory store.
const colProxy = (key) => key; // just the string key

const userSettingsMock = {
  id: colProxy('id'),
  userId: colProxy('userId'),
  key: colProxy('key'),
  value: colProxy('value'),
  updatedAt: colProxy('updatedAt'),
};

// ── vi.mock declarations ──────────────────────────────────────────────────
vi.mock('@/server/db', () => ({ db: mockDb }));

vi.mock('@/server/db/schema', () => ({
  userSettings: userSettingsMock,
}));

vi.mock('drizzle-orm', () => ({ eq, and }));

// safeRequireAuth is controlled per-test via mockReturnValue
const mockSafeRequireAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ safeRequireAuth: mockSafeRequireAuth }));

// ── Import under test (after mocks are set up) ────────────────────────────
const { getUserSettings, setUserSetting } = await import('@/server/actions/userSettings');

// ── Helpers ───────────────────────────────────────────────────────────────
function authAs(userId) {
  mockSafeRequireAuth.mockResolvedValue({ session: { userId }, error: null });
}

function noAuth() {
  mockSafeRequireAuth.mockResolvedValue({ session: null, error: 'UNAUTHORIZED' });
}

// ── Tests ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  // Only reset the in-memory store + id counter + call history.
  // vi.clearAllMocks() clears call history but NOT mockImplementation, so the
  // module-level db fake implementations above remain in effect.
  store = [];
  idCounter = 0;
  vi.clearAllMocks();
});

// ── 1. set→get round-trip ─────────────────────────────────────────────────
describe('set→get round-trip', () => {
  it('after setUserSetting zoom=150, getUserSettings returns { zoom: 150 }', async () => {
    authAs('user-A');
    await setUserSetting('zoom', 150);

    authAs('user-A');
    const res = await getUserSettings();

    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ zoom: 150 });
  });
});

// ── 2. Upsert — same key, no new row ─────────────────────────────────────
describe('upsert on second setUserSetting', () => {
  it('second set on same key updates value without adding a row', async () => {
    authAs('user-A');
    await setUserSetting('zoom', 100);
    expect(store).toHaveLength(1);

    authAs('user-A');
    await setUserSetting('zoom', 200);

    // Still exactly one row
    expect(store).toHaveLength(1);
    // Value is updated
    expect(JSON.parse(store[0].value)).toBe(200);
  });
});

// ── 3. Unauthorized — both actions refuse and never touch db ──────────────
describe('unauthorized', () => {
  it('getUserSettings returns { error: UNAUTHORIZED } when not logged in', async () => {
    noAuth();
    const res = await getUserSettings();
    expect(res).toEqual({ error: 'UNAUTHORIZED' });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('setUserSetting returns { error: UNAUTHORIZED } when not logged in', async () => {
    noAuth();
    const res = await setUserSetting('zoom', 150);
    expect(res).toEqual({ error: 'UNAUTHORIZED' });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ── 4. Per-user isolation ─────────────────────────────────────────────────
describe('per-user isolation', () => {
  it("getUserSettings for user A does not return user B's rows", async () => {
    // Seed user B's row directly
    store.push({ id: makeId(), userId: 'user-B', key: 'zoom', value: '999', updatedAt: new Date() });

    authAs('user-A');
    const res = await getUserSettings();

    expect(res.success).toBe(true);
    expect(res.data).not.toHaveProperty('zoom');
    expect(Object.keys(res.data)).toHaveLength(0);
  });

  it('user A can set a key that user B already has; each stores separately', async () => {
    authAs('user-B');
    await setUserSetting('theme', 'dark');

    authAs('user-A');
    await setUserSetting('theme', 'light');

    expect(store).toHaveLength(2);

    authAs('user-A');
    const resA = await getUserSettings();
    expect(resA.data.theme).toBe('light');

    authAs('user-B');
    const resB = await getUserSettings();
    expect(resB.data.theme).toBe('dark');
  });
});
