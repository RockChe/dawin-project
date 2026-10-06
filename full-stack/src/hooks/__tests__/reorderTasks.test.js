import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { moveWithinOrder } from '@/hooks/reorderProjects';

// ── 純函式：沿用「畫面上看到的順序」，不重新依 sortOrder 排序 ──
const I = (id, sortOrder = 0) => ({ id, sortOrder });

describe('moveWithinOrder', () => {
  it('依傳入順序搬移（不重排），並把 sortOrder 重編成 1..N', () => {
    // 傳入順序 c,a,b 與 sortOrder 無關——畫面順序才是基準
    const plan = moveWithinOrder([I('c', 9), I('a', 1), I('b', 5)], 'c', 'b');
    expect(plan.orderedIds).toEqual(['a', 'b', 'c']);
    expect(plan.optimistic.map(x => [x.id, x.sortOrder])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('未知 id → null（no-op）', () => {
    expect(moveWithinOrder([I('a'), I('b')], 'a', 'zzz')).toBe(null);
    expect(moveWithinOrder([I('a'), I('b')], 'zzz', 'a')).toBe(null);
  });

  it('不改動輸入陣列', () => {
    const src = [I('a'), I('b'), I('c')];
    moveWithinOrder(src, 'a', 'c');
    expect(src.map(x => x.id)).toEqual(['a', 'b', 'c']);
  });
});

// ── hook：樂觀更新 + 失敗 rollback ──
const reorderTasksAction = vi.fn(async () => ({ success: true }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/tasks', () => ({
  createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), createSubtask: vi.fn(),
  updateSubtask: vi.fn(), deleteSubtask: vi.fn(), toggleSubtask: vi.fn(), createLink: vi.fn(),
  deleteLink: vi.fn(), deleteFile: vi.fn(), upsertTasks: vi.fn(), updateManyTasks: vi.fn(),
  deleteManyTasks: vi.fn(), deleteAllTasks: vi.fn(),
  reorderTasks: (...a) => reorderTasksAction(...a),
}));
vi.mock('@/server/actions/projects', () => ({
  createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), reorderProjects: vi.fn(),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '33333333-3333-4333-8333-333333333333';
const [A, B, C, D] = ['a1', 'b2', 'c3', 'd4'];
const tk = (id, projectId, sortOrder) => ({ id, projectId, task: id, status: '待辦', startDate: '2026-08-01', endDate: '2026-08-10', duration: 9, owner: null, priority: '中', notes: null, sortOrder });
const makeData = () => ({
  projects: [{ id: P1, name: 'P1', sortOrder: 1 }, { id: P2, name: 'P2', sortOrder: 2 }],
  tasks: [tk(A, P1, 1), tk(B, P1, 2), tk(C, P1, 3), tk(D, P2, 1)],
  subtasks: [], links: [], files: [], session: { role: 'admin' }, userNames: [],
});
// initialData 必須是穩定參照（見 optimisticRollback.test.js 的 NOTE）
const setup = () => { const data = makeData(); return renderHook(() => useTaskManager(data)); };
const orderOf = (r, pid) => r.current.allT.filter(t => t.projectId === pid).sort((x, y) => x.sortOrder - y.sortOrder).map(t => t.id);

beforeEach(() => {
  vi.clearAllMocks();
  reorderTasksAction.mockResolvedValue({ success: true });
  try { sessionStorage.clear(); } catch {}
});

describe('useTaskManager.reorderTasks', () => {
  it('樂觀更新該專案 sortOrder，並以新順序呼叫 server action；其他專案不動', async () => {
    const { result } = setup();
    await act(async () => { await result.current.reorderTasks(P1, A, C); });
    expect(reorderTasksAction).toHaveBeenCalledWith(P1, [B, C, A]);
    expect(orderOf(result, P1)).toEqual([B, C, A]);
    expect(result.current.allT.find(t => t.id === D).sortOrder).toBe(1);
  });

  it('有傳 baseOrderIds（畫面顯示順序）時以它為基準，而非 sortOrder', async () => {
    const { result } = setup();
    // 畫面（例如依開始日排序）顯示 C,B,A；把 C 拖到 A 的位置 → B,A,C
    await act(async () => { await result.current.reorderTasks(P1, C, A, [C, B, A]); });
    expect(reorderTasksAction).toHaveBeenCalledWith(P1, [B, A, C]);
    expect(orderOf(result, P1)).toEqual([B, A, C]);
  });

  it('server 回錯誤 → rollback 回原 sortOrder', async () => {
    reorderTasksAction.mockResolvedValueOnce({ error: '重新排序失敗' });
    const { result } = setup();
    await act(async () => { await result.current.reorderTasks(P1, A, C); });
    expect(orderOf(result, P1)).toEqual([A, B, C]);
    expect(result.current.allT.find(t => t.id === A).sortOrder).toBe(1);
  });

  it('未知 id → no-op，不呼叫 server', async () => {
    const { result } = setup();
    await act(async () => { await result.current.reorderTasks(P1, A, 'nope'); });
    expect(reorderTasksAction).not.toHaveBeenCalled();
  });
});
