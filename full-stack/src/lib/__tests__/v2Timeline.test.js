import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  timelineProjects, taskModel, visibleTaskRows, flattenRows, laneInfo, groupLanes, ownerInitials,
  resolveCollapsed, trackPx, centerScroll, TL_SORTS,
} from '@/lib/v2Timeline';
import { buildTwp } from '@/lib/v2Data';
import { timeAxis } from '@/lib/v2Axis';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

afterEach(() => vi.useRealTimers());

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const run = (o) => timelineProjects(twp, FIXTURE_PROJECTS, FIXTURE_TODAY, o);
const names = (r) => r.list.map((m) => m.name);

describe('timelineProjects：哪些專案、什麼順序（甘特與卡片共用）', () => {
  it('已封存專案不出現（10 個）；順序＝手動（sortOrder）', () => {
    const r = run();
    expect(r.list).toHaveLength(10);
    expect(names(r)).not.toContain('臨時動議');
    expect(names(r)[0]).toBe('TTXC 虎姑婆 駁二');
    expect(names(r)[9]).toBe('2027新年禮盒');
    expect(r.all).toHaveLength(10);
  });

  it('個人隱藏（眼睛，存 project.id）也不出現；all 同步縮小', () => {
    const r = run({ hidden: ['p3', 'p5'] });
    expect(names(r)).not.toContain('虎姑婆和他的朋友');
    expect(names(r)).not.toContain('兒少內容有限合夥');
    expect(r.list).toHaveLength(8);
    expect(r.all).toHaveLength(8);
  });

  it('沒有日期的專案不畫（無任務、任務無日期）', () => {
    const noDate = twp.map((t) => (t.projectId === 'p9' ? { ...t, start: null, end: null } : t));
    const r = timelineProjects(noDate, FIXTURE_PROJECTS, FIXTURE_TODAY);
    expect(names(r)).not.toContain('大雲Youtube Channel');
  });

  it('排序：名稱／進度（高到低）／到期日；手動＝sortOrder；不改輸入', () => {
    expect(names(run({ sort: 'name' }))).toEqual([...names(run({ sort: 'name' }))].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
    const prog = run({ sort: 'progress' }).list.map((m) => m.prog);
    expect(prog).toEqual([...prog].sort((a, b) => b - a));
    const due = run({ sort: 'due' }).list.map((m) => m.e);
    expect(due).toEqual([...due].sort());
    expect(TL_SORTS.map((x) => x[0])).toEqual(['manual', 'name', 'progress', 'due']);
    const shuffled = [...FIXTURE_PROJECTS].reverse().map((p, i) => ({ ...p, sortOrder: FIXTURE_PROJECTS.length - i }));
    const r = timelineProjects(twp, shuffled, FIXTURE_TODAY, { sort: 'manual' });
    expect(r.list[0].name).toBe('TTXC 虎姑婆 駁二');
  });

  it('專案層篩選：專案 id、專案狀態、風險（有逾期／落後）；all 不受篩選影響', () => {
    expect(names(run({ fp: ['p1', 'p2'] }))).toEqual(['TTXC 虎姑婆 駁二', '科教館公益展廳']);
    expect(names(run({ fst: ['暫緩'] }))).toEqual(['2027新年禮盒']);
    expect(names(run({ fst: ['提案中', '待確認'] }))).toEqual(['27年衛武營', 'Design Ah 展覽']);
    expect(names(run({ frisk: ['逾期'] }))).toEqual(['TTXC 虎姑婆 駁二', '科教館公益展廳', '發行事務']);
    // 落後：gap<=-5 且非暫緩／提案（p2 同時逾期也算）
    expect(names(run({ frisk: ['落後'] }))).toEqual(['科教館公益展廳', '虎姑婆和他的朋友', '非非和他的小本子']);
    expect(run({ fp: ['p1'] }).all).toHaveLength(10);
  });

  it('專案模型欄位：狀況、狀態、里程碑素材、成員、任務列（任務自己的日期）', () => {
    const m = run().list[0];
    expect(m).toMatchObject({ kind: 'p', id: 'p1', projectId: 'p1', state: 'over', key: 'over', cloud: 'dark', od: 1, odDays: 12, status: '進行中', color: 'accent', n: 8, s: '2026/08/15', e: '2026/11/30' });
    expect(m.odName).toBe('票務展務相關');
    expect(m.odEnd).toBe('2026/09/25');
    expect(m.owners).toEqual(expect.arrayContaining(['Rock', 'Karen', 'Oliver', '幸真']));
    expect(m.taskRows).toHaveLength(8);
    expect(m.taskRows[0]).toMatchObject({ kind: 't', name: '商品合作', s: '2026/08/15', e: '2026/10/09' }); // 依開始日排序
    const by = (n) => run().list.find((x) => x.name === n);
    expect(by('27年衛武營').status).toBe('待確認');
    expect(by('Design Ah 展覽').status).toBe('提案中');
    expect(by('2027新年禮盒').status).toBe('暫緩');
  });
});

describe('taskModel：任務列自己的日期與狀態', () => {
  const t = (id) => twp.find((x) => x.id === id);
  it('逾期（未完成且到期日 < 今天）：state=over、odDays', () => {
    expect(taskModel(t('t1'), FIXTURE_TODAY, 'accent')).toMatchObject({ kind: 't', od: true, odDays: 12, state: 'over', s: '2026/08/20', e: '2026/09/25', prog: 60, color: 'accent', name: '票務展務相關' });
  });
  it('已完成 gap=0、不逾期；暫緩=hold、提案／待確認=prop', () => {
    expect(taskModel(t('t6'), FIXTURE_TODAY, 'accent')).toMatchObject({ done: true, od: false, gap: 0, gapInfo: { kind: 'done' } });
    expect(taskModel(t('t8'), FIXTURE_TODAY, 'accent').state).toBe('hold');
    expect(taskModel(t('t22'), FIXTURE_TODAY, 'accent').state).toBe('prop');
    expect(taskModel(t('t5'), FIXTURE_TODAY, 'accent').state).toBe('prop');
  });
  it('落後任務：gapInfo 有「落後約 N 天」', () => {
    const m = taskModel(t('t2'), FIXTURE_TODAY, 'accent'); // 08/15→10/09，進度 50%
    expect(m.gapInfo.kind).toBe('behind');
    expect(m.gapInfo.text).toMatch(/^落後約 \d+ 天$/);
  });
  it('沒有日期的任務：s／e 為 null、不丟錯', () => {
    const m = taskModel({ ...t('t1'), start: null, end: null }, FIXTURE_TODAY, 'accent');
    expect(m.s).toBeNull();
    expect(m.od).toBe(false);
  });
});

describe('展開的任務列', () => {
  const m = run().list[0];
  it('任務狀態／優先度篩選只影響展開後的任務列', () => {
    expect(visibleTaskRows(m, { fs: [], fpr: '全部' })).toHaveLength(8);
    expect(visibleTaskRows(m, { fs: ['已完成'], fpr: '全部' }).map((t) => t.name)).toEqual(['虎姑婆周邊打樣確認', '新聞稿發送']);
    expect(visibleTaskRows(m, { fs: [], fpr: '低' }).map((t) => t.name)).toEqual(['新聞稿發送', '兒童工作坊加場']);
  });
  it('flattenRows：收折的專案只有專案列；展開的專案後面接它的任務列', () => {
    const list = run().list.slice(0, 2);
    const rows = flattenRows(list, ['p1'], { fs: [], fpr: '全部' }); // p1 收折、p2 展開
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual(['p:p1', 'p:p2', 't:t10', 't:t9', 't:t11']);
  });
});

describe('卡片視圖分組（這週／本月／下月／之後＋已逾期）', () => {
  it('依下一個里程碑分組；與設計稿 9 個專案的分法一致', () => {
    const g = groupLanes(run().list, FIXTURE_TODAY);
    const by = Object.fromEntries(g.map((x) => [x.key, x.items.map((i) => i.name)]));
    expect(g.map((x) => x.key)).toEqual(['over', 'wk', 'mo', 'nx', 'lt']);
    expect(by.over).toEqual(['TTXC 虎姑婆 駁二', '發行事務', '科教館公益展廳']); // 最早逾期者在前
    expect(by.wk).toEqual(['虎姑婆和他的朋友']);
    expect(by.mo).toEqual(['非非和他的小本子', '兒少內容有限合夥', '27年衛武營']);
    expect(by.nx).toEqual(['大雲Youtube Channel', 'Design Ah 展覽']);
    expect(by.lt).toEqual(['2027新年禮盒']);
  });
  it('分組標題的日期說明', () => {
    expect(laneInfo(FIXTURE_TODAY).map((l) => [l.key, l.label, l.cloud, l.sub])).toEqual([
      ['over', '已逾期', 'dark', '專案內有任務已過期'],
      ['wk', '這週', 'pink', '10/7 – 10/14（7 天內）'],
      ['mo', '本月', 'white', '10/15 – 10/31'],
      ['nx', '下月', 'white', '11 月'],
      ['lt', '之後', 'purple', '12 月以後'],
    ]);
  });
  it('跨年：12 月的下月是 1 月', () => {
    const l = laneInfo('2026-12-10');
    expect(l[3].sub).toBe('1 月');
    expect(l[4].sub).toBe('2 月以後');
  });
});

describe('小工具', () => {
  it('ownerInitials：英文取前兩字、中文取第一字', () => {
    expect(ownerInitials('Felien 車')).toBe('Fe');
    expect(ownerInitials('Karen')).toBe('Ka');
    expect(ownerInitials('幸真')).toBe('幸');
  });
  it('resolveCollapsed：有存過用存的；否則預設收折＝全部專案 id；預設展開＝[]', () => {
    expect(resolveCollapsed(['p1'], true, ['p1', 'p2'])).toEqual(['p1']);
    expect(resolveCollapsed(null, true, ['p1', 'p2'])).toEqual(['p1', 'p2']);
    expect(resolveCollapsed(null, false, ['p1', 'p2'])).toEqual([]);
    expect(resolveCollapsed('壞資料', true, ['p1'])).toEqual(['p1']);
  });
  it('trackPx：軌道內寬＝單位數 × 每單位像素（沿用 ganttWidths 的 day/week/month/quarter）', () => {
    const gw = { day: 20, week: 50, month: 50, quarter: 100 };
    expect(trackPx('日', timeAxis('日', FIXTURE_TODAY), gw)).toBe(28 * 20);
    expect(trackPx('週', timeAxis('週', FIXTURE_TODAY), gw)).toBe(Math.ceil(91 / 7) * 50);
    expect(trackPx('月', timeAxis('月', FIXTURE_TODAY), gw)).toBe(8 * 50);
    expect(trackPx('季', timeAxis('季', FIXTURE_TODAY), gw)).toBe(4 * 100);
  });
  it('centerScroll：把今天捲到可視軌道（扣掉左右固定欄）的中間；夾在 0～最大捲動量', () => {
    // 內容 2000 寬、視窗 1000、左欄 200、右欄 300：可視軌道＝[200,700]，中心 450
    expect(centerScroll({ todayX: 1000, clientW: 1000, leftW: 200, rightW: 300, scrollW: 2000 })).toBe(550);
    expect(centerScroll({ todayX: 100, clientW: 1000, leftW: 200, rightW: 300, scrollW: 2000 })).toBe(0);
    expect(centerScroll({ todayX: 1950, clientW: 1000, leftW: 200, rightW: 300, scrollW: 2000 })).toBe(1000);
    expect(centerScroll({ todayX: 500, clientW: 1000, leftW: 200, rightW: 300, scrollW: 1000 })).toBe(0); // 不溢出
  });
});
