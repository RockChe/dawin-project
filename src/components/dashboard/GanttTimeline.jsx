"use client";
import { useState, useRef } from "react";
import { X, FM, SC, PC, PJC } from "@/lib/theme";
import { pD, fD, computeProgress } from "@/lib/utils";
import MobileGanttList from "./MobileGanttList";

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

export default function GanttTimeline({ tasks, subtasks, fp, fs, fpr, isMobile, timeDim = "月", ganttWidths }) {
  if (isMobile) return <MobileGanttList tasks={tasks} subtasks={subtasks} fp={fp} fs={fs} fpr={fpr} timeDim={timeDim} />;
  const fil = tasks.filter(d => { if (!d.start) return false; if (fp instanceof Set) { if (fp.size > 0 && !fp.has(d.project)) return false; } else if (typeof fp === "string" && fp !== "全部" && d.project !== fp) return false; if (fs !== "全部" && d.status !== fs) return false; if (fpr !== "全部" && d.priority !== fpr) return false; return true; });
  if (!fil.length) return (<div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📅</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No timeline data</div><div style={{ fontSize: 14 }}>Try adjusting filters or adding tasks with dates</div></div>);
  const dates = fil.flatMap(d => [pD(d.start), pD(d.end)]).filter(Boolean);
  const mn = new Date(Math.min(...dates)), mx = new Date(Math.max(...dates)), td = (mx - mn) / 864e5 + 1;
  const months = computeScaleDivisions(mn, mx, td, timeDim);
  const gw = ganttWidths || { day: 20, week: 50, month: 50, quarter: 100 };
  const ganttMinW = timeDim === "日" ? Math.max(700, td * gw.day) : timeDim === "週" ? Math.max(700, Math.ceil(td / 7) * gw.week) : timeDim === "季" ? Math.max(700, months.length * gw.quarter) : Math.max(700, months.length * gw.month);
  const pMap = {}; fil.forEach(d => { if (!pMap[d.project]) pMap[d.project] = []; pMap[d.project].push(d); });
  const pcMap = {}; [...new Set(tasks.map(d => d.project))].forEach((p, i) => { pcMap[p] = PJC[i % PJC.length]; });
  const rows = []; Object.keys(pMap).forEach(proj => {
    rows.push({ type: "h", proj, n: pMap[proj].length });
    pMap[proj].forEach(task => { const s = pD(task.start), e = pD(task.end); const l = ((s - mn) / 864e5) / td * 100, w = Math.max(0.3, ((e - s) / 864e5 + 1) / td * 100);
      const prog = computeProgress(task.id, subtasks);
      rows.push({ type: "t", task: { ...task, progress: task.status === "已完成" ? 100 : prog.pct }, proj, l, w });
    });
  });
  const todayPct = ((new Date() - mn) / 864e5) / td * 100;
  const [hI, setHI] = useState(null); const [leftHidden, setLeftHidden] = useState(false); const lR = useRef(null), rR = useRef(null), sy = useRef(false);
  const ss = (s, t) => { if (sy.current) return; sy.current = true; if (t.current) t.current.scrollTop = s.current.scrollTop; requestAnimationFrame(() => { sy.current = false; }); };
  return (
    <div style={{ border: `1px solid ${X.border}`, borderRadius: 12, overflow: "hidden", background: X.surface }}>
      <div style={{ display: "flex", maxHeight: "calc(100vh - 160px)", overflow: "hidden" }}>
        <div ref={lR} onScroll={() => ss(lR, rR)} className={`dash-gantt-left dash-gantt-left-collapsible${leftHidden ? " dash-gantt-left-hidden" : ""}`} style={{ overflowY: "auto", borderRight: leftHidden ? "none" : `1px solid ${X.border}`, background: X.surfaceLight }}>
          <div style={{ position: "sticky", top: 0, zIndex: 5, height: 48, display: "flex", alignItems: "flex-end", padding: "0 16px 10px", background: X.surfaceLight, borderBottom: `1px solid ${X.border}`, fontSize: 14, color: X.textDim }}>Project / Task</div>
          <div>{rows.map((r, i) => {
            if (r.type === "h") { const c = pcMap[r.proj] || X.accent; return (<div key={i} style={{ height: 44, display: "flex", alignItems: "center", padding: "0 14px", gap: 8, background: `${c}10`, borderTop: i > 0 ? `1px solid ${X.border}` : "none", borderBottom: `1px solid ${c}30` }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: c, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.proj}</span>
              <span style={{ fontFamily: FM, fontSize: 12, color: X.textDim }}>{r.n}</span>
            </div>); }
            const sc = SC[r.task.status] || {}, pc = PC[r.task.priority] || {};
            return (<div key={i} onMouseEnter={() => setHI(i)} onMouseLeave={() => setHI(null)} style={{ height: 56, display: "flex", alignItems: "center", padding: "0 10px 0 26px", gap: 6, background: hI === i ? X.surfaceHover : "transparent", borderBottom: `1px solid ${X.border}22` }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: "hidden" }}><div style={{ fontSize: 14, color: X.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.task.task}</div></div>
              <span style={{ fontSize: 14, padding: "1px 6px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{r.task.status}</span>
            </div>);
          })}</div>
        </div>
        <button onClick={() => setLeftHidden(h => !h)} style={{ width: 20, minWidth: 20, display: "flex", alignItems: "center", justifyContent: "center", background: X.surfaceLight, border: "none", borderRight: `1px solid ${X.border}`, cursor: "pointer", color: X.textDim, fontSize: 12, padding: 0, transition: "background 0.15s" }} title={leftHidden ? "展開面板" : "收合面板"} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = X.surfaceLight}>{leftHidden ? "»" : "«"}</button>
        <div ref={rR} onScroll={() => ss(rR, lR)} style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 5, height: 48, background: X.surfaceLight, borderBottom: `1px solid ${X.border}` }}><div style={{ position: "relative", height: "100%", width: ganttMinW }}>{(() => { const step = timeDim === "日" ? Math.max(1, Math.ceil(40 / (gw.day || 20))) : timeDim === "週" ? 1 : 1; return months.filter((_, i) => i % step === 0); })().map((m, i, arr) => { const np = i < arr.length - 1 ? arr[i + 1].pct : 100; return (<div key={i} style={{ position: "absolute", left: `${m.pct}%`, width: `${np - m.pct}%`, height: "100%", borderLeft: `1px solid ${m.isFirst ? X.borderLight : X.border}`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 0 6px 6px", overflow: "hidden" }}>{m.isFirst && <div style={{ fontFamily: FM, fontSize: 11, color: X.textDim, fontWeight: 600, marginBottom: 2 }}>{m.year}</div>}<div style={{ fontSize: 12, color: X.textSec, fontWeight: 500, whiteSpace: "nowrap" }}>{m.label}</div></div>); })}</div></div>
          <div className="dash-gantt-chart" style={{ position: "relative", width: ganttMinW }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, pointerEvents: "none" }}>
              {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: m.isFirst ? X.borderLight : `${X.border}50` }} />)}
              {todayPct >= 0 && todayPct <= 100 && <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${X.accent}`, zIndex: 2, opacity: 0.7 }}><div style={{ background: X.accent, color: "#fff", fontSize: 10, padding: "2px 5px", borderRadius: 10, fontWeight: 700, marginLeft: 3, display: "inline-block", position: "sticky", top: 2 }}>TODAY</div></div>}
            </div>
            {rows.map((r, i) => {
              if (r.type === "h") { const c = pcMap[r.proj] || X.accent; return (<div key={i} style={{ height: 44, background: `${c}08`, borderTop: i > 0 ? `1px solid ${X.border}` : "none", borderBottom: `1px solid ${c}30` }} />); }
              const bc = pcMap[r.proj], hv = hI === i, dn = r.task.status === "已完成", pp = r.task.status === "提案中" || r.task.status === "待確認";
              return (<div key={i} onMouseEnter={() => setHI(i)} onMouseLeave={() => setHI(null)} style={{ position: "relative", height: 56, background: hv ? X.surfaceHover : "transparent", zIndex: 1, borderBottom: `1px solid ${X.border}22` }}>
                <div style={{ position: "absolute", left: `${r.l}%`, width: `${r.w}%`, top: 18, height: 20, borderRadius: 10, background: pp ? `repeating-linear-gradient(135deg,${bc}28,${bc}28 4px,${bc}15 4px,${bc}15 8px)` : `${bc}30`, border: `1px solid ${bc}40`, minWidth: 6 }} />
                {r.task.progress > 0 && <div style={{ position: "absolute", left: `${r.l}%`, width: `${r.w * r.task.progress / 100}%`, top: 18, height: 20, borderRadius: 10, background: bc, opacity: dn ? 0.55 : 0.85, minWidth: 4 }} />}
                {r.task.progress > 0 && r.task.progress < 100 && r.w > 3 && <div style={{ position: "absolute", left: `${r.l + r.w * r.task.progress / 100 + 0.4}%`, top: 21, fontSize: 14, fontFamily: FM, color: bc, fontWeight: 600 }}>{r.task.progress}%</div>}
                {dn && r.w > 3 && <div style={{ position: "absolute", left: `${r.l + r.w / 2}%`, top: 21, fontSize: 14, fontFamily: FM, color: X.green, fontWeight: 700, transform: "translateX(-50%)" }}>100%</div>}
                {hv && <div style={{ position: "absolute", left: `${Math.min(Math.max(r.l, 2), 65)}%`, bottom: 40, background: X.surfaceLight, color: X.text, fontSize: 14, padding: "6px 12px", borderRadius: 8, whiteSpace: "nowrap", maxWidth: "90vw", overflow: "hidden", textOverflow: "ellipsis", zIndex: 30, boxShadow: `0 4px 16px ${X.shadowHeavy}`, border: `1px solid ${X.border}` }}>{fD(r.task.start)} → {fD(r.task.end)}　{r.task.duration}d　{r.task.progress}%</div>}
              </div>);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
