"use client";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableProjectCard({ project, pn, pt, c, ts, avg, stC, icon, dragEnabled, onSelect, onArchive, onDelete, onIconClick }) {
  const { X, SC } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id });
  const sStyle = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={sStyle}>
      <div onClick={onSelect} style={{ background: X.surface, borderRadius: 16, border: `1px solid ${X.border}`, overflow: "hidden", transition: "border-color 0.2s", cursor: "pointer", position: "relative" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = c} onMouseLeave={e => e.currentTarget.style.borderColor = X.border}>
        {dragEnabled && (
          <span {...attributes} {...listeners} onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 10, right: 12, cursor: "grab", fontSize: 16, color: X.textDim, userSelect: "none", zIndex: 2, padding: "2px 4px", borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>⠿</span>
        )}
        <div style={{ padding: "18px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div onClick={e => { e.stopPropagation(); onIconClick(); }} title="Upload icon"
              style={{ width: 56, height: 56, borderRadius: 14, background: icon ? "transparent" : `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: c, flexShrink: 0, cursor: "pointer", overflow: "hidden", border: icon ? "none" : `1px dashed ${c}50` }}>
              {icon ? <img src={icon} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 14 }} /> : pn[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pn}</div>
              <div style={{ fontSize: 14, color: X.textDim, fontFamily: FM, marginTop: 2 }}>{pt.length} tasks · {ts.length} subtasks</div>
            </div>
            <span style={{ fontSize: 20, color: X.textDim }}>›</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 5, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${avg}%`, background: c, borderRadius: 2, opacity: 0.8 }} /></div>
            <span style={{ fontFamily: FM, fontSize: 14, fontWeight: 600, color: avg === 100 ? X.green : X.text }}>{avg}%</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.entries(stC).map(([st, cnt]) => { const sc = SC[st] || {}; return (<span key={st} style={{ fontSize: 14, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color }}>{st} {cnt}</span>); })}
          </div>
        </div>
        <div style={{ padding: "10px 20px 14px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: `1px solid ${X.border}` }}>
          <button onClick={e => { e.stopPropagation(); onArchive(); }} style={{ background: "transparent", border: `1px solid ${X.amber}50`, borderRadius: 20, padding: "3px 12px", fontSize: 14, color: X.amber, cursor: "pointer", fontWeight: 600 }}>Archive</button>
          <button onClick={e => { e.stopPropagation(); if (confirm("Delete " + pn + "?")) onDelete(); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "3px 12px", fontSize: 14, color: X.red, cursor: "pointer", fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
