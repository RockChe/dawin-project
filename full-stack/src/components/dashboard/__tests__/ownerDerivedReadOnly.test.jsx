/**
 * tasks.owner 由子任務 owner 自動帶出：任一子任務有 owner → 任務的負責人欄唯讀、顯示「由子任務自動帶出」，
 * 沒有子任務 owner 的任務維持可手動編輯。涵蓋 TaskModal 與 DataTab（含鍵盤格編輯）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import TaskModal from '@/components/dashboard/TaskModal';
import DataTab from '@/components/dashboard/tabs/DataTab';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const HINT = '由子任務自動帶出';
const wrap = (role, ui) => render(<ThemeProvider><PermissionProvider role={role}>{ui}</PermissionProvider></ThemeProvider>);

const LOCKED = { id: 't1', projectId: 'p1', task: 'Locked', status: '待辦', priority: '中', category: '活動', startDate: '2026-08-01', endDate: '2026-08-10', owner: 'Stale', notes: null };
const FREE = { id: 't2', projectId: 'p1', task: 'Free', status: '待辦', priority: '中', category: '活動', startDate: '2026-08-01', endDate: '2026-08-10', owner: 'Manual', notes: null };
const SUBS = [
  { id: 's1', taskId: 't1', name: 'S1', owner: 'Amy', done: false, sortOrder: 1 },
  { id: 's2', taskId: 't1', name: 'S2', owner: 'Bob', done: false, sortOrder: 2 },
  { id: 's3', taskId: 't2', name: 'S3', owner: null, done: false, sortOrder: 1 },
];

function modalProps(task, allS, over = {}) {
  return {
    task, projectId: 'p1', projectName: 'P1', onClose: () => {},
    addTask: async () => ({ success: true }), updateTask: vi.fn(async () => {}),
    allS, addSub: async () => {}, deleteSub: async () => {}, toggleSub: async () => {}, updateSub: async () => {},
    configCats: ['活動'], configOwners: ['Amy', 'Bob'], reorderSubs: () => {},
    allL: [], allF: [], addLink: async () => {}, addFile: () => {}, deleteLink: async () => {}, deleteFile: async () => {},
    showToast: () => {}, ...over,
  };
}

describe('TaskModal 負責人欄', () => {
  it('子任務有 owner → 沒有 TagInput，顯示推得值（不是過期的 task.owner）＋提示', () => {
    wrap('admin', <TaskModal {...modalProps(LOCKED, SUBS)} />);
    expect(screen.queryByPlaceholderText('新增執行人...')).toBeNull();
    expect(screen.getAllByText('Amy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('子任務沒有 owner → 照舊可編輯（有 TagInput、無提示）', () => {
    wrap('admin', <TaskModal {...modalProps({ ...FREE, owner: null }, SUBS)} />);
    expect(screen.getByPlaceholderText('新增執行人...')).toBeTruthy();
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('沒有任何子任務 → 可編輯', () => {
    wrap('admin', <TaskModal {...modalProps({ ...FREE, owner: null }, [])} />);
    expect(screen.getByPlaceholderText('新增執行人...')).toBeTruthy();
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('viewer 看到推得值與提示', () => {
    wrap('viewer', <TaskModal {...modalProps(LOCKED, SUBS)} />);
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.queryByText('Stale')).toBeNull();
  });
});

describe('DataTab 負責人格（桌面表格）', () => {
  function renderTable(updateTask = vi.fn()) {
    const tasks = [LOCKED, FREE].map(t => ({ ...t, start: t.startDate, end: t.endDate, project: 'P1', progress: 0, sDone: 0, sTotal: 1 }));
    const props = {
      filtered: tasks, allS: SUBS, allT: tasks, twp: tasks, projects: [{ id: 'p1', name: 'P1' }],
      updateTask, deleteTask: () => {}, addTask: async () => ({ success: true }),
      toggleSub: () => {}, updateSub: () => {}, addSub: async () => {}, deleteSub: () => {},
      configCats: ['活動'], configOwners: ['Amy', 'Bob'],
      pcMap: { P1: '#123456' },
      importTasks: () => {}, deleteManyTasks: () => {}, updateManyTasks: () => {}, deleteAllTasks: () => {},
      showToast: () => {}, setModalTask: () => {},
    };
    wrap('admin', <DataTab {...props} />);
    return updateTask;
  }
  const grid = () => document.querySelector('[tabindex="-1"][style*="overflow-x"]');

  it('只有有子任務 owner 的那一列標示「由子任務自動帶出」', () => {
    renderTable();
    expect(screen.getAllByTitle(HINT)).toHaveLength(1);
  });

  it('鎖住的格：Enter / 打字不會進入編輯，Delete 不會清空 owner', () => {
    const updateTask = renderTable();
    fireEvent.click(screen.getByTitle(HINT));
    fireEvent.keyDown(grid(), { key: 'Enter' });
    fireEvent.keyDown(grid(), { key: 'x' });
    fireEvent.keyDown(grid(), { key: 'Delete' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('沒鎖的格：Delete 照舊清空 owner', () => {
    const updateTask = renderTable();
    fireEvent.click(screen.getByText('Manual'));
    fireEvent.keyDown(grid(), { key: 'Delete' });
    expect(updateTask).toHaveBeenCalledWith('t2', 'owner', '');
  });
});
