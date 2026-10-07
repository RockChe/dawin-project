import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import ProjectDetail from '@/components/v2/ProjectDetail';
import { buildTwp } from '@/lib/v2Data';
import { TASK_VIEW_DEFAULT } from '@/lib/v2ProjectDetail';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

// 拖移：jsdom 做不出真的拖曳，攔下 DndContext 的 onDragEnd 直接呼叫
const { dnd, boom } = vi.hoisted(() => ({ dnd: { onDragEnd: null }, boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@dnd-kit/core', async (orig) => ({ ...(await orig()), DndContext: (p) => { dnd.onDragEnd = p.onDragEnd; return p.children; } }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/server/actions/projects', () => new Proxy({}, { get: () => boom }));
vi.mock('@/server/actions/tasks', () => new Proxy({}, { get: () => boom }));

const P1 = FIXTURE_PROJECTS[0];
const EMPTY = { id: 'pEmpty', name: '空專案', sortOrder: 99, archivedAt: null };
const mkTwp = (tasks = FIXTURE_TASKS, subs = FIXTURE_SUBTASKS, projects = [...FIXTURE_PROJECTS, EMPTY]) => buildTwp(tasks, subs, projects, FIXTURE_TODAY);
let actions, updateSetting, onBack, onOpenTask, confirmSpy;

const setup = ({ role = 'admin', level = 'full', settings = {}, project = P1, tasks, subs = FIXTURE_SUBTASKS, ...over } = {}) => {
  const projects = [...FIXTURE_PROJECTS, EMPTY];
  const twp = mkTwp(tasks, subs, projects);
  actions = { archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), toggleSub: vi.fn(), addSub: vi.fn(async () => ({ success: true })), deleteSub: vi.fn(), reorderTasks: vi.fn(), notify: vi.fn(), rename: vi.fn(), uploadBanner: vi.fn(), removeBanner: vi.fn() };
  updateSetting = vi.fn(async () => ({ success: true }));
  onBack = vi.fn(); onOpenTask = vi.fn();
  const ui = (p) => (
    <PermissionProvider role={role}>
      <CloudLevelProvider level={level}>
        <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
          <ProjectDetail project={project} projects={projects} twp={twp} subtasks={p?.subs ?? subs} userNames={FIXTURE_OWNERS} today={FIXTURE_TODAY} actions={actions} onBack={onBack} onOpenTask={onOpenTask} {...over} />
        </V2SettingsProvider>
      </CloudLevelProvider>
    </PermissionProvider>
  );
  const r = render(ui());
  return { ...r, rerenderSubs: (s) => r.rerender(ui({ subs: s })) };
};
// 雲朵 svg 內含 <title>，比對文字前先拿掉
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); return c.textContent; };
const rowOf = (c, name) => [...c.querySelectorAll('.trow')].find((r) => r.querySelector('.tnm').textContent === name);
const names = (c) => [...c.querySelectorAll('.trow .tnm')].map((n) => n.textContent);
const view = (o) => ({ settings: { projectTaskView: { ...TASK_VIEW_DEFAULT, ...o } } });
beforeEach(() => { boom.mockClear(); dnd.onDragEnd = null; confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => confirmSpy.mockRestore());

describe('ProjectDetail：頭部與側欄統計', () => {
  it('頭像字、名稱、tasks／subtasks／done 統計、狀況 chip', () => {
    const { container } = setup();
    expect(container.querySelector('.dhead .av.lg').textContent).toBe('T');
    expect(container.querySelector('.dhead h2').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(container.querySelector('.dhead .meta').textContent).toBe('8 tasks · 15 subtasks · 8 done');
    expect(txt(container.querySelector('.dhead .pchip'))).toBe('有逾期');
  });

  it('有 bannerUrl 用圖片當頭像', () => {
    const { container } = setup({ project: { ...P1, bannerUrl: '/b.png' } });
    expect(container.querySelector('.dhead .av.lg img').getAttribute('src')).toBe('/b.png');
  });

  it('建立者與來源標籤（有才顯示）', () => {
    const { container } = setup({ project: { ...P1, creatorName: 'Karen', source: 'csv_import' } });
    expect(container.querySelector('.dhead .by').textContent).toContain('Karen');
    expect(container.querySelector('.dhead .by .badge').textContent).toBe('CSV匯入');
    expect(setup({ project: { ...P1, creatorName: 'Karen' } }).container.querySelector('.dhead .by .badge').textContent).toBe('手動');
    expect(setup().container.querySelector('.dhead .by')).toBeNull();
  });

  it('頭部領先／落後白話天數（綠／琥珀色）；進度同步則不顯示', () => {
    const ahead = setup({ project: FIXTURE_PROJECTS[8] }).container.querySelector('.dhead .gapx');
    expect(ahead.className).toContain('c-green');
    expect(ahead.textContent).toMatch(/^領先約 \d+ 天（\d+ 點）$/);
    expect(setup().container.querySelector('.dhead .gapx')).toBeNull(); // p1 進度同步
  });

  it('側欄：Progress 54%、時間已過、Subtasks 8/15、狀態 chip 帶件數', () => {
    const { container } = setup();
    const cards = container.querySelectorAll('.mcard');
    expect(txt(cards[0].querySelector('.big'))).toBe('54%');
    expect(cards[0].textContent).toContain('時間已過');
    expect(cards[0].querySelector('.runner svg')).toBeTruthy();
    expect(txt(cards[1].querySelector('.big'))).toBe('8/15');
    expect([...cards[2].querySelectorAll('.chip.sc')].map((c) => c.textContent)).toEqual(['已完成 2', '進行中 3', '待辦 1', '暫緩 1', '待確認 1']);
  });

  it('Back 回到來源', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectDetail：任務列表', () => {
  it('預設依開始日升冪', () => {
    const { container } = setup();
    expect(names(container)).toEqual(['商品合作', '票務展務相關', '展覽文宣與視覺設計', '駁二場地動線規劃', '虎姑婆周邊打樣確認', '新聞稿發送', '開幕記者會', '兒童工作坊加場']);
    expect(container.querySelector('.tcard .h').textContent).toContain('Tasks');
    expect(container.querySelector('.tcard .h .mono')).toBeNull(); // 沒篩選不顯示 n / total
  });

  it('一列：名稱、執行人與關注人（只關注標「關注」）、起訖日、狀態、子任務進度', () => {
    const { container } = setup();
    const r = rowOf(container, '票務展務相關');
    expect([...r.querySelectorAll('.ln .pp')].map((p) => p.textContent)).toEqual(['Rock', 'Karen', 'Oliver', '幸真關注']);
    expect(r.querySelector('.ln .mono').textContent).toBe('2026/08/20 → 2026/09/25');
    expect(r.querySelector('.stw .st').textContent.trim()).toBe('進行中');
    expect(r.querySelector('.pgs small').textContent).toBe('3/5 子任務');
    expect(r.querySelector('.pgs .bar').getAttribute('aria-valuenow')).toBe('60');
  });

  it('沒有子任務：進度「N% · 依時間」；admin 仍有展開鈕（才加得了第一個子任務）、viewer 沒有；沒指派顯示「未指派」', () => {
    const { container } = setup();
    const r = rowOf(container, '駁二場地動線規劃');
    expect(r.querySelector('.pgs small').textContent).toMatch(/^\d+% · 依時間$/);
    fireEvent.click(r.querySelector('.exp'));
    expect(r.querySelectorAll('.sub')).toHaveLength(0);
    expect(within(r).getByRole('button', { name: '+ Add subtask' })).toBeTruthy();
    expect(rowOf(setup({ role: 'viewer' }).container, '駁二場地動線規劃').querySelector('.exp')).toBeNull();
    const unassigned = setup({ tasks: [{ ...FIXTURE_TASKS[2], owner: '' }] }).container;
    expect(unassigned.querySelector('.ln .hint').textContent).toBe('未指派');
  });

  it('子任務預設收合；點展開鈕展開（名稱、備註、負責人、勾選狀態），再點收合', () => {
    const { container } = setup();
    const r = rowOf(container, '票務展務相關');
    expect(r.querySelector('.subs')).toBeNull();
    const exp = r.querySelector('.exp');
    expect(exp.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(exp);
    expect(exp.getAttribute('aria-expanded')).toBe('true');
    const subs = [...r.querySelectorAll('.sub')];
    expect(subs.map((s) => s.querySelector('.nm').textContent)).toEqual(['售票系統串接', '展期場次排程', '駁二場租合約簽署', '現場人力排班', 'FAQ 準備']);
    expect(subs.map((s) => s.querySelector('[role=checkbox]').getAttribute('aria-checked'))).toEqual(['true', 'true', 'true', 'false', 'false']);
    expect(subs[0].querySelector('.nm').className).toContain('done');
    expect(subs[0].querySelector('.nt').textContent).toBe('KKTIX 已串好');
    expect(subs[0].querySelector('.pp').textContent).toBe('Rock');
    fireEvent.click(exp);
    expect(r.querySelector('.subs')).toBeNull();
  });

  it('展開鈕有 aria-label（展開／收合子任務）', () => {
    const { container } = setup();
    const exp = rowOf(container, '票務展務相關').querySelector('.exp');
    expect(exp.getAttribute('aria-label')).toBe('展開子任務');
    fireEvent.click(exp);
    expect(exp.getAttribute('aria-label')).toBe('收合子任務');
  });

  it('隱藏已完成子任務：開關寫入 projectTaskView.hideDoneSubs；開啟後只列未完成並提示隱藏數量', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: '隱藏已完成子任務' }));
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, hideDoneSubs: true });
    expect(screen.getByRole('button', { name: '隱藏已完成子任務' }).getAttribute('aria-pressed')).toBe('false');
    const on = setup(view({ hideDoneSubs: true }));
    expect(within(on.container.querySelector('.tbar2')).getByRole('button', { name: '隱藏已完成子任務' }).getAttribute('aria-pressed')).toBe('true');
    const r = rowOf(on.container, '票務展務相關');
    fireEvent.click(r.querySelector('.exp'));
    expect([...r.querySelectorAll('.sub .nm')].map((n) => n.textContent)).toEqual(['現場人力排班', 'FAQ 準備']);
    expect(r.querySelector('.subs > .hint').textContent).toBe('已隱藏 3 個已完成子任務（進度仍以全部計）');
    expect(r.querySelector('.pgs small').textContent).toBe('3/5 子任務'); // 進度仍以全部計
    expect(container).toBeTruthy();
  });

  it('勾子任務 → toggleSub(子任務 id)；勾完最後一個也「不會」自動改任務狀態', () => {
    const { container } = setup({ project: FIXTURE_PROJECTS[4] }); // t19 只剩「追蹤事項」沒勾
    const r = rowOf(container, '合夥人月會');
    fireEvent.click(r.querySelector('.exp'));
    fireEvent.click(within(r).getByRole('checkbox', { name: '追蹤事項' }));
    expect(actions.toggleSub).toHaveBeenCalledWith('t19s3');
    expect(actions.updateTask).not.toHaveBeenCalled();
  });

  it('全部子任務都勾完（任務還沒完成）→ 列內提示「可以改成已完成了」＋按鈕；按了才改狀態並播報', () => {
    const alldone = FIXTURE_SUBTASKS.map((s) => (s.taskId === 't19' ? { ...s, done: true } : s));
    const { container, rerenderSubs } = setup({ project: FIXTURE_PROJECTS[4], subs: FIXTURE_SUBTASKS });
    const r = () => rowOf(container, '合夥人月會');
    expect(r().querySelector('.hdone')).toBeNull();
    rerenderSubs(alldone);
    const hint = r().querySelector('.hdone');
    expect(hint.getAttribute('role')).toBe('note');
    expect(hint.textContent).toContain('可以改成已完成了');
    expect(actions.updateTask).not.toHaveBeenCalled(); // 只提示，不自動改
    fireEvent.click(within(hint).getByRole('button', { name: '改成已完成' }));
    expect(actions.updateTask).toHaveBeenCalledWith('t19', 'status', '已完成');
    expect(actions.notify).toHaveBeenCalledWith(expect.stringContaining('合夥人月會'), 'success');
  });

  it('已完成的任務、或 viewer，不出現「改成已完成」按鈕', () => {
    const alldone = FIXTURE_SUBTASKS.map((s) => (s.taskId === 't19' ? { ...s, done: true } : s));
    const { container } = setup({ project: FIXTURE_PROJECTS[4], subs: alldone, role: 'viewer' });
    const hint = rowOf(container, '合夥人月會').querySelector('.hdone');
    expect(hint.textContent).toContain('可以改成已完成了');
    expect(within(hint).queryByRole('button')).toBeNull();
    expect(setup().container.querySelector('.hdone')).toBeNull(); // p1：t6 已完成、其餘沒勾完
  });

  it('狀態選單：開啟列出 6 種狀態、選一個 → updateTask(id,"status",值)；選已完成另外播報', () => {
    const { container } = setup();
    const r = rowOf(container, '駁二場地動線規劃');
    const btn = within(r).getByRole('button', { name: /狀態：待辦/ });
    fireEvent.click(btn);
    const menu = within(r).getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['已完成', '進行中', '待辦', '暫緩', '提案中', '待確認']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: '進行中' }));
    expect(actions.updateTask).toHaveBeenCalledWith('t3', 'status', '進行中');
    expect(actions.notify).not.toHaveBeenCalled();
    expect(within(r).queryByRole('menu')).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: /狀態：待辦/ }));
    fireEvent.click(within(within(r).getByRole('menu')).getByRole('menuitem', { name: '已完成' }));
    expect(actions.updateTask).toHaveBeenLastCalledWith('t3', 'status', '已完成');
    expect(actions.notify).toHaveBeenCalledWith(expect.stringContaining('駁二場地動線規劃'), 'success');
  });

  it('選目前的狀態＝不動作', () => {
    const { container } = setup();
    const r = rowOf(container, '駁二場地動線規劃');
    fireEvent.click(within(r).getByRole('button', { name: /狀態：待辦/ }));
    fireEvent.click(within(within(r).getByRole('menu')).getByRole('menuitem', { name: '待辦' }));
    expect(actions.updateTask).not.toHaveBeenCalled();
  });

  it('刪除任務：確認後 deleteTask；取消不刪', () => {
    const { container } = setup();
    fireEvent.click(within(rowOf(container, '新聞稿發送')).getByRole('button', { name: /刪除任務/ }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(actions.deleteTask).toHaveBeenCalledWith('t7');
    actions.deleteTask.mockClear(); confirmSpy.mockReturnValue(false);
    fireEvent.click(within(rowOf(container, '新聞稿發送')).getByRole('button', { name: /刪除任務/ }));
    expect(actions.deleteTask).not.toHaveBeenCalled();
  });

  it('刪除子任務 → deleteSub(id)', () => {
    const { container } = setup();
    const r = rowOf(container, '虎姑婆周邊打樣確認');
    fireEvent.click(r.querySelector('.exp'));
    fireEvent.click(within(r).getByRole('button', { name: '刪除子任務「打樣驗收」' }));
    expect(actions.deleteSub).toHaveBeenCalledWith('t6s0');
  });

  it('+ Add subtask：輸入名稱＋選負責人 → addSub(taskId,{name,owner})；空白名稱不送；Esc 取消', () => {
    const { container } = setup();
    const r = rowOf(container, '虎姑婆周邊打樣確認');
    fireEvent.click(r.querySelector('.exp'));
    fireEvent.click(within(r).getByRole('button', { name: '+ Add subtask' }));
    const name = within(r).getByRole('textbox', { name: '子任務名稱' });
    fireEvent.click(within(r).getByRole('button', { name: 'Add' }));
    expect(actions.addSub).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: '  補件  ' } });
    fireEvent.change(within(r).getByRole('combobox', { name: '子任務負責人' }), { target: { value: 'Karen' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Add' }));
    expect(actions.addSub).toHaveBeenCalledWith('t6', { name: '補件', owner: 'Karen' });
    fireEvent.click(within(r).getByRole('button', { name: '+ Add subtask' }));
    fireEvent.keyDown(within(r).getByRole('textbox', { name: '子任務名稱' }), { key: 'Escape' });
    expect(within(r).queryByRole('textbox', { name: '子任務名稱' })).toBeNull();
  });

  it('點任務名 → onOpenTask(任務)（任務視窗後續 Task 接）；+ Create → onOpenTask(null,{projectId})', () => {
    const { container } = setup();
    fireEvent.click(rowOf(container, '商品合作').querySelector('.tnm'));
    expect(onOpenTask).toHaveBeenLastCalledWith(expect.objectContaining({ id: 't2', task: '商品合作' }));
    fireEvent.click(within(container.querySelector('.tcard .h')).getByRole('button', { name: '+ Create' }));
    expect(onOpenTask).toHaveBeenLastCalledWith(null, { projectId: 'p1' });
  });

  it('點展開鈕／狀態／刪除／拖移把手不會誤開任務視窗', () => {
    const { container } = setup();
    const r = rowOf(container, '票務展務相關');
    fireEvent.click(r.querySelector('.exp'));
    fireEvent.click(within(r).getByRole('button', { name: /狀態：/ }));
    fireEvent.click(r.querySelector('.grip'));
    fireEvent.click(within(r).getByRole('button', { name: /刪除任務/ }));
    expect(onOpenTask).not.toHaveBeenCalled();
  });
});

describe('ProjectDetail：篩選與排序（個人設定 projectTaskView）', () => {
  it('點側欄狀態 chip → 只看該狀態（寫入設定）', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '待辦 1' }));
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, status: ['待辦'] });
  });

  it('套用狀態篩選：列表與「n / 總數」、chip aria-pressed、重置鈕（側欄與工具列）', () => {
    const { container } = setup(view({ status: ['待辦', '暫緩'] }));
    expect(names(container)).toEqual(['駁二場地動線規劃', '兒童工作坊加場']);
    expect(container.querySelector('.tcard .h .mono').textContent).toBe('2 / 8');
    expect(screen.getByRole('button', { name: '待辦 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '進行中 3' }).getAttribute('aria-pressed')).toBe('false');
    const resets = screen.getAllByRole('button', { name: '重置' });
    expect(resets).toHaveLength(2);
    fireEvent.click(resets[0]);
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', TASK_VIEW_DEFAULT);
  });

  it('預設設定：側欄顯示「點一下只看它」、沒有重置鈕', () => {
    const { container } = setup();
    expect(container.querySelector('.mcard:nth-of-type(3) .lb').textContent).toContain('點一下只看它');
    expect(screen.queryByRole('button', { name: '重置' })).toBeNull();
  });

  it('側欄的數字永遠是整個專案（篩選只影響列表）', () => {
    const { container } = setup(view({ status: ['待辦'] }));
    const cards = container.querySelectorAll('.mcard');
    expect(txt(cards[0].querySelector('.big'))).toBe('54%');
    expect(txt(cards[1].querySelector('.big'))).toBe('8/15');
    expect([...cards[2].querySelectorAll('.chip.sc')].map((c) => c.textContent)).toHaveLength(5);
  });

  it('排序欄位下拉：6 個選項、改選寫入 sort.field；非手動才有升降冪鈕', () => {
    setup();
    const sel = screen.getByRole('combobox', { name: '排序欄位' });
    expect([...sel.options].map((o) => o.textContent)).toEqual(['排序：開始日', '排序：截止日', '排序：狀態', '排序：負責人', '排序：緊急度', '排序：手動']);
    fireEvent.change(sel, { target: { value: 'end' } });
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, sort: { field: 'end', dir: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: /排序方向：升冪/ }));
    expect(updateSetting).toHaveBeenLastCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, sort: { field: 'start', dir: 'desc' } });
  });

  it('手動排序沒有升降冪鈕；依截止日降冪順序正確', () => {
    setup(view({ sort: { field: 'manual', dir: 'asc' } }));
    expect(screen.queryByRole('button', { name: /排序方向/ })).toBeNull();
    const { container } = setup(view({ sort: { field: 'end', dir: 'desc' } }));
    expect(names(container)[0]).toBe('兒童工作坊加場');
  });

  it('負責人、緊急度 pill：寫入設定；選中後只留符合者', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Oliver' }));
    expect(updateSetting).toHaveBeenLastCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, owner: ['Oliver'] });
    fireEvent.click(screen.getByRole('button', { name: '高' }));
    expect(updateSetting).toHaveBeenLastCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, priority: ['高'] });
    const { container } = setup(view({ priority: ['高'] }));
    expect(names(container)).toEqual(['商品合作', '票務展務相關', '開幕記者會']);
  });
});

describe('ProjectDetail：空狀態', () => {
  it('專案沒有任務：頭部 0 統計、空狀態文案＋建立鈕、沒有專案時程', () => {
    const { container } = setup({ project: EMPTY });
    expect(container.querySelector('.dhead .meta').textContent).toBe('0 tasks · 0 subtasks · 0 done');
    expect(container.querySelector('.dhead .pchip')).toBeNull();
    const empty = container.querySelector('.tcard .empty');
    expect(txt(empty)).toContain('這個專案還沒有任務');
    expect(txt(empty)).toContain('建立第一個任務開始吧');
    fireEvent.click(within(empty).getByRole('button', { name: '+ Create' }));
    expect(onOpenTask).toHaveBeenCalledWith(null, { projectId: 'pEmpty' });
    expect(container.querySelector('section[aria-label="專案時程"]')).toBeNull();
    expect(container.querySelector('.tbar2')).toBeTruthy();
  });

  it('篩選後沒有結果：提示＋「清除篩選」；專案時程顯示沒有符合', () => {
    const { container } = setup(view({ status: ['已完成'], priority: ['高'] }));
    const empty = container.querySelector('.tcard .empty');
    expect(txt(empty)).toContain('沒有符合目前篩選的 task');
    fireEvent.click(within(empty).getByRole('button', { name: '清除篩選' }));
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', TASK_VIEW_DEFAULT);
    expect(container.querySelector('section[aria-label="專案時程"] .empty').textContent).toBe('沒有符合篩選的任務');
  });

  it('雲朵關閉：空狀態仍有文字（雲只輔助）', () => {
    const { container } = setup({ project: EMPTY, level: 'off' });
    expect(container.querySelector('.tcard .empty b').textContent).toBe('這個專案還沒有任務');
    expect(container.querySelector('.runner')).toBeNull();
  });
});

describe('ProjectDetail：專案時程（共用甘特，只傳任務列）', () => {
  it('只有任務列（無專案列）、左欄標題「任務」、跟列表同順序', () => {
    const { container } = setup();
    const g = container.querySelector('section[aria-label="專案時程"]');
    expect(g.querySelectorAll('.row.pj')).toHaveLength(0);
    expect(g.querySelectorAll('.row.tk')).toHaveLength(8);
    expect(g.querySelector('.hd .hc.l').textContent).toBe('任務');
    expect([...g.querySelectorAll('.row.tk .nm b')].map((b) => b.textContent)).toEqual(names(container));
  });

  it('跟著下方篩選走', () => {
    const { container } = setup(view({ status: ['待辦'] }));
    expect(container.querySelectorAll('section[aria-label="專案時程"] .row.tk')).toHaveLength(1);
  });

  it('沒有開始日的任務不畫在甘特（仍在清單）；全都沒有日期則不出現時程區', () => {
    const t = FIXTURE_TASKS.filter((x) => x.projectId === 'p1').map((x) => (x.id === 't3' ? { ...x, startDate: null } : x));
    const { container } = setup({ tasks: t });
    expect(container.querySelectorAll('section[aria-label="專案時程"] .row.tk')).toHaveLength(7);
    expect(names(container)).toHaveLength(8);
    const none = setup({ tasks: t.map((x) => ({ ...x, startDate: null })) }).container;
    expect(none.querySelector('section[aria-label="專案時程"]')).toBeNull();
  });

  it('時間尺度預設月；切「週」寫入 timeDimProject', () => {
    const { container } = setup();
    const seg = container.querySelector('section[aria-label="專案時程"] .seg');
    expect(within(seg).getByRole('button', { name: '月' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(seg).getByRole('button', { name: '週' }));
    expect(updateSetting).toHaveBeenCalledWith('timeDimProject', '週');
    const w = setup({ settings: { timeDimProject: '季' } }).container.querySelector('section[aria-label="專案時程"] .seg');
    expect(within(w).getByRole('button', { name: '季' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('點甘特的任務列 → onOpenTask(任務)', () => {
    const { container } = setup();
    fireEvent.click(container.querySelector('section[aria-label="專案時程"] .row.tk'));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });

  it('逾期的任務在甘特右欄顯示「逾期 N 天」', () => {
    const { container } = setup();
    const row = [...container.querySelectorAll('section[aria-label="專案時程"] .row.tk')].find((r) => r.textContent.includes('票務展務相關'));
    expect(txt(row.querySelector('.rc')).replace(/\s+/g, '')).toContain('逾期12天');
  });
});

describe('ProjectDetail：權限與專案動作', () => {
  it('admin：Archive／Delete／+ Create；Archive → archive(id)＋回上一頁', () => {
    const { container } = setup();
    const head = container.querySelector('.dhead');
    fireEvent.click(within(head).getByRole('button', { name: 'Archive' }));
    expect(actions.archive).toHaveBeenCalledWith('p1');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Delete：確認後 remove(id)＋回上一頁；取消不動', () => {
    const { container } = setup();
    const head = container.querySelector('.dhead');
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(within(head).getByRole('button', { name: 'Delete' }));
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(head).getByRole('button', { name: 'Delete' }));
    expect(confirmSpy).toHaveBeenLastCalledWith('確認刪除專案「TTXC 虎姑婆 駁二」嗎？');
    expect(actions.remove).toHaveBeenCalledWith('p1');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('已封存專案：顯示 Unarchive（不離開頁面）', () => {
    const { container } = setup({ project: { ...P1, archivedAt: '2026-09-30' } });
    const head = container.querySelector('.dhead');
    expect(within(head).queryByRole('button', { name: 'Archive' })).toBeNull();
    fireEvent.click(within(head).getByRole('button', { name: 'Unarchive' }));
    expect(actions.unarchive).toHaveBeenCalledWith('p1');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('viewer：沒有 Archive／Delete／Create／拖移／刪除／狀態選單／新增子任務；勾選不可按', () => {
    const { container } = setup({ role: 'viewer' });
    expect(screen.queryByRole('button', { name: /^(Archive|Delete|\+ Create)$/ })).toBeNull();
    expect(container.querySelector('.grip')).toBeNull();
    expect(screen.queryByRole('button', { name: /刪除任務/ })).toBeNull();
    const r = rowOf(container, '票務展務相關');
    expect(within(r).queryByRole('button', { name: /狀態：/ })).toBeNull();
    expect(r.querySelector('.trm .st').textContent).toBe('進行中');
    fireEvent.click(r.querySelector('.exp'));
    expect(within(r).queryByRole('button', { name: '+ Add subtask' })).toBeNull();
    expect(within(r).queryByRole('button', { name: /刪除子任務/ })).toBeNull();
    const cb = within(r).getAllByRole('checkbox')[0];
    expect(cb.disabled).toBe(true);
    fireEvent.click(cb);
    expect(actions.toggleSub).not.toHaveBeenCalled();
    expect(txt(container.querySelector('.tcard .h'))).not.toContain('Create');
    // 篩選與排序是個人設定，viewer 也能用
    expect(screen.getByRole('combobox', { name: '排序欄位' })).toBeTruthy();
  });

  it('viewer 的空專案：只有文字，沒有建立鈕', () => {
    setup({ project: EMPTY, role: 'viewer' });
    expect(screen.queryByRole('button', { name: '+ Create' })).toBeNull();
    expect(screen.getByText('這個專案還沒有任務')).toBeTruthy();
  });

  it('拖移任務：reorderTasks(專案, 被拖, 目標, 完整順序) 並把排序切到手動', () => {
    setup();
    dnd.onDragEnd({ active: { id: 't1' }, over: { id: 't3' } });
    expect(actions.reorderTasks).toHaveBeenCalledWith('p1', 't1', 't3', ['t2', 't1', 't4', 't3', 't6', 't7', 't5', 't8']);
    expect(updateSetting).toHaveBeenCalledWith('projectTaskView', { ...TASK_VIEW_DEFAULT, sort: { field: 'manual', dir: 'asc' } });
  });

  it('拖移：已是手動排序就不重複寫設定；原地放下不動作', () => {
    setup(view({ sort: { field: 'manual', dir: 'asc' } }));
    dnd.onDragEnd({ active: { id: 't1' }, over: { id: 't3' } });
    expect(actions.reorderTasks).toHaveBeenCalledTimes(1);
    expect(updateSetting).not.toHaveBeenCalled();
    dnd.onDragEnd({ active: { id: 't1' }, over: { id: 't1' } });
    dnd.onDragEnd({ active: { id: 't1' }, over: null });
    expect(actions.reorderTasks).toHaveBeenCalledTimes(1);
  });

  it('不碰任何 server action（全走注入的 actions／設定）', () => {
    setup();
    expect(boom).not.toHaveBeenCalled();
  });
});

describe('ProjectDetail：預覽初始展開', () => {
  it('initialExpanded 讓指定任務一開始就展開子任務', () => {
    const { container } = setup({ initialExpanded: ['t1', 't2'] });
    expect(container.querySelectorAll('.trow .subs')).toHaveLength(2);
  });
});

describe('ProjectDetail：專案改名（行內編輯）', () => {
  const title = (c) => c.querySelector('.dhead h2');
  it('admin：點名稱變輸入框，Enter 送出 → actions.rename(id, 新名稱)', () => {
    const { container } = setup();
    fireEvent.click(within(title(container)).getByRole('button', { name: /TTXC/ }));
    const input = screen.getByRole('textbox', { name: '專案名稱' });
    expect(input.value).toBe('TTXC 虎姑婆 駁二');
    fireEvent.change(input, { target: { value: '  新名字  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.rename).toHaveBeenCalledWith('p1', '新名字');
    expect(screen.queryByRole('textbox', { name: '專案名稱' })).toBeNull();
  });
  it('失焦（blur）也送出；Esc 取消不送', () => {
    const { container } = setup();
    fireEvent.click(within(title(container)).getByRole('button'));
    fireEvent.change(screen.getByRole('textbox', { name: '專案名稱' }), { target: { value: 'B' } });
    fireEvent.blur(screen.getByRole('textbox', { name: '專案名稱' }));
    expect(actions.rename).toHaveBeenCalledWith('p1', 'B');
    actions.rename.mockClear();
    fireEvent.click(within(title(container)).getByRole('button'));
    fireEvent.change(screen.getByRole('textbox', { name: '專案名稱' }), { target: { value: 'C' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: '專案名稱' }), { key: 'Escape' });
    expect(actions.rename).not.toHaveBeenCalled();
    expect(title(container).textContent).toBe('TTXC 虎姑婆 駁二');
  });
  it('空白或沒改 → 不送', () => {
    const { container } = setup();
    fireEvent.click(within(title(container)).getByRole('button'));
    fireEvent.change(screen.getByRole('textbox', { name: '專案名稱' }), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: '專案名稱' }), { key: 'Enter' });
    fireEvent.click(within(title(container)).getByRole('button'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: '專案名稱' }), { key: 'Enter' });
    expect(actions.rename).not.toHaveBeenCalled();
  });
  it('viewer：名稱只是文字，沒有按鈕', () => {
    const { container } = setup({ role: 'viewer' });
    expect(title(container).querySelector('button')).toBeNull();
    expect(title(container).textContent).toBe('TTXC 虎姑婆 駁二');
  });
});

describe('ProjectDetail：專案頭像上傳／刪除', () => {
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  it('admin：點頭像選檔 → actions.uploadBanner(id, file)', () => {
    const { container } = setup();
    expect(screen.getByRole('button', { name: '上傳專案圖示' })).toBeTruthy();
    const input = container.querySelector('.dhead input[type="file"]');
    expect(input.getAttribute('accept')).toBe('image/*');
    fireEvent.change(input, { target: { files: [file] } });
    expect(actions.uploadBanner).toHaveBeenCalledWith('p1', file);
  });
  it('沒有圖示時沒有刪除鈕；有圖示時「更換」與「刪除」，刪除 → actions.removeBanner(id)', () => {
    expect(setup().container.querySelector('.dhead .avx')).toBeNull();
    const { container } = setup({ project: { ...P1, bannerUrl: '/b.png' } });
    expect(screen.getByRole('button', { name: '更換專案圖示' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '刪除專案圖示' }));
    expect(actions.removeBanner).toHaveBeenCalledWith('p1');
    expect(container.querySelector('.dhead .av.lg img').getAttribute('src')).toBe('/b.png');
  });
  it('viewer：沒有上傳／刪除，也沒有檔案輸入', () => {
    const { container } = setup({ role: 'viewer', project: { ...P1, bannerUrl: '/b.png' } });
    expect(container.querySelector('.dhead input[type="file"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /專案圖示/ })).toBeNull();
    expect(container.querySelector('.dhead .av.lg img')).toBeTruthy();
  });
});
