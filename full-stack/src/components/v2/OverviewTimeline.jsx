"use client";
import { useMemo } from "react";
import { timeAxis } from "@/lib/v2Axis";
import { formatShortDate } from "@/lib/formatShortDate";
import Cloud from "./Cloud";
import SegBar from "./SegBar";
import { Seg, Slot } from "./common";

const GAP_CLS = { behind: "c-amber", ahead: "c-green", done: "c-green", prop: "c-pink" };
const SCALES = [["日", "日"], ["週", "週"], ["月", "月"], ["季", "季"]];

// Overview 的 Project Timeline：與 Timeline 同一套分段條的縮小版（左：專案狀況雲＋名稱，中：條，右：進度＋對時間）。
export default function OverviewTimeline({ rows, today, scale, onScale, onOpenProject }) {
  const ax = useMemo(() => timeAxis(scale, today), [scale, today]);
  return (
    <section className="blk tlx" aria-labelledby="h-tl">
      <div className="hd2">
        <h3 className="ttl" id="h-tl"><span className="tbar" />Project Timeline</h3>
        <Seg items={SCALES} value={scale} onChange={onScale} label="時間尺度" />
      </div>
      <div className="scroll">
        <div className="chart c">
          <div className="hd">
            <div className="hc l">專案</div>
            <div className="ht"><div className="in">
              <div className="r1">{ax.groups.map((g) => <span key={g.p + g.l} className={g.y ? "yr" : ""} style={{ left: `${g.p}%` }}>{g.l}</span>)}</div>
              <div className="r2">{ax.ticks.map((t) => <span key={t.p} className={t.strong ? "yl" : ""} style={{ left: `${t.p}%` }}>{t.l}</span>)}</div>
              <div className="r3"><span className="tf" style={{ left: `${ax.todayP}%` }}>今天 {formatShortDate(today, today)}</span></div>
            </div></div>
            <div className="hc rc s"><span>進度</span><span>對時間</span></div>
          </div>
          <div className="body" role="list" aria-label="專案時程">
            <div className="hov"><div className="in">
              {ax.lines.map((l) => <i key={l.p} className={`gl${l.strong ? " yl" : ""}`} style={{ left: `${l.p}%` }} />)}
              <i className="today" style={{ left: `${ax.todayP}%` }} />
            </div></div>
            {rows.map((m) => {
              const gi = m.gapInfo;
              return (
                <div key={m.id} className={`row pj s-${m.state}`} role="listitem">
                  <i className="swl" style={{ background: `var(--${m.color})` }} title="專案色" />
                  <div className="lc">
                    <Slot size={30}><Cloud kind={m.cloud} size={28} deco fb="dot" title={m.label} /></Slot>
                    <span className="nm"><span className="l1">
                      <button type="button" className="nb" title={m.name} onClick={() => onOpenProject?.(m.id)}>{m.name}</button>
                      {m.od > 0 && <span className="pill-od">{m.od} 逾期</span>}
                      {m.archived && <span className="hint">（已封存）</span>}
                      <span className="sr">（{m.label}）</span>
                    </span></span>
                  </div>
                  <div className="tr"><div className="in"><SegBar row={m} ax={ax} today={today} ends /></div></div>
                  <div className="rc s">
                    <b>{m.prog}%</b>
                    <span className={`hgap ${GAP_CLS[gi.kind] || "c-sec"}`} title={gi.tip}>{gi.text}{gi.sub && <small>{gi.sub}</small>}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="ovh">每格＝該專案工期的 10%；黑色細線＝今天應有進度；斜線＝落後差距。「落後約 N 天」＝進度比今天應有的少約 N 天的工作量（括號內為百分點）。</p>
    </section>
  );
}
