import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import Settings from '@/components/v2/Settings';
import Cloud from '@/components/v2/Cloud';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
let updateSetting, setLevel;
const mockReduced = (on) => vi.stubGlobal('matchMedia', (q) => ({ matches: on && /prefers-reduced-motion/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const setup = ({ role = 'admin', level = 'full', settings = {} } = {}) => {
  updateSetting = vi.fn(async () => ({ success: true }));
  setLevel = vi.fn();
  return render(
    <PermissionProvider role={role}>
      <CloudLevelProvider level={level} setLevel={setLevel}>
        <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
          <Settings sub="cloud" onSub={() => {}} config={{ cats: [], owners: FIXTURE_OWNERS }} actions={{ saveCats() {}, notify() {} }}
            preview={{ twp, projects: FIXTURE_PROJECTS, userName: 'Rock', today: FIXTURE_TODAY }} />
        </V2SettingsProvider>
      </CloudLevelProvider>
    </PermissionProvider>
  );
};
beforeEach(() => { boom.mockClear(); mockReduced(false); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('雲朵設定頁：標題與顯示程度', () => {
  it('標題帶 96px 白雲與說明；就算顯示程度＝關閉，這頁的雲仍然顯示（唯一放雲的設定頁）', () => {
    const { container } = setup({ level: 'off' });
    const hd = container.querySelector('.chd');
    expect(hd.querySelector('.cl').style.getPropertyValue('--s')).toBe('96px');
    expect(within(hd).getByRole('heading', { name: '雲朵' })).toBeTruthy();
    expect(hd.textContent).toContain('只影響你自己的畫面');
    expect(container.querySelectorAll('.ctab .cl').length).toBe(5);
  });

  it('顯示程度：完整／精簡／關閉；目前值 aria-pressed；點了走 cloudLevel（沿用 context）', () => {
    setup({ level: 'lite' });
    const seg = screen.getByRole('group', { name: '顯示程度' });
    expect(within(seg).getAllByRole('button').map((b) => b.textContent)).toEqual(['完整', '精簡', '關閉']);
    expect(within(seg).getByText('精簡').getAttribute('aria-pressed')).toBe('true');
    expect(within(seg).getByText('完整').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(seg).getByText('關閉'));
    expect(setLevel).toHaveBeenCalledWith('off');
    fireEvent.click(within(seg).getByText('完整'));
    expect(setLevel).toHaveBeenCalledWith('full');
  });

  it('每個個人設定旁有「個人設定」標記；viewer 也能改（self）', () => {
    const { container } = setup({ role: 'viewer' });
    expect(container.querySelectorAll('.setrow .badge').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(within(screen.getByRole('group', { name: '顯示程度' })).getByText('精簡'));
    expect(setLevel).toHaveBeenCalledWith('lite');
  });
});

describe('雲朵設定頁：動態效果（cloudMotion）', () => {
  it('預設開（aria-checked=true）；切換寫 cloudMotion=false；已存 false 時顯示關、再按開回來', () => {
    const { unmount } = setup();
    const sw = screen.getByRole('switch', { name: /動態效果/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.disabled).toBe(false);
    fireEvent.click(sw);
    expect(updateSetting).toHaveBeenCalledWith('cloudMotion', false);
    unmount();
    setup({ settings: { cloudMotion: false } });
    const sw2 = screen.getByRole('switch', { name: /動態效果/ });
    expect(sw2.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw2);
    expect(updateSetting).toHaveBeenCalledWith('cloudMotion', true);
  });

  it('動態預覽：開＝白雲 bob、筋斗雲 fly；關＝靜止並標示「目前靜止」', () => {
    const { container, unmount } = setup();
    const pv = container.querySelector('.mprev');
    expect(pv.querySelector('.cl.bob')).not.toBeNull();
    expect(pv.querySelector('.cl.fly')).not.toBeNull();
    expect(pv.textContent).not.toContain('目前靜止');
    unmount();
    const off = setup({ settings: { cloudMotion: false } });
    const pv2 = off.container.querySelector('.mprev');
    expect(pv2.querySelector('.bob,.fly')).toBeNull();
    expect(pv2.textContent).toContain('目前靜止');
  });

  it('系統開了「減少動態」：與個人設定取交集——開關停用且顯示關、預覽一律靜止，並說明原因', () => {
    mockReduced(true);
    const { container } = setup({ settings: { cloudMotion: true } });
    const sw = screen.getByRole('switch', { name: /動態效果/ });
    expect(sw.disabled).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('.mprev .bob,.mprev .fly')).toBeNull();
    expect(container.querySelector('.mprev').textContent).toContain('目前靜止');
    expect(screen.getByText(/偵測到你的系統已開啟「減少動態」/)).toBeTruthy();
    fireEvent.click(sw);
    expect(updateSetting).not.toHaveBeenCalled();
  });
});

describe('Cloud 元件：cloudMotion 關閉時不套用 bob／fly', () => {
  const wrap = (settings, ui) => render(<CloudLevelProvider level="full"><V2SettingsProvider value={{ settings, updateSetting: vi.fn(), ready: true }}>{ui}</V2SettingsProvider></CloudLevelProvider>);
  it('預設（沒設定）有動態；cloudMotion=false 沒有；沒有 Provider（登入頁）預設有', () => {
    expect(wrap({}, <Cloud kind="white" motion="bob" />).container.querySelector('.cl.bob')).not.toBeNull();
    expect(wrap({ cloudMotion: false }, <Cloud kind="white" motion="bob" />).container.querySelector('.cl.bob')).toBeNull();
    expect(wrap({ cloudMotion: false }, <Cloud kind="nimbus" motion="fly" />).container.querySelector('.cl')).not.toBeNull();
    expect(render(<Cloud kind="white" motion="fly" />).container.querySelector('.cl.fly')).not.toBeNull();
  });
  it('v2.css：系統「減少動態」時 bob／fly 一律 animation:none（取交集的另一半）', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(`${process.cwd()}/src/styles/v2.css`, 'utf8');
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\s*\{[^}]*\.v2 \.bob, \.v2 \.fly \{ animation:none; \}/);
  });
});

describe('雲朵設定頁：預覽、圖鑑、使用規則', () => {
  it('預覽：播一次「完成了！」提示條（role=status），過幾秒自己收起', () => {
    vi.useFakeTimers();
    setup();
    expect(screen.queryByText('完成了！')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '預覽' }));
    expect(screen.getByText('完成了！')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('完成了！')).toBeNull();
  });

  it('圖鑑：五朵雲各有名稱、代表什麼（個性）、出現在哪', () => {
    const { container } = setup();
    const rows = [...container.querySelectorAll('.ctab tr.cr')];
    expect(rows.map((r) => r.querySelector('.rb > span:last-child').textContent)).toEqual(['白雲', '粉紅雲', '淡紫雲', '烏雲', '筋斗雲']);
    expect(rows[0].textContent).toContain('日常、進行中、品牌');
    expect(rows[0].textContent).toContain('預設、最親切');
    expect(rows[0].textContent).toContain('頁首 Logo、載入中');
    expect(rows[3].textContent).toContain('逾期任務、衝突或錯誤提示');
    expect(rows[4].textContent).toContain('一個筋斗翻十萬八千里');
    expect(container.querySelector('.ctab thead').textContent).toBe('雲它代表出現在哪');
  });

  it('點一列展開「這朵雲出現在哪」3 個預覽；再點收起；點別列換成那朵', () => {
    const { container } = setup();
    const rb = (n) => screen.getByRole('button', { name: new RegExp(`^${n}$`) });
    expect(container.querySelector('.cprev')).toBeNull();
    fireEvent.click(rb('白雲'));
    const pv = screen.getByRole('region', { name: '白雲出現在哪的預覽' });
    expect(pv.querySelectorAll('figure.cex')).toHaveLength(3);
    expect([...pv.querySelectorAll('figcaption')].map((f) => f.textContent)).toEqual(['頁首 Logo', 'My Tasks · 進行中 KPI', '載入中']);
    expect(rb('白雲').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(rb('烏雲'));
    expect(screen.queryByRole('region', { name: '白雲出現在哪的預覽' })).toBeNull();
    expect([...screen.getByRole('region', { name: '烏雲出現在哪的預覽' }).querySelectorAll('figcaption')].map((f) => f.textContent)).toEqual(['My Tasks · 已逾期 KPI', '逾期 分組標題', '專案狀況 chip「有逾期」']);
    fireEvent.click(rb('烏雲'));
    expect(container.querySelector('.cprev')).toBeNull();
  });

  it('預覽用的數字取自真資料（登入者 Rock：逾期 3、7 天內 3、本月完成 3）', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^烏雲$/ }));
    const kpi = screen.getByRole('region', { name: '烏雲出現在哪的預覽' }).querySelector('.kpi-n');
    expect(kpi.textContent).toBe('3');
  });

  it('其餘三朵雲的預覽標題', () => {
    setup();
    const caps = (name) => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}$`) })); return [...screen.getByRole('region', { name: `${name}出現在哪的預覽` }).querySelectorAll('figcaption')].map((f) => f.textContent); };
    expect(caps('粉紅雲')).toEqual(['My Tasks · 7 天內到期 KPI', '說明氣泡（小提示）', '任務狀態「提案中」']);
    expect(caps('淡紫雲')).toEqual(['My Tasks · 之後 分組', '任務狀態「暫緩」', '篩選後沒有結果']);
    expect(caps('筋斗雲')).toEqual(['My Tasks · 本月完成 KPI', '完成任務的提示條', 'Timeline · 進度領先 badge']);
  });

  it('圖鑑與預覽不受顯示程度影響（關閉時仍有雲）', () => {
    const { container } = setup({ level: 'off' });
    fireEvent.click(screen.getByRole('button', { name: /^粉紅雲$/ }));
    expect(container.querySelector('.cprev .cl')).not.toBeNull();
  });

  it('使用規則 5 條', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.crules li')].map((l) => l.textContent)).toEqual([
      '每個畫面最多 5 種雲', '雲只是輔助，旁邊一定有文字', '資料表、設定、帳號管理不放雲（除了這一頁）', '只有兩種動態：載入時上下飄、完成時筋斗雲飛過', '尊重系統的「減少動態」設定']);
    expect(container.textContent).toContain('雲朵目前是向量草稿');
  });

  it('不出現「雲寶寶」', () => {
    const { container } = setup();
    expect(container.textContent).not.toContain('雲寶寶');
  });
});
