/**
 * Tasks 清單的任務標題 chips：顯示 owner 聯集（執行人 ∪ 關注人），
 * 「只關注、沒執行子任務」的人，chip 旁加小「關注」標籤；執行人（含同時是關注人的人）沒有標籤。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectsTab, { PROJECT_TASK_VIEW_DEFAULT } from '@/components/dashboard/tabs/ProjectsTab';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function renderDetail(taskOver, subs) {
  const projects = [{ id: 'p1', name: 'Project A', sortOrder: 1 }];
  const task = { id: 't1', projectId: 'p1', project: 'Project A', task: 'task-t1', status: '進行中', priority: '中', owner: '', watchers: null, start: '2026-06-01', end: '2026-06-30', duration: 29, progress: 50, sDone: 0, sTotal: subs.length, sortOrder: 1, ...taskOver };
  const props = {
    twp: [task], allS: subs.map((s, i) => ({ id: `s${i}`, taskId: 't1', name: `sub-${i}`, done: false, sortOrder: i + 1, ...s })),
    projects, configOwners: [], pcMap: { 'Project A': '#123456' },
    allProjNames: ['Project A'], isMobile: false, setModalTask: () => {}, setShowFileManager: () => {},
    ganttWidths: {}, timelineHeight: 100, showToast: () => {},
    renameProject: () => {}, addProject: () => {}, deleteProject: () => {},
    updateTask: () => {}, deleteTask: () => {}, toggleSub: () => {}, updateSub: () => {},
    addSub: () => {}, deleteSub: () => {}, reorderSubs: () => {}, reorderProjects: () => {}, reorderTasks: () => {},
    projBanners: {}, setProjBanners: () => {}, onProjectRenamed: () => {}, onProjectDeleted: () => {},
    projectTaskView: PROJECT_TASK_VIEW_DEFAULT, setProjectTaskView: () => {},
  };
  render(<ThemeProvider><PermissionProvider role="admin"><ProjectsTab {...props} /></PermissionProvider></ThemeProvider>);
  fireEvent.click(screen.getByText('Project A'));
}

describe('任務標題 chips 的「關注」標籤', () => {
  it('只關注的人有「關注」標籤，執行人沒有', () => {
    renderDetail({ owner: 'Felien,幸真', watchers: '幸真' }, [{ owner: 'Felien' }]);
    const tags = screen.getAllByText('關注');
    expect(tags).toHaveLength(1);
    expect(tags[0].parentElement.textContent).toContain('幸真');
    expect(tags[0].parentElement.textContent).not.toContain('Felien');
  });

  it('沒有子任務 owner、掛名關注人 → 也有標籤；手動執行人沒有', () => {
    renderDetail({ owner: 'Zed,幸真', watchers: '幸真' }, []);
    expect(screen.getAllByText('關注')).toHaveLength(1);
  });

  it('關注人同時是子任務執行人 → 算執行人，不標關注', () => {
    renderDetail({ owner: 'Felien', watchers: 'Felien' }, [{ owner: 'Felien' }]);
    expect(screen.queryByText('關注')).toBeNull();
  });

  it('沒有關注人 → 沒有任何標籤', () => {
    renderDetail({ owner: 'Amy', watchers: null }, []);
    expect(screen.queryByText('關注')).toBeNull();
  });
});
