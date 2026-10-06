import { describe, it, expect } from 'vitest';
import { upcomingDeadlines, statusCounts, projectSummaries, filterProjectTasks, visibleSubs, projectBars } from '../mobileData';

const T = (id, o = {}) => ({ id, task: `task-${id}`, project: 'P', owner: 'Amy', status: '進行中', end: '2026-10-10', ...o });
const today = '2026-10-06';

describe('upcomingDeadlines', () => {
  it('已完成、end 為 null、已過期、超出天數都不入列', () => {
    const r = upcomingDeadlines([
      T('done', { status: '已完成' }), T('nul', { end: null }), T('past', { end: '2026-10-05' }),
      T('far', { end: '2026-12-01' }), T('ok'),
    ], today);
    expect(r.map(x => x.id)).toEqual(['ok']);
  });
  it('今天到期與剛好第 days 天都算；依 end 升冪；回傳欄位與 daysLeft', () => {
    const r = upcomingDeadlines([T('b', { end: '2026/11/05' }), T('a', { end: '2026-10-06' }), T('c', { end: '2026-10-20' })], today, 30);
    expect(r.map(x => x.id)).toEqual(['a', 'c', 'b']);
    expect(r[0]).toEqual({ id: 'a', task: 'task-a', project: 'P', owner: 'Amy', end: '2026-10-06', daysLeft: 0 });
    expect(r[1].daysLeft).toBe(14);
  });
  it('limit 截斷、days 參數生效', () => {
    const ts = [T('1', { end: '2026-10-07' }), T('2', { end: '2026-10-08' }), T('3', { end: '2026-10-09' })];
    expect(upcomingDeadlines(ts, today, 30, 2).map(x => x.id)).toEqual(['1', '2']);
    expect(upcomingDeadlines(ts, today, 2).map(x => x.id)).toEqual(['1', '2']);
  });
});

describe('statusCounts', () => {
  it('依狀態計數', () => {
    expect(statusCounts([T('1'), T('2'), T('3', { status: '待辦' })])).toEqual({ 進行中: 2, 待辦: 1 });
    expect(statusCounts([])).toEqual({});
  });
});

describe('projectSummaries', () => {
  const projects = [{ id: 'p2', name: 'B' }, { id: 'p1', name: 'A' }, { id: 'p3', name: 'C' }];
  const tasks = [
    T('1', { projectId: 'p1', progress: 50, end: '2026-12-20' }),
    T('2', { projectId: 'p1', progress: 25, end: '2027/01/05' }),
    T('3', { projectId: 'p2', progress: 100, end: null }),
  ];
  it('依 projects 既有順序；筆數、平均進度（四捨五入）、最晚 end', () => {
    expect(projectSummaries(projects, tasks)).toEqual([
      { id: 'p2', name: 'B', taskCount: 1, avgProgress: 100, endDate: null },
      { id: 'p1', name: 'A', taskCount: 2, avgProgress: 38, endDate: '2027/01/05' },
      { id: 'p3', name: 'C', taskCount: 0, avgProgress: 0, endDate: null },
    ]);
  });
});

describe('封存專案（archivedAt）不出現在手機清單／時程', () => {
  const projects = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B', archivedAt: '2026-10-01T00:00:00.000Z' }];
  const tasks = [
    T('1', { projectId: 'p1', progress: 50, start: '2026-01-01', end: '2026-02-01' }),
    T('2', { projectId: 'p2', progress: 50, start: '2026-01-01', end: '2026-02-01' }),
  ];
  it('projectSummaries 略過已封存專案', () => {
    expect(projectSummaries(projects, tasks).map(p => p.id)).toEqual(['p1']);
  });
  it('projectBars 略過已封存專案', () => {
    expect(projectBars(projects, tasks, '2026-01-15').rows.map(r => r.id)).toEqual(['p1']);
  });
});

describe('filterProjectTasks', () => {
  const ts = [T('1'), T('2', { status: '待辦' }), T('3', { status: '已完成' })];
  it('空狀態 = 不篩；多選取聯集；不改動輸入', () => {
    expect(filterProjectTasks(ts, { status: [] })).toHaveLength(3);
    expect(filterProjectTasks(ts, {})).toHaveLength(3);
    expect(filterProjectTasks(ts, { status: ['進行中', '待辦'] }).map(t => t.id)).toEqual(['1', '2']);
    expect(ts).toHaveLength(3);
  });
});

describe('visibleSubs', () => {
  const subs = [{ id: 'a', done: true }, { id: 'b', done: false }];
  it('hideDone 只濾掉已完成子任務', () => {
    expect(visibleSubs(subs, false)).toEqual(subs);
    expect(visibleSubs(subs, true).map(s => s.id)).toEqual(['b']);
  });
});

describe('projectBars', () => {
  const projects = [{ id: 'p2', name: 'B' }, { id: 'p1', name: 'A' }, { id: 'p3', name: 'C' }];
  const tasks = [
    T('1', { projectId: 'p1', start: '2026-01-01', end: '2026-01-04', progress: 100 }),
    T('2', { projectId: 'p1', start: '2026-01-05', end: '2026/01/10', progress: 0 }),
    T('3', { projectId: 'p2', start: '2026-01-06', end: '2026-01-20', progress: 40 }),
    T('4', { projectId: 'p3', start: null, end: null, progress: 90 }),
  ];
  it('範圍取全部專案、百分比相對總範圍、順序同 projects、無日期專案略過', () => {
    const r = projectBars(projects, tasks, '2026-01-11');
    expect(r.rangeStart).toBe('2026-01-01');
    expect(r.rangeEnd).toBe('2026-01-20');
    expect(r.todayPct).toBe(50);
    expect(r.rows).toEqual([
      { id: 'p2', name: 'B', leftPct: 25, widthPct: 75, progressPct: 40 },
      { id: 'p1', name: 'A', leftPct: 0, widthPct: 50, progressPct: 50 },
    ]);
  });
  it('todayPct 夾在 0–100', () => {
    expect(projectBars(projects, tasks, '2025-06-01').todayPct).toBe(0);
    expect(projectBars(projects, tasks, '2027-06-01').todayPct).toBe(100);
  });
  it('完全沒有日期 → 空 rows', () => {
    expect(projectBars(projects, [tasks[3]], '2026-01-11')).toEqual({ rangeStart: null, rangeEnd: null, todayPct: null, rows: [] });
  });
});
