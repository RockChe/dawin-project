// 2026-10-06：RWD 已移除，儀表板固定桌機版（1280）；平板／手機版另行設計。
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import MyTasksTab from '@/components/dashboard/tabs/MyTasksTab';
import SettingsTab from '@/components/dashboard/tabs/SettingsTab';
import DashboardHeader from '@/components/dashboard/tabs/DashboardHeader';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('next/font/google', () => ({ Noto_Sans_TC: () => ({ variable: '' }), JetBrains_Mono: () => ({ variable: '' }) }));
vi.mock('@/components/dashboard/Sidebar', () => ({ default: () => null }));

describe('桌機固定版', () => {
  it.each([
    ['dashboard', '@/app/(dashboard)/layout'],
    ['admin', '@/app/(admin)/layout'],
  ])('%s layout 匯出 viewport width=1280', async (_n, path) => {
    const mod = await import(/* @vite-ignore */ path);
    expect(mod.viewport).toEqual({ width: 1280 });
  });

  it('login／root layout 不鎖 viewport', async () => {
    const root = await import('@/app/layout');
    expect(root.viewport).toBeUndefined();
  });

  it('globals.css 沒有任何 @media，且 min-width 1280 只在 dashboard／admin layout', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).not.toMatch(/@media/);
    expect(css).not.toMatch(/min-width:\s*1280px/);
    for (const l of ['(dashboard)', '(admin)']) {
      expect(readFileSync(resolve(process.cwd(), `src/app/${l}/layout.jsx`), 'utf8')).toMatch(/minWidth:\s*1280/);
    }
  });

  it('分頁元件不需要 isMobile 就能渲染（桌機版是唯一行為）', () => {
    render(
      <ThemeProvider>
        <PermissionProvider role="admin">
          <MyTasksTab twp={[]} userName="Amy" pcMap={{}} setModalTask={() => {}} today="2026-10-06" />
          <DashboardHeader themeKey="warm" cycleTheme={() => {}} scrolled={false} searchInput="" handleSearch={() => {}}
            searchQ="" clearSearch={() => {}} avgProg={50} filtered={[]} />
          <SettingsTab configCats={[]} saveConfigCats={() => {}} configOwners={[]} ganttDraft={{}} setGanttDraft={() => {}}
            saveGanttWidths={() => {}} timelineHeight={400} saveTimelineHeight={() => {}} upcomingDays={30} upcomingLimit={5}
            saveUpcomingSettings={() => {}} showToast={() => {}} zoom={150} onZoomChange={() => {}} />
        </PermissionProvider>
      </ThemeProvider>
    );
    expect(screen.getByText('大雲文創專案管理系統')).toBeTruthy();
  });
});
