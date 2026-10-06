/**
 * TaskModal 兩欄：「關注人」（獨立欄位，write 可編輯、viewer 唯讀）與「執行人」
 * （有子任務 owner → 唯讀＋「由子任務自動帶出」；否則可編輯）。task.owner = 執行人 ∪ 關注人。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PermissionProvider } from '@/components/PermissionProvider';
import TaskModal from '@/components/dashboard/TaskModal';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const wrap = (role, ui) => render(<ThemeProvider><PermissionProvider role={role}>{ui}</PermissionProvider></ThemeProvider>);
const BASE = { id: 't1', projectId: 'p1', task: 'Yaya', status: '待辦', priority: '中', category: '活動', startDate: '2026-08-01', endDate: '2026-08-10', notes: null };
const SUBS = [{ id: 's1', taskId: 't1', name: 'S1', owner: 'Felien', done: false, sortOrder: 1 }];

function modalProps(task, allS, over = {}) {
  return {
    task, projectId: 'p1', projectName: 'P1', onClose: vi.fn(),
    addTask: vi.fn(async () => ({ success: true })), updateTask: vi.fn(async () => {}),
    allS, addSub: async () => {}, deleteSub: async () => {}, toggleSub: async () => {}, updateSub: async () => {},
    configCats: ['活動'], configOwners: ['Felien', '幸真', 'Amy'], reorderSubs: () => {},
    allL: [], allF: [], addLink: async () => {}, addFile: () => {}, deleteLink: async () => {}, deleteFile: async () => {},
    showToast: () => {}, ...over,
  };
}

describe('TaskModal 關注人／執行人欄', () => {
  it('write 角色：關注人有 TagInput 並預填、執行人欄標籤是「執行人」', () => {
    wrap('admin', <TaskModal {...modalProps({ ...BASE, owner: 'Amy,幸真', watchers: '幸真' }, [])} />);
    expect(screen.getByText('關注人')).toBeTruthy();
    expect(screen.getByText('執行人')).toBeTruthy();
    expect(screen.queryByText('負責人')).toBeNull();
    expect(screen.getAllByText('幸真').length).toBeGreaterThan(0);
  });

  it('執行人欄只含執行人（owner 扣掉關注人），不含關注人', () => {
    wrap('admin', <TaskModal {...modalProps({ ...BASE, owner: 'Amy,幸真', watchers: '幸真' }, [])} />);
    // 幸真 只在關注人欄出現一次；Amy 在執行人欄
    expect(screen.getAllByText('幸真')).toHaveLength(1);
    expect(screen.getAllByText('Amy')).toHaveLength(1);
  });

  it('有子任務 owner：執行人唯讀（顯示子任務聯集＋提示），關注人仍可編輯', () => {
    wrap('admin', <TaskModal {...modalProps({ ...BASE, owner: 'Felien', watchers: null }, SUBS)} />);
    expect(screen.getByText('由子任務自動帶出')).toBeTruthy();
    expect(screen.queryByPlaceholderText('新增執行人...')).toBeNull();
    expect(screen.getAllByText('Felien').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('新增關注人...')).toBeTruthy();
  });

  it('viewer：兩欄都唯讀（沒有任何 TagInput）', () => {
    wrap('viewer', <TaskModal {...modalProps({ ...BASE, owner: 'Felien,幸真', watchers: '幸真' }, SUBS)} />);
    expect(screen.queryByPlaceholderText('新增關注人...')).toBeNull();
    expect(screen.queryByPlaceholderText('新增執行人...')).toBeNull();
    expect(screen.getByText('關注人')).toBeTruthy();
    expect(screen.getAllByText('幸真').length).toBeGreaterThan(0);
  });

  it('儲存：只改關注人 → 只送 watchers，不送 owner', async () => {
    const props = modalProps({ ...BASE, owner: 'Amy', watchers: null }, []);
    wrap('admin', <TaskModal {...props} />);
    const input = screen.getByPlaceholderText('新增關注人...');
    fireEvent.change(input, { target: { value: '幸真' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('確認'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.updateTask.mock.calls).toEqual([['t1', 'watchers', '幸真']]);
  });

  it('儲存：什麼都沒改 → 不送任何更新（執行人以扣掉關注人的值當基準，不會誤判成改了 owner）', async () => {
    const props = modalProps({ ...BASE, owner: 'Amy,幸真', watchers: '幸真' }, []);
    wrap('admin', <TaskModal {...props} />);
    fireEvent.click(screen.getByText('確認'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.updateTask).not.toHaveBeenCalled();
  });

  it('儲存：改執行人 → 只送 owner（執行人部分），關注人由伺服端/hook 補回聯集', async () => {
    const props = modalProps({ ...BASE, owner: '幸真', watchers: '幸真' }, []); // 執行人是空的
    wrap('admin', <TaskModal {...props} />);
    const input = screen.getByPlaceholderText('新增執行人...');
    fireEvent.change(input, { target: { value: 'Felien' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('確認'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.updateTask.mock.calls).toEqual([['t1', 'owner', 'Felien']]);
  });

  it('新增任務：關注人欄存在，送出時帶 watchers', async () => {
    const props = modalProps('new', []);
    wrap('admin', <TaskModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('輸入任務名稱'), { target: { value: 'New' } });
    const w = screen.getByPlaceholderText('新增關注人...');
    fireEvent.change(w, { target: { value: '幸真' } });
    fireEvent.keyDown(w, { key: 'Enter' });
    fireEvent.click(screen.getByText('確認'));
    await waitFor(() => expect(props.addTask).toHaveBeenCalled());
    expect(props.addTask.mock.calls[0][1]).toMatchObject({ task: 'New', watchers: '幸真' });
  });
});
