// /v2 Overview／My Tasks 共用的純函式。today 一律由呼叫端傳入（營業日快照 "YYYY-MM-DD"），這裡不讀系統時鐘。
// 資料來源沿用 getInitialData 已載入的 tasks／subtasks／projects；不新增 server action。
import { dayIndex } from "./dayIndex";
import { subOwnerTokens } from "./taskOwner";
import { timeProgress } from "./v2Overall";
import { elapsedPct, gapInfo, stateOf } from "./timelineGap";
import { daysLeft } from "./myTasks";
import { matchesStatusFilter } from "./statusFilter";
import { computeProjectStatus } from "@/hooks/useProjectStatus";

export const PROJECT_COLORS = ["accent", "purple", "amber", "red", "green", "cyan", "pink"];
export const STATUS_CLS = { "已完成": "done", "進行中": "doing", "待辦": "todo", "暫緩": "hold", "提案中": "prop", "待確認": "conf" };
// 狀態 → [色塊 css 變數, 文字色 css 變數]（文字一律用 AA 版 --t-*）
export const STATUS_VAR = { "已完成": ["green", "t-green"], "進行中": ["amber", "t-amber"], "待辦": ["accent", "t-accent"], "暫緩": ["text-dim", "text-sec"], "提案中": ["pink", "t-pink"], "待確認": ["purple", "t-purple"] };
// 任務狀態雲：待辦＝白雲（較小較淡）／進行中＝白雲／已完成＝筋斗雲／暫緩＝淡紫／提案中、待確認＝粉紅
export const STATUS_CLOUD = { "待辦": "white", "進行中": "white", "已完成": "nimbus", "暫緩": "purple", "提案中": "pink", "待確認": "pink" };
// 專案狀況（白話標籤）：key 沿用 projectWeather；cloud＝雲；ink＝文字色；sq＝色塊
export const WX = {
  over: { label: "有逾期", cloud: "dark", ink: "t-red", sq: "red" },
  ahead: { label: "進度領先", cloud: "nimbus", ink: "t-green", sq: "green" },
  ok: { label: "進行順利", cloud: "white", ink: "t-accent", sq: "accent" },
  hold: { label: "暫緩中", cloud: "purple", ink: "t-purple", sq: "text-dim" },
  prop: { label: "提案／待確認", cloud: "pink", ink: "t-pink", sq: "pink" },
};
export const WX_ORDER = ["over", "ahead", "ok", "hold", "prop"];

const norm = (s) => String(s).split(" ")[0].replace(/-/g, "/");

/** twp（任務＋進度）的 v2 版：與 useTaskManager.twp 同欄位，但進度的「今天」由參數給。 */
export function buildTwp(tasks, subtasks, projects, today) {
  const name = new Map(projects.map((p) => [p.id, p.name]));
  const subs = new Map();
  for (const s of subtasks) { if (!subs.has(s.taskId)) subs.set(s.taskId, []); subs.get(s.taskId).push(s); }
  return tasks.map((t) => {
    const ss = subs.get(t.id) || [];
    const done = ss.filter((s) => s.done).length;
    const pct = ss.length ? Math.round((done / ss.length) * 100) : timeProgress(t.startDate, t.endDate, today);
    return {
      ...t,
      project: name.get(t.projectId) || "",
      progress: t.status === "已完成" ? 100 : pct,
      sDone: done, sTotal: ss.length, timeBased: !ss.length,
      subOwner: subOwnerTokens(ss).join(","),
      start: t.startDate, end: t.endDate,
    };
  });
}

/** 任務層級的落後／領先資訊（gapInfo 的 kind／text／sub）。 */
export function taskGap(t, today) {
  const el = elapsedPct(t.start ?? t.startDate, t.end ?? t.endDate, today);
  const done = t.status === "已完成";
  const T = dayIndex(today), E = dayIndex(t.end ?? t.endDate), S = dayIndex(t.start ?? t.startDate);
  const prog = t.progress ?? 0;
  const gap = done ? 0 : prog - el;
  const state = stateOf({ overdue: !done && T != null && E != null && E < T, hold: t.status === "暫緩", prop: t.status === "提案中" || t.status === "待確認", gap });
  return gapInfo({ state, done, gap, prog, el, tot: S != null && E != null ? E - S : 0 });
}

/**
 * 每個「有任務且有日期」的專案一列（含已封存，Overview 不過濾封存），依 projects 順序。
 * 欄位：s／e（專案區間）、prog、el、gap、tot、state（over|behind|ok|hold|prop）、key／label／cloud（專案狀況）、
 * od／odDays（逾期件數／最久天數）、gapInfo（右欄文字）。
 */
export function projectRows(twp, projects, today) {
  const T = dayIndex(today);
  return projects.map((p, i) => {
    const ts = twp.filter((t) => t.projectId === p.id);
    if (!ts.length) return null;
    let s = null, e = null, sI = null, eI = null;
    for (const t of ts) {
      const a = dayIndex(t.start), b = dayIndex(t.end);
      if (a != null && (sI == null || a < sI)) { sI = a; s = t.start; }
      if (b != null && (eI == null || b > eI)) { eI = b; e = t.end; }
    }
    if (s == null || e == null) return null;
    const st = computeProjectStatus(ts, today);
    const archived = !!p.archivedAt;
    const late = ts.filter((t) => t.status !== "已完成" && dayIndex(t.end) != null && dayIndex(t.end) < T);
    const state = archived ? "hold" : st.bar.state;
    const gi = archived
      ? { kind: "hold", text: "已封存" }
      : gapInfo({ state, done: st.bar.done, gap: st.bar.gap, prog: st.bar.prog, el: st.bar.elapsed, tot: st.bar.tot });
    if (!archived && state === "prop") gi.text = ts.some((t) => t.status === "待確認") ? "待確認" : "提案中";
    const wx = WX[st.key];
    return {
      id: p.id, name: p.name, color: PROJECT_COLORS[i % PROJECT_COLORS.length], archived,
      n: ts.length, s: norm(s), e: norm(e),
      prog: st.bar.prog, el: st.bar.elapsed, gap: st.bar.gap, tot: st.bar.tot, done: st.bar.done,
      state, key: st.key, label: archived ? "已封存" : wx.label, cloud: archived ? "purple" : wx.cloud, reason: st.text,
      od: late.length, odDays: late.length ? Math.max(...late.map((t) => T - dayIndex(t.end))) : 0,
      gapInfo: gi,
    };
  }).filter(Boolean);
}

/** 專案狀況統計（不含已封存）。 */
export function weatherCounts(rows) {
  const c = Object.fromEntries(WX_ORDER.map((k) => [k, 0]));
  for (const r of rows) if (!r.archived) c[r.key]++;
  return c;
}

/**
 * 即將到期：今天起 days 天內、未完成、依到期日排序。
 * 回傳 { list（前 limit 件）, total, soon（≤7 天的件數）}；篩選與 Dashboard 的跨專案篩選同語意（[] = 不篩）。
 */
export function upcomingTasks(twp, { today, days = 30, limit = 5, statuses = [], priority = "全部", projectIds = [] }) {
  const all = twp.filter((t) => {
    if (!t.end || t.status === "已完成") return false;
    if (!matchesStatusFilter(t.status, statuses)) return false;
    if (priority !== "全部" && t.priority !== priority) return false;
    if (projectIds.length && !projectIds.includes(t.projectId)) return false;
    const d = daysLeft(t.end, today);
    return d >= 0 && d <= days;
  }).sort((a, b) => dayIndex(a.end) - dayIndex(b.end));
  return { list: all.slice(0, limit), total: all.length, soon: all.filter((t) => daysLeft(t.end, today) <= 7).length };
}

/** 期限急迫度雲：已完成＝筋斗雲；逾期或 ≤2 天＝烏雲；3–7 天＝粉紅；其餘白雲。 */
export function urgency(t, today) {
  if (t.status === "已完成") return "nimbus";
  const d = daysLeft(t.end, today);
  return d <= 2 ? "dark" : d <= 7 ? "pink" : "white";
}

export const statusCounts = (twp) => {
  const c = { "已完成": 0, "進行中": 0, "待辦": 0, "暫緩": 0, "提案中": 0, "待確認": 0 };
  for (const t of twp) if (t.status in c) c[t.status]++;
  return c;
};

/** 甜甜圈圖弧線（viewBox 200，外徑 90、內徑 58、弧間隙 0.04rad）；只畫有數量的狀態。 */
export function donutArcs(counts) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const cx = 100, cy = 100, R = 90, r = 58, g = 0.04;
  let ca = -Math.PI / 2;
  return entries.map(([s, n]) => {
    const a = (n / total) * Math.PI * 2 - g, sa = ca + g / 2;
    ca += a + g;
    const ea = sa + a, la = a > Math.PI ? 1 : 0;
    const d = `M${cx + R * Math.cos(sa)},${cy + R * Math.sin(sa)} A${R},${R} 0 ${la} 1 ${cx + R * Math.cos(ea)},${cy + R * Math.sin(ea)} L${cx + r * Math.cos(ea)},${cy + r * Math.sin(ea)} A${r},${r} 0 ${la} 0 ${cx + r * Math.cos(sa)},${cy + r * Math.sin(sa)} Z`;
    return { s, n, pct: Math.round((n / total) * 100), d };
  });
}

/** 人員標籤顏色 class（a–f）：依名單順序循環；不在名單用 c。 */
export function ownerClass(name, owners = []) {
  const i = owners.indexOf(name);
  return i < 0 ? "c" : "abcdef"[i % 6];
}
