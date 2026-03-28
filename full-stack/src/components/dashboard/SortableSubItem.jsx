"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import EditableCell from "./EditableCell";
import InlineNote from "./InlineNote";
import OwnerTags from "./OwnerTags";
import TagInput from "./TagInput";

export default function SortableSubItem({ sub, toggleSub, updateSub, deleteSub, configOwners }) {
  const { X } = useTheme();
  const [editingOwner, setEditingOwner] = useState(false);
  const ownerRef = useRef(null);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sub.id });
  const sStyle = { transform: CSS.Transform.toString(transform), transition };

  useEffect(() => {
    if (!editingOwner) return;
    const handler = (e) => {
      if (ownerRef.current && !ownerRef.current.contains(e.target)) setEditingOwner(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingOwner]);

  return (
    <div ref={setNodeRef} style={sStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, marginBottom: 2 }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span {...attributes} {...listeners} style={{ cursor: "grab", fontSize: 14, color: X.textDim, flexShrink: 0, userSelect: "none" }}>⠿</span>
        <span onClick={e => { e.stopPropagation(); toggleSub(sub.id); }} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff", cursor: "pointer" }}>{sub.done ? "✓" : ""}</span>
        <span style={{ flexShrink: 0, maxWidth: "40%" }}><EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} style={{ fontSize: 13, color: X.textSec, textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }} /></span>
        <InlineNote value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} />
        <span ref={ownerRef} onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
          {editingOwner
            ? <TagInput value={sub.owner} onChange={v => updateSub(sub.id, "owner", v)} suggestions={configOwners} configOwners={configOwners} placeholder="負責人..." style={{ fontSize: 12, minWidth: 140 }} />
            : <span onClick={() => setEditingOwner(true)} style={{ cursor: "pointer" }}><OwnerTags value={sub.owner} configOwners={configOwners} /></span>
          }
        </span>
        <button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 12, cursor: "pointer", padding: "2px 4px", opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>×</button>
      </div>
    </div>
  );
}
