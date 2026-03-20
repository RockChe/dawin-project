"use client";
import { useState, useEffect, useRef } from "react";
import { X, getIS2 } from "@/lib/theme";
import { pD, fD, toISO, extractDomain, getFileCategory, formatFileSize } from "@/lib/utils";
import CalendarPicker from "./CalendarPicker";
import TagInput from "./TagInput";
import EditableCell from "./EditableCell";
import InlineNote from "./InlineNote";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSubItem({ sub, toggleSub, updateSub, deleteSub, configOwners }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sub.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span {...attributes} {...listeners} style={{ cursor: "grab", fontSize: 14, color: X.textDim, flexShrink: 0, userSelect: "none" }}>⠿</span>
        <span onClick={() => toggleSub(sub.id)} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: sub.done ? X.green : "transparent", border: sub.done ? "none" : `1.5px solid ${X.border}`, color: "#fff", cursor: "pointer" }}>{sub.done ? "✓" : ""}</span>
        <span style={{ flexShrink: 0, maxWidth: "40%" }}><EditableCell value={sub.name} onSave={v => updateSub(sub.id, "name", v)} style={{ fontSize: 14, color: X.textSec, textDecoration: sub.done ? "line-through" : "none", opacity: sub.done ? 0.5 : 1 }} /></span>
        <InlineNote value={sub.notes} onSave={v => updateSub(sub.id, "notes", v)} />
        <span><EditableCell value={sub.owner} onSave={v => updateSub(sub.id, "owner", v)} options={configOwners} style={{ fontSize: 13, color: X.textDim }} /></span>
        <button onClick={() => deleteSub(sub.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>
      </div>
    </div>
  );
}

export default function TaskModal({ task, projectId, projectName, onClose, addTask, updateTask, allS, addSub, deleteSub, toggleSub, updateSub, configCats, configOwners, reorderSubs, allL, allF, addLink, addFile, deleteLink, deleteFile }) {
  const isNew = task === "new";
  const [form, setForm] = useState(() => isNew
    ? { task: "", start: "", end: "", category: "活動", priority: "中", owner: "—", status: "待辦", notes: "" }
    : { task: task.task || "", start: task.startDate || task.start || "", end: task.endDate || task.end || "", category: task.category || "活動", priority: task.priority || "中", owner: task.owner || "—", status: task.status || "待辦", notes: task.notes || "" }
  );
  const [subDraft, setSubDraft] = useState({ name: "", owner: "" });
  const [showSubInput, setShowSubInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: "", title: "" });
  const fileInputRef = useRef(null);
  const tSubs = isNew ? [] : allS.filter(s => s.taskId === task.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const tLinks = isNew ? [] : (allL || []).filter(l => l.taskId === task.id);
  const tFiles = isNew ? [] : (allF || []).filter(f => f.taskId === task.id);
  const iS2 = getIS2();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  useEffect(() => { const h = e => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  const handleConfirm = async () => {
    if (!form.task.trim() || loading) return;
    setLoading(true);
    try {
      if (isNew) {
        const dur = (form.start && form.end) ? Math.max(1, Math.ceil((pD(form.end) - pD(form.start)) / 864e5)) : null;
        await addTask(projectId, {
          task: form.task,
          startDate: form.start ? toISO(form.start) : null,
          endDate: form.end ? toISO(form.end) : null,
          duration: dur,
          owner: form.owner,
          category: form.category,
          priority: form.priority,
          notes: form.notes,
        });
      } else {
        const fieldMap = { task: "task", start: "startDate", end: "endDate", category: "category", priority: "priority", owner: "owner", status: "status", notes: "notes" };
        for (const [formField, dbField] of Object.entries(fieldMap)) {
          const orig = (formField === "start" || formField === "end") ? (task.startDate || task.endDate || "") : (task[formField] || "");
          const cur = form[formField] || "";
          if (orig !== cur) {
            const val = (formField === "start" || formField === "end") ? (cur ? toISO(cur) : null) : cur;
            await updateTask(task.id, formField, val);
          }
        }
        if (form.start && form.end) {
          const dur = Math.max(1, Math.ceil((pD(form.end) - pD(form.start)) / 864e5));
          await updateTask(task.id, "duration", dur);
        }
      }
      onClose();
    } catch (err) {
      console.error("Task save failed:", err);
      setLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id && reorderSubs) {
      reorderSubs(task.id, active.id, over.id);
    }
  };

  const handleAddLink = async () => {
    if (!linkDraft.url.trim()) return;
    await addLink(task.id, { url: linkDraft.url.trim(), title: linkDraft.title.trim() || extractDomain(linkDraft.url.trim()) });
    setLinkDraft({ url: "", title: "" });
    setShowLinkInput(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', task.id);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) {
        addFile(task.id, result.file);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    e.target.value = "";
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: X.surface, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: `0 16px 48px ${X.shadowHeavy}`, border: `1px solid ${X.border}` }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{isNew ? "建立任務" : "編輯任務"}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: X.textDim, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {projectName && <div style={{ fontSize: 13, color: X.textDim }}>專案：<span style={{ color: X.accent, fontWeight: 600 }}>{projectName}</span></div>}
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>任務名稱 *</div>
            <input value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))} placeholder="輸入任務名稱" autoFocus style={{ ...iS2, fontSize: 15, padding: "8px 12px" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>開始日期</div><CalendarPicker value={form.start} onChange={v => setForm(p => ({ ...p, start: v }))} showTime /></div>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>結束日期</div><CalendarPicker value={form.end} onChange={v => setForm(p => ({ ...p, end: v }))} showTime /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>類別</div><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}>{configCats.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>優先度</div><select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}><option>高</option><option>中</option><option>低</option></select></div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>負責人</div>
            <TagInput value={form.owner} onChange={v => setForm(p => ({ ...p, owner: v }))} suggestions={configOwners} placeholder="新增負責人..." />
          </div>
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>狀態</div>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}>
              {["已完成", "進行中", "待辦", "提案中", "待確認"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>}
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>備註</div>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...iS2, resize: "vertical", minHeight: 60 }} />
          </div>

          {/* Subtasks */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>子任務</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tSubs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {tSubs.map(sub => (
                  <SortableSubItem key={sub.id} sub={sub} toggleSub={toggleSub} updateSub={updateSub} deleteSub={deleteSub} configOwners={configOwners} />
                ))}
              </SortableContext>
            </DndContext>
            {showSubInput
              ? <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="子任務名稱" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubInput(false); } if (e.key === "Escape") setShowSubInput(false); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 120 }} />
                <select value={subDraft.owner} onChange={e => setSubDraft(p => ({ ...p, owner: e.target.value }))} style={{ ...iS2, width: 100, fontSize: 13, padding: "5px 10px", cursor: "pointer" }}><option value="">負責人</option>{configOwners.map(o => <option key={o} value={o}>{o}</option>)}</select>
                <button onClick={() => { if (subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubInput(false); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>新增</button>
                <button onClick={() => setShowSubInput(false)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>取消</button>
              </div>
              : <button onClick={() => { setShowSubInput(true); setSubDraft({ name: "", owner: "" }); }} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 新增子任務</button>
            }
          </div>}

          {/* Links */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>連結</div>
            {tLinks.map(l => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "4px 8px", borderRadius: 6, background: X.surfaceLight }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, color: X.accent, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.url}>
                  <span style={{ color: X.textDim, marginRight: 4 }}>{extractDomain(l.url)}</span>— {l.title}
                </a>
                <button onClick={() => deleteLink(l.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>
              </div>
            ))}
            {showLinkInput
              ? <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <input value={linkDraft.url} onChange={e => setLinkDraft(p => ({ ...p, url: e.target.value }))} placeholder="URL *" autoFocus onKeyDown={e => { if (e.key === "Enter") handleAddLink(); if (e.key === "Escape") setShowLinkInput(false); }} style={{ ...iS2, flex: 2, fontSize: 13, padding: "5px 10px", minWidth: 160 }} />
                <input value={linkDraft.title} onChange={e => setLinkDraft(p => ({ ...p, title: e.target.value }))} placeholder="標題" onKeyDown={e => { if (e.key === "Enter") handleAddLink(); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 80 }} />
                <button onClick={handleAddLink} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>新增</button>
                <button onClick={() => { setShowLinkInput(false); setLinkDraft({ url: "", title: "" }); }} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>取消</button>
              </div>
              : <button onClick={() => setShowLinkInput(true)} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 新增連結</button>
            }
          </div>}

          {/* Files */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>檔案</div>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
            {tFiles.map(f => {
              const cat = getFileCategory(f.name);
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "4px 8px", borderRadius: 6, background: X.surfaceLight }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: X.textDim, flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                  <button onClick={() => deleteFile(f.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>
                </div>
              );
            })}
            <button onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 上傳檔案</button>
          </div>}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${X.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "8px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
          <button onClick={handleConfirm} disabled={!form.task.trim() || loading} style={{ background: (form.task.trim() && !loading) ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: (form.task.trim() && !loading) ? "pointer" : "not-allowed", opacity: loading ? 0.7 : 1 }}>{loading ? "儲存中..." : "確認"}</button>
        </div>
      </div>
    </div>
  );
}
