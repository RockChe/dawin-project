import { describe, it, expect } from 'vitest';
import { upcomingDeadlines, statusCounts } from '../mobileData';

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
