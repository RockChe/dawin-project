"use client";
import { useTheme } from "@/components/ThemeProvider";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import EditableCell from "./EditableCell";
import InlineNote from "./InlineNote";
import OwnerTags from "./OwnerTags";

export default function SortableSubItem({ sub, toggleSub, updateSub, deleteSub, configOwners }) {
  const { X } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sub.id });
  const sStyle = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={sStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, marginBottom: 2 }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span {...attributes} {...listeners} style={{ cursor: "grab", fontSize: 14, color: X.textDim, flexShrink: 0, userSelect: "none" }}>⠿</span>
        <span onClick={e => { e.stopPropagation(); toggleSub(sub.id); }} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff", cursor: "pointer" }}>{sub.done ? "✓" : ""}</span>
        <span style={{ flexShrink: 0, maxWidth: "40%" }}><EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} style={{ fontSize: 13, color: X.textSec, textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }} /></span>
        <InlineNote value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} />
        <span><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} renderValue={v => <OwnerTags value={v} configOwners={configOwners} />} style={{ fontSize: 12, color: X.textDim }} /></span>
        <button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 12, cursor: "pointer", padding: "2px 4px", opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>×</button>
      </div>
    </div>
  );
}
