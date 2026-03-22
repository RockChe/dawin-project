"use client";
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

export default function SettingsTab({ configCats, saveConfigCats, configOwners, saveConfigOwners, ganttDraft, setGanttDraft, saveGanttWidths, isMobile, showToast }) {
  const { X, CC, PJC, inputStyle } = useTheme();
  const [newCat, setNewCat] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const iS2 = inputStyle;

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.accent, borderRadius: 2 }} />Categories</h3>
        {configCats.map((cat, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: CC[cat] || X.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: X.text, flex: 1 }}>{cat}</span>
          <button onClick={() => { saveConfigCats(configCats.filter((_, j) => j !== i)); showToast("Category removed", "error"); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.5 }}>×</button>
        </div>))}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category" onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { saveConfigCats([...configCats, newCat.trim()]); setNewCat(""); showToast("Category added", "success"); } }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px" }} />
          <button onClick={() => { if (newCat.trim()) { saveConfigCats([...configCats, newCat.trim()]); setNewCat(""); showToast("Category added", "success"); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+</button>
        </div>
      </div>
      <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.purple, borderRadius: 2 }} />Owners</h3>
        {configOwners.map((ow, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: PJC[i % PJC.length], flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: X.text, flex: 1 }}>{ow}</span>
          <button onClick={() => { saveConfigOwners(configOwners.filter((_, j) => j !== i)); showToast("Owner removed", "error"); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.5 }}>×</button>
        </div>))}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="New owner" onKeyDown={e => { if (e.key === "Enter" && newOwner.trim()) { saveConfigOwners([...configOwners, newOwner.trim()]); setNewOwner(""); showToast("Owner added", "success"); } }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px" }} />
          <button onClick={() => { if (newOwner.trim()) { saveConfigOwners([...configOwners, newOwner.trim()]); setNewOwner(""); showToast("Owner added", "success"); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+</button>
        </div>
      </div>
      <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}`, gridColumn: "1" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.amber, borderRadius: 2 }} />Timeline Width (px per unit)</h3>
        {[{ view: "overview", label: "Overview" }, { view: "project", label: "Project Detail" }, { view: "timeline", label: "Timeline" }].map(({ view, label }) => (
          <div key={view} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: X.textSec, marginBottom: 6 }}>{label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ k: "day", l: "日" }, { k: "week", l: "週" }, { k: "month", l: "月" }, { k: "quarter", l: "季" }].map(({ k, l }) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: X.textDim, marginBottom: 2 }}>{l}</div>
                  <input type="number" value={ganttDraft[view]?.[k] ?? ''} onChange={e => { const raw = e.target.value; setGanttDraft(p => ({ ...p, [view]: { ...p[view], [k]: raw === '' ? '' : (parseInt(raw) || 1) } })); }} onKeyDown={e => { if (e.key === "Enter") saveGanttWidths(); }} style={{ ...iS2, fontSize: 14, padding: "6px 10px", width: "100%" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={saveGanttWidths} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>💾 Save Widths</button>
        </div>
      </div>
    </div>
  );
}
