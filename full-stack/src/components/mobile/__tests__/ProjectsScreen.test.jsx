import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectsScreen from '../ProjectsScreen';

const projects = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }];
const T = (id, o = {}) => ({ id, projectId: 'p1', project: 'Alpha', task: `task-${id}`, owner: 'Amy,Bob', watchers: 'Bob', status: '進行中', progress: 50, sDone: 1, sTotal: 2, end: '2026-12-20', ...o });
const twp = [T('t1'), T('t2', { status: '待辦', sTotal: 0, sDone: 0 }), T('t3', { projectId: 'p2', project: 'Beta', progress: 100 })];
const S = (id, taskId, done, o = {}) => ({ id, taskId, name: `sub-${id}`, owner: 'Amy', done, sortOrder: 1, ...o });
const allS = [S('s1', 't1', true), S('s2', 't1', false, { sortOrder: 2 })];

function setup({ role = 'admin', selected = null } = {}) {
  const fns = { openTask: vi.fn(), toggleSub: vi.fn(), onHome: vi.fn() };
  const Wrap = ({ sel }) => {
    // 受控：用最小 state 模擬 MobileApp 提升的 selectedProjectId
    const [id, setId] = useState(sel);
    return (
      <ThemeProvider><PermissionProvider role={role}>
        <ProjectsScreen projects={projects} twp={twp} allS={allS} configOwners={[]} selectedProjectId={id} setSelectedProjectId={setId} {...fns} />
      </PermissionProvider></ThemeProvider>
    );
  };
  render(<Wrap sel={selected} />);
  return fns;
}

describe('ProjectsScreen 清單', () => {
  it('預設顯示專案卡片（名稱、任務數、平均進度）', () => {
    setup();
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeTruthy();
    expect(screen.getByText('2 任務')).toBeTruthy();
    expect(screen.getByText('50% · 到期 2026.12.20')).toBeTruthy();
    expect(screen.queryByText('task-t1')).toBeNull();
  });
  it('點專案進詳情、點返回回清單', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getByText('task-t1')).toBeTruthy();
    expect(screen.queryByText('task-t3')).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('button', { name: '專案' }));
    expect(screen.queryByText('task-t1')).toBeNull();
    expect(screen.getByRole('button', { name: /Beta/ })).toBeTruthy();
  });
  it('外部設了 selectedProjectId（時程跳轉）直接顯示該專案詳情', () => {
    setup({ selected: 'p2' });
    expect(screen.getByText('task-t3')).toBeTruthy();
    expect(screen.queryByText('task-t1')).toBeNull();
  });
});

describe('ProjectsScreen 封存專案', () => {
  it('已封存專案不出現在清單，專案數也不計入（手機沒有封存 UI，只是不顯示）', () => {
    const arch = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta', archivedAt: '2026-10-01T00:00:00.000Z' }];
    render(<ThemeProvider><PermissionProvider role="admin">
      <ProjectsScreen projects={arch} twp={twp} allS={allS} configOwners={[]} selectedProjectId={null} setSelectedProjectId={() => {}} openTask={() => {}} toggleSub={() => {}} onHome={() => {}} />
    </PermissionProvider></ThemeProvider>);
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Beta/ })).toBeNull();
    expect(screen.getByText('1 個專案')).toBeTruthy();
  });
});

const crumbItems = () => [...screen.getByRole('navigation', { name: 'breadcrumb' }).querySelectorAll('li')].map(li => li.textContent.replace('›', ''));

describe('ProjectsScreen 麵包屑', () => {
  it('清單：首頁 › 專案（只有一列）', () => {
    setup();
    expect(screen.getAllByRole('navigation', { name: 'breadcrumb' })).toHaveLength(1);
    expect(crumbItems()).toEqual(['首頁', '專案']);
  });
  it('詳情：首頁 › 專案 › 專案名，取代原本的「‹」返回表頭', () => {
    setup({ selected: 'p1' });
    expect(screen.getAllByRole('navigation', { name: 'breadcrumb' })).toHaveLength(1);
    expect(crumbItems()).toEqual(['首頁', '專案', 'Alpha']);
    expect(screen.queryByRole('button', { name: '返回專案清單' })).toBeNull();
  });
  it('點「首頁」呼叫 onHome；可點項目觸控高度 >= 44', () => {
    const { onHome } = setup({ selected: 'p1' });
    const nav = within(screen.getByRole('navigation', { name: 'breadcrumb' }));
    expect(nav.getByRole('button', { name: '專案' }).style.minHeight).toBe('44px');
    fireEvent.click(nav.getByRole('button', { name: '首頁' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectsScreen 詳情', () => {
  it('狀態 chips 篩選任務', () => {
    setup({ selected: 'p1' });
    fireEvent.click(screen.getByRole('button', { name: '待辦' }));
    expect(screen.queryByText('task-t1')).toBeNull();
    expect(screen.getByText('task-t2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByText('task-t1')).toBeTruthy();
  });
  it('點任務卡呼叫 openTask(id)', () => {
    const { openTask } = setup({ selected: 'p1' });
    fireEvent.click(screen.getByText('task-t1'));
    expect(openTask).toHaveBeenCalledWith('t1');
  });
  it('展開子任務、勾選呼叫 toggleSub 且不觸發 openTask', () => {
    const { openTask, toggleSub } = setup({ selected: 'p1' });
    expect(screen.queryByText('sub-s1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /子任務 1\/2/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /sub-s2/ }));
    expect(toggleSub).toHaveBeenCalledWith('s2');
    expect(openTask).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /sub-s1/ }).getAttribute('aria-checked')).toBe('true');
  });
  it('viewer 沒有勾選框，但仍可展開看子任務', () => {
    setup({ role: 'viewer', selected: 'p1' });
    fireEvent.click(screen.getByRole('button', { name: /子任務 1\/2/ }));
    expect(screen.getByText('sub-s2')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('隱藏已完成子任務開關：只影響子任務列，不影響 1/2 計數', () => {
    setup({ selected: 'p1' });
    fireEvent.click(screen.getByRole('button', { name: /子任務 1\/2/ }));
    expect(screen.getByText('sub-s1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '隱藏已完成子任務' }));
    expect(screen.queryByText('sub-s1')).toBeNull();
    expect(screen.getByText('sub-s2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /子任務 1\/2/ })).toBeTruthy();
  });
  it('執行人與關注人 chips；關注人旁有「關注」標籤', () => {
    setup({ selected: 'p1' });
    // t1 有子任務執行人 Amy；Bob 是關注人
    expect(screen.getAllByText('Amy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('關注').length).toBeGreaterThan(0);
  });
});
