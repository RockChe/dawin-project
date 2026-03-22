"use client";
import { useState, useRef, useEffect } from "react";
import { X, getIS2 } from "@/lib/theme";
import { extractDomain, getFileCategory, formatFileSize } from "@/lib/utils";

export default function FileManagerModal({ project, tasks, allL, allF, addLink, addFile, deleteLink, deleteFile, onClose }) {
  const [tab, setTab] = useState("files");
  const [showAdd, setShowAdd] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: "", title: "", taskId: "" });
  const [fileDraftTask, setFileDraftTask] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);
  const mountedRef = useRef(true);
  const iS2 = getIS2();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (xhrRef.current) { xhrRef.current.abort(); xhrRef.current = null; }
    };
  }, []);

  const projTasks = tasks.filter(t => t.project === project);
  const taskIds = projTasks.map(t => t.id);
  const projLinks = (allL || []).filter(l => taskIds.includes(l.taskId));
  const projFiles = (allF || []).filter(f => taskIds.includes(f.taskId));
  const taskMap = {};
  projTasks.forEach(t => { taskMap[t.id] = t.task || t.id; });

  // Group files by category
  const fileGroups = {};
  projFiles.forEach(f => {
    const cat = getFileCategory(f.name);
    if (!fileGroups[cat.key]) fileGroups[cat.key] = { emoji: cat.emoji, label: cat.label, items: [] };
    fileGroups[cat.key].items.push(f);
  });

  // Group links by domain
  const linkGroups = {};
  projLinks.forEach(l => {
    const d = extractDomain(l.url);
    if (!linkGroups[d]) linkGroups[d] = [];
    linkGroups[d].push(l);
  });

  const downloadFile = async (f) => {
    try {
      const res = await fetch(`/api/download?key=${encodeURIComponent(f.r2Key)}`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = f.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleAddLink = () => {
    if (!linkDraft.url.trim() || !linkDraft.taskId) return;
    addLink(linkDraft.taskId, { url: linkDraft.url.trim(), title: linkDraft.title.trim() || extractDomain(linkDraft.url.trim()) });
    setLinkDraft({ url: "", title: "", taskId: "" });
    setShowAdd(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !fileDraftTask) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', fileDraftTask);
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
        if (result.success) { addFile(fileDraftTask, result.file); }
      } catch {}
      setUploading(false);
      setFileDraftTask("");
      setShowAdd(false);
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      if (!mountedRef.current) return;
      setUploading(false);
    };
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
    e.target.value = "";
  };

  const tabStyle = (active) => ({
    padding: "8px 18px", borderRadius: 20, border: "none", fontSize: 14, fontWeight: active ? 700 : 400,
    background: active ? X.accent : "transparent", color: active ? "#fff" : X.textSec, cursor: "pointer",
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: X.surface, borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: `0 16px 48px ${X.shadowHeavy}`, border: `1px solid ${X.border}` }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${X.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>📁 檔案管理 — {project}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: X.textDim, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "12px 20px 0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => { setTab("files"); setShowAdd(false); }} style={tabStyle(tab === "files")}>📎 Files ({projFiles.length})</button>
          <button onClick={() => { setTab("links"); setShowAdd(false); }} style={tabStyle(tab === "links")}>🔗 Links ({projLinks.length})</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: showAdd ? X.surfaceLight : "transparent", border: `1px solid ${X.border}`, borderRadius: 20, padding: "4px 14px", fontSize: 13, color: X.accent, cursor: "pointer", fontWeight: 600 }}>+ Add</button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${X.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: X.textDim, marginBottom: 6 }}>Task</div>
            {tab === "links" ? (
              <>
                <select value={linkDraft.taskId} onChange={e => setLinkDraft(p => ({ ...p, taskId: e.target.value }))} style={{ ...iS2, marginBottom: 8, cursor: "pointer" }}>
                  <option value="">Select task...</option>
                  {projTasks.map(t => <option key={t.id} value={t.id}>{t.task || t.id}</option>)}
                </select>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input value={linkDraft.url} onChange={e => setLinkDraft(p => ({ ...p, url: e.target.value }))} placeholder="URL *" onKeyDown={e => { if (e.key === "Enter") handleAddLink(); }} style={{ ...iS2, flex: 2, fontSize: 13, padding: "5px 10px", minWidth: 160 }} />
                  <input value={linkDraft.title} onChange={e => setLinkDraft(p => ({ ...p, title: e.target.value }))} placeholder="Title" onKeyDown={e => { if (e.key === "Enter") handleAddLink(); }} style={{ ...iS2, flex: 1, fontSize: 13, padding: "5px 10px", minWidth: 80 }} />
                  <button onClick={handleAddLink} style={{ background: X.accent, color: "#fff", border: "none", borderRadius: 16, padding: "4px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                </div>
              </>
            ) : (
              <>
                <select value={fileDraftTask} onChange={e => setFileDraftTask(e.target.value)} style={{ ...iS2, marginBottom: 8, cursor: "pointer" }}>
                  <option value="">Select task...</option>
                  {projTasks.map(t => <option key={t.id} value={t.id}>{t.task || t.id}</option>)}
                </select>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
                {uploading ? (
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${X.border}`, borderTopColor: X.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 13, color: X.accent, fontWeight: 500 }}>上傳中 {uploadProgress}%</span>
                    </div>
                    <div style={{ height: 4, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: X.accent, borderRadius: 2, transition: "width 0.2s" }} />
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { if (!fileDraftTask) return; fileInputRef.current?.click(); }} disabled={!fileDraftTask} style={{ background: fileDraftTask ? X.accent : X.border, color: "#fff", border: "none", borderRadius: 16, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: fileDraftTask ? "pointer" : "not-allowed" }}>📎 Choose File</button>
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {tab === "files" ? (
            Object.keys(fileGroups).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: X.textDim, fontSize: 14 }}>No files yet</div>
            ) : (
              Object.entries(fileGroups).map(([key, group]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: X.textSec, marginBottom: 8 }}>{group.emoji} {group.label}</div>
                  {group.items.map(f => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "6px 10px", borderRadius: 8, background: X.surfaceLight }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{group.emoji}</span>
                      <span onClick={() => downloadFile(f)} style={{ flex: 1, fontSize: 13, color: X.textSec, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="Click to download">{f.name}</span>
                      <span style={{ fontSize: 11, color: X.textDim, flexShrink: 0, background: `${X.accent}18`, padding: "2px 8px", borderRadius: 10 }}>{taskMap[f.taskId] || f.taskId}</span>
                      <span style={{ fontSize: 12, color: X.textDim, flexShrink: 0 }}>{formatFileSize(f.size)}</span>
                      <button onClick={() => deleteFile(f.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>
                    </div>
                  ))}
                </div>
              ))
            )
          ) : (
            Object.keys(linkGroups).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: X.textDim, fontSize: 14 }}>No links yet</div>
            ) : (
              Object.entries(linkGroups).map(([domain, links]) => (
                <div key={domain} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: X.textSec, marginBottom: 8 }}>🌐 {domain}</div>
                  {links.map(l => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "6px 10px", borderRadius: 8, background: X.surfaceLight }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🔗</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, color: X.accent, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.url}>{l.title || l.url}</a>
                      <span style={{ fontSize: 11, color: X.textDim, flexShrink: 0, background: `${X.accent}18`, padding: "2px 8px", borderRadius: 10 }}>{taskMap[l.taskId] || l.taskId}</span>
                      <button onClick={() => deleteLink(l.id)} style={{ background: "transparent", border: "none", color: X.red, fontSize: 14, cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>×</button>
                    </div>
                  ))}
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
