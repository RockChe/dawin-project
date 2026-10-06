"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { F, FM } from "@/lib/theme";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus, matchesStatusFilter } from "@/lib/statusFilter";
import { useTheme } from "@/components/ThemeProvider";
import { PermissionProvider, useCan } from "@/components/PermissionProvider";
import useTaskManager from "@/hooks/useTaskManager";
import useUserSettings from "@/hooks/useUserSettings";
import { resolveTab, resolveTimeDim, resolveGanttWidths, collectLegacySettings } from "@/lib/personalSettings";
import TaskModal from "./TaskModal";
import FileManagerModal from "./FileManagerModal";
import SettingsTab from "./tabs/SettingsTab";
import TimelineTab from "./tabs/TimelineTab";
import DashboardHeader from "./tabs/DashboardHeader";
import OverviewTab from "./tabs/OverviewTab";
import MyTasksTab from "./tabs/MyTasksTab";
import ProjectsTab, { toggleHidden, PROJECT_TASK_VIEW_DEFAULT } from "./tabs/ProjectsTab";
import DataTab from "./tabs/DataTab";
import Breadcrumbs from "@/components/Breadcrumbs";
import { tabCrumbs } from "@/lib/breadcrumbs";

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
    reorderSubs, reorderProjects, reorderTasks, importTasks,
    deleteManyTasks, updateManyTasks, deleteAllTasks,
    configCats, saveConfigCats, configOwners, saveConfigOwners,
  } = useTaskManager(initialData);
  const { settings: userSettings, updateSetting, ready: settingsReady } = useUserSettings({ zoom: 150, projectsView: 'card', hiddenProjects: [], timelineDefaultCollapsed: true, projectTaskView: PROJECT_TASK_VIEW_DEFAULT }, showToast, initialData?.settings);
  const zoom = userSettings.zoom ?? 150;
  const onZoomChange = useCallback(v => updateSetting('zoom', v), [updateSetting]);
  // #4a Projects card/list view (per-account)
  const projectsView = userSettings.projectsView ?? 'card';
  const setProjectsView = useCallback(v => updateSetting('projectsView', v), [updateSetting]);
  // #4b Timeline hidden projects — stores project.id (per-account)
  const hiddenProjects = useMemo(() => userSettings.hiddenProjects ?? [], [userSettings.hiddenProjects]);
  const toggleHiddenProject = useCallback(id => updateSetting('hiddenProjects', toggleHidden(hiddenProjects, id)), [updateSetting, hiddenProjects]);
  // Projects detail Tasks sort/filter — one global set, not per project (decision:
  // docs/design/dawin-dash-task-sortfilter-q-scope.html)
  const projectTaskView = useMemo(
    () => ({ ...PROJECT_TASK_VIEW_DEFAULT, ...(userSettings.projectTaskView || {}) }),
    [userSettings.projectTaskView]);
  const setProjectTaskView = useCallback(v => updateSetting('projectTaskView', v), [updateSetting]);
  // #T8 Timeline default collapsed (per-account)
  const timelineDefaultCollapsed = userSettings.timelineDefaultCollapsed ?? true;
  const setTimelineDefaultCollapsed = useCallback(v => updateSetting('timelineDefaultCollapsed', v), [updateSetting]);
  const [fpSet, setFPSet] = useState(new Set());
  const toggleFP = useCallback(p => setFPSet(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }), []);
  const [fs, setFS] = useState([]); // 多選狀態篩選，[] = 不篩（非持久化）
  const toggleFS = useCallback(s => setFS(prev => toggleStatus(prev, s)), []);
  const [fpr, setFPR] = useState("全部");
  // 個人設定：目前分頁／時間尺度／欄寬／Timeline 高度／Upcoming 都存 user_settings（per-account，跨裝置）
  const tab = resolveTab(userSettings.activeTab);
  const changeTab = useCallback(v => updateSetting('activeTab', v), [updateSetting]);
  const goHome = useCallback(() => changeTab('overview'), [changeTab]);
  const timeDimOverview = resolveTimeDim(userSettings.timeDimOverview);
  const timeDimTimeline = resolveTimeDim(userSettings.timeDimTimeline);
  const timeDimProject = resolveTimeDim(userSettings.timeDimProject);
  const setTimeDimOverview = useCallback(v => updateSetting('timeDimOverview', v), [updateSetting]);
  const setTimeDimTimeline = useCallback(v => updateSetting('timeDimTimeline', v), [updateSetting]);
  const setTimeDimProject = useCallback(v => updateSetting('timeDimProject', v), [updateSetting]);
  // Timeline 排序：與 Dashboard 共用同一份設定，TimelineTab 不再自開 hook（否則多一次 fetch）
  const timelineSort = userSettings.timelineSort ?? 'manual';
  const setTimelineSort = useCallback(v => updateSetting('timelineSort', v), [updateSetting]);
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
  const ganttWidths = useMemo(() => resolveGanttWidths(userSettings.ganttWidths), [userSettings.ganttWidths]);
  const [ganttDraft, setGanttDraft] = useState(() => JSON.parse(JSON.stringify(ganttWidths)));
  useEffect(() => { setGanttDraft(JSON.parse(JSON.stringify(ganttWidths))); }, [ganttWidths]);
  const saveGanttWidths = useCallback(() => { const filled = {}; for (const v of ["overview", "project", "timeline"]) { filled[v] = {}; for (const k of ["day", "week", "month", "quarter"]) { const val = ganttDraft[v]?.[k]; filled[v][k] = (val === '' || val == null) ? defaultGW[k] : Math.max(1, val); } } const deep = JSON.parse(JSON.stringify(filled)); updateSetting('ganttWidths', deep); setGanttDraft(JSON.parse(JSON.stringify(deep))); showToast("Timeline widths saved", "success"); }, [ganttDraft, showToast, updateSetting]);  // eslint-disable-line react-hooks/exhaustive-deps
  const timelineHeight = userSettings.timelineHeight ?? 100;
  const saveTimelineHeight = useCallback((val) => { const v = Math.max(10, Math.min(200, parseInt(val) || 100)); updateSetting('timelineHeight', v); showToast("Timeline height saved", "success"); }, [showToast, updateSetting]);
  const upcomingDays = userSettings.upcomingDays ?? 30;
  const upcomingLimit = userSettings.upcomingLimit ?? 5;
  const saveUpcomingSettings = useCallback((days, limit) => { const d = Math.max(1, parseInt(days) || 30); const l = Math.max(1, parseInt(limit) || 5); updateSetting('upcomingDays', d); updateSetting('upcomingLimit', l); showToast("Upcoming settings saved", "success"); }, [showToast, updateSetting]);
  // 一次性遷移：伺服器上還沒有的設定，若舊 localStorage 有就採用並寫入一次（不刪舊 key）。
  // 等 settings ready 才跑（避免把「還沒載入」誤判成「沒有」），且只跑一次。
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!settingsReady || migratedRef.current) return;
    migratedRef.current = true;
    let storage = null;
    try { storage = window.localStorage; } catch {}
    for (const [k, v] of Object.entries(collectLegacySettings(userSettings, storage))) updateSetting(k, v);
  }, [settingsReady]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => setScrolled(window.scrollY > 10); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);

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
  const filtered = useMemo(() => twp.filter(d => { if (fpSet.size > 0 && !fpSet.has(d.project)) return false; if (!matchesStatusFilter(d.status, fs)) return false; if (fpr !== "全部" && d.priority !== fpr) return false; if (searchQ) { const q = searchQ.toLowerCase(); if (!(d.task || "").toLowerCase().includes(q) && !(d.project || "").toLowerCase().includes(q) && !(d.owner || "").toLowerCase().includes(q) && !(d.notes || "").toLowerCase().includes(q)) return false; } return true; }), [fpSet, fs, fpr, twp, searchQ]);
  const stats = useMemo(() => { const s = {}; Object.keys(SC).forEach(k => s[k] = 0); twp.forEach(d => s[d.status]++); return s; }, [twp]);
  const avgProg = useMemo(() => filtered.length === 0 ? 0 : Math.round(filtered.reduce((s, d) => s + d.progress, 0) / filtered.length), [filtered]);
  const priStats = useMemo(() => { const p = { "高": 0, "中": 0, "低": 0 }; filtered.forEach(d => p[d.priority]++); return p; }, [filtered]);
  const allProjNames = useMemo(() => [...new Set([...projects.map(p => p.name), ...twp.map(d => d.project), ...customProjects])], [projects, twp, customProjects]);
  const pcMap = useMemo(() => { const m = {}; allProjNames.forEach((p, i) => { m[p] = PJC[i % PJC.length]; }); return m; }, [allProjNames, PJC]);

  // 設定載入前 zoom 只是未存檔的預設值（150），用它渲染會先巨大再縮小——骨架固定 zoom 1。
  if (loading || !settingsReady) {
    const shimmerBg = `linear-gradient(90deg, ${X.surfaceLight || X.surface} 25%, ${X.surface} 50%, ${X.surfaceLight || X.surface} 75%)`;
    const shimmerStyle = { backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 12, background: shimmerBg };
    return (
      <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text, zoom: settingsReady ? zoom / 100 : 1 }}>
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

  // 這兩個分頁各自有頁內篩選，頂部跨專案篩選灰掉並說明
  const ownFilterNote = tab === "projects" ? "Projects 分頁使用專案內的篩選" : tab === "mytasks" ? "My Tasks 分頁使用頁內的篩選" : null;

  return (
    <PermissionProvider role={userRole}>
    <div style={{ minHeight: "100vh", background: X.bg, fontFamily: F, color: X.text, transition: "background-color 0.3s,color 0.3s", zoom: zoom / 100 }}>
      <style>{`::selection{background:${X.selectionBg}} *{box-sizing:border-box} ::-webkit-scrollbar{width:10px;height:10px} ::-webkit-scrollbar-thumb{background:${X.scrollThumb};border-radius:5px} ::-webkit-scrollbar-track{background:transparent} input,select,button{font-family:'Noto Sans TC',-apple-system,sans-serif}`}</style>
      <ReadOnlyBadge X={X} />
      <DashboardHeader themeKey={themeKey} cycleTheme={cycleTheme} scrolled={scrolled} searchInput={searchInput} handleSearch={handleSearch} searchQ={searchQ} clearSearch={clearSearch} avgProg={avgProg} filtered={filtered} />

      <div className="dash-content" style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Filters — 決策 B（docs/design/dawin-dash-task-sortfilter-q-statesync.html）：
            這組是「跨專案」篩選，只管 Overview 與 Timeline。Projects 分頁有自己的專案內
            篩選，所以在那裡把這組灰掉並明講，避免兩組同時看起來都在生效。 */}
        <div aria-disabled={!!ownFilterNote} title={ownFilterNote || undefined}
          style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center",
            opacity: ownFilterNote ? 0.4 : 1, pointerEvents: ownFilterNote ? "none" : "auto" }}>
          {STATUS_FILTERS.map(s => { const a = s === "全部" ? fs.length === 0 : fs.includes(s), c = SC[s]; return (
            <button key={s} onClick={() => toggleFS(s)} style={{ padding: "6px 16px", borderRadius: 20, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec, fontSize: 14, fontWeight: a ? 700 : 400, cursor: "pointer" }}>{s}</button>); })}
          <div style={{ width: 1, height: 20, background: X.border }} />
          {["全部", "高", "中", "低"].map(p => { const a = fpr === p, c = PC[p]; return (
            <button key={p} onClick={() => setFPR(p)} style={{ padding: "6px 14px", borderRadius: 20, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec, fontSize: 14, fontWeight: a ? 700 : 400, cursor: "pointer" }}>{p === "全部" ? "Priority" : p}</button>); })}
        </div>

        {/* Status cards */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: X.textDim }}>全部專案</span>
          {tab === "projects" && <span style={{ fontSize: 11, color: X.amber }}>· Projects 分頁使用下方「本專案」的篩選</span>}
          {tab === "mytasks" && <span style={{ fontSize: 11, color: X.amber }}>· My Tasks 分頁使用頁內的篩選</span>}
        </div>
        <div aria-disabled={!!ownFilterNote}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20,
            opacity: ownFilterNote ? 0.4 : 1, pointerEvents: ownFilterNote ? "none" : "auto" }}>
          {Object.entries(SC).map(([k, c]) => (<div key={k} onClick={() => toggleFS(k)} style={{ background: X.surface, borderRadius: 12, padding: "16px 18px", border: fs.includes(k) ? `1px solid ${c.color}` : `1px solid ${X.border}`, boxShadow: X.surfaceShadow, cursor: "pointer" }}>
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
        <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          {allProjNames.map(p => { const a = fpSet.has(p); const cl = pcMap[p] || X.accent; return (
            <button key={p} onClick={() => toggleFP(p)} style={{ padding: "5px 12px", borderRadius: 20, border: a ? `2px solid ${cl}` : `1px solid ${X.border}`, background: a ? `${cl}18` : X.surface, color: a ? cl : X.textSec, fontSize: 14, fontWeight: a ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: cl, opacity: a ? 1 : 0.4 }} />
              {p}
            </button>); })}
          {fpSet.size > 0 && <button onClick={() => setFPSet(new Set())} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${X.border}`, background: X.surface, color: X.textDim, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>Clear</button>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${X.border}`, marginBottom: 20 }}>
          {[{ k: "overview", l: "Overview" }, { k: "mytasks", l: "My Tasks" }, { k: "projects", l: "Projects" }, { k: "timeline", l: "Timeline" }, { k: "table", l: "Data" }, { k: "settings", l: "Settings" }].map(t => (
            <button key={t.k} onClick={() => changeTab(t.k)} style={{ padding: "12px 20px", border: "none", background: "transparent", color: tab === t.k ? X.accent : X.textSec, fontSize: 14, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer", borderBottom: tab === t.k ? `2px solid ${X.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.2s, border-color 0.2s" }}>{t.l}</button>))}
        </div>

        {/* 麵包屑：Projects 由 ProjectsTab 自己畫（選了專案會多一層），這裡跳過，確保全頁只有一列 */}
        {tab !== "projects" && <Breadcrumbs items={tabCrumbs(tab, { onHome: goHome })} />}

        {/* OVERVIEW */}
        {tab === "overview" && <OverviewTab projects={projects} timeDim={timeDimOverview} onTimeDimChange={setTimeDimOverview} filtered={filtered} twp={twp} allS={allS} pcMap={pcMap} ganttWidths={ganttWidthsOverview} projBanners={projBanners} stats={stats} upcomingDays={upcomingDays} upcomingLimit={upcomingLimit} configOwners={configOwners} />}

        {/* MY TASKS */}
        {tab === "mytasks" && <MyTasksTab twp={twp} userName={initialData?.session?.name} pcMap={pcMap} setModalTask={handleSetModalTask} />}

        {/* PROJECTS */}
        {tab === "projects" && <ProjectsTab onHome={goHome} timeDim={timeDimProject} onTimeDimChange={setTimeDimProject} twp={twp} allS={allS} projects={projects} configOwners={configOwners} pcMap={pcMap} allProjNames={allProjNames} setModalTask={handleSetModalTask} setShowFileManager={handleSetShowFileManager} ganttWidths={ganttWidthsProject} timelineHeight={timelineHeight} showToast={showToast} renameProject={renameProject} addProject={addProject} deleteProject={deleteProjectAction} updateTask={updateTask} deleteTask={deleteTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} reorderSubs={reorderSubs} reorderProjects={reorderProjects} reorderTasks={reorderTasks} projBanners={projBanners} setProjBanners={setProjBanners} onProjectRenamed={handleProjectRenamed} onProjectDeleted={handleProjectDeleted} projectsView={projectsView} setProjectsView={setProjectsView} hiddenProjects={hiddenProjects} toggleHidden={toggleHiddenProject} projectTaskView={projectTaskView} setProjectTaskView={setProjectTaskView} />}

        {/* TIMELINE */}
        {tab === "timeline" && <TimelineTab timeDim={timeDimTimeline} onTimeDimChange={setTimeDimTimeline} timelineSort={timelineSort} onTimelineSortChange={setTimelineSort} twp={twp} allS={allS} fpSet={fpSet} fs={fs} fpr={fpr} ganttWidths={ganttWidthsTimeline} timelineHeight={timelineHeight} configOwners={configOwners} hiddenProjects={hiddenProjects} projects={projects} timelineDefaultCollapsed={timelineDefaultCollapsed} setTimelineDefaultCollapsed={setTimelineDefaultCollapsed} />}

        {/* DATA TABLE */}
        {tab === "table" && <DataTab filtered={filtered} allS={allS} allT={allT} twp={twp} projects={projects} updateTask={updateTask} deleteTask={deleteTask} addTask={addTask} toggleSub={toggleSub} updateSub={updateSub} addSub={addSub} deleteSub={deleteSub} configCats={configCats} configOwners={configOwners} pcMap={pcMap} importTasks={importTasks} deleteManyTasks={deleteManyTasks} updateManyTasks={updateManyTasks} deleteAllTasks={deleteAllTasks} showToast={showToast} setModalTask={handleSetModalTask} />}
        {/* SETTINGS */}
        {tab === "settings" && <SettingsTab configCats={configCats} saveConfigCats={saveConfigCats} configOwners={configOwners} ganttDraft={ganttDraft} setGanttDraft={setGanttDraft} saveGanttWidths={saveGanttWidths} timelineHeight={timelineHeight} saveTimelineHeight={saveTimelineHeight} upcomingDays={upcomingDays} upcomingLimit={upcomingLimit} saveUpcomingSettings={saveUpcomingSettings} showToast={showToast} zoom={zoom} onZoomChange={onZoomChange} />}
      </div>
      {modalTask && <TaskModal task={modalTask._isNew ? "new" : modalTask} projectId={modalTask._isNew ? modalTask.projectId : modalTask.projectId} projectName={modalTask._isNew ? modalTask.projectName : (modalTask.project || "")} onClose={handleCloseModal} addTask={addTask} updateTask={updateTask} allS={allS} addSub={addSub} deleteSub={deleteSub} toggleSub={toggleSub} updateSub={updateSub} configCats={configCats} configOwners={configOwners} reorderSubs={reorderSubs} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} showToast={showToast} />}
      {showFileManager && <FileManagerModal project={showFileManager} tasks={twp} allL={allL} allF={allF} addLink={addLink} addFile={addFile} deleteLink={deleteLink} deleteFile={deleteFile} onClose={handleCloseFileManager} showToast={showToast} />}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 100, animation: toast.fading ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease", display: "flex", alignItems: "center", gap: 10, background: X.surface, borderRadius: 12, padding: "12px 20px", boxShadow: `0 4px 20px ${X.shadowHeavy}`, border: `1px solid ${X.border}`, maxWidth: "90vw" }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: toast.type === "error" ? X.red : toast.type === "warn" ? X.amber : X.green }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: X.text, whiteSpace: "nowrap" }}>{toast.msg}</span>
      </div>}
    </div>
    </PermissionProvider>
  );
}

// 唯讀模式徽章：viewer 沒有 write 能力時顯示，讓人知道不是壞了。
function ReadOnlyBadge({ X }) {
  const canWrite = useCan("write");
  if (canWrite) return null;
  return (
    <div style={{ background: `${X.amber}18`, borderBottom: `1px solid ${X.amber}40`, color: X.amber, fontSize: 13, fontWeight: 600, textAlign: "center", padding: "6px 12px" }}>
      👁 唯讀模式 — 你目前的權限只能檢視，無法編輯
    </div>
  );
}
