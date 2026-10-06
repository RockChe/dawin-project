import { describe, it, expect, vi } from 'vitest';
import { jumpToProject, backFromProject, switchTab, projectDetailCrumbs } from '../mobileNav';

const nav = (o = {}) => ({ tab: 'mytasks', selectedProjectId: null, returnTab: null, ...o });

describe('jumpToProject', () => {
  it('從時程跳過去：切到專案分頁、選中專案、記住來源分頁', () => {
    expect(jumpToProject(nav({ tab: 'timeline' }), 'p1')).toEqual({ tab: 'projects', selectedProjectId: 'p1', returnTab: 'timeline' });
  });
  it('從專案分頁自己呼叫：不記來源（返回就是清單）', () => {
    expect(jumpToProject(nav({ tab: 'projects' }), 'p1').returnTab).toBeNull();
  });
});

describe('backFromProject', () => {
  it('有來源 → 回到來源分頁並清空選取與來源', () => {
    expect(backFromProject(nav({ tab: 'projects', selectedProjectId: 'p1', returnTab: 'timeline' }))).toEqual({ tab: 'timeline', selectedProjectId: null, returnTab: null });
  });
  it('沒來源 → 留在專案分頁、只清選取（回清單）', () => {
    expect(backFromProject(nav({ tab: 'projects', selectedProjectId: 'p1' }))).toEqual({ tab: 'projects', selectedProjectId: null, returnTab: null });
  });
});

describe('switchTab（底部分頁列）', () => {
  it('任何分頁切換都清掉選取與來源（專案 → 一律是清單）', () => {
    const jumped = nav({ tab: 'projects', selectedProjectId: 'p1', returnTab: 'timeline' });
    expect(switchTab(jumped, 'projects')).toEqual({ tab: 'projects', selectedProjectId: null, returnTab: null });
    expect(switchTab(jumped, 'overview')).toEqual({ tab: 'overview', selectedProjectId: null, returnTab: null });
  });
});

describe('projectDetailCrumbs', () => {
  it('沒來源：首頁 › 專案 › 名稱，「專案」可點回清單', () => {
    const onHome = vi.fn(), onBack = vi.fn();
    const items = projectDetailCrumbs('Alpha', null, { onHome, onBack });
    expect(items.map(i => i.label)).toEqual(['首頁', '專案', 'Alpha']);
    items[1].onClick();
    expect(onBack).toHaveBeenCalled();
  });
  it('來源是時程：首頁 › 時程 › 名稱，「時程」可點（走 onBack）', () => {
    const onBack = vi.fn();
    const items = projectDetailCrumbs('Alpha', 'timeline', { onHome: vi.fn(), onBack });
    expect(items.map(i => i.label)).toEqual(['首頁', '時程', 'Alpha']);
    items[1].onClick();
    expect(onBack).toHaveBeenCalled();
  });
  it('來源是首頁（我的任務）：首頁 › 名稱，首頁走 onBack', () => {
    const onBack = vi.fn();
    const items = projectDetailCrumbs('Alpha', 'mytasks', { onHome: vi.fn(), onBack });
    expect(items.map(i => i.label)).toEqual(['首頁', 'Alpha']);
    items[0].onClick();
    expect(onBack).toHaveBeenCalled();
  });
});
