// 手機版畫面用的純函式（無 React 依賴）。today 一律由呼叫端傳入，不在這裡呼叫 new Date()。
import { daysLeft } from "@/lib/myTasks";

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
