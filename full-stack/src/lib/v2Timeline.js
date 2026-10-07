// /v2 Timeline（甘特＋卡片）共用的純函式。today 一律由呼叫端傳入（營業日快照），這裡不讀系統時鐘。
// 「哪些專案、什麼順序」只在 timelineProjects 算一次，甘特與卡片視圖共用（同舊版 lib/visibleProjects 的規則：
// 隱藏／封存 → 篩選 → 排序；差別：進度用傳入的 today 算、配色依 projects 順序與 Overview／Projects 同色）。
import { dayIndex } from "./dayIndex";
import { elapsedPct, gapInfo, stateOf } from "./timelineGap";
import { groupProjects } from "./timelineGroups";
import { projectRows } from "./v2Data";

/** 排序下拉：[值, 文字]。「到期日」是 v2 新增，只存畫面、不寫入設定（舊版 timelineSort 只認 manual／name／progress）。 */
export const TL_SORTS = [["manual", "手動"], ["name", "名稱"], ["progress", "進度"], ["due", "到期日"]];
export const TL_PROJECT_STATUSES = ["進行中", "待確認", "提案中", "暫緩"];

const norm = (s) => (s ? String(s).split(" ")[0].replace(/-/g, "/") : null);

/** 任務列模型（規則同設計稿 mkTask：已完成 gap=0；逾期＝未完成且到期日 < 今天）。條用任務自己的起訖。 */
export function taskModel(t, today, color) {
  const done = t.status === "已完成", hold = t.status === "暫緩", prop = t.status === "提案中" || t.status === "待確認";
  const S = dayIndex(t.start), E = dayIndex(t.end), T = dayIndex(today);
  const od = !done && E != null && T != null && E < T;
  const el = elapsedPct(t.start, t.end, today), prog = t.progress || 0, gap = done ? 0 : prog - el;
  const tot = S != null && E != null ? E - S : 0;
  const state = stateOf({ overdue: od, hold, prop, gap });
  return {
    kind: "t", id: t.id, projectId: t.projectId, name: t.task, status: t.status, priority: t.priority,
    s: norm(t.start), e: norm(t.end), prog, el, gap, tot, done, od, odDays: od ? T - E : 0, state, color,
    gapInfo: gapInfo({ state, done, gap, prog, el, tot }),
  };
}

const ownersOf = (ts) => {
  const out = [];
  for (const t of ts) for (const n of String(t.owner || "").split(",")) { const x = n.trim(); if (x && x !== "—" && !out.includes(x)) out.push(x); }
  return out;
};

const projectStatusLabel = (ts) => {
  if (ts.every((t) => t.status === "暫緩")) return "暫緩";
  if (!ts.some((t) => t.status === "進行中" || t.status === "已完成")) return ts.some((t) => t.status === "待確認") ? "待確認" : "提案中";
  return ts.every((t) => t.status === "已完成") ? "已完成" : "進行中";
};

/**
 * 專案列模型（projectRows 的欄位＋Timeline 需要的）：kind:'p'、projectId、status（專案狀態：進行中／待確認／提案中／暫緩／已完成）、
 * odName／odEnd（最早逾期的任務）、owners、tasks（原 twp 任務，給 groupProjects）、taskRows（任務列模型，依開始日）。
 * opts: hidden（個人隱藏 id）、fp（只看這些專案 id）、fst（專案狀態）、frisk（'逾期'｜'落後'）、sort。
 * 回傳 { all（套用隱藏／封存後、篩選前——給「專案」篩選項與腳註）, list（套篩選與排序）}。
 */
export function timelineProjects(twp, projects, today, { hidden = [], fp = [], fst = [], frisk = [], sort = "manual" } = {}) {
  const hide = new Set(hidden);
  const order = new Map(projects.map((p, i) => [p.id, [p.sortOrder || 0, i]]));
  const byP = new Map();
  for (const t of twp) { if (!byP.has(t.projectId)) byP.set(t.projectId, []); byP.get(t.projectId).push(t); }
  const T = dayIndex(today);
  const all = projectRows(twp, projects, today).filter((r) => !r.archived && !hide.has(r.id)).map((r) => {
    const ts = byP.get(r.id) || [];
    const late = ts.filter((t) => t.status !== "已完成" && dayIndex(t.end) != null && dayIndex(t.end) < T).sort((a, b) => dayIndex(a.end) - dayIndex(b.end));
    const taskRows = ts.filter((t) => dayIndex(t.start) != null).sort((a, b) => dayIndex(a.start) - dayIndex(b.start)).map((t) => taskModel(t, today, r.color));
    return {
      ...r, kind: "p", projectId: r.id, status: projectStatusLabel(ts),
      odName: late[0]?.task || "", odEnd: late[0] ? norm(late[0].end) : null,
      owners: ownersOf(ts), tasks: ts, taskRows,
    };
  });
  let list = all.filter((m) => (!fp.length || fp.includes(m.id)) && (!fst.length || fst.includes(m.status))
    && (!frisk.length || (frisk.includes("逾期") && m.od > 0) || (frisk.includes("落後") && m.gap <= -5 && m.key !== "hold" && m.key !== "prop")));
  if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  else if (sort === "progress") list = [...list].sort((a, b) => b.prog - a.prog);
  else if (sort === "due") list = [...list].sort((a, b) => dayIndex(a.e) - dayIndex(b.e));
  else list = [...list].sort((a, b) => { const x = order.get(a.id), y = order.get(b.id); return x[0] - y[0] || x[1] - y[1]; });
  return { all, list };
}

/** 展開後的任務列：任務狀態（多選，[]＝不篩）與優先度（'全部'＝不篩）只影響這裡，不會讓專案消失。 */
export const visibleTaskRows = (m, { fs = [], fpr = "全部" } = {}) =>
  m.taskRows.filter((t) => (!fs.length || fs.includes(t.status)) && (fpr === "全部" || t.priority === fpr));

/** 甘特的扁平列：專案列，後面接上展開專案的任務列（任務列帶 pkey＝所屬專案狀況，標出狀況時一起變淡）。 */
export function flattenRows(list, collapsed, taskFilter) {
  const closed = new Set(collapsed);
  return list.flatMap((m) => (closed.has(m.id) ? [m] : [m, ...visibleTaskRows(m, taskFilter).map((t) => ({ ...t, pkey: m.key }))]));
}

/** 卡片視圖分組標題：[key, 標題, 雲, 說明]（設計稿 tlLanes）。 */
export function laneInfo(today) {
  const T = dayIndex(today), DAY = 864e5;
  const d = (idx) => new Date(idx * DAY);
  const md = (idx) => `${d(idx).getUTCMonth() + 1}/${d(idx).getUTCDate()}`;
  const t = d(T), eom = Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0) / DAY), mo = t.getUTCMonth();
  return [
    ["over", "已逾期", "dark", "專案內有任務已過期"],
    ["wk", "這週", "pink", `${md(T)} – ${md(T + 7)}（7 天內）`],
    ["mo", "本月", "white", `${md(T + 8)} – ${md(eom)}`],
    ["nx", "下月", "white", `${(mo + 1) % 12 + 1} 月`],
    ["lt", "之後", "purple", `${(mo + 2) % 12 + 1} 月以後`],
  ].map(([key, label, cloud, sub]) => ({ key, label, cloud, sub }));
}

/** 卡片分組（沿用 lib/timelineGroups.groupProjects：逾期→已逾期；否則看下一個里程碑到期日）。 */
export const groupLanes = (list, today) => groupProjects(list, today);

/** 成員頭像字：英文取前兩字、中文取第一字。 */
export const ownerInitials = (name) => (/^[\x00-\x7F]/.test(name) ? name.replace(/\s+/g, "").slice(0, 2) : name.slice(0, 1));

/** 逐專案收折的初始值：有存過（陣列）用存的；否則預設收折＝全部專案 id、預設展開＝[]。 */
export const resolveCollapsed = (saved, defaultCollapsed, ids) =>
  (Array.isArray(saved) ? saved.slice() : defaultCollapsed ? ids.slice() : []);

export const COLLAPSED_LS_KEY = "dash-timelineCollapsed"; // 同舊版（per-device）

/** 軌道內寬（px）＝單位數 × 每單位像素（沿用 ganttWidths 的 day／week／month／quarter）。 */
export function trackPx(scale, ax, gw) {
  const days = ax.b - ax.a;
  if (scale === "日") return days * gw.day;
  if (scale === "週") return Math.ceil(days / 7) * gw.week;
  return ax.ticks.length * (scale === "季" ? gw.quarter : gw.month);
}

/**
 * 把「今天」捲到可視軌道（扣掉左右兩個固定欄）的正中央。
 * todayX＝今天線在捲動內容裡的 x；結果夾在 0～(scrollW − clientW)。
 */
export function centerScroll({ todayX, clientW, leftW, rightW, scrollW }) {
  const want = todayX - (leftW + (clientW - leftW - rightW) / 2);
  return Math.max(0, Math.min(want, scrollW - clientW));
}

