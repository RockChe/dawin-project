"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { THEME_ORDER, X, SC, PC, PJC, F, FM, applyTheme } from "@/lib/theme";
import useTaskManager from "@/hooks/useTaskManager";
import TaskModal from "./TaskModal";
import FileManagerModal from "./FileManagerModal";
import SettingsTab from "./tabs/SettingsTab";
import TimelineTab from "./tabs/TimelineTab";
import DashboardHeader from "./tabs/DashboardHeader";
import OverviewTab from "./tabs/OverviewTab";
import ProjectsTab from "./tabs/ProjectsTab";
import DataTab from "./tabs/DataTab";

export default function Dashboard() {
  const {
    projects, allT, allS,
    allL, allF,
    twp,
    loading, userRole,
    toast, showToast,
    toggleSub, updateTask, updateSub,
    addTask, deleteTask, addSub, deleteSub,
    addLink, deleteLink, addFile, deleteFile,
    renameProject, addProject, deleteProject: deleteProjectAction,
    reorderSubs, importTasks,
    deleteManyTasks, deleteAllTasks,
    configCats, saveConfigCats, configOwners, saveConfigOwners,
  } = useTaskManager();
  const [fpSet, setFPSet] = useState(new Set());
  const toggleFP = p => setFPSet(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const [fs, setFS] = useState("全部");
  const [fpr, setFPR] = useState("全部");
  const [tab, setTab] = useState("overview");
  const [customProjects, setCustomProjects] = useState(new Set());
  const [modalTask, setModalTask] = useState(null);
  const [showFileManager, setShowFileManager] = useState(null);
  const [projIcons, setProjIcons] = useState({});
  const [scrolled, setScrolled] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const searchTimer = useRef(null);
  const handleSearch = useCallback((v) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQ(v), 300);
  }, []);
  const clearSearch = useCallback(() => { setSearchInput(""); setSearchQ(""); }, []);
  const defaultGW = { day: 20, week: 50, month: 50, quarter: 100 };
  const [ganttWidths, setGanttWidths] = useState(() => {
    try { const s = localStorage.getItem("dash-ganttWidths"); if (s) { const parsed = JSON.parse(s); if (parsed.day !== undefined && !parsed.overview) { return { overview: { ...parsed }, project: { ...parsed }, timeline: { ...parsed } }; } return parsed; } } catch {}
    return { overview: { ...defaultGW }, project: { ...defaultGW }, timeline: { ...defaultGW } };
  });
  const [ganttDraft, setGanttDraft] = useState(() => JSON.parse(JSON.stringify(ganttWidths)));
  const saveGanttWidths = () => { const filled = {}; for (const v of ["overview", "project", "timeline"]) { filled[v] = {}; for (const k of ["day", "week", "month", "quarter"]) { const val = ganttDraft[v]?.[k]; filled[v][k] = (val === '' || val == null) ? defaultGW[k] : Math.max(1, val); } } const deep = JSON.parse(JSON.stringify(filled)); setGanttWidths(deep); setGanttDraft(JSON.parse(JSON.stringify(deep))); localStorage.setItem("dash-ganttWidths", JSON.stringify(deep)); showToast("Timeline widths saved", "success"); };
  // Theme
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem("dash-theme") || "warm"; } catch { return "warm"; } });
  applyTheme(themeKey);
  const cycleTheme = useCallback(() => { setThemeKey(p => { const i = THEME_ORDER.indexOf(p); return THEME_ORDER[(i + 1) % THEME_ORDER.length]; }); }, []);
  useEffect(() => { try { localStorage.setItem("dash-theme", themeKey); } catch {} document.body.style.background = X.bg; window.dispatchEvent(new Event('theme-change')); }, [themeKey]);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 10); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);
  const [isMobile, setIsMobile] = useState(() => { try { return window.innerWidth <= 768; } catch { return false; } });
  useEffect(() => { const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  // Computed
  const filtered = useMemo(() => twp.filter(d => { if (fpSet.size > 0 && !fpSet.has(d.project)) return false; if (fs !== "全部" && d.status !== fs) return false; if (fpr !== "全部" && d.priority !== fpr) return false; if (searchQ) { const q = searchQ.toLowerCase(); if (!(d.task || "").toLowerCase().includes(q) && !(d.project || "").toLowerCase().includes(q) && !(d.owner || "").toLowerCase().includes(q) && !(d.notes || "").toLowerCase().includes(q)) return false; } return true; }), [fpSet, fs, fpr, twp, searchQ]);
  const stats = useMemo(() => { const s = {}; Object.keys(SC).forEach(k => s[k] = 0); filtered.forEach(d => s[d.status]++); return s; }, [filtered]);
  const avgProg = useMemo(() => filtered.length === 0 ? 0 : Math.round(filtered.reduce((s, d) => s + d.progress, 0) / filtered.length), [filtered]);
  const priStats = useMemo(() => { const p = { "高": 0, "中": 0, "低": 0 }; filtered.forEach(d => p[d.priority]++); return p; }, [filtered]);
  const allProjNames = useMemo(() => [...new Set([...twp.map(d => d.project), ...customProjects])], [twp, customProjects]);
  const pcMap = {}; allProjNames.forEach((p, i) => { pcMap[p] = PJC[i % PJC.length]; });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${X.border}`, borderTopColor: X.accent, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 15, color: X.textDim, fontWeight: 500 }}>載入資料中...</div>
        <div style={{ width: "90%", maxWidth: 600, display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 48, borderRadius: 12, background: `linear-gradient(90deg, ${X.surfaceLight} 25%, ${X.surface} 50%, ${X.surfaceLight} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text, transition: "background-color 0.3s,color 0.3s" }}>
      <style>{`::selection{background:${X.selectionBg}} *{box-sizing:border-box} ::-webkit-scrollbar{width:10px;height:10px} ::-webkit-scrollbar-thumb{background:${X.scrollThumb};border-radius:5px} ::-webkit-scrollbar-track{background:transparent} input,select,button{font-family:'Noto Sans TC',-apple-system,sans-serif}`}</style>
      <DashboardHeader themeKey={themeKey} cycleTheme={cycleTheme} isMobile={isMobile} scrolled={scrolled} searchInput={searchInput} handleSearch={handleSearch} searchQ={searchQ} clearSearch={clearSearch} avgProg={avgProg} filtered={filtered} />

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
            <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: isMobile ? "10px 14px" : "12px 20px", border: "none", background: "transparent", color: tab === t.k ? X.accent : X.textSec, fontSize: 14, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer", borderBottom: tab === t.k ? `2px solid ${X.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0 }}>{t.l}</button>))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && <OverviewTab filtered={filtered} twp={twp} allS={allS} isMobile={isMobile} pcMap={pcMap} ganttWidths={ganttWidths.overview} projIcons={projIcons} stats={stats} />}

        {/* PROJECTS */}
        {tab === "projects" && <ProjectsTab twp={twp} allS={allS} projects={projects} configOwners={configOwners} pcMap={pcMap} allProjNames={allProjNames} isMobile={isMobile} setModalTask={setModalTask} setShowFileManager={setShowFileManager} ganttWidths={ganttWidths.project} showToast={showToast} renameProject={renameProject} addProject={addProject} deleteProject={deleteProjectAction} deleteTask={deleteTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} reorderSubs={reorderSubs} projIcons={projIcons} setProjIcons={setProjIcons} onProjectRenamed={(oldName, newName) => { setFPSet(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; }); setCustomProjects(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; }); }} onProjectDeleted={(name) => { setCustomProjects(p => { const n = new Set(p); n.delete(name); return n; }); }} />}

        {/* TIMELINE */}
        {tab === "timeline" && <TimelineTab twp={twp} allS={allS} fpSet={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} ganttWidths={ganttWidths.timeline} />}

        {/* DATA TABLE */}
        {tab === "table" && <DataTab filtered={filtered} allS={allS} allT={allT} twp={twp} projects={projects} updateTask={updateTask} deleteTask={deleteTask} addTask={addTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} configCats={configCats} configOwners={configOwners} isMobile={isMobile} userRole={userRole} pcMap={pcMap} importTasks={importTasks} deleteManyTasks={deleteManyTasks} deleteAllTasks={deleteAllTasks} showToast={showToast} setModalTask={setModalTask} />}
        {/* SETTINGS */}
        {tab === "settings" && <SettingsTab configCats={configCats} saveConfigCats={saveConfigCats} configOwners={configOwners} saveConfigOwners={saveConfigOwners} ganttDraft={ganttDraft} setGanttDraft={setGanttDraft} saveGanttWidths={saveGanttWidths} isMobile={isMobile} showToast={showToast} />}
      </div>
      {modalTask && <TaskModal task={modalTask._isNew ? "new" : modalTask} projectId={modalTask._isNew ? modalTask.projectId : modalTask.projectId} projectName={modalTask._isNew ? modalTask.projectName : (modalTask.project || "")} onClose={() => setModalTask(null)} addTask={addTask} updateTask={updateTask} allS={allS} addSub={addSub} deleteSub={deleteSub} toggleSub={toggleSub} updateSub={updateSub} configCats={configCats} configOwners={configOwners} reorderSubs={reorderSubs} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} showToast={showToast} />}
      {showFileManager && <FileManagerModal project={showFileManager} tasks={twp} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} onClose={() => setShowFileManager(null)} />}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 100, animation: toast.fading ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease", display: "flex", alignItems: "center", gap: 10, background: X.surface, borderRadius: 12, padding: "12px 20px", boxShadow: `0 4px 20px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, maxWidth: "90vw" }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: toast.type === "error" ? X.red : toast.type === "warn" ? X.amber : X.green }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: X.text, whiteSpace: "nowrap" }}>{toast.msg}</span>
      </div>}
    </div>
  );
}
