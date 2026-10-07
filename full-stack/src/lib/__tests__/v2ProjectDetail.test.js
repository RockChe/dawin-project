import { describe, it, expect } from 'vitest';
import {
  TASK_VIEW_DEFAULT, TASK_SORT_FIELDS, resolveTaskView, isDefaultView, withManualSort, toggleIn,
  sortTasks, filterTasks, visibleSubs, ownerOptions, allSubsDone, ownerChips, detailStats,
} from '@/lib/v2ProjectDetail';

const T = (id, o = {}) => ({ id, status: '進行中', priority: '中', owner: '', watchers: '', start: '2026/09/01', end: '2026/09/30', sortOrder: 0, ...o });
const S = (id, taskId, o = {}) => ({ id, taskId, done: false, owner: '', sortOrder: 0, ...o });

describe('resolveTaskView：個人設定 projectTaskView 補預設', () => {
  it('沒存／壞值 → 預設（開始日升冪、全不篩、不隱藏子任務）', () => {
    expect(resolveTaskView(undefined)).toEqual(TASK_VIEW_DEFAULT);
    expect(resolveTaskView('x')).toEqual(TASK_VIEW_DEFAULT);
    expect(resolveTaskView({ status: 'oops', owner: null })).toEqual(TASK_VIEW_DEFAULT);
  });
  it('部分欄位覆蓋；sort 只給 dir 也會補 field；不認得的欄位退回預設', () => {
    expect(resolveTaskView({ status: ['待辦'], hideDoneSubs: true }).status).toEqual(['待辦']);
    expect(resolveTaskView({ hideDoneSubs: true }).hideDoneSubs).toBe(true);
    expect(resolveTaskView({ sort: { dir: 'desc' } }).sort).toEqual({ field: 'start', dir: 'desc' });
    expect(resolveTaskView({ sort: { field: 'zzz', dir: 'asc' } }).sort.field).toBe('start');
  });
  it('不改到共用的預設物件', () => {
    const v = resolveTaskView({ status: ['待辦'] });
    v.status.push('x');
    expect(TASK_VIEW_DEFAULT.status).toEqual([]);
  });
  it('排序欄位選單：開始日／截止日／狀態／負責人／緊急度／手動', () => {
    expect(TASK_SORT_FIELDS.map(([, l]) => l)).toEqual(['開始日', '截止日', '狀態', '負責人', '緊急度', '手動']);
  });
});

describe('isDefaultView／withManualSort／toggleIn', () => {
  it('任何篩選、隱藏子任務或排序變動都不是預設', () => {
    expect(isDefaultView(TASK_VIEW_DEFAULT)).toBe(true);
    expect(isDefaultView({ ...TASK_VIEW_DEFAULT, status: ['待辦'] })).toBe(false);
    expect(isDefaultView({ ...TASK_VIEW_DEFAULT, hideDoneSubs: true })).toBe(false);
    expect(isDefaultView({ ...TASK_VIEW_DEFAULT, sort: { field: 'end', dir: 'asc' } })).toBe(false);
    expect(isDefaultView({ ...TASK_VIEW_DEFAULT, sort: { field: 'start', dir: 'desc' } })).toBe(false);
  });
  it('withManualSort：已是手動回同一個物件；否則切成手動 asc', () => {
    const m = { ...TASK_VIEW_DEFAULT, sort: { field: 'manual', dir: 'asc' } };
    expect(withManualSort(m)).toBe(m);
    expect(withManualSort({ ...TASK_VIEW_DEFAULT, status: ['待辦'] })).toEqual({ ...TASK_VIEW_DEFAULT, status: ['待辦'], sort: { field: 'manual', dir: 'asc' } });
  });
  it('toggleIn：有就移除、沒有就加；不改原陣列', () => {
    const a = ['a'];
    expect(toggleIn(a, 'b')).toEqual(['a', 'b']);
    expect(toggleIn(a, 'a')).toEqual([]);
    expect(a).toEqual(['a']);
  });
});

describe('sortTasks', () => {
  const ts = [T('a', { start: '2026/09/10', end: '2026/10/01', status: '待辦', priority: '低', owner: 'Rae', sortOrder: 2 }),
    T('b', { start: '2026/09/01', end: '2026/11/01', status: '已完成', priority: '高', owner: 'Karen', sortOrder: 0 }),
    T('c', { start: '2026/09/05', end: '2026/10/15', status: '進行中', priority: '中', owner: '', sortOrder: 1 })];
  const ids = (l) => l.map((t) => t.id);
  it('開始日／截止日升降冪', () => {
    expect(ids(sortTasks(ts, { field: 'start', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
    expect(ids(sortTasks(ts, { field: 'start', dir: 'desc' }))).toEqual(['a', 'c', 'b']);
    expect(ids(sortTasks(ts, { field: 'end', dir: 'asc' }))).toEqual(['a', 'c', 'b']);
  });
  it('狀態依 STATUSES 順序；緊急度高→中→低', () => {
    expect(ids(sortTasks(ts, { field: 'status', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
    expect(ids(sortTasks(ts, { field: 'priority', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
  });
  it('負責人：沒有負責人的一律排最後，不隨 dir 翻面', () => {
    expect(ids(sortTasks(ts, { field: 'owner', dir: 'asc' }))).toEqual(['b', 'a', 'c']);
    expect(ids(sortTasks(ts, { field: 'owner', dir: 'desc' }))).toEqual(['a', 'b', 'c']);
  });
  it('手動＝sortOrder，沒有反向', () => {
    expect(ids(sortTasks(ts, { field: 'manual', dir: 'desc' }))).toEqual(['b', 'c', 'a']);
  });
  it('同值維持輸入順序（穩定）；缺日期排最後；不改原陣列', () => {
    const x = [T('p', { start: null }), T('q', { start: '2026/09/01' }), T('r', { start: '2026/09/01' })];
    expect(ids(sortTasks(x, { field: 'start', dir: 'asc' }))).toEqual(['q', 'r', 'p']);
    expect(ids(ts)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterTasks：欄位內 OR、欄位間 AND；[] 不篩', () => {
  const ts = [T('a', { status: '待辦', priority: '低', owner: 'Rae,Karen' }), T('b', { status: '進行中', priority: '高', owner: 'Karen' }), T('c', { status: '待辦', priority: '高', owner: '' })];
  const ids = (v) => filterTasks(ts, { ...TASK_VIEW_DEFAULT, ...v }).map((t) => t.id);
  it('不篩全留', () => expect(ids({})).toEqual(['a', 'b', 'c']));
  it('狀態多選 OR', () => { expect(ids({ status: ['待辦'] })).toEqual(['a', 'c']); expect(ids({ status: ['待辦', '進行中'] })).toEqual(['a', 'b', 'c']); });
  it('緊急度', () => expect(ids({ priority: ['高'] })).toEqual(['b', 'c']));
  it('負責人：整個名字相符（含執行人∪關注人的逗號清單）', () => { expect(ids({ owner: ['Karen'] })).toEqual(['a', 'b']); expect(ids({ owner: ['Kar'] })).toEqual([]); });
  it('欄位間 AND', () => expect(ids({ status: ['待辦'], priority: ['高'] })).toEqual(['c']));
});

describe('visibleSubs：隱藏已完成只影響列表', () => {
  const subs = [S('s2', 't', { done: true, sortOrder: 1 }), S('s1', 't', { sortOrder: 0 }), S('s3', 't', { done: true, sortOrder: 2 })];
  it('依 sortOrder 排；hide=false 全留、true 只留未完成', () => {
    expect(visibleSubs(subs, false).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(visibleSubs(subs, true).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('ownerOptions／allSubsDone／ownerChips／detailStats', () => {
  it('ownerOptions：所有任務負責人去重、保留出現順序', () => {
    expect(ownerOptions([T('a', { owner: 'Rae,Karen' }), T('b', { owner: 'Karen,Oliver' }), T('c', { owner: '—' })])).toEqual(['Rae', 'Karen', 'Oliver']);
  });
  it('allSubsDone：有子任務、全勾、且任務還沒完成才為 true', () => {
    const subs = [S('a', 't1', { done: true }), S('b', 't1', { done: true })];
    expect(allSubsDone(T('t1'), subs)).toBe(true);
    expect(allSubsDone(T('t1', { status: '已完成' }), subs)).toBe(false);
    expect(allSubsDone(T('t1'), [...subs, S('c', 't1')])).toBe(false);
    expect(allSubsDone(T('t1'), [])).toBe(false);
  });
  it('ownerChips：執行人（子任務聯集）在前；只關注沒執行的人標「關注」', () => {
    const task = T('t1', { owner: 'Rae,Rock', watchers: 'Rock' });
    const subs = [S('a', 't1', { owner: 'Rae' })];
    expect(ownerChips(task, subs)).toEqual({ names: ['Rae', 'Rock'], watchOnly: ['Rock'] });
  });
  it('ownerChips：關注人同時做子任務 → 當執行人，不標關注', () => {
    const task = T('t1', { owner: 'Rae', watchers: 'Rae' });
    expect(ownerChips(task, [S('a', 't1', { owner: 'Rae' })]).watchOnly).toEqual([]);
  });
  it('ownerChips：沒有任何人 → names 空', () => {
    expect(ownerChips(T('t1'), [])).toEqual({ names: [], watchOnly: [] });
  });
  it('detailStats：tasks／subtasks／done 與狀態件數（依 STATUSES 順序、只列有件數的）', () => {
    const tasks = [T('a', { status: '進行中' }), T('b', { status: '已完成' }), T('c', { status: '進行中' })];
    const subs = [S('1', 'a', { done: true }), S('2', 'a'), S('3', 'b', { done: true }), S('4', 'zzz', { done: true })];
    expect(detailStats(tasks, subs)).toEqual({ n: 3, subs: 3, done: 2, counts: [['已完成', 1], ['進行中', 2]] });
  });
});
