"use client";
import { useMemo, useState } from "react";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus } from "@/lib/statusFilter";
import { myTaskKpis } from "@/lib/myTasks";
import { resolveTimeDim } from "@/lib/personalSettings";
import { filterBySearch } from "@/lib/v2Search";
import { projectRows, upcomingTasks, statusCounts, weatherCounts, STATUS_VAR, PROJECT_COLORS } from "@/lib/v2Data";
import Cloud from "./Cloud";
import OverviewTimeline from "./OverviewTimeline";
import { Upcoming, StatusPanel } from "./OverviewPanels";
import { useV2Settings } from "./SettingsContext";

const PRIORITIES = ["全部", "高", "中", "低"];

// 雲朵播報列：登入者名下任務的三個計數，點了跳到 My Tasks 對應分組。
function Broadcast({ kpi, today, onJumpMy }) {
  const items = [["overdue", "逾期", "dark", "c-red", kpi.overdue, "red"], ["soon", "7 天內到期", "pink", "c-pink", kpi.soon, "pink"], ["done", "本月完成", "nimbus", "c-green", kpi.doneThisMonth, "green"]];
  return (
    <section className="blk bcast" aria-label="雲朵播報">
      <Cloud kind="white" size={80} deco fb="bar" fc="accent" />
      <div className="bubble">
        <small>雲朵播報 · 今天 {today.replace(/-/g, "/")} · 你名下的任務</small>
        <p>今天有 {kpi.overdue} 件逾期、{kpi.soon} 件 7 天內到期，本月已完成 {kpi.doneThisMonth} 件</p>
      </div>
      <div className="cnts">
        {items.map(([g, l, c, tc, n, fc]) => (
          <button key={g} type="button" className="cnt3" aria-label={`${l} ${n} 件，前往 My Tasks 對應分組`} onClick={() => onJumpMy?.(g)}>
            <Cloud kind={c} size={36} deco fb="dot" fc={fc} />
            <span><b className={tc}>{n}</b><span className="l">{l}</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

// 跨專案篩選（狀態多選／優先度／專案）：與設計稿相同，只影響 Upcoming；圓餅與時程永遠看全部。
export function FilterBar({ f, set, projects }) {
  const [open, setOpen] = useState(false);
  const any = f.statuses.length > 0 || f.priority !== "全部" || f.projectIds.length > 0;
  return (<>
    <div className="fbar" role="group" aria-label="跨專案篩選">
      <span className="lab">跨專案篩選</span>
      {STATUS_FILTERS.map((s) => {
        const on = s === "全部" ? !f.statuses.length : f.statuses.includes(s);
        const st = STATUS_VAR[s];
        return <button key={s} type="button" className={s === "全部" ? `chip sm${on ? " on" : ""}` : "chip sm sc"} style={st ? { "--c": `var(--${st[0]})`, "--tc": `var(--${st[1]})` } : undefined} aria-pressed={on} onClick={() => set({ statuses: toggleStatus(f.statuses, s) })}>{s}</button>;
      })}
      <span className="sepv" />
      <span className="lab">優先度</span>
      {PRIORITIES.map((p) => <button key={p} type="button" className="chip sm" aria-pressed={f.priority === p} onClick={() => set({ priority: p })}>{p}</button>)}
      <span className="sepv" />
      <button type="button" className="chip sm" aria-expanded={open} aria-pressed={f.projectIds.length > 0} onClick={() => setOpen(!open)}>
        專案 {f.projectIds.length ? `${f.projectIds.length} 個` : "全部"} <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {any && <button type="button" className="btn sec sm" onClick={() => set({ statuses: [], priority: "全部", projectIds: [] })}>清除</button>}
    </div>
    {open && (
      <div className="fpanel" role="group" aria-label="選擇專案">
        {projects.map((p, i) => !p.archivedAt && (
          <button key={p.id} type="button" className="chip sm" aria-pressed={f.projectIds.includes(p.id)}
            onClick={() => set({ projectIds: f.projectIds.includes(p.id) ? f.projectIds.filter((x) => x !== p.id) : [...f.projectIds, p.id] })}>
            <span className="pdot" style={{ "--c": `var(--${PROJECT_COLORS[i % PROJECT_COLORS.length]})` }} />{p.name}
          </button>
        ))}
      </div>
    )}
  </>);
}

// Overview：資料全來自父層已載入的 twp／projects（沿用 getInitialData），today 由 server page 取一次傳下，不新增 server action。
// searchQ：頁首搜尋字串，只過濾 Upcoming（同舊版 filtered；播報列、專案時程、圓餅仍看全部）。
export default function Overview({ twp, projects, userName, userNames, today, searchQ = "", onJumpMy, onOpenProject, onOpenTask }) {
  const { settings, updateSetting } = useV2Settings();
  const [f, setF] = useState({ statuses: [], priority: "全部", projectIds: [] });
  const scale = resolveTimeDim(settings.timeDimOverview);
  const days = settings.upcomingDays ?? 30, limit = settings.upcomingLimit ?? 5;

  const rows = useMemo(() => projectRows(twp, projects, today), [twp, projects, today]);
  const kpi = useMemo(() => myTaskKpis(twp, userName, today), [twp, userName, today]);
  const counts = useMemo(() => statusCounts(twp), [twp]);
  const wx = useMemo(() => weatherCounts(rows), [rows]);
  const up = useMemo(() => upcomingTasks(filterBySearch(twp, searchQ), { today, days, limit, ...f }), [twp, searchQ, today, days, limit, f]);

  return (<>
    <Broadcast kpi={kpi} today={today} onJumpMy={onJumpMy} />
    <FilterBar f={f} set={(p) => setF((x) => ({ ...x, ...p }))} projects={projects} />
    <OverviewTimeline rows={rows} today={today} scale={scale} onScale={(v) => updateSetting("timeDimOverview", v)} onOpenProject={onOpenProject} />
    <div className="grid2">
      <Upcoming result={up} days={days} limit={limit} today={today} owners={userNames} onOpenTask={onOpenTask} />
      <StatusPanel counts={counts} rows={rows} wxCounts={wx} onOpenProject={onOpenProject} />
    </div>
  </>);
}
