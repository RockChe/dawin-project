"use client";
import { useState, useRef, useEffect, memo } from "react";
import { F } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { toISO, fromISO } from "@/lib/utils";
import CalendarPicker from "./CalendarPicker";

const EditableCell = memo(function EditableCell({
  value, onSave, options = null, isDate = false, style = {},
  isSelected, isEditing, onSelect, onStartEdit, onStopEdit, onNavigate, initialTypedChar,
  renderValue: renderValueProp
}) {
  const { X, inputStyle } = useTheme();
  const controlled = isSelected !== undefined;
  const ref = useRef(null);
  const committedRef = useRef(false);
  const [ed, setEd] = useState(false);
  const [dr, setDr] = useState(isDate ? toISO(value) : value);
  const [editVal, setEditVal] = useState("");

  // Only runs on edit mode entry. value, initialTypedChar, isDate, options
  // intentionally omitted — including them would reset in-progress edits.
  useEffect(() => {
    if (!controlled || !isEditing) return;
    committedRef.current = false;
    if (initialTypedChar != null && !isDate && !options) {
      setEditVal(initialTypedChar);
    } else {
      setEditVal(isDate ? toISO(value) : (value || ""));
    }
    const tid = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(tid);
  }, [isEditing, controlled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== LEGACY MODE (no isSelected prop) ==========
  if (!controlled) {
    const start = (e) => { e.stopPropagation(); setDr(isDate ? toISO(value) : (value || "")); setEd(true); setTimeout(() => ref.current?.focus(), 0); };
    const commit = () => { setEd(false); const v = isDate ? fromISO(dr) : dr; if (v !== value) onSave(v); };
    const cancel = () => { setEd(false); setDr(isDate ? toISO(value) : value); };
    if (!ed) return (<span onClick={start} style={{ cursor: "text", borderBottom: "1px dashed transparent", overflow: "hidden", textOverflow: "ellipsis", ...style }} onMouseEnter={e => e.target.style.borderBottomColor = X.borderLight} onMouseLeave={e => e.target.style.borderBottomColor = "transparent"}>{renderValueProp ? renderValueProp(value) : (value || "\u2014")}</span>);
    if (isDate) return (<CalendarPicker value={value || ""} onChange={v => { onSave(v); setEd(false); }} autoOpen onClose={() => setEd(false)} style={{ minWidth: 110, ...style }} />);
    if (options) return (<select ref={ref} value={dr} onChange={e => setDr(e.target.value)} onBlur={commit} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") cancel(); }} style={{ fontFamily: F, fontSize: 14, padding: "2px 4px", borderRadius: 4, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, ...style }}>{dr && !options.includes(dr) && <option value={dr}>{dr}</option>}{options.map(o => <option key={o} value={o}>{o}</option>)}</select>);
    return (<input ref={ref} type="text" value={dr} onChange={e => setDr(e.target.value)} onBlur={commit} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }} style={{ fontFamily: F, fontSize: 14, padding: "2px 4px", borderRadius: 4, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, width: "100%", ...style }} />);
  }

  // ========== CONTROLLED MODE ==========
  const commitCtrl = (dir) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const v = isDate ? fromISO(editVal) : editVal;
    if (v !== value) onSave(v);
    if (onStopEdit) onStopEdit(true);
    if (dir && onNavigate) onNavigate(dir);
  };
  const cancelCtrl = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (onStopEdit) onStopEdit(false);
  };

  // --- Display (selected / non-selected) ---
  if (!isEditing) {
    return (
      <span
        role="gridcell"
        tabIndex={isSelected ? 0 : -1}
        onClick={e => { e.stopPropagation(); if (onSelect) onSelect(); }}
        onDoubleClick={e => { e.stopPropagation(); if (onStartEdit) onStartEdit(); }}
        style={{ cursor: "default", display: "block", padding: "1px 2px", borderRadius: 3, outline: isSelected ? `2px solid ${X.accent}` : "none", outlineOffset: -1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: 20, ...style }}
      >{renderValueProp ? renderValueProp(value) : (value || "\u2014")}</span>
    );
  }

  // --- Edit: Date ---
  if (isDate) {
    return (<CalendarPicker value={value || ""} onChange={v => { onSave(v); committedRef.current = true; if (onStopEdit) onStopEdit(true); }} autoOpen onClose={() => { if (!committedRef.current) { committedRef.current = true; if (onStopEdit) onStopEdit(false); } }} style={{ minWidth: 110, ...style }} />);
  }

  // --- Edit: Select ---
  if (options) {
    return (
      <select ref={ref} value={editVal}
        onChange={e => { const v = e.target.value; setEditVal(v); if (v !== value) onSave(v); committedRef.current = true; if (onStopEdit) onStopEdit(true); }}
        onBlur={() => { if (!committedRef.current) commitCtrl(null); }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); cancelCtrl(); }
          if (e.key === "Tab") { e.preventDefault(); commitCtrl(e.shiftKey ? "left" : "right"); }
          if (e.key === "Enter") { e.preventDefault(); commitCtrl(e.shiftKey ? "up" : "down"); }
        }}
        style={{ fontFamily: F, fontSize: 14, padding: "2px 4px", borderRadius: 4, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, ...style }}
      >{editVal && !options.includes(editVal) && <option value={editVal}>{editVal}</option>}{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
    );
  }

  // --- Edit: Text ---
  return (
    <input ref={ref} type="text" value={editVal} onChange={e => setEditVal(e.target.value)}
      onBlur={() => { if (!committedRef.current) commitCtrl(null); }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); commitCtrl(e.shiftKey ? "up" : "down"); }
        if (e.key === "Tab") { e.preventDefault(); commitCtrl(e.shiftKey ? "left" : "right"); }
        if (e.key === "Escape") { e.preventDefault(); cancelCtrl(); }
      }}
      style={{ fontFamily: F, fontSize: 14, padding: "2px 4px", borderRadius: 4, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, width: "100%", ...style }}
    />
  );
});

export default EditableCell;
