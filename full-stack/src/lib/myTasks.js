import { pD } from "@/lib/utils";
import { taskRole } from "@/lib/taskOwner";
import { matchesStatusFilter } from "@/lib/statusFilter";

const SOON_DAYS = 7;

/** owner 是逗號分隔字串；與 name 完全相等的 token 才算「我的」。 */
export function isMine(task, name) {
  if (!name) return false;
  return (task.owner || "").split(",").map(o => o.trim()).includes(name);
}

/**
 * 我在這個任務的身分徽章：'watcher'（我關注）／'executor'（我執行，經由子任務）／null（單純任務 owner）。
 * twp 列帶 `subOwner`（子任務負責人聯集字串，useTaskManager 算好）與 `watchers`。
 */
export const myRole = (task, name) => taskRole(task, [{ owner: task.subOwner }], name);

const ROLE_BADGE = { watcher: "我關注", executor: "我執行" };
/** 身分徽章文字（桌機 MyTasksTab 與手機 MyTasksScreen 共用）：「我關注」／「我執行」／null。 */
export const roleBadge = (task, name) => ROLE_BADGE[myRole(task, name)] ?? null;

/** end 距 today（皆為 YYYY-MM-DD / YYYY/MM/DD 日期字串）幾個日曆天；無 end → null。 */
export function daysLeft(end, today) {
  if (!end) return null;
  return Math.round((pD(end) - pD(today)) / 864e5);
}

const NO_DATE = 8.64e15; // 無 end 排最後（用有限值避免 Infinity - Infinity = NaN）
const byDue = (a, b) => (a.end ? pD(a.end) : NO_DATE) - (b.end ? pD(b.end) : NO_DATE);
const byDoneDesc = (a, b) => (b.end ? pD(b.end) : -NO_DATE) - (a.end ? pD(a.end) : -NO_DATE); // 新到舊，無 end 最後

/**
 * 我的任務，依到期日分三組（無 end 歸「之後」）。
 * statuses：狀態多選（[] = 不篩，語意同 statusFilter.matchesStatusFilter）。
 * 已完成預設不進三組；只有 statuses 含「已完成」時才多回傳 `done`（依 end 由新到舊，無 end 排最後）。
 */
export function groupMyTasks(tasks, name, today, statuses = []) {
  const g = { overdue: [], soon: [], later: [] };
  const wantDone = statuses.includes("已完成");
  if (wantDone) g.done = [];
  for (const t of tasks) {
    if (!isMine(t, name) || !matchesStatusFilter(t.status, statuses)) continue;
    if (t.status === "已完成") { if (wantDone) g.done.push(t); continue; }
    const d = daysLeft(t.end, today);
    (d === null ? g.later : d < 0 ? g.overdue : d <= SOON_DAYS ? g.soon : g.later).push(t);
  }
  for (const k in g) g[k].sort(k === "done" ? byDoneDesc : byDue);
  return g;
}

/** KPI：逾期 / 7 天內 / 進行中 / 本月已完成（已完成任務以 end 落在 today 同月計）。 */
export function myTaskKpis(tasks, name, today) {
  const g = groupMyTasks(tasks, name, today);
  const mine = tasks.filter(t => isMine(t, name));
  const month = today.replace(/\//g, "-").slice(0, 7);
  return {
    overdue: g.overdue.length,
    soon: g.soon.length,
    inProgress: mine.filter(t => t.status === "進行中").length,
    doneThisMonth: mine.filter(t => t.status === "已完成" && (t.end || "").replace(/\//g, "-").slice(0, 7) === month).length,
  };
}
