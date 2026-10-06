/**
 * Tasks 列表「隱藏已完成子任務」開關：
 *   · visibleSubs — 純函式，只濾掉 done 的子任務
 *   · ProjectsTab：開關存在、開啟後已勾子任務消失但進度數字不變、重置出現並清掉
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectsTab, { visibleSubs, PROJECT_TASK_VIEW_DEFAULT } from '@/components/dashboard/tabs/ProjectsTab';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('visibleSubs', () => {
  const subs = [{ id: 'a', done: true }, { id: 'b', done: false }, { id: 'c', done: true }];
  it('hideDone=false → 全部保留', () => {
    expect(visibleSubs(subs, false)).toEqual(subs);
  });
  it('hideDone=true → 只剩未完成', () => {
    expect(visibleSubs(subs, true).map(s => s.id)).toEqual(['b']);
  });
  it('全部已完成 → 空陣列；不改動輸入', () => {
    const input = [{ id: 'a', done: true }];
    expect(visibleSubs(input, true)).toEqual([]);
    expect(input).toHaveLength(1);
  });
});

describe('PROJECT_TASK_VIEW_DEFAULT', () => {
  it('hideDoneSubs 預設 false', () => {
    expect(PROJECT_TASK_VIEW_DEFAULT.hideDoneSubs).toBe(false);
  });
});

function renderDetail(view, setView = () => {}) {
  const projects = [{ id: 'p1', name: 'Project A', sortOrder: 1 }];
  const task = { id: 't1', projectId: 'p1', project: 'Project A', task: 'task-t1', status: '進行中', priority: '中', owner: '', start: '2026-06-01', end: '2026-06-30', duration: 29, progress: 50, sDone: 1, sTotal: 2, sortOrder: 1 };
  const sub = (id, done) => ({ id, taskId: 't1', name: `sub-${id}`, owner: '', done, sortOrder: id === 's1' ? 1 : 2 });
  const props = {
    twp: [task], allS: [sub('s1', true), sub('s2', false)], projects, configOwners: [], pcMap: { 'Project A': '#123456' },
    allProjNames: ['Project A'], setModalTask: () => {}, setShowFileManager: () => {},
    ganttWidths: {}, timelineHeight: 100, showToast: () => {},
    renameProject: () => {}, addProject: () => {}, deleteProject: () => {},
    updateTask: () => {}, deleteTask: () => {}, toggleSub: () => {}, updateSub: () => {},
    addSub: () => {}, deleteSub: () => {}, reorderSubs: () => {}, reorderProjects: () => {}, reorderTasks: () => {},
    projBanners: {}, setProjBanners: () => {}, onProjectRenamed: () => {}, onProjectDeleted: () => {},
    projectTaskView: view, setProjectTaskView: setView,
  };
  render(<ThemeProvider><PermissionProvider role="admin"><ProjectsTab {...props} /></PermissionProvider></ThemeProvider>);
  fireEvent.click(screen.getByText('Project A'));
}

describe('隱藏已完成子任務開關', () => {
  it('開關存在、預設未按；點擊送出 hideDoneSubs:true 並保留其他設定', () => {
    const setView = vi.fn();
    renderDetail(PROJECT_TASK_VIEW_DEFAULT, setView);
    const toggle = screen.getByRole('button', { name: '隱藏已完成子任務' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('sub-s1')).toBeTruthy();
    fireEvent.click(toggle);
    expect(setView).toHaveBeenCalledWith({ ...PROJECT_TASK_VIEW_DEFAULT, hideDoneSubs: true });
  });
  it('開啟：已勾子任務消失、未勾仍在；進度 1/2 與 Add subtask 不變', () => {
    renderDetail({ ...PROJECT_TASK_VIEW_DEFAULT, hideDoneSubs: true });
    expect(screen.queryByText('sub-s1')).toBeNull();
    expect(screen.getByText('sub-s2')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('+ Add subtask')).toBeTruthy();
    expect(screen.getByRole('button', { name: '隱藏已完成子任務' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('舊設定沒有 hideDoneSubs 欄位 → 視為關閉', () => {
    const { hideDoneSubs, ...old } = PROJECT_TASK_VIEW_DEFAULT;
    renderDetail(old);
    expect(screen.getByText('sub-s1')).toBeTruthy();
  });
  it('開啟時顯示重置（工具列），按下回到預設（hideDoneSubs:false）', () => {
    const setView = vi.fn();
    renderDetail({ ...PROJECT_TASK_VIEW_DEFAULT, hideDoneSubs: true }, setView);
    fireEvent.click(screen.getAllByText('重置').at(-1));
    expect(setView).toHaveBeenCalledWith(PROJECT_TASK_VIEW_DEFAULT);
  });
  it('關閉且其餘為預設 → 不顯示重置', () => {
    renderDetail(PROJECT_TASK_VIEW_DEFAULT);
    expect(screen.queryByText('重置')).toBeNull();
  });
});
