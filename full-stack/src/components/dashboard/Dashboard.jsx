"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { F, FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import useTaskManager from "@/hooks/useTaskManager";
import TaskModal from "./TaskModal";
import FileManagerModal from "./FileManagerModal";
import SettingsTab from "./tabs/SettingsTab";
import TimelineTab from "./tabs/TimelineTab";
import DashboardHeader from "./tabs/DashboardHeader";
import OverviewTab from "./tabs/OverviewTab";
import ProjectsTab from "./tabs/ProjectsTab";
import DataTab from "./tabs/DataTab";

export default function Dashboard({ initialData }) {
  const { themeKey, cycleTheme, X, SC, PC, PJC } = useTheme();
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
    reorderSubs, reorderProjects, importTasks,
    deleteManyTasks, updateManyTasks, deleteAllTasks,
    configCats, saveConfigCats, configOwners, saveConfigOwners,
  } = useTaskManager(initialData);
  const [fpSet, setFPSet] = useState(new Set());
  const toggleFP = useCallback(p => setFPSet(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }), []);
  const [fs, setFS] = useState("全部");
  const [fpr, setFPR] = useState("全部");
  const [tab, setTab] = useState("overview");
  const [customProjects, setCustomProjects] = useState(new Set());
  const [modalTask, setModalTask] = useState(null);
  const [showFileManager, setShowFileManager] = useState(null);
  const [projBanners, setProjBanners] = useState(() => {
    const banners = {};
    (initialData?.projects || []).forEach(p => {
      if (p.bannerUrl) banners[p.name] = p.bannerUrl;
    });
    return banners;
  });
  const [scrolled, setScrolled] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const searchTimer = useRef(null);
  const handleSearch = useCallback((v) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQ(v), 300);
  }, []);
  useEffect(() => { return () => { if (searchTimer.current) clearTimeout(searchTimer.current); }; }, []);
  const clearSearch = useCallback(() => { setSearchInput(""); setSearchQ(""); }, []);
  const defaultGW = { day: 20, week: 50, month: 50, quarter: 100 };
  const [ganttWidths, setGanttWidths] = useState(() => {
    try { const s = localStorage.getItem("dash-ganttWidths"); if (s) { const parsed = JSON.parse(s); if (parsed.day !== undefined && !parsed.overview) { return { overview: { ...parsed }, project: { ...parsed }, timeline: { ...parsed } }; } return parsed; } } catch {}
    return { overview: { ...defaultGW }, project: { ...defaultGW }, timeline: { ...defaultGW } };
  });
  const [ganttDraft, setGanttDraft] = useState(() => JSON.parse(JSON.stringify(ganttWidths)));
  const saveGanttWidths = useCallback(() => { const filled = {}; for (const v of ["overview", "project", "timeline"]) { filled[v] = {}; for (const k of ["day", "week", "month", "quarter"]) { const val = ganttDraft[v]?.[k]; filled[v][k] = (val === '' || val == null) ? defaultGW[k] : Math.max(1, val); } } const deep = JSON.parse(JSON.stringify(filled)); setGanttWidths(deep); setGanttDraft(JSON.parse(JSON.stringify(deep))); localStorage.setItem("dash-ganttWidths", JSON.stringify(deep)); showToast("Timeline widths saved", "success"); }, [ganttDraft, showToast]);
  const [timelineHeight, setTimelineHeight] = useState(() => { try { const s = localStorage.getItem("dash-timelineHeight"); if (s) return parseInt(s) || 100; } catch {} return 100; });
  const saveTimelineHeight = useCallback((val) => { const v = Math.max(10, Math.min(200, parseInt(val) || 100)); setTimelineHeight(v); localStorage.setItem("dash-timelineHeight", JSON.stringify(v)); showToast("Timeline height saved", "success"); }, [showToast]);
  const [upcomingDays, setUpcomingDays] = useState(() => { try { const s = localStorage.getItem("dash-upcomingDays"); if (s) return parseInt(s) || 30; } catch {} return 30; });
  const [upcomingLimit, setUpcomingLimit] = useState(() => { try { const s = localStorage.getItem("dash-upcomingLimit"); if (s) return parseInt(s) || 5; } catch {} return 5; });
  const saveUpcomingSettings = useCallback((days, limit) => { const d = Math.max(1, parseInt(days) || 30); const l = Math.max(1, parseInt(limit) || 5); setUpcomingDays(d); setUpcomingLimit(l); localStorage.setItem("dash-upcomingDays", JSON.stringify(d)); localStorage.setItem("dash-upcomingLimit", JSON.stringify(l)); showToast("Upcoming settings saved", "success"); }, [showToast]);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 10); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);
  const [isMobile, setIsMobile] = useState(() => { try { return window.innerWidth <= 768; } catch { return false; } });
  useEffect(() => { const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  // Memoize ganttWidths per-view to avoid cross-tab re-renders
  const ganttWidthsOverview = useMemo(() => ganttWidths.overview, [ganttWidths.overview]);
  const ganttWidthsProject = useMemo(() => ganttWidths.project, [ganttWidths.project]);
  const ganttWidthsTimeline = useMemo(() => ganttWidths.timeline, [ganttWidths.timeline]);

  // Callbacks for ProjectsTab
  const handleSetModalTask = useCallback((t) => setModalTask(t), []);
  const handleSetShowFileManager = useCallback((v) => setShowFileManager(v), []);
  const handleCloseModal = useCallback(() => setModalTask(null), []);
  const handleCloseFileManager = useCallback(() => setShowFileManager(null), []);
  const handleProjectRenamed = useCallback((oldName, newName) => {
    setFPSet(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; });
    setCustomProjects(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; });
  }, []);
  const handleProjectDeleted = useCallback((name) => {
    setCustomProjects(p => { const n = new Set(p); n.delete(name); return n; });
  }, []);

  // Computed
  const filtered = useMemo(() => twp.filter(d => { if (fpSet.size > 0 && !fpSet.has(d.project)) return false; if (fs !== "全部" && d.status !== fs) return false; if (fpr !== "全部" && d.priority !== fpr) return false; if (searchQ) { const q = searchQ.toLowerCase(); if (!(d.task || "").toLowerCase().includes(q) && !(d.project || "").toLowerCase().includes(q) && !(d.owner || "").toLowerCase().includes(q) && !(d.notes || "").toLowerCase().includes(q)) return false; } return true; }), [fpSet, fs, fpr, twp, searchQ]);
  const stats = useMemo(() => { const s = {}; Object.keys(SC).forEach(k => s[k] = 0); twp.forEach(d => s[d.status]++); return s; }, [twp]);
  const avgProg = useMemo(() => filtered.length === 0 ? 0 : Math.round(filtered.reduce((s, d) => s + d.progress, 0) / filtered.length), [filtered]);
  const priStats = useMemo(() => { const p = { "高": 0, "中": 0, "低": 0 }; filtered.forEach(d => p[d.priority]++); return p; }, [filtered]);
  const allProjNames = useMemo(() => [...new Set([...projects.map(p => p.name), ...twp.map(d => d.project), ...customProjects])], [projects, twp, customProjects]);
  const pcMap = useMemo(() => { const m = {}; allProjNames.forEach((p, i) => { m[p] = PJC[i % PJC.length]; }); return m; }, [allProjNames, PJC]);

  if (loading) {
    const shimmerBg = `linear-gradient(90deg, ${X.surfaceLight || X.surface} 25%, ${X.surface} 50%, ${X.surfaceLight || X.surface} 75%)`;
    const shimmerStyle = { backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 12, background: shimmerBg };
    return (
      <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text }}>
        <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
          {/* Header skeleton */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ ...shimmerStyle, width: 180, height: 32 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: "50%" }} />
              <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: "50%" }} />
            </div>
          </div>
          {/* Status cards skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ ...shimmerStyle, height: 80 }} />
            ))}
          </div>
          {/* Filter bar skeleton */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ ...shimmerStyle, width: 70, height: 32, borderRadius: 20 }} />
            ))}
          </div>
          {/* Tab bar skeleton */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ ...shimmerStyle, width: 90, height: 36, borderRadius: 8 }} />
            ))}
          </div>
          {/* Task list skeleton */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ ...shimmerStyle, height: 56 }} />
            ))}
          </div>
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
          {Object.entries(SC).map(([k, c]) => (<div key={k} onClick={() => setFS(fs === k ? "全部" : k)} style={{ background: X.surface, borderRadius: 12, padding: isMobile ? "12px 14px" : "16px 18px", border: fs === k ? `1px solid ${c.color}` : `1px solid ${X.border}`, boxShadow: X.surfaceShadow, cursor: "pointer" }}>
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
            <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: isMobile ? "10px 14px" : "12px 20px", border: "none", background: "transparent", color: tab === t.k ? X.accent : X.textSec, fontSize: 14, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer", borderBottom: tab === t.k ? `2px solid ${X.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.2s, border-color 0.2s" }}>{t.l}</button>))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && <OverviewTab filtered={filtered} twp={twp} allS={allS} isMobile={isMobile} pcMap={pcMap} ganttWidths={ganttWidthsOverview} projBanners={projBanners} stats={stats} upcomingDays={upcomingDays} upcomingLimit={upcomingLimit} configOwners={configOwners} />}

        {/* PROJECTS */}
        {tab === "projects" && <ProjectsTab twp={twp} allS={allS} projects={projects} configOwners={configOwners} pcMap={pcMap} allProjNames={allProjNames} isMobile={isMobile} setModalTask={handleSetModalTask} setShowFileManager={handleSetShowFileManager} ganttWidths={ganttWidthsProject} timelineHeight={timelineHeight} showToast={showToast} renameProject={renameProject} addProject={addProject} deleteProject={deleteProjectAction} deleteTask={deleteTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} reorderSubs={reorderSubs} reorderProjects={reorderProjects} projBanners={projBanners} setProjBanners={setProjBanners} onProjectRenamed={handleProjectRenamed} onProjectDeleted={handleProjectDeleted} />}

        {/* TIMELINE */}
        {tab === "timeline" && <TimelineTab twp={twp} allS={allS} fpSet={fpSet} fs={fs} fpr={fpr} isMobile={isMobile} ganttWidths={ganttWidthsTimeline} timelineHeight={timelineHeight} configOwners={configOwners} />}

        {/* DATA TABLE */}
        {tab === "table" && <DataTab filtered={filtered} allS={allS} allT={allT} twp={twp} projects={projects} updateTask={updateTask} deleteTask={deleteTask} addTask={addTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} configCats={configCats} configOwners={configOwners} isMobile={isMobile} userRole={userRole} pcMap={pcMap} importTasks={importTasks} deleteManyTasks={deleteManyTasks} updateManyTasks={updateManyTasks} deleteAllTasks={deleteAllTasks} showToast={showToast} setModalTask={handleSetModalTask} />}
        {/* SETTINGS */}
        {tab === "settings" && <SettingsTab configCats={configCats} saveConfigCats={saveConfigCats} configOwners={configOwners} ganttDraft={ganttDraft} setGanttDraft={setGanttDraft} saveGanttWidths={saveGanttWidths} timelineHeight={timelineHeight} saveTimelineHeight={saveTimelineHeight} upcomingDays={upcomingDays} upcomingLimit={upcomingLimit} saveUpcomingSettings={saveUpcomingSettings} isMobile={isMobile} showToast={showToast} />}
      </div>
      {modalTask && <TaskModal task={modalTask._isNew ? "new" : modalTask} projectId={modalTask._isNew ? modalTask.projectId : modalTask.projectId} projectName={modalTask._isNew ? modalTask.projectName : (modalTask.project || "")} onClose={handleCloseModal} addTask={addTask} updateTask={updateTask} allS={allS} addSub={addSub} deleteSub={deleteSub} toggleSub={toggleSub} updateSub={updateSub} configCats={configCats} configOwners={configOwners} reorderSubs={reorderSubs} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} showToast={showToast} />}
      {showFileManager && <FileManagerModal project={showFileManager} tasks={twp} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} onClose={handleCloseFileManager} />}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 100, animation: toast.fading ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease", display: "flex", alignItems: "center", gap: 10, background: X.surface, borderRadius: 12, padding: "12px 20px", boxShadow: `0 4px 20px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, maxWidth: "90vw" }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: toast.type === "error" ? X.red : toast.type === "warn" ? X.amber : X.green }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: X.text, whiteSpace: "nowrap" }}>{toast.msg}</span>
      </div>}
    </div>
  );
}
