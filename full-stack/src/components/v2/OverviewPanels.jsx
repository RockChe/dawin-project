"use client";
import { useState } from "react";
import { WX, WX_ORDER, STATUS_VAR, urgency, taskGap, donutArcs } from "@/lib/v2Data";
import { daysLeft } from "@/lib/myTasks";
import Cloud from "./Cloud";
import { Seg, Slot, StatusCloud, OwnerPills } from "./common";

const URG_CLS = { dark: "c-red", pink: "c-pink", white: "c-sec", nimbus: "c-green" };
const GAP_CLS = { behind: "c-amber", ahead: "c-green" };
// 雲不畫時的色點：跟急迫度（烏雲＝紅、粉紅雲＝粉紅、白雲＝主色）
const URG_FB = { dark: "red", pink: "pink", white: "accent", nimbus: "green" };

// 即將到期：未來 N 天（upcomingDays）最多 M 件（upcomingLimit），跟著跨專案篩選走。
export function Upcoming({ result, days, limit, today, owners, onOpenTask }) {
  const { list, total, soon } = result;
  return (
    <section className="blk" aria-labelledby="h-up">
      <div className="hd2 tight">
        <h3 className="ttl" id="h-up"><span className="tbar" style={{ "--c": "var(--pink)" }} />Upcoming Deadlines</h3>
        {soon > 0 && <span className="hint c-pink strong">{soon} 件在 7 天內</span>}
      </div>
      {list.length ? <>
        {list.map((t) => {
          const u = urgency(t, today), gi = taskGap(t, today), d = daysLeft(t.end, today);
          return (
            <button key={t.id} type="button" className="lrow lbtn" onClick={() => onOpenTask?.(t)}>
              <Slot size={34}><Cloud kind={u} size={30} deco fb="dot" fc={URG_FB[u]} /></Slot>
              <div className="m">
                <div className="n">{t.task}</div>
                <div className="s">{t.project} · <OwnerPills value={t.owner} owners={owners} />
                  {GAP_CLS[gi.kind] && <span className={`gapx ${GAP_CLS[gi.kind]}`} title={gi.tip}><span aria-hidden="true"> · </span>{gi.text}<small>{gi.sub}</small></span>}
                </div>
              </div>
              <div className="due"><b className={URG_CLS[u]}>{d}d</b><span>{t.end.replace(/-/g, "/")}</span></div>
            </button>
          );
        })}
        <div className="hint foot">未來 {days} 天內，最多顯示 {limit} 件（共 {total} 件）· 可在 Settings 調整</div>
      </> : (
        <div className="empty">
          <Cloud kind="nimbus" size={64} />
          <b>接下來 {days} 天沒有到期的任務</b>沒有符合篩選的到期項目
        </div>
      )}
    </section>
  );
}
const legRow = (sq, icon, label, n, pct) => (
  <li key={label}><span className="sqc" style={{ background: `var(--${sq})` }} />{icon}<span className="ln">{label}</span><b className="mono">{n}</b><span className="mono sec small">({pct}%)</span></li>
);

function Donut({ counts }) {
  const arcs = donutArcs(counts), total = arcs.reduce((a, x) => a + x.n, 0);
  return (
    <div className="donutw">
      <div className="dchart">
        <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={`狀態分布：${arcs.map((a) => `${a.s} ${a.n}`).join("、")}`}>
          {arcs.map((a) => <path key={a.s} d={a.d} style={{ fill: `var(--${STATUS_VAR[a.s][0]})` }} opacity=".9" />)}
        </svg>
        <div className="dc"><Cloud kind="white" size={56} deco /><span><b className="mono big">{total}</b> <span className="sec">Total</span></span></div>
      </div>
      <ul className="lgl" aria-label="狀態圖例">
        {arcs.map((a) => legRow(STATUS_VAR[a.s][0], <StatusCloud status={a.s} size={24} fb={null} />, a.s, a.n, a.pct))}
      </ul>
    </div>
  );
}

const MiniBar = ({ m }) => (
  <span className={`msg s-${m.state}`} role="img" aria-label={`進度 ${m.prog}%`}>
    {Array.from({ length: 10 }, (_, i) => { const p = Math.max(0, Math.min(10, m.prog - i * 10)); return <i key={i}>{p > 0 && <b style={{ width: `${p * 10}%` }} />}</i>; })}
  </span>
);

function Weather({ rows, counts, onOpenProject }) {
  const live = rows.filter((r) => !r.archived), tot = live.length;
  return (<>
    <ul className="lgl wide" aria-label="專案狀況圖例">
      {WX_ORDER.map((k) => legRow(WX[k].sq, <Slot size={28}><Cloud kind={WX[k].cloud} size={28} deco /></Slot>, WX[k].label, counts[k], tot ? Math.round((counts[k] / tot) * 100) : 0))}
    </ul>
    <div className="wlist">
      {live.map((m) => (
        <button key={m.id} type="button" className="lrow wrow" onClick={() => onOpenProject?.(m.id)}>
          <span className="tbar" style={{ "--c": `var(--${m.color})` }} title="專案色" />
          <Slot size={34}><Cloud kind={WX[m.key].cloud} size={32} deco fb="dot" title={WX[m.key].label} /></Slot>
          <div className="m"><div className="n">{m.name}</div><div className="s" title={m.reason}>{m.reason}</div></div>
          <span className="wl"><i className="sqc" style={{ background: `var(--${WX[m.key].sq})` }} />{WX[m.key].label}</span>
          <MiniBar m={m} />
          <span className="mono sec small pct">{m.prog}%</span>
        </button>
      ))}
    </div>
  </>);
}

// 狀態分布（甜甜圈）／專案狀況：右上切換，預設「狀態」。
export function StatusPanel({ counts, rows, wxCounts, onOpenProject }) {
  const [view, setView] = useState("status");
  const title = view === "status" ? "Status Distribution" : "專案狀況";
  return (
    <section className="blk" aria-labelledby="h-st">
      <div className="hd2 tight">
        <h3 className="ttl" id="h-st"><span className="tbar" style={{ "--c": "var(--accent)" }} />{title}</h3>
        <Seg items={[["status", "狀態"], ["weather", "專案狀況"]]} value={view} onChange={setView} label="狀態分布檢視" />
      </div>
      {view === "status" ? <Donut counts={counts} /> : <Weather rows={rows} counts={wxCounts} onOpenProject={onOpenProject} />}
    </section>
  );
}
