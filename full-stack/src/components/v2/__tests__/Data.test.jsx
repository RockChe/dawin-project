import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import Data from '@/components/v2/Data';
import { buildTwp } from '@/lib/v2Data';
import { tasksToCSV } from '@/lib/utils';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

const { boom, dl } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }), dl: vi.fn() }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/lib/utils', async (orig) => ({ ...(await orig()), downloadCSV: dl }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
let actions;
const mkActions = () => ({
  updateTask: vi.fn(), updateSub: vi.fn(), deleteTask: vi.fn(), deleteSub: vi.fn(), toggleSub: vi.fn(),
  addTask: vi.fn(async () => ({ success: true })), addSub: vi.fn(async () => ({ success: true })),
  importTasks: vi.fn(async () => ({ success: true })), deleteManyTasks: vi.fn(async () => ({ success: true })),
  updateManyTasks: vi.fn(async () => ({ success: true })), deleteAllTasks: vi.fn(async () => ({ success: true })), notify: vi.fn(),
});
const setup = ({ role = 'admin', level = 'full', ...over } = {}) => {
  actions = mkActions();
  return render(
    <PermissionProvider role={role}>
      <CloudLevelProvider level={level}>
        <V2SettingsProvider value={{ settings: {}, updateSetting: vi.fn(), ready: true }}>
          <Data twp={twp} subtasks={FIXTURE_SUBTASKS} projects={FIXTURE_PROJECTS} userNames={FIXTURE_OWNERS} config={{ cats: ['商務合作', '活動', '行銷'], owners: FIXTURE_OWNERS }} today={FIXTURE_TODAY} actions={actions} {...over} />
        </V2SettingsProvider>
      </CloudLevelProvider>
    </PermissionProvider>
  );
};
const bodyRows = (c) => [...c.querySelectorAll('table.dt tbody tr')];
const taskRows = (c) => bodyRows(c).filter((r) => r.querySelector('[data-col="project"]'));
const subRows = (c) => bodyRows(c).filter((r) => r.classList.contains('subr') && !r.classList.contains('addr'));
const cellOf = (c, rowIdx, colKey) => taskRows(c)[rowIdx].querySelector(`[data-col="${colKey}"]`);
const grid = (c) => c.querySelector('.tw');
let confirmSpy;
beforeEach(() => { boom.mockClear(); dl.mockClear(); confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => confirmSpy.mockRestore());

describe('Data：表格外觀與分頁', () => {
  it('表頭欄位同設計稿；Notes 不可排序、其餘可排序（aria-sort）', () => {
    const { container } = setup();
    const ths = [...container.querySelectorAll('table.dt thead th')];
    expect(ths.map((t) => t.textContent)).toEqual(['', 'Project ↑', 'Task', 'Owner', 'Status', 'Pri', 'Progress', 'Category', 'Start', 'End', 'Notes', 'Creator', '']);
    expect(ths.filter((t) => t.querySelector('button')).length).toBe(10);
    expect(ths[10].querySelector('button')).toBeNull();
    expect(ths[1].getAttribute('aria-sort')).toBe('ascending'); // 預設依專案（手動順序）排，同設計稿
    expect(ths[2].getAttribute('aria-sort')).toBe('none');
  });

  it('預設每頁 30 筆、共 33 筆、第 1／2 頁；下一頁看到剩下的 3 筆；換每頁 50 筆就一頁看完', () => {
    const { container } = setup();
    expect(taskRows(container)).toHaveLength(30);
    expect(screen.getByText(/共 33 筆/)).toBeTruthy();
    expect(container.querySelector('.pager .mono').textContent).toBe('1 / 2');
    expect(screen.getByRole('button', { name: '上一頁' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(taskRows(container)).toHaveLength(3);
    expect(container.querySelector('.pager .mono').textContent).toBe('2 / 2');
    expect(screen.getByRole('button', { name: '下一頁' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('每頁筆數'), { target: { value: '50' } });
    expect(taskRows(container)).toHaveLength(33);
    expect(container.querySelector('.pager .mono').textContent).toBe('1 / 1');
  });

  it('一列的內容：專案色點＋名稱、任務、人員標籤、狀態、優先度、進度％、分類、起訖（YYYY/MM/DD）、備註、建立者', () => {
    const { container } = setup();
    const r = taskRows(container)[0];
    const txt = (k) => r.querySelector(`[data-col="${k}"]`).textContent;
    expect(txt('project')).toBe('TTXC 虎姑婆 駁二');
    expect(txt('task')).toContain('票務展務相關');
    expect(txt('status')).toBe('進行中');
    expect(txt('priority')).toBe('高');
    expect(txt('category')).toBe('活動');
    expect(txt('start')).toBe('2026/08/20');
    expect(txt('end')).toBe('2026/09/25');
    expect(txt('notes')).toBe('售票上線前須完成人力與 FAQ');
    expect(r.querySelector('[data-col="progress"]').textContent).toBe('60%');
    expect([...r.querySelectorAll('[data-col="owner"] .pp')].map((p) => p.textContent.replace('關注', ''))).toEqual(['Rock', 'Karen', 'Oliver', '幸真']);
  });

  it('Data 不放雲（設計稿：高密度資料表），雲朵程度再高也一樣', () => {
    const { container } = setup({ level: 'full' });
    expect(container.querySelector('.cl')).toBeNull();
  });

  it('空結果：No tasks found，提示調整篩選', () => {
    const { container } = setup({ searchQ: '不存在的字' });
    expect(taskRows(container)).toHaveLength(0);
    expect(container.querySelector('table.dt .empty').textContent).toContain('No tasks found');
    expect(screen.getByText(/共 0 筆/)).toBeTruthy();
  });
});

describe('Data：排序、篩選、搜尋', () => {
  it('點表頭排序：升冪→降冪，aria-sort 與箭頭跟著變', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Status/ }));
    expect(container.querySelector('th[aria-sort="ascending"]').textContent).toContain('Status');
    expect(cellOf(container, 0, 'status').textContent).toBe('已完成');
    fireEvent.click(screen.getByRole('button', { name: /^Status/ }));
    expect(container.querySelector('th[aria-sort="descending"]').textContent).toContain('Status');
    expect(cellOf(container, 0, 'status').textContent).toBe('待確認');
  });

  it('排序後翻到第 2 頁，再換排序欄會回到第 1 頁', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    fireEvent.click(screen.getByRole('button', { name: /^Pri/ }));
    expect(container.querySelector('.pager .mono').textContent).toBe('1 / 2');
  });

  it('跨專案篩選：狀態多選、優先度、專案；清除', () => {
    const { container } = setup();
    fireEvent.click(within(screen.getByRole('group', { name: '跨專案篩選' })).getByRole('button', { name: '已完成' }));
    const done = twp.filter((t) => t.status === '已完成').length;
    expect(taskRows(container)).toHaveLength(done);
    expect(screen.getByText(new RegExp(`共 ${done} 筆`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(screen.getByText(/共 33 筆/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /專案 全部/ }));
    fireEvent.click(within(screen.getByRole('group', { name: '選擇專案' })).getByRole('button', { name: '虎姑婆和他的朋友' }));
    expect(taskRows(container)).toHaveLength(3);
  });

  it('篩選條件改變回到第 1 頁；改一格資料（twp 換了）不會被踢回第 1 頁', () => {
    const { container, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(container.querySelector('.pager .mono').textContent).toBe('2 / 2');
    const twp2 = twp.map((t) => (t.id === 't33' ? { ...t, notes: '改過' } : t));
    rerender(
      <PermissionProvider role="admin"><CloudLevelProvider level="full"><V2SettingsProvider value={{ settings: {}, updateSetting: vi.fn(), ready: true }}>
        <Data twp={twp2} subtasks={FIXTURE_SUBTASKS} projects={FIXTURE_PROJECTS} userNames={FIXTURE_OWNERS} config={{ cats: [], owners: FIXTURE_OWNERS }} today={FIXTURE_TODAY} actions={actions} />
      </V2SettingsProvider></CloudLevelProvider></PermissionProvider>);
    expect(container.querySelector('.pager .mono').textContent).toBe('2 / 2');
    fireEvent.click(within(screen.getByRole('group', { name: '跨專案篩選' })).getByRole('button', { name: '進行中' }));
    expect(container.querySelector('.pager .mono').textContent).toBe('1 / 1');
  });

  it('頁首搜尋字串過濾列表（任務名／專案名／負責人／備註）', () => {
    const { container } = setup({ searchQ: '打樣' });
    expect(taskRows(container).map((r) => r.querySelector('[data-col="task"] .gc').textContent)).toEqual(expect.arrayContaining(['虎姑婆周邊打樣確認', '週邊貼紙打樣']));
    expect(taskRows(container).length).toBeLessThan(5);
  });
});

describe('Data：勾選與批次', () => {
  it('勾選一列才出現「指派 Owner (n)」「刪除已選 (n)」；全選本頁＝30', () => {
    const { container } = setup();
    expect(screen.queryByRole('button', { name: /刪除已選/ })).toBeNull();
    fireEvent.click(screen.getByLabelText('選取「票務展務相關」'));
    expect(screen.getByRole('button', { name: '刪除已選 (1)' })).toBeTruthy();
    expect(taskRows(container)[0].classList.contains('sel')).toBe(true);
    fireEvent.click(screen.getByLabelText('全選本頁'));
    expect(screen.getByRole('button', { name: '刪除已選 (30)' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('全選本頁'));
    expect(screen.queryByRole('button', { name: /刪除已選/ })).toBeNull();
  });

  it('批次刪除：confirm 後呼叫 deleteManyTasks（選取的 id），並清掉選取；取消則不刪', async () => {
    setup();
    fireEvent.click(screen.getByLabelText('選取「票務展務相關」'));
    fireEvent.click(screen.getByLabelText('選取「商品合作」'));
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '刪除已選 (2)' }));
    expect(actions.deleteManyTasks).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '刪除已選 (2)' }));
    await waitFor(() => expect(actions.deleteManyTasks).toHaveBeenCalledWith(['t1', 't2']));
    await waitFor(() => expect(screen.queryByRole('button', { name: /刪除已選/ })).toBeNull());
  });

  it('批次指派 Owner：updateManyTasks(ids,"owner",名字)', async () => {
    setup();
    fireEvent.click(screen.getByLabelText('選取「票務展務相關」'));
    fireEvent.change(screen.getByLabelText('指派 Owner'), { target: { value: 'Karen' } });
    await waitFor(() => expect(actions.updateManyTasks).toHaveBeenCalledWith(['t1'], 'owner', 'Karen'));
  });
});

describe('Data：匯出／匯入（權限同舊版）', () => {
  it('Export CSV 走前端：用全部任務（不是目前頁）產生 CSV 並下載', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(dl).toHaveBeenCalledTimes(1);
    const [csv, name] = dl.mock.calls[0];
    expect(name).toBe('tasks_export.csv');
    expect(csv).toBe(tasksToCSV(twp));
    expect(csv.split('\n')).toHaveLength(34);
    expect(csv).toContain('"TTXC 虎姑婆 駁二"');
    expect(csv).toContain('"2026/08/20"');
    expect(boom).not.toHaveBeenCalled();
  });

  it('Import CSV：讀檔 → parseCSV → importTasks；沒有有效資料則 toast 錯誤、不匯入', async () => {
    const { container } = setup();
    const input = container.querySelector('input[type="file"]');
    const csv = 'project,task,status\nP,新增任務,待辦\n';
    fireEvent.change(input, { target: { files: [new File([csv], 'a.csv', { type: 'text/csv' })] } });
    await waitFor(() => expect(actions.importTasks).toHaveBeenCalledTimes(1));
    expect(actions.importTasks.mock.calls[0][0][0]).toMatchObject({ project: 'P', task: '新增任務', status: '待辦' });
    fireEvent.change(input, { target: { files: [new File(['only header'], 'b.csv')] } });
    await waitFor(() => expect(actions.notify).toHaveBeenCalledWith('CSV 中沒有有效資料', 'error'));
    expect(actions.importTasks).toHaveBeenCalledTimes(1);
  });

  it('Import URL：POST /api/fetch-csv 取得 csv 後匯入；失敗顯示錯誤', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ csv: 'project,task\nP,從網址來\n' }) }));
    vi.stubGlobal('fetch', f);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Import URL' }));
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: ' https://x.test/a.csv ' } });
    fireEvent.click(screen.getByRole('button', { name: '匯入' }));
    await waitFor(() => expect(actions.importTasks).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith('/api/fetch-csv', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'https://x.test/a.csv' }) }));
    await waitFor(() => expect(screen.queryByPlaceholderText('https://...')).toBeNull()); // 成功後收起
    f.mockResolvedValueOnce({ ok: false, json: async () => ({ error: '取得 CSV 失敗' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Import URL' }));
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://x.test/bad.csv' } });
    fireEvent.click(screen.getByRole('button', { name: '匯入' }));
    await waitFor(() => expect(actions.notify).toHaveBeenCalledWith('取得 CSV 失敗', 'error'));
    vi.unstubAllGlobals();
  });

  it('viewer：沒有編輯、匯出、匯入、新增、勾選、刪除；仍可排序與篩選', () => {
    const { container } = setup({ role: 'viewer' });
    for (const n of ['Export CSV', 'Import CSV', 'Import URL', '+ Create', 'Clean All']) expect(screen.queryByRole('button', { name: n })).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('[role="gridcell"]')).toBeNull();
    expect(container.querySelector('button.iconx')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Status/ }));
    expect(cellOf(container, 0, 'status').textContent).toBe('已完成');
    expect(screen.getByText(/唯讀/)).toBeTruthy();
  });

  it('Clean All 只有 manage（super_admin）才有；要輸入 clean all 才能確認', () => {
    setup({ role: 'admin' });
    expect(screen.queryByRole('button', { name: 'Clean All' })).toBeNull();
  });
  it('super_admin：Clean All 對話框，輸入 clean all 才可按「確認刪除」', async () => {
    setup({ role: 'super_admin' });
    fireEvent.click(screen.getByRole('button', { name: 'Clean All' }));
    const dlg = screen.getByRole('dialog');
    const ok = within(dlg).getByRole('button', { name: '確認刪除' });
    expect(ok.disabled).toBe(true);
    fireEvent.change(within(dlg).getByPlaceholderText('clean all'), { target: { value: 'clean al' } });
    expect(ok.disabled).toBe(true);
    fireEvent.change(within(dlg).getByPlaceholderText('clean all'), { target: { value: 'clean all' } });
    fireEvent.click(ok);
    expect(actions.deleteAllTasks).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Data：鍵盤編輯格', () => {
  it('點一格選取（outline）；方向鍵移動；Esc 取消選取', () => {
    const { container } = setup();
    fireEvent.click(cellOf(container, 0, 'task').querySelector('[role="gridcell"]'));
    expect(cellOf(container, 0, 'task').querySelector('.gc.on')).not.toBeNull();
    fireEvent.keyDown(grid(container), { key: 'ArrowRight' });
    expect(cellOf(container, 0, 'task').querySelector('.gc.on')).toBeNull();
    expect(cellOf(container, 0, 'owner').querySelector('.gc.on')).not.toBeNull();
    fireEvent.keyDown(grid(container), { key: 'ArrowDown' });
    expect(cellOf(container, 1, 'owner').querySelector('.gc.on')).not.toBeNull();
    fireEvent.keyDown(grid(container), { key: 'Escape' });
    expect(container.querySelector('.gc.on')).toBeNull();
  });

  it('F2／Enter／雙擊進入編輯，Enter 儲存（updateTask(id,欄位,新值)）並往下一列', () => {
    const { container } = setup();
    fireEvent.click(cellOf(container, 0, 'notes').querySelector('[role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'F2' });
    const input = container.querySelector('input.gc-ed');
    expect(input.value).toBe('售票上線前須完成人力與 FAQ');
    fireEvent.change(input, { target: { value: '新備註' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.updateTask).toHaveBeenCalledWith('t1', 'notes', '新備註');
    expect(container.querySelector('input.gc-ed')).toBeNull();
    expect(cellOf(container, 1, 'notes').querySelector('.gc.on')).not.toBeNull();
  });

  it('沒改內容不送出；Esc 放棄修改', () => {
    const { container } = setup();
    fireEvent.click(cellOf(container, 0, 'notes').querySelector('[role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'Enter' });
    fireEvent.keyDown(container.querySelector('input.gc-ed'), { key: 'Enter' });
    expect(actions.updateTask).not.toHaveBeenCalled();
    fireEvent.keyDown(grid(container), { key: 'F2' });
    const input = container.querySelector('input.gc-ed');
    fireEvent.change(input, { target: { value: '放棄' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(actions.updateTask).not.toHaveBeenCalled();
  });

  it('直接打字就進入編輯並帶入那個字；Tab 儲存並往右；Delete 清空', () => {
    const { container } = setup();
    fireEvent.click(cellOf(container, 0, 'task').querySelector('[role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'x' });
    const input = container.querySelector('input.gc-ed');
    expect(input.value).toBe('x');
    fireEvent.change(input, { target: { value: 'xy' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(actions.updateTask).toHaveBeenCalledWith('t1', 'task', 'xy');
    expect(cellOf(container, 0, 'owner').querySelector('.gc.on')).not.toBeNull();
    fireEvent.click(cellOf(container, 0, 'notes').querySelector('[role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'Delete' });
    expect(actions.updateTask).toHaveBeenCalledWith('t1', 'notes', '');
  });

  it('雙擊進入編輯；狀態／優先度／分類是下拉，選了就送出；日期是日期輸入', () => {
    const { container } = setup();
    fireEvent.doubleClick(cellOf(container, 0, 'status').querySelector('[role="gridcell"]'));
    const sel = container.querySelector('select.gc-ed');
    expect([...sel.options].map((o) => o.value)).toEqual(['已完成', '進行中', '待辦', '暫緩', '提案中', '待確認']);
    fireEvent.change(sel, { target: { value: '待辦' } });
    expect(actions.updateTask).toHaveBeenCalledWith('t1', 'status', '待辦');
    fireEvent.doubleClick(cellOf(container, 0, 'category').querySelector('[role="gridcell"]'));
    expect([...container.querySelector('select.gc-ed').options].map((o) => o.value)).toEqual(['商務合作', '活動', '行銷']);
    fireEvent.keyDown(container.querySelector('select.gc-ed'), { key: 'Escape' });
    fireEvent.doubleClick(cellOf(container, 0, 'start').querySelector('[role="gridcell"]'));
    const d = container.querySelector('input.gc-ed');
    expect(d.type).toBe('date');
    expect(d.value).toBe('2026-08-20');
    fireEvent.change(d, { target: { value: '2026-08-25' } });
    fireEvent.keyDown(d, { key: 'Enter' });
    expect(actions.updateTask).toHaveBeenCalledWith('t1', 'start', '2026-08-25');
  });

  it('有子任務負責人的任務，Owner 格唯讀（點了不能編輯，標示由子任務帶出）', () => {
    const { container } = setup();
    const o = cellOf(container, 0, 'owner');
    expect(o.querySelector('[title="由子任務自動帶出"]')).not.toBeNull();
    fireEvent.click(o.querySelector('[title="由子任務自動帶出"]'));
    fireEvent.keyDown(grid(container), { key: 'Enter' });
    expect(container.querySelector('input.gc-ed')).toBeNull();
    // 沒有子任務的任務（t3 駁二場地動線規劃）可以編輯
    const o3 = cellOf(container, 2, 'owner');
    fireEvent.click(o3.querySelector('[role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'Enter' });
    expect(container.querySelector('input.gc-ed')).not.toBeNull();
  });

  it('點表格外面取消選取', () => {
    const { container } = setup();
    fireEvent.click(cellOf(container, 0, 'task').querySelector('[role="gridcell"]'));
    fireEvent.mouseDown(document.body);
    expect(container.querySelector('.gc.on')).toBeNull();
  });
});

describe('Data：子任務與刪除、新增', () => {
  it('展開子任務：顯示名稱／負責人／狀態字／備註；勾選＝toggleSub；子任務欄位也能鍵盤編輯', () => {
    const { container } = setup();
    expect(subRows(container)).toHaveLength(0);
    fireEvent.click(within(taskRows(container)[0]).getByRole('button', { name: '展開子任務' }));
    const subs = subRows(container);
    expect(subs).toHaveLength(5);
    expect(subs[0].textContent).toContain('售票系統串接');
    expect(subs[0].textContent).toContain('Done');
    expect(subs[3].textContent).toContain('Pending');
    expect(within(taskRows(container)[0]).getByRole('button', { name: '收合子任務' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(subs[3]).getByRole('checkbox'));
    expect(actions.toggleSub).toHaveBeenCalledWith('t1s3');
    fireEvent.click(subs[0].querySelector('[data-col="notes"] [role="gridcell"]'));
    fireEvent.keyDown(grid(container), { key: 'F2' });
    const input = container.querySelector('input.gc-ed');
    fireEvent.change(input, { target: { value: '備註改' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.updateSub).toHaveBeenCalledWith('t1s0', 'notes', '備註改');
  });

  it('子任務：刪除（×）與 + Add subtask（Enter 送出、空白不送）', async () => {
    const { container } = setup();
    fireEvent.click(within(taskRows(container)[0]).getByRole('button', { name: '展開子任務' }));
    const subs = subRows(container);
    fireEvent.click(within(subs[0]).getByRole('button', { name: /刪除子任務/ }));
    expect(actions.deleteSub).toHaveBeenCalledWith('t1s0');
    fireEvent.click(screen.getByRole('button', { name: '+ Add subtask' }));
    const name = screen.getByPlaceholderText('Subtask name');
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(actions.addSub).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: '新子任務' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(actions.addSub).toHaveBeenCalledWith('t1', { name: '新子任務', owner: '' });
  });

  it('刪除一列：confirm 後 deleteTask', () => {
    const { container } = setup();
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(within(taskRows(container)[0]).getByRole('button', { name: /刪除任務/ }));
    expect(actions.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(within(taskRows(container)[0]).getByRole('button', { name: /刪除任務/ }));
    expect(actions.deleteTask).toHaveBeenCalledWith('t1');
  });

  it('+ Create：專案與任務名必填；送出 addTask(projectId, 欄位)，成功後收起表單', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Create' }));
    const ok = screen.getByRole('button', { name: 'Confirm' });
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: '  新任務  ' } });
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '高' } });
    expect(ok.disabled).toBe(false);
    fireEvent.click(ok);
    await waitFor(() => expect(actions.addTask).toHaveBeenCalledTimes(1));
    expect(actions.addTask).toHaveBeenCalledWith('p2', expect.objectContaining({ task: '新任務', startDate: '2026-10-10', endDate: '2026-10-20', duration: 10, priority: '高', category: '活動' }));
    await waitFor(() => expect(screen.queryByLabelText('Task')).toBeNull());
  });

  it('+ Create 失敗（沒有 success）時表單保留，可以再試', async () => {
    setup();
    actions.addTask.mockResolvedValueOnce({ error: 'x' });
    fireEvent.click(screen.getByRole('button', { name: '+ Create' }));
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(actions.addTask).toHaveBeenCalled());
    expect(screen.getByLabelText('Task').value).toBe('A');
  });
});
