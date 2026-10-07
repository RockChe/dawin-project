// /v2 專案詳情的純函式（任務清單的排序／篩選／子任務可見性／人員標籤）。today 不在這裡用到；不碰 server action。
// 規則與舊 ProjectsTab 的 sortProjectTasks／filterProjectTasks／visibleSubs 同語意（共用個人設定 projectTaskView），
// 在這裡獨立一份是為了讓 v2 不依賴日後會移除的舊元件。
import { STATUSES } from "./constants";
import { dayIndex } from "./dayIndex";
import { execTokens, ownerTokens, watcherTokens } from "./taskOwner";

export const PRIORITY_ORDER = ["高", "中", "低"];
/** 排序欄位下拉：[值, 文字]；預設 start＝開始日；手動＝tasks.sortOrder（拖移任務時自動切過去）。 */
export const TASK_SORT_FIELDS = [["start", "開始日"], ["end", "截止日"], ["status", "狀態"], ["owner", "負責人"], ["priority", "緊急度"], ["manual", "手動"]];
/** 一組全域設定（非每專案一組），存 user_settings 的 projectTaskView。 */
export const TASK_VIEW_DEFAULT = { sort: { field: "start", dir: "asc" }, status: [], owner: [], priority: [], hideDoneSubs: false };

const arr = (v) => (Array.isArray(v) ? v.slice() : []);

/** 已存的 projectTaskView（可能缺欄位、壞值）→ 完整可用的設定。 */
export function resolveTaskView(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const field = TASK_SORT_FIELDS.some(([k]) => k === s.sort?.field) ? s.sort.field : TASK_VIEW_DEFAULT.sort.field;
  return { sort: { field, dir: s.sort?.dir === "desc" ? "desc" : "asc" }, status: arr(s.status), owner: arr(s.owner), priority: arr(s.priority), hideDoneSubs: !!s.hideDoneSubs };
}

export const isDefaultView = (v) => !v.status.length && !v.owner.length && !v.priority.length && !v.hideDoneSubs
  && v.sort.field === TASK_VIEW_DEFAULT.sort.field && v.sort.dir === TASK_VIEW_DEFAULT.sort.dir;

/** 拖移任務＝要手動排：已是手動回同一個物件（呼叫端可據此跳過多餘的設定寫入）。 */
export const withManualSort = (v) => (v.sort.field === "manual" ? v : { ...v, sort: { field: "manual", dir: "asc" } });

export const toggleIn = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

// null＝「這筆沒有值」，一律排最後，不隨 dir 翻面。
function sortKey(t, field) {
  if (field === "status") { const i = STATUSES.indexOf(t.status); return i < 0 ? null : i; }
  if (field === "priority") { const i = PRIORITY_ORDER.indexOf(t.priority); return i < 0 ? null : i; }
  if (field === "owner") return ownerTokens(t.owner)[0] ?? null;
  if (field === "manual") return t.sortOrder || 0;
  return dayIndex(field === "end" ? t.end : t.start); // start／end（twp 的別名欄位）
}

/** 依單一欄位排序（穩定：同值維持輸入順序；回新陣列）。 */
export function sortTasks(tasks, { field = "start", dir = "asc" } = {}) {
  const sign = dir === "desc" && field !== "manual" ? -1 : 1;
  return tasks.map((t, i) => [t, i]).sort(([a, ai], [b, bi]) => {
    const ka = sortKey(a, field), kb = sortKey(b, field);
    if (ka === null || kb === null) return ka === kb ? ai - bi : ka === null ? 1 : -1;
    if (ka === kb) return ai - bi;
    return (typeof ka === "string" ? ka.localeCompare(kb) : ka - kb) * sign;
  }).map(([t]) => t);
}

/** 欄位內 OR、欄位間 AND；[] ＝ 不篩。 */
export const filterTasks = (tasks, { status = [], owner = [], priority = [] } = {}) => tasks.filter((t) =>
  (!status.length || status.includes(t.status)) && (!priority.length || priority.includes(t.priority))
  && (!owner.length || ownerTokens(t.owner).some((n) => owner.includes(n))));

/** 子任務依 sortOrder；hideDone＝只留未完成（只影響列表，進度與計數仍以全部為準）。 */
export const visibleSubs = (subs, hideDone) => [...subs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).filter((s) => !hideDone || !s.done);

export const ownerOptions = (tasks) => [...new Set(tasks.flatMap((t) => ownerTokens(t.owner)))];

/** 勾完最後一個子任務：只「提示可以改成已完成」，不自動改狀態。 */
export const allSubsDone = (task, subs) => subs.length > 0 && subs.every((s) => s.done) && task.status !== "已完成";

/** 任務的人員標籤：執行人在前、只關注（沒執行子任務）的人在後並標「關注」。 */
export function ownerChips(task, subs) {
  const exec = execTokens(task, subs);
  const watchOnly = watcherTokens(task).filter((w) => !exec.includes(w));
  return { names: [...exec, ...watchOnly], watchOnly };
}

/** 頭部與側欄統計：任務數、子任務數／已完成數、狀態件數（依 STATUSES 順序、只列有件數的）。 */
export function detailStats(tasks, subs) {
  const ids = new Set(tasks.map((t) => t.id));
  const mine = subs.filter((s) => ids.has(s.taskId));
  const c = {};
  for (const t of tasks) c[t.status] = (c[t.status] || 0) + 1;
  return { n: tasks.length, subs: mine.length, done: mine.filter((s) => s.done).length, counts: STATUSES.filter((s) => c[s]).map((s) => [s, c[s]]) };
}
