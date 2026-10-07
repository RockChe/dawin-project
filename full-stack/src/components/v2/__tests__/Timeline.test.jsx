import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import Timeline from '@/components/v2/Timeline';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

// 任何 server action 被呼叫都算違規（Timeline 只讀資料；個人設定走 updateSetting 這個注入的 mock）
const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
let updateSetting, props;
// 雲朵 svg 內含 <title>／<desc>，比對文字前先拿掉
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); return c.textContent; };

const setup = ({ settings = {}, level = 'full', ...over } = {}) => {
  localStorage.clear();
  props = { twp, projects: FIXTURE_PROJECTS, userNames: FIXTURE_OWNERS, today: FIXTURE_TODAY, onOpenProject: vi.fn(), onOpenTask: vi.fn(), ...over };
  return render(
    <CloudLevelProvider level={level}>
      <V2SettingsProvider value={{ settings, updateSetting, ready: true }}>
        <Timeline {...props} />
      </V2SettingsProvider>
    </CloudLevelProvider>
  );
};
beforeEach(() => { updateSetting = vi.fn(); boom.mockClear(); });

const pjRows = (c) => [...c.querySelectorAll('.tlx .row.pj')];
const tkRows = (c) => [...c.querySelectorAll('.tlx .row.tk')];

describe('Timeline 甘特：專案列', () => {
  it('預設全部收折（timelineDefaultCollapsed 預設 true）：10 個專案列、沒有任務列；封存專案不顯示', () => {
    const { container } = setup();
    expect(pjRows(container)).toHaveLength(10);
    expect(tkRows(container)).toHaveLength(0);
    expect(container.textContent).not.toContain('臨時動議');
  });

  it('個人隱藏（hiddenProjects）的專案不顯示', () => {
    const { container } = setup({ settings: { hiddenProjects: ['p3', 'p5'] } });
    expect(pjRows(container)).toHaveLength(8);
    expect(container.textContent).not.toContain('虎姑婆和他的朋友');
  });

  it('列內容：專案色只在左 4px、名稱一般文字色、逾期徽章、N 項任務、狀況雲', () => {
    const { container } = setup();
    const r0 = pjRows(container)[0];
    expect(r0.querySelector('.swl').getAttribute('style')).toContain('var(--accent)');
    expect(r0.querySelector('.nm b').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(r0.querySelector('.pill-od').textContent).toBe('1 逾期');
    expect(r0.querySelector('.dt').textContent).toBe('8 項任務');
    expect(r0.querySelector('.cl svg title').textContent).toBe('烏雲');
    expect(r0.querySelector('.sr').textContent).toBe('（有逾期）');
  });

  it('條：外框＝起訖、兩端日期（MM/DD，跨年 YYYY/MM/DD）、10 格、今天刻度、落後斜線', () => {
    const { container } = setup();
    const rows = pjRows(container);
    expect(txt(rows[0].querySelector('.tr'))).toContain('08/15');
    expect(txt(rows[0].querySelector('.tr'))).toContain('11/30');
    expect(txt(rows[9].querySelector('.tr'))).toContain('2027/01/31');
    const bar = rows[2].querySelector('.hb'); // 虎姑婆和他的朋友（落後）
    expect(bar.querySelectorAll('.cells > i:not(.k)')).toHaveLength(10);
    expect(bar.querySelector('.cells .k')).not.toBeNull();
    expect(bar.querySelectorAll('.cells u').length).toBeGreaterThan(0);
    expect(bar.className).toContain('s-behind');
    expect(rows[9].querySelector('.hb .cells .k')).toBeNull(); // 暫緩沒有今天刻度
  });

  it('條上標籤：落後「落後約 N 天」、領先含筋斗雲「領先約 N 天」；進度同步不標', () => {
    const { container } = setup();
    const rows = pjRows(container);
    expect(rows[2].querySelector('.tr .lb.behind').textContent).toBe('落後約 14 天');
    const ahead = rows[4].querySelector('.tr .lb.ahead');
    expect(txt(ahead)).toBe('領先約 20 天');
    expect(ahead.querySelector('.cl svg title').textContent).toBe('筋斗雲');
    expect(rows[0].querySelector('.tr .lb')).toBeNull();
  });

  it('雲朵精簡：領先標籤改 ▲ 文字、狀況雲退回色點', () => {
    const { container } = setup({ level: 'lite' });
    const rows = pjRows(container);
    expect(rows[4].querySelector('.lb.ahead .cl')).toBeNull();
    expect(rows[4].querySelector('.lb.ahead .fbt').textContent).toBe('▲');
    expect(rows[0].querySelector('.cl')).toBeNull();
    expect(rows[0].querySelector('.fb.dot')).not.toBeNull();
  });

  it('右欄固定四欄「進度・到期・對時間・狀態」；專案：逾期烏雲＋「逾期 N 天」、其餘為狀態標籤', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.hd .rc span')].map((s) => s.textContent)).toEqual(['進度', '到期', '對時間', '狀態']);
    const rows = pjRows(container);
    const cells = (r) => [...r.querySelectorAll('.rc > *')].map(txt);
    expect(cells(rows[0])).toEqual(['54%', '11/30', '進度同步', '逾期 12 天']);
    expect(rows[0].querySelector('.rc .od .cl svg title').textContent).toBe('烏雲');
    expect(cells(rows[1])).toEqual(['55%', '11/30', '落後約 22 天（13 點）', '逾期 2 天']);
    expect(cells(rows[4])).toEqual(['92%', '10/31', '領先約 20 天（44 點）', '進行中']);
    expect(cells(rows[9])).toEqual(['0%', '2027/01/31', '暫緩', '暫緩']);
    expect(rows[6].querySelector('.rc .st.conf').textContent).toBe('待確認');
  });

  it('表頭：今天標籤「今天 10/07」在表頭、不在列內；有 10 個月刻度以外的 年份群組', () => {
    const { container } = setup();
    expect(container.querySelector('.hd .tf').textContent).toBe('今天 10/07');
    expect(container.querySelectorAll('.row .tf')).toHaveLength(0);
    expect(container.querySelector('.hov .today')).not.toBeNull();
    expect([...container.querySelectorAll('.hd .r1 span')].map((s) => s.textContent)).toEqual(['2026', '2027']);
  });
});

describe('Timeline 甘特：展開任務', () => {
  it('點專案的展開鈕：接著出現該專案的任務列，用任務自己的日期；再點收折', () => {
    const { container } = setup();
    const tg = within(pjRows(container)[1]).getByRole('button', { name: '展開「科教館公益展廳」的任務' });
    fireEvent.click(tg);
    expect(tkRows(container)).toHaveLength(3);
    const t = tkRows(container).map((r) => r.querySelector('.nm b').textContent);
    expect(t).toEqual(['展廳佈展', '文化部結案報告', '公益導覽員培訓']); // 依開始日
    const t9 = tkRows(container)[1];
    expect(txt(t9.querySelector('.tr'))).toContain('08/01');
    expect(txt(t9.querySelector('.tr'))).toContain('10/05');
    expect([...t9.querySelectorAll('.rc > *')].map(txt)[3]).toBe('逾期 2 天');
    expect(t9.querySelector('.swl')).toBeNull(); // 任務列沒有專案色塊
    expect(within(pjRows(container)[1]).getByRole('button', { name: '收折「科教館公益展廳」的任務' })).toBeTruthy();
    fireEvent.click(within(pjRows(container)[1]).getByRole('button', { name: '收折「科教館公益展廳」的任務' }));
    expect(tkRows(container)).toHaveLength(0);
  });

  it('timelineDefaultCollapsed=false：預設全展開（10 個專案＋所有任務列）', () => {
    const { container } = setup({ settings: { timelineDefaultCollapsed: false } });
    expect(pjRows(container)).toHaveLength(10);
    expect(tkRows(container)).toHaveLength(33 - 2); // 33 件任務扣掉封存專案的 2 件
  });

  it('全部展開／全部收折：切換整批並寫回 timelineDefaultCollapsed', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
    expect(tkRows(container).length).toBe(31);
    expect(updateSetting).toHaveBeenLastCalledWith('timelineDefaultCollapsed', false);
    fireEvent.click(screen.getByRole('button', { name: '全部收折' }));
    expect(tkRows(container)).toHaveLength(0);
    expect(updateSetting).toHaveBeenLastCalledWith('timelineDefaultCollapsed', true);
  });

  it('逐專案收折狀態存 localStorage（dash-timelineCollapsed，同舊版 key）；掛載後依它還原', () => {
    const { container, unmount } = setup();
    fireEvent.click(within(pjRows(container)[0]).getByRole('button', { name: /展開「TTXC/ }));
    expect(JSON.parse(localStorage.getItem('dash-timelineCollapsed'))).not.toContain('p1');
    unmount();
    const again = render(
      <CloudLevelProvider level="full"><V2SettingsProvider value={{ settings: {}, updateSetting, ready: true }}><Timeline {...props} /></V2SettingsProvider></CloudLevelProvider>
    );
    expect(tkRows(again.container).length).toBe(8); // 只有 p1 展開
  });

  it('任務列左欄：階層縮排的任務狀態雲與名稱；暫緩列沒有今天刻度', () => {
    const { container } = setup({ settings: { timelineDefaultCollapsed: false } });
    const hold = tkRows(container).find((r) => r.querySelector('.nm b').textContent === '兒童工作坊加場');
    expect(hold.querySelector('.hb').className).toContain('s-hold');
    expect(hold.querySelector('.cells .k')).toBeNull();
    expect(txt(hold.querySelector('.rc'))).toContain('暫緩');
  });
});

describe('Timeline：工具列', () => {
  it('視圖切換：甘特／卡片，寫入 timelineView（沿用設定 key）', () => {
    setup({ settings: { timelineView: 'gantt' } });
    const g = screen.getByRole('group', { name: '視圖切換' });
    expect([...g.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['甘特', 'true'], ['卡片', 'false']]);
    fireEvent.click(within(g).getByText('卡片'));
    expect(updateSetting).toHaveBeenCalledWith('timelineView', 'card');
  });

  it('時間尺度：預設月，寫入 timeDimTimeline；卡片視圖不顯示尺度', () => {
    setup({ settings: { timeDimTimeline: '季' } });
    const g = screen.getByRole('group', { name: '時間尺度' });
    expect([...g.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['日', 'false'], ['週', 'false'], ['月', 'false'], ['季', 'true']]);
    fireEvent.click(within(g).getByText('日'));
    expect(updateSetting).toHaveBeenCalledWith('timeDimTimeline', '日');
  });

  it('尺度改變：軌道刻度跟著變（日＝日期數字；季＝Q）', () => {
    const { container } = setup({ settings: { timeDimTimeline: '日' } });
    expect(container.querySelector('.hd .r1 span').textContent).toBe('2026 · 9月');
    expect(container.querySelectorAll('.hd .r2 span').length).toBe(28);
  });

  it('排序下拉：手動／名稱／進度／到期日；改名稱＝專案列依名稱排並寫入 timelineSort', () => {
    const { container } = setup();
    const sel = screen.getByLabelText('排序方式');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['排序：手動', '排序：名稱', '排序：進度', '排序：到期日']);
    fireEvent.change(sel, { target: { value: 'name' } });
    const names = pjRows(container).map((r) => r.querySelector('.nm b').textContent);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
    expect(updateSetting).toHaveBeenCalledWith('timelineSort', 'name');
  });

  it('排序「到期日」：只改畫面、不寫入設定（舊版 timelineSort 沒有這個值）', () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText('排序方式'), { target: { value: 'due' } });
    const ends = pjRows(container).map((r) => r.querySelector('.rc > span').textContent);
    expect(ends[0]).toBe('10/30');
    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('排序初始值取自 timelineSort 設定', () => {
    setup({ settings: { timelineSort: 'progress' } });
    expect(screen.getByLabelText('排序方式').value).toBe('progress');
  });
});

describe('Timeline：專案狀況統計列', () => {
  it('5 種狀況＋數量（不含封存）；合計＝可見專案數', () => {
    setup();
    const g = screen.getByRole('group', { name: /專案狀況統計/ });
    const chips = [...g.querySelectorAll('.wxc')].map((b) => txt(b));
    expect(chips).toEqual(['有逾期3', '進度領先2', '進行順利2', '暫緩中1', '提案／待確認2']);
  });

  it('點一顆＝標出該狀況（其他專案變淡 .dim），再點取消；「取消標出」按鈕', () => {
    const { container } = setup();
    const btn = screen.getByRole('button', { name: /^有逾期/ });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(pjRows(container).filter((r) => r.classList.contains('dim'))).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: '取消標出' }));
    expect(pjRows(container).filter((r) => r.classList.contains('dim'))).toHaveLength(0);
  });

  it('展開後任務列跟著所屬專案的狀況變淡', () => {
    const { container } = setup({ settings: { timelineDefaultCollapsed: false } });
    fireEvent.click(screen.getByRole('button', { name: /^有逾期/ }));
    const t = tkRows(container).find((r) => r.querySelector('.nm b').textContent === '展廳佈展'); // p2 有逾期
    const u = tkRows(container).find((r) => r.querySelector('.nm b').textContent === '縮圖範本更新'); // p9 進度領先？不是逾期
    expect(t.classList.contains('dim')).toBe(false);
    expect(u.classList.contains('dim')).toBe(true);
  });
});

describe('Timeline：篩選', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: /^篩選/ }));

  it('popover：專案狀態／風險／任務狀態／優先度／專案；開關 aria-expanded；完成關閉', () => {
    setup();
    const b = screen.getByRole('button', { name: /^篩選/ });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    open();
    expect(b.getAttribute('aria-expanded')).toBe('true');
    const d = screen.getByRole('dialog', { name: '篩選條件' });
    expect([...d.querySelectorAll('legend')].map((l) => l.textContent)).toEqual(['專案狀態', '風險', '任務狀態（展開後的任務列）', '優先度', '專案']);
    fireEvent.click(within(d).getByRole('button', { name: '完成' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('專案狀態「暫緩」→ 只剩 1 個專案，篩選鈕顯示條件數，狀況統計跟著變，腳註顯示 1 / 10', () => {
    const { container } = setup();
    open();
    fireEvent.click(within(within(screen.getByRole('dialog')).getByRole('group', { name: '專案狀態' })).getByRole('button', { name: '暫緩' }));
    expect(pjRows(container)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^篩選/ }).querySelector('.cnt').textContent).toBe('1');
    expect(txt(screen.getByRole('button', { name: /^暫緩中/ }))).toBe('暫緩中1');
    expect(container.querySelector('.tlfoot').textContent).toContain('篩選中：顯示 1 / 10 個專案');
  });

  it('風險「有逾期」；專案多選；清除', () => {
    const { container } = setup();
    open();
    const d = screen.getByRole('dialog');
    fireEvent.click(within(d).getByRole('button', { name: '有逾期' }));
    expect(pjRows(container)).toHaveLength(3);
    fireEvent.click(within(d).getByRole('button', { name: '清除' }));
    expect(pjRows(container)).toHaveLength(10);
    fireEvent.click(within(within(d).getByRole('group', { name: '專案' })).getByRole('button', { name: '發行事務' }));
    expect(pjRows(container)).toHaveLength(1);
  });

  it('任務狀態／優先度只影響展開的任務列，不會讓專案消失', () => {
    const { container } = setup({ settings: { timelineDefaultCollapsed: false } });
    open();
    const d = screen.getByRole('dialog');
    fireEvent.click(within(within(d).getByRole('group', { name: '任務狀態（展開後的任務列）' })).getByRole('button', { name: '已完成' }));
    expect(pjRows(container)).toHaveLength(10);
    expect(tkRows(container).every((r) => r.querySelector('.st.done'))).toBe(true);
  });

  it('沒有符合的專案：空狀態與提示', () => {
    const { container } = setup({ twp: [] });
    expect(container.querySelector('.empty b').textContent).toBe('沒有可顯示的專案');
  });
});

describe('Timeline：選取與詳情', () => {
  it('預設不選任何列、詳情隱藏；點專案列→詳情顯示（期間、進度／時間、逾期、成員）並有「開啟專案」', () => {
    const { container } = setup();
    const det = container.querySelector('.tdet');
    expect(det.hidden).toBe(true);
    fireEvent.click(pjRows(container)[1]);
    expect(pjRows(container)[1].getAttribute('aria-current')).toBe('true');
    expect(det.hidden).toBe(false);
    expect(txt(det)).toContain('科教館公益展廳');
    expect(txt(det)).toContain('2026/06/15 → 2026/11/30');
    expect(txt(det)).toContain('55% ／ 68%');
    expect(txt(det)).toContain('1 件（最久 2 天：文化部結案報告）');
    fireEvent.click(within(det).getByRole('button', { name: '開啟專案 ›' }));
    expect(props.onOpenProject).toHaveBeenCalledWith('p2');
  });

  it('點任務列＝選取其專案；點任務名稱不誤開', () => {
    const { container } = setup({ settings: { timelineDefaultCollapsed: false } });
    fireEvent.click(tkRows(container)[0]);
    expect(container.querySelector('.tdet').hidden).toBe(false);
    expect(props.onOpenTask).not.toHaveBeenCalled();
  });
});

describe('Timeline 卡片視圖', () => {
  const card = (o = {}) => setup({ settings: { timelineView: 'card' }, ...o });

  it('五個分組（已逾期預設收合）；組內專案數；卡片視圖不顯示尺度', () => {
    const { container } = card();
    const lanes = [...container.querySelectorAll('.board .lane')].map((l) => l.getAttribute('aria-label'));
    expect(lanes).toEqual(['已逾期（已收折）', '這週', '本月', '下月', '之後']);
    expect([...container.querySelectorAll('.board .lane > .lhd .n')].map((n) => n.textContent)).toEqual(['3', '1', '3', '2', '1']);
    expect(container.querySelector('.board').className).toContain('col');
    expect(screen.queryByRole('group', { name: '時間尺度' })).toBeNull();
    expect(screen.getByText('依「下個里程碑」到期日分組')).toBeTruthy();
  });

  it('已逾期收合時：列出專案名＋逾期天數；展開後是完整卡片，可再收折', () => {
    const { container } = card();
    const over = container.querySelector('.lane.over');
    expect([...over.querySelectorAll('.cm')].map((b) => txt(b))).toEqual(
      expect.arrayContaining([expect.stringContaining('TTXC 虎姑婆 駁二'), expect.stringContaining('逾期 12 天')]));
    expect(over.querySelectorAll('article.cd')).toHaveLength(0);
    fireEvent.click(within(over).getByRole('button', { name: '展開 ▸' }));
    const open = container.querySelector('.lane.over');
    expect(open.querySelectorAll('article.cd')).toHaveLength(3);
    expect(container.querySelector('.board').className).not.toContain('col');
    fireEvent.click(within(open).getByRole('button', { name: '◂ 收折' }));
    expect(container.querySelectorAll('.lane.over article.cd')).toHaveLength(0);
  });

  it('卡片內容：名稱、期間、里程碑、進度環、時間／進度小條、成員頭像、對時間文字、開啟專案', () => {
    const { container } = card();
    const c = container.querySelector('.lane.wk article.cd'); // 虎姑婆和他的朋友
    expect(c.className).toContain('s-behind');
    expect(c.querySelector('.nm b').textContent).toBe('虎姑婆和他的朋友');
    expect(c.querySelector('.dt').textContent).toBe('09/01 → 11/20');
    expect(c.querySelector('.ms').textContent).toBe('下個里程碑：Yaya\'s Band 芽芽樂團 · 10/14（7 天後）');
    expect(c.querySelector('.pring b').textContent).toBe('27%');
    expect([...c.querySelectorAll('.tvb .v')].map((v) => v.textContent)).toEqual(['45%', '27%']);
    expect(c.querySelector('.gx').textContent).toBe('落後約 14 天（18 點）');
    expect(c.querySelectorAll('.havs .hav').length).toBeGreaterThan(0);
    expect(c.querySelector('.swl').getAttribute('style')).toContain('var(--amber)');
    fireEvent.click(within(c).getByRole('button', { name: '開啟專案 ›' }));
    expect(props.onOpenProject).toHaveBeenCalledWith('p3');
  });

  it('逾期卡片的里程碑文字是「逾期：任務 · 日期（N 天）」', () => {
    const { container } = card();
    fireEvent.click(within(container.querySelector('.lane.over')).getByRole('button', { name: '展開 ▸' }));
    const c = [...container.querySelectorAll('.lane.over article.cd')].find((x) => x.querySelector('.nm b').textContent === 'TTXC 虎姑婆 駁二');
    expect(c.querySelector('.ms').textContent).toBe('逾期：票務展務相關 · 09/25（12 天）');
  });

  it('卡片展開／收折專案的未完成任務清單（與甘特共用收折狀態）', () => {
    const { container } = card({ settings: { timelineView: 'card', timelineDefaultCollapsed: false } });
    const c = container.querySelector('.lane.wk article.cd');
    expect([...c.querySelectorAll('ul.tl li')].map((li) => li.textContent)).toEqual(['角色插畫第二批 11/15', "Yaya's Band 芽芽樂團 10/14", '繪本印前檢查 11/20']);
    fireEvent.click(screen.getByRole('button', { name: '全部收折' }));
    expect(container.querySelector('.lane.wk article.cd ul.tl')).toBeNull();
  });

  it('與甘特共用篩選與隱藏：隱藏 p3、篩選「暫緩」', () => {
    const { container } = card({ settings: { timelineView: 'card', hiddenProjects: ['p3'] } });
    expect(container.querySelectorAll('article.cd, .lane .cm')).toHaveLength(9);
    expect(container.textContent).not.toContain('虎姑婆和他的朋友');
    fireEvent.click(screen.getByRole('button', { name: /^篩選/ }));
    fireEvent.click(within(within(screen.getByRole('dialog')).getByRole('group', { name: '專案狀態' })).getByRole('button', { name: '暫緩' }));
    expect(container.querySelectorAll('article.cd, .lane .cm')).toHaveLength(1);
    expect(container.querySelector('.lane.lt .lempty')).toBeNull();
    expect(txt(container.querySelector('.lane.wk .lempty'))).toBe('這段時間沒有專案');
  });

  it('狀況統計與標出在卡片視圖也有效（其他卡片變淡）', () => {
    const { container } = card();
    fireEvent.click(screen.getByRole('button', { name: /^暫緩中/ }));
    expect(container.querySelectorAll('article.cd:not(.dim)')).toHaveLength(1);
  });
});

describe('Timeline：其他', () => {
  it('雲朵關閉：不畫雲、頁面沒有 svg 雲；仍有文字資訊', () => {
    const { container } = setup({ level: 'off' });
    expect(container.querySelectorAll('.cl')).toHaveLength(0);
    expect(txt(pjRows(container)[0])).toContain('逾期 12 天');
  });

  it('腳註：不顯示已封存 1 個、已隱藏 N 個', () => {
    const { container } = setup({ settings: { hiddenProjects: ['p3'] } });
    expect(container.querySelector('.tlfoot').textContent).toContain('不顯示：已封存 1 個、已隱藏 1 個');
  });

  it('圖例：怎麼讀一條＋5 種專案狀況', () => {
    const { container } = setup();
    expect(container.querySelector('.lgd')).not.toBeNull();
    expect(container.querySelector('.lgd h3').textContent).toBe('怎麼讀一條');
  });

  it('所有最小字級在 CSS 檢查（v2Css.test）；此處確認操作不呼叫 server action', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
    fireEvent.click(screen.getByRole('button', { name: /^有逾期/ }));
    expect(boom).not.toHaveBeenCalled();
  });
});
