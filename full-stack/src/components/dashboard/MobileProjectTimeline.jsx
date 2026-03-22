"use client";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

export default function MobileProjectTimeline({ projBars }) {
  const { X } = useTheme();
  if (!projBars.length) return (<div style={{ padding: 40, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📅</div><div style={{ fontSize: 14 }}>No timeline data available</div></div>);
  const fmtD = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {projBars.map(p => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: X.surfaceLight, borderRadius: 10, border: `1px solid ${X.border}` }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: X.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
            <div style={{ fontSize: 12, color: X.textDim, fontFamily: FM, marginTop: 2 }}>{fmtD(p.start)} → {fmtD(p.end)}</div>
          </div>
          <div style={{ width: 60 }}>
            <div style={{ height: 4, background: `${p.color}20`, borderRadius: 2, overflow: "hidden", marginBottom: 3 }}><div style={{ height: "100%", width: `${p.avg}%`, background: p.color, borderRadius: 2 }} /></div>
            <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, color: p.avg === 100 ? X.green : p.color, textAlign: "right" }}>{p.avg}%</div>
          </div>
        </div>
      ))}
    </div>
  );
}
