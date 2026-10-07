import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import V2Root from '@/components/v2/V2Root';
import Shell from '@/components/v2/Shell';
import { StaticSettingsProvider } from '@/components/v2/SettingsContext';
import { fixtureShellProps, FIXTURE_SUBTASKS, FIXTURE_OWNERS } from '@/components/v2/fixtures';

// Shell 持有任務視窗狀態：onOpenTask(task|null,{projectId}) → 開啟嵌入的舊 TaskModal，關閉後焦點回到觸發元素。
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/server/actions/projects', () => new Proxy({}, { get: () => boom }));
vi.mock('@/server/actions/tasks', () => new Proxy({}, { get: () => boom }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

let deps;
const mkDeps = () => ({
  addTask: vi.fn(async () => ({ success: true })), updateTask: vi.fn(async () => {}),
  allS: FIXTURE_SUBTASKS, addSub: vi.fn(), deleteSub: vi.fn(), toggleSub: vi.fn(), updateSub: vi.fn(), reorderSubs: vi.fn(),
  configCats: ['商務合作', '活動'], configOwners: FIXTURE_OWNERS, allL: [], allF: [],
  addLink: vi.fn(), addFile: vi.fn(), deleteLink: vi.fn(), deleteFile: vi.fn(), showToast: vi.fn(),
});
const setup = ({ role = 'admin', withModal = true, ...props } = {}) => {
  deps = mkDeps();
  return render(
    <ThemeProvider><V2Root role={role}><StaticSettingsProvider settings={{}}>
      <Shell {...fixtureShellProps()} taskModal={withModal ? deps : undefined} {...props} />
    </StaticSettingsProvider></V2Root></ThemeProvider>
  );
};
const nav = () => screen.getByRole('navigation', { name: '主要分頁' });
beforeEach(() => { localStorage.clear(); boom.mockClear(); });

describe('Shell：任務視窗', () => {
  it('Overview 即將到期點任務 → 編輯任務視窗（帶入該任務與專案名）；onOpenTask 仍會被呼叫', () => {
    const onOpenTask = vi.fn();
    setup({ onOpenTask });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('商品合作'));
    expect(screen.getByRole('dialog', { name: '編輯任務' })).toBeTruthy();
    expect(screen.getByDisplayValue('商品合作')).toBeTruthy();
    expect(screen.getByText('TTXC 虎姑婆 駁二 › 商品合作')).toBeTruthy();
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });

  it('My Tasks 點任務也開；儲存（改狀態）→ hook 的 updateTask，視窗關閉', async () => {
    setup();
    fireEvent.click(within(nav()).getByText('My Tasks'));
    fireEvent.click(screen.getByText('文化部結案報告'));
    fireEvent.change(screen.getByDisplayValue('待辦'), { target: { value: '進行中' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deps.updateTask).toHaveBeenCalledWith('t9', 'status', '進行中');
  });

  it('關閉（Esc）後焦點回到觸發元素', () => {
    setup();
    const btn = screen.getByText('商品合作').closest('button');
    btn.focus();
    fireEvent.click(btn);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('專案詳情「+ Create」→ onOpenTask(null,{projectId}) → 建立任務視窗、專案預填', async () => {
    const { container } = setup({ initialTab: 'projects' });
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(screen.getAllByRole('button', { name: '+ Create' })[0]);
    expect(screen.getByRole('dialog', { name: '建立任務' })).toBeTruthy();
    expect(screen.getByText('TTXC 虎姑婆 駁二 › 新任務')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('輸入任務名稱'), { target: { value: '新任務 X' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(deps.addTask).toHaveBeenCalled());
    expect(deps.addTask.mock.calls[0][0]).toBe('p1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('專案詳情點任務名 → 編輯視窗', () => {
    const { container } = setup({ initialTab: 'projects' });
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(container.querySelector('.trow .tnm'));
    expect(screen.getByRole('dialog', { name: '編輯任務' })).toBeTruthy();
  });

  it('viewer：點任務只開唯讀視窗（沒有確認鈕）', () => {
    setup({ role: 'viewer' });
    fireEvent.click(screen.getByText('商品合作'));
    expect(screen.getByRole('dialog', { name: '編輯任務' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '確認' })).toBeNull();
  });

  it('沒傳 taskModal（預設／舊測試）→ 不開視窗，不報錯', () => {
    setup({ withModal: false });
    fireEvent.click(screen.getByText('商品合作'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('modalInit（預覽用）：一開始就開某任務／某專案的新增', () => {
    const a = setup({ modalInit: { taskId: 't1' } });
    expect(screen.getByRole('dialog', { name: '編輯任務' })).toBeTruthy();
    expect(screen.getByDisplayValue('票務展務相關')).toBeTruthy();
    a.unmount();
    setup({ modalInit: { projectId: 'p2' } });
    expect(screen.getByRole('dialog', { name: '建立任務' })).toBeTruthy();
    expect(screen.getByText('科教館公益展廳 › 新任務')).toBeTruthy();
  });

  it('殼層與視窗操作不碰 server action', () => {
    setup();
    fireEvent.click(screen.getByText('商品合作'));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(boom).not.toHaveBeenCalled();
  });
});
