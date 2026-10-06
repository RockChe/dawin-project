import { describe, it, expect } from 'vitest';
import { isMine, daysLeft, groupMyTasks, myTaskKpis } from '@/lib/myTasks';

const T = '2026-10-06';
const mk = (id, owner, end, status = '進行中') => ({ id, owner, end, status });

describe('isMine', () => {
  it('exact token match, comma/trim split', () => {
    expect(isMine({ owner: 'Amy' }, 'Amy')).toBe(true);
    expect(isMine({ owner: 'Bob, Amy ,Cat' }, 'Amy')).toBe(true);
  });
  it('no partial match, no empty name, no owner', () => {
    expect(isMine({ owner: 'Amy Lin' }, 'Amy')).toBe(false);
    expect(isMine({ owner: 'Amy' }, '')).toBe(false);
    expect(isMine({ owner: null }, 'Amy')).toBe(false);
    expect(isMine({ owner: 'Amy' }, undefined)).toBe(false);
  });
});

describe('daysLeft', () => {
  it('counts calendar days, accepts / and - formats', () => {
    expect(daysLeft('2026-10-06', T)).toBe(0);
    expect(daysLeft('2026/10/13', T)).toBe(7);
    expect(daysLeft('2026-10-05', T)).toBe(-1);
    expect(daysLeft(null, T)).toBeNull();
  });
});

describe('groupMyTasks', () => {
  const tasks = [
    mk('a', 'Amy', '2026-10-05'),            // -1 overdue
    mk('b', 'Amy', '2026-10-06'),            // 0 due today -> soon
    mk('c', 'Amy', '2026-10-13'),            // 7 -> soon (boundary)
    mk('d', 'Amy', '2026-10-14'),            // 8 -> later (boundary)
    mk('e', 'Amy', null),                    // no end -> later
    mk('f', 'Amy', '2026-10-01', '已完成'),  // completed excluded
    mk('g', 'Bob', '2026-10-01'),            // not mine
  ];
  it('splits at the 7-day boundary and excludes completed / others', () => {
    const g = groupMyTasks(tasks, 'Amy', T);
    expect(g.overdue.map(t => t.id)).toEqual(['a']);
    expect(g.soon.map(t => t.id)).toEqual(['b', 'c']);
    expect(g.later.map(t => t.id)).toEqual(['d', 'e']);
  });
  it('sorts each group by due date ascending', () => {
    const g = groupMyTasks([mk('x', 'Amy', '2026-09-20'), mk('y', 'Amy', '2026-09-01')], 'Amy', T);
    expect(g.overdue.map(t => t.id)).toEqual(['y', 'x']);
  });
});

describe('myTaskKpis', () => {
  it('counts overdue / soon / in-progress / completed this month', () => {
    const tasks = [
      mk('a', 'Amy', '2026-10-05'),
      mk('b', 'Amy', '2026-10-10', '待辦'),
      mk('c', 'Amy', '2026-11-30'),
      mk('d', 'Amy', '2026-10-02', '已完成'),   // this month
      mk('e', 'Amy', '2026/10/20', '已完成'),   // this month, slash format
      mk('f', 'Amy', '2026-09-30', '已完成'),   // last month
      mk('g', 'Bob', '2026-10-05'),
    ];
    expect(myTaskKpis(tasks, 'Amy', T)).toEqual({ overdue: 1, soon: 1, inProgress: 2, doneThisMonth: 2 });
  });
});
