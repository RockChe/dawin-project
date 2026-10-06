import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// 專案封存（projects.archived_at，全團隊共享）：樂觀更新 projects[].archivedAt，伺服器拒絕時只回復該專案。

const archiveAction = vi.fn(async () => ({ success: true }));
const unarchiveAction = vi.fn(async () => ({ success: true }));
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/server/actions/tasks', () => ({}));
vi.mock('@/server/actions/projects', () => ({
  createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), reorderProjects: vi.fn(),
  archiveProject: (...a) => archiveAction(...a),
  unarchiveProject: (...a) => unarchiveAction(...a),
}));
vi.mock('@/server/actions/config', () => ({ saveConfig: vi.fn(async () => ({ success: true })) }));
vi.mock('@/server/actions/dashboard', () => ({ getInitialData: vi.fn(async () => ({})) }));

const { default: useTaskManager } = await import('@/hooks/useTaskManager');

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '33333333-3333-4333-8333-333333333333';
const ARCHIVED_AT = '2026-10-01T00:00:00.000Z';

const makeData = () => ({
  projects: [
    { id: P1, name: 'P1', sortOrder: 1, archivedAt: null },
    { id: P2, name: 'P2', sortOrder: 2, archivedAt: ARCHIVED_AT },
  ],
  tasks: [], subtasks: [], links: [], files: [],
  session: { role: 'admin' }, userNames: [],
});

const setup = () => { const data = makeData(); return renderHook(() => useTaskManager(data)); };
const byId = (r, id) => r.current.projects.find(p => p.id === id);

beforeEach(() => {
  vi.clearAllMocks();
  archiveAction.mockResolvedValue({ success: true });
  unarchiveAction.mockResolvedValue({ success: true });
  try { sessionStorage.clear(); } catch {}
});

describe('archiveProject', () => {
  it('樂觀更新：呼叫後 archivedAt 立即有值，並以專案 id 呼叫 server action', async () => {
    const { result } = setup();
    await act(async () => { await result.current.archiveProject(P1); });
    expect(archiveAction).toHaveBeenCalledWith(P1);
    expect(byId(result, P1).archivedAt).toBeTruthy();
    expect(byId(result, P2).archivedAt).toBe(ARCHIVED_AT); // 其他專案不受影響
  });

  it('伺服器回 error → 只回復該專案的 archivedAt，並 toast 錯誤', async () => {
    archiveAction.mockResolvedValueOnce({ error: '封存失敗' });
    const { result } = setup();
    await act(async () => { await result.current.archiveProject(P1); });
    expect(byId(result, P1).archivedAt).toBeNull();
    expect(byId(result, P2).archivedAt).toBe(ARCHIVED_AT);
    expect(result.current.toast).toMatchObject({ msg: '封存失敗', type: 'error' });
  });

  it('FORBIDDEN → 回復並走 useForbiddenHandler（router.refresh）', async () => {
    archiveAction.mockResolvedValueOnce({ error: 'FORBIDDEN' });
    const { result } = setup();
    await act(async () => { await result.current.archiveProject(P1); });
    expect(byId(result, P1).archivedAt).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });
});

describe('unarchiveProject', () => {
  it('樂觀更新：archivedAt 立即清成 null', async () => {
    const { result } = setup();
    await act(async () => { await result.current.unarchiveProject(P2); });
    expect(unarchiveAction).toHaveBeenCalledWith(P2);
    expect(byId(result, P2).archivedAt).toBeNull();
  });

  it('伺服器回 error → 回復原本的 archivedAt', async () => {
    unarchiveAction.mockResolvedValueOnce({ error: '還原失敗' });
    const { result } = setup();
    await act(async () => { await result.current.unarchiveProject(P2); });
    expect(byId(result, P2).archivedAt).toBe(ARCHIVED_AT);
    expect(result.current.toast).toMatchObject({ msg: '還原失敗', type: 'error' });
  });
});
