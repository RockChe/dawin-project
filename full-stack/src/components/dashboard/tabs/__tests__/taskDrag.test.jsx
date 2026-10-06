/**
 * Project 詳情頁 Tasks 拖移排序：
 *   · withManualSort — 拖移時自動切成手動排序（純函式）
 *   · sortProjectTasks 的 'manual' 模式 = 依 sortOrder（同值維持輸入順序）
 *   · viewer 不出現任何拖移把手；admin 兩個 surface（Tasks 卡片 + 甘特左欄）都有
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectsTab, { withManualSort, sortProjectTasks, TASK_SORT_FIELDS, PROJECT_TASK_VIEW_DEFAULT } from '@/components/dashboard/tabs/ProjectsTab';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const ids = a => a.map(x => x.id);

describe('withManualSort', () => {
  it('非手動 → 切成 manual/asc，其餘欄位（篩選）保留', () => {
    const v = { sort: { field: 'end', dir: 'desc' }, status: ['待辦'], owner: [], priority: [] };
    expect(withManualSort(v)).toEqual({ sort: { field: 'manual', dir: 'asc' }, status: ['待辦'], owner: [], priority: [] });
  });
  it('已是手動 → 回同一個物件（不觸發多餘的設定寫入）', () => {
    const v = { ...PROJECT_TASK_VIEW_DEFAULT, sort: { field: 'manual', dir: 'asc' } };
    expect(withManualSort(v)).toBe(v);
  });
  it('不改動輸入', () => {
    const v = { ...PROJECT_TASK_VIEW_DEFAULT };
    withManualSort(v);
    expect(v.sort.field).toBe('start');
  });
});

describe('sortProjectTasks manual', () => {
  const t = (id, sortOrder) => ({ id, sortOrder, start: '2026-06-01' });
  it('依 sortOrder 升冪；同值維持輸入順序（輸入是開始日序）', () => {
    expect(ids(sortProjectTasks([t('a', 0), t('b', 2), t('c', 1), t('d', 0)], { field: 'manual', dir: 'asc' }))).toEqual(['a', 'd', 'c', 'b']);
  });
  it('dir 對 manual 無意義：desc 也不翻面', () => {
    expect(ids(sortProjectTasks([t('a', 1), t('b', 2)], { field: 'manual', dir: 'desc' }))).toEqual(['a', 'b']);
  });
  it('TASK_SORT_FIELDS 含手動', () => {
    expect(TASK_SORT_FIELDS.some(f => f.key === 'manual')).toBe(true);
  });
});

function renderDetailAs(role) {
  const projects = [{ id: 'p1', name: 'Project A', sortOrder: 1 }];
  const mk = (id, sortOrder) => ({ id, projectId: 'p1', project: 'Project A', task: `task-${id}`, status: '進行中', priority: '中', owner: '', start: '2026-06-01', end: '2026-06-30', duration: 29, progress: 0, sDone: 0, sTotal: 0, sortOrder });
  const props = {
    twp: [mk('t1', 1), mk('t2', 2)], allS: [], projects, configOwners: [], pcMap: { 'Project A': '#123456' },
    allProjNames: ['Project A'], isMobile: false, setModalTask: () => {}, setShowFileManager: () => {},
    ganttWidths: {}, timelineHeight: 100, showToast: () => {},
    renameProject: () => {}, addProject: () => {}, deleteProject: () => {},
    updateTask: () => {}, deleteTask: () => {}, toggleSub: () => {}, updateSub: () => {},
    addSub: () => {}, deleteSub: () => {}, reorderSubs: () => {}, reorderProjects: () => {}, reorderTasks: () => {},
    projBanners: {}, setProjBanners: () => {}, onProjectRenamed: () => {}, onProjectDeleted: () => {},
    setProjectTaskView: () => {},
  };
  const utils = render(
    <ThemeProvider><PermissionProvider role={role}><ProjectsTab {...props} /></PermissionProvider></ThemeProvider>
  );
  fireEvent.click(screen.getByText('Project A'));   // 進詳情頁
  return utils;
}

describe('task 拖移把手', () => {
  it('viewer：Tasks 卡片與甘特左欄都沒有把手（內容仍在）', () => {
    renderDetailAs('viewer');
    expect(screen.queryAllByLabelText('拖移任務')).toHaveLength(0);
    expect(screen.getAllByText('task-t1').length).toBeGreaterThan(0);
  });
  it('admin：兩個 surface 各一個把手 × 2 筆 task = 4', () => {
    renderDetailAs('admin');
    expect(screen.getAllByLabelText('拖移任務')).toHaveLength(4);
  });
});
