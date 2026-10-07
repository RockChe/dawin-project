"use client";
import { useLayoutEffect, useRef } from "react";
import { useCloudLevel } from "@/components/CloudLevelContext";
import { centerScroll } from "@/lib/v2Timeline";
import { formatShortDate } from "@/lib/formatShortDate";
import Cloud from "./Cloud";
import SegBar from "./SegBar";
import { Slot, StatusCloud, StatusTag } from "./common";

export const GAP_CLS = { behind: "c-amber", ahead: "c-green", done: "c-green", prop: "c-pink" };
// 軌道兩側留給條端日期標籤的內縮（px）：與 v2.css 的 .chart.f 的 --g／--gr 同值（左 72＋右 104）
const INSET = 176;
const COLS = ["進度", "到期", "對時間", "狀態"];

// 右欄「狀態」：任務＝逾期 N 天（紅字）或狀態標籤；專案＝逾期烏雲＋逾期 N 天或專案狀態標籤。
function StatusCell({ m, full }) {
  if (m.od) {
    const days = m.odDays;
    return (
      <span className="od">
        {m.kind === "p" && (full ? <Cloud kind="dark" size={18} deco /> : <span className="fbt" aria-hidden="true">●</span>)}
        逾期 {days} 天
      </span>
    );
  }
  return <StatusTag status={m.status} />;
}

function Row({ m, ax, today, full, collapsed, selected, dim, onToggle, onSelect }) {
  const p = m.kind === "p", gi = m.gapInfo;
  const select = () => onSelect?.(m.projectId, m);
  return (
    <div className={`row ${p ? "pj" : "tk"} s-${m.state}${dim ? " dim" : ""}`} role="listitem" tabIndex={0}
      aria-current={selected ? "true" : undefined} onClick={select}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(); } }}>
      {p ? (
        <div className="lc">
          <i className="swl" style={{ background: `var(--${m.color})` }} title="專案色" />
          {onToggle && (
            <button type="button" className="tg" aria-expanded={!collapsed} aria-label={`${collapsed ? "展開" : "收折"}「${m.name}」的任務`}
              onClick={(e) => { e.stopPropagation(); onToggle(m.id); }}><i /></button>
          )}
          <Slot size={30}><Cloud kind={m.cloud} size={28} deco fb="dot" title={m.label} /></Slot>
          <span className="nm">
            <span className="l1">
              <b title={m.name}>{m.name}</b>
              {m.od > 0 && <span className="pill-od">{m.od} 逾期</span>}
              <span className="sr">（{m.label}）</span>
            </span>
            <span className="dt">{m.n} 項任務</span>
          </span>
        </div>
      ) : (
        <div className="lc">
          <StatusCloud status={m.status} size={24} overdue={m.od} />
          <span className="nm"><span className="l1"><b title={m.name}>{m.name}</b></span></span>
        </div>
      )}
      <div className="tr"><div className="in"><SegBar row={m} ax={ax} today={today} ends badge /></div></div>
      <div className="rc f">
        <b>{m.prog}%</b>
        <span className="dd">{formatShortDate(m.e, today)}</span>
        <span className={`hgap ${GAP_CLS[gi.kind] || "c-sec"}`} title={gi.tip}>{gi.text}{gi.sub && <small>{gi.sub}</small>}</span>
        <StatusCell m={m} full={full} />
      </div>
    </div>
  );
}

/**
 * 甘特圖（Timeline 與專案詳情共用）：表頭（年／月刻度、今天標籤）、格線與今天線、一列一條。
 * rows＝專案列（kind:'p'）與任務列（kind:'t'）的扁平陣列（見 lib/v2Timeline）；專案詳情只傳任務列即可。
 * ax＝timeAxis；inner＝軌道內寬（px，lib/v2Timeline.trackPx；實際寬度至少這麼寬，更寬時由外層捲動）；scrollKey 變了就把「今天」重新捲到中央。
 * leftTitle＝左欄表頭（專案詳情用「任務」）；onSelect(projectId, 該列) 點列時呼叫。
 * 左欄（名稱）與右欄（進度・到期・對時間・狀態）固定寬、sticky，軌道才會捲動。
 */
export default function GanttChart({ rows, ax, today, inner, scrollKey, collapsed = [], selectedId, hl, onToggle, onSelect, leftTitle = "專案" }) {
  const full = useCloudLevel() === "full";
  const ref = useRef(null);
  useLayoutEffect(() => {
    const sc = ref.current, t = sc?.querySelector(".hov .today");
    if (!t) return;
    const x = t.getBoundingClientRect().left - sc.getBoundingClientRect().left + sc.scrollLeft;
    sc.scrollLeft = centerScroll({ todayX: x, clientW: sc.clientWidth, leftW: sc.querySelector(".hd .hc.l")?.offsetWidth || 0, rightW: sc.querySelector(".hd .hc.rc")?.offsetWidth || 0, scrollW: sc.scrollWidth });
  }, [scrollKey, inner]);
  const closed = new Set(collapsed);
  return (
    <div className="scroll" ref={ref}>
      <div className="chart f" style={{ "--tw": `${inner + INSET}px` }}>
        <div className="hd">
          <div className="hc l">{leftTitle}</div>
          <div className="ht"><div className="in">
            <div className="r1">{ax.groups.map((g) => <span key={g.p + g.l} className={g.y ? "yr" : ""} style={{ left: `${g.p}%` }}>{g.l}</span>)}</div>
            <div className="r2">{ax.ticks.map((t) => <span key={t.p} className={t.strong ? "yl" : ""} style={{ left: `${t.p}%` }}>{t.l}</span>)}</div>
            <div className="r3"><span className="tf" style={{ left: `${ax.todayP}%` }}>今天 {formatShortDate(today, today)}</span></div>
          </div></div>
          <div className="hc rc f">{COLS.map((c) => <span key={c}>{c}</span>)}</div>
        </div>
        <div className="body" role="list" aria-label="專案時程">
          <div className="hov"><div className="in">
            {ax.lines.map((l) => <i key={l.p} className={`gl${l.strong ? " yl" : ""}`} style={{ left: `${l.p}%` }} />)}
            <i className="today" style={{ left: `${ax.todayP}%` }} />
          </div></div>
          {rows.map((m) => (
            <Row key={`${m.kind}-${m.id}`} m={m} ax={ax} today={today} full={full} collapsed={closed.has(m.id)}
              selected={m.kind === "p" && selectedId === m.id} dim={!!hl && (m.kind === "p" ? m.key : m.pkey) !== hl}
              onToggle={m.kind === "p" ? onToggle : undefined} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
