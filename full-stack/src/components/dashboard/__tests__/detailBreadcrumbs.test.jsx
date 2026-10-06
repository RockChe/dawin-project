/** /project/[id] 的 ProjectDetail 與 TaskModal 的麵包屑／專案›任務副標。 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import ProjectDetail from '@/components/dashboard/ProjectDetail';
import TaskModal from '@/components/dashboard/TaskModal';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('ProjectDetail 麵包屑', () => {
  it('首頁 › Projects › 專案名；前兩層連到 /dashboard，當前頁是專案名', () => {
    render(<ThemeProvider><ProjectDetail initialData={{ project: { id: 'p1', name: 'Alpha' }, tasks: [], subtasks: [] }} /></ThemeProvider>);
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect([...nav.querySelectorAll('li')].map(li => li.textContent.replace('›', ''))).toEqual(['首頁', 'Projects', 'Alpha']);
    expect(screen.getByRole('link', { name: '首頁' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.getByRole('link', { name: 'Projects' }).getAttribute('href')).toBe('/dashboard');
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Alpha');
  });
  it('不再有重複的「← 返回儀表板」連結，由麵包屑「首頁」取代', () => {
    render(<ThemeProvider><ProjectDetail initialData={{ project: { id: 'p1', name: 'Alpha' }, tasks: [], subtasks: [] }} /></ThemeProvider>);
    expect(screen.queryByText(/返回儀表板/)).toBeNull();
    expect(screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/dashboard').map(a => a.textContent)).toEqual(['首頁', 'Projects']);
  });
});

const props = (task, over = {}) => ({
  task, projectId: 'p1', projectName: 'Alpha', onClose: vi.fn(),
  addTask: vi.fn(), updateTask: vi.fn(), allS: [], addSub: vi.fn(), deleteSub: vi.fn(), toggleSub: vi.fn(), updateSub: vi.fn(),
  configCats: ['活動'], configOwners: [], reorderSubs: vi.fn(), allL: [], allF: [], addLink: vi.fn(), addFile: vi.fn(),
  deleteLink: vi.fn(), deleteFile: vi.fn(), showToast: vi.fn(), ...over,
});
const wrap = ui => render(<ThemeProvider><PermissionProvider role="admin">{ui}</PermissionProvider></ThemeProvider>);

describe('TaskModal 標題副標', () => {
  it('編輯：「專案名 › 任務名」純文字（沒有連結、沒有 breadcrumb nav）', () => {
    wrap(<TaskModal {...props({ id: 't1', task: 'Yaya', status: '待辦', priority: '中', category: '活動' })} />);
    const line = screen.getByText('Alpha › Yaya');
    expect(line.closest('a,button')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).toBeNull();
  });
  it('新增：「專案名 › 新任務」', () => {
    wrap(<TaskModal {...props('new')} />);
    expect(screen.getByText('Alpha › 新任務')).toBeTruthy();
  });
  it('沒有專案名就不顯示副標', () => {
    wrap(<TaskModal {...props('new', { projectName: '' })} />);
    expect(screen.queryByText(/›/)).toBeNull();
  });
});
