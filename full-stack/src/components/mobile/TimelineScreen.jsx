"use client";
import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { projectBars } from "./mobileData";

const ym = s => s.slice(0, 7).replace("-", "/");

export default function TimelineScreen({ projects = [], twp = [], today, pcMap = {}, onSelectProject }) {
  const { X } = useTheme();
  const bars = useMemo(() => projectBars(projects, twp, today), [projects, twp, today]);
  return (
    <div style={{ padding: "0 12px 12px" }}>
      <div style={{ padding: "12px 2px 8px" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>時程</div>
        {bars.rows.length > 0 && (
          <div style={{ fontSize: 12, color: X.textSec }}>{ym(bars.rangeStart)} — {ym(bars.rangeEnd)} · 今天 {today.slice(5, 10).replace("-", "/")}</div>
        )}
      </div>
      {bars.rows.length === 0 && <div style={{ padding: 32, textAlign: "center", color: X.textDim, fontSize: 14 }}>沒有可顯示的時程</div>}
      {bars.rows.map(r => {
        const c = pcMap[r.name] || X.accent;
        return (
          <button key={r.id} type="button" onClick={() => onSelectProject?.(r.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: "0 2px", border: "none", background: "transparent", color: X.text, font: "inherit", textAlign: "left", cursor: "pointer" }}>
            <span style={{ flex: "none", width: 92, fontSize: 12, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span style={{ flex: 1, position: "relative", height: 14, background: X.borderLight, borderRadius: 7 }}>
              <span style={{ position: "absolute", top: 0, bottom: 0, left: `${r.leftPct}%`, width: `${r.widthPct}%`, borderRadius: 7, background: `${c}35`, border: `1px solid ${c}45`, minWidth: 6 }} />
              <span style={{ position: "absolute", top: 0, bottom: 0, left: `${r.leftPct}%`, width: `${r.widthPct * r.progressPct / 100}%`, borderRadius: 7, background: c, opacity: 0.85, minWidth: r.progressPct > 0 ? 4 : 0 }} />
              <span style={{ position: "absolute", top: -15, bottom: -15, left: `${bars.todayPct}%`, borderLeft: `2px dashed ${X.accent}`, opacity: 0.5 }} />
            </span>
          </button>
        );
      })}
      <div style={{ fontSize: 11, color: X.textDim, textAlign: "center", marginTop: 12 }}>完整甘特圖請用平板或桌機</div>
    </div>
  );
}
