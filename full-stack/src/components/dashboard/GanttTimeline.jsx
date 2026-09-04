"use client";
import { useState, useMemo, useEffect } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD, computeAllProgress } from "@/lib/utils";
import MobileGanttList from "./MobileGanttList";

// 左右已合併成同一列，高度由內容決定；長條用 top:50% + translateY(-50%) 垂直置中。
const TASK_MIN_H = 40;   // 列高下限；實際高度由內容決定
const BAR_H = 20;


// ── Pure helper functions (exported for testing and reuse) ────────────────────

/**
 * Filter tasks to exclude any whose projectId is in hiddenProjects.
 * @param {Array} tasks
 * @param {Array|null|undefined} hiddenProjects
 * @returns {Array} new filtered array
 */
export function filterVisibleTasks(tasks, hiddenProjects) {
  if (!hiddenProjects || hiddenProjects.length === 0) return tasks.slice();
  const hidden = new Set(hiddenProjects);
  return tasks.filter(t => !hidden.has(t.projectId));
}

/**
 * Compute average progress across all tasks, rounded to integer.
 * @param {Array} projectTasks  — each item has a .progress (0-100)
 * @returns {number} 0-100 integer
 */
export function computeProjectProgress(projectTasks) {
  if (!projectTasks || projectTasks.length === 0) return 0;
  const sum = projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
  return Math.round(sum / projectTasks.length);
}

/**
 * Compute a project's roll-up span: earliest task start → latest task end,
 * returned as the original date strings. Returns null when no closed range
 * exists (no dated tasks, or a start with no matching end). Used to draw the
 * collapsed-project roll-up bar in the Gantt grid.
 * @param {Array} projectTasks — each item may have .start / .end (date strings)
 * @returns {{start: string, end: string}|null}
 */
export function projectSpan(projectTasks) {
  if (!projectTasks || projectTasks.length === 0) return null;
  let minD = null, maxD = null, minStr = null, maxStr = null;
  for (const t of projectTasks) {
    const s = pD(t.start), e = pD(t.end);
    if (s && (minD === null || s < minD)) { minD = s; minStr = t.start; }
    if (e && (maxD === null || e > maxD)) { maxD = e; maxStr = t.end; }
  }
  if (!minStr || !maxStr) return null;
  return { start: minStr, end: maxStr };
}

/**
 * Sort an array of unique project name strings.
 * @param {string[]} projectNames
 * @param {"name"|"progress"|"manual"|string} mode
 * @param {{ progressByName?: Object, sortOrderByName?: Object }} opts
 * @returns {string[]} new ordered array
 */
export function sortProjectNames(projectNames, mode, opts = {}) {
  const arr = projectNames.slice(); // never mutate input
  if (mode === "name") {
    return arr.sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }
  if (mode === "progress") {
    const pb = opts.progressByName || {};
    return arr.sort((a, b) => {
      const diff = (pb[b] || 0) - (pb[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b, "zh-Hant");
    });
  }
  // "manual" or any other value
  const so = opts.sortOrderByName;
  if (!so || Object.keys(so).length === 0) return arr; // original order
  return arr.sort((a, b) => {
    const oa = so[a] !== undefined ? so[a] : Infinity;
    const ob = so[b] !== undefined ? so[b] : Infinity;
    if (oa !== ob) return oa - ob;
    // tiebreak: original index (stable sort by preserving original positions)
    return projectNames.indexOf(a) - projectNames.indexOf(b);
  });
}

/**
 * Toggle a project id in the collapsedIds array.
 * @param {string[]|undefined} collapsedIds
 * @param {string} id
 * @returns {string[]} new array
 */
export function toggleCollapsed(collapsedIds, id) {
  const arr = collapsedIds ? collapsedIds.slice() : [];
  const idx = arr.indexOf(id);
  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    arr.push(id);
  }
  return arr;
}

/**
 * Check if a project id is in the collapsed set.
 * @param {string[]|null|undefined} collapsedIds
 * @param {string} id
 * @returns {boolean}
 */
export function isCollapsed(collapsedIds, id) {
  if (!collapsedIds) return false;
  return collapsedIds.includes(id);
}

/**
 * Collapse or expand all project ids.
 * @param {string[]|undefined} projIds
 * @param {boolean} collapse  true → collapse all (return copy of projIds); false → expand all (return [])
 * @returns {string[]} new array
 */
export function collapseAllIds(projIds, collapse) {
  if (!projIds) return [];
  return collapse ? projIds.slice() : [];
}

/**
 * Resolve the initial collapsed state from localStorage value and server-persisted default.
 * @param {string[]|null} lsValue  — parsed localStorage value, or null if absent/invalid
 * @param {boolean} defaultCollapsed  — server-persisted per-account default
 * @param {string[]} projIds  — all project ids to collapse when default is true
 * @returns {string[]} array of collapsed project ids
 */
export function resolveInitialCollapsed(lsValue, defaultCollapsed, projIds) {
  if (lsValue !== null && lsValue !== undefined && Array.isArray(lsValue)) {
    return lsValue.slice();
  }
  const ids = projIds || [];
  return defaultCollapsed === true ? ids.slice() : [];
}

/**
 * Read the collapsed state from localStorage.
 * @returns {string[]|null} parsed array, or null if absent or invalid
 */
export function readCollapsedLS() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dash-timelineCollapsed");
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

/**
 * Return de-duplicated projectId values from tasks, excluding any in hiddenProjects.
 * Preserves first-seen order.
 * @param {Array} tasks — each item has a .projectId
 * @param {Array|null|undefined} hiddenProjects — projectIds to exclude
 * @returns {string[]} ordered unique projectIds
 */
export function uniqueProjectIds(tasks, hiddenProjects) {
  const hidden = hiddenProjects && hiddenProjects.length > 0 ? new Set(hiddenProjects) : null;
  const seen = new Set();
  const result = [];
  for (const t of tasks) {
    if (hidden && hidden.has(t.projectId)) continue;
    if (!seen.has(t.projectId)) {
      seen.add(t.projectId);
      result.push(t.projectId);
    }
  }
  return result;
}

/**
 * One field, two accepted shapes:
 *   · string — the global filter bar's single-select ("全部" = no constraint)
 *   · array  — a project-level multi-select ([] = no constraint, OR within the field)
 * @returns {boolean} true when the value passes
 */
function fieldMatches(filter, value) {
  if (Array.isArray(filter)) return filter.length === 0 || filter.includes(value);
  return filter === undefined || filter === null || filter === "全部" || filter === value;
}

/**
 * Does this task survive the gantt's filters? Fields are ANDed.
 * A task with no start date never draws, so it is always excluded.
 * @param {object} d task
 * @param {{fp?:Set|string, fs?:string|string[], fpr?:string|string[], fow?:string[]}} f
 * @returns {boolean}
 */
export function matchesGanttFilters(d, f = {}) {
  const { fp, fs, fpr, fow } = f || {};
  if (!d.start) return false;
  if (fp instanceof Set) { if (fp.size > 0 && !fp.has(d.project)) return false; }
  else if (!fieldMatches(fp, d.project)) return false;
  if (!fieldMatches(fs, d.status)) return false;
  if (!fieldMatches(fpr, d.priority)) return false;
  // owner 是逗號分隔多人字串 → 比對「包含這個人」，不是子字串
  if (Array.isArray(fow) && fow.length > 0) {
    const names = String(d.owner || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!names.some(n => fow.includes(n))) return false;
  }
  return true;
}

function computeScaleDivisions(mn, mx, td, dim) {
  const divs = [];
  if (dim === "日") {
    let cur = new Date(mn.getFullYear(), mn.getMonth(), mn.getDate());
    while (cur <= mx) {
      const off = Math.max(0, (cur - mn) / 864e5);
      divs.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}`, year: cur.getFullYear(), isFirst: cur.getDate() === 1 && cur.getMonth() === 0, pct: (off / td) * 100 });
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  } else if (dim === "週") {
    let cur = new Date(mn.getFullYear(), mn.getMonth(), mn.getDate());
    const dow = cur.getDay(); cur = new Date(cur.getTime() - ((dow === 0 ? 6 : dow - 1)) * 864e5);
    while (cur <= mx) {
      const off = Math.max(0, (cur - mn) / 864e5);
      divs.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}`, year: cur.getFullYear(), isFirst: cur.getMonth() === 0 && cur.getDate() <= 7, pct: (off / td) * 100 });
      cur = new Date(cur.getTime() + 7 * 864e5);
    }
  } else if (dim === "季") {
    const qStart = m => m - m % 3;
    let cur = new Date(mn.getFullYear(), qStart(mn.getMonth()), 1);
    while (cur <= mx) {
      const off = Math.max(0, (cur - mn) / 864e5);
      const q = Math.floor(cur.getMonth() / 3) + 1;
      divs.push({ label: `Q${q}`, year: cur.getFullYear(), isFirst: q === 1, pct: (off / td) * 100 });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
    }
  } else {
    let cur = new Date(mn.getFullYear(), mn.getMonth(), 1);
    while (cur <= mx) {
      const off = Math.max(0, (cur - mn) / 864e5);
      divs.push({ label: `${cur.getMonth() + 1}月`, year: cur.getFullYear(), isFirst: cur.getMonth() === 0, pct: (off / td) * 100 });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return divs;
}

export function TimeScaleToggle({ value, onChange }) {
  const { X } = useTheme();
  const opts = ["日", "週", "月", "季"];
  return (
    <div style={{ display: "inline-flex", borderRadius: 20, border: `1px solid ${X.border}`, overflow: "hidden", background: X.surfaceLight }}>
      {opts.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{ padding: "4px 12px", border: "none", background: value === o ? X.accent : "transparent", color: value === o ? "#fff" : X.textSec, fontSize: 13, fontWeight: value === o ? 700 : 400, cursor: "pointer", transition: "background 0.15s" }}>{o}</button>
      ))}
    </div>
  );
}

export { computeScaleDivisions };

// GanttTimeline is a controlled/uncontrolled hybrid for collapse state.
// - Uncontrolled (Overview/Projects): owns internal state + persists to localStorage.
// - Controlled (TimelineTab): collapsed + onToggleCollapse props are supplied.
export default function GanttTimeline({ tasks, subtasks, fp, fs, fpr, fow, isMobile, timeDim = "月", ganttWidths, timelineHeight, configOwners = [], hiddenProjects = [], timelineSort = "manual", projects = [], collapsed, onToggleCollapse }) {
  const { X, SC, PC, PJC } = useTheme();

  // ── ALL hooks unconditionally at top (fix rules-of-hooks) ─────────────────
  const [hI, setHI] = useState(null);
  const [leftHidden, setLeftHidden] = useState(false);

  // ── Controlled/uncontrolled collapse state ────────────────────────────────
  const [internalCollapsed, setInternalCollapsed] = useState(() => readCollapsedLS() ?? []);
  const isControlled = collapsed !== undefined;
  const collapsedState = isControlled ? collapsed : internalCollapsed;

  // Uncontrolled-only: persist internal collapse state to localStorage.
  useEffect(() => {
    if (isControlled) return;
    if (typeof window === "undefined") return;
    try { localStorage.setItem("dash-timelineCollapsed", JSON.stringify(internalCollapsed)); } catch { /* ignore */ }
  }, [internalCollapsed, isControlled]);

  const ganttData = useMemo(() => {
    // A. Apply hidden-project filter FIRST
    const visible = filterVisibleTasks(tasks, hiddenProjects);
    const fil = visible.filter(d => matchesGanttFilters(d, { fp, fs, fpr, fow }));
    if (!fil.length) return null;
    const dates = fil.flatMap(d => [pD(d.start), pD(d.end)]).filter(Boolean);
    const mn = new Date(Math.min(...dates)), mx = new Date(Math.max(...dates)), td = (mx - mn) / 864e5 + 1;
    const months = computeScaleDivisions(mn, mx, td, timeDim);
    const gw = ganttWidths || { day: 20, week: 50, month: 50, quarter: 100 };
    const ganttMinW = timeDim === "日" ? Math.max(700, td * gw.day) : timeDim === "週" ? Math.max(700, Math.ceil(td / 7) * gw.week) : timeDim === "季" ? Math.max(700, months.length * gw.quarter) : Math.max(700, months.length * gw.month);
    const pMap = {}; fil.forEach(d => { if (!pMap[d.project]) pMap[d.project] = []; pMap[d.project].push(d); });

    // pcMap uses NATURAL order (color stability across sort changes)
    const pcMap = {}; [...new Set(tasks.map(d => d.project))].forEach((p, i) => { pcMap[p] = PJC[i % PJC.length]; });

    const progressMap = computeAllProgress(subtasks, fil);

    // B. Sort project names
    const naturalNames = Object.keys(pMap); // insertion order = natural
    const progressByName = {};
    naturalNames.forEach(name => {
      const pts = pMap[name].map(t => ({ progress: t.status === "已完成" ? 100 : (progressMap.get(t.id)?.pct || 0) }));
      progressByName[name] = computeProjectProgress(pts);
    });
    const sortOrderByName = {};
    projects.forEach(p => { if (p.name !== undefined) sortOrderByName[p.name] = p.sortOrder; });
    const sortedNames = sortProjectNames(naturalNames, timelineSort, { progressByName, sortOrderByName });

    const rows = [];
    sortedNames.forEach(proj => {
      const projId = pMap[proj][0].projectId;
      // Compute avg from the FULL tasks prop (not date-filtered) to match Projects card value
      const avg = computeProjectProgress(tasks.filter(t => t.project === proj));
      // Roll-up bar span: use the date-filtered visible tasks (pMap[proj]) so it
      // aligns with the same mn/td used for individual task bars. null → not drawn.
      const span = projectSpan(pMap[proj]);
      let rollup = null;
      if (span) {
        const rs = pD(span.start), re = pD(span.end);
        rollup = { l: ((rs - mn) / 864e5) / td * 100, w: Math.max(0.3, ((re - rs) / 864e5 + 1) / td * 100) };
      }
      rows.push({ type: "h", proj, projId, n: pMap[proj].length, avg, rollup });
      // C. Skip task rows when project is collapsed
      if (!isCollapsed(collapsedState, projId)) {
        pMap[proj].forEach(task => {
          const s = pD(task.start), e = pD(task.end);
          const l = ((s - mn) / 864e5) / td * 100, w = Math.max(0.3, ((e - s) / 864e5 + 1) / td * 100);
          const prog = progressMap.get(task.id) || { total: 0, done: 0, pct: 0 };
          rows.push({ type: "t", task: { ...task, progress: task.status === "已完成" ? 100 : prog.pct }, proj, l, w });
        });
      }
    });
    const todayPct = ((new Date() - mn) / 864e5) / td * 100;
    return { months, ganttMinW, pcMap, rows, todayPct };
  }, [tasks, subtasks, fp, fs, fpr, PJC, timeDim, ganttWidths, hiddenProjects, timelineSort, projects, collapsedState, isControlled]);

  // ── Early returns AFTER all hooks ─────────────────────────────────────────
  if (isMobile) return <MobileGanttList tasks={tasks} subtasks={subtasks} fp={fp} fs={fs} fpr={fpr} timeDim={timeDim} configOwners={configOwners} hiddenProjects={hiddenProjects} projects={projects} />;
  if (!ganttData) return (<div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📅</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No timeline data</div><div style={{ fontSize: 14 }}>Try adjusting filters or adding tasks with dates</div></div>);

  const { months, ganttMinW, pcMap, rows, todayPct } = ganttData;

  return (
    <div style={{ border: `1px solid ${X.border}`, borderRadius: 12, overflow: "hidden", background: X.surface }}>
      {/* 單一捲動容器：左欄用 position:sticky 釘在左邊，不再是兩棵各自捲動的 DOM。
          一列就是一個 flex row，左右高度天然一致 —— 不必寫死列高，也不需要 scrollTop 同步。 */}
      <div style={{ overflow: "auto", maxHeight: `${timelineHeight || 100}vh` }}>

        {/* ── 表頭 ── */}
        <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 6 }}>
          <div className={`dash-gantt-left dash-gantt-left-collapsible${leftHidden ? " dash-gantt-left-hidden" : ""}`}
            style={{ position: "sticky", left: 0, zIndex: 7, height: 48, display: "flex", alignItems: "flex-end",
              padding: leftHidden ? 0 : "0 8px 10px 16px", overflow: "hidden", background: X.surfaceLight, borderBottom: `1px solid ${X.border}`,
              fontSize: 14, color: X.textDim, flexShrink: 0 }}>
            <span>Project / Task</span>
          </div>
          <button onClick={() => setLeftHidden(h => !h)} title={leftHidden ? "展開面板" : "收合面板"}
            style={{ position: "sticky", left: 0, zIndex: 7, width: 20, minWidth: 20, height: 48, display: "flex", alignItems: "center", justifyContent: "center",
              background: X.surfaceLight, border: "none", borderBottom: `1px solid ${X.border}`, borderRight: `1px solid ${X.border}`,
              cursor: "pointer", color: X.textDim, fontSize: 12, padding: 0, flexShrink: 0 }}>{leftHidden ? "»" : "«"}</button>
          <div style={{ position: "relative", height: 48, width: ganttMinW, flexShrink: 0, background: X.surfaceLight, borderBottom: `1px solid ${X.border}` }}>
            {(() => { const step = timeDim === "日" ? Math.max(1, Math.ceil(40 / (ganttWidths?.day || 20))) : 1; return months.filter((_, i) => i % step === 0); })().map((m, i, arr) => { const np = i < arr.length - 1 ? arr[i + 1].pct : 100; return (<div key={i} style={{ position: "absolute", left: `${m.pct}%`, width: `${np - m.pct}%`, height: "100%", borderLeft: `1px solid ${m.isFirst ? X.borderLight : X.border}`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 0 6px 6px", overflow: "hidden" }}>{m.isFirst && <div style={{ fontFamily: FM, fontSize: 11, color: X.textDim, fontWeight: 600, marginBottom: 2 }}>{m.year}</div>}<div style={{ fontSize: 12, color: X.textSec, fontWeight: 500, whiteSpace: "nowrap" }}>{m.label}</div></div>); })}
          </div>
        </div>

        {/* ── 內容 ── */}
        <div className="dash-gantt-chart" style={{ position: "relative" }}>
          {/* 格線與 TODAY 線：鏡射列的排版（左欄佔位 + 收合鈕佔位 + 同寬軌道），基準才會與長條一致 */}
          <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none", zIndex: 0 }}>
            <div className={`dash-gantt-left dash-gantt-left-collapsible${leftHidden ? " dash-gantt-left-hidden" : ""}`} style={{ flexShrink: 0 }} />
            <div style={{ width: 20, minWidth: 20, flexShrink: 0 }} />
            <div style={{ position: "relative", width: ganttMinW, flexShrink: 0 }}>
              {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: m.isFirst ? X.borderLight : `${X.border}50` }} />)}
              {todayPct >= 0 && todayPct <= 100 && <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${X.accent}`, zIndex: 2, opacity: 0.7 }}><div style={{ background: X.accent, color: "#fff", fontSize: 10, padding: "2px 5px", borderRadius: 10, fontWeight: 700, marginLeft: 3, display: "inline-block", position: "sticky", top: 2 }}>TODAY</div></div>}
            </div>
          </div>

          {rows.map((r, i) => {
            if (r.type === "h") {
              const c = pcMap[r.proj] || X.accent;
              const coll = isCollapsed(collapsedState, r.projId);
              const toggle = () => { if (isControlled) onToggleCollapse(r.projId); else setInternalCollapsed(prev => toggleCollapsed(prev, r.projId)); };
              const ru = r.rollup;
              const dn = r.avg === 100;
              return (<div key={`h-${r.proj}`} style={{ display: "flex", position: "relative", zIndex: 1, borderTop: i > 0 ? `1px solid ${X.border}` : "none", borderBottom: `1px solid ${c}30` }}>
                <div className={`dash-gantt-left dash-gantt-left-collapsible${leftHidden ? " dash-gantt-left-hidden" : ""}`}
                  role="button" tabIndex={0} aria-expanded={!coll} aria-label={r.proj} onClick={toggle}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { if (e.key === " ") e.preventDefault(); toggle(); } }}
                  style={{ position: "sticky", left: 0, zIndex: 2, minHeight: 32, display: "flex", alignItems: "center", padding: leftHidden ? 0 : "6px 14px", overflow: "hidden", gap: 8,
                    background: X.surfaceLight, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: c, flexShrink: 0, userSelect: "none" }}>{coll ? "▸" : "▾"}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c, flex: 1, minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.3 }}>{r.proj}</span>
                  {!coll && <span style={{ fontFamily: FM, fontSize: 12, color: X.textDim, flexShrink: 0 }}>{r.n}</span>}
                </div>
                <div style={{ width: 20, minWidth: 20, flexShrink: 0, background: X.surfaceLight, position: "sticky", left: 0, zIndex: 2, borderRight: `1px solid ${X.border}` }} />
                <div style={{ position: "relative", width: ganttMinW, flexShrink: 0, background: `${c}08` }}>
                  {coll && ru && <>
                    <div style={{ position: "absolute", left: `${ru.l}%`, width: `${ru.w}%`, top: "50%", transform: "translateY(-50%)", height: 10, borderRadius: 5, background: `${c}30`, border: `1px solid ${c}40`, minWidth: 6 }} />
                    {r.avg > 0 && <div style={{ position: "absolute", left: `${ru.l}%`, width: `${ru.w * r.avg / 100}%`, top: "50%", transform: "translateY(-50%)", height: 10, borderRadius: 5, background: c, opacity: dn ? 0.6 : 0.85, minWidth: 4 }} />}
                    {r.avg > 0 && r.avg < 100 && ru.w > 3 && <div style={{ position: "absolute", left: `${ru.l + ru.w * r.avg / 100 + 0.4}%`, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontFamily: FM, color: c, fontWeight: 700 }}>{r.avg}%</div>}
                    {dn && ru.w > 3 && <div style={{ position: "absolute", left: `${ru.l + ru.w / 2}%`, top: "50%", transform: "translate(-50%,-50%)", fontSize: 12, fontFamily: FM, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.4)", fontWeight: 700 }}>100%</div>}
                  </>}
                </div>
              </div>);
            }
            const sc = SC[r.task.status] || {}, pc = PC[r.task.priority] || {};
            const bc = pcMap[r.proj], hv = hI === i, dn = r.task.status === "已完成", pp = r.task.status === "提案中" || r.task.status === "待確認";
            return (<div key={`t-${r.task.id}`} onMouseEnter={() => setHI(i)} onMouseLeave={() => setHI(null)}
              style={{ display: "flex", position: "relative", zIndex: hv ? 10 : 1, borderBottom: `1px solid ${X.border}22` }}>
              <div className={`dash-gantt-left dash-gantt-left-collapsible${leftHidden ? " dash-gantt-left-hidden" : ""}`}
                style={{ position: "sticky", left: 0, zIndex: 2, minHeight: TASK_MIN_H, display: "flex", alignItems: "center", padding: leftHidden ? 0 : "6px 10px 6px 26px", overflow: "hidden", gap: 6,
                  background: hv ? X.surfaceHover : X.surfaceLight, flexShrink: 0 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: X.text, lineHeight: 1.3, overflowWrap: "anywhere" }}>{r.task.task}</div>
                <span style={{ fontSize: 14, padding: "1px 6px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{r.task.status}</span>
              </div>
              <div style={{ width: 20, minWidth: 20, flexShrink: 0, background: hv ? X.surfaceHover : X.surfaceLight, position: "sticky", left: 0, zIndex: 2, borderRight: `1px solid ${X.border}` }} />
              <div style={{ position: "relative", width: ganttMinW, flexShrink: 0, background: hv ? X.surfaceHover : "transparent" }}>
                <div style={{ position: "absolute", left: `${r.l}%`, width: `${r.w}%`, top: "50%", transform: "translateY(-50%)", height: BAR_H, borderRadius: 10, background: pp ? `repeating-linear-gradient(135deg,${bc}28,${bc}28 4px,${bc}15 4px,${bc}15 8px)` : `${bc}30`, border: `1px solid ${bc}40`, minWidth: 6 }} />
                {r.task.progress > 0 && <div style={{ position: "absolute", left: `${r.l}%`, width: `${r.w * r.task.progress / 100}%`, top: "50%", transform: "translateY(-50%)", height: BAR_H, borderRadius: 10, background: bc, opacity: dn ? 0.55 : 0.85, minWidth: 4 }} />}
                {r.task.progress > 0 && r.task.progress < 100 && r.w > 3 && <div style={{ position: "absolute", left: `${r.l + r.w * r.task.progress / 100 + 0.4}%`, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontFamily: FM, color: bc, fontWeight: 600 }}>{r.task.progress}%</div>}
                {dn && r.w > 3 && <div style={{ position: "absolute", left: `${r.l + r.w / 2}%`, top: "50%", transform: "translate(-50%,-50%)", fontSize: 14, fontFamily: FM, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.4)", fontWeight: 700 }}>100%</div>}
                {hv && <div style={{ position: "absolute", left: `${Math.min(Math.max(r.l, 2), 65)}%`, bottom: "100%", background: X.surfaceLight, color: X.text, fontSize: 14, padding: "6px 12px", borderRadius: 8, whiteSpace: "nowrap", maxWidth: "90vw", overflow: "hidden", textOverflow: "ellipsis", zIndex: 30, boxShadow: `0 4px 16px ${X.shadowHeavy}`, border: `1px solid ${X.border}` }}>{fD(r.task.start)} → {fD(r.task.end)}　{r.task.duration}d　{r.task.progress}%</div>}
              </div>
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}
