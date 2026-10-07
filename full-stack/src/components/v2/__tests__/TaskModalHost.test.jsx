import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEMES } from '@/lib/theme';
import V2Root from '@/components/v2/V2Root';
import TaskModalHost from '@/components/v2/TaskModalHost';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

// 任務視窗＝嵌入舊 TaskModal（行內主題色 X 來自根 ThemeProvider）。server action／router 全 mock，不碰 DB。
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/server/actions/projects', () => new Proxy({}, { get: () => boom }));
vi.mock('@/server/actions/tasks', () => new Proxy({}, { get: () => boom }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const T1 = twp.find((t) => t.id === 't1');
let deps, onClose;
const mkDeps = () => ({
  addTask: vi.fn(async () => ({ success: true })), updateTask: vi.fn(async () => {}),
  allS: FIXTURE_SUBTASKS, addSub: vi.fn(), deleteSub: vi.fn(), toggleSub: vi.fn(), updateSub: vi.fn(), reorderSubs: vi.fn(),
  configCats: ['商務合作', '活動', '行銷'], configOwners: FIXTURE_OWNERS,
  allL: [{ id: 'l1', taskId: 't1', url: 'https://kktix.com/x', title: '售票頁' }], allF: [],
  addLink: vi.fn(), addFile: vi.fn(), deleteLink: vi.fn(), deleteFile: vi.fn(), showToast: vi.fn(),
});
const setup = ({ role = 'admin', req = { task: T1, projectId: 'p1' }, theme } = {}) => {
  if (theme) localStorage.setItem('dash-theme', theme);
  deps = mkDeps(); onClose = vi.fn();
  return render(
    <ThemeProvider><V2Root role={role}><TaskModalHost req={req} onClose={onClose} projects={FIXTURE_PROJECTS} deps={deps} /></V2Root></ThemeProvider>
  );
};
beforeEach(() => { localStorage.clear(); boom.mockClear(); });

describe('TaskModalHost', () => {
  it('req 是 null 不畫任何東西', () => {
    const { container } = setup({ req: null });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('編輯：開啟舊 TaskModal（編輯任務）、帶入欄位、專案副標、子任務與連結', () => {
    setup();
    const dlg = screen.getByRole('dialog', { name: '編輯任務' });
    expect(dlg).toBeTruthy();
    expect(screen.getByDisplayValue('票務展務相關')).toBeTruthy();
    expect(screen.getByText('TTXC 虎姑婆 駁二 › 票務展務相關')).toBeTruthy();
    expect(screen.getByText('售票系統串接')).toBeTruthy();
    expect(screen.getByText(/售票頁/)).toBeTruthy();
  });

  it('編輯：改狀態按確認 → updateTask(id, status, 值)，成功後 onClose', async () => {
    setup();
    fireEvent.change(screen.getByDisplayValue('進行中'), { target: { value: '待辦' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deps.updateTask).toHaveBeenCalledWith('t1', 'status', '待辦');
    expect(deps.addTask).not.toHaveBeenCalled();
  });

  it('新增：標題「建立任務」、專案預填（onOpenTask(null,{projectId})）、確認 → addTask(projectId, 欄位)', async () => {
    setup({ req: { task: null, projectId: 'p2' } });
    expect(screen.getByRole('dialog', { name: '建立任務' })).toBeTruthy();
    expect(screen.getByText('科教館公益展廳 › 新任務')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: '確認' });
    expect(confirm.disabled).toBe(true); // 名稱必填
    fireEvent.change(screen.getByPlaceholderText('輸入任務名稱'), { target: { value: '新的任務' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(deps.addTask).toHaveBeenCalled());
    const [pid, body] = deps.addTask.mock.calls[0];
    expect(pid).toBe('p2');
    expect(body.task).toBe('新的任務');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('新增失敗：不關閉，toast 錯誤', async () => {
    setup({ req: { task: null, projectId: 'p1' } });
    deps.addTask.mockResolvedValueOnce({ error: '建立失敗了' });
    fireEvent.change(screen.getByPlaceholderText('輸入任務名稱'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(deps.showToast).toHaveBeenCalledWith('建立失敗了', 'error'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('關閉：取消鈕、× 鈕、Esc、點遮罩都呼叫 onClose', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: '取消' })); expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '關閉' })); expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(container.querySelector('[role="dialog"]')); expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('viewer 唯讀：沒有確認鈕與輸入框，只有「關閉」；文字照顯示', () => {
    setup({ role: 'viewer' });
    expect(screen.queryByRole('button', { name: '確認' })).toBeNull();
    expect(screen.queryByPlaceholderText('輸入任務名稱')).toBeNull();
    expect(screen.queryByText('+ 新增子任務')).toBeNull();
    expect(screen.getByText('票務展務相關')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '關閉' }).at(-1));
    expect(onClose).toHaveBeenCalled();
    expect(deps.updateTask).not.toHaveBeenCalled();
  });

  it('外層是 v2 遮罩容器（.v2-modal-host），在 .v2 根節點之內', () => {
    const { container } = setup();
    const host = container.querySelector('.v2 .v2-modal-host');
    expect(host).toBeTruthy();
    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
  });
});

describe('主題單一來源（R6）：ThemeProvider themeKey → .v2[data-theme] 與 modal 行內色同步', () => {
  const panel = (c) => c.querySelector('[role="dialog"] > div');
  it('warm → light：modal 面板底色＝THEMES.warm.surface', () => {
    const { container } = setup({ theme: 'warm' });
    expect(container.querySelector('.v2').getAttribute('data-theme')).toBe('light');
    const probe = document.createElement('i'); probe.style.background = THEMES.warm.surface;
    expect(panel(container).style.background).toBe(probe.style.background);
  });
  it('dimmed → dark：modal 面板底色＝THEMES.dimmed.surface（與 v2 深色同一個 themeKey）', () => {
    const { container } = setup({ theme: 'dimmed' });
    expect(container.querySelector('.v2').getAttribute('data-theme')).toBe('dark');
    const probe = document.createElement('i'); probe.style.background = THEMES.dimmed.surface;
    expect(panel(container).style.background).toBe(probe.style.background);
    expect(THEMES.dimmed.surface).not.toBe(THEMES.warm.surface);
  });
});
