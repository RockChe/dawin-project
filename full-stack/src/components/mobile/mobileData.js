// 手機版畫面用的純函式（無 React 依賴）。today 一律由呼叫端傳入，不在這裡呼叫 new Date()。
import { daysLeft } from "@/lib/myTasks";
import { pD } from "@/lib/utils";
import { matchesStatusFilter } from "@/lib/statusFilter";

/** 未完成、end 落在 [today, today+days] 的任務，依 end 升冪取前 limit 筆。規則同桌機 OverviewTab 的 Upcoming。 */
export function upcomingDeadlines(tasks, today, days = 30, limit = 5) {
  return tasks
    .filter(t => t.end && t.status !== "已完成")
    .map(t => ({ id: t.id, task: t.task, project: t.project, owner: t.owner, end: t.end, daysLeft: daysLeft(t.end, today) }))
    .filter(t => t.daysLeft >= 0 && t.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, limit);
}

/** { [status]: n }，甜甜圈用。 */
export function statusCounts(tasks) {
  const c = {};
  for (const t of tasks) c[t.status] = (c[t.status] || 0) + 1;
  return c;
}

/** 專案卡片資料：依 projects 既有順序；avgProgress = 任務 progress 平均（四捨五入）；endDate = 最晚 end（原字串）。 */
export function projectSummaries(projects, tasks) {
  return projects.map(p => {
    const mine = tasks.filter(t => t.projectId === p.id);
    const ends = mine.filter(t => t.end);
    const last = ends.reduce((a, t) => (!a || pD(t.end) > pD(a.end) ? t : a), null);
    return {
      id: p.id, name: p.name, taskCount: mine.length,
      avgProgress: mine.length ? Math.round(mine.reduce((s, t) => s + (t.progress || 0), 0) / mine.length) : 0,
      endDate: last ? last.end : null,
    };
  });
}

/** 專案詳情的任務篩選（狀態多選聯集；[] = 不篩）。「隱藏已完成子任務」只影響子任務列，見 visibleSubs。 */
export const filterProjectTasks = (tasks, { status = [] } = {}) => tasks.filter(t => matchesStatusFilter(t.status, status));

// 與桌機 ProjectsTab 的 visibleSubs 同語意；不直接 import 是為了不把整個 ProjectsTab（dnd-kit 等）帶進手機 bundle。
export const visibleSubs = (subs, hideDone) => (hideDone ? subs.filter(s => !s.done) : subs);

const dayDiff = (a, b) => Math.round((a - b) / 864e5); // round：跨 DST 的本地午夜相差不是整數天
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 簡化時程：每個專案一條橫條，百分比相對於「全部專案」的總範圍。
 * 專案 start/end = 其任務最早/最晚日期（沒有任何日期的專案略過）；progressPct = 任務 progress 平均；順序同 projects。
 */
export function projectBars(projects, tasks, today) {
  const spans = projects.map(p => {
    const mine = tasks.filter(t => t.projectId === p.id);
    const dates = mine.flatMap(t => [t.start, t.end]).filter(Boolean).map(pD);
    if (!dates.length) return null;
    return {
      id: p.id, name: p.name, s: new Date(Math.min(...dates)), e: new Date(Math.max(...dates)),
      progressPct: Math.round(mine.reduce((n, t) => n + (t.progress || 0), 0) / mine.length),
    };
  }).filter(Boolean);
  if (!spans.length) return { rangeStart: null, rangeEnd: null, todayPct: null, rows: [] };
  const mn = new Date(Math.min(...spans.map(x => x.s))), mx = new Date(Math.max(...spans.map(x => x.e)));
  const td = dayDiff(mx, mn) + 1;
  return {
    rangeStart: iso(mn), rangeEnd: iso(mx),
    todayPct: Math.min(100, Math.max(0, dayDiff(pD(today), mn) / td * 100)),
    rows: spans.map(x => ({
      id: x.id, name: x.name, progressPct: x.progressPct,
      leftPct: dayDiff(x.s, mn) / td * 100,
      widthPct: Math.max(1, (dayDiff(x.e, x.s) + 1) / td * 100),
    })),
  };
}
