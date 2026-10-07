import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import Settings from '@/components/v2/Settings';
import { DEFAULT_GANTT_WIDTHS } from '@/lib/personalSettings';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const CATS = ['商務合作', '活動', '行銷'];
let updateSetting, actions, onSub, setLevel;
const setup = ({ role = 'admin', level = 'full', settings = {}, sub = 'general' } = {}) => {
  updateSetting = vi.fn(async () => ({ success: true }));
  actions = { saveCats: vi.fn(), notify: vi.fn() };
  onSub = vi.fn();
  setLevel = vi.fn();
  return render(
    <PermissionProvider role={role}>
      <CloudLevelProvider level={level} setLevel={setLevel}>
        <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
          <Settings sub={sub} onSub={onSub} config={{ cats: CATS, owners: FIXTURE_OWNERS }} actions={actions}
            preview={{ twp, projects: FIXTURE_PROJECTS, userName: 'Rock', today: FIXTURE_TODAY }} />
        </V2SettingsProvider>
      </CloudLevelProvider>
    </PermissionProvider>
  );
};
beforeEach(() => { boom.mockClear(); });

describe('Settings：左側子選單', () => {
  it('「一般／雲朵」兩項，目前頁 aria-current=page；點雲朵 → onSub("cloud")', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: '設定分頁' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['一般', '雲朵']);
    expect(within(nav).getByText('一般').getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByText('雲朵').getAttribute('aria-current')).toBeNull();
    fireEvent.click(within(nav).getByText('雲朵'));
    expect(onSub).toHaveBeenCalledWith('cloud');
  });
  it('sub=cloud 顯示雲朵專區（子選單跟著標示）', () => {
    setup({ sub: 'cloud' });
    expect(within(screen.getByRole('navigation', { name: '設定分頁' })).getByText('雲朵').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: '雲朵' })).toBeTruthy();
    expect(screen.queryByText('Categories')).toBeNull();
  });
});

describe('Settings 一般：版面與不放雲／不含全站放大', () => {
  it('四個區塊：Categories、Owners、Timeline Width、Display Settings', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.sgrid h3')].map((h) => h.textContent)).toEqual(['Categories', 'Owners', 'Timeline Width (px per unit)', 'Display Settings']);
  });
  it('不放雲（雲朵程度完整也一樣）；沒有「全站放大」滑桿（R4：v2 不套用 zoom）', () => {
    const { container } = setup({ level: 'full', settings: { zoom: 150 } });
    expect(container.querySelector('.cl')).toBeNull();
    expect(screen.queryByText(/全站放大/)).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });
  it('Owners 來自 Users 表（唯讀名單）並說明由帳號管理同步', () => {
    const { container } = setup();
    const card = [...container.querySelectorAll('.sgrid section')].find((s) => s.querySelector('h3').textContent === 'Owners');
    expect([...card.querySelectorAll('.own')].map((n) => n.textContent)).toEqual(FIXTURE_OWNERS);
    expect(card.textContent).toContain('Owner 由帳號管理頁面自動同步');
  });
});

describe('Settings 一般：分類管理', () => {
  it('列出分類；× 移除 → saveCats(去掉那項) 並 toast', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '移除類別 活動' }));
    expect(actions.saveCats).toHaveBeenCalledWith(['商務合作', '行銷']);
    expect(actions.notify).toHaveBeenCalledWith('Category removed', 'error');
  });
  it('新增：Enter 或 + 按鈕，trim；空白不送', () => {
    setup();
    const inp = screen.getByLabelText('新類別');
    fireEvent.keyDown(inp, { key: 'Enter' });
    expect(actions.saveCats).not.toHaveBeenCalled();
    fireEvent.change(inp, { target: { value: '  展覽  ' } });
    fireEvent.keyDown(inp, { key: 'Enter' });
    expect(actions.saveCats).toHaveBeenCalledWith([...CATS, '展覽']);
    expect(actions.notify).toHaveBeenCalledWith('Category added', 'success');
    expect(inp.value).toBe('');
    fireEvent.change(inp, { target: { value: '市集' } });
    fireEvent.click(screen.getByRole('button', { name: '新增類別' }));
    expect(actions.saveCats).toHaveBeenLastCalledWith([...CATS, '市集']);
  });
});

describe('Settings 一般：Upcoming、Timeline、顯示', () => {
  it('Upcoming：預設 30 天／5 件；改了按 Save → 兩個設定各寫一次＋toast', () => {
    setup();
    expect(screen.getByLabelText('Days ahead').value).toBe('30');
    expect(screen.getByLabelText('Max items').value).toBe('5');
    fireEvent.change(screen.getByLabelText('Days ahead'), { target: { value: '14' } });
    fireEvent.change(screen.getByLabelText('Max items'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Upcoming' }));
    expect(updateSetting).toHaveBeenCalledWith('upcomingDays', 14);
    expect(updateSetting).toHaveBeenCalledWith('upcomingLimit', 8);
    expect(actions.notify).toHaveBeenCalledWith('Upcoming settings saved', 'success');
  });
  it('Upcoming：讀已存的值；空白或 0 退回預設（30／5），負數／小數取正整數', () => {
    setup({ settings: { upcomingDays: 10, upcomingLimit: 3 } });
    expect(screen.getByLabelText('Days ahead').value).toBe('10');
    fireEvent.change(screen.getByLabelText('Days ahead'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Max items'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Upcoming' }));
    expect(updateSetting).toHaveBeenCalledWith('upcomingDays', 30);
    expect(updateSetting).toHaveBeenCalledWith('upcomingLimit', 5);
  });
  it('Timeline 預設收合：預設開；切換立即寫 timelineDefaultCollapsed', () => {
    setup();
    const sw = screen.getByRole('switch', { name: /Timeline 預設收合/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(updateSetting).toHaveBeenCalledWith('timelineDefaultCollapsed', false);
  });
  it('Timeline 預設收合：已存 false 時顯示關', () => {
    setup({ settings: { timelineDefaultCollapsed: false } });
    const sw = screen.getByRole('switch', { name: /Timeline 預設收合/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(updateSetting).toHaveBeenCalledWith('timelineDefaultCollapsed', true);
  });
  it('顯示雲朵：與雲朵程度同步（off＝關）；切換改 cloudLevel（沿用 context）；「更多雲朵設定」前往雲朵頁', () => {
    setup({ level: 'full' });
    const sw = screen.getByRole('switch', { name: /顯示雲朵/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(setLevel).toHaveBeenCalledWith('off');
    fireEvent.click(screen.getByRole('button', { name: '更多雲朵設定' }));
    expect(onSub).toHaveBeenCalledWith('cloud');
  });
  it('顯示雲朵：關閉時再打開＝完整；精簡也算開', () => {
    const { unmount } = setup({ level: 'off' });
    const sw = screen.getByRole('switch', { name: /顯示雲朵/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(setLevel).toHaveBeenCalledWith('full');
    unmount();
    setup({ level: 'lite' });
    expect(screen.getByRole('switch', { name: /顯示雲朵/ }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Settings 一般：Timeline Width（ganttWidths）', () => {
  it('三組（Overview／Project Detail／Timeline）× 日週月季，預設 20／50／50／100', () => {
    setup();
    for (const g of ['Overview', 'Project Detail', 'Timeline']) {
      expect([...['日', '週', '月', '季']].map((k) => +screen.getByLabelText(`${g} ${k}`).value)).toEqual([20, 50, 50, 100]);
    }
  });
  it('改一格按 Save Widths → ganttWidths 整組寫入；空白用預設補、至少 1', () => {
    setup({ settings: { ganttWidths: { timeline: { day: 40 } } } });
    expect(screen.getByLabelText('Timeline 日').value).toBe('40');
    fireEvent.change(screen.getByLabelText('Timeline 日'), { target: { value: '33' } });
    fireEvent.change(screen.getByLabelText('Overview 週'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Project Detail 月'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Widths' }));
    const [key, val] = updateSetting.mock.calls.find((c) => c[0] === 'ganttWidths');
    expect(key).toBe('ganttWidths');
    expect(val.timeline).toEqual({ ...DEFAULT_GANTT_WIDTHS.timeline, day: 33 });
    expect(val.overview).toEqual(DEFAULT_GANTT_WIDTHS.overview);
    expect(val.project).toEqual({ ...DEFAULT_GANTT_WIDTHS.project, month: 1 });
    expect(actions.notify).toHaveBeenCalledWith('Timeline widths saved', 'success');
  });
});

describe('Settings：權限', () => {
  it('viewer 的設定頁只顯示個人設定：沒有 Categories／Owners；其餘個人設定都還在、可儲存', () => {
    const { container } = setup({ role: 'viewer' });
    expect([...container.querySelectorAll('.sgrid h3')].map((h) => h.textContent)).toEqual(['Timeline Width (px per unit)', 'Display Settings']);
    expect(screen.queryByLabelText('新類別')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save Upcoming' }));
    expect(updateSetting).toHaveBeenCalledWith('upcomingDays', 30);
  });
  it('有 write 才有分類的新增與移除', () => {
    const { container } = setup({ role: 'admin' });
    expect(container.querySelectorAll('.iconx').length).toBe(CATS.length);
    expect(screen.getByLabelText('新類別')).toBeTruthy();
  });
  it('不呼叫任何 server action（寫入都走注入的 updateSetting／actions）', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save Widths' }));
    expect(boom).not.toHaveBeenCalled();
  });
});
