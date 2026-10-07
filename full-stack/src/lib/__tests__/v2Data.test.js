import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildTwp, projectRows, upcomingTasks, urgency, taskGap, statusCounts, donutArcs, weatherCounts, ownerClass,
} from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

afterEach(() => vi.useRealTimers());

const twp = (today = FIXTURE_TODAY) => buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, today);

describe('buildTwp（v2 版 twp：進度由傳入的 today 算，不讀系統時鐘）', () => {
  it('補上 project 名稱、start/end 別名、子任務執行人聯集（subOwner）', () => {
    const t1 = twp().find((t) => t.id === 't1');
    expect(t1.project).toBe('TTXC 虎姑婆 駁二');
    expect(t1.start).toBe('2026/08/20');
    expect(t1.end).toBe('2026/09/25');
    expect(t1.subOwner).toBe('Rock,Karen,Oliver');
    expect(t1.progress).toBe(60); // 5 個子任務完成 3 個
    expect(t1.sDone).toBe(3);
    expect(t1.sTotal).toBe(5);
    expect(t1.timeBased).toBe(false);
  });

  it('已完成 = 100；沒有子任務 = 時間進度（依 today）', () => {
    const all = twp();
    expect(all.find((t) => t.id === 't6').progress).toBe(100);
    const t3 = all.find((t) => t.id === 't3'); // 09/10 → 10/31，今天 10/07
    expect(t3.timeBased).toBe(true);
    expect(t3.progress).toBe(Math.round((27 / 51) * 100));
  });

  it('R3：換 today 進度就跟著變；系統時鐘改到 2030 結果不變', () => {
    const a = twp('2026-10-07').find((t) => t.id === 't3').progress;
    const b = twp('2026-10-20').find((t) => t.id === 't3').progress;
    expect(b).toBeGreaterThan(a);
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(twp('2026-10-07').find((t) => t.id === 't3').progress).toBe(a);
  });
});

describe('projectRows（對照設計稿 Overview 時程列）', () => {
  const rows = projectRows(twp(), FIXTURE_PROJECTS, FIXTURE_TODAY);
  const by = (n) => rows.find((r) => r.name === n);

  it('每個有任務的專案一列，依專案順序；專案色循環', () => {
    expect(rows.map((r) => r.name)).toEqual(FIXTURE_PROJECTS.map((p) => p.name));
    expect(rows[0].color).toBe('accent');
    expect(rows[1].color).toBe('purple');
    expect(rows[7].color).toBe('accent');
  });

  it('專案區間＝任務最早開始～最晚結束', () => {
    expect(by('TTXC 虎姑婆 駁二')).toMatchObject({ s: '2026/08/15', e: '2026/11/30', n: 8 });
  });

  it('進度／落後領先文字與設計稿一致', () => {
    const t = (n) => { const r = by(n); return [r.prog, r.gapInfo.text, r.gapInfo.sub ?? '']; };
    expect(t('TTXC 虎姑婆 駁二')).toEqual([54, '進度同步', '']);
    expect(t('科教館公益展廳')).toEqual([55, '落後約 22 天', '（13 點）']);
    expect(t('虎姑婆和他的朋友')).toEqual([27, '落後約 14 天', '（18 點）']);
    expect(t('發行事務')).toEqual([44, '進度同步', '']);
    expect(t('兒少內容有限合夥')).toEqual([92, '領先約 20 天', '（44 點）']);
    expect(t('非非和他的小本子')).toEqual([24, '落後約 4 天', '（10 點）']);
    expect(t('27年衛武營')).toEqual([0, '待確認', '']);
    expect(t('Design Ah 展覽')).toEqual([0, '提案中', '']);
    expect(t('大雲Youtube Channel')).toEqual([55, '領先約 36 天', '（34 點）']);
    expect(t('2027新年禮盒')).toEqual([0, '暫緩', '']);
  });

  it('逾期：件數與最久天數；狀態色 state', () => {
    expect(by('TTXC 虎姑婆 駁二')).toMatchObject({ od: 1, odDays: 12, state: 'over', key: 'over', cloud: 'dark', label: '有逾期' });
    expect(by('科教館公益展廳')).toMatchObject({ od: 1, odDays: 2, state: 'over' });
    expect(by('虎姑婆和他的朋友')).toMatchObject({ od: 0, state: 'behind', key: 'ok', cloud: 'white' });
    expect(by('兒少內容有限合夥')).toMatchObject({ od: 0, state: 'ok', key: 'ahead', cloud: 'nimbus', label: '進度領先' });
    expect(by('27年衛武營')).toMatchObject({ state: 'prop', key: 'prop', cloud: 'pink' });
    expect(by('2027新年禮盒')).toMatchObject({ state: 'hold', key: 'hold', cloud: 'purple', label: '暫緩中' });
  });

  it('已封存專案：保留在列表，state=hold、淡紫雲、已封存', () => {
    const a = by('臨時動議');
    expect(a).toMatchObject({ archived: true, state: 'hold', cloud: 'purple', prog: 100 });
    expect(a.gapInfo.text).toBe('已封存');
  });

  it('沒有任務的專案不出列', () => {
    const more = [...FIXTURE_PROJECTS, { id: 'px', name: '空專案', sortOrder: 99, archivedAt: null }];
    expect(projectRows(twp(), more, FIXTURE_TODAY).some((r) => r.name === '空專案')).toBe(false);
  });
});

describe('weatherCounts（專案狀況統計，不含封存）', () => {
  it('五種狀況加總＝非封存專案數', () => {
    const rows = projectRows(twp(), FIXTURE_PROJECTS, FIXTURE_TODAY);
    const c = weatherCounts(rows);
    expect(c).toEqual({ over: 3, ahead: 2, ok: 2, hold: 1, prop: 2 });
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(10);
  });
});

describe('upcomingTasks（即將到期）', () => {
  const all = twp();
  const ids = (o) => upcomingTasks(all, { today: FIXTURE_TODAY, days: 30, limit: 5, ...o }).list.map((t) => t.id);

  it('未來 30 天、未完成、依到期日排序、最多 5 件；total 與 soon 統計', () => {
    const r = upcomingTasks(all, { today: FIXTURE_TODAY, days: 30, limit: 5 });
    expect(r.list.map((t) => t.id)).toEqual(['t2', 't16', 't12', 't4', 't21']);
    expect(r.total).toBe(9);
    expect(r.soon).toBe(3);
  });

  it('已逾期、已完成都不算；今天到期算 0 天', () => {
    expect(ids({ limit: 99 })).not.toContain('t9');
    expect(ids({ limit: 99 })).not.toContain('t6');
    const edge = [{ id: 'x', status: '進行中', end: '2026/10/07', priority: '中', projectId: 'p1' }];
    expect(upcomingTasks(edge, { today: FIXTURE_TODAY, days: 30, limit: 5 }).list).toHaveLength(1);
  });

  it('篩選：狀態多選、優先度、專案', () => {
    expect(ids({ statuses: ['待辦'], limit: 99 })).toEqual(['t16', 't3']);
    expect(ids({ statuses: ['待辦', '待確認'], limit: 99 })).toEqual(['t16', 't3', 't23']);
    expect(ids({ priority: '高', limit: 99 })).toEqual(['t2', 't12']);
    expect(ids({ projectIds: ['p4'], limit: 99 })).toEqual(['t16']);
  });

  it('days 設定生效', () => {
    expect(ids({ days: 7, limit: 99 })).toEqual(['t2', 't16', 't12']);
  });
});

describe('urgency（急迫度雲）與 taskGap', () => {
  const T = FIXTURE_TODAY;
  it('逾期或 ≤2 天＝烏雲；3–7＝粉紅；>7＝白雲；已完成＝筋斗雲', () => {
    expect(urgency({ status: '進行中', end: '2026/10/09' }, T)).toBe('dark');
    expect(urgency({ status: '進行中', end: '2026/10/05' }, T)).toBe('dark');
    expect(urgency({ status: '待辦', end: '2026/10/10' }, T)).toBe('pink');
    expect(urgency({ status: '待辦', end: '2026/10/14' }, T)).toBe('pink');
    expect(urgency({ status: '待辦', end: '2026/10/15' }, T)).toBe('white');
    expect(urgency({ status: '已完成', end: '2026/09/01' }, T)).toBe('nimbus');
  });
  it('taskGap：落後／領先／同步／暫緩／提案', () => {
    const t = Object.fromEntries(twp().map((x) => [x.id, x]));
    expect(taskGap(t.t2, T)).toMatchObject({ kind: 'behind', text: '落後約 25 天', sub: '（46 點）' });
    expect(taskGap(t.t8, T).kind).toBe('hold');
    expect(taskGap(t.t5, T).kind).toBe('prop');
    expect(taskGap(t.t6, T).kind).toBe('done');
  });
});

describe('狀態分布', () => {
  it('statusCounts 與設計稿一致（共 33）', () => {
    expect(statusCounts(twp())).toEqual({ 已完成: 8, 進行中: 11, 待辦: 5, 暫緩: 3, 提案中: 3, 待確認: 3 });
  });
  it('donutArcs：只畫有數量的狀態，百分比四捨五入，路徑為 SVG path', () => {
    const arcs = donutArcs(statusCounts(twp()));
    expect(arcs.map((a) => [a.s, a.n, a.pct])).toEqual([['已完成', 8, 24], ['進行中', 11, 33], ['待辦', 5, 15], ['暫緩', 3, 9], ['提案中', 3, 9], ['待確認', 3, 9]]);
    expect(arcs[0].d).toMatch(/^M[-\d.]+,[-\d.]+ A90,90 0 0 1 /);
    expect(donutArcs({ 已完成: 0 })).toEqual([]);
  });
});

describe('ownerClass', () => {
  it('依名單順序循環 a–f；不在名單用 c', () => {
    expect(ownerClass('Karen', ['A', 'Karen'])).toBe('b');
    expect(ownerClass('G', ['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe('a');
    expect(ownerClass('Zed', ['A'])).toBe('c');
  });
});
