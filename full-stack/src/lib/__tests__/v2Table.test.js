import { describe, it, expect } from 'vitest';
import { filterRows, sortRows, paginate, flattenRows, moveCell, TABLE_COLS, PAGE_SIZES } from '@/lib/v2Table';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const ids = (rows) => rows.map((t) => t.id);

describe('v2Table.filterRows（跨專案篩選＋頁首搜尋）', () => {
  it('沒有條件＝全部（引用不變）', () => {
    expect(filterRows(twp, {}, '')).toBe(twp);
    expect(filterRows(twp, { statuses: [], priority: '全部', projectIds: [] }, '')).toHaveLength(33);
  });
  it('狀態多選取聯集、優先度、專案（用 projectId）', () => {
    expect(filterRows(twp, { statuses: ['已完成'] }).every((t) => t.status === '已完成')).toBe(true);
    expect(filterRows(twp, { statuses: ['暫緩', '提案中'] })).toHaveLength(twp.filter((t) => t.status === '暫緩' || t.status === '提案中').length);
    expect(filterRows(twp, { priority: '高' }).every((t) => t.priority === '高')).toBe(true);
    expect(ids(filterRows(twp, { projectIds: ['p3'] }))).toEqual(['t12', 't13', 't14']);
  });
  it('條件之間是交集，搜尋字串另外疊加（任務名／專案名／負責人／備註，不分大小寫）', () => {
    expect(ids(filterRows(twp, { projectIds: ['p1'], statuses: ['已完成'] }))).toEqual(['t6', 't7']);
    expect(ids(filterRows(twp, { projectIds: ['p1'] }, '打樣'))).toEqual(['t6']);
    expect(filterRows(twp, {}, '不存在的字')).toEqual([]);
  });
});

describe('v2Table.sortRows', () => {
  it('不給欄位＝原順序（引用不變）；不改輸入', () => {
    expect(sortRows(twp, null, 'asc')).toBe(twp);
    const before = ids(twp);
    sortRows(twp, 'task', 'asc');
    expect(ids(twp)).toEqual(before);
  });
  it('狀態依 STATUSES 順序、優先度 高>中>低、專案依手動順序、進度數字', () => {
    const st = sortRows(twp, 'status', 'asc').map((t) => t.status);
    expect(st[0]).toBe('已完成');
    expect(st[st.length - 1]).toBe('待確認');
    expect(sortRows(twp, 'priority', 'asc').map((t) => t.priority).slice(0, 3)).toEqual(['高', '高', '高']);
    expect(sortRows(twp, 'priority', 'desc')[0].priority).toBe('低');
    expect(sortRows(twp, 'project', 'asc', FIXTURE_PROJECTS)[0].projectId).toBe('p1');
    expect(sortRows(twp, 'project', 'desc', FIXTURE_PROJECTS)[0].projectId).toBe('p11');
    const pr = sortRows(twp, 'progress', 'asc').map((t) => t.progress);
    expect(pr).toEqual([...pr].sort((a, b) => a - b));
  });
  it('日期以時間先後排；沒有日期的永遠排最後（升降冪都是）；同值保持原順序', () => {
    const rows = [{ id: 'a', end: '2026-10-09' }, { id: 'b', end: null }, { id: 'c', end: '2026-10-01' }, { id: 'd', end: '2026-10-09' }];
    expect(ids(sortRows(rows, 'end', 'asc'))).toEqual(['c', 'a', 'd', 'b']);
    expect(ids(sortRows(rows, 'end', 'desc'))).toEqual(['a', 'd', 'c', 'b']);
  });
  it('文字欄不分大小寫', () => {
    const rows = [{ id: 'a', task: 'banana' }, { id: 'b', task: 'Apple' }, { id: 'c', task: 'cherry' }];
    expect(ids(sortRows(rows, 'task', 'asc'))).toEqual(['b', 'a', 'c']);
  });
});

describe('v2Table.paginate', () => {
  it('每頁 30／50／100；頁碼夾在 1..總頁數', () => {
    expect(PAGE_SIZES).toEqual([30, 50, 100]);
    const rows = Array.from({ length: 65 }, (_, i) => ({ id: i }));
    const p1 = paginate(rows, 1, 30);
    expect([p1.view.length, p1.pages, p1.total, p1.page]).toEqual([30, 3, 65, 1]);
    expect(paginate(rows, 3, 30).view).toHaveLength(5);
    expect(paginate(rows, 99, 30).page).toBe(3);
    expect(paginate(rows, 0, 30).page).toBe(1);
    expect(paginate([], 5, 30)).toMatchObject({ view: [], pages: 1, page: 1, total: 0 });
  });
  it('每頁上限 100（壞值退回 30）', () => {
    expect(paginate(Array.from({ length: 300 }, (_, i) => i), 1, 999).view).toHaveLength(100);
    expect(paginate(Array.from({ length: 300 }, (_, i) => i), 1, 'x').view).toHaveLength(30);
  });
});

describe('v2Table.flattenRows / moveCell（鍵盤格）', () => {
  const subs = { t1: [{ id: 't1s0' }, { id: 't1s1' }] };
  const flat = flattenRows([{ id: 't1' }, { id: 't2' }], new Set(['t1']), subs);
  it('展開的任務後面接子任務列', () => {
    expect(flat.map((r) => `${r.type}:${r.id}`)).toEqual(['task:t1', 'sub:t1s0', 'sub:t1s1', 'task:t2']);
    expect(flattenRows([{ id: 't1' }], new Set(), subs)).toHaveLength(1);
  });
  it('左右在同一列內移動，到邊界換到上／下一列', () => {
    expect(moveCell(flat, { rowId: 't1', colKey: 'task' }, 'right')).toEqual({ rowId: 't1', colKey: 'owner' });
    expect(moveCell(flat, { rowId: 't1', colKey: 'notes' }, 'right')).toEqual({ rowId: 't1s0', colKey: 'name' });
    expect(moveCell(flat, { rowId: 't1s0', colKey: 'name' }, 'left')).toEqual({ rowId: 't1', colKey: 'notes' });
    expect(moveCell(flat, { rowId: 't1', colKey: 'task' }, 'left')).toEqual({ rowId: 't1', colKey: 'task' }); // 最前面不動
  });
  it('上下移動時，跨類型列用最接近的欄', () => {
    expect(moveCell(flat, { rowId: 't1', colKey: 'owner' }, 'down')).toEqual({ rowId: 't1s0', colKey: 'owner' });
    expect(moveCell(flat, { rowId: 't1', colKey: 'status' }, 'down')).toEqual({ rowId: 't1s0', colKey: 'owner' }); // 子列沒有 status → 最近的 owner
    expect(moveCell(flat, { rowId: 't1s1', colKey: 'notes' }, 'down')).toEqual({ rowId: 't2', colKey: 'notes' });
    expect(moveCell(flat, { rowId: 't2', colKey: 'notes' }, 'down')).toEqual({ rowId: 't2', colKey: 'notes' }); // 最後一列不動
    expect(moveCell(flat, { rowId: 't1', colKey: 'task' }, 'up')).toEqual({ rowId: 't1', colKey: 'task' });
  });
  it('找不到目前列＝原地不動', () => {
    expect(moveCell(flat, { rowId: 'zzz', colKey: 'task' }, 'down')).toEqual({ rowId: 'zzz', colKey: 'task' });
  });
});

describe('v2Table.TABLE_COLS', () => {
  it('11 個欄位，順序同設計稿（Project…Creator）', () => {
    expect(TABLE_COLS.map(([k]) => k)).toEqual(['project', 'task', 'owner', 'status', 'priority', 'progress', 'category', 'start', 'end', 'notes', 'creatorName']);
  });
});
