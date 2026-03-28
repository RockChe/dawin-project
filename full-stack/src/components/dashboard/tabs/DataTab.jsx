"use client";
import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD, toISO, tasksToCSV, parseCSV, downloadCSV } from "@/lib/utils";
import EditableCell from "../EditableCell";
import InlineNote from "../InlineNote";
import CalendarPicker from "../CalendarPicker";
import TagInput from "../TagInput";
import ProgressBar from "../ProgressBar";
import OwnerTags from "../OwnerTags";

const EDITABLE_COLS = ["project","task","owner","status","priority","category","start","end","notes"];
const SUB_EDITABLE_COLS = ["name","owner","notes"];
const COL_POS = { project: 0, task: 1, name: 1, owner: 2, status: 3, priority: 4, category: 6, start: 7, end: 8, notes: 9 };
const getEditableCols = (type) => type === "sub" ? SUB_EDITABLE_COLS : EDITABLE_COLS;

function DataTab({
  filtered, allS, allT, twp, projects,
  updateTask, deleteTask, addTask, toggleSub, updateSub, addSub, deleteSub,
  configCats, configOwners,
  isMobile, userRole, pcMap,
  importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks,
  showToast, setModalTask,
}) {
  const { X, SC, PC, CC, inputStyle } = useTheme();
  const [expanded, setExpanded] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [showTblAdd, setShowTblAdd] = useState(false);
  const [tblAddLoading, setTblAddLoading] = useState(false);
  const [draft, setDraft] = useState({ task: "", project: "", start: "", end: "", owner: "—", category: "活動", priority: "中", notes: "" });
  const [subDraft, setSubDraft] = useState({ name: "", owner: "" });
  const [showSubAdd, setShowSubAdd] = useState(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [editingCell, setEditingCell] = useState(false);
  const [initialTypedChar, setInitialTypedChar] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showCleanAllModal, setShowCleanAllModal] = useState(false);
  const [cleanAllInput, setCleanAllInput] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef(null);

  const toggle = id => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const iS2 = inputStyle;

  const sorted = useMemo(() => { if (!sortCol) return filtered; const po = { "高": 0, "中": 1, "低": 2 }; return [...filtered].sort((a, b) => { let va = a[sortCol], vb = b[sortCol]; if (sortCol === "start" || sortCol === "end") { va = va ? pD(va).getTime() : 0; vb = vb ? pD(vb).getTime() : 0; } if (sortCol === "duration" || sortCol === "progress") { va = va || 0; vb = vb || 0; } if (sortCol === "priority") { va = po[va] ?? 9; vb = po[vb] ?? 9; } if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); } return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0); }); }, [filtered, sortCol, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize]);
  useEffect(() => { setCurrentPage(1); }, [filtered, sortCol, sortDir, pageSize]);
  const subsByTaskId = useMemo(() => { const map = {}; allS.forEach(s => { if (!map[s.taskId]) map[s.taskId] = []; map[s.taskId].push(s); }); return map; }, [allS]);
  const flatRows = useMemo(() => { const rows = []; paged.forEach(d => { rows.push({ type: "task", id: d.id, data: d }); if (expanded.has(d.id)) { (subsByTaskId[d.id] || []).forEach(sub => { rows.push({ type: "sub", id: sub.id, data: sub }); }); } }); return rows; }, [paged, expanded, subsByTaskId]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };
  const SI = ({ col }) => sortCol !== col ? <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span> : <span style={{ marginLeft: 3, color: X.accent }}>{sortDir === "asc" ? "↑" : "↓"}</span>;

  const processImport = useCallback(async (csvText) => {
    const imported = parseCSV(csvText);
    if (!imported.length) { showToast("CSV 中沒有有效資料", "error"); return; }
    await importTasks(imported);
  }, [showToast, importTasks]);

  const handleImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { processImport(ev.target.result); };
    reader.readAsText(file); e.target.value = "";
  };

  const handleUrlImport = useCallback(async () => {
    if (!urlValue.trim()) return;
    setUrlLoading(true);
    try {
      const res = await fetch("/api/fetch-csv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlValue.trim() }) });
      const data = await res.json();
      if (!res.ok || data.error) { showToast(data.error || "取得 CSV 失敗", "error"); return; }
      await processImport(data.csv);
      setShowUrlInput(false); setUrlValue("");
    } catch (err) { showToast("取得 CSV 失敗: " + err.message, "error"); }
    finally { setUrlLoading(false); }
  }, [urlValue, processImport, showToast]);

  const navigate = useCallback((dir) => {
    if (!activeCell) return;
    const { rowId, colKey } = activeCell;
    const ri = flatRows.findIndex(r => r.id === rowId);
    if (ri === -1) return;
    const cols = getEditableCols(flatRows[ri].type);
    const ci = cols.indexOf(colKey);
    let ni = ri, nk = colKey;
    if (dir === "up" && ri > 0) { ni = ri - 1; const nc = getEditableCols(flatRows[ni].type); const p = COL_POS[colKey] || 0; nk = nc.reduce((b, c) => Math.abs(COL_POS[c] - p) < Math.abs(COL_POS[b] - p) ? c : b); }
    else if (dir === "down" && ri < flatRows.length - 1) { ni = ri + 1; const nc = getEditableCols(flatRows[ni].type); const p = COL_POS[colKey] || 0; nk = nc.reduce((b, c) => Math.abs(COL_POS[c] - p) < Math.abs(COL_POS[b] - p) ? c : b); }
    else if (dir === "left") { if (ci > 0) nk = cols[ci - 1]; else if (ri > 0) { ni = ri - 1; const pc = getEditableCols(flatRows[ni].type); nk = pc[pc.length - 1]; } }
    else if (dir === "right") { if (ci < cols.length - 1) nk = cols[ci + 1]; else if (ri < flatRows.length - 1) { ni = ri + 1; nk = getEditableCols(flatRows[ni].type)[0]; } }
    if (ni !== ri || nk !== colKey) { setActiveCell({ rowId: flatRows[ni].id, colKey: nk }); setEditingCell(false); setInitialTypedChar(null); }
  }, [activeCell, flatRows]);

  const handleTableKeyDown = useCallback((e) => {
    if (!activeCell || editingCell) return;
    const { rowId, colKey } = activeCell;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); navigate("up"); break;
      case "ArrowDown": e.preventDefault(); navigate("down"); break;
      case "ArrowLeft": e.preventDefault(); navigate("left"); break;
      case "ArrowRight": e.preventDefault(); navigate("right"); break;
      case "Tab": e.preventDefault(); navigate(e.shiftKey ? "left" : "right"); break;
      case "Enter": case "F2": e.preventDefault(); setEditingCell(true); setInitialTypedChar(null); break;
      case "Delete": case "Backspace": e.preventDefault();
        { const row = flatRows.find(r => r.id === rowId); if (row) { if (row.type === "task") updateTask(rowId, colKey, ""); else updateSub(rowId, colKey, ""); } } break;
      case "Escape": e.preventDefault(); setActiveCell(null); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setInitialTypedChar(e.key); setEditingCell(true); }
    }
  }, [activeCell, editingCell, navigate, flatRows, updateTask, updateSub]);

  const cellP = useCallback((rowId, colKey) => ({
    isSelected: activeCell?.rowId === rowId && activeCell?.colKey === colKey,
    isEditing: activeCell?.rowId === rowId && activeCell?.colKey === colKey && editingCell,
    onSelect: () => { setActiveCell({ rowId, colKey }); setEditingCell(false); setInitialTypedChar(null); tableRef.current?.focus(); },
    onStartEdit: () => { setActiveCell({ rowId, colKey }); setEditingCell(true); setInitialTypedChar(null); },
    onStopEdit: () => { setEditingCell(false); setInitialTypedChar(null); },
    onNavigate: navigate,
    initialTypedChar: activeCell?.rowId === rowId && activeCell?.colKey === colKey ? initialTypedChar : null,
  }), [activeCell, editingCell, initialTypedChar, navigate]);

  const activeCellRef = useRef(activeCell);
  useEffect(() => { activeCellRef.current = activeCell; }, [activeCell]);

  useEffect(() => {
    const h = (e) => { if (activeCellRef.current && tableRef.current && !tableRef.current.contains(e.target)) { setActiveCell(null); setEditingCell(false); setInitialTypedChar(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (activeCell && !editingCell) tableRef.current?.focus();
  }, [activeCell, editingCell]);

  return (
    <>
      <div style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: "hidden" }}>
        <div style={{ padding: isMobile ? "10px 12px" : "10px 16px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          {!isMobile && <span style={{ fontSize: 14, color: X.textDim }}>Click to select · Double-click or F2 to edit · Arrow keys to navigate</span>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", ...(isMobile ? { width: "100%", justifyContent: "space-between" } : {}) }}>
            {isMobile ? (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => downloadCSV(tasksToCSV(allT), "tasks_export.csv")} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer" }}>Export</button>
                  <label style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>Import<input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} /></label>
                  <button onClick={() => { setShowUrlInput(!showUrlInput); setUrlValue(""); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer" }}>URL</button>
                  {selectedRows.size > 0 && <select onChange={async e => { const v = e.target.value; if (!v) return; await updateManyTasks([...selectedRows], "owner", v); e.target.value = ""; }} style={{ borderRadius: 20, padding: "4px 8px", fontSize: 12, border: `1px solid ${X.accent}`, background: X.surface, color: X.accent, cursor: "pointer", fontWeight: 600 }}><option value="">指派 Owner ({selectedRows.size})</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>}
                  {selectedRows.size > 0 && <button onClick={async () => { if (confirm(`確定要刪除 ${selectedRows.size} 筆任務？`)) { await deleteManyTasks([...selectedRows]); setSelectedRows(new Set()); } }} style={{ background: X.red, color: "#fff", border: "none", borderRadius: 20, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>刪除 ({selectedRows.size})</button>}
                  {userRole === "super_admin" && <button onClick={() => { setShowCleanAllModal(true); setCleanAllInput(""); }} style={{ background: "transparent", border: `1px solid ${X.red}60`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.red, cursor: "pointer" }}>Clean All</button>}
                </div>
                <button onClick={() => setShowTblAdd(!showTblAdd)} style={{ background: showTblAdd ? X.surfaceLight : X.accent, color: showTblAdd ? X.textSec : "#fff", border: showTblAdd ? `1px solid ${X.border}` : "none", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{showTblAdd ? "Cancel" : "+ Create"}</button>
              </>
            ) : (
              <>
                <button onClick={() => downloadCSV(tasksToCSV(allT), "tasks_export.csv")} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Export CSV</button>
                <label style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>Import CSV<input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} /></label>
                <button onClick={() => { setShowUrlInput(!showUrlInput); setUrlValue(""); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Import URL</button>
                {selectedRows.size > 0 && <select onChange={async e => { const v = e.target.value; if (!v) return; await updateManyTasks([...selectedRows], "owner", v); e.target.value = ""; }} style={{ borderRadius: 20, padding: "5px 12px", fontSize: 14, border: `1px solid ${X.accent}`, background: X.surface, color: X.accent, cursor: "pointer", fontWeight: 600 }}><option value="">指派 Owner ({selectedRows.size})</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>}
                {selectedRows.size > 0 && <button onClick={async () => { if (confirm(`確定要刪除 ${selectedRows.size} 筆任務？`)) { await deleteManyTasks([...selectedRows]); setSelectedRows(new Set()); } }} style={{ background: X.red, color: "#fff", border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>刪除已選 ({selectedRows.size})</button>}
                {userRole === "super_admin" && <button onClick={() => { setShowCleanAllModal(true); setCleanAllInput(""); }} style={{ background: "transparent", border: `1px solid ${X.red}60`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.red, cursor: "pointer" }}>Clean All</button>}
                <button onClick={() => setShowTblAdd(!showTblAdd)} style={{ background: showTblAdd ? X.surfaceLight : X.accent, color: showTblAdd ? X.textSec : "#fff", border: showTblAdd ? `1px solid ${X.border}` : "none", borderRadius: 20, padding: "5px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{showTblAdd ? "Cancel" : "+ Create"}</button>
              </>
            )}
          </div>
        </div>
        {showUrlInput && (
          <div style={{ padding: "8px 16px", background: X.surfaceLight, borderBottom: `1px solid ${X.border}`, display: "flex", gap: 8, alignItems: "center" }}>
            <input value={urlValue} onChange={e => setUrlValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleUrlImport(); }} placeholder="https://..." style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${X.border}`, background: X.surface, color: X.text, fontSize: 13, outline: "none" }} />
            <button onClick={handleUrlImport} disabled={urlLoading} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: urlLoading ? "not-allowed" : "pointer", opacity: urlLoading ? 0.6 : 1 }}>{urlLoading ? "載入中..." : "匯入"}</button>
            <button onClick={() => { setShowUrlInput(false); setUrlValue(""); }} style={{ background: "transparent", border: "none", color: X.textDim, fontSize: 18, cursor: "pointer", padding: "2px 6px" }}>×</button>
          </div>
        )}
        {showTblAdd && (() => {
          const doAdd = async () => { if (tblAddLoading || !draft.task.trim() || !draft.project.trim()) return; const proj = projects.find(p => p.name === draft.project); if (!proj) { showToast('找不到專案，請從列表中選擇', 'error'); return; } const dur = (draft.start && draft.end) ? Math.max(1, Math.ceil((pD(draft.end) - pD(draft.start)) / 864e5)) : null; setTblAddLoading(true); try { const result = await addTask(proj.id, { task: draft.task, startDate: draft.start ? toISO(draft.start) : null, endDate: draft.end ? toISO(draft.end) : null, duration: dur, owner: draft.owner, category: draft.category, priority: draft.priority, notes: draft.notes }); if (result?.success) { setDraft({ task: "", project: "", start: "", end: "", owner: "—", category: "活動", priority: "中", notes: "" }); setShowTblAdd(false); } } catch (err) { console.error("doAdd failed:", err); showToast('新增失敗，請稍後再試', 'error'); } finally { setTblAddLoading(false); } };
          return (<div style={{ padding: "12px 16px", background: X.surfaceLight, borderBottom: `1px solid ${X.accent}30` }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 3 }}>Project *</div><input value={draft.project} onChange={e => setDraft(p => ({ ...p, project: e.target.value }))} list="pl" style={iS2} /><datalist id="pl">{projects.map(p => <option key={p.id} value={p.name} />)}</datalist></div>
              <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 3 }}>Task *</div><input value={draft.task} onChange={e => setDraft(p => ({ ...p, task: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") doAdd(); }} style={iS2} /></div>
              <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 3 }}>Start</div><CalendarPicker value={draft.start} onChange={v => setDraft(p => ({ ...p, start: v }))} showTime /></div>
              <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 3 }}>End</div><CalendarPicker value={draft.end} onChange={v => setDraft(p => ({ ...p, end: v }))} showTime /></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ flex: 1, minWidth: isMobile ? 120 : undefined }}><TagInput value={draft.owner} onChange={v => setDraft(p => ({ ...p, owner: v }))} suggestions={configOwners} placeholder="Add owner..." /></div>
              <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} style={{ ...iS2, flex: 1, cursor: "pointer" }}>{configCats.map(o => <option key={o}>{o}</option>)}</select>
              <select value={draft.priority} onChange={e => setDraft(p => ({ ...p, priority: e.target.value }))} style={{ ...iS2, flex: isMobile ? 1 : 0.6, cursor: "pointer" }}><option>高</option><option>中</option><option>低</option></select>
              <button onClick={doAdd} disabled={tblAddLoading || !draft.task.trim() || !draft.project.trim()} style={{ background: (!tblAddLoading && draft.task.trim() && draft.project.trim()) ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "6px 20px", fontSize: 14, fontWeight: 700, cursor: (!tblAddLoading && draft.task.trim() && draft.project.trim()) ? "pointer" : "not-allowed", whiteSpace: "nowrap", opacity: tblAddLoading ? 0.6 : 1, ...(isMobile ? { width: "100%" } : {}) }}>{tblAddLoading ? "新增中..." : "Confirm"}</button>
            </div>
          </div>);
        })()}
        {isMobile ? (
          <div style={{ padding: 12 }}>
            {paged.length === 0 && <div style={{ padding: 40, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📊</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks found</div><div style={{ fontSize: 14 }}>Try adjusting your filters or create a new task</div></div>}
            {paged.map(d => { const sc = SC[d.status] || {}, pc = PC[d.priority] || {}; const isE = expanded.has(d.id); const tSubs = allS.filter(s => s.taskId === d.id);
              return (
                <div key={d.id} style={{ background: selectedRows.has(d.id) ? `${X.accent}10` : X.surface, borderRadius: 12, border: `1px solid ${selectedRows.has(d.id) ? X.accent + "40" : X.border}`, overflow: "hidden", marginBottom: 8 }}>
                  <div onClick={() => toggle(d.id)} style={{ padding: "12px 14px", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <input type="checkbox" checked={selectedRows.has(d.id)} onChange={e => { e.stopPropagation(); setSelectedRows(prev => { const n = new Set(prev); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; }); }} onClick={e => e.stopPropagation()} style={{ cursor: "pointer", accentColor: X.accent, flexShrink: 0 }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[d.project], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.task}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{d.status}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14, marginBottom: 6 }}>
                      <OwnerTags value={d.owner} configOwners={configOwners} />
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc.color }} />
                      <span style={{ fontSize: 13, color: pc.color, fontWeight: 500 }}>{d.priority}</span>
                      <div style={{ flex: 1, marginLeft: 4 }}><ProgressBar pct={d.progress} done={d.sDone} total={d.sTotal} timeBased={d.timeBased} /></div>
                    </div>
                    <div style={{ fontSize: 12, fontFamily: FM, color: X.textDim, paddingLeft: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      {fD(d.start)} → {fD(d.end)}
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, background: X.surfaceLight, color: CC[d.category] || X.textSec, fontWeight: 500 }}>{d.category}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: X.textDim }}>{d.project}</span>
                    </div>
                  </div>
                  {isE && (
                    <div style={{ borderTop: `1px solid ${X.border}` }}>
                      {d.notes && <div style={{ padding: "8px 14px", fontSize: 13, color: X.textSec, background: X.surfaceLight }}>{d.notes}</div>}
                      {tSubs.map(sub => (
                        <div key={sub.id} style={{ padding: "8px 14px", background: X.surfaceLight, borderTop: `1px solid ${X.border}22`, display: "flex", alignItems: "center", gap: 8 }}>
                          <span onClick={e => { e.stopPropagation(); toggleSub(sub.id); }} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff", cursor: "pointer" }}>{sub.done ? "✓" : ""}</span>
                          <span style={{ flexShrink: 0 }}><EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} style={{ fontSize: 13, color: X.textSec, textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }} /></span>
                          <InlineNote value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} />
                          <span><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} renderValue={v => <OwnerTags value={v} configOwners={configOwners} />} style={{ fontSize: 12, color: X.textDim }} /></span>
                          <button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 12, cursor: "pointer", padding: "2px 4px", opacity: 0.6 }}>×</button>
                        </div>
                      ))}
                      {showSubAdd === d.id
                        ? <div onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", background: X.surfaceLight, borderTop: `1px solid ${X.border}22`, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="Subtask name" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } if (e.key === "Escape") setShowSubAdd(null); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 120 }} />
                          <div style={{ flex: "0 0 140px" }}><TagInput value={subDraft.owner} onChange={v => setSubDraft(p => ({ ...p, owner: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="負責人..." style={{ fontSize: 13 }} /></div>
                          <button onClick={() => { if (subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                          <button onClick={() => setShowSubAdd(null)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>Cancel</button>
                        </div>
                        : <div onClick={e => { e.stopPropagation(); setShowSubAdd(d.id); setSubDraft({ name: "", owner: "" }); }} style={{ padding: "8px 14px", background: X.surfaceLight, borderTop: `1px solid ${X.border}22`, cursor: "pointer", opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}>
                          <span style={{ fontSize: 13, color: X.accent, fontWeight: 500 }}>+ Add subtask</span>
                        </div>
                      }
                      <div style={{ padding: "8px 14px", borderTop: `1px solid ${X.border}`, display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={e => { e.stopPropagation(); if (confirm("Delete?")) deleteTask(d.id); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 16, padding: "3px 12px", fontSize: 12, color: X.red, cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ); })}
          </div>
        ) : (
          <div ref={tableRef} tabIndex={-1} onKeyDown={handleTableKeyDown} style={{ overflowX: "auto", outline: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: X.surfaceLight }}>
                <th style={{ padding: "10px 6px", width: 36, borderBottom: `1px solid ${X.border}`, textAlign: "center" }}>
                  <input type="checkbox" checked={paged.length > 0 && paged.every(d => selectedRows.has(d.id))} onChange={e => { if (e.target.checked) { setSelectedRows(new Set(paged.map(d => d.id))); } else { setSelectedRows(new Set()); } }} style={{ cursor: "pointer", accentColor: X.accent }} />
                </th>
                {[{ k: "project", l: "Project" }, { k: "task", l: "Task" }, { k: "owner", l: "Owner" }, { k: "status", l: "Status" }, { k: "priority", l: "Pri" }, { k: "progress", l: "Progress" }, { k: "category", l: "Category" }, { k: "start", l: "Start" }, { k: "end", l: "End" }, { k: "notes", l: "Notes" }, { k: "creatorName", l: "Creator" }].map(col => (
                  <th key={col.k} onClick={() => handleSort(col.k)} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, color: X.textDim, fontSize: 13, borderBottom: `1px solid ${X.border}`, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>{col.l}<SI col={col.k} /></th>
                ))}
                <th style={{ padding: "10px 6px", width: 36, borderBottom: `1px solid ${X.border}` }} />
              </tr></thead>
              <tbody>
                {paged.length === 0 && <tr><td colSpan={12} style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📊</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks found</div><div style={{ fontSize: 14 }}>Try adjusting your filters or create a new task</div></td></tr>}
                {paged.map(d => { const sc = SC[d.status] || {}, pc = PC[d.priority] || {}; const isE = expanded.has(d.id); const tSubs = allS.filter(s => s.taskId === d.id);
                  return [
                    <tr key={d.id} style={{ borderBottom: `1px solid ${isE ? X.border : X.border + "40"}`, background: selectedRows.has(d.id) ? `${X.accent}10` : "transparent" }} onMouseEnter={e => { if (!selectedRows.has(d.id)) e.currentTarget.style.background = X.surfaceHover; }} onMouseLeave={e => { if (!selectedRows.has(d.id)) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "9px 6px", textAlign: "center" }}><input type="checkbox" checked={selectedRows.has(d.id)} onChange={e => { setSelectedRows(prev => { const n = new Set(prev); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; }); }} style={{ cursor: "pointer", accentColor: X.accent }} /></td>
                      <td style={{ padding: "9px 8px", fontWeight: 500, maxWidth: 140 }}><div style={{ display: "flex", alignItems: "center" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: pcMap[d.project], marginRight: 6, flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><EditableCell value={d.project} onSave={v => updateTask(d.id, "project", v)} {...cellP(d.id, "project")} /></div></div></td>
                      <td style={{ padding: "9px 8px", maxWidth: 200 }}><div style={{ display: "flex", alignItems: "center" }}><span onClick={e => { e.stopPropagation(); toggle(d.id); }} style={{ color: X.textDim, marginRight: 6, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>{isE ? "▾" : "▸"}</span><div style={{ flex: 1, minWidth: 0 }}><EditableCell value={d.task} onSave={v => updateTask(d.id, "task", v)} {...cellP(d.id, "task")} /></div></div></td>
                      <td style={{ padding: "9px 8px", fontSize: 14 }}><EditableCell value={d.owner} onSave={v => updateTask(d.id, "owner", v)} {...cellP(d.id, "owner")} renderValue={v => <OwnerTags value={v} configOwners={configOwners} />} /></td>
                      <td style={{ padding: "9px 8px" }}><EditableCell value={d.status} onSave={v => updateTask(d.id, "status", v)} {...cellP(d.id, "status")} options={["已完成", "進行中", "待辦", "提案中", "待確認"]} style={{ padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600 }} /></td>
                      <td style={{ padding: "9px 8px" }}><EditableCell value={d.priority} onSave={v => updateTask(d.id, "priority", v)} {...cellP(d.id, "priority")} options={["高", "中", "低"]} style={{ color: pc.color, fontSize: 14, fontWeight: 600 }} /></td>
                      <td style={{ padding: "9px 8px", minWidth: 110 }}><ProgressBar pct={d.progress} done={d.sDone} total={d.sTotal} timeBased={d.timeBased} /></td>
                      <td style={{ padding: "9px 8px" }}><EditableCell value={d.category} onSave={v => updateTask(d.id, "category", v)} {...cellP(d.id, "category")} options={configCats} style={{ padding: "2px 8px", borderRadius: 8, background: X.surfaceLight, color: CC[d.category] || X.textSec, fontSize: 14, fontWeight: 500 }} /></td>
                      <td style={{ padding: "9px 8px" }}><EditableCell value={d.start} onSave={v => updateTask(d.id, "start", v)} {...cellP(d.id, "start")} isDate style={{ fontFamily: FM, fontSize: 14, color: X.text }} /></td>
                      <td style={{ padding: "9px 8px" }}><EditableCell value={d.end} onSave={v => updateTask(d.id, "end", v)} {...cellP(d.id, "end")} isDate style={{ fontFamily: FM, fontSize: 14, color: X.text }} /></td>
                      <td style={{ padding: "9px 8px", maxWidth: 180 }}><EditableCell value={d.notes} onSave={v => updateTask(d.id, "notes", v)} {...cellP(d.id, "notes")} style={{ fontSize: 14, color: X.textSec }} /></td>
                      <td style={{ padding: "9px 8px", fontSize: 12, color: X.textDim, whiteSpace: "nowrap" }}>{d.creatorName || "—"}{d.source && <span style={{ marginLeft: 4, padding: "0 4px", borderRadius: 4, background: d.source === 'csv_import' ? `${X.purple}15` : `${X.accent}15`, color: d.source === 'csv_import' ? X.purple : X.accent, fontSize: 10, fontWeight: 600 }}>{d.source === 'csv_import' ? 'CSV' : '手動'}</span>}</td>
                      <td style={{ padding: "6px", textAlign: "center" }}><button onClick={e => { e.stopPropagation(); if (confirm("Delete?")) deleteTask(d.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: X.red, fontSize: 14, padding: "2px 6px" }}>×</button></td>
                    </tr>,
                    ...(isE ? [...tSubs.map(sub => (
                      <tr key={sub.id} style={{ background: X.surfaceLight, borderBottom: `1px solid ${X.border}22` }}>
                        <td />
                        <td />
                        <td style={{ padding: "7px 8px 7px 30px", fontSize: 14 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={e => { e.stopPropagation(); toggleSub(sub.id); }}>
                            <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff" }}>{sub.done ? "✓" : ""}</span>
                            <EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} {...cellP(sub.id, "name")} style={{ textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1, color: X.textSec }} />
                          </label>
                        </td>
                        <td style={{ padding: "7px 8px", fontSize: 14 }}><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} {...cellP(sub.id, "owner")} renderValue={v => <OwnerTags value={v} configOwners={configOwners} />} style={{ color: X.textDim }} /></td>
                        <td colSpan={2} style={{ padding: "7px 8px" }}>{sub.done ? <span style={{ fontSize: 14, color: X.green, fontWeight: 600 }}>Done</span> : <span style={{ fontSize: 14, color: X.textDim }}>Pending</span>}</td>
                        <td style={{ padding: "7px 8px", fontFamily: FM, fontSize: 14, color: sub.done ? X.green : X.textDim }}>{sub.done_date ? fD(sub.done_date) : "\u2014"}</td>
                        <td colSpan={5} style={{ padding: "7px 8px", fontSize: 14 }}><EditableCell value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} {...cellP(sub.id, "notes")} style={{ color: X.textDim }} /></td>
                        <td style={{ padding: "4px", textAlign: "center" }}><button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button></td>
                      </tr>)),
                      <tr key={d.id + "_addsub"} style={{ background: X.surfaceLight, borderBottom: `1px solid ${X.border}22` }}>
                        <td />
                        <td />
                        <td colSpan={11} style={{ padding: "6px 8px 6px 30px" }}>
                          {showSubAdd === d.id
                            ? <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="Subtask name" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } if (e.key === "Escape") setShowSubAdd(null); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "4px 10px" }} />
                              <div style={{ flex: "0 0 160px" }}><TagInput value={subDraft.owner} onChange={v => setSubDraft(p => ({ ...p, owner: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="負責人..." style={{ fontSize: 13 }} /></div>
                              <button onClick={() => { if (subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "3px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                              <button onClick={() => setShowSubAdd(null)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "3px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>Cancel</button>
                            </div>
                            : <span onClick={e => { e.stopPropagation(); setShowSubAdd(d.id); setSubDraft({ name: "", owner: "" }); }} style={{ fontSize: 13, color: X.accent, fontWeight: 500, cursor: "pointer", opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}>+ Add subtask</span>
                          }
                        </td>
                      </tr>
                    ] : [])
                  ]; })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {sorted.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${X.border}`, fontSize: 13, color: X.textSec, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>每頁</span>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ background: X.surfaceLight, color: X.text, border: `1px solid ${X.border}`, borderRadius: 8, padding: "4px 8px", fontSize: 13, cursor: "pointer", outline: "none" }}>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>筆</span>
            <span style={{ marginLeft: 8, color: X.textDim }}>共 {sorted.length} 筆</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ background: safePage <= 1 ? X.surfaceLight : X.surface, color: safePage <= 1 ? X.textDim : X.text, border: `1px solid ${X.border}`, borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: safePage <= 1 ? "not-allowed" : "pointer", opacity: safePage <= 1 ? 0.5 : 1 }}>上一頁</button>
            <span style={{ fontFamily: FM, minWidth: 80, textAlign: "center" }}>{safePage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ background: safePage >= totalPages ? X.surfaceLight : X.surface, color: safePage >= totalPages ? X.textDim : X.text, border: `1px solid ${X.border}`, borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: safePage >= totalPages ? "not-allowed" : "pointer", opacity: safePage >= totalPages ? 0.5 : 1 }}>下一頁</button>
          </div>
        </div>
      )}
      {showCleanAllModal && (
        <div onClick={() => setShowCleanAllModal(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: X.surface, borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: `0 16px 48px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: X.red }}>Clean All</div>
            <div style={{ fontSize: 14, color: X.textSec, marginBottom: 16 }}>此操作將刪除所有任務、子任務、連結及檔案，且無法復原。</div>
            <div style={{ fontSize: 13, color: X.textDim, marginBottom: 8 }}>請輸入 <span style={{ fontWeight: 700, color: X.text }}>clean all</span> 以確認刪除：</div>
            <input value={cleanAllInput} onChange={e => setCleanAllInput(e.target.value)} placeholder="clean all" autoFocus style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${X.border}`, background: X.surfaceLight, color: X.text, fontSize: 15, outline: "none", marginBottom: 16 }} onKeyDown={e => { if (e.key === "Enter" && cleanAllInput === "clean all") { deleteAllTasks(); setShowCleanAllModal(false); } }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowCleanAllModal(false)} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "8px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button onClick={() => { if (cleanAllInput === "clean all") { deleteAllTasks(); setShowCleanAllModal(false); } }} disabled={cleanAllInput !== "clean all"} style={{ background: cleanAllInput === "clean all" ? X.red : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: cleanAllInput === "clean all" ? "pointer" : "not-allowed" }}>確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(DataTab);
