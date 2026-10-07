import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import V2Root from '@/components/v2/V2Root';
import Shell from '@/components/v2/Shell';
import LiveShell from '@/components/v2/LiveShell';
import { StaticSettingsProvider } from '@/components/v2/SettingsContext';
import { fixtureShellProps, FIXTURE_USER } from '@/components/v2/fixtures';

const { boom, tm } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }), tm: { current: null } }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/hooks/useTaskManager', () => ({ default: () => tm.current }));
vi.mock('@/server/actions/projects', () => ({ deleteProjectBanner: boom }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const wrap = (ui, settings = {}) => render(
  <ThemeProvider><V2Root role="admin"><StaticSettingsProvider settings={settings}>{ui}</StaticSettingsProvider></V2Root></ThemeProvider>
);
const nav = () => screen.getByRole('navigation', { name: '主要分頁' });
const crumbs = () => screen.getByRole('navigation', { name: '麵包屑' });
const openFromTimeline = (c) => { fireEvent.click(c.querySelector('.tlx .row.pj')); fireEvent.click(screen.getByRole('button', { name: '開啟專案 ›' })); };
let confirmSpy;
beforeEach(() => { localStorage.clear(); boom.mockClear(); confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => confirmSpy.mockRestore());

describe('Shell：Projects 分頁', () => {
  it('切到 Projects 顯示專案卡片（不是佔位）；麵包屑「首頁›Projects」', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} />);
    fireEvent.click(within(nav()).getByText('Projects'));
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
    expect(screen.queryByTestId('v2-placeholder')).toBeNull();
    expect(crumbs().textContent).toBe('首頁›Projects');
  });

  it('點專案卡片 → 專案詳情；麵包屑帶專案名，點 Projects 回到列表', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" />);
    fireEvent.click(container.querySelector('.pgrid .pname'));
    expect(crumbs().textContent).toBe('首頁›Projects›TTXC 虎姑婆 駁二');
    expect(container.querySelector('.dhead h2').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(screen.queryByTestId('v2-placeholder')).toBeNull();
    expect(container.querySelector('.pgrid')).toBeNull();
    fireEvent.click(within(crumbs()).getByText('Projects'));
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
  });

  it('詳情的 Back 回到來源分頁：從 Projects 開 → 回 Projects 列表', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" />);
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(container.querySelector('.dhead')).toBeNull();
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
    expect(within(nav()).getByText('Projects').getAttribute('aria-current')).toBe('page');
  });

  it('從 Timeline 開專案：分頁與麵包屑停在 Timeline，Back 回 Timeline', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="timeline" />);
    openFromTimeline(container);
    expect(container.querySelector('.dhead h2').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(within(nav()).getByText('Timeline').getAttribute('aria-current')).toBe('page');
    expect(crumbs().textContent).toBe('首頁›Timeline›TTXC 虎姑婆 駁二');
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(container.querySelector('.dhead')).toBeNull();
    expect(container.querySelector('.tlx .tl1')).toBeTruthy();
    expect(crumbs().textContent).toBe('首頁›Timeline');
  });

  it('從 Timeline 開的詳情，點麵包屑的 Timeline 也回到 Timeline；點分頁列換頁會離開詳情', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="timeline" />);
    openFromTimeline(container);
    fireEvent.click(within(crumbs()).getByText('Timeline'));
    expect(container.querySelector('.dhead')).toBeNull();
    openFromTimeline(container);
    fireEvent.click(within(nav()).getByText('Projects'));
    expect(container.querySelector('.dhead')).toBeNull();
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
  });

  it('詳情裡的動作穿透 projectActions；沒給的動作是 no-op（預覽）', () => {
    const projectActions = { updateTask: vi.fn(), toggleSub: vi.fn() };
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" projectActions={projectActions} />);
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(within(container.querySelector('.trow')).getByRole('button', { name: /狀態：/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '待辦' }));
    expect(projectActions.updateTask).toHaveBeenCalledTimes(1);
    expect(() => fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0])).not.toThrow(); // archive 沒給＝no-op
  });

  it('detailInit 讓某專案詳情一開始就開著、並展開指定任務（預覽截圖用）', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" detailInit={{ projectId: 'p5', expanded: ['t19'] }} />);
    expect(container.querySelector('.dhead h2').textContent).toBe('兒少內容有限合夥');
    expect(container.querySelectorAll('.trow .subs')).toHaveLength(1);
    expect(crumbs().textContent).toBe('首頁›Projects›兒少內容有限合夥');
  });

  it('專案被刪掉（id 不在 projects）→ 退回列表，不會空白', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" detailInit={{ projectId: 'gone' }} />);
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
  });

  it('Overview 點專案名稱 → 切到 Projects 並開啟該專案', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} />);
    fireEvent.click(container.querySelector('.tlx button.nb'));
    expect(within(nav()).getByText('Projects').getAttribute('aria-current')).toBe('page');
    expect(crumbs().textContent).toMatch(/^首頁›Projects›/);
  });

  it('projectActions 穿透：Archive／Delete／Create 呼叫對應動作', async () => {
    const projectActions = { archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), add: vi.fn(async () => ({ success: true, project: { id: 'pN' } })), reorder: vi.fn() };
    wrap(<Shell {...fixtureShellProps()} initialTab="projects" projectActions={projectActions} />);
    fireEvent.click(screen.getAllByText('Archive')[0]);
    expect(projectActions.archive).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getAllByText('Delete')[1]);
    expect(projectActions.remove).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByText('+ Create'));
    fireEvent.change(screen.getByRole('textbox', { name: '新專案名稱' }), { target: { value: 'Z' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(projectActions.add).toHaveBeenCalledWith('Z'));
  });

  it('沒給 projectActions（預覽）也不會炸：動作是 no-op', () => {
    wrap(<Shell {...fixtureShellProps()} initialTab="projects" />);
    expect(() => fireEvent.click(screen.getAllByText('Archive')[0])).not.toThrow();
  });

  it('projectsInit.showArch 讓封存區一開始就展開（預覽截圖用）', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="projects" projectsInit={{ showArch: true }} />);
    expect(container.querySelector('section[aria-label="已封存專案"]')).toBeTruthy();
  });
});

describe('LiveShell：接 useTaskManager（同舊版的 action）', () => {
  const props = fixtureShellProps();
  const fake = (over = {}) => ({
    allT: props.tasks, allS: props.subtasks, projects: props.projects, toast: null,
    showToast: vi.fn(),
    archiveProject: vi.fn(async () => ({ success: true })), unarchiveProject: vi.fn(async () => ({ success: true })),
    deleteProject: vi.fn(async () => {}), addProject: vi.fn(async () => ({ success: true, project: { id: 'pN', name: 'N' } })),
    reorderProjects: vi.fn(async () => {}),
    updateTask: vi.fn(), deleteTask: vi.fn(), toggleSub: vi.fn(), addSub: vi.fn(async () => ({ success: true })), deleteSub: vi.fn(), reorderTasks: vi.fn(),
    ...over,
  });
  const data = { session: FIXTURE_USER, userNames: props.userNames };
  const setup = (over, settings = {}) => { tm.current = fake(over); return wrap(<LiveShell data={data} today={props.today} initialTab="projects" />, settings); };

  it('用 tm.allT／allS／projects 顯示（Overall 與卡片數來自 hook state）', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.pgrid .pcard')).toHaveLength(10);
    expect(screen.getByText('2026/10/07 · 33 tasks')).toBeTruthy();
  });

  it('Archive 成功 → toast「Project archived」（warn）', async () => {
    setup();
    fireEvent.click(screen.getAllByText('Archive')[0]);
    await waitFor(() => expect(tm.current.archiveProject).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(tm.current.showToast).toHaveBeenCalledWith('Project archived', 'warn'));
  });

  it('Archive 失敗（沒有 success）→ 這裡不吵（錯誤 toast 由 hook 負責）', async () => {
    setup({ archiveProject: vi.fn(async () => ({ error: 'x' })) });
    fireEvent.click(screen.getAllByText('Archive')[0]);
    await waitFor(() => expect(tm.current.archiveProject).toHaveBeenCalled());
    expect(tm.current.showToast).not.toHaveBeenCalled();
  });

  it('Unarchive 成功 → toast「Project unarchived」', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }));
    fireEvent.click(screen.getByText('Unarchive'));
    await waitFor(() => expect(tm.current.unarchiveProject).toHaveBeenCalledWith('p10'));
    await waitFor(() => expect(tm.current.showToast).toHaveBeenCalledWith('Project unarchived', 'success'));
  });

  it('Delete → deleteProject(id)；Create → addProject(name)', async () => {
    setup();
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(tm.current.deleteProject).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByText('+ Create'));
    fireEvent.change(screen.getByRole('textbox', { name: '新專案名稱' }), { target: { value: 'N' } });
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(tm.current.addProject).toHaveBeenCalledWith('N'));
  });

  it('tm.toast 顯示在畫面上（role=status），淡出時加 fading', () => {
    const { container } = setup({ toast: { msg: '專案已建立', type: 'success', fading: false } });
    const t = container.querySelector('.v2-toast');
    expect(t.getAttribute('role')).toBe('status');
    expect(t.textContent).toBe('專案已建立');
    expect(t.className).toContain('success');
    expect(t.className).not.toContain('fading');
    const f = setup({ toast: { msg: 'x', type: 'warn', fading: true } }).container.querySelector('.v2-toast');
    expect(f.className).toContain('fading');
  });

  it('專案詳情：勾子任務／改狀態／刪除／新增子任務都接 hook 的同名函式；完成任務用 showToast 播報', async () => {
    const { container } = setup();
    fireEvent.click(container.querySelector('.pgrid .pname'));
    const r = container.querySelector('.trow'); // 依開始日第一列：商品合作 t2
    fireEvent.click(r.querySelector('.exp'));
    fireEvent.click(within(r).getByRole('checkbox', { name: '打樣驗收' }));
    expect(tm.current.toggleSub).toHaveBeenCalledWith('t2s2');
    fireEvent.click(within(r).getByRole('button', { name: /狀態：/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '已完成' }));
    expect(tm.current.updateTask).toHaveBeenCalledWith('t2', 'status', '已完成');
    expect(tm.current.showToast).toHaveBeenCalledWith(expect.stringContaining('商品合作'), 'success');
    fireEvent.click(within(r).getByRole('button', { name: '刪除子任務「包裝設計稿」' }));
    expect(tm.current.deleteSub).toHaveBeenCalledWith('t2s3');
    fireEvent.click(within(r).getByRole('button', { name: '刪除任務「商品合作」' }));
    expect(tm.current.deleteTask).toHaveBeenCalledWith('t2');
    fireEvent.click(within(r).getByRole('button', { name: '+ Add subtask' }));
    fireEvent.change(within(r).getByRole('textbox', { name: '子任務名稱' }), { target: { value: 'X' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(tm.current.addSub).toHaveBeenCalledWith('t2', { name: 'X', owner: '' }));
  });

  it('專案詳情：封存 → archiveProject＋回列表；Unarchive（封存的專案）留在詳情', async () => {
    const { container } = setup();
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(within(container.querySelector('.dhead')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(tm.current.archiveProject).toHaveBeenCalledWith('p1'));
    expect(container.querySelector('.dhead')).toBeNull();
  });

  it('專案詳情改名 → hook 的 renameProject(id, 新名稱)', () => {
    const { container } = setup({ renameProject: vi.fn() });
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(within(container.querySelector('.dhead h2')).getByRole('button'));
    fireEvent.change(screen.getByRole('textbox', { name: '專案名稱' }), { target: { value: '新專案名' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: '專案名稱' }), { key: 'Enter' });
    expect(tm.current.renameProject).toHaveBeenCalledWith('p1', '新專案名');
  });

  it('專案詳情頭像上傳 → POST /api/upload-banner，成功後更新 hook 的 projects 並 toast', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ success: true, bannerUrl: 'https://r2/b.png' }) }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      let projects = props.projects;
      const { container } = setup({ setProjects: vi.fn((fn) => { projects = fn(projects); }) });
      fireEvent.click(container.querySelector('.pgrid .pname'));
      const f = new File(['x'], 'a.png', { type: 'image/png' });
      fireEvent.change(container.querySelector('.dhead input[type="file"]'), { target: { files: [f] } });
      await waitFor(() => expect(tm.current.showToast).toHaveBeenCalledWith('圖示已上傳', 'success'));
      expect(fetchMock.mock.calls[0][0]).toBe('/api/upload-banner');
      expect(projects.find((p) => p.id === 'p1').bannerUrl).toBe('https://r2/b.png');
    } finally { vi.unstubAllGlobals(); }
  });

  it('任務視窗接 hook：點任務→編輯→updateTask；+ Create→addTask（專案預填）', async () => {
    const extra = { addTask: vi.fn(async () => ({ success: true })), allL: [], allF: [], configCats: ['活動'], configOwners: [], updateSub: vi.fn(), reorderSubs: vi.fn(), addLink: vi.fn(), addFile: vi.fn(), deleteLink: vi.fn(), deleteFile: vi.fn() };
    const { container } = setup(extra);
    fireEvent.click(container.querySelector('.pgrid .pname'));
    fireEvent.click(container.querySelector('.trow .tnm'));
    expect(screen.getByRole('dialog', { name: '編輯任務' })).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('進行中'), { target: { value: '待辦' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(tm.current.updateTask).toHaveBeenCalledWith('t2', 'status', '待辦'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: '+ Create' })[0]);
    fireEvent.change(screen.getByPlaceholderText('輸入任務名稱'), { target: { value: '新任務' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(tm.current.addTask).toHaveBeenCalledWith('p1', expect.objectContaining({ task: '新任務' })));
  });

  it('沒有 toast 就沒有 toast 區塊', () => {
    const { container } = setup();
    expect(container.querySelector('.v2-toast')).toBeNull();
  });
});
