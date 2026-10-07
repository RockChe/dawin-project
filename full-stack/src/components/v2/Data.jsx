"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCan } from "@/components/PermissionProvider";
import { STATUSES } from "@/lib/constants";
import { hasSubOwners } from "@/lib/taskOwner";
import { tasksToCSV, parseCSV, downloadCSV, toISO } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/v2Data";
import { filterRows, sortRows, paginate, flattenRows, moveCell, TABLE_COLS, PAGE_SIZES } from "@/lib/v2Table";
import { FilterBar } from "./Overview";
import { Icon, OwnerPills, StatusTag } from "./common";
import DataCell from "./DataCell";

const PRI_CLS = { "高": "c-red", "中": "c-amber", "低": "c-sec" };
const slash = (s) => (s ? String(s).replace(/-/g, "/") : "");
// 清空（Delete／Backspace）只開給可以是空值的欄位；狀態、優先度、任務名清成空字串會被伺服端拒絕
const CLEARABLE = { task: ["owner", "start", "end", "notes"], sub: ["owner", "notes"] };
const EMPTY_DRAFT = { projectId: "", task: "", start: "", end: "", owner: "—", category: "", priority: "中" };

// 工期天數：同舊版 Math.ceil((迄 − 起) / 天)，至少 1；缺一端就沒有
const spanDays = (a, b) => (a && b ? Math.max(1, Math.ceil((Date.parse(b) - Date.parse(a)) / 864e5)) : null);

// Data 分頁：高密度任務表（不放雲）。資料全來自父層已載入的 twp／subtasks，寫入走 actions（Live＝useTaskManager 同名函式）。
// actions：{ updateTask, updateSub, deleteTask, deleteSub, toggleSub, addTask, addSub, importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, notify }
// config：{ cats, owners }（owners＝Users 表名單）。searchQ：頁首搜尋字串。viewer（無 write）：純文字、無勾選／匯入匯出／新增／刪除。
export default function Data({ twp, subtasks, projects, config, today, searchQ = "", actions }) {
  const canWrite = useCan("write"), canManage = useCan("manage"), canExport = useCan("export");
  const { updateTask, updateSub, deleteTask, deleteSub, toggleSub, addTask, addSub, importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, notify } = actions;
  const cats = config?.cats || [], owners = config?.owners || [];

  const [f, setF] = useState({ statuses: [], priority: "全部", projectIds: [] });
  const [sort, setSort] = useState({ col: "project", dir: "asc" }); // 設計稿預設依專案（手動順序）排
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [active, setActive] = useState(null); // { rowId, colKey }
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [subAdd, setSubAdd] = useState(null); // { taskId, name, owner }
  const [cleanOpen, setCleanOpen] = useState(false);
  const [cleanText, setCleanText] = useState("");
  const tableRef = useRef(null);

  const rows = useMemo(() => filterRows(twp, f, searchQ), [twp, f, searchQ]);
  const sorted = useMemo(() => sortRows(rows, sort.col, sort.dir, projects), [rows, sort, projects]);
  const pg = paginate(sorted, page, size);
  // 篩選／搜尋／排序／每頁筆數「條件」變了才回第 1 頁；改一格資料（twp 換了）不踢回去
  const resetKey = JSON.stringify([f, searchQ, sort, size]);
  useEffect(() => { setPage(1); }, [resetKey]);

  const subsByTask = useMemo(() => {
    const m = {};
    for (const s of [...subtasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) (m[s.taskId] ||= []).push(s);
    return m;
  }, [subtasks]);
  const lockedOwner = useMemo(() => new Set(Object.keys(subsByTask).filter((id) => hasSubOwners(subsByTask[id]))), [subsByTask]);
  const flat = useMemo(() => flattenRows(pg.view, expanded, subsByTask), [pg.view, expanded, subsByTask]);
  const colorOf = useMemo(() => new Map(projects.map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]])), [projects]);

  // ---- 鍵盤格 ----
  const navigate = useCallback((dir) => { setActive((a) => (a ? moveCell(flat, a, dir) : a)); setEditing(false); setTyped(null); }, [flat]);
  const ctl = (rowId, colKey) => {
    const on = active?.rowId === rowId && active?.colKey === colKey;
    return {
      isSelected: on, isEditing: on && editing, typed: on ? typed : null, onNavigate: navigate,
      onSelect: () => { setActive({ rowId, colKey }); setEditing(false); setTyped(null); tableRef.current?.focus(); },
      onStartEdit: () => { setActive({ rowId, colKey }); setEditing(true); setTyped(null); },
      onStopEdit: () => { setEditing(false); setTyped(null); },
    };
  };
  const onKeyDown = (e) => {
    if (!active || editing) return;
    if (e.target !== e.currentTarget && !e.target.closest?.('[role="gridcell"]')) return; // 按鈕、勾選框上的按鍵不算
    const { rowId, colKey } = active;
    const locked = colKey === "owner" && lockedOwner.has(rowId);
    const row = flat.find((r) => r.id === rowId);
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); navigate("up"); break;
      case "ArrowDown": e.preventDefault(); navigate("down"); break;
      case "ArrowLeft": e.preventDefault(); navigate("left"); break;
      case "ArrowRight": e.preventDefault(); navigate("right"); break;
      case "Tab": e.preventDefault(); navigate(e.shiftKey ? "left" : "right"); break;
      case "Enter": case "F2": e.preventDefault(); if (!locked) { setEditing(true); setTyped(null); } break;
      case "Delete": case "Backspace": e.preventDefault();
        if (row && !locked && CLEARABLE[row.type].includes(colKey)) (row.type === "task" ? updateTask : updateSub)(rowId, colKey, "");
        break;
      case "Escape": e.preventDefault(); setActive(null); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (!locked) { setTyped(e.key); setEditing(true); } }
    }
  };
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    const h = (e) => { if (activeRef.current && tableRef.current && !tableRef.current.contains(e.target)) { setActive(null); setEditing(false); setTyped(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (active && !editing) tableRef.current?.focus(); }, [active, editing]);

  // ---- 匯入匯出 ----
  const processImport = useCallback(async (text) => {
    const parsed = parseCSV(text);
    if (!parsed.length) { notify("CSV 中沒有有效資料", "error"); return; }
    await importTasks(parsed);
  }, [notify, importTasks]);
  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => processImport(ev.target.result);
    r.readAsText(file);
    e.target.value = "";
  };
  const importUrl = async () => {
    if (!url.trim() || urlBusy) return;
    setUrlBusy(true);
    try {
      const res = await fetch("/api/fetch-csv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok || data.error) { notify(data.error || "取得 CSV 失敗", "error"); return; }
      await processImport(data.csv);
      setUrlOpen(false); setUrl("");
    } catch (err) { notify("取得 CSV 失敗: " + err.message, "error"); } finally { setUrlBusy(false); }
  };

  // ---- 新增／批次／刪除 ----
  const defaultCat = cats.includes("活動") ? "活動" : cats[0] || "";
  const canAdd = !adding && draft.projectId && draft.task.trim();
  const doAdd = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      const r = await addTask(draft.projectId, { task: draft.task.trim(), startDate: draft.start || null, endDate: draft.end || null, duration: spanDays(draft.start, draft.end), owner: draft.owner, category: draft.category || defaultCat, priority: draft.priority, notes: "" });
      if (r?.success) { setDraft(EMPTY_DRAFT); setCreateOpen(false); }
    } catch { notify("新增失敗，請稍後再試", "error"); } finally { setAdding(false); }
  };
  const selIds = [...selected];
  const toggleSel = (id, on) => setSelected((p) => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });
  const doSubAdd = () => {
    if (!subAdd?.name.trim()) return;
    addSub(subAdd.taskId, { name: subAdd.name.trim(), owner: subAdd.owner });
    setSubAdd(null);
  };
  const sortBy = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));

  return (<>
    <FilterBar f={f} set={(p) => setF((x) => ({ ...x, ...p }))} projects={projects} />
    <div className="card dtcard">
      <div className="dtool">
        <span className="sec">{canWrite ? "點選儲存格選取 · 雙擊或 F2 編輯 · 方向鍵移動" : "唯讀 · 點表頭排序，上方可篩選"}</span>
        <div className="dbtns">
          {canWrite && selIds.length > 0 && <>
            <select className="sel" aria-label="指派 Owner" value="" onChange={async (e) => { const v = e.target.value; if (v) await updateManyTasks(selIds, "owner", v); }}>
              <option value="">指派 Owner ({selIds.length})</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button type="button" className="btn danger sm" onClick={async () => { if (confirm(`確定要刪除 ${selIds.length} 筆任務？`)) { await deleteManyTasks(selIds); setSelected(new Set()); } }}>刪除已選 ({selIds.length})</button>
          </>}
          {canExport && <button type="button" className="btn sec sm" onClick={() => downloadCSV(tasksToCSV(twp), "tasks_export.csv")}>Export CSV</button>}
          {canWrite && <label className="btn sec sm">Import CSV<input type="file" accept=".csv" hidden onChange={onFile} /></label>}
          {canWrite && <button type="button" className="btn sec sm" aria-expanded={urlOpen} onClick={() => { setUrlOpen(!urlOpen); setUrl(""); }}>Import URL</button>}
          {canManage && <button type="button" className="btn danger sm" onClick={() => { setCleanOpen(true); setCleanText(""); }}>Clean All</button>}
          {canWrite && <button type="button" className="btn sm" onClick={() => setCreateOpen(!createOpen)}>{createOpen ? "Cancel" : "+ Create"}</button>}
        </div>
      </div>
      {urlOpen && (
        <div className="dtool drow">
          <input className="fld" style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") importUrl(); }} placeholder="https://..." aria-label="CSV 網址" />
          <button type="button" className="btn sm" disabled={urlBusy} onClick={importUrl}>{urlBusy ? "載入中..." : "匯入"}</button>
          <button type="button" className="iconx" aria-label="關閉" onClick={() => { setUrlOpen(false); setUrl(""); }}><Icon n="x" size={14} /></button>
        </div>
      )}
      {createOpen && (
        <div className="dcreate">
          {[["Project", <select id="dc-project" className="sel" value={draft.projectId} onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}><option value="">請選擇專案</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>],
            ["Task", <input id="dc-task" className="fld" value={draft.task} onChange={(e) => setDraft((d) => ({ ...d, task: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") doAdd(); }} />],
            ["Start", <input id="dc-start" className="fld" type="date" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />],
            ["End", <input id="dc-end" className="fld" type="date" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />],
            ["Owner", <select id="dc-owner" className="sel" value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}>{["—", ...owners].map((o) => <option key={o}>{o}</option>)}</select>],
            ["Category", <select id="dc-cat" className="sel" value={draft.category || defaultCat} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>{cats.map((o) => <option key={o}>{o}</option>)}</select>],
            ["Priority", <select id="dc-pri" className="sel" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>{["高", "中", "低"].map((o) => <option key={o}>{o}</option>)}</select>],
          ].map(([l, el]) => <div key={l} className="dcf"><label htmlFor={el.props.id}>{l}</label>{el}</div>)}
          <button type="button" className="btn" disabled={!canAdd} onClick={doAdd}>{adding ? "新增中..." : "Confirm"}</button>
        </div>
      )}

      <div className="tw" ref={tableRef} tabIndex={-1} onKeyDown={onKeyDown}>
        <table className="dt" role="grid">
          <thead><tr>
            <th scope="col" className="ck">{canWrite && <input type="checkbox" aria-label="全選本頁" checked={pg.view.length > 0 && pg.view.every((t) => selected.has(t.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(pg.view.map((t) => t.id)) : new Set())} />}</th>
            {TABLE_COLS.map(([k, l]) => k === "notes"
              ? <th key={k} scope="col">{l}</th>
              : <th key={k} scope="col" aria-sort={sort.col === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => sortBy(k)}>{l}{sort.col === k ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</button></th>)}
            <th scope="col" className="ck" />
          </tr></thead>
          <tbody>
            {pg.view.length === 0 && <tr><td colSpan={13} className="empty">No tasks found — 調整上方的跨專案篩選</td></tr>}
            {flat.map((r) => {
              if (r.type === "task") {
                const d = r.data, subs = subsByTask[d.id] || [], open = expanded.has(d.id), isSel = selected.has(d.id);
                const locked = lockedOwner.has(d.id);
                return (
                  <tr key={d.id} className={isSel ? "sel" : undefined}>
                    <td className="ck">{canWrite && <input type="checkbox" aria-label={`選取「${d.task}」`} checked={isSel} onChange={(e) => toggleSel(d.id, e.target.checked)} />}</td>
                    <td data-col="project" className="nw"><span className="pj"><span className="pdot" style={{ "--c": `var(--${colorOf.get(d.projectId) || "accent"})` }} /><span className="cut" title={d.project}>{d.project || "—"}</span></span></td>
                    <td data-col="task"><span className="tnc">
                      {subs.length > 0 || canWrite
                        ? <button type="button" className="exp" aria-expanded={open} aria-label={open ? "收合子任務" : "展開子任務"} onClick={() => setExpanded((p) => { const n = new Set(p); open ? n.delete(d.id) : n.add(d.id); return n; })}><Icon n={open ? "chev-d" : "chev-r"} size={14} /></button>
                        : <span className="exps" />}
                      <Cell ctlFor={ctl} id={d.id} col="task" value={d.task} onSave={(v) => updateTask(d.id, "task", v)} />
                      {subs.length > 0 && <span className="hint mono">{d.sDone}/{d.sTotal}</span>}
                    </span></td>
                    <td data-col="owner"><Cell ctlFor={ctl} id={d.id} col="owner" value={d.owner} locked={locked} title={locked ? "由子任務自動帶出" : undefined}
                      onSave={(v) => updateTask(d.id, "owner", v)} render={(v) => (v && v !== "—" ? <OwnerPills value={v} owners={owners} watchers={d.watchers} /> : "—")} /></td>
                    <td data-col="status"><Cell ctlFor={ctl} id={d.id} col="status" value={d.status} kind="select" options={STATUSES} onSave={(v) => updateTask(d.id, "status", v)} render={(v) => <StatusTag status={v} />} /></td>
                    <td data-col="priority" className="nw"><Cell ctlFor={ctl} id={d.id} col="priority" value={d.priority} kind="select" options={["高", "中", "低"]} onSave={(v) => updateTask(d.id, "priority", v)} render={(v) => <b className={PRI_CLS[v]}>{v}</b>} /></td>
                    <td data-col="progress"><div className="pgc"><div className="mini"><div className={`bar${d.progress === 100 ? " done" : ""}`} role="progressbar" aria-valuenow={d.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${d.progress}%` }} /></div></div><span className="mono">{d.progress}%</span></div></td>
                    <td data-col="category" className="nw"><Cell ctlFor={ctl} id={d.id} col="category" value={d.category} kind="select" options={cats} onSave={(v) => updateTask(d.id, "category", v)} /></td>
                    <td data-col="start" className="nw mono"><Cell ctlFor={ctl} id={d.id} col="start" value={d.start} kind="date" onSave={(v) => updateTask(d.id, "start", v)} render={(v) => slash(v) || "—"} /></td>
                    <td data-col="end" className="nw mono"><Cell ctlFor={ctl} id={d.id} col="end" value={d.end} kind="date" onSave={(v) => updateTask(d.id, "end", v)} render={(v) => slash(v) || "—"} /></td>
                    <td data-col="notes"><Cell ctlFor={ctl} id={d.id} col="notes" value={d.notes} className="cut sec" onSave={(v) => updateTask(d.id, "notes", v)} /></td>
                    <td data-col="creatorName" className="nw">{d.creatorName || "—"}{d.source && <span className="badge">{d.source === "csv_import" ? "CSV" : "手動"}</span>}</td>
                    <td className="ck">{canWrite && <button type="button" className="iconx" aria-label={`刪除任務「${d.task}」`} onClick={() => { if (confirm("Delete?")) { deleteTask(d.id); toggleSel(d.id, false); } }}><Icon n="x" size={14} /></button>}</td>
                  </tr>
                );
              }
              const s = r.data;
              return (
                <tr key={s.id} className="subr">
                  <td /><td />
                  <td data-col="name"><span className="tnc sub">
                    {canWrite ? <input type="checkbox" aria-label={`完成子任務「${s.name}」`} checked={!!s.done} onChange={() => toggleSub(s.id)} /> : <span aria-hidden="true">{s.done ? "☑" : "☐"}</span>}
                    <Cell ctlFor={ctl} id={s.id} col="name" value={s.name} className={s.done ? "subdone" : ""} onSave={(v) => updateSub(s.id, "name", v)} />
                  </span></td>
                  <td data-col="owner"><Cell ctlFor={ctl} id={s.id} col="owner" value={s.owner} onSave={(v) => updateSub(s.id, "owner", v)} render={(v) => (v ? <OwnerPills value={v} owners={owners} /> : "—")} /></td>
                  <td colSpan={2}>{s.done ? <span className="c-green strong">Done</span> : <span className="dim">Pending</span>}</td>
                  <td colSpan={4} className="mono">{s.done && s.doneDate ? slash(s.doneDate) : "—"}</td>
                  <td data-col="notes"><Cell ctlFor={ctl} id={s.id} col="notes" value={s.notes} className="cut sec" onSave={(v) => updateSub(s.id, "notes", v)} /></td>
                  <td />
                  <td className="ck">{canWrite && <button type="button" className="iconx" aria-label={`刪除子任務「${s.name}」`} onClick={() => deleteSub(s.id)}><Icon n="x" size={14} /></button>}</td>
                </tr>
              );
            }).flatMap((row, i) => {
              // 展開的任務最後一個子任務後面接「+ Add subtask」
              const cur = flat[i], nxt = flat[i + 1];
              const taskId = cur.type === "task" ? cur.id : cur.data.taskId;
              if (!canWrite || !expanded.has(taskId) || (nxt && nxt.type === "sub")) return [row];
              return [row, (
                <tr key={`${taskId}_add`} className="subr addr"><td /><td />
                  <td colSpan={11}>{subAdd?.taskId === taskId
                    ? <div className="addf">
                      <input className="fld" autoFocus placeholder="Subtask name" aria-label="子任務名稱" value={subAdd.name} onChange={(e) => setSubAdd({ ...subAdd, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") doSubAdd(); if (e.key === "Escape") setSubAdd(null); }} />
                      <select className="sel" aria-label="子任務負責人" value={subAdd.owner} onChange={(e) => setSubAdd({ ...subAdd, owner: e.target.value })}><option value="">負責人…</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
                      <button type="button" className="btn sm" onClick={doSubAdd}>Add</button>
                      <button type="button" className="btn sec sm" onClick={() => setSubAdd(null)}>Cancel</button>
                    </div>
                    : <button type="button" className="addsub" onClick={() => setSubAdd({ taskId, name: "", owner: "" })}>+ Add subtask</button>}</td>
                </tr>)];
            })}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>每頁 <select className="sel" aria-label="每頁筆數" value={size} onChange={(e) => setSize(+e.target.value)}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select> 筆 · <span>共 {pg.total} 筆</span></span>
        <span className="pgn">
          <button type="button" className="btn sec sm" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)}>上一頁</button>
          <span className="mono">{pg.page} / {pg.pages}</span>
          <button type="button" className="btn sec sm" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)}>下一頁</button>
        </span>
      </div>
    </div>
    {cleanOpen && (
      <div className="dlg-ov" onClick={() => setCleanOpen(false)}>
        <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" onClick={(e) => e.stopPropagation()}>
          <h3 id="dlg-t" className="c-red">Clean All</h3>
          <p>此操作將刪除所有任務、子任務、連結及檔案，且無法復原。</p>
          <p className="hint">請輸入 <b>clean all</b> 以確認刪除：</p>
          <input className="fld" autoFocus placeholder="clean all" aria-label="確認文字" value={cleanText} onChange={(e) => setCleanText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && cleanText === "clean all") { deleteAllTasks(); setCleanOpen(false); } if (e.key === "Escape") setCleanOpen(false); }} />
          <div className="dlg-f">
            <button type="button" className="btn sec" onClick={() => setCleanOpen(false)}>取消</button>
            <button type="button" className="btn danger" disabled={cleanText !== "clean all"} onClick={() => { deleteAllTasks(); setCleanOpen(false); }}>確認刪除</button>
          </div>
        </div>
      </div>
    )}
  </>);
}

// 一格：有 write 才是可選取／編輯的 DataCell；viewer 取代成純文字（不掛 onClick，避免點了沒反應）。
// 必須是頂層元件：寫在 Data 裡面每次 render 都是新型別，編輯中的 input 會被卸載而失焦。
function Cell({ ctlFor, id, col, value, className = "", render, ...rest }) {
  const canWrite = useCan("write");
  return canWrite
    ? <DataCell value={value} ctl={ctlFor(id, col)} className={className} render={render} {...rest} />
    : <span className={`gc ro ${className}`}>{render ? render(value) : (value || "—")}</span>;
}
