"use client";
import { useMemo, useState } from "react";
import { formatShortDate } from "@/lib/formatShortDate";
import { groupLanes, laneInfo, ownerInitials } from "@/lib/v2Timeline";
import { ownerClass } from "@/lib/v2Data";
import Cloud from "./Cloud";
import { Slot } from "./common";

const GAP_CLS = { behind: "c-amber", ahead: "c-green", done: "c-green", prop: "c-pink" };

function Ring({ pct }) {
  const r = 21, c = 2 * Math.PI * r;
  return (
    <span className="pring" role="img" aria-label={`進度 ${pct}%`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="bgc" cx="26" cy="26" r={r} />
        {pct > 0 && <circle className="fgc" cx="26" cy="26" r={r} strokeDasharray={`${((c * pct) / 100).toFixed(1)} ${c.toFixed(1)}`} />}
      </svg>
      <b>{pct}%</b>
    </span>
  );
}

function Avatars({ names, owners, max = 3 }) {
  return (
    <span className="havs">
      {names.slice(0, max).map((n) => <i key={n} className={`hav ${ownerClass(n, owners)}`} title={n}>{ownerInitials(n)}</i>)}
      {names.length > max && <i className="hav more" title={names.slice(max).join("、")}>+{names.length - max}</i>}
    </span>
  );
}

function milestone(m, today) {
  if (m.odCount > 0) return `逾期：${m.odName} · ${formatShortDate(m.odEnd, today)}（${m.odDays} 天）`;
  if (m.ms) return `下個里程碑：${m.ms.name} · ${formatShortDate(m.ms.end, today)}（${m.ms.days === 0 ? "今天" : `${m.ms.days} 天後`}）`;
  return "沒有待辦里程碑";
}

function Card({ m, today, owners, expanded, dim, selected, onSelect, onOpenProject }) {
  const gi = m.gapInfo, rng = `${formatShortDate(m.s, today)} → ${formatShortDate(m.e, today)}`;
  return (
    <article className={`cd s-${m.state}${dim ? " dim" : ""}`} tabIndex={0} aria-current={selected ? "true" : undefined} onClick={() => onSelect?.(m.id)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect?.(m.id); } }}>
      <i className="swl" style={{ background: `var(--${m.color})` }} title="專案色" />
      <div className="t1">
        <Slot size={52}><Cloud kind={m.cloud} size={48} deco fb="dot" title={m.label} /></Slot>
        <div className="nm"><b>{m.name}</b><span className="dt">{rng}</span><span className="sr">（{m.label}）</span></div>
      </div>
      <p className="ms">{milestone(m, today)}</p>
      <div className="vz">
        <Ring pct={m.prog} />
        <div className="tvb">
          <span>時間</span><span className="mb t"><i style={{ width: `${m.el}%` }} /></span><span className="v">{m.el}%</span>
          <span>進度</span><span className="mb p"><i style={{ width: `${m.prog}%` }} /></span><span className="v">{m.prog}%</span>
        </div>
      </div>
      <div className="ft">
        <Avatars names={m.owners} owners={owners} />
        <span className={`gx ${GAP_CLS[gi.kind] || "c-sec"}`} title={gi.tip}>{gi.text}{gi.sub && <small>{gi.sub}</small>}</span>
      </div>
      <div><button type="button" className="op" onClick={(e) => { e.stopPropagation(); onOpenProject?.(m.id); }}>開啟專案 ›</button></div>
      {expanded && (
        <ul className="tl">
          {m.taskRows.filter((t) => !t.done).map((t) => <li key={t.id}>{t.name}{" "}<span className="mono">{formatShortDate(t.e, today)}</span></li>)}
        </ul>
      )}
    </article>
  );
}

/**
 * 卡片視圖：已逾期（預設收合）／這週／本月／下月／之後。list＝timelineProjects 的 list（與甘特共用篩選與排序）；
 * collapsed＝逐專案收折（與甘特共用）：沒收折的卡片多列出未完成任務。
 */
export default function TimelineBoard({ list, today, owners, collapsed, hl, selectedId, onSelect, onOpenProject }) {
  const [overOpen, setOverOpen] = useState(false);
  const lanes = useMemo(() => {
    const g = Object.fromEntries(groupLanes(list, today).map((x) => [x.key, x.items]));
    return laneInfo(today).map((l) => ({ ...l, items: g[l.key] || [] }));
  }, [list, today]);
  const closed = new Set(collapsed);
  return (
    <div className={`board${overOpen ? "" : " col"}`}>
      {lanes.map((l) => {
        const head = (
          <div className="lhd">
            <Cloud kind={l.cloud} size={24} deco fb="bar" />
            <div><b>{l.label}</b><div className="sub">{l.sub}</div></div>
            <span className="n">{l.items.length}</span>
          </div>
        );
        if (l.key === "over" && !overOpen) {
          return (
            <section key={l.key} className="lane over" aria-label="已逾期（已收折）">
              {head}
              <button type="button" className="ltg" aria-expanded="false" onClick={() => setOverOpen(true)}>展開 ▸</button>
              {l.items.length ? l.items.map((m) => (
                <button key={m.id} type="button" className="cm" aria-label={`展開已逾期分組：${m.name}`} onClick={() => setOverOpen(true)}>
                  <i className="swl" style={{ background: `var(--${m.color})` }} />
                  <span style={{ minWidth: 0 }}><b>{m.name}</b><span className="d">逾期 {m.odDays} 天</span>{" "}<span className="dd">{formatShortDate(m.s, today)} → {formatShortDate(m.e, today)}</span></span>
                </button>
              )) : <div className="lempty">沒有逾期專案</div>}
            </section>
          );
        }
        return (
          <section key={l.key} className={`lane ${l.key}`} aria-label={l.label}>
            {head}
            {l.key === "over" && <button type="button" className="ltg" aria-expanded="true" onClick={() => setOverOpen(false)}>◂ 收折</button>}
            {l.items.length ? l.items.map((m) => (
              <Card key={m.id} m={m} today={today} owners={owners} expanded={!closed.has(m.id)} dim={!!hl && m.key !== hl}
                selected={selectedId === m.id} onSelect={onSelect} onOpenProject={onOpenProject} />
            )) : <div className="lempty"><Cloud kind="purple" size={40} deco />這段時間沒有專案</div>}
          </section>
        );
      })}
    </div>
  );
}
