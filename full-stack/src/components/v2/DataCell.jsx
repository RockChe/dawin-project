"use client";
import { useEffect, useRef, useState } from "react";
import { toISO } from "@/lib/utils";

// Data 表格的鍵盤編輯格（舊 EditableCell 受控模式的 v2 版，樣式走 CSS class，字級 ≥14px）。
// 選取＝點一下；編輯＝雙擊／F2／Enter／直接打字（鍵盤事件在表格外層處理，這裡只管單格）。
// ctl＝{ isSelected, isEditing, onSelect, onStartEdit, onStopEdit, onNavigate, typed }；
// 編輯中 Enter（Shift+Enter）儲存並往下（上）、Tab（Shift+Tab）儲存並往右（左）、Esc 放棄、失焦儲存。
// kind：text｜select（給 options）｜date（原生日期輸入，存 ISO）。locked＝唯讀但可選取（例如 Owner 由子任務帶出）。
export default function DataCell({ value, onSave, kind = "text", options, render, locked, title, className = "", ctl }) {
  const { isSelected, isEditing, onSelect, onStartEdit, onStopEdit, onNavigate, typed } = ctl;
  const ref = useRef(null);
  const done = useRef(false);
  const initial = kind === "date" ? toISO(value || "").slice(0, 10) : (value ?? "");
  const [val, setVal] = useState("");

  // 只在進入編輯時初始化（value 變動不能重置編輯中的內容）
  useEffect(() => {
    if (!isEditing) return;
    done.current = false;
    setVal(typed != null && kind === "text" ? typed : initial);
    const id = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (save, dir, v = val) => {
    if (done.current) return;
    done.current = true;
    if (save && v !== initial) onSave(v);
    onStopEdit();
    if (dir) onNavigate(dir);
  };

  if (!isEditing) {
    return (
      <span role="gridcell" tabIndex={isSelected ? 0 : -1} title={title} aria-readonly={locked || undefined}
        className={`gc${isSelected ? " on" : ""}${locked ? " lock" : ""} ${className}`}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (!locked) onStartEdit(); }}>
        {render ? render(value) : (value || "—")}
      </span>
    );
  }
  const keys = (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true, e.shiftKey ? "up" : "down"); }
    else if (e.key === "Tab") { e.preventDefault(); finish(true, e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  if (kind === "select") {
    return (
      <select ref={ref} className="gc-ed" value={val} aria-label="編輯" onClick={(e) => e.stopPropagation()}
        onChange={(e) => finish(true, null, e.target.value)} onBlur={() => finish(true)} onKeyDown={keys}>
        {val && !options.includes(val) && <option value={val}>{val}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input ref={ref} className="gc-ed" type={kind === "date" ? "date" : "text"} value={val} aria-label="編輯"
      onClick={(e) => e.stopPropagation()} onChange={(e) => setVal(e.target.value)} onBlur={() => finish(true)} onKeyDown={keys} />
  );
}
