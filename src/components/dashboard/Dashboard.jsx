"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { THEMES, THEME_ORDER, X, SC, PC, CC, PJC, F, FM, applyTheme, getIS2 } from "@/lib/theme";
import { pD, fD, toISO, computeProgress, tasksToCSV, parseCSV, downloadCSV } from "@/lib/utils";
import useTaskManager from "@/hooks/useTaskManager";
import EditableCell from "./EditableCell";
import InlineNote from "./InlineNote";
import CalendarPicker from "./CalendarPicker";
import TagInput from "./TagInput";
import OwnerTags from "./OwnerTags";
import ProgressBar from "./ProgressBar";
import TaskModal from "./TaskModal";
import FileManagerModal from "./FileManagerModal";
import GanttTimeline, { TimeScaleToggle, computeScaleDivisions } from "./GanttTimeline";
import MobileProjectTimeline from "./MobileProjectTimeline";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const EDITABLE_COLS = ["project","task","owner","status","priority","category","start","end","notes"];
const SUB_EDITABLE_COLS = ["name","owner","notes"];
const COL_POS = { project: 0, task: 1, name: 1, owner: 2, status: 3, priority: 4, category: 6, start: 7, end: 8, notes: 9 };
const getEditableCols = (type) => type === "sub" ? SUB_EDITABLE_COLS : EDITABLE_COLS;

function SortableSubItem({ sub, toggleSub, updateSub, deleteSub, configOwners }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sub.id });
  const sStyle = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={sStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, marginBottom: 2 }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span {...attributes} {...listeners} style={{ cursor: "grab", fontSize: 14, color: X.textDim, flexShrink: 0, userSelect: "none" }}>⠿</span>
        <span onClick={e => { e.stopPropagation(); toggleSub(sub.id); }} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff", cursor: "pointer" }}>{sub.done ? "✓" : ""}</span>
        <span style={{ flexShrink: 0, maxWidth: "40%" }}><EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} style={{ fontSize: 13, color: X.textSec, textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }} /></span>
        <InlineNote value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} />
        <span><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} options={configOwners} style={{ fontSize: 12, color: X.textDim }} /></span>
        <button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 12, cursor: "pointer", padding: "2px 4px", opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>×</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    projects, allT, setAllT, allS, setAllS,
    allL, setAllL, allF, setAllF,
    twp,
    toast, showToast,
    toggleSub, updateTask, updateSub,
    addTask, deleteTask, addSub, deleteSub,
    addLink, deleteLink, addFile, deleteFile,
    renameProject, addProject, deleteProject: deleteProjectAction,
    reorderSubs, importTasks,
    configCats, setConfigCats, configOwners, setConfigOwners,
    reload: reloadSheet,
  } = useTaskManager();
  const [expanded, setExpanded] = useState(new Set());
  const [fpSet, setFPSet] = useState(new Set());
  const toggleFP = p => setFPSet(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const [fs, setFS] = useState("全部");
  const [fpr, setFPR] = useState("全部");
  const [tab, setTab] = useState("overview");
  const [selProj, setSelProj] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [showCreateProj, setShowCreateProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [archived, setArchived] = useState(new Set());
  const [showArch, setShowArch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showTblAdd, setShowTblAdd] = useState(false);
  const [customProjects, setCustomProjects] = useState(new Set());
  const [modalTask, setModalTask] = useState(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [draft, setDraft] = useState({ task: "", project: "", start: "", end: "", owner: "—", category: "活動", priority: "中", notes: "" });
  const [subDraft, setSubDraft] = useState({ name: "", owner: "" });
  const [showSubAdd, setShowSubAdd] = useState(null);
  const [projIcons, setProjIcons] = useState({});
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [ovHover, setOvHover] = useState(null);
  const [timeDim, setTimeDim] = useState("月");
  const defaultGW = { day: 20, week: 50, month: 50, quarter: 100 };
  const [ganttWidths, setGanttWidths] = useState(() => {
    try { const s = localStorage.getItem("dash-ganttWidths"); if (s) { const parsed = JSON.parse(s); if (parsed.day !== undefined && !parsed.overview) { return { overview: { ...parsed }, project: { ...parsed }, timeline: { ...parsed } }; } return parsed; } } catch {}
    return { overview: { ...defaultGW }, project: { ...defaultGW }, timeline: { ...defaultGW } };
  });
  const [ganttDraft, setGanttDraft] = useState(() => JSON.parse(JSON.stringify(ganttWidths)));
  const saveGanttWidths = () => { const filled = {}; for (const v of ["overview", "project", "timeline"]) { filled[v] = {}; for (const k of ["day", "week", "month", "quarter"]) { const val = ganttDraft[v]?.[k]; filled[v][k] = (val === '' || val == null) ? defaultGW[k] : Math.max(1, val); } } const deep = JSON.parse(JSON.stringify(filled)); setGanttWidths(deep); setGanttDraft(JSON.parse(JSON.stringify(deep))); localStorage.setItem("dash-ganttWidths", JSON.stringify(deep)); showToast("Timeline widths saved", "success"); };
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeCell, setActiveCell] = useState(null);
  const [editingCell, setEditingCell] = useState(false);
  const [initialTypedChar, setInitialTypedChar] = useState(null);
  const tableRef = useRef(null);

  // Theme
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem("dash-theme") || "warm"; } catch { return "warm"; } });
  applyTheme(themeKey);
  const cycleTheme = useCallback(() => { setThemeKey(p => { const i = THEME_ORDER.indexOf(p); return THEME_ORDER[(i + 1) % THEME_ORDER.length]; }); }, []);
  useEffect(() => { try { localStorage.setItem("dash-theme", themeKey); } catch {} document.body.style.background = X.bg; window.dispatchEvent(new Event('theme-change')); }, [themeKey]);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 10); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);
  const [isMobile, setIsMobile] = useState(() => { try { return window.innerWidth <= 768; } catch { return false; } });
  useEffect(() => { const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  // Operations
  const toggle = id => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const archiveProj = useCallback(p => { setArchived(prev => { const n = new Set(prev); n.add(p); return n; }); setSelProj(null); showToast("Project archived", "warn"); }, [showToast]);
  const unarchiveProj = useCallback(p => { setArchived(prev => { const n = new Set(prev); n.delete(p); return n; }); showToast("Project unarchived", "success"); }, [showToast]);
  const deleteProj = useCallback(p => { const ids = allT.filter(t => t.project === p).map(t => t.id); setAllT(prev => prev.filter(t => t.project !== p)); setAllS(prev => prev.filter(s => !ids.includes(s.taskId))); setAllL(prev => prev.filter(l => !ids.includes(l.taskId))); setAllF(prev => prev.filter(f => !ids.includes(f.taskId))); setCustomProjects(prev => { const n = new Set(prev); n.delete(p); return n; }); setSelProj(null); showToast("Project deleted", "error"); }, [allT, showToast, setAllT, setAllS, setAllL, setAllF]);
  const createProj = useCallback(name => { if (!name.trim()) return; setCustomProjects(p => { const n = new Set(p); n.add(name.trim()); return n; }); setShowCreateProj(false); setNewProjName(""); setSelProj(name.trim()); showToast("Project created", "success"); }, [showToast]);
  const handleIconUpload = (e, proj) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { setProjIcons(p => ({ ...p, [proj]: ev.target.result })); }; reader.readAsDataURL(file); };

  // Computed
  const projectNames = useMemo(() => [...new Set(twp.map(d => d.project))], [twp]);
  const filtered = useMemo(() => twp.filter(d => { if (fpSet.size > 0 && !fpSet.has(d.project)) return false; if (fs !== "全部" && d.status !== fs) return false; if (fpr !== "全部" && d.priority !== fpr) return false; if (searchQ) { const q = searchQ.toLowerCase(); if (!(d.task || "").toLowerCase().includes(q) && !(d.project || "").toLowerCase().includes(q) && !(d.owner || "").toLowerCase().includes(q) && !(d.notes || "").toLowerCase().includes(q)) return false; } return true; }), [fpSet, fs, fpr, twp, searchQ]);
  const sorted = useMemo(() => { if (!sortCol) return filtered; const po = { "高": 0, "中": 1, "低": 2 }; return [...filtered].sort((a, b) => { let va = a[sortCol], vb = b[sortCol]; if (sortCol === "start" || sortCol === "end") { va = va ? pD(va).getTime() : 0; vb = vb ? pD(vb).getTime() : 0; } if (sortCol === "duration" || sortCol === "progress") { va = va || 0; vb = vb || 0; } if (sortCol === "priority") { va = po[va] ?? 9; vb = po[vb] ?? 9; } if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); } return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0); }); }, [filtered, sortCol, sortDir]);
  const flatRows = useMemo(() => { const rows = []; sorted.forEach(d => { rows.push({ type: "task", id: d.id, data: d }); if (expanded.has(d.id)) { allS.filter(s => s.taskId === d.id).forEach(sub => { rows.push({ type: "sub", id: sub.id, data: sub }); }); } }); return rows; }, [sorted, expanded, allS]);
  const stats = useMemo(() => { const s = {}; Object.keys(SC).forEach(k => s[k] = 0); filtered.forEach(d => s[d.status]++); return s; }, [filtered]);
  const avgProg = useMemo(() => filtered.length === 0 ? 0 : Math.round(filtered.reduce((s, d) => s + d.progress, 0) / filtered.length), [filtered]);
  const priStats = useMemo(() => { const p = { "高": 0, "中": 0, "低": 0 }; filtered.forEach(d => p[d.priority]++); return p; }, [filtered]);
  const projStats = useMemo(() => { const p = {}; filtered.forEach(d => { if (!p[d.project]) p[d.project] = { total: 0, pSum: 0 }; p[d.project].total++; p[d.project].pSum += d.progress; }); return p; }, [filtered]);
  const handleSort = col => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };
  const SI = ({ col }) => sortCol !== col ? <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span> : <span style={{ marginLeft: 3, color: X.accent }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  const allProjNames = useMemo(() => [...new Set([...twp.map(d => d.project), ...customProjects])], [twp, customProjects]);
  const pcMap = {}; allProjNames.forEach((p, i) => { pcMap[p] = PJC[i % PJC.length]; });
  const iS2 = getIS2();

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

  useEffect(() => {
    if (!activeCell) return;
    const h = (e) => { if (tableRef.current && !tableRef.current.contains(e.target)) { setActiveCell(null); setEditingCell(false); setInitialTypedChar(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [activeCell]);

  useEffect(() => {
    if (activeCell && !editingCell) tableRef.current?.focus();
  }, [activeCell, editingCell]);

  return (
    <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text, transition: "background-color 0.3s,color 0.3s" }}>
      <style>{`::selection{background:${X.selectionBg}} *{box-sizing:border-box} ::-webkit-scrollbar{width:10px;height:10px} ::-webkit-scrollbar-thumb{background:${X.scrollThumb};border-radius:5px} ::-webkit-scrollbar-track{background:transparent} input,select,button{font-family:'Noto Sans TC',-apple-system,sans-serif}`}</style>
      <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => { if (uploadTarget) handleIconUpload(e, uploadTarget); setUploadTarget(null); }} />

      {/* Header */}
      <div className="dash-header" style={{ borderBottom: `1px solid ${X.border}`, position: "sticky", top: 0, zIndex: 50, background: X.surface, boxShadow: scrolled ? `0 2px 8px ${X.shadow}` : "none", transition: "box-shadow 0.2s" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", ...(isMobile ? {} : { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }) }}>
          {isMobile ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: X.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff" }}>P</div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>專案管理</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div onClick={cycleTheme} title={THEMES[themeKey].label}
                    style={{ width: 48, height: 24, borderRadius: 12, background: themeKey === "warm" ? X.accent : X.border, cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: themeKey === "warm" ? 26 : 2, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                      {THEMES[themeKey].icon}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FM, fontSize: 20, fontWeight: 700, color: X.accent, lineHeight: 1 }}>{avgProg}%</div>
                  </div>
                </div>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 14, color: X.textDim, pointerEvents: "none" }}>🔍</span>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks..." style={{ fontFamily: F, fontSize: 14, padding: "8px 32px 8px 34px", borderRadius: 20, border: `1px solid ${X.border}`, outline: "none", background: X.surfaceLight, color: X.text, transition: "border-color 0.2s", width: "100%" }} onFocus={e => e.target.style.borderColor = X.accent} onBlur={e => e.target.style.borderColor = X.border} />
                {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: X.textDim, fontSize: 16, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>×</button>}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: X.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17, color: "#fff" }}>P</div>
                <span className="dash-title" style={{ fontWeight: 700 }}>專案管理儀表板</span>
              </div>
              <div className="dash-hdr-right">
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: 10, fontSize: 14, color: X.textDim, pointerEvents: "none" }}>🔍</span>
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks..." className="dash-search" style={{ fontFamily: F, fontSize: 14, padding: "8px 32px 8px 34px", borderRadius: 20, border: `1px solid ${X.border}`, outline: "none", background: X.surfaceLight, color: X.text, transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = X.accent} onBlur={e => e.target.style.borderColor = X.border} />
                  {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: X.textDim, fontSize: 16, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>×</button>}
                </div>
                <div onClick={cycleTheme} title={THEMES[themeKey].label}
                  style={{ width: 56, height: 28, borderRadius: 14, background: themeKey === "warm" ? X.accent : X.border, cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 3, left: themeKey === "warm" ? 31 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    {THEMES[themeKey].icon}
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: X.border }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, color: X.textDim, fontFamily: FM }}>Overall</div>
                  <div className="dash-pct-lg" style={{ color: X.accent, fontWeight: 700, fontFamily: FM, lineHeight: 1 }}>{avgProg}%</div>
                </div>
                <div style={{ width: 1, height: 28, background: X.border }} />
                <div style={{ fontFamily: FM, fontSize: 14, color: X.textSec }}>{new Date().toLocaleDateString("zh-TW")} · {filtered.length} tasks</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dash-content" style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: isMobile ? 6 : 8, marginBottom: isMobile ? 12 : 20, flexWrap: "wrap", alignItems: "center" }}>
          {["全部", "進行中", "待辦", "已完成", "提案中", "待確認"].map(s => { const a = fs === s, c = SC[s]; return (
            <button key={s} onClick={() => setFS(s)} style={{ padding: isMobile ? "4px 10px" : "6px 16px", borderRadius: 20, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec, fontSize: isMobile ? 13 : 14, fontWeight: a ? 700 : 400, cursor: "pointer" }}>{s}</button>); })}
          <div style={{ width: 1, height: 20, background: X.border }} />
          {["全部", "高", "中", "低"].map(p => { const a = fpr === p, c = PC[p]; return (
            <button key={p} onClick={() => setFPR(p)} style={{ padding: isMobile ? "4px 10px" : "6px 14px", borderRadius: 20, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec, fontSize: isMobile ? 13 : 14, fontWeight: a ? 700 : 400, cursor: "pointer" }}>{p === "全部" ? "Priority" : p}</button>); })}
        </div>

        {/* Status cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(160px, 1fr))", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 12 : 20 }}>
          {Object.entries(SC).map(([k, c]) => (<div key={k} onClick={() => setFS(fs === k ? "全部" : k)} style={{ background: X.surface, borderRadius: 12, padding: isMobile ? "12px 14px" : "16px 18px", border: fs === k ? `1px solid ${c.color}` : `1px solid ${X.border}`, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: X.textSec }}>{k}</span><span style={{ color: c.color, fontSize: 18 }}>{c.icon}</span>
            </div>
            <div className="dash-stat-num" style={{ fontWeight: 700, fontFamily: FM, lineHeight: 1, overflow: "hidden" }}>{stats[k] || 0}</div>
          </div>))}
          <div style={{ background: X.surface, borderRadius: 12, padding: "16px 18px", border: `1px solid ${X.border}`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 2 }}>Priority</div>
            {Object.entries(PC).map(([k, c]) => (<div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
              <span style={{ fontSize: 14, color: X.textSec, flex: 1 }}>{k}</span>
              <span style={{ fontFamily: FM, fontSize: 12, fontWeight: 600 }}>{priStats[k]}</span>
            </div>))}
          </div>
        </div>

        {/* Project filter tags */}
        <div style={{ display: "flex", gap: 6, marginBottom: isMobile ? 12 : 20, alignItems: "center", ...(isMobile ? { overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: 4 } : { flexWrap: "wrap" }) }}>
          {allProjNames.map(p => { const a = fpSet.has(p); const cl = pcMap[p] || X.accent; return (
            <button key={p} onClick={() => toggleFP(p)} style={{ padding: "5px 12px", borderRadius: 20, border: a ? `2px solid ${cl}` : `1px solid ${X.border}`, background: a ? `${cl}18` : X.surface, color: a ? cl : X.textSec, fontSize: isMobile ? 13 : 14, fontWeight: a ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: cl, opacity: a ? 1 : 0.4 }} />
              {p}
            </button>); })}
          {fpSet.size > 0 && <button onClick={() => setFPSet(new Set())} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${X.border}`, background: X.surface, color: X.textDim, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>Clear</button>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${X.border}`, marginBottom: isMobile ? 12 : 20, ...(isMobile ? { overflowX: "auto" } : {}) }}>
          {[{ k: "overview", l: "Overview" }, { k: "projects", l: "Projects" }, { k: "timeline", l: "Timeline" }, { k: "table", l: "Data" }, { k: "settings", l: "Settings" }].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k !== "projects") setSelProj(null); }} style={{ padding: isMobile ? "10px 14px" : "12px 20px", border: "none", background: "transparent", color: tab === t.k ? X.accent : X.textSec, fontSize: 14, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer", borderBottom: tab === t.k ? `2px solid ${X.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0 }}>{t.l}</button>))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (<>
          {/* Project Timeline */}
          <div style={{ background: X.surface, borderRadius: 12, padding: isMobile ? 14 : 20, border: `1px solid ${X.border}`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 16px", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.accent, borderRadius: 2 }} />Project Timeline</h3>
              <TimeScaleToggle value={timeDim} onChange={setTimeDim} />
            </div>
            {(() => {
              const projList = [...new Set(twp.map(d => d.project))];
              const projBars = projList.map(pn => {
                const pt = twp.filter(d => d.project === pn && d.start && d.end);
                if (!pt.length) return null;
                const dates = pt.flatMap(t => [pD(t.start), pD(t.end)]);
                const s = new Date(Math.min(...dates)), e = new Date(Math.max(...dates));
                const avg = Math.round(twp.filter(d => d.project === pn).reduce((sum, t) => sum + t.progress, 0) / twp.filter(d => d.project === pn).length);
                return { name: pn, start: s, end: e, avg, color: pcMap[pn] || X.accent };
              }).filter(Boolean);
              if (isMobile) return <MobileProjectTimeline projBars={projBars} />;
              if (!projBars.length) return (<div style={{ padding: 40, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📅</div><div style={{ fontSize: 14 }}>No timeline data available</div></div>);
              const allDates = projBars.flatMap(p => [p.start, p.end]);
              const mn = new Date(Math.min(...allDates)), mx = new Date(Math.max(...allDates));
              const td = (mx - mn) / 864e5 + 1;
              const todayPct = ((new Date() - mn) / 864e5) / td * 100;
              const months = computeScaleDivisions(mn, mx, td, timeDim);
              const ovGW = ganttWidths.overview || { day: 20, week: 50, month: 50, quarter: 100 };
              const ovMinW = timeDim === "日" ? Math.max(700, td * ovGW.day) : timeDim === "週" ? Math.max(700, Math.ceil(td / 7) * ovGW.week) : timeDim === "季" ? Math.max(700, months.length * ovGW.quarter) : Math.max(700, months.length * ovGW.month);
              return (<div style={ovMinW > 0 ? { overflowX: "auto" } : {}}>
              <div>
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <div className="dash-tl-label" />
                  <div style={{ width: ovMinW, position: "relative", height: 20, flexShrink: 0 }}>
                    {(() => { const step = timeDim === "日" ? Math.max(1, Math.ceil(40 / (ovGW.day || 20))) : timeDim === "週" ? 2 : 1; return months.filter((_, i) => i % step === 0); })().map((m, i) => (<div key={i} style={{ position: "absolute", left: `${m.pct}%`, fontSize: 11, color: X.textDim, whiteSpace: "nowrap" }}>{m.isFirst ? `${m.year} ` : ""}{m.label}</div>))}
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  {projBars.map((p, i) => {
                    const l = ((p.start - mn) / 864e5) / td * 100;
                    const w = Math.max(1, ((p.end - p.start) / 864e5 + 1) / td * 100);
                    const fmtD = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                    return (<div key={p.name} style={{ display: "flex", alignItems: "center", height: 32, gap: 8, position: "relative" }}>
                      <div className="dash-tl-label" style={{ fontSize: 14, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", paddingRight: 8, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />{p.name}
                      </div>
                      <div style={{ width: ovMinW, position: "relative", height: 18, flexShrink: 0 }}>
                        {months.map((m, mi) => (<div key={mi} style={{ position: "absolute", left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: X.borderLight }} />))}
                        <div onMouseEnter={() => setOvHover(i)} onMouseLeave={() => setOvHover(null)} style={{ position: "absolute", left: `${l}%`, width: `${w}%`, height: "100%", borderRadius: 4, background: `${p.color}35`, border: `1px solid ${p.color}45`, minWidth: 6, cursor: "pointer", zIndex: 1 }} />
                        <div style={{ position: "absolute", left: `${l}%`, width: `${w * p.avg / 100}%`, height: "100%", borderRadius: 4, background: p.color, opacity: p.avg === 100 ? 0.55 : 0.85, minWidth: p.avg > 0 ? 4 : 0, pointerEvents: "none" }} />
                        {w > 5 && <div style={{ position: "absolute", left: `${l + w + 0.5}%`, top: 2, fontSize: 14, fontFamily: FM, color: p.avg === 100 ? X.green : p.color, fontWeight: 600, pointerEvents: "none" }}>{p.avg}%</div>}
                        {ovHover === i && <div style={{ position: "absolute", left: `${l}%`, bottom: 20, background: X.surface, color: X.text, fontSize: 13, padding: "6px 12px", borderRadius: 8, whiteSpace: "nowrap", zIndex: 30, boxShadow: `0 4px 16px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, pointerEvents: "none" }}>{fmtD(p.start)} → {fmtD(p.end)}　Progress: {p.avg}%</div>}
                      </div>
                    </div>);
                  })}
                  {todayPct >= 0 && todayPct <= 100 && <div style={{ position: "absolute", left: `${130 + 8}px`, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}><div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: `2px dashed ${X.accent}`, opacity: 0.5 }} /></div>}
                </div>
              </div></div>);
            })()}
          </div>

          {/* Overdue + Upcoming */}
          <div className="dash-grid-2col">
            {(() => {
              const now = new Date();
              const overdue = filtered.filter(t => { if (!t.end || t.status === "已完成") return false; return pD(t.end) < now; }).sort((a, b) => pD(a.end) - pD(b.end));
              return (<div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.red, borderRadius: 2 }} />Overdue Tasks</h3>
                {overdue.length === 0 ? (<div style={{ padding: 30, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div><div style={{ fontSize: 14, fontWeight: 600, color: X.green }}>No overdue tasks</div><div style={{ fontSize: 13, color: X.textDim, marginTop: 4 }}>All tasks are on track</div></div>)
                : overdue.map(t => { const ed = pD(t.end); const days = Math.ceil((now - ed) / 864e5);
                  return (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${X.border}22` }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task}</div>
                      <div style={{ fontSize: 12, color: X.textSec }}>{t.project} · {t.owner}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FM, color: X.red }}>-{days}d</div>
                      <div style={{ fontSize: 11, color: X.textSec, fontFamily: FM }}>{fD(t.end)}</div>
                    </div>
                  </div>); })}
              </div>);
            })()}
            {(() => {
              const now = new Date(); const in30 = new Date(now.getTime() + 30 * 864e5);
              const upcoming = filtered.filter(t => { if (!t.end || t.status === "已完成") return false; const ed = pD(t.end); return ed >= now && ed <= in30; }).sort((a, b) => pD(a.end) - pD(b.end)).slice(0, 5);
              return (<div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.red, borderRadius: 2 }} />Upcoming Deadlines</h3>
                {upcoming.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: X.textDim, fontSize: 14 }}>No upcoming deadlines in next 30 days</div>)
                : upcoming.map(t => { const ed = pD(t.end); const days = Math.ceil((ed - now) / 864e5); const urgent = days <= 7;
                  return (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${X.border}22` }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task}</div>
                      <div style={{ fontSize: 12, color: X.textSec }}>{t.project} · {t.owner}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FM, color: urgent ? X.red : X.amber }}>{days}d</div>
                      <div style={{ fontSize: 11, color: X.textSec, fontFamily: FM }}>{fD(t.end)}</div>
                    </div>
                  </div>); })}
              </div>);
            })()}
          </div>

          {/* Project Progress + Status Distribution */}
          <div className="dash-grid-2col" style={{ marginTop: 16 }}>
            <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.accent, borderRadius: 2 }} />Project Progress</h3>
              {Object.entries(projStats).map(([proj, s]) => { const avg = s.total > 0 ? Math.round(s.pSum / s.total) : 0; return (
                <div key={proj} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[proj] }} />
                      {projIcons[proj] && <img src={projIcons[proj]} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover" }} />}{proj}
                    </span>
                    <span style={{ fontFamily: FM, fontSize: 12, color: X.textDim }}>{avg}%</span>
                  </div>
                  <div style={{ height: 5, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${avg}%`, background: pcMap[proj], borderRadius: 2, opacity: 0.8 }} /></div>
                </div>); })}
            </div>
            <div style={{ background: X.surface, borderRadius: 12, padding: 16, border: `1px solid ${X.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Status Distribution</h3>
              {(() => { const entries = Object.entries(SC).map(([k, c]) => ({ label: k, count: stats[k] || 0, color: c.color })); const total = entries.reduce((s, e) => s + e.count, 0); if (!total) return null;
                const cx = 100, cy = 100, R = 90, r = 58; let ca = -Math.PI / 2; const g = 0.04;
                const arcs = entries.filter(e => e.count > 0).map(e => { const a = (e.count / total) * Math.PI * 2 - g, sa = ca + g / 2; ca += a + g; const ea = sa + a, la = a > Math.PI ? 1 : 0;
                  const d = `M${cx + R * Math.cos(sa)},${cy + R * Math.sin(sa)} A${R},${R} 0 ${la} 1 ${cx + R * Math.cos(ea)},${cy + R * Math.sin(ea)} L${cx + r * Math.cos(ea)},${cy + r * Math.sin(ea)} A${r},${r} 0 ${la} 0 ${cx + r * Math.cos(sa)},${cy + r * Math.sin(sa)} Z`;
                  return { ...e, d, pct: Math.round(e.count / total * 100) }; });
                return (<div className="dash-chart-wrap">
                  <div className="dash-chart-svg" style={{ position: "relative" }}>
                    <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>{arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity={0.85} />)}</svg>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                      <div style={{ fontFamily: FM, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{total}</div>
                      <div style={{ fontSize: 14, color: X.textDim, marginTop: 2 }}>Total</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {arcs.map((a, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, opacity: 0.85 }} />
                      <span style={{ fontSize: 14, color: X.textSec, minWidth: 42 }}>{a.label}</span>
                      <span style={{ fontFamily: FM, fontSize: 12, fontWeight: 600 }}>{a.count}</span>
                      <span style={{ fontFamily: FM, fontSize: 12, color: X.textDim }}>({a.pct}%)</span>
                    </div>))}
                  </div>
                </div>);
              })()}
            </div>
          </div>

          {/* Team Workload + Tasks per Project */}
          <div className="dash-grid-2col" style={{ marginTop: 16 }}>
            {(() => {
              const ownerMap = {}; filtered.forEach(t => { ownerMap[t.owner] = (ownerMap[t.owner] || 0) + 1; });
              const owners = Object.entries(ownerMap).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count);
              const ownerColors = [X.accent, X.purple, X.amber, X.red, X.green, "#06B6D4", X.pink, X.accentDark, "#8B949E", "#D2A8FF"];
              const gm = Math.ceil(Math.max(...owners.map(o => o.count), 1) / 2) * 2;
              return (<div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.purple, borderRadius: 2 }} />Team Workload</h3>
                {owners.map((o, i) => (<div key={o.name} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ width: 80, minWidth: 80, textAlign: "right", paddingRight: 10, fontSize: 14, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                  <div style={{ flex: 1, height: 20, position: "relative" }}>
                    <div style={{ height: "100%", width: `${(o.count / gm) * 100}%`, background: ownerColors[i % ownerColors.length], borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, minWidth: o.count > 0 ? 24 : 0 }}>
                      <span style={{ fontFamily: FM, fontSize: 14, fontWeight: 600, color: "#fff" }}>{o.count}</span>
                    </div>
                  </div>
                </div>))}
              </div>);
            })()}
            <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>Tasks per Project</h3>
              {(() => { const pc = Object.entries(projStats).map(([n, s]) => ({ name: n, count: s.total })).sort((a, b) => b.count - a.count); const gm = Math.ceil(Math.max(...pc.map(p => p.count), 1) / 2) * 2;
                return (<div>{pc.map((p, i) => (<div key={i} style={{ marginBottom: isMobile ? 8 : 6 }}>
                  {isMobile && <div style={{ fontSize: 13, color: X.textSec, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[p.name] || X.accent }} />{p.name}</div>}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {!isMobile && <div title={p.name} className="dash-tpp-label" style={{ textAlign: "right", paddingRight: 10, fontSize: 14, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>}
                    <div style={{ flex: 1, height: 20, position: "relative" }}>
                      <div style={{ height: "100%", width: `${(p.count / gm) * 100}%`, background: pcMap[p.name] || X.accent, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, minWidth: p.count > 0 ? 24 : 0 }}>
                        <span style={{ fontFamily: FM, fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.count}</span>
                      </div>
                    </div>
                  </div>
                </div>))}</div>);
              })()}
            </div>
          </div>
        </>)}

        {/* PROJECTS */}
        {tab === "projects" && !selProj && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button onClick={() => setShowArch(!showArch)} style={{ background: showArch ? X.surfaceLight : X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>
                Archived ({archived.size})
              </button>
              {!showCreateProj ? (<button onClick={() => setShowCreateProj(true)} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
              ) : (<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={newProjName} onChange={e => setNewProjName(e.target.value)} placeholder="Project name" onKeyDown={e => { if (e.key === "Enter") createProj(newProjName); if (e.key === "Escape") { setShowCreateProj(false); setNewProjName(""); } }} autoFocus style={{ fontSize: 14, padding: "6px 12px", borderRadius: 20, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, width: 200 }} />
                <button onClick={() => createProj(newProjName)} disabled={!newProjName.trim()} style={{ background: newProjName.trim() ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: newProjName.trim() ? "pointer" : "not-allowed" }}>Confirm</button>
                <button onClick={() => { setShowCreateProj(false); setNewProjName(""); }} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>)}
            </div>
            <div className="dash-grid-cards">
              {allProjNames.filter(p => !archived.has(p)).map(pn => {
                const pt = twp.filter(d => d.project === pn); const c = pcMap[pn] || X.accent;
                const ts = allS.filter(s => pt.some(t => t.id === s.taskId)); const ds = ts.filter(s => s.done).length;
                const avg = pt.length > 0 ? Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length) : 0;
                const stC = {}; pt.forEach(t => { stC[t.status] = (stC[t.status] || 0) + 1; });
                const icon = projIcons[pn];
                return (
                  <div key={pn} onClick={() => setSelProj(pn)} style={{ background: X.surface, borderRadius: 16, border: `1px solid ${X.border}`, overflow: "hidden", transition: "border-color 0.2s", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c} onMouseLeave={e => e.currentTarget.style.borderColor = X.border}>
                    <div style={{ padding: "18px 20px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div onClick={e => { e.stopPropagation(); setUploadTarget(pn); fileRef.current?.click(); }} title="Upload icon"
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
                      <button onClick={e => { e.stopPropagation(); archiveProj(pn); }} style={{ background: "transparent", border: `1px solid ${X.amber}50`, borderRadius: 20, padding: "3px 12px", fontSize: 14, color: X.amber, cursor: "pointer", fontWeight: 600 }}>Archive</button>
                      <button onClick={e => { e.stopPropagation(); if (confirm("Delete " + pn + "?")) deleteProj(pn); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "3px 12px", fontSize: 14, color: X.red, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                    </div>
                  </div>);
              })}
            </div>
            {showArch && archived.size > 0 && (<div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: X.textDim, marginBottom: 12 }}>Archived</div>
              <div className="dash-grid-2col" style={{ gap: 12 }}>
                {[...archived].map(pn => { const pt = twp.filter(d => d.project === pn); if (!pt.length) return null;
                  return (<div key={pn} onClick={() => setSelProj(pn)} style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, opacity: 0.5, cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{pn}</div><div style={{ fontSize: 14, color: X.textDim, fontFamily: FM }}>{pt.length} tasks</div></div>
                    <button onClick={e => { e.stopPropagation(); unarchiveProj(pn); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Unarchive</button>
                    <button onClick={e => { e.stopPropagation(); if (confirm("Permanently delete?")) deleteProj(pn); unarchiveProj(pn); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "4px 12px", fontSize: 14, color: X.red, cursor: "pointer" }}>Delete</button>
                  </div>);
                })}
              </div>
            </div>)}
          </div>
        )}

        {/* PROJECT DETAIL */}
        {tab === "projects" && selProj && (() => {
          const pt = twp.filter(d => d.project === selProj).sort((a, b) => { const da = a.start ? pD(a.start) : new Date(9999, 0); const db = b.start ? pD(b.start) : new Date(9999, 0); return da - db; });
          const c = pcMap[selProj] || X.accent; const ts = allS.filter(s => pt.some(t => t.id === s.taskId)); const ds = ts.filter(s => s.done).length;
          const avg = pt.length > 0 ? Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length) : 0;
          const icon = projIcons[selProj];
          return (<div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => { setSelProj(null); }} style={{ background: X.surface, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>← Back</button>
              <div onClick={() => { setUploadTarget(selProj); fileRef.current?.click(); }} style={{ width: 64, height: 64, borderRadius: 16, background: icon ? "transparent" : `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: c, cursor: "pointer", overflow: "hidden", border: icon ? "none" : `1px dashed ${c}50` }}>
                {icon ? <img src={icon} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 16 }} /> : selProj[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><EditableCell value={selProj} onSave={v => { if (v && v !== selProj) { renameProject(selProj, v); setProjIcons(p => { const n = { ...p }; if (n[selProj]) { n[v] = n[selProj]; delete n[selProj]; } return n; }); setArchived(p => { const n = new Set(p); if (n.has(selProj)) { n.delete(selProj); n.add(v); } return n; }); setCustomProjects(p => { const n = new Set(p); if (n.has(selProj)) { n.delete(selProj); n.add(v); } return n; }); setFPSet(p => { const n = new Set(p); if (n.has(selProj)) { n.delete(selProj); n.add(v); } return n; }); setSelProj(v); } }} style={{ fontSize: 24, fontWeight: 700 }} /></h2><div style={{ fontSize: 14, color: X.textDim, fontFamily: FM, marginTop: 2 }}>{pt.length} tasks · {ts.length} subtasks · {ds} done</div></div>
              <button onClick={() => setShowFileManager(true)} style={{ background: "transparent", border: `1px solid ${X.accent}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.accent, cursor: "pointer", fontWeight: 600 }}>📁 檔案管理</button>
              <button onClick={() => archiveProj(selProj)} style={{ background: "transparent", border: `1px solid ${X.amber}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.amber, cursor: "pointer", fontWeight: 600 }}>Archive</button>
              <button onClick={() => { if (confirm("Delete?")) deleteProj(selProj); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.red, cursor: "pointer", fontWeight: 600 }}>Delete</button>
            </div>
            {pt.some(t => t.start) && (<div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}><TimeScaleToggle value={timeDim} onChange={setTimeDim} /></div>
              <GanttTimeline tasks={twp} subtasks={allS} fp={selProj} fs={"全部"} fpr={"全部"} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths.project} />
            </div>)}
            <div className="dash-detail-grid" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                  <div style={{ fontSize: 12, color: X.textDim, marginBottom: 6 }}>Progress</div>
                  <div className="dash-detail-num" style={{ fontWeight: 700, fontFamily: FM, color: avg === 100 ? X.green : X.text, lineHeight: 1 }}>{avg}%</div>
                  <div style={{ height: 5, background: X.surfaceLight, borderRadius: 2, marginTop: 12, overflow: "hidden" }}><div style={{ height: "100%", width: `${avg}%`, background: c, borderRadius: 2 }} /></div>
                </div>
                <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                  <div style={{ fontSize: 12, color: X.textDim, marginBottom: 6 }}>Subtasks</div>
                  <div className="dash-detail-num" style={{ fontWeight: 700, fontFamily: FM, color: X.text, lineHeight: 1 }}>{ds}<span style={{ fontSize: 17, color: X.textDim }}>/{ts.length}</span></div>
                </div>
                <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
                  <div style={{ fontSize: 12, color: X.textDim, marginBottom: 6 }}>Tasks</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {Object.entries((() => { const sc = {}; pt.forEach(t => { sc[t.status] = (sc[t.status] || 0) + 1; }); return sc; })()).map(([st, cnt]) => {
                      const s = SC[st] || {}; return (<span key={st} style={{ fontSize: 14, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{st} {cnt}</span>);
                    })}
                  </div>
                </div>
              </div>
              <div style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Tasks</span>
                  <button onClick={() => setModalTask("new")} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
                </div>
                {pt.map(task => { const sc = SC[task.status] || {}; const tSubs = allS.filter(s => s.taskId === task.id); return (
                  <div key={task.id} style={{ borderBottom: `1px solid ${X.border}` }}>
                    <div onClick={() => setModalTask(task)} style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.task}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                          <OwnerTags value={task.owner} /><span style={{ fontSize: 14, color: X.textDim }}>·</span>
                          <span style={{ fontFamily: FM, fontSize: 14, color: X.textSec }}>{fD(task.start)} → {fD(task.end)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600 }}>{task.status}</span>
                      <div style={{ width: 90 }}><ProgressBar pct={task.progress} done={task.sDone} total={task.sTotal} /></div>
                      <button onClick={e => { e.stopPropagation(); if (confirm("Delete?")) deleteTask(task.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>×</button>
                    </div>
                    {tSubs.length > 0 && (() => { const sortedSubs = [...tSubs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); return <div style={{ paddingLeft: 32, paddingRight: 20, paddingBottom: sortedSubs.length > 0 ? 4 : 0 }}>
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={ev => { if (ev.active && ev.over && ev.active.id !== ev.over.id) reorderSubs(task.id, ev.active.id, ev.over.id); }}>
                        <SortableContext items={sortedSubs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          {sortedSubs.map(sub => (
                            <SortableSubItem key={sub.id} sub={sub} toggleSub={toggleSub} updateSub={updateSub} deleteSub={deleteSub} configOwners={configOwners} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>; })()}
                    <div style={{ paddingLeft: 32, paddingRight: 20, paddingBottom: 8 }}>
                      {showSubAdd === task.id
                        ? <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "4px 0" }}>
                          <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="Subtask name" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } if (e.key === "Escape") setShowSubAdd(null); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 120 }} />
                          <select value={subDraft.owner} onChange={e => setSubDraft(p => ({ ...p, owner: e.target.value }))} style={{ ...iS2, width: 80, fontSize: 13, padding: "5px 10px", cursor: "pointer" }}><option value="">Owner</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>
                          <button onClick={() => { if (subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                          <button onClick={() => setShowSubAdd(null)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>Cancel</button>
                        </div>
                        : <span onClick={e => { e.stopPropagation(); setShowSubAdd(task.id); setSubDraft({ name: "", owner: "" }); }} style={{ fontSize: 13, color: X.accent, fontWeight: 500, cursor: "pointer", opacity: 0.5, padding: "2px 8px" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>+ Add subtask</span>
                      }
                    </div>
                  </div>); })}
                {!pt.length && <div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks yet</div><div style={{ fontSize: 14, marginBottom: 16 }}>Get started by creating a task for this project</div><button onClick={() => setModalTask("new")} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button></div>}
              </div>
            </div>
          </div>);
        })()}

        {/* TIMELINE */}
        {tab === "timeline" && <>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}><TimeScaleToggle value={timeDim} onChange={setTimeDim} /></div>
          <GanttTimeline tasks={twp} subtasks={allS} fp={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths.timeline} />
        </>}

        {/* DATA TABLE */}
        {tab === "table" && (
          <div style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "10px 12px" : "10px 16px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              {!isMobile && <span style={{ fontSize: 14, color: X.textDim }}>Click to select · Double-click or F2 to edit · Arrow keys to navigate</span>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", ...(isMobile ? { width: "100%", justifyContent: "space-between" } : {}) }}>
                {isMobile ? (
                  <>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => downloadCSV(tasksToCSV(allT), "tasks_export.csv")} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer" }}>Export</button>
                      <label style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>Import<input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} /></label>
                      <button onClick={() => { setShowUrlInput(!showUrlInput); setUrlValue(""); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: X.textSec, cursor: "pointer" }}>URL</button>
                    </div>
                    <button onClick={() => setShowTblAdd(!showTblAdd)} style={{ background: showTblAdd ? X.surfaceLight : X.accent, color: showTblAdd ? X.textSec : "#fff", border: showTblAdd ? `1px solid ${X.border}` : "none", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{showTblAdd ? "Cancel" : "+ Create"}</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => downloadCSV(tasksToCSV(allT), "tasks_export.csv")} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Export CSV</button>
                    <label style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>Import CSV<input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} /></label>
                    <button onClick={() => { setShowUrlInput(!showUrlInput); setUrlValue(""); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Import URL</button>
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
              const doAdd = async () => { if (!draft.task.trim() || !draft.project.trim()) return; const proj = projects.find(p => p.name === draft.project); if (!proj) return; const dur = (draft.start && draft.end) ? Math.max(1, Math.ceil((pD(draft.end) - pD(draft.start)) / 864e5)) : null; try { await addTask(proj.id, { task: draft.task, startDate: draft.start ? toISO(draft.start) : null, endDate: draft.end ? toISO(draft.end) : null, duration: dur, owner: draft.owner, category: draft.category, priority: draft.priority, notes: draft.notes }); setDraft({ task: "", project: "", start: "", end: "", owner: "—", category: "活動", priority: "中", notes: "" }); setShowTblAdd(false); } catch (err) { console.error("doAdd failed:", err); } };
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
                  <button onClick={doAdd} disabled={!draft.task.trim() || !draft.project.trim()} style={{ background: (draft.task.trim() && draft.project.trim()) ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "6px 20px", fontSize: 14, fontWeight: 700, cursor: (draft.task.trim() && draft.project.trim()) ? "pointer" : "not-allowed", whiteSpace: "nowrap", ...(isMobile ? { width: "100%" } : {}) }}>Confirm</button>
                </div>
              </div>);
            })()}
            {isMobile ? (
              <div style={{ padding: 12 }}>
                {sorted.length === 0 && <div style={{ padding: 40, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📊</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks found</div><div style={{ fontSize: 14 }}>Try adjusting your filters or create a new task</div></div>}
                {sorted.map(d => { const sc = SC[d.status] || {}, pc = PC[d.priority] || {}; const isE = expanded.has(d.id); const tSubs = allS.filter(s => s.taskId === d.id);
                  return (
                    <div key={d.id} style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: "hidden", marginBottom: 8 }}>
                      <div onClick={() => toggle(d.id)} style={{ padding: "12px 14px", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[d.project], flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.task}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{d.status}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: X.textSec }}>{d.owner}</span>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc.color }} />
                          <span style={{ fontSize: 13, color: pc.color, fontWeight: 500 }}>{d.priority}</span>
                          <div style={{ flex: 1, marginLeft: 4 }}><ProgressBar pct={d.progress} done={d.sDone} total={d.sTotal} /></div>
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
                              <span><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} options={configOwners} style={{ fontSize: 12, color: X.textDim }} /></span>
                              <button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 12, cursor: "pointer", padding: "2px 4px", opacity: 0.6 }}>×</button>
                            </div>
                          ))}
                          {showSubAdd === d.id
                            ? <div onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", background: X.surfaceLight, borderTop: `1px solid ${X.border}22`, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="Subtask name" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } if (e.key === "Escape") setShowSubAdd(null); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 120 }} />
                              <select value={subDraft.owner} onChange={e => setSubDraft(p => ({ ...p, owner: e.target.value }))} style={{ ...iS2, width: 80, fontSize: 13, padding: "5px 10px", cursor: "pointer" }}><option value="">Owner</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>
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
                    {[{ k: "project", l: "Project" }, { k: "task", l: "Task" }, { k: "owner", l: "Owner" }, { k: "status", l: "Status" }, { k: "priority", l: "Pri" }, { k: "progress", l: "Progress" }, { k: "category", l: "Category" }, { k: "start", l: "Start" }, { k: "end", l: "End" }, { k: "notes", l: "Notes" }].map(col => (
                      <th key={col.k} onClick={() => handleSort(col.k)} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, color: X.textDim, fontSize: 13, borderBottom: `1px solid ${X.border}`, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>{col.l}<SI col={col.k} /></th>
                    ))}
                    <th style={{ padding: "10px 6px", width: 36, borderBottom: `1px solid ${X.border}` }} />
                  </tr></thead>
                  <tbody>
                    {sorted.length === 0 && <tr><td colSpan={11} style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📊</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks found</div><div style={{ fontSize: 14 }}>Try adjusting your filters or create a new task</div></td></tr>}
                    {sorted.map(d => { const sc = SC[d.status] || {}, pc = PC[d.priority] || {}; const isE = expanded.has(d.id); const tSubs = allS.filter(s => s.taskId === d.id);
                      return [
                        <tr key={d.id} style={{ borderBottom: `1px solid ${isE ? X.border : X.border + "40"}` }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "9px 8px", fontWeight: 500, maxWidth: 140 }}><div style={{ display: "flex", alignItems: "center" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: pcMap[d.project], marginRight: 6, flexShrink: 0 }} /><div style={{ flex: 1, minWidth: 0 }}><EditableCell value={d.project} onSave={v => updateTask(d.id, "project", v)} {...cellP(d.id, "project")} /></div></div></td>
                          <td style={{ padding: "9px 8px", maxWidth: 200 }}><div style={{ display: "flex", alignItems: "center" }}><span onClick={e => { e.stopPropagation(); toggle(d.id); }} style={{ color: X.textDim, marginRight: 6, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>{isE ? "▾" : "▸"}</span><div style={{ flex: 1, minWidth: 0 }}><EditableCell value={d.task} onSave={v => updateTask(d.id, "task", v)} {...cellP(d.id, "task")} /></div></div></td>
                          <td style={{ padding: "9px 8px", fontSize: 14 }}><EditableCell value={d.owner} onSave={v => updateTask(d.id, "owner", v)} {...cellP(d.id, "owner")} style={{ color: X.textSec }} /></td>
                          <td style={{ padding: "9px 8px" }}><EditableCell value={d.status} onSave={v => updateTask(d.id, "status", v)} {...cellP(d.id, "status")} options={["已完成", "進行中", "待辦", "提案中", "待確認"]} style={{ padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600 }} /></td>
                          <td style={{ padding: "9px 8px" }}><EditableCell value={d.priority} onSave={v => updateTask(d.id, "priority", v)} {...cellP(d.id, "priority")} options={["高", "中", "低"]} style={{ color: pc.color, fontSize: 14, fontWeight: 600 }} /></td>
                          <td style={{ padding: "9px 8px", minWidth: 110 }}><ProgressBar pct={d.progress} done={d.sDone} total={d.sTotal} /></td>
                          <td style={{ padding: "9px 8px" }}><EditableCell value={d.category} onSave={v => updateTask(d.id, "category", v)} {...cellP(d.id, "category")} options={configCats} style={{ padding: "2px 8px", borderRadius: 8, background: X.surfaceLight, color: CC[d.category] || X.textSec, fontSize: 14, fontWeight: 500 }} /></td>
                          <td style={{ padding: "9px 8px" }}><EditableCell value={d.start} onSave={v => updateTask(d.id, "start", v)} {...cellP(d.id, "start")} isDate style={{ fontFamily: FM, fontSize: 14, color: X.text }} /></td>
                          <td style={{ padding: "9px 8px" }}><EditableCell value={d.end} onSave={v => updateTask(d.id, "end", v)} {...cellP(d.id, "end")} isDate style={{ fontFamily: FM, fontSize: 14, color: X.text }} /></td>
                          <td style={{ padding: "9px 8px", maxWidth: 180 }}><EditableCell value={d.notes} onSave={v => updateTask(d.id, "notes", v)} {...cellP(d.id, "notes")} style={{ fontSize: 14, color: X.textSec }} /></td>
                          <td style={{ padding: "6px", textAlign: "center" }}><button onClick={e => { e.stopPropagation(); if (confirm("Delete?")) deleteTask(d.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: X.red, fontSize: 14, padding: "2px 6px" }}>×</button></td>
                        </tr>,
                        ...(isE ? [...tSubs.map(sub => (
                          <tr key={sub.id} style={{ background: X.surfaceLight, borderBottom: `1px solid ${X.border}22` }}>
                            <td />
                            <td style={{ padding: "7px 8px 7px 30px", fontSize: 14 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={e => { e.stopPropagation(); toggleSub(sub.id); }}>
                                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff" }}>{sub.done ? "✓" : ""}</span>
                                <EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} {...cellP(sub.id, "name")} style={{ textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1, color: X.textSec }} />
                              </label>
                            </td>
                            <td style={{ padding: "7px 8px", fontSize: 14 }}><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} {...cellP(sub.id, "owner")} options={configOwners} style={{ color: X.textDim }} /></td>
                            <td colSpan={2} style={{ padding: "7px 8px" }}>{sub.done ? <span style={{ fontSize: 14, color: X.green, fontWeight: 600 }}>Done</span> : <span style={{ fontSize: 14, color: X.textDim }}>Pending</span>}</td>
                            <td style={{ padding: "7px 8px", fontFamily: FM, fontSize: 14, color: sub.done ? X.green : X.textDim }}>{sub.done_date ? fD(sub.done_date) : "\u2014"}</td>
                            <td colSpan={4} style={{ padding: "7px 8px", fontSize: 14 }}><EditableCell value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} {...cellP(sub.id, "notes")} style={{ color: X.textDim }} /></td>
                            <td style={{ padding: "4px", textAlign: "center" }}><button onClick={e => { e.stopPropagation(); deleteSub(sub.id); }} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button></td>
                          </tr>)),
                          <tr key={d.id + "_addsub"} style={{ background: X.surfaceLight, borderBottom: `1px solid ${X.border}22` }}>
                            <td />
                            <td colSpan={10} style={{ padding: "6px 8px 6px 30px" }}>
                              {showSubAdd === d.id
                                ? <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="Subtask name" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(d.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } if (e.key === "Escape") setShowSubAdd(null); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "4px 10px" }} />
                                  <select value={subDraft.owner} onChange={e => setSubDraft(p => ({ ...p, owner: e.target.value }))} style={{ ...iS2, width: 100, fontSize: 13, padding: "4px 10px", cursor: "pointer" }}><option value="">Owner</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>
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
        )}
        {/* SETTINGS */}
        {tab === "settings" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.accent, borderRadius: 2 }} />Categories</h3>
              {configCats.map((cat, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: CC[cat] || X.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: X.text, flex: 1 }}>{cat}</span>
                <button onClick={() => setConfigCats(p => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.5 }}>×</button>
              </div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category" onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { setConfigCats(p => [...p, newCat.trim()]); setNewCat(""); showToast("Category added", "success"); } }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px" }} />
                <button onClick={() => { if (newCat.trim()) { setConfigCats(p => [...p, newCat.trim()]); setNewCat(""); showToast("Category added", "success"); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+</button>
              </div>
            </div>
            <div style={{ background: X.surface, borderRadius: 12, padding: 20, border: `1px solid ${X.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 14, background: X.purple, borderRadius: 2 }} />Owners</h3>
              {configOwners.map((ow, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: X.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: X.text, flex: 1 }}>{ow}</span>
                <button onClick={() => setConfigOwners(p => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.5 }}>×</button>
              </div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="New owner" onKeyDown={e => { if (e.key === "Enter" && newOwner.trim()) { setConfigOwners(p => [...p, newOwner.trim()]); setNewOwner(""); showToast("Owner added", "success"); } }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px" }} />
                <button onClick={() => { if (newOwner.trim()) { setConfigOwners(p => [...p, newOwner.trim()]); setNewOwner(""); showToast("Owner added", "success"); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+</button>
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
        )}
      </div>
      {modalTask && <TaskModal task={modalTask} projectId={modalTask !== "new" ? modalTask.projectId : (projects.find(p => p.name === selProj)?.id)} projectName={selProj} onClose={() => setModalTask(null)} addTask={addTask} updateTask={updateTask} allS={allS} addSub={addSub} deleteSub={deleteSub} toggleSub={toggleSub} updateSub={updateSub} configCats={configCats} configOwners={configOwners} reorderSubs={reorderSubs} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} />}
      {showFileManager && selProj && <FileManagerModal project={selProj} tasks={twp} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} onClose={() => setShowFileManager(false)} />}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 100, animation: toast.fading ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease", display: "flex", alignItems: "center", gap: 10, background: X.surface, borderRadius: 12, padding: "12px 20px", boxShadow: `0 4px 20px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, maxWidth: "90vw" }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: toast.type === "error" ? X.red : toast.type === "warn" ? X.amber : X.green }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: X.text, whiteSpace: "nowrap" }}>{toast.msg}</span>
      </div>}
    </div>
  );
}
