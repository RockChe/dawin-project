import { dayIndex } from "./dayIndex";

// 卡片視圖分組（設計稿 desktop.html mkProject 的 m.hz）：有逾期 → 已逾期；
// 否則看「下一個未完成里程碑」的到期日：≤7 天 這週、同月 本月、下月 下月、其餘／沒有 之後。
// 日期一律走 dayIndex；今天由呼叫端傳入（Dashboard 的 TodayContext 快照）。
export const GROUPS = [
  ["over", "已逾期"],
  ["wk", "這週"],
  ["mo", "本月"],
  ["nx", "下月"],
  ["lt", "之後"],
];

const ym = (idx) => { const d = new Date(idx * 864e5); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

/**
 * projects: [{ projectId, name, tasks:[{ task, status, end }] }]（visibleProjects 的輸出）
 * 回傳固定五組 [{ key, label, items }]；item = 原專案欄位 + { ms, odCount, odDays, odName }
 * ms = { name, end, days } 或 null（沒有未完成且未過期的任務）。
 */
export function groupProjects(projects, today) {
  const T = dayIndex(today);
  const out = GROUPS.map(([key, label]) => ({ key, label, items: [] }));
  const byKey = Object.fromEntries(out.map((g) => [g.key, g]));

  for (const p of projects) {
    const open = [];
    for (const t of p.tasks || []) {
      const e = dayIndex(t.end);
      if (t.status !== "已完成" && e != null && T != null) open.push({ t, e });
    }
    const late = open.filter((x) => x.e < T).sort((a, b) => a.e - b.e);
    const next = open.filter((x) => x.e >= T).sort((a, b) => a.e - b.e)[0];
    const ms = next ? { name: next.t.task, end: next.t.end, days: next.e - T } : null;
    const item = { ...p, ms, odCount: late.length, odDays: late.length ? T - late[0].e : 0, odName: late.length ? late[0].t.task : "", _k: late.length ? late[0].e : next ? next.e : Infinity };

    const key = late.length ? "over"
      : !ms ? "lt"
      : ms.days <= 7 ? "wk"
      : ym(next.e) === ym(T) ? "mo"
      : ym(next.e) === ym(T) + 1 ? "nx"
      : "lt";
    byKey[key].items.push(item);
  }
  // 組內依里程碑日由近到遠（Array.sort 穩定：同日維持呼叫端的排序）；沒有里程碑的 Infinity 排最後
  for (const g of out) g.items.sort((a, b) => a._k - b._k).forEach((i) => delete i._k);
  return out;
}
