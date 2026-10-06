"use client";
import { THEMES, F, FM, FD_STYLE } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

export default function DashboardHeader({ themeKey, cycleTheme, scrolled, searchInput, handleSearch, searchQ, clearSearch, avgProg, filtered }) {
  const { X } = useTheme();
  return (
    <div className="dash-header" style={{ borderBottom: `1px solid ${X.border}`, position: "sticky", top: 0, zIndex: 50, background: X.surface, boxShadow: scrolled ? X.surfaceShadow : "none", transition: "box-shadow 0.2s" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: X.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17, color: "#fff" }}>P</div>
          <span className="dash-title" style={{ ...FD_STYLE }}>大雲文創專案管理系統</span>
        </div>
        <div className="dash-hdr-right">
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 10, fontSize: 14, color: X.textDim, pointerEvents: "none" }}>🔍</span>
            <input value={searchInput} onChange={e => handleSearch(e.target.value)} placeholder="Search tasks..." className="dash-search" style={{ fontFamily: F, fontSize: 14, padding: "8px 32px 8px 34px", borderRadius: 20, border: `1px solid ${X.border}`, outline: "none", background: X.surfaceLight, color: X.text, transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = X.accent} onBlur={e => e.target.style.borderColor = X.border} />
            {searchQ && <button onClick={clearSearch} style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: X.textDim, fontSize: 16, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>×</button>}
          </div>
          <button className="dash-tap" onClick={cycleTheme} title={THEMES[themeKey].label} aria-label={`切換主題: ${THEMES[themeKey].label}`}
            style={{ width: 56, height: 28, borderRadius: 14, background: themeKey === "warm" ? X.accent : X.border, cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0, border: "none", padding: 0 }}>
            <div style={{ position: "absolute", top: 3, left: themeKey === "warm" ? 31 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
              {THEMES[themeKey].icon}
            </div>
          </button>
          <div style={{ width: 1, height: 28, background: X.border }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, color: X.textDim, fontFamily: FM }}>Overall</div>
            <div className="dash-pct-lg" style={{ color: X.accent, fontWeight: 700, fontFamily: FM, lineHeight: 1 }}>{avgProg}%</div>
          </div>
          <div style={{ width: 1, height: 28, background: X.border }} />
          <div style={{ fontFamily: FM, fontSize: 14, color: X.textSec }}>{new Date().toLocaleDateString("zh-TW")} · {filtered.length} tasks</div>
        </div>
      </div>
    </div>
  );
}
