"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD } from "@/lib/utils";
import EditableCell from "../EditableCell";
import InlineNote from "../InlineNote";
import OwnerTags from "../OwnerTags";
import ProgressBar from "../ProgressBar";
import SortableSubItem from "../SortableSubItem";
import GanttTimeline, { TimeScaleToggle } from "../GanttTimeline";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import SortableProjectCard from "../SortableProjectCard";

export default function ProjectsTab({ twp, allS, projects, configOwners, pcMap, allProjNames, isMobile, setModalTask, setShowFileManager, ganttWidths, showToast, renameProject, addProject, deleteProject: deleteProjectAction, deleteTask, toggleSub, updateSub, addSub, deleteSub, reorderSubs, reorderProjects, projIcons, setProjIcons, onProjectRenamed, onProjectDeleted }) {
  const { X, SC, inputStyle } = useTheme();
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
  const fileRef = useRef(null);
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

  const handleIconUpload = (e, proj) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { setProjIcons(p => ({ ...p, [proj]: ev.target.result })); }; reader.readAsDataURL(file); };

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
    renameProject(oldName, newName);
    setProjIcons(p => { const n = { ...p }; if (n[oldName]) { n[newName] = n[oldName]; delete n[oldName]; } return n; });
    setArchived(p => { const n = new Set(p); if (n.has(oldName)) { n.delete(oldName); n.add(newName); } return n; });
    onProjectRenamed(oldName, newName);
    setSelProj(newName);
  }, [renameProject, setProjIcons, onProjectRenamed]);

  const openNewTaskModal = useCallback(() => {
    const proj = projects.find(p => p.name === selProj);
    setModalTask({ _isNew: true, projectId: proj?.id, projectName: selProj });
  }, [projects, selProj, setModalTask]);

  // Project list view
  if (!selProj) return (
    <div>
      <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => { if (uploadTarget) handleIconUpload(e, uploadTarget); setUploadTarget(null); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowArch(!showArch)} style={{ background: showArch ? X.surfaceLight : X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>
            Archived ({archived.size})
          </button>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={{ background: X.surface, color: X.text, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 14, cursor: "pointer", outline: "none" }}>
            <option value="manual">手動排序</option>
            <option value="name">依名稱</option>
            <option value="created">依建立時間</option>
            <option value="progress">依進度</option>
          </select>
        </div>
        {!showCreateProj ? (<button onClick={() => setShowCreateProj(true)} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
        ) : (<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={newProjName} onChange={e => setNewProjName(e.target.value)} placeholder="Project name" onKeyDown={e => { if (e.key === "Enter") createProj(newProjName); if (e.key === "Escape") { setShowCreateProj(false); setNewProjName(""); } }} autoFocus style={{ fontSize: 14, padding: "6px 12px", borderRadius: 20, border: `1px solid ${X.accent}`, outline: "none", background: X.surface, color: X.text, width: 200 }} />
          <button onClick={() => createProj(newProjName)} disabled={!newProjName.trim()} style={{ background: newProjName.trim() ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: newProjName.trim() ? "pointer" : "not-allowed" }}>Confirm</button>
          <button onClick={() => { setShowCreateProj(false); setNewProjName(""); }} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>)}
      </div>
      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
        <SortableContext items={sortedProjList.map(p => p.id)} strategy={rectSortingStrategy} disabled={sortMode !== "manual"}>
          <div className="dash-grid-cards">
            {sortedProjList.map(proj => {
              const pn = proj.name;
              const pt = twp.filter(d => d.project === pn); const c = pcMap[pn] || X.accent;
              const ts = allS.filter(s => pt.some(t => t.id === s.taskId));
              const avg = pt.length > 0 ? Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length) : 0;
              const stC = {}; pt.forEach(t => { stC[t.status] = (stC[t.status] || 0) + 1; });
              const icon = projIcons[pn];
              return (
                <SortableProjectCard key={proj.id} project={proj} pn={pn} pt={pt} c={c} ts={ts} avg={avg} stC={stC} icon={icon}
                  dragEnabled={sortMode === "manual"} onSelect={() => setSelProj(pn)} onArchive={() => archiveProj(pn)} onDelete={() => deleteProj(pn)}
                  onIconClick={() => { setUploadTarget(pn); fileRef.current?.click(); }} />
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
              <button onClick={e => { e.stopPropagation(); if (confirm("Permanently delete?")) deleteProj(pn); unarchiveProj(pn); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "4px 12px", fontSize: 14, color: X.red, cursor: "pointer" }}>Delete</button>
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
  const icon = projIcons[selProj];

  return (<div>
    <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => { if (uploadTarget) handleIconUpload(e, uploadTarget); setUploadTarget(null); }} />
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <button onClick={() => { setSelProj(null); }} style={{ background: X.surface, border: `1px solid ${X.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.textSec, cursor: "pointer" }}>← Back</button>
      <div onClick={() => { setUploadTarget(selProj); fileRef.current?.click(); }} style={{ width: 64, height: 64, borderRadius: 16, background: icon ? "transparent" : `${c}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: c, cursor: "pointer", overflow: "hidden", border: icon ? "none" : `1px dashed ${c}50` }}>
        {icon ? <img src={icon} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 16 }} /> : selProj[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><EditableCell value={selProj} onSave={v => handleRename(selProj, v)} style={{ fontSize: 24, fontWeight: 700 }} /></h2><div style={{ fontSize: 14, color: X.textDim, fontFamily: FM, marginTop: 2 }}>{pt.length} tasks · {ts.length} subtasks · {ds} done</div></div>
      <button onClick={() => setShowFileManager(selProj)} style={{ background: "transparent", border: `1px solid ${X.accent}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.accent, cursor: "pointer", fontWeight: 600 }}>📁 檔案管理</button>
      <button onClick={() => archiveProj(selProj)} style={{ background: "transparent", border: `1px solid ${X.amber}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.amber, cursor: "pointer", fontWeight: 600 }}>Archive</button>
      <button onClick={() => { if (confirm("Delete?")) deleteProj(selProj); }} style={{ background: "transparent", border: `1px solid ${X.red}50`, borderRadius: 20, padding: "6px 14px", fontSize: 14, color: X.red, cursor: "pointer", fontWeight: 600 }}>Delete</button>
    </div>
    {pt.some(t => t.start) && (<div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}><TimeScaleToggle value={timeDim} onChange={setTimeDim} /></div>
      <GanttTimeline tasks={twp} subtasks={allS} fp={selProj} fs={"全部"} fpr={"全部"} isMobile={isMobile} timeDim={timeDim} ganttWidths={ganttWidths} />
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
          <button onClick={openNewTaskModal} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button>
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
        {!pt.length && <div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No tasks yet</div><div style={{ fontSize: 14, marginBottom: 16 }}>Get started by creating a task for this project</div><button onClick={openNewTaskModal} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Create</button></div>}
      </div>
    </div>
  </div>);
}
