/**
 * TDD tests for viewer read-only rendering (task-12).
 *
 * Mirrors SettingsTab.test.jsx's convention: wrap in ThemeProvider (both
 * components call useTheme()), and additionally wrap in PermissionProvider
 * since useCan() needs a role in context.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import DataTab from '@/components/dashboard/tabs/DataTab';
import SettingsTab from '@/components/dashboard/tabs/SettingsTab';

function renderDataTabAs(role) {
  const props = {
    filtered: [], allS: [], allT: [], twp: [], projects: [],
    updateTask: () => {}, deleteTask: () => {}, addTask: () => {},
    toggleSub: () => {}, updateSub: () => {}, addSub: () => {}, deleteSub: () => {},
    configCats: [], configOwners: [],
    isMobile: false, userRole: role, pcMap: {},
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
    isMobile: false, showToast: () => {}, zoom: 150, onZoomChange: () => {},
  };
  return render(
    <ThemeProvider>
      <PermissionProvider role={role}>
        <SettingsTab {...props} />
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

  it('SettingsTab 對 viewer 不顯示 category 新增按鈕', () => {
    renderSettingsTabAs('viewer');
    expect(screen.queryByPlaceholderText('New category')).toBeNull();
  });

  it('SettingsTab 對 viewer 仍顯示自己的版面設定（zoom / 甘特寬度）', () => {
    renderSettingsTabAs('viewer');
    expect(screen.getByText(/Save Widths/i)).toBeTruthy();
  });
});
