"use client";
import { useState, useMemo, memo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD, toBusinessDateString } from "@/lib/utils";
import GanttTimeline, { TimeScaleToggle, computeScaleDivisions } from "../GanttTimeline";
import MobileProjectTimeline from "../MobileProjectTimeline";
import OwnerTags from "../OwnerTags";
import { orderProjBars } from "@/lib/personalSettings";

/**
 * Percent-of-timeline position of "today", quantized to the Asia/Taipei
 * calendar day. TODAY is a day marker, not a this-instant marker: calling
 * `new Date()` directly makes server render and client hydration compute
 * different millisecond values → hydration mismatch. Vercel's server also
 * runs in UTC, so an un-quantized "today" disagrees with the user's Taipei
 * "today" before 08:00 local time.
 * @param {Date} mn — timeline start date
 * @param {number} td — timeline span in days
 * @returns {number}
 */
export function computeTodayPct(mn, td) {
  return ((pD(toBusinessDateString()) - mn) / 864e5) / td * 100;
}

function OverviewTab({ filtered, twp, allS, isMobile, pcMap, ganttWidths, projBanners, stats, upcomingDays = 30, upcomingLimit = 5, configOwners = [], projects, timeDim = "月", onTimeDimChange }) {
  const { X, SC } = useTheme();
  const [ovHover, setOvHover] = useState(null);

  const projBarsData = useMemo(() => {
    const barsMap = {};
    twp.forEach(d => {
      // projBars: accumulate date ranges and progress per project (from twp)
      if (!barsMap[d.project]) barsMap[d.project] = { dates: [], progressSum: 0, count: 0 };
      barsMap[d.project].progressSum += d.progress;
      barsMap[d.project].count++;
      if (d.start && d.end) {
        barsMap[d.project].dates.push(pD(d.start), pD(d.end));
      }
    });
    const bars = Object.entries(barsMap).map(([pn, info]) => {
      if (!info.dates.length) return null;
      const s = new Date(Math.min(...info.dates)), e = new Date(Math.max(...info.dates));
      const avg = Math.round(info.progressSum / info.count);
      return { name: pn, start: s, end: e, avg };
    }).filter(Boolean);
    // 順序跟 Projects 分頁一致（原本是 twp 裡專案的首次出現順序，純屬巧合）
    return orderProjBars(bars, projects);
  }, [twp, projects]);

  const pieData = useMemo(() => {
    const entries = Object.entries(SC).map(([k, c]) => ({ label: k, count: stats[k] || 0, color: c.color }));
    const total = entries.reduce((s, e) => s + e.count, 0);
    if (!total) return null;
    const cx = 100, cy = 100, R = 90, r = 58; let ca = -Math.PI / 2; const g = 0.04;
    const arcs = entries.filter(e => e.count > 0).map(e => { const a = (e.count / total) * Math.PI * 2 - g, sa = ca + g / 2; ca += a + g; const ea = sa + a, la = a > Math.PI ? 1 : 0;
      const d = `M${cx+R*Math.cos(sa)},${cy+R*Math.sin(sa)} A${R},${R} 0 ${la} 1 ${cx+R*Math.cos(ea)},${cy+R*Math.sin(ea)} L${cx+r*Math.cos(ea)},${cy+r*Math.sin(ea)} A${r},${r} 0 ${la} 0 ${cx+r*Math.cos(sa)},${cy+r*Math.sin(sa)} Z`;
      return { ...e, d, pct: Math.round(e.count / total * 100) }; });
    return { arcs, total };
  }, [SC, stats]);

  return (<>
    {/* Project Timeline */}
    <div style={{ background: X.surface, borderRadius: 12, padding: isMobile ? 14 : 20, border: `1px solid ${X.border}`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 16px", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.accent, borderRadius: 2 }} />Project Timeline</h3>
        <TimeScaleToggle value={timeDim} onChange={onTimeDimChange} />
      </div>
      {(() => {
        const projBars = projBarsData.map(p => ({ ...p, color: pcMap[p.name] || X.accent }));
        if (isMobile) return <MobileProjectTimeline projBars={projBars} />;
        if (!projBars.length) return (<div style={{ padding: 40, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📅</div><div style={{ fontSize: 14 }}>No timeline data available</div></div>);
        const allDates = projBars.flatMap(p => [p.start, p.end]);
        const mn = new Date(Math.min(...allDates)), mx = new Date(Math.max(...allDates));
        const td = (mx - mn) / 864e5 + 1;
        const todayPct = computeTodayPct(mn, td);
        const months = computeScaleDivisions(mn, mx, td, timeDim);
        const ovGW = ganttWidths || { day: 20, week: 50, month: 50, quarter: 100 };
        const ovMinW = timeDim === "日" ? Math.max(700, td * ovGW.day) : timeDim === "週" ? Math.max(700, Math.ceil(td / 7) * ovGW.week) : timeDim === "季" ? Math.max(700, months.length * ovGW.quarter) : Math.max(700, months.length * ovGW.month);
        return (<div style={ovMinW > 0 ? { overflowX: "auto" } : {}}>
        <div>
          {/* gap must match the bar rows below, or the month labels sit 8px left of
              the gridlines they name. */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <div className="dash-tl-label" />
            <div style={{ width: ovMinW, position: "relative", height: 20, flexShrink: 0 }}>
              {(() => { const step = timeDim === "日" ? Math.max(1, Math.ceil(40 / (ovGW.day || 20))) : timeDim === "週" ? 2 : 1; return months.filter((_, i) => i % step === 0); })().map((m, i) => (<div key={i} style={{ position: "absolute", left: `${m.pct}%`, fontSize: 11, color: X.textDim, whiteSpace: "nowrap" }}>{m.isFirst ? `${m.year} ` : ""}{m.label}</div>))}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            {projBars.map((p, i) => {
              const l = ((p.start - mn) / 864e5) / td * 100;
              const w = Math.max(1, ((p.end - p.start) / 864e5 + 1) / td * 100);
              const fmtD = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
              return (<div key={p.name} style={{ display: "flex", alignItems: "center", height: 32, gap: 8, position: "relative" }}>
                <div className="dash-tl-label" style={{ fontSize: 14, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", paddingRight: 8, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />{p.name}
                </div>
                <div style={{ width: ovMinW, position: "relative", height: 18, flexShrink: 0 }}>
                  {months.map((m, mi) => (<div key={mi} style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: X.borderLight }} />))}
                  <div onMouseEnter={() => setOvHover(i)} onMouseLeave={() => setOvHover(null)} style={{ position: "absolute", left: `${l}%`, width: `${w}%`, height: "100%", borderRadius: 4, background: `${p.color}35`, border: `1px solid ${p.color}45`, minWidth: 6, cursor: "pointer", zIndex: 1 }} />
                  <div style={{ position: "absolute", left: `${l}%`, width: `${w * p.avg / 100}%`, height: "100%", borderRadius: 4, background: p.color, opacity: p.avg === 100 ? 0.55 : 0.85, minWidth: p.avg > 0 ? 4 : 0, pointerEvents: "none" }} />
                  {w > 5 && <div style={{ position: "absolute", left: `${l + w + 0.5}%`, top: 2, fontSize: 14, fontFamily: FM, color: p.avg === 100 ? X.green : p.color, fontWeight: 600, pointerEvents: "none" }}>{p.avg}%</div>}
                  {ovHover === i && <div style={{ position: "absolute", left: `${l}%`, bottom: 20, background: X.surface, color: X.text, fontSize: 13, padding: "6px 12px", borderRadius: 8, whiteSpace: "nowrap", zIndex: 30, boxShadow: `0 4px 16px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, pointerEvents: "none" }}>{fmtD(p.start)} → {fmtD(p.end)}　Progress: {p.avg}%</div>}
                </div>
              </div>);
            })}
            {/* Mirror the bar-row layout (label column + ovMinW track) so todayPct is a
                % of the same track the month gridlines use. A fixed-px offset plus
                right:0 measures the visible container instead, so the line drifts as
                soon as the chart scrolls — and the hardcoded label width was wrong at
                the ≤860 / ≤560 breakpoints (80px / 60px) regardless. */}
            {todayPct >= 0 && todayPct <= 100 && <div style={{ position: "absolute", inset: 0, display: "flex", gap: 8, pointerEvents: "none" }}><div className="dash-tl-label" /><div style={{ width: ovMinW, position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${X.accent}`, opacity: 0.5 }} /></div></div>}
          </div>
        </div></div>);
      })()}
    </div>

    {/* Upcoming + Status */}
    <div className="dash-grid-2col">
      {(() => {
        const now = new Date(); const inDays = new Date(now.getTime() + upcomingDays * 864e5);
        const upcoming = filtered.filter(t => { if (!t.end || t.status === "已完成") return false; const ed = pD(t.end); return ed >= now && ed <= inDays; }).sort((a, b) => pD(a.end) - pD(b.end)).slice(0, upcomingLimit);
        return (<div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.red, borderRadius: 2 }} />Upcoming Deadlines</h3>
          {upcoming.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: X.textDim, fontSize: 14 }}>No upcoming deadlines in next {upcomingDays} days</div>)
          : upcoming.map(t => { const ed = pD(t.end); const days = Math.ceil((ed - now) / 864e5); const urgent = days <= 7;
            return (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${X.border}22` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dash-name-1line" style={{ fontSize: 14, fontWeight: 500 }}>{t.task}</div>
                <div style={{ fontSize: 12, color: X.textSec, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>{t.project} · <OwnerTags value={t.owner} configOwners={configOwners} /></div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FM, color: urgent ? X.red : X.amber }}>{days}d</div>
                <div style={{ fontSize: 11, color: X.textSec, fontFamily: FM }}>{fD(t.end)}</div>
              </div>
            </div>); })}
        </div>);
      })()}
      <div style={{ background: X.surface, borderRadius: 12, padding: 16, border: `1px solid ${X.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Status Distribution</h3>
        {pieData && (<div className="dash-chart-wrap">
            <div className="dash-chart-svg" style={{ position: "relative" }}>
              <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>{pieData.arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity={0.85} />)}</svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                <div style={{ fontFamily: FM, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{pieData.total}</div>
                <div style={{ fontSize: 14, color: X.textDim, marginTop: 2 }}>Total</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pieData.arcs.map((a, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, opacity: 0.85 }} />
                <span style={{ fontSize: 14, color: X.textSec, minWidth: 42 }}>{a.label}</span>
                <span style={{ fontFamily: FM, fontSize: 12, fontWeight: 600 }}>{a.count}</span>
                <span style={{ fontFamily: FM, fontSize: 12, color: X.textDim }}>({a.pct}%)</span>
              </div>))}
            </div>
          </div>)}
      </div>
    </div>
  </>);
}

export default memo(OverviewTab);
