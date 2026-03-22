"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

export default function InlineNote({ value, onSave }) {
  const { X } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef(null);

  // Only runs on edit mode entry. value intentionally omitted
  // to avoid resetting draft while user is typing.
  useEffect(() => {
    if (!editing) return;
    setDraft(value || "");
    const tid = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(tid);
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => { setEditing(false); const v = draft.trim(); if (v !== (value || "")) onSave(v); };
  const cancel = () => { setEditing(false); setDraft(value || ""); };

  if (editing) return (
    <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }} onClick={e => e.stopPropagation()}>
      <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        style={{ flex: 1, fontSize: 12, padding: "1px 4px", borderRadius: 4, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.textSec, fontFamily: "inherit", minWidth: 0 }} />
      <span style={{ fontSize: 11, color: X.textDim, flexShrink: 0 }}>↵</span>
    </span>
  );

  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true); }}
      style={{ flex: 1, fontSize: 12, color: value ? X.textDim : X.textDim + "60", fontStyle: value ? "normal" : "italic", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "1px 4px", borderRadius: 4, minWidth: 0 }}
      onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >{value || "add note..."}</span>
  );
}
