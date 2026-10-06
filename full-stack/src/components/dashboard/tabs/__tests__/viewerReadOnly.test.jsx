/**
 * TDD tests for viewer read-only rendering (task-12).
 *
 * Mirrors SettingsTab.test.jsx's convention: wrap in ThemeProvider (both
 * components call useTheme()), and additionally wrap in PermissionProvider
 * since useCan() needs a role in context.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import DataTab from '@/components/dashboard/tabs/DataTab';
import SettingsTab from '@/components/dashboard/tabs/SettingsTab';
import ProjectsTab from '@/components/dashboard/tabs/ProjectsTab';

// ProjectsTab 掛了 useForbiddenHandler → useRouter()，裸 render 沒有 app router，
// 跟 forbiddenHandler.test.js／useUserSettings.test.js 用同一招 stub 掉。
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function renderDataTabAs(role) {
  const props = {
    filtered: [], allS: [], allT: [], twp: [], projects: [],
    updateTask: () => {}, deleteTask: () => {}, addTask: () => {},
    toggleSub: () => {}, updateSub: () => {}, addSub: () => {}, deleteSub: () => {},
    configCats: [], configOwners: [],
    userRole: role, pcMap: {},
    importTasks: () => {}, deleteManyTasks: () => {}, updateManyTasks: () => {}, deleteAllTasks: () => {},
    showToast: () => {}, setModalTask: () => {},
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <DataTab {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

function renderSettingsTabAs(role) {
  const props = {
    configCats: [], saveConfigCats: () => {}, configOwners: [],
    ganttDraft: { overview: {}, project: {}, timeline: {} }, setGanttDraft: () => {},
    saveGanttWidths: () => {}, timelineHeight: 100, saveTimelineHeight: () => {},
    upcomingDays: 30, upcomingLimit: 5, saveUpcomingSettings: () => {},
    showToast: () => {}, zoom: 150, onZoomChange: () => {},
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <SettingsTab {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

function renderProjectsTabAs(role) {
  const projects = [{ id: 'p1', name: 'Project A', sortOrder: 1 }];
  const props = {
    twp: [], allS: [], projects, configOwners: [], pcMap: { 'Project A': '#123456' },
    allProjNames: ['Project A'], setModalTask: () => {}, setShowFileManager: () => {},
    ganttWidths: {}, timelineHeight: 100, showToast: () => {},
    renameProject: () => {}, addProject: () => {}, deleteProject: () => {},
    updateTask: () => {}, deleteTask: () => {}, toggleSub: () => {}, updateSub: () => {},
    addSub: () => {}, deleteSub: () => {}, reorderSubs: () => {}, reorderProjects: () => {},
    projBanners: {}, setProjBanners: () => {}, onProjectRenamed: () => {}, onProjectDeleted: () => {},
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <ProjectsTab {...props} />
      </PermissionProvider>
    </ThemeProvider>
  );
}

describe('viewer 唯讀渲染', () => {
  it('DataTab 對 viewer 不顯示 Export / Export CSV 按鈕', () => {
    renderDataTabAs('viewer');
    expect(screen.queryByText(/Export/i)).toBeNull();
  });

  it('DataTab 對 admin 仍顯示 Export', () => {
    renderDataTabAs('admin');
    expect(screen.getByText(/Export/i)).toBeTruthy();
  });

  it('DataTab 對 viewer 不顯示 "Double-click" 操作提示（雙擊也編輯不了，提示會誤導）', () => {
    renderDataTabAs('viewer');
    expect(screen.queryByText(/Double-click/i)).toBeNull();
  });

  it('DataTab 對 admin 仍顯示 "Double-click" 操作提示', () => {
    renderDataTabAs('admin');
    expect(screen.getByText(/Double-click/i)).toBeTruthy();
  });

  it('SettingsTab 對 viewer 不顯示 category 新增按鈕', () => {
    renderSettingsTabAs('viewer');
    expect(screen.queryByPlaceholderText('New category')).toBeNull();
  });

  it('SettingsTab 對 viewer 仍顯示自己的版面設定（zoom / 甘特寬度）', () => {
    renderSettingsTabAs('viewer');
    expect(screen.getByText(/Save Widths/i)).toBeTruthy();
  });

  it('ProjectsTab 卡片對 viewer 不顯示 Archive / Delete 按鈕', () => {
    renderProjectsTabAs('viewer');
    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('ProjectsTab 卡片對 admin 仍顯示 Archive / Delete 按鈕', () => {
    renderProjectsTabAs('admin');
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });
});
