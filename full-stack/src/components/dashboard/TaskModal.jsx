"use client";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useCan } from "@/components/PermissionProvider";
import { pD, fD, toISO, extractDomain, getFileCategory, formatFileSize } from "@/lib/utils";
import { planTaskUpdates } from "@/lib/taskUpdates";
import { execTokens, hasSubOwners, subOwnerTokens, ownerTokens } from "@/lib/taskOwner";
import { STATUSES } from "@/lib/constants";
import useForbiddenHandler from "@/hooks/useForbiddenHandler";
import CalendarPicker from "./CalendarPicker";
import TagInput from "./TagInput";
import EditableCell from "./EditableCell";
import InlineNote from "./InlineNote";
import OwnerTags from "./OwnerTags";
import SortableSubItem from "./SortableSubItem";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function TaskModal({ task, projectId, projectName, onClose, addTask, updateTask, allS, addSub, deleteSub, toggleSub, updateSub, configCats, configOwners, reorderSubs, allL, allF, addLink, addFile, deleteLink, deleteFile, showToast }) {
  const isNew = task === "new";
  // task.owner = 執行人 ∪ 關注人；這個表單的 owner 欄只放「執行人」（有關注人時以 owner 扣掉關注人復原），
  // 也拿它當儲存時的 diff 基準，才不會把「顯示格式不同」誤判成改了 owner。
  const [initOwner] = useState(() => isNew ? "—"
    : (ownerTokens(task.watchers).length ? (execTokens(task, allS.filter(s => s.taskId === task.id)).join(",") || "—") : (task.owner || "—")));
  const [form, setForm] = useState(() => isNew
    ? { task: "", start: "", end: "", category: "活動", priority: "中", owner: "—", watchers: "", status: "待辦", notes: "" }
    : { task: task.task || "", start: task.startDate || task.start || "", end: task.endDate || task.end || "", category: task.category || "活動", priority: task.priority || "中", owner: initOwner, watchers: task.watchers || "", status: task.status || "待辦", notes: task.notes || "" }
  );
  const [subDraft, setSubDraft] = useState({ name: "", owner: "" });
  const [showSubInput, setShowSubInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: "", title: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);
  const mountedRef = useRef(true);
  const tSubs = isNew ? [] : allS.filter(s => s.taskId === task.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  // 執行人由子任務自動帶出：任一子任務有 owner 時，這格唯讀並顯示推得值（隨子任務即時變動）；關注人不受影響
  const ownerLocked = hasSubOwners(tSubs);
  const tLinks = isNew ? [] : (allL || []).filter(l => l.taskId === task.id);
  const tFiles = isNew ? [] : (allF || []).filter(f => f.taskId === task.id);
  const { X, inputStyle: iS2 } = useTheme();
  const canWrite = useCan("write");
  const canExport = useCan("export");
  const handleForbidden = useForbiddenHandler(showToast || (() => {}));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  useEffect(() => { const h = e => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (xhrRef.current) { xhrRef.current.abort(); xhrRef.current = null; }
    };
  }, []);

  const handleConfirm = async () => {
    if (!form.task.trim() || loading) return;
    setLoading(true);
    try {
      if (isNew) {
        const dur = (form.start && form.end) ? Math.max(1, Math.ceil((pD(form.end) - pD(form.start)) / 864e5)) : null;
        const result = await addTask(projectId, {
          task: form.task,
          startDate: form.start ? toISO(form.start) : null,
          endDate: form.end ? toISO(form.end) : null,
          duration: dur,
          owner: form.owner,
          watchers: form.watchers,
          category: form.category,
          priority: form.priority,
          notes: form.notes,
        });
        if (!result?.success) {
          if (showToast) showToast(result?.error || '建立任務失敗', 'error');
          setLoading(false);
          return;
        }
      } else {
        for (const { field, value } of planTaskUpdates({ ...task, owner: initOwner }, form)) {
          await updateTask(task.id, field, value);
        }
        if (ownerTokens(form.watchers).join(",") !== ownerTokens(task.watchers).join(",")) {
          await updateTask(task.id, "watchers", form.watchers);
        }
      }
      onClose();
    } catch (err) {
      console.error("Task save failed:", err);
      if (showToast) showToast('儲存失敗', 'error');
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', task.id);
    setUploading(true);
    setUploadProgress(0);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable && mountedRef.current) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      xhrRef.current = null;
      if (!mountedRef.current) return;
      try {
        const result = JSON.parse(xhr.responseText);
        if (result.success) { addFile(task.id, result.file); }
        else if (result.error) { if (!handleForbidden(result) && showToast) showToast(result.error, 'error'); }
      } catch { if (showToast) showToast('上傳失敗', 'error'); }
      setUploading(false);
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      if (!mountedRef.current) return;
      if (showToast) showToast('上傳失敗', 'error');
      setUploading(false);
    };
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
    e.target.value = "";
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={isNew ? "建立任務" : "編輯任務"} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {/* maxHeight is 100% of the overlay, NOT vh: the dashboard root carries a CSS
          `zoom`, and vh inside a zoomed subtree still means the full viewport height
          before being scaled up — at zoom 1.2 a 90vh modal renders 108% tall and gets
          clipped at both ends. The overlay itself is already viewport-sized. */}
      <div onClick={e => e.stopPropagation()} style={{ background: X.surface, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "100%", overflowY: "auto", boxShadow: X.modalShadow, border: `1px solid ${X.border}` }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{isNew ? "建立任務" : "編輯任務"}</div>
            {/* 副標：純文字（不是連結）——modal 是 overlay，點了也沒地方去 */}
            {projectName && <div style={{ fontSize: 12, color: X.textSec, marginTop: 2, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`${projectName} › ${isNew ? "新任務" : (task.task || "未命名任務")}`}</div>}
          </div>
          <button onClick={onClose} aria-label="關閉" style={{ background: "transparent", border: "none", fontSize: 20, color: X.textDim, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {projectName && <div style={{ fontSize: 13, color: X.textDim }}>專案：<span style={{ color: X.accent, fontWeight: 600 }}>{projectName}</span></div>}
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>任務名稱 *</div>
            {canWrite
              ? <input value={form.task} onChange={e => setForm(p => ({ ...p, task: e.target.value }))} placeholder="輸入任務名稱" autoFocus style={{ ...iS2, fontSize: 15, padding: "8px 12px" }} />
              : <div style={{ fontSize: 15, color: X.text }}>{form.task || "—"}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>開始日期</div>{canWrite ? <CalendarPicker value={form.start} onChange={v => setForm(p => ({ ...p, start: v }))} showTime /> : <div style={{ fontSize: 14, color: X.text }}>{fD(form.start) || "—"}</div>}</div>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>結束日期</div>{canWrite ? <CalendarPicker value={form.end} onChange={v => setForm(p => ({ ...p, end: v }))} showTime /> : <div style={{ fontSize: 14, color: X.text }}>{fD(form.end) || "—"}</div>}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>類別</div>{canWrite ? <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}>{configCats.map(o => <option key={o}>{o}</option>)}</select> : <div style={{ fontSize: 14, color: X.text }}>{form.category || "—"}</div>}</div>
            <div><div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>優先度</div>{canWrite ? <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}><option>高</option><option>中</option><option>低</option></select> : <div style={{ fontSize: 14, color: X.text }}>{form.priority || "—"}</div>}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>關注人<span style={{ marginLeft: 6 }}>（掛名關注，不一定做子任務）</span></div>
            {canWrite ? <TagInput value={form.watchers} onChange={v => setForm(p => ({ ...p, watchers: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="新增關注人..." /> : <OwnerTags value={form.watchers} configOwners={configOwners} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>執行人</div>
            {canWrite && !ownerLocked ? <TagInput value={form.owner} onChange={v => setForm(p => ({ ...p, owner: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="新增執行人..." /> : <OwnerTags value={ownerLocked ? subOwnerTokens(tSubs).join(",") : form.owner} configOwners={configOwners} />}
            {ownerLocked && <div style={{ fontSize: 11, color: X.textDim, marginTop: 4 }}>由子任務自動帶出</div>}
          </div>
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>狀態</div>
            {canWrite ? <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...iS2, cursor: "pointer" }}>
              {STATUSES.map(o => <option key={o}>{o}</option>)}
            </select> : <div style={{ fontSize: 14, color: X.text }}>{form.status || "—"}</div>}
          </div>}
          <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 4 }}>備註</div>
            {canWrite
              ? <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...iS2, resize: "vertical", minHeight: 60 }} />
              : <div style={{ fontSize: 14, color: X.textSec, whiteSpace: "pre-wrap", minHeight: 60 }}>{form.notes || "—"}</div>}
          </div>

          {/* Subtasks */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>子任務</div>
            {canWrite ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tSubs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {tSubs.map(sub => (
                    <SortableSubItem key={sub.id} sub={sub} toggleSub={toggleSub} updateSub={updateSub} deleteSub={deleteSub} configOwners={configOwners} />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              // viewer：不掛 DndContext，SortableSubItem 內部會用 useCan('write') 藏掉
              // TagInput/完成勾選/拖拉把手。
              tSubs.map(sub => (
                <SortableSubItem key={sub.id} sub={sub} toggleSub={toggleSub} updateSub={updateSub} deleteSub={deleteSub} configOwners={configOwners} />
              ))
            )}
            {canWrite && (showSubInput
              ? <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <input value={subDraft.name} onChange={e => setSubDraft(p => ({ ...p, name: e.target.value }))} placeholder="子任務名稱" autoFocus onKeyDown={e => { if (e.key === "Enter" && subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubInput(false); } if (e.key === "Escape") setShowSubInput(false); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 120 }} />
                <div style={{ flex: "0 0 140px" }}><TagInput value={subDraft.owner} onChange={v => setSubDraft(p => ({ ...p, owner: v }))} suggestions={configOwners} configOwners={configOwners} placeholder="負責人..." style={{ fontSize: 13 }} /></div>
                <button onClick={() => { if (subDraft.name.trim()) { addSub(task.id, { name: subDraft.name, owner: subDraft.owner }); setSubDraft({ name: "", owner: "" }); setShowSubInput(false); } }} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>新增</button>
                <button onClick={() => setShowSubInput(false)} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>取消</button>
              </div>
              : <button onClick={() => { setShowSubInput(true); setSubDraft({ name: "", owner: "" }); }} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 新增子任務</button>
            )}
          </div>}

          {/* Links */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>連結</div>
            {tLinks.map(l => {
              let safeUrl = '#';
              try { const u = new URL(l.url); if (['http:', 'https:'].includes(u.protocol)) safeUrl = l.url; } catch {}
              return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "4px 8px", borderRadius: 6, background: X.surfaceLight }}>
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, color: X.accent, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.url}>
                  <span style={{ color: X.textDim, marginRight: 4 }}>{extractDomain(l.url)}</span>— {l.title}
                </a>
                {canWrite && <button onClick={() => deleteLink(l.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>}
              </div>
              );
            })}
            {canWrite && (showLinkInput
              ? <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <input value={linkDraft.url} onChange={e => setLinkDraft(p => ({ ...p, url: e.target.value }))} placeholder="URL *" autoFocus onKeyDown={e => { if (e.key === "Enter") handleAddLink(); if (e.key === "Escape") setShowLinkInput(false); }} style={{ ...iS2, flex: 2, fontSize: 13, padding: "5px 10px", minWidth: 160 }} />
                <input value={linkDraft.title} onChange={e => setLinkDraft(p => ({ ...p, title: e.target.value }))} placeholder="標題" onKeyDown={e => { if (e.key === "Enter") handleAddLink(); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 80 }} />
                <button onClick={handleAddLink} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>新增</button>
                <button onClick={() => { setShowLinkInput(false); setLinkDraft({ url: "", title: "" }); }} style={{ background: "transparent", border: `1px solid ${X.border}`, borderRadius: 16, padding: "4px 10px", fontSize: 13, color: X.textSec, cursor: "pointer" }}>取消</button>
              </div>
              : <button onClick={() => setShowLinkInput(true)} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 新增連結</button>
            )}
          </div>}

          {/* Files */}
          {!isNew && <div>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${X.border}` }}>檔案</div>
            {canWrite && <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />}
            {tFiles.map(f => {
              const cat = getFileCategory(f.name);
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "4px 8px", borderRadius: 6, background: X.surfaceLight }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: X.textDim, flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                  {canExport && <button onClick={async () => { try { const res = await fetch(`/api/download?key=${encodeURIComponent(f.r2Key)}`); const data = await res.json(); if (data.url) { const a = document.createElement("a"); a.href = data.url; a.download = f.name; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click(); } } catch (err) { console.error("Download failed:", err); } }} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, cursor: "pointer", padding: "2px 6px", opacity: 0.7 }} title="下載">↓</button>}
                  {canWrite && <button onClick={() => deleteFile(f.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>}
                </div>
              );
            })}
            {canWrite && (uploading ? (
              <div style={{ padding: "4px 0" }} aria-live="polite">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div aria-hidden="true" style={{ width: 14, height: 14, border: `2px solid ${X.border}`, borderTopColor: X.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: 13, color: X.accent, fontWeight: 500 }}>上傳中 {uploadProgress}%</span>
                </div>
                <div role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100} aria-label="檔案上傳進度" style={{ height: 4, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: X.accent, borderRadius: 2, transition: "width 0.2s" }} />
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", border: "none", color: X.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "4px 0" }}>+ 上傳檔案</button>
            ))}
          </div>}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${X.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: X.surface, color: X.textSec, border: `1px solid ${X.border}`, borderRadius: 20, padding: "8px 20px", fontSize: 14, cursor: "pointer" }}>{canWrite ? "取消" : "關閉"}</button>
          {canWrite && <button onClick={handleConfirm} disabled={!form.task.trim() || loading} style={{ background: (form.task.trim() && !loading) ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: (form.task.trim() && !loading) ? "pointer" : "not-allowed", opacity: loading ? 0.7 : 1 }}>{loading ? "儲存中..." : "確認"}</button>}
        </div>
      </div>
    </div>
  );
}
