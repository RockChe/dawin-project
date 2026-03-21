"use client";
import { useState, useEffect, useRef } from "react";
import { X, getIS2 } from "@/lib/theme";
import { pD, fD } from "@/lib/utils";

export default function CalendarPicker({ value, onChange, showTime = false, autoOpen = false, onClose, style = {} }) {
  const [open, setOpen] = useState(autoOpen);
  const [viewDate, setViewDate] = useState(() => { if (value) { const d = pD(value.split(" ")[0]); if (d && !isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), 1); } return new Date(new Date().getFullYear(), new Date().getMonth(), 1); });
  const [timeVal, setTimeVal] = useState(() => value && value.includes(" ") ? value.split(" ")[1] : "09:00");
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); if (onClose) onClose(); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open, onClose]);
  const y = viewDate.getFullYear(), mo = viewDate.getMonth();
  const firstDay = new Date(y, mo, 1).getDay();
  const dim = new Date(y, mo + 1, 0).getDate();
  const prevDim = new Date(y, mo, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ d: prevDim - i, c: false });
  for (let i = 1; i <= dim; i++) cells.push({ d: i, c: true });
  while (cells.length < 42) cells.push({ d: cells.length - firstDay - dim + 1, c: false });
  const selStr = value ? value.split(" ")[0] : "";
  const now = new Date();
  const todayStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const pick = day => { const ds = `${y}/${String(mo + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}`; onChange(showTime ? ds + " " + timeVal : ds); setOpen(false); if (onClose) onClose(); };
  const confirmT = () => { const ds = selStr || `${y}/${String(mo + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`; onChange(ds + " " + timeVal); setOpen(false); if (onClose) onClose(); };
  const cIS2 = getIS2();
  return (<div ref={ref} style={{ position: "relative", ...style }}>
    <div onClick={() => setOpen(!open)} style={{ ...cIS2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <span style={{ color: value ? X.text : X.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value ? fD(value) : "Select date"}</span>
      <span style={{ fontSize: 11, color: X.textDim, flexShrink: 0 }}>📅</span>
    </div>
    {open && <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, padding: 12, zIndex: 60, boxShadow: `0 8px 24px ${X.shadowHeavy}`, width: 264, maxWidth: "calc(100vw - 32px)", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={() => setViewDate(new Date(y, mo - 1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: X.textSec, padding: "2px 8px", lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: X.text }}>{y}年 {mo + 1}月</span>
        <button onClick={() => setViewDate(new Date(y, mo + 1, 1))} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: X.textSec, padding: "2px 8px", lineHeight: 1 }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 2 }}>
        {["日", "一", "二", "三", "四", "五", "六"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: X.textDim, padding: "4px 0", fontWeight: 500 }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
        {cells.map((cell, i) => { const cs = cell.c ? `${y}/${String(mo + 1).padStart(2, "0")}/${String(cell.d).padStart(2, "0")}` : ""; const isSel = cell.c && cs === selStr; const isT = cell.c && cs === todayStr;
          return <div key={i} onClick={cell.c ? () => pick(cell.d) : undefined} style={{ textAlign: "center", padding: "5px 0", fontSize: 13, borderRadius: 6, cursor: cell.c ? "pointer" : "default", color: !cell.c ? X.textDim : isSel ? "#fff" : isT ? X.accent : X.text, background: isSel ? X.accent : isT ? `${X.accent}15` : "transparent", fontWeight: isSel || isT ? 600 : 400, transition: "background 0.15s" }} onMouseEnter={e => { if (cell.c && !isSel) e.currentTarget.style.background = X.surfaceHover; }} onMouseLeave={e => { if (cell.c && !isSel) e.currentTarget.style.background = isT ? `${X.accent}15` : "transparent"; }}>{cell.d}</div>; })}
      </div>
      {showTime && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${X.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: X.textDim }}>Time</span>
        <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...cIS2, flex: 1, padding: "4px 8px" }} />
        <button onClick={confirmT} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 8, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>OK</button>
      </div>}
    </div>}
  </div>);
}
