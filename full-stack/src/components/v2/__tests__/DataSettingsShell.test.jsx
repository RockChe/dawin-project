import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import V2Root from '@/components/v2/V2Root';
import Shell from '@/components/v2/Shell';
import LiveShell from '@/components/v2/LiveShell';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import { fixtureShellProps, FIXTURE_USER, FIXTURE_OWNERS } from '@/components/v2/fixtures';

const { boom, tm } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }), tm: { current: null } }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/hooks/useTaskManager', () => ({ default: () => tm.current }));
vi.mock('@/server/actions/projects', () => ({ deleteProjectBanner: boom }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

let updateSetting;
const wrap = (ui, { role = 'admin', settings = {} } = {}) => {
  updateSetting = vi.fn(async () => ({ success: true }));
  return render(
    <ThemeProvider><V2Root role={role}><V2SettingsProvider value={{ settings, updateSetting, ready: true }}>{ui}</V2SettingsProvider></V2Root></ThemeProvider>
  );
};
const nav = () => screen.getByRole('navigation', { name: '主要分頁' });
const crumbs = () => screen.getByRole('navigation', { name: '麵包屑' });
const rows = (c) => [...c.querySelectorAll('table.dt tbody tr')].filter((r) => r.querySelector('[data-col="project"]'));
let confirmSpy;
beforeEach(() => { localStorage.clear(); boom.mockClear(); confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => confirmSpy.mockRestore());

describe('Shell：Data 分頁', () => {
  it('切到 Data 顯示任務表（不是佔位）、跨專案篩選列、麵包屑「首頁›Data」', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} />);
    fireEvent.click(within(nav()).getByText('Data'));
    expect(rows(container)).toHaveLength(30);
    expect(screen.queryByTestId('v2-placeholder')).toBeNull();
    expect(screen.getByRole('group', { name: '跨專案篩選' })).toBeTruthy();
    expect(crumbs().textContent).toBe('首頁›Data');
    expect(container.querySelector('.dtcard .cl')).toBeNull();
  });

  it('頁首搜尋（debounce 後）過濾 Data 的列', async () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="data" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '打樣' } });
    await waitFor(() => expect(rows(container).length).toBeLessThan(5));
    expect(screen.getByText(/共 2 筆/)).toBeTruthy();
  });

  it('寫入動作穿透 dataActions；沒給的是 no-op（預覽不報錯）', () => {
    const dataActions = { updateTask: vi.fn() };
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="data" dataActions={dataActions} />);
    fireEvent.click(container.querySelector('[data-col="notes"] [role="gridcell"]'));
    fireEvent.keyDown(container.querySelector('.tw'), { key: 'Delete' });
    expect(dataActions.updateTask).toHaveBeenCalledWith('t1', 'notes', '');
    fireEvent.click(screen.getByLabelText('選取「票務展務相關」'));
    fireEvent.click(screen.getByRole('button', { name: '刪除已選 (1)' })); // deleteManyTasks 沒給 → no-op，不丟錯
    expect(boom).not.toHaveBeenCalled();
  });
});

describe('Shell：Settings 分頁', () => {
  it('Settings 一般頁（不放雲）；點左側「雲朵」→ 雲朵專區、麵包屑「首頁›Settings›雲朵」', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="settings" />);
    expect(crumbs().textContent).toBe('首頁›Settings');
    expect(container.querySelector('.sgrid')).not.toBeNull();
    expect(container.querySelector('.setlay .cl')).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation', { name: '設定分頁' })).getByText('雲朵'));
    expect(container.querySelector('.cpage')).not.toBeNull();
    expect(container.querySelector('.sgrid')).toBeNull();
    expect(crumbs().textContent).toBe('首頁›Settings›雲朵');
    expect(within(crumbs()).getByText('Settings').tagName).toBe('BUTTON');
  });

  it('點麵包屑的 Settings 或分頁列的 Settings，從雲朵回到一般', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="settings" settingsInit={{ sub: 'cloud' }} />);
    expect(crumbs().textContent).toBe('首頁›Settings›雲朵');
    fireEvent.click(within(crumbs()).getByText('Settings'));
    expect(container.querySelector('.sgrid')).not.toBeNull();
    expect(crumbs().textContent).toBe('首頁›Settings');
    fireEvent.click(within(screen.getByRole('navigation', { name: '設定分頁' })).getByText('雲朵'));
    fireEvent.click(within(nav()).getByText('Settings'));
    expect(container.querySelector('.sgrid')).not.toBeNull();
  });

  it('雲朵專區改顯示程度／動態，走單一的 useV2Settings（cloudLevel／cloudMotion）', () => {
    wrap(<Shell {...fixtureShellProps()} initialTab="settings" settingsInit={{ sub: 'cloud' }} />);
    fireEvent.click(within(screen.getByRole('group', { name: '顯示程度' })).getByText('關閉'));
    expect(updateSetting).toHaveBeenCalledWith('cloudLevel', 'off');
    fireEvent.click(screen.getByRole('switch', { name: /動態效果/ }));
    expect(updateSetting).toHaveBeenCalledWith('cloudMotion', false);
  });

  it('雲朵程度＝關閉時：一般頁與資料表沒有雲、雲朵專區仍有（唯一放雲的設定頁）', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="settings" settingsInit={{ sub: 'cloud' }} />, { settings: { cloudLevel: 'off' } });
    expect(container.querySelectorAll('.cpage .chd .cl').length).toBe(1);
    expect(container.querySelectorAll('.ctab .cl').length).toBe(5);
  });

  it('viewer：Settings 只剩個人設定（沒有 Categories／Owners），雲朵專區照常', () => {
    const { container } = wrap(<Shell {...fixtureShellProps()} initialTab="settings" />, { role: 'viewer' });
    expect([...container.querySelectorAll('.sgrid h3')].map((h) => h.textContent)).toEqual(['Timeline Width (px per unit)', 'Display Settings']);
  });
});

describe('LiveShell：Data／Settings 接 useTaskManager（同舊版的 action）', () => {
  const props = fixtureShellProps();
  const fake = (over = {}) => ({
    allT: props.tasks, allS: props.subtasks, projects: props.projects, toast: null, showToast: vi.fn(),
    updateTask: vi.fn(), updateSub: vi.fn(), deleteTask: vi.fn(), deleteSub: vi.fn(), toggleSub: vi.fn(), addSub: vi.fn(async () => ({ success: true })),
    addTask: vi.fn(async () => ({ success: true })), importTasks: vi.fn(async () => ({ success: true })), deleteManyTasks: vi.fn(async () => ({ success: true })),
    updateManyTasks: vi.fn(async () => ({ success: true })), deleteAllTasks: vi.fn(async () => ({ success: true })), saveConfigCats: vi.fn(),
    configCats: ['商務合作', '活動'], configOwners: FIXTURE_OWNERS,
    ...over,
  });
  const data = { session: FIXTURE_USER, userNames: props.userNames };
  const setup = (tab, over, opts) => { tm.current = fake(over); return wrap(<LiveShell data={data} today={props.today} initialTab={tab} />, opts); };

  it('Data：改一格 → tm.updateTask(id,欄位,值)；批次刪除 → tm.deleteManyTasks；匯入 → tm.importTasks', async () => {
    const { container } = setup('data');
    fireEvent.click(container.querySelector('[data-col="notes"] [role="gridcell"]'));
    fireEvent.keyDown(container.querySelector('.tw'), { key: 'F2' });
    const input = container.querySelector('input.gc-ed');
    fireEvent.change(input, { target: { value: '改了' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(tm.current.updateTask).toHaveBeenCalledWith('t1', 'notes', '改了');
    fireEvent.click(screen.getByLabelText('選取「票務展務相關」'));
    fireEvent.click(screen.getByRole('button', { name: '刪除已選 (1)' }));
    await waitFor(() => expect(tm.current.deleteManyTasks).toHaveBeenCalledWith(['t1']));
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['project,task\nP,T\n'], 'a.csv')] } });
    await waitFor(() => expect(tm.current.importTasks).toHaveBeenCalledTimes(1));
  });

  it('Data：Export CSV 只要 admin／super_admin；viewer 看不到按鈕', () => {
    setup('data', {}, { role: 'viewer' });
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('Settings：分類新增 → tm.saveConfigCats(新清單)，toast 走 tm.showToast', () => {
    setup('settings');
    fireEvent.change(screen.getByLabelText('新類別'), { target: { value: '展覽' } });
    fireEvent.keyDown(screen.getByLabelText('新類別'), { key: 'Enter' });
    expect(tm.current.saveConfigCats).toHaveBeenCalledWith(['商務合作', '活動', '展覽']);
    expect(tm.current.showToast).toHaveBeenCalledWith('Category added', 'success');
  });

  it('Settings：Owners 取自 hook 的 configOwners（Users 表）', () => {
    const { container } = setup('settings');
    expect([...container.querySelectorAll('.own')].map((n) => n.textContent)).toEqual(FIXTURE_OWNERS);
  });
});
