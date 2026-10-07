// /v2 Data 表格的純函式：篩選、排序、分頁、鍵盤格移動。無 React 依賴。
// 資料列＝twp（buildTwp 輸出，已帶 project／progress／start／end）。
import { STATUSES } from "@/lib/constants";
import { matchesStatusFilter } from "@/lib/statusFilter";
import { filterBySearch } from "@/lib/v2Search";
import { getEditableCols } from "@/lib/tableColumns";

export const TABLE_COLS = [["project", "Project"], ["task", "Task"], ["owner", "Owner"], ["status", "Status"], ["priority", "Pri"], ["progress", "Progress"], ["category", "Category"], ["start", "Start"], ["end", "End"], ["notes", "Notes"], ["creatorName", "Creator"]];
export const PAGE_SIZES = [30, 50, 100];

/** 跨專案篩選（狀態多選聯集／優先度／專案 id）＋頁首搜尋。沒有任何條件就回傳原陣列。 */
export function filterRows(rows, { statuses = [], priority = "全部", projectIds = [] } = {}, q = "") {
  const any = statuses.length || priority !== "全部" || projectIds.length;
  const base = any ? rows.filter((t) => matchesStatusFilter(t.status, statuses) && (priority === "全部" || t.priority === priority) && (!projectIds.length || projectIds.includes(t.projectId))) : rows;
  return filterBySearch(base, q);
}

const PRI = { "高": 0, "中": 1, "低": 2 };
const DATE_COLS = new Set(["start", "end"]);
/** 排序（穩定；不改輸入）。沒有日期的永遠排最後。projects：專案「手動順序」用。 */
export function sortRows(rows, col, dir = "asc", projects = []) {
  if (!col) return rows;
  const sign = dir === "desc" ? -1 : 1;
  const pIdx = new Map(projects.map((p, i) => [p.id, i]));
  const key = (t) => {
    if (col === "status") return STATUSES.indexOf(t.status);
    if (col === "priority") return PRI[t.priority] ?? 9;
    if (col === "project") return pIdx.get(t.projectId) ?? 999;
    if (col === "progress") return t.progress || 0;
    if (DATE_COLS.has(col)) return t[col] || "";
    return String(t[col] ?? "").toLowerCase();
  };
  return rows.map((t, i) => [t, i, key(t)]).sort(([, ai, a], [, bi, b]) => {
    if (DATE_COLS.has(col)) { if (!a && !b) return ai - bi; if (!a) return 1; if (!b) return -1; }
    return (a < b ? -sign : a > b ? sign : 0) || ai - bi;
  }).map((x) => x[0]);
}

/** 分頁：每頁最多 100（壞值退回 30）、頁碼夾在 1..總頁數。 */
export function paginate(rows, page, size) {
  const per = Math.min(PAGE_SIZES.includes(+size) ? +size : (+size > 100 ? 100 : 30), 100);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const p = Math.min(Math.max(1, +page || 1), pages);
  return { view: rows.slice((p - 1) * per, p * per), page: p, pages, total: rows.length };
}

/** 一頁的任務列，展開的任務後面接它的子任務列。 */
export function flattenRows(pageRows, expanded, subsByTask) {
  const out = [];
  for (const t of pageRows) {
    out.push({ type: "task", id: t.id, data: t });
    if (expanded.has(t.id)) for (const s of subsByTask[t.id] || []) out.push({ type: "sub", id: s.id, data: s });
  }
  return out;
}

// 欄位在畫面上的橫向位置，上下移動跨類型列（任務列↔子任務列）時用來找最接近的欄。
const COL_POS = { project: 0, task: 1, name: 1, owner: 2, status: 3, priority: 4, category: 6, start: 7, end: 8, notes: 9 };
const nearest = (cols, colKey) => { const p = COL_POS[colKey] || 0; return cols.reduce((b, c) => (Math.abs(COL_POS[c] - p) < Math.abs(COL_POS[b] - p) ? c : b)); };

/** 鍵盤格移動：回傳新的 { rowId, colKey }；到邊界或找不到就原地不動。 */
export function moveCell(flat, cell, dir) {
  const { rowId, colKey } = cell;
  const ri = flat.findIndex((r) => r.id === rowId);
  if (ri === -1) return cell;
  const cols = getEditableCols(flat[ri].type), ci = cols.indexOf(colKey);
  const at = (i, k) => ({ rowId: flat[i].id, colKey: k });
  if (dir === "up") return ri > 0 ? at(ri - 1, nearest(getEditableCols(flat[ri - 1].type), colKey)) : cell;
  if (dir === "down") return ri < flat.length - 1 ? at(ri + 1, nearest(getEditableCols(flat[ri + 1].type), colKey)) : cell;
  if (dir === "left") {
    if (ci > 0) return at(ri, cols[ci - 1]);
    if (ri > 0) { const pc = getEditableCols(flat[ri - 1].type); return at(ri - 1, pc[pc.length - 1]); }
    return cell;
  }
  if (dir === "right") {
    if (ci < cols.length - 1) return at(ri, cols[ci + 1]);
    if (ri < flat.length - 1) return at(ri + 1, getEditableCols(flat[ri + 1].type)[0]);
  }
  return cell;
}
