"use client";
import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD } from "@/lib/utils";
import { STATUSES } from "@/lib/constants";
import EditableCell from "../EditableCell";
import InlineNote from "../InlineNote";
import OwnerTags from "../OwnerTags";
import TagInput from "../TagInput";
import ProgressBar from "../ProgressBar";
import SortableSubItem from "../SortableSubItem";
import GanttTimeline, { TimeScaleToggle } from "../GanttTimeline";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SortableProjectCard, { EyeToggle } from "../SortableProjectCard";
import { deleteProjectBanner } from "@/server/actions/projects";

const STATUS_OPTIONS = ["已完成", "進行中", "待辦", "提案中", "待確認"];

/**
 * Toggle a project id in the hiddenProjects list (immutable add/remove).
 * Used by the #4b eye toggle — hiddenProjects stores project.id (stable across renames).
 * @param {Array|null|undefined} hiddenIds
 * @param {string} id
 * @returns {Array} new array
 */
export function toggleHidden(hiddenIds, id) {
  const list = hiddenIds || [];
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}

const PRIORITY_ORDER = ["高", "中", "低"];

/** 排序欄位選單。預設 start ＝ 維持這個列表原本的開始日排序，不改既有行為。 */
export const TASK_SORT_FIELDS = [
  { key: "start", label: "開始日" },
  { key: "end", label: "截止日" },
  { key: "status", label: "狀態" },
  { key: "owner", label: "負責人" },
  { key: "priority", label: "緊急度" },
];

/** 一組全域設定（非每專案一組），存 user_settings 的 projectTaskView。 */
export const PROJECT_TASK_VIEW_DEFAULT = { sort: { field: "start", dir: "asc" }, status: [], owner: [], priority: [] };

/** owner 是逗號分隔多人字串 → 拆成名字陣列，比對「包含這個人」而非子字串。 */
const ownerNames = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);

/**
 * Filter the detail-view task list. Empty array = no constraint on that field.
 * 欄位內 OR、欄位間 AND（架構文件 §4 fs-t2-2）。
 * @param {Array} tasks
 * @param {{status?:string[], owner?:string[], priority?:string[]}} f
 * @returns {Array} new array
 */
export function filterProjectTasks(tasks, f = {}) {
  const { status = [], owner = [], priority = [] } = f || {};
  return tasks.filter(t => {
    if (status.length && !status.includes(t.status)) return false;
    if (priority.length && !priority.includes(t.priority)) return false;
    if (owner.length && !ownerNames(t.owner).some(n => owner.includes(n))) return false;
    return true;
  });
}

// null ＝「這筆沒有值」，一律排最後，不隨 dir 翻面 —— 把空值排到最前面沒有人想要。
function taskSortKey(t, field) {
  if (field === "status") { const i = STATUSES.indexOf(t.status); return i < 0 ? null : i; }
  if (field === "priority") { const i = PRIORITY_ORDER.indexOf(t.priority); return i < 0 ? null : i; }
  if (field === "owner") return t.owner ? String(t.owner) : null;
  const d = t[field] ? pD(t[field]) : null;   // start / end
  return d ? d.getTime() : null;
}

/**
 * Sort the detail-view task list by a single field. Stable: equal keys keep input order
 * (the input is already start-date ordered), so the second level is never arbitrary.
 * @param {Array} tasks
 * @param {{field?:string, dir?:'asc'|'desc'}} s
 * @returns {Array} new array
 */
export function sortProjectTasks(tasks, s = {}) {
  const { field = "start", dir = "asc" } = s || {};
  const sign = dir === "desc" ? -1 : 1;
  return tasks
    .map((t, i) => [t, i])
    .sort(([a, ai], [b, bi]) => {
      const ka = taskSortKey(a, field), kb = taskSortKey(b, field);
      if (ka === null || kb === null) return ka === kb ? ai - bi : ka === null ? 1 : -1;
      if (ka === kb) return ai - bi;
      return (typeof ka === "string" ? ka.localeCompare(kb) : ka - kb) * sign;
    })
    .map(([t]) => t);
}

/**
 * Compact one-line project row for the #4a list ("明細") view.
 * Drag handle (manual sort) · icon · name/counts · progress · status stats · eye toggle.
 */
function SortableProjectRow({ project, pn, pt, c, ts, avg, stC, icon, dragEnabled, hidden, onToggleHidden, onSelect }) {
  const { X, SC } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id, disabled: !dragEnabled });
  const sStyle = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={sStyle}>
      <div onClick={onSelect} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: X.surface, border: `1px solid ${X.border}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", boxShadow: X.surfaceShadow, transition: "border-color 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = c} onMouseLeave={e => e.currentTarget.style.borderColor = X.border}>
        {dragEnabled && (
          <span className="dash-tap" {...attributes} {...listeners} onClick={e => e.stopPropagation()} title="拖移排序" style={{ cursor: "grab", fontSize: 16, color: X.textDim, userSelect: "none", flexShrink: 0, padding: "2px 2px" }}>⠿</span>
        )}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: icon ? "transparent" : `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: c, flexShrink: 0, overflow: "hidden", border: icon ? "none" : `1px dashed ${c}50` }}>
          {icon ? <img src={icon} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} /> : pn[0]}
        </div>
        {/* 同上：給名稱塊一個寬度下限，避免被右側固定寬度的區塊擠成零寬 */}
        <div style={{ flex: "1 1 120px", minWidth: 100 }}>
          <div className="dash-name-1line" style={{ fontSize: 14, fontWeight: 600 }}>{pn}</div>
          <div style={{ fontSize: 12, color: X.textDim, fontFamily: FM }}>{pt.length} tasks · {ts.length} subtasks</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 120px", minWidth: 110 }}>
          <div style={{ flex: 1, height: 5, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${avg}%`, background: c, borderRadius: 2, opacity: 0.8 }} /></div>
          <span style={{ fontFamily: FM, fontSize: 13, fontWeight: 600, color: avg === 100 ? X.green : X.text, width: 36, textAlign: "right" }}>{avg}%</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {Object.entries(stC).map(([st, cnt]) => { const sc = SC[st] || {}; return (<span key={st} style={{ fontSize: 12, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.color }}>{cnt}</span>); })}
        </div>
        {onToggleHidden && <EyeToggle hidden={hidden} onToggle={onToggleHidden} />}
        <span style={{ fontSize: 18, color: X.textDim, flexShrink: 0 }}>›</span>
      </div>
    </div>
  );
}

function ProjectsTab({ twp, allS, projects, configOwners, pcMap, allProjNames, isMobile, setModalTask, setShowFileManager, ganttWidths, timelineHeight, showToast, renameProject, addProject, deleteProject: deleteProjectAction, updateTask, deleteTask, toggleSub, updateSub, addSub, deleteSub, reorderSubs, reorderProjects, projBanners, setProjBanners, onProjectRenamed, onProjectDeleted, projectsView = "card", setProjectsView, hiddenProjects = [], toggleHidden: onToggleHidden, projectTaskView = PROJECT_TASK_VIEW_DEFAULT, setProjectTaskView }) {
  const { X, SC, inputStyle } = useTheme();
  const projMeta = useMemo(() => { const m = {}; projects.forEach(p => { m[p.name] = { creatorName: p.creatorName || null, source: p.source || null }; }); return m; }, [projects]);
  const [selProj, setSelProj] = useState(null);
  const [showCreateProj, setShowCreateProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [showArch, setShowArch] = useState(false);
  const [archived, setArchived] = useState(new Set());
  const [uploadTarget, setUploadTarget] = useState(null);
  const [showSubAdd, setShowSubAdd] = useState(null);
  const [subDraft, setSubDraft] = useState({ name: "", owner: "" });
  const [timeDim, setTimeDim] = useState("月");
  const [sortMode, setSortMode] = useState("manual");
  const [detailIconHover, setDetailIconHover] = useState(false);
  const [openStatusId, setOpenStatusId] = useState(null);
  const statusDropRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!openStatusId) return;
    const handler = (e) => { if (statusDropRef.current && !statusDropRef.current.contains(e.target)) setOpenStatusId(null); };
    const keyHandler = (e) => { if (e.key === "Escape") setOpenStatusId(null); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [openStatusId]);
  const iS2 = inputStyle;
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sortedProjList = useMemo(() => {
    const valid = projects.filter(p => !archived.has(p.name));
    switch (sortMode) {
      case "name": return [...valid].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
      case "created": return [...valid].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case "progress": return [...valid].sort((a, b) => {
        const ptA = twp.filter(d => d.project === a.name);
        const ptB = twp.filter(d => d.project === b.name);
        const avgA = ptA.length ? ptA.reduce((s, t) => s + t.progress, 0) / ptA.length : 0;
        const avgB = ptB.length ? ptB.reduce((s, t) => s + t.progress, 0) / ptB.length : 0;
        return avgB - avgA;
      });
      default: return [...valid].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
  }, [projects, archived, sortMode, twp]);

  const handleProjectDragEnd = useCallback((ev) => {
    const { active, over } = ev;
    if (active && over && active.id !== over.id) {
      reorderProjects(active.id, over.id);
    }
  }, [reorderProjects]);

  const handleIconUpload = async (e, projName) => {
    const file = e.target.files[0];
    if (!file) return;
    const proj = projects.find(p => p.name === projName);
    if (!proj) return;
    // Optimistic update with DataURL
    const reader = new FileReader();
    reader.onload = (ev) => setProjBanners(p => ({ ...p, [projName]: ev.target.result }));
    reader.readAsDataURL(file);
    // Upload to R2
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', proj.id);
    try {
      const res = await fetch('/api/upload-banner', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.bannerUrl) {
        setProjBanners(p => ({ ...p, [projName]: data.bannerUrl }));
        showToast("圖示已上傳", "success");
      } else if (data.error) {
        setProjBanners(p => { const n = { ...p }; delete n[projName]; return n; });
        showToast(data.error, "error");
      }
    } catch {
      setProjBanners(p => { const n = { ...p }; delete n[projName]; return n; });
      showToast("圖示上傳失敗", "error");
    }
  };
  const handleIconRemove = async (projName) => {
    const proj = projects.find(p => p.name === projName);
    if (!proj) return;
    // Optimistic remove
    const old = projBanners[projName];
    setProjBanners(p => { const n = { ...p }; delete n[projName]; return n; });
    const result = await deleteProjectBanner(proj.id);
    if (result?.error) {
      setProjBanners(p => ({ ...p, [projName]: old }));
      showToast(result.error, "error");
    } else {
      showToast("圖示已刪除", "success");
    }
  };

  const archiveProj = useCallback(p => { setArchived(prev => { const n = new Set(prev); n.add(p); return n; }); setSelProj(null); showToast("Project archived", "warn"); }, [showToast]);
  const unarchiveProj = useCallback(p => { setArchived(prev => { const n = new Set(prev); n.delete(p); return n; }); showToast("Project unarchived", "success"); }, [showToast]);

  const deleteProj = useCallback(async (p) => {
    const proj = projects.find(pr => pr.name === p);
    if (proj) { await deleteProjectAction(proj.id); }
    onProjectDeleted(p);
    setSelProj(null);
  }, [projects, deleteProjectAction, onProjectDeleted]);

  const createProj = useCallback(async (name) => {
    if (!name.trim()) return;
    const result = await addProject(name.trim());
    if (result?.success) { setShowCreateProj(false); setNewProjName(""); setSelProj(name.trim()); }
  }, [addProject]);

  const handleRename = useCallback((oldName, newName) => {
    if (!newName || newName === oldName) return;
    const proj = projects.find(p => p.name === oldName);
    if (!proj) return;
    renameProject(proj.id, newName);
    setProjBanners(p => { const n = { ...p }; if (n[oldName]) { n[newName] = n[oldName]; delete n[oldName]; } return n; });
    setArchived(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; });
    onProjectRenamed(oldName, newName);
    setSelProj(newName);
  }, [projects, renameProject, setProjBanners, onProjectRenamed]);

  const openNewTaskModal = useCallback(() => {
    const proj = projects.find(p => p.name === selProj);
    setModalTask({ _isNew: true, projectId: proj?.id, projectName: selProj });
  }, [projects, selProj, setModalTask]);

  // Project list view
  if (!selProj) return (
    <div>
      <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => { if (uploadTarget) handleIconUpload(e, uploadTarget); setUploadTarget(null); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        {/* 內層也要 wrap：不換行時這一組（Archived + 排序 + 卡片/明細）寬 399px，
            會把整個 main 撐寬到出現橫向捲軸，畫面就被推出左緣。 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowArch(!showArch)} style={{ background: showArch ? X.surfaceLight : X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>
            Archived ({archived.size})
          </button>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={{ background: X.surface, color: X.text, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 14, cursor: "pointer", outline: "none" }}>
            <option value="manual">手動排序</option>
            <option value="name">依名稱</option>
            <option value="created">依建立時間</option>
            <option value="progress">依進度</option>
          </select>
          {setProjectsView && (
            <div role="group" aria-label="檢視模式" style={{ display: "flex", border: `1px solid ${X.border}`, borderRadius: 20, overflow: "hidden" }}>
              {[{ k: "card", l: "卡片", icon: "▦" }, { k: "list", l: "明細", icon: "☰" }].map(v => { const a = projectsView === v.k; return (
                <button key={v.k} onClick={() => setProjectsView(v.k)} title={`${v.l}檢視`} aria-label={`${v.l}檢視`} aria-pressed={a}
                  style={{ background: a ? X.surfaceLight : X.surface, color: a ? X.accent : X.textSec, border: "none", padding: "6px 12px", fontSize: 14, fontWeight: a ? 700 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span aria-hidden="true">{v.icon}</span>{v.l}
                </button>); })}
            </div>
          )}
        </div>
        {!showCreateProj ? (<button onClick={() => setShowCreateProj(true)} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
        ) : (<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={newProjName} onChange={e => setNewProjName(e.target.value)} placeholder="Project name" onKeyDown={e => { if (e.key === "Enter") createProj(newProjName); if (e.key === "Escape") { setShowCreateProj(false); setNewProjName(""); } }} autoFocus style={{ fontSize: 14, padding: "6px 12px", borderRadius: 20, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, width: 200 }} />
          <button onClick={() => createProj(newProjName)} disabled={!newProjName.trim()} style={{ background: newProjName.trim() ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: newProjName.trim() ? "pointer" : "not-allowed" }}>Confirm</button>
          <button onClick={() => { setShowCreateProj(false); setNewProjName(""); }} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>)}
      </div>
      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
        <SortableContext items={sortedProjList.map(p => p.id)} strategy={projectsView === "list" ? verticalListSortingStrategy : rectSortingStrategy} disabled={sortMode !== "manual"}>
          <div className={projectsView === "list" ? undefined : "dash-grid-cards"} style={projectsView === "list" ? { display: "flex", flexDirection: "column", gap: 8 } : undefined}>
            {sortedProjList.map(proj => {
              const pn = proj.name;
              const pt = twp.filter(d => d.project === pn); const c = pcMap[pn] || X.accent;
              const ts = allS.filter(s => pt.some(t => t.id === s.taskId));
              const avg = pt.length > 0 ? Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length) : 0;
              const stC = {}; pt.forEach(t => { stC[t.status] = (stC[t.status] || 0) + 1; });
              const icn = projBanners[pn];
              const isHidden = hiddenProjects.includes(proj.id);
              const onToggle = onToggleHidden ? () => onToggleHidden(proj.id) : undefined;
              return projectsView === "list" ? (
                <SortableProjectRow key={proj.id} project={proj} pn={pn} pt={pt} c={c} ts={ts} avg={avg} stC={stC} icon={icn}
                  dragEnabled={sortMode === "manual"} hidden={isHidden} onToggleHidden={onToggle} onSelect={() => setSelProj(pn)} />
              ) : (
                <SortableProjectCard key={proj.id} project={proj} pn={pn} pt={pt} c={c} ts={ts} avg={avg} stC={stC} icon={icn}
                  dragEnabled={sortMode === "manual"} hidden={isHidden} onToggleHidden={onToggle} onSelect={() => setSelProj(pn)} onArchive={() => archiveProj(pn)} onDelete={() => deleteProj(pn)}
                  onIconClick={() => { setUploadTarget(pn); fileRef.current?.click(); }} onIconRemove={() => handleIconRemove(pn)} />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      {showArch && archived.size > 0 && (<div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: X.textDim, marginBottom: 12 }}>Archived</div>
        <div className="dash-grid-2col" style={{ gap: 12 }}>
          {[...archived].map(pn => { const pt = twp.filter(d => d.project === pn); if (!pt.length) return null;
            return (<div key={pn} onClick={() => setSelProj(pn)} style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, opacity: 0.5, cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{pn}</div><div style={{ fontSize: 14, color: X.textDim, fontFamily: FM }}>{pt.length} tasks</div></div>
              <button onClick={e => { e.stopPropagation(); unarchiveProj(pn); }} style={{ background: X.surfaceLight, border: `1px solid ${X.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>Unarchive</button>
              <button className="dash-tap" onClick={e => { e.stopPropagation(); if (confirm("Permanently delete?")) deleteProj(pn); unarchiveProj(pn); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "4px 12px", fontSize: 14, color: X.red, cursor: "pointer" }}>Delete</button>
            </div>);
          })}
        </div>
      </div>)}
    </div>
  );

  // Project detail view
  const pt = twp.filter(d => d.project === selProj).sort((a, b) => { const da = a.start ? pD(a.start) : new Date(9999, 0); const db = b.start ? pD(b.start) : new Date(9999, 0); return da - db; });
  const c = pcMap[selProj] || X.accent; const ts = allS.filter(s => pt.some(t => t.id === s.taskId)); const ds = ts.filter(s => s.done).length;
  const avg = pt.length > 0 ? Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length) : 0;
  const detailIcon = projBanners[selProj];
  // ptView drives ONLY the task list. pt stays unfiltered so Progress / Subtasks /
  // 狀態 chip 數字 / 甘特條 keep describing the whole project — a "47%" that moves
  // because of what you clicked is not a number anyone can read.
  const ptView = sortProjectTasks(filterProjectTasks(pt, projectTaskView), projectTaskView.sort);
  const patchView = patch => setProjectTaskView?.({ ...projectTaskView, ...patch });
  const toggleIn = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const ownerOptions = [...new Set(pt.flatMap(t => String(t.owner || "").split(",").map(s => s.trim()).filter(Boolean)))];
  const viewIsDefault = !projectTaskView.status.length && !projectTaskView.owner.length && !projectTaskView.priority.length
    && projectTaskView.sort.field === PROJECT_TASK_VIEW_DEFAULT.sort.field && projectTaskView.sort.dir === PROJECT_TASK_VIEW_DEFAULT.sort.dir;
  const pillStyle = on => ({ fontSize: 12, padding: isMobile ? "8px 12px" : "3px 10px", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${on ? X.accent : X.border}`, background: on ? `${X.accent}15` : X.surface,
    color: on ? X.accent : X.textSec, fontWeight: on ? 700 : 400 });

  return (<div>
    <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => { if (uploadTarget) handleIconUpload(e, uploadTarget); setUploadTarget(null); }} />
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <button onClick={() => { setSelProj(null); }} style={{ background: X.surface, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>← Back</button>
      {/* Detail Icon */}
      <div
        onClick={e => { e.stopPropagation(); setUploadTarget(selProj); fileRef.current?.click(); }}
        onMouseEnter={() => setDetailIconHover(true)}
        onMouseLeave={() => setDetailIconHover(false)}
        title={detailIcon ? "更換圖示" : "上傳圖示"}
        style={{ position: "relative", width: 80, height: 80, borderRadius: 18, background: detailIcon ? "transparent" : `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: c, cursor: "pointer", overflow: "hidden", border: detailIcon ? "none" : `1px dashed ${c}50`, flexShrink: 0 }}>
        {detailIcon ? <img src={detailIcon} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 18 }} /> : selProj[0]}
        {detailIcon && detailIconHover && (
          <button
            onClick={e => { e.stopPropagation(); handleIconRemove(selProj); }}
            style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", fontSize: 14, lineHeight: "22px", textAlign: "center", cursor: "pointer", padding: 0, zIndex: 2 }}
            title="刪除圖示">×</button>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}><h2 className="dash-name-1line" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}><EditableCell value={selProj} onSave={v => handleRename(selProj, v)} style={{ fontSize: 24, fontWeight: 700 }} /></h2><div style={{ fontSize: 14, color: X.textDim, fontFamily: FM, marginTop: 2 }}>{pt.length} tasks · {ts.length} subtasks · {ds} done</div>{projMeta[selProj]?.creatorName && <div style={{ fontSize: 12, color: X.textDim, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>{projMeta[selProj].creatorName} · <span style={{ padding: "0 5px", borderRadius: 6, background: projMeta[selProj].source === 'csv_import' ? `${X.purple}15` : `${X.accent}15`, color: projMeta[selProj].source === 'csv_import' ? X.purple : X.accent, fontSize: 10, fontWeight: 600 }}>{projMeta[selProj].source === 'csv_import' ? 'CSV匯入' : '手動'}</span></div>}</div>
      <button onClick={() => setShowFileManager(selProj)} style={{ background: "transparent", border: `1px solid ${X.accent}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.accent, cursor: "pointer", fontWeight: 600 }}>📁 檔案管理</button>
      <button onClick={() => archiveProj(selProj)} style={{ background: "transparent", border: `1px solid ${X.amber}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.amber, cursor: "pointer", fontWeight: 600 }}>Archive</button>
      <button onClick={() => { if (confirm("Delete?")) deleteProj(selProj); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.red, cursor: "pointer", fontWeight: 600 }}>Delete</button>
    </div>
    {pt.some(t => t.start) && (<div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}><TimeScaleToggle value={timeDim} onChange={setTimeDim} /></div>
      {/* 決策 B：詳情頁甘特跟著「下方那組」專案內篩選走，不吃上方跨專案的全域篩選。
          原本三個都寫死「全部」，所以它從來不被任何篩選影響。 */}
      <GanttTimeline tasks={twp} subtasks={allS} fp={selProj} fs={projectTaskView.status} fpr={projectTaskView.priority} fow={projectTaskView.owner} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths} timelineHeight={timelineHeight} configOwners={configOwners} />
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
          <div style={{ fontSize: 12, color: X.textDim, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span>Tasks <span style={{ fontSize: 10.5, color: X.textDim }}>· 本專案</span></span>
            {/* 同一個 handler，和下方工具列的「重置」是同一個動作——單一動作放兩處不會有同步問題 */}
            {viewIsDefault
              ? <span style={{ fontSize: 11 }}>點一下只看它</span>
              : <span role="button" tabIndex={0} title="清掉全部篩選與排序"
                  onClick={() => setProjectTaskView?.(PROJECT_TASK_VIEW_DEFAULT)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProjectTaskView?.(PROJECT_TASK_VIEW_DEFAULT); } }}
                  style={{ fontSize: 11, color: X.red, cursor: "pointer", border: `1px solid ${X.red}40`, borderRadius: 20, padding: "1px 9px" }}>重置</span>}
          </div>
          {/* The counts stay whole-project; clicking only toggles which rows the list shows. */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {Object.entries((() => { const sc = {}; pt.forEach(t => { sc[t.status] = (sc[t.status] || 0) + 1; }); return sc; })()).map(([st, cnt]) => {
              const s = SC[st] || {}; const on = projectTaskView.status.includes(st);
              const off = projectTaskView.status.length > 0 && !on;
              return (<span key={st} role="button" tabIndex={0} aria-pressed={on} title={`只看「${st}」`}
                onClick={() => patchView({ status: toggleIn(projectTaskView.status, st) })}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchView({ status: toggleIn(projectTaskView.status, st) }); } }}
                style={{ fontSize: 14, fontWeight: 600, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                  background: s.bg, color: s.color, opacity: off ? 0.4 : 1,
                  border: `1px solid ${on ? s.color : "transparent"}`, borderStyle: off ? "dashed" : "solid" }}>{st} {cnt}</span>);
            })}
          </div>
        </div>
      </div>
      <div style={{ background: X.surface, borderRadius: 12, border: `1px solid ${X.border}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Tasks
            {ptView.length !== pt.length && <span style={{ fontFamily: FM, fontSize: 12, fontWeight: 400, color: X.textDim, marginLeft: 8 }}>{ptView.length} / {pt.length}</span>}
          </span>
          <button onClick={openNewTaskModal} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
        </div>
        <div style={{ padding: "8px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: X.surfaceLight }}>
          <select value={projectTaskView.sort.field} onChange={e => patchView({ sort: { ...projectTaskView.sort, field: e.target.value } })}
            aria-label="排序欄位" style={{ ...inputStyle, fontSize: 12, padding: "3px 8px", borderRadius: 20, cursor: "pointer" }}>
            {TASK_SORT_FIELDS.map(f => <option key={f.key} value={f.key}>排序：{f.label}</option>)}
          </select>
          <span role="button" tabIndex={0} title={projectTaskView.sort.dir === "asc" ? "升冪" : "降冪"}
            onClick={() => patchView({ sort: { ...projectTaskView.sort, dir: projectTaskView.sort.dir === "asc" ? "desc" : "asc" } })}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchView({ sort: { ...projectTaskView.sort, dir: projectTaskView.sort.dir === "asc" ? "desc" : "asc" } }); } }}
            style={pillStyle(true)}>{projectTaskView.sort.dir === "asc" ? "↑" : "↓"}</span>

          {ownerOptions.length > 0 && <span style={{ fontSize: 12, color: X.textDim, marginLeft: 6 }}>負責人</span>}
          {ownerOptions.map(o => <span key={o} role="button" tabIndex={0} aria-pressed={projectTaskView.owner.includes(o)}
            onClick={() => patchView({ owner: toggleIn(projectTaskView.owner, o) })}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchView({ owner: toggleIn(projectTaskView.owner, o) }); } }}
            style={pillStyle(projectTaskView.owner.includes(o))}>{o}</span>)}

          <span style={{ fontSize: 12, color: X.textDim, marginLeft: 6 }}>緊急度</span>
          {PRIORITY_ORDER.map(p => <span key={p} role="button" tabIndex={0} aria-pressed={projectTaskView.priority.includes(p)}
            onClick={() => patchView({ priority: toggleIn(projectTaskView.priority, p) })}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); patchView({ priority: toggleIn(projectTaskView.priority, p) }); } }}
            style={pillStyle(projectTaskView.priority.includes(p))}>{p}</span>)}

          {!viewIsDefault && <span role="button" tabIndex={0} onClick={() => setProjectTaskView?.(PROJECT_TASK_VIEW_DEFAULT)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProjectTaskView?.(PROJECT_TASK_VIEW_DEFAULT); } }}
            style={{ fontSize: 12, color: X.red, cursor: "pointer", marginLeft: "auto" }}>重置</span>}
        </div>
        {pt.length > 0 && !ptView.length && <div style={{ padding: 40, textAlign: "center", color: X.textDim, fontSize: 14 }}>沒有符合目前篩選的 task</div>}
        {ptView.map(task => { const sc = SC[task.status] || {}; const tSubs = allS.filter(s => s.taskId === task.id); return (
          <div key={task.id} style={{ borderBottom: `1px solid ${X.border}` }}>
            {/* flexWrap + a real minWidth floor: with `minWidth: 0` alone the title block
                is allowed to shrink to ZERO once the badge/progress/× cluster runs out of
                room (measured: width 0 with 131px of content at 360px × zoom 1.5), and the
                text then spills over its siblings. The floor keeps ellipsis working while
                forcing the right-hand cluster onto its own line instead. */}
            <div onClick={() => setModalTask(task)} style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ flex: "1 1 200px", minWidth: 140 }}>
                <div className="dash-name-1line" style={{ fontSize: 14, fontWeight: 500 }}>{task.task}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                  <OwnerTags value={task.owner} configOwners={configOwners} /><span style={{ fontSize: 14, color: X.textDim }}>·</span>
                  <span style={{ fontFamily: FM, fontSize: 14, color: X.textSec }}>{fD(task.start)} → {fD(task.end)}</span>
                </div>
              </div>
              <div ref={openStatusId === task.id ? statusDropRef : null} style={{ position: "relative" }}>
                <span onClick={e => { e.stopPropagation(); setOpenStatusId(openStatusId === task.id ? null : task.id); }} style={{ fontSize: 14, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, cursor: "pointer", userSelect: "none" }}>{task.status}</span>
                {openStatusId === task.id && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: X.surface, border: `1px solid ${X.border}`, borderRadius: 10, boxShadow: `0 4px 16px ${X.shadowHeavy}`, padding: "4px 0", minWidth: 120 }}>
                    {STATUS_OPTIONS.map(st => { const s = SC[st] || {}; return (
                      <div key={st} onClick={e => { e.stopPropagation(); updateTask(task.id, "status", st); setOpenStatusId(null); }} onMouseEnter={e => e.currentTarget.style.background = X.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"} style={{ padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ padding: "1px 8px", borderRadius: 8, background: s.bg, color: s.color, fontWeight: 600, fontSize: 12 }}>{st}</span>
                        {task.status === st && <span style={{ color: s.color, fontSize: 12, marginLeft: "auto" }}>✓</span>}
                      </div>); })}
                  </div>
                )}
              </div>
              <div style={{ width: 90 }}><ProgressBar pct={task.progress} done={task.sDone} total={task.sTotal} timeBased={task.timeBased} /></div>
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
                  <div style={{ flex: "0 0 140px" }}><TagInput value={subDraft.owner} onChange={v => setSubDraft(p => ({ ...p, owner: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="負責人..." style={{ fontSize: 13 }} /></div>
                  <button onClick={() => { if (subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubAdd(null); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                  <button onClick={() => setShowSubAdd(null)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>Cancel</button>
                </div>
                : <span onClick={e => { e.stopPropagation(); setShowSubAdd(task.id); setSubDraft({ name: "", owner: "" }); }} style={{ fontSize: 13, color: X.accent, fontWeight: 500, cursor: "pointer", opacity: 0.5, padding: "2px 8px" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>+ Add subtask</span>
              }
            </div>
          </div>); })}
        {!pt.length && <div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks yet</div><div style={{ fontSize: 14, marginBottom: 16 }}>Get started by creating a task for this project</div><button onClick={openNewTaskModal} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button></div>}
      </div>
    </div>
  </div>);
}

export default memo(ProjectsTab);
