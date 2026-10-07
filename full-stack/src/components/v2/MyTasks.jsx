"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus } from "@/lib/statusFilter";
import { groupMyTasks, myTaskKpis, daysLeft, roleBadge } from "@/lib/myTasks";
import { STATUS_VAR, PROJECT_COLORS } from "@/lib/v2Data";
import { filterBySearch } from "@/lib/v2Search";
import Cloud from "./Cloud";
import { StatusTag } from "./common";

// 分組：[key, 標題, 雲, 色條（雲不畫時）, 文字色]
const SECTIONS = [
  ["overdue", "逾期", "dark", "red", "c-red"],
  ["soon", "7 天內", "pink", "pink", "c-pink"],
  ["later", "之後", "purple", "purple", "c-purple"],
  ["done", "已完成", "nimbus", "green", "c-green"],
];

// My Tasks：登入者名下未完成任務（唯讀清單）。分組／KPI／身分徽章沿用 lib/myTasks；狀態多選沿用 lib/statusFilter。
// focus={group, n}：從 Overview 播報列跳來——清掉／預選篩選，再捲到對應分組並聚焦（n 變了才重觸發）。
// onOpenTask：點任務開啟任務視窗（沒給就是 no-op）。
// searchQ／onClearSearch：頁首搜尋字串只過濾清單（KPI 仍是全部）；空狀態的「清除篩選」連搜尋一起清。
export default function MyTasks({ twp, projects, userName, today, focus, onOpenTask, searchQ = "", onClearSearch }) {
  const [sel, setSel] = useState([]); // 狀態多選，[] = 不篩；不持久化（同舊版）
  const [scrollTo, setScrollTo] = useState(null);
  const root = useRef(null);
  const groups = useMemo(() => groupMyTasks(filterBySearch(twp, searchQ), userName, today, sel), [twp, searchQ, userName, today, sel]);
  const kpis = useMemo(() => myTaskKpis(twp, userName, today), [twp, userName, today]);
  const colorOf = useMemo(() => new Map(projects.map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]])), [projects]);
  const total = SECTIONS.reduce((n, [k]) => n + (groups[k]?.length || 0), 0);

  useEffect(() => {
    if (!focus) return;
    setSel(focus.group === "done" ? ["已完成"] : []);
    setScrollTo(focus.group);
  }, [focus]);
  useEffect(() => {
    if (!scrollTo) return;
    const el = root.current?.querySelector(`.mgrp[data-g="${scrollTo}"]`);
    if (el) { el.tabIndex = -1; el.focus({ preventScroll: true }); el.scrollIntoView?.({ block: "start" }); }
    setScrollTo(null);
  }, [scrollTo, sel]);

  const cards = [["已逾期", kpis.overdue, "dark", "c-red", "red"], ["7 天內到期", kpis.soon, "pink", "c-pink", "pink"], ["進行中", kpis.inProgress, "white", "", "accent"], ["本月已完成", kpis.doneThisMonth, "nimbus", "c-green", "green"]];
  return (
    <div ref={root}>
      <div className="kpis">
        {cards.map(([l, n, c, tc]) => (
          <div key={l} className="card kpi">
            <div><div className={`kpi-n mono ${tc}`}>{n}</div><small>{l}</small></div>
            <Cloud kind={c} size={44} deco />
          </div>
        ))}
      </div>

      <div className="mfbar" role="group" aria-label="狀態篩選（可複選）">
        <span className="lab">狀態</span>
        {STATUS_FILTERS.map((s) => {
          const on = s === "全部" ? sel.length === 0 : sel.includes(s), v = STATUS_VAR[s];
          return <button key={s} type="button" className={s === "全部" ? `chip${on ? " on" : ""}` : "chip sc"} style={v ? { "--c": `var(--${v[0]})`, "--tc": `var(--${v[1]})` } : undefined} aria-pressed={on} onClick={() => setSel((x) => toggleStatus(x, s))}>{s}</button>;
        })}
        <span className="hint" style={{ marginLeft: 8 }}>{userName} 名下 · 選「已完成」會多出「已完成」分組</span>
      </div>

      {total === 0 && (sel.length || searchQ ? (
        <div className="empty dashed">
          <Cloud kind="purple" size={96} />
          <b>沒有符合篩選的任務</b>換個條件試試
          <div style={{ marginTop: 12 }}><button type="button" className="btn ghost sm" onClick={() => { setSel([]); onClearSearch?.(); }}>清除篩選</button></div>
        </div>
      ) : (
        <div className="empty dashed">
          <Cloud kind="nimbus" size={96} />
          <b>沒有指派給你的任務</b>今天可以喘口氣了
        </div>
      ))}

      {SECTIONS.map(([k, label, cloud, bar, tc]) => groups[k]?.length > 0 && (
        <section key={k} className="mgrp" aria-label={label} data-g={k}>
          <h3><Cloud kind={cloud} size={24} deco fb="bar" fc={bar} /><span className={tc}>{label}</span><span className="cnt">{groups[k].length}</span></h3>
          {groups[k].map((t) => {
            const d = daysLeft(t.end, today), badge = roleBadge(t, userName);
            return (
              <button key={t.id} type="button" className="trw" onClick={() => onOpenTask?.(t)}>
                <span className="pdot" style={{ "--c": `var(--${colorOf.get(t.projectId) || "accent"})` }} />
                <div className="m"><div className="n">{t.task}{badge && <span className="badge">{badge}</span>}</div><div className="s">{t.project}</div></div>
                <StatusTag status={t.status} />
                <div className="mini" title={`${t.progress}%`}>
                  <div className="bar" role="progressbar" aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${t.progress}%` }} /></div>
                </div>
                <div className="due"><b className={tc}>{d === null ? "—" : `${d}d`}</b><span>{t.end ? t.end.replace(/-/g, "/") : ""}</span></div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
