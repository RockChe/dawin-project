import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import Projects from '@/components/v2/Projects';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/server/actions/projects', () => new Proxy({}, { get: () => boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
let actions, updateSetting, onOpenProject;
const setup = ({ role = 'admin', level = 'full', settings = {}, projects = FIXTURE_PROJECTS, ...over } = {}) => {
  actions = { archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), add: vi.fn(async () => ({ success: true, project: { id: 'pNew', name: '新專案' } })), reorder: vi.fn() };
  updateSetting = vi.fn(async () => ({ success: true }));
  onOpenProject = vi.fn();
  return render(
    <PermissionProvider role={role}>
      <CloudLevelProvider level={level}>
        <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
          <Projects twp={twp} projects={projects} today={FIXTURE_TODAY} actions={actions} onOpenProject={onOpenProject} {...over} />
        </V2SettingsProvider>
      </CloudLevelProvider>
    </PermissionProvider>
  );
};
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); return c.textContent; };
const card = (c, name) => [...c.querySelectorAll('.pcard:not(.arch)')].find((x) => x.querySelector('.pname').textContent === name);
let confirmSpy;
beforeEach(() => { boom.mockClear(); confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => confirmSpy.mockRestore());

describe('Projects：卡片視圖', () => {
  it('10 張未封存卡片（封存的不在主列表），名稱依手動排序', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.pgrid .pcard .pname')].map((n) => n.textContent)).toEqual(
      ['TTXC 虎姑婆 駁二', '科教館公益展廳', '虎姑婆和他的朋友', '發行事務', '兒少內容有限合夥', '非非和他的小本子', '27年衛武營', 'Design Ah 展覽', '大雲Youtube Channel', '2027新年禮盒']);
  });

  it('一張卡：頭像字母、tasks／subtasks、整體進度 54%、「狀態 數字」標籤、Archive／Delete', () => {
    const { container } = setup();
    const c = card(container, 'TTXC 虎姑婆 駁二');
    expect(c.querySelector('.av').textContent).toBe('T');
    expect(c.querySelector('.meta').textContent).toBe('8 tasks · 15 subtasks');
    expect(txt(c.querySelector('.pct'))).toBe('54%');
    expect(c.textContent).toContain('整體進度');
    expect([...c.querySelectorAll('.st')].map((s) => s.textContent)).toEqual(['已完成 2', '進行中 3', '待辦 1', '暫緩 1', '待確認 1']);
    expect([...c.querySelectorAll('.foot button')].map((b) => b.textContent)).toEqual(['Archive', 'Delete']);
    expect(c.querySelector('.bar').getAttribute('aria-valuenow')).toBe('54');
  });

  it('筋斗雲在進度條上跑到進度位置（clamp 6%–96%）；進度 0 也不出界', () => {
    const { container } = setup();
    const run = (n) => card(container, n).querySelector('.runbar .runner');
    expect(run('TTXC 虎姑婆 駁二').style.getPropertyValue('--p')).toBe('54');
    expect(run('TTXC 虎姑婆 駁二').querySelector('svg title').textContent).toBe('筋斗雲');
    expect(run('27年衛武營').style.getPropertyValue('--p')).toBe('0');
  });

  it('雲關閉：沒有筋斗雲、進度條與百分比都還在', () => {
    const { container } = setup({ level: 'off' });
    const c = card(container, 'TTXC 虎姑婆 駁二');
    expect(c.querySelectorAll('.runner .cl')).toHaveLength(0);
    expect(c.querySelector('.bar')).toBeTruthy();
    expect(txt(c.querySelector('.pct'))).toBe('54%');
  });

  it('專案狀況 chip：有逾期（文字＋雲）；沒有任務的專案不顯示 chip、顯示「尚無任務」', () => {
    const { container } = setup();
    const chip = card(container, 'TTXC 虎姑婆 駁二').querySelector('.pchip');
    expect(txt(chip)).toBe('有逾期');
    expect(chip.querySelector('svg title').textContent).toBe('烏雲');
    const empty = setup({ projects: [...FIXTURE_PROJECTS, { id: 'p99', name: '空專案', sortOrder: 99, createdAt: '2026-02-01T00:00:00Z' }] }).container;
    const e = card(empty, '空專案');
    expect(e.querySelector('.pchip')).toBeNull();
    expect(e.textContent).toContain('尚無任務');
  });

  it('點卡片或名稱 → onOpenProject(id)；Archive／Delete 不會誤開', () => {
    const { container } = setup();
    const c = card(container, '科教館公益展廳');
    fireEvent.click(c.querySelector('.pname'));
    expect(onOpenProject).toHaveBeenLastCalledWith('p2');
    fireEvent.click(c.querySelector('.meta'));
    expect(onOpenProject).toHaveBeenCalledTimes(2);
    onOpenProject.mockClear();
    fireEvent.click(within(c).getByText('Archive'));
    expect(actions.archive).toHaveBeenCalledWith('p2');
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it('Delete 要確認：取消不刪、確定才呼叫 remove(id)；訊息帶專案名', () => {
    const { container } = setup();
    const c = card(container, '發行事務');
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(within(c).getByText('Delete'));
    expect(actions.remove).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenLastCalledWith('確認刪除專案「發行事務」嗎？');
    fireEvent.click(within(c).getByText('Delete'));
    expect(actions.remove).toHaveBeenCalledWith('p4');
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it('有 bannerUrl 的專案頭像顯示圖片，其餘用首字母', () => {
    const projects = FIXTURE_PROJECTS.map((p) => (p.id === 'p1' ? { ...p, bannerUrl: 'https://img.example/p1.png' } : p));
    const { container } = setup({ projects });
    expect(card(container, 'TTXC 虎姑婆 駁二').querySelector('.av img').getAttribute('src')).toBe('https://img.example/p1.png');
    expect(card(container, '科教館公益展廳').querySelector('.av img')).toBeNull();
  });
});

describe('Projects：明細視圖（projectsView=list）', () => {
  it('每列：名稱｜狀況 chip｜進度條＋百分比｜「狀態 數字」標籤｜眼睛；沒有 Archive／Delete', () => {
    const { container } = setup({ settings: { projectsView: 'list' } });
    expect(container.querySelector('.pgrid')).toBeNull();
    const rows = container.querySelectorAll('.plist .prow');
    expect(rows).toHaveLength(10);
    const r = rows[0];
    expect(r.querySelector('.nm button').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(r.querySelector('.nm .hint').textContent).toBe('8 tasks · 15 subtasks');
    expect(txt(r.querySelector('.pchip'))).toBe('有逾期');
    expect(r.querySelector('.pb .bar').getAttribute('aria-valuenow')).toBe('54');
    expect(txt(r.querySelector('.pb b'))).toBe('54%');
    expect([...r.querySelectorAll('.sts .st')].map((s) => s.textContent)).toEqual(['已完成 2', '進行中 3', '待辦 1', '暫緩 1', '待確認 1']);
    expect(r.querySelector('button.iconx')).toBeTruthy();
    expect(within(r).queryByText('Archive')).toBeNull();
  });

  it('點列 → onOpenProject(id)；點眼睛不開', () => {
    const { container } = setup({ settings: { projectsView: 'list' } });
    const r = container.querySelectorAll('.prow')[3];
    fireEvent.click(r.querySelector('.nm button'));
    expect(onOpenProject).toHaveBeenLastCalledWith('p4');
    onOpenProject.mockClear();
    fireEvent.click(r.querySelector('button.iconx'));
    expect(onOpenProject).not.toHaveBeenCalled();
  });
});

describe('Projects：工具列', () => {
  it('卡片／明細切換寫入 projectsView（沿用既有 key），目前值 aria-pressed', () => {
    setup();
    const seg = screen.getByRole('group', { name: '檢視模式' });
    expect(within(seg).getByText('卡片').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(seg).getByText('明細'));
    expect(updateSetting).toHaveBeenCalledWith('projectsView', 'list');
  });

  it('排序下拉：手動／名稱／建立時間／進度；改成依進度立即重排', () => {
    const { container } = setup();
    const sel = screen.getByRole('combobox', { name: '排序' });
    expect([...sel.options].map((o) => o.textContent)).toEqual(['手動排序', '依名稱', '依建立時間', '依進度']);
    fireEvent.change(sel, { target: { value: 'progress' } });
    expect([...container.querySelectorAll('.pgrid .pname')].slice(0, 3).map((n) => n.textContent)).toEqual(['兒少內容有限合夥', '科教館公益展廳', '大雲Youtube Channel']);
    fireEvent.change(sel, { target: { value: 'created' } });
    expect(container.querySelector('.pgrid .pname').textContent).toBe('2027新年禮盒');
  });

  it('Archived (1) 按鈕：預設收合，點了展開／再點收合（aria-pressed）', () => {
    const { container } = setup();
    const b = screen.getByRole('button', { name: 'Archived (1)' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('section[aria-label="已封存專案"]')).toBeNull();
    fireEvent.click(b);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('section[aria-label="已封存專案"]')).toBeTruthy();
    fireEvent.click(b);
    expect(container.querySelector('section[aria-label="已封存專案"]')).toBeNull();
  });
});

describe('Projects：眼睛（hiddenProjects）', () => {
  it('預設全部顯示（aria-pressed=true）；點了寫入 hiddenProjects=[id]', () => {
    const { container } = setup();
    const eye = card(container, 'TTXC 虎姑婆 駁二').querySelector('button.iconx');
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(eye.getAttribute('aria-label')).toBe('在 Timeline 顯示「TTXC 虎姑婆 駁二」');
    fireEvent.click(eye);
    expect(updateSetting).toHaveBeenCalledWith('hiddenProjects', ['p1']);
  });

  it('已隱藏：aria-pressed=false、title 變「在 Timeline 顯示」；再點就移除', () => {
    const { container } = setup({ settings: { hiddenProjects: ['p1', 'p2'] } });
    const eye = card(container, 'TTXC 虎姑婆 駁二').querySelector('button.iconx');
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    expect(eye.getAttribute('title')).toBe('在 Timeline 顯示');
    fireEvent.click(eye);
    expect(updateSetting).toHaveBeenCalledWith('hiddenProjects', ['p2']);
  });
});

describe('Projects：權限（viewer 唯讀）', () => {
  it('viewer：沒有 + Create、Archive／Delete、拖曳把手；眼睛、排序、切換仍可用', () => {
    const { container } = setup({ role: 'viewer' });
    expect(screen.queryByText('+ Create')).toBeNull();
    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(container.querySelectorAll('.grip')).toHaveLength(0);
    expect(container.querySelectorAll('button.iconx')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }));
    expect(screen.queryByText('Unarchive')).toBeNull();
    fireEvent.click(container.querySelector('button.iconx'));
    expect(updateSetting).toHaveBeenCalledTimes(1);
  });

  it('viewer 的明細視圖同樣沒有拖曳把手', () => {
    const { container } = setup({ role: 'viewer', settings: { projectsView: 'list' } });
    expect(container.querySelectorAll('.grip')).toHaveLength(0);
  });
});

describe('Projects：手動排序拖曳（@dnd-kit，同舊版）', () => {
  it('admin＋手動排序：每張卡一個把手；換成非手動排序就沒有', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.pcard .grip')).toHaveLength(10);
    expect(container.querySelector('.grip').getAttribute('aria-label')).toContain('拖移排序「TTXC 虎姑婆 駁二」');
    fireEvent.change(screen.getByRole('combobox', { name: '排序' }), { target: { value: 'name' } });
    expect(container.querySelectorAll('.grip')).toHaveLength(0);
  });

  it('明細視圖也有把手（手動排序時）', () => {
    const { container } = setup({ settings: { projectsView: 'list' } });
    expect(container.querySelectorAll('.prow .grip')).toHaveLength(10);
  });
});

describe('Projects：+ Create（沿用舊建立流程：名稱 → Confirm）', () => {
  it('點 + Create 出現輸入框；沒填名稱 Confirm 為 disabled；Cancel 收起', () => {
    setup();
    fireEvent.click(screen.getByText('+ Create'));
    const input = screen.getByRole('textbox', { name: '新專案名稱' });
    expect(screen.getByText('Confirm').disabled).toBe(true);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('textbox', { name: '新專案名稱' })).toBeNull();
    expect(screen.getByText('+ Create')).toBeTruthy();
    expect(input.isConnected).toBe(false);
  });

  it('輸入名稱 → Confirm → add(trim 後名稱)；成功就收起並開啟新專案', async () => {
    setup();
    fireEvent.click(screen.getByText('+ Create'));
    fireEvent.change(screen.getByRole('textbox', { name: '新專案名稱' }), { target: { value: '  新專案  ' } });
    fireEvent.click(screen.getByText('Confirm'));
    expect(actions.add).toHaveBeenCalledWith('新專案');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: '新專案名稱' })).toBeNull());
    expect(onOpenProject).toHaveBeenCalledWith('pNew');
  });

  it('Enter 送出；Esc 取消；失敗（回 error）時保留輸入框', async () => {
    setup();
    fireEvent.click(screen.getByText('+ Create'));
    const input = screen.getByRole('textbox', { name: '新專案名稱' });
    actions.add.mockResolvedValueOnce({ error: '名稱重複' });
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(actions.add).toHaveBeenCalledWith('X'));
    expect(screen.getByRole('textbox', { name: '新專案名稱' })).toBeTruthy();
    expect(onOpenProject).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: '新專案名稱' })).toBeNull();
  });
});

describe('Projects：封存區', () => {
  it('展開後：淡紫雲標題、說明、封存卡（頭像＋名稱＋tasks）、Unarchive／Delete', () => {
    const { container } = setup({ initialShowArch: true });
    const sec = container.querySelector('section[aria-label="已封存專案"]');
    const h = sec.querySelector('.archh');
    expect(h.querySelector('svg title').textContent).toBe('淡紫雲');
    expect(h.textContent).toContain('已封存');
    expect(h.textContent).toContain('1 個');
    const a = sec.querySelector('.pcard.arch');
    expect(a.querySelector('b').textContent).toBe('臨時動議');
    expect(a.querySelector('.hint').textContent).toBe('2 tasks');
    expect([...a.querySelectorAll('button:not(.pname)')].map((b) => b.textContent)).toEqual(['Unarchive', 'Delete']);
  });

  it('Unarchive → unarchive(id)；Delete 需確認 → remove(id)；都不開專案', () => {
    setup({ initialShowArch: true });
    fireEvent.click(screen.getByText('Unarchive'));
    expect(actions.unarchive).toHaveBeenCalledWith('p10');
    const del = within(document.querySelector('.pcard.arch')).getByText('Delete');
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(del);
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(del);
    expect(actions.remove).toHaveBeenCalledWith('p10');
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it('沒有封存專案：空狀態文案', () => {
    const { container } = setup({ initialShowArch: true, projects: FIXTURE_PROJECTS.map((p) => ({ ...p, archivedAt: null })) });
    expect(container.querySelector('.empty.dashed').textContent).toContain('沒有已封存的專案');
    expect(screen.getByRole('button', { name: 'Archived (0)' })).toBeTruthy();
  });

  it('封存卡點擊 → 開啟專案', () => {
    const { container } = setup({ initialShowArch: true });
    fireEvent.click(container.querySelector('.pcard.arch b'));
    expect(onOpenProject).toHaveBeenCalledWith('p10');
  });
});

describe('Projects：零副作用', () => {
  it('不直接呼叫 server action（寫入都走 actions／updateSetting）', () => {
    const { container } = setup();
    fireEvent.click(screen.getByText('+ Create'));
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(container.querySelector('button.iconx'));
    expect(boom).not.toHaveBeenCalled();
  });
});
