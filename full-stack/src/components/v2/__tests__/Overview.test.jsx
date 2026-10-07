import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import Overview from '@/components/v2/Overview';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

// 任何 server action 被呼叫都算違規（Overview 只讀資料，不得有寫入副作用）
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const OWNERS = ['Felien 車', 'Karen', 'Rae', 'Oliver', '幸真', 'Rock'];
let updateSetting, props;
// 雲朵 svg 內含 <title>／<desc>，比對文字前先拿掉
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); return c.textContent; };

const setup = ({ settings = {}, level = 'full', ...over } = {}) => {
  props = { twp, projects: FIXTURE_PROJECTS, userName: 'Rock', userNames: OWNERS, today: FIXTURE_TODAY, onJumpMy: vi.fn(), onOpenProject: vi.fn(), onOpenTask: vi.fn(), ...over };
  return render(
    <CloudLevelProvider level={level}>
      <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
        <Overview {...props} />
      </V2SettingsProvider>
    </CloudLevelProvider>
  );
};
beforeEach(() => { updateSetting = vi.fn(); boom.mockClear(); });

describe('Overview：雲朵播報列', () => {
  it('文案與三個計數（逾期／7 天內到期／本月完成）', () => {
    const { container } = setup();
    expect(container.querySelector('.bubble').textContent).toContain('雲朵播報 · 今天 2026/10/07 · 你名下的任務');
    expect(container.querySelector('.bubble p').textContent).toBe('今天有 3 件逾期、3 件 7 天內到期，本月已完成 3 件');
    const btns = container.querySelectorAll('.cnt3');
    expect([...btns].map(txt)).toEqual(['3逾期', '37 天內到期', '3本月完成']);
  });

  it('計數可點：跳到 My Tasks 對應分組', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '逾期 3 件，前往 My Tasks 對應分組' }));
    fireEvent.click(screen.getByRole('button', { name: '7 天內到期 3 件，前往 My Tasks 對應分組' }));
    fireEvent.click(screen.getByRole('button', { name: '本月完成 3 件，前往 My Tasks 對應分組' }));
    expect(props.onJumpMy.mock.calls.map((c) => c[0])).toEqual(['overdue', 'soon', 'done']);
  });
});

describe('Overview：Project Timeline（縮小分段條）', () => {
  it('每個專案一列，顯示名稱、進度％、落後領先文字、逾期徽章、封存標記', () => {
    const { container } = setup();
    const rows = container.querySelectorAll('.tlx .row.pj');
    expect(rows).toHaveLength(11);
    const r = (i) => txt(rows[i]);
    expect(r(0)).toContain('TTXC 虎姑婆 駁二');
    expect(r(0)).toContain('1 逾期');
    expect(r(0)).toContain('54%');
    expect(r(0)).toContain('進度同步');
    expect(r(1)).toContain('落後約 22 天（13 點）');
    expect(r(4)).toContain('領先約 20 天（44 點）');
    expect(r(6)).toContain('待確認');
    expect(r(7)).toContain('提案中');
    expect(r(9)).toContain('（已封存）');
    expect(r(10)).toContain('暫緩');
  });

  it('狀態色：逾期紅／落後琥珀／順利綠／暫緩灰／提案粉（s-over／behind／ok／hold／prop）', () => {
    const { container } = setup();
    const st = [...container.querySelectorAll('.tlx .row.pj')].map((r) => [...r.classList].find((c) => c.startsWith('s-')));
    expect(st).toEqual(['s-over', 's-over', 's-behind', 's-over', 's-ok', 's-behind', 's-prop', 's-prop', 's-ok', 's-hold', 's-hold']);
  });

  it('分段條 10 格、今天刻度、落後斜線；aria-label 白話', () => {
    const { container } = setup();
    const bar = container.querySelectorAll('.tlx .row.pj')[2].querySelector('.hb'); // 虎姑婆和他的朋友（落後）
    expect(bar.querySelectorAll('.cells > i:not(.k)')).toHaveLength(10);
    expect(bar.querySelector('.cells .k')).not.toBeNull();
    expect(bar.querySelectorAll('.cells u').length).toBeGreaterThan(0);
    expect(bar.getAttribute('aria-label')).toBe('虎姑婆和他的朋友　進度 27%，時間已過 45%，落後約 14 天（18 點）');
    const hold = container.querySelectorAll('.tlx .row.pj')[10].querySelector('.hb'); // 暫緩：沒有今天刻度
    expect(hold.querySelector('.cells .k')).toBeNull();
  });

  it('雲朵：專案狀況雲（逾期＝烏雲）；表頭有今天標籤；端點日期 MM/DD、跨年 YYYY/MM/DD', () => {
    const { container } = setup();
    const row0 = container.querySelectorAll('.tlx .row.pj')[0];
    expect(row0.querySelector('.cl svg title').textContent).toBe('烏雲');
    expect(container.querySelector('.tlx .tf').textContent).toBe('今天 10/07');
    expect(txt(row0)).toContain('08/15');
    expect(txt(row0)).toContain('11/30');
    expect(txt(container.querySelectorAll('.tlx .row.pj')[10])).toContain('2027/01/31');
  });

  it('時間尺度：預設月，切換寫入 timeDimOverview（沿用設定 key）', () => {
    setup({ settings: { timeDimOverview: '季' } });
    const g = screen.getByRole('group', { name: '時間尺度' });
    expect([...g.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['日', 'false'], ['週', 'false'], ['月', 'false'], ['季', 'true']]);
    fireEvent.click(within(g).getByText('週'));
    expect(updateSetting).toHaveBeenCalledWith('timeDimOverview', '週');
  });

  it('點專案名稱 → onOpenProject(id)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '發行事務' }));
    expect(props.onOpenProject).toHaveBeenCalledWith('p4');
  });
});

describe('Overview：Upcoming Deadlines', () => {
  it('未來 30 天、最多 5 件、依到期日；急迫度雲；落後文字；到期天數與日期', () => {
    const { container } = setup();
    const sec = screen.getByRole('region', { name: 'Upcoming Deadlines' });
    const rows = sec.querySelectorAll('.lrow');
    expect([...rows].map((r) => r.querySelector('.n').textContent)).toEqual(['商品合作', '連連玩境影視展', "Yaya's Band 芽芽樂團", '展覽文宣與視覺設計', '週邊貼紙打樣']);
    expect(rows[0].querySelector('.due').textContent).toBe('2d2026/10/09');
    expect(txt(rows[0].querySelector('.s'))).toContain('TTXC 虎姑婆 駁二');
    expect(txt(rows[0].querySelector('.s'))).toContain('落後約 25 天（46 點）');
    expect(rows[0].querySelector('.cl svg title').textContent).toBe('烏雲');   // 2 天 → 烏雲
    expect(rows[1].querySelector('.cl svg title').textContent).toBe('粉紅雲'); // 6 天 → 粉紅
    expect(rows[3].querySelector('.cl svg title').textContent).toBe('白雲');   // 11 天 → 白雲
    expect(txt(sec)).toContain('3 件在 7 天內');
    expect(txt(sec)).toContain('未來 30 天內，最多顯示 5 件（共 9 件）');
    expect(container.textContent).not.toMatch(/雲寶寶/);
  });

  it('執行人／關注人以標籤呈現（顏色依名單順序）', () => {
    setup();
    const row = screen.getByRole('region', { name: 'Upcoming Deadlines' }).querySelector('.lrow');
    const pills = [...row.querySelectorAll('.pp')].map((p) => [p.textContent, [...p.classList].find((c) => c.length === 1)]);
    expect(pills).toEqual([['Karen', 'b'], ['Rock', 'f'], ['Rae', 'c'], ['Felien 車', 'a']]);
  });

  it('upcomingDays／upcomingLimit 設定生效；沒有到期項目 → 空狀態', () => {
    setup({ settings: { upcomingDays: 7, upcomingLimit: 2 } });
    const sec = screen.getByRole('region', { name: 'Upcoming Deadlines' });
    expect(sec.querySelectorAll('.lrow')).toHaveLength(2);
    expect(txt(sec)).toContain('未來 7 天內，最多顯示 2 件（共 3 件）');
  });

  it('點一列 → onOpenTask(該任務)', () => {
    setup();
    fireEvent.click(screen.getByText('商品合作'));
    expect(props.onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });

  it('跨專案篩選：狀態多選、優先度、專案；清除', () => {
    setup();
    const sec = () => screen.getByRole('region', { name: 'Upcoming Deadlines' });
    const names = () => [...sec().querySelectorAll('.lrow .n')].map((n) => n.textContent);
    const bar = screen.getByRole('group', { name: '跨專案篩選' });
    fireEvent.click(within(bar).getByRole('button', { name: '待辦' }));
    expect(names()).toEqual(['連連玩境影視展', '駁二場地動線規劃']);
    expect(within(bar).getByRole('button', { name: '待辦' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(bar).getByRole('button', { name: '全部', pressed: false })).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: '清除' }));
    expect(names()).toHaveLength(5);

    fireEvent.click(within(bar).getAllByRole('button', { name: '高' })[0]);
    expect(names()).toEqual(['商品合作', "Yaya's Band 芽芽樂團"]);

    fireEvent.click(within(bar).getByRole('button', { name: '清除' }));
    fireEvent.click(within(bar).getByRole('button', { name: /專案 全部/ }));
    fireEvent.click(within(screen.getByRole('group', { name: '選擇專案' })).getByRole('button', { name: '發行事務' }));
    expect(names()).toEqual(['連連玩境影視展']);
  });

  it('篩選後沒有項目：空狀態（筋斗雲＋文字）', () => {
    setup({ settings: { upcomingDays: 1 } });
    const sec = screen.getByRole('region', { name: 'Upcoming Deadlines' });
    expect(txt(sec.querySelector('.empty'))).toContain('接下來 1 天沒有到期的任務');
    expect(sec.querySelector('.empty .cl')).not.toBeNull();
  });
});

describe('Overview：狀態分布／專案狀況', () => {
  it('預設「狀態」：甜甜圈、Total 33、圖例（雲＋名稱＋數量＋百分比）', () => {
    setup();
    const sec = screen.getByRole('region', { name: 'Status Distribution' });
    expect(sec.querySelector('svg.donut').getAttribute('aria-label')).toContain('已完成 8');
    expect(sec.querySelectorAll('svg.donut path')).toHaveLength(6);
    expect(txt(sec)).toContain('33');
    expect(txt(sec)).toContain('Total');
    const li = [...sec.querySelectorAll('.lgl li')].map((l) => txt(l).replace(/\s/g, ''));
    expect(li).toEqual(['已完成8(24%)', '進行中11(33%)', '待辦5(15%)', '暫緩3(9%)', '提案中3(9%)', '待確認3(9%)']);
  });

  it('切到「專案狀況」：五種狀況圖例＋非封存專案清單（雲／名稱／原因／標籤／迷你條／％）', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '專案狀況' }));
    const sec = screen.getByRole('region', { name: '專案狀況' });
    const legend = [...sec.querySelectorAll('.lgl li')].map((l) => txt(l).replace(/\s/g, ''));
    expect(legend).toEqual(['有逾期3(30%)', '進度領先2(20%)', '進行順利2(20%)', '暫緩中1(10%)', '提案／待確認2(20%)']);
    const rows = sec.querySelectorAll('.wlist .wrow');
    expect(rows).toHaveLength(10); // 封存的不列
    expect(txt(rows[0])).toContain('TTXC 虎姑婆 駁二');
    expect(txt(rows[0])).toContain('有 1 件逾期，最久 12 天');
    expect(rows[0].querySelectorAll('.msg i')).toHaveLength(10);
    expect(txt(rows[0])).toContain('54%');
    fireEvent.click(rows[0]);
    expect(props.onOpenProject).toHaveBeenCalledWith('p1');
    // 切回
    fireEvent.click(screen.getByRole('button', { name: '狀態' }));
    expect(screen.getByRole('region', { name: 'Status Distribution' })).toBeTruthy();
  });
});

describe('Overview：雲朵三檔（full／lite／off）與副作用', () => {
  it('off：不畫任何雲，改色點／色條；文字照舊', () => {
    const { container } = setup({ level: 'off' });
    expect(container.querySelector('.cl')).toBeNull();
    expect(container.querySelectorAll('.fb').length).toBeGreaterThan(5);
    expect(container.querySelector('.bubble p').textContent).toContain('今天有 3 件逾期');
    expect(container.querySelectorAll('.tlx .row.pj')).toHaveLength(11);
  });

  it('lite：裝飾雲收起（播報列、時程、即將到期、圓餅）、改色點；空狀態仍保留雲', () => {
    const { container } = setup({ level: 'lite', settings: { upcomingDays: 1 } });
    expect(container.querySelector('.bcast .cl')).toBeNull();
    expect(container.querySelector('.tlx .cl')).toBeNull();
    expect(container.querySelector('.tlx .fb')).not.toBeNull();
    expect(container.querySelector('.empty .cl')).not.toBeNull();
  });

  it('full：雲只輔助——每朵雲 aria-hidden，旁邊都有文字', () => {
    const { container } = setup();
    const clouds = container.querySelectorAll('.cl');
    expect(clouds.length).toBeGreaterThan(10);
    clouds.forEach((c) => expect(c.getAttribute('aria-hidden')).toBe('true'));
  });

  it('只讀：不呼叫任何 server action', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '專案狀況' }));
    fireEvent.click(screen.getAllByRole('button', { name: /TTXC/ })[0]);
    expect(boom).not.toHaveBeenCalled();
  });
});
