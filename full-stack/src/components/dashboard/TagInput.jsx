"use client";
import { useState } from "react";
import { X } from "@/lib/theme";

export default function TagInput({ value, onChange, suggestions = [], placeholder = "Add...", style = {} }) {
  const [input, setInput] = useState("");
  const [showSug, setShowSug] = useState(false);
  const tags = (value && value !== "—") ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const filtered = suggestions.filter(s => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase()));
  const add = (v) => { const val = (v || input).trim(); if (val && !tags.includes(val)) { onChange([...tags, val].join(",")); setInput(""); setShowSug(false); } };
  const remove = idx => { const nt = tags.filter((_, i) => i !== idx); onChange(nt.length ? nt.join(",") : "—"); };
  return (<div style={{ position: "relative", ...style }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "4px 8px", borderRadius: 8, border: `1px solid ${X.border}`, background: X.surface, minHeight: 32 }}>
      {tags.map((t, i) => (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 12, background: `${X.accent}18`, color: X.accent, fontSize: 13, fontWeight: 500 }}>
        {t}<span onClick={() => remove(i)} style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, opacity: 0.7, marginLeft: 2 }}>×</span>
      </span>))}
      <input value={input} onChange={e => { setInput(e.target.value); setShowSug(true); }} placeholder={tags.length === 0 ? placeholder : ""} onKeyDown={e => { if ((e.key === "Enter" || e.key === ",") && input.trim()) { e.preventDefault(); add(); } if (e.key === "Backspace" && !input && tags.length > 0) remove(tags.length - 1); }} onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 150)} style={{ border: "none", outline: "none", background: "transparent", color: X.text, fontSize: 13, flex: 1, minWidth: 60, padding: "2px 0" }} />
    </div>
    {showSug && filtered.length > 0 && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2, background: X.surface, border: `1px solid ${X.border}`, borderRadius: 8, maxHeight: 120, overflowY: "auto", zIndex: 50, boxShadow: `0 4px 12px ${X.shadow}` }}>
      {filtered.map(s => <div key={s} onMouseDown={() => add(s)} style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", color: X.text }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{s}</div>)}
    </div>}
  </div>);
}
