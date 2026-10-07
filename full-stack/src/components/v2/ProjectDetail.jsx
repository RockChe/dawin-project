"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCan } from "@/components/PermissionProvider";
import { useCloudLevel } from "@/components/CloudLevelContext";
import { dayIndex } from "@/lib/dayIndex";
import { resolveGanttWidths, resolveTimeDim } from "@/lib/personalSettings";
import { timeAxis } from "@/lib/v2Axis";
import { PROJECT_COLORS, STATUS_VAR, projectRows } from "@/lib/v2Data";
import { TASK_SORT_FIELDS, TASK_VIEW_DEFAULT, PRIORITY_ORDER, detailStats, filterTasks, isDefaultView, ownerOptions, resolveTaskView, sortTasks, toggleIn, withManualSort } from "@/lib/v2ProjectDetail";
import { taskModel, trackPx } from "@/lib/v2Timeline";
import { filterBySearch } from "@/lib/v2Search";
import Cloud from "./Cloud";
import GanttChart, { GAP_CLS } from "./GanttChart";
import TaskRow from "./ProjectTasks";
import { Avatar, Icon, Seg, Sortable, StatusChip } from "./common";
import { useV2Settings } from "./SettingsContext";

const SCALES = [["日", "日"], ["週", "週"], ["月", "月"], ["季", "季"]];
const SRC = { csv_import: "CSV匯入" };

// 專案名稱：有寫入權限才能點開行內編輯（Enter／失焦送出、Esc 取消；空白或沒改不送）。
function ProjectName({ name, canWrite, onRename }) {
  const [ed, setEd] = useState(false);
  const [v, setV] = useState(name);
  const fin = useRef(false); // Enter／Esc 後輸入框卸載會再觸發一次 blur，只算第一次
  if (!canWrite) return <h2>{name}</h2>;
  const done = (save) => { if (fin.current) return; fin.current = true; setEd(false); const n = v.trim(); if (save && n && n !== name) onRename(n); };
  return (
    <h2>
      {ed
        ? <input className="fld ren" aria-label="專案名稱" value={v} autoFocus onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()}
            onBlur={() => done(true)} onKeyDown={(e) => { if (e.key === "Enter") done(true); else if (e.key === "Escape") done(false); }} />
        : <button type="button" className="ren-b" title="點一下改名" onClick={() => { setV(name); fin.current = false; setEd(true); }}>{name}</button>}
    </h2>
  );
}

// 專案頭像：有寫入權限才能上傳／更換（點頭像選圖），有圖時右上角可刪除；沒權限就是純顯示。
function ProjectAvatar({ project, canWrite, onUpload, onRemove }) {
  const file = useRef(null);
  if (!canWrite) return <Avatar c={project} size="lg" />;
  const has = !!project.bannerUrl;
  return (
    <div className="avw">
      <button type="button" className="avb" aria-label={has ? "更換專案圖示" : "上傳專案圖示"} title={has ? "更換圖示" : "上傳圖示"} onClick={() => file.current?.click()}>
        <Avatar c={project} size="lg" />
      </button>
      {has && <button type="button" className="avx" aria-label="刪除專案圖示" title="刪除圖示" onClick={onRemove}><Icon n="x" size={14} /></button>}
      <input ref={file} type="file" accept="image/*" hidden aria-label="選擇專案圖示檔案"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
    </div>
  );
}

/**
 * 專案詳情：頭部、專案時程（共用 GanttChart，只傳任務列）、側欄統計、任務清單（排序／篩選／子任務展開）。
 * 資料全由 props 來；寫入走 actions（Live 版接 useTaskManager，同舊版呼叫的 action，不新增 server action）：
 *   { archive, unarchive, remove, updateTask, deleteTask, toggleSub, addSub, deleteSub, reorderTasks, notify }。
 * 個人設定：projectTaskView（排序／篩選／隱藏已完成子任務，全域一組）、timeDimProject、ganttWidths.project。
 * 任務視窗後續 Task 才接：點任務呼叫 onOpenTask(task)；「+ Create」呼叫 onOpenTask(null, { projectId })。
 * initialExpanded：預覽用，一開始就展開子任務的任務 id。
 * searchQ／onClearSearch：頁首搜尋字串只過濾下方清單與時程（側欄統計仍是整個專案）；「清除篩選」連搜尋一起清。
 * 專案改名／頭像：actions.rename(id, 名稱)、actions.uploadBanner(id, file)、actions.removeBanner(id)（需 write）。
 */
export default function ProjectDetail({ project, projects, twp, subtasks, userNames = [], today, actions, onBack, onOpenTask, initialExpanded = [], searchQ = "", onClearSearch }) {
  const { settings, updateSetting } = useV2Settings();
  const canWrite = useCan("write");
  const full = useCloudLevel() === "full";
  const view = useMemo(() => resolveTaskView(settings.projectTaskView), [settings.projectTaskView]);
  const scale = resolveTimeDim(settings.timeDimProject);
  const gw = resolveGanttWidths(settings.ganttWidths).project;
  const [expanded, setExpanded] = useState(() => new Set(initialExpanded));
  const [menuId, setMenuId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  useEffect(() => { // 狀態選單：點別處或 Esc 關閉
    if (!menuId) return;
    const off = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.(".stw")) setMenuId(null); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", off);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", off); };
  }, [menuId]);

  const color = PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.id === project.id)) % PROJECT_COLORS.length];
  const pt = useMemo(() => twp.filter((t) => t.projectId === project.id), [twp, project.id]);
  const subsOf = useMemo(() => {
    const m = new Map();
    for (const s of subtasks) { if (!m.has(s.taskId)) m.set(s.taskId, []); m.get(s.taskId).push(s); }
    return m;
  }, [subtasks]);
  const stats = useMemo(() => detailStats(pt, subtasks), [pt, subtasks]);
  const row = useMemo(() => projectRows(pt, projects, today).find((r) => r.id === project.id), [pt, projects, today, project.id]);
  const avg = pt.length ? Math.round(pt.reduce((n, t) => n + (t.progress || 0), 0) / pt.length) : 0;
  const ptAll = useMemo(() => sortTasks(pt, view.sort), [pt, view.sort]);
  const ptView = useMemo(() => filterBySearch(filterTasks(ptAll, view), searchQ), [ptAll, view, searchQ]);
  const owners = useMemo(() => ownerOptions(pt), [pt]);
  const dated = useMemo(() => pt.some((t) => dayIndex(t.start) != null), [pt]);
  const ganttRows = useMemo(() => ptView.filter((t) => dayIndex(t.start) != null).map((t) => taskModel(t, today, color)), [ptView, today, color]);
  const ax = useMemo(() => timeAxis(scale, today), [scale, today]);
  const byId = useMemo(() => new Map(pt.map((t) => [t.id, t])), [pt]);

  const gi = row?.gapInfo;
  const gapCls = gi ? GAP_CLS[gi.kind] || "c-sec" : "";
  const showGap = gi && (gi.kind === "behind" || gi.kind === "ahead");
  const isDef = isDefaultView(view);
  const save = (next) => updateSetting("projectTaskView", next);
  const patch = (p) => save({ ...view, ...p });
  const reset = () => save(TASK_VIEW_DEFAULT);
  const openTask = (t) => onOpenTask?.(t);
  const create = () => onOpenTask?.(null, { projectId: project.id });
  const archived = !!project.archivedAt;

  const act = {
    open: openTask,
    setStatus: (t, s) => {
      setMenuId(null);
      if (t.status === s) return;
      actions.updateTask(t.id, "status", s);
      if (s === "已完成") actions.notify?.(`完成了！「${t.task}」已標示完成，本專案已完成 ${pt.filter((x) => x.status === "已完成").length + 1} / ${pt.length}`, "success");
    },
    finish: (t) => act.setStatus(t, "已完成"),
    remove: (t) => { if (window.confirm(`確認刪除任務「${t.task}」嗎？`)) actions.deleteTask(t.id); },
    toggleSub: (id) => actions.toggleSub(id),
    deleteSub: (id) => actions.deleteSub(id),
    addSub: (taskId, d) => actions.addSub(taskId, d),
  };
  const toggleOpen = (id) => setExpanded((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const onDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return;
    actions.reorderTasks(project.id, active.id, over.id, ptAll.map((t) => t.id)); // 以完整順序為基準，不是篩選後的清單
    const next = withManualSort(view);
    if (next !== view) save(next);
  };
  const delProject = () => { if (window.confirm(`確認刪除專案「${project.name}」嗎？`)) { actions.remove(project.id); onBack(); } };
  const archiveProject = () => { actions.archive(project.id); onBack(); };

  const list = ptView.map((t) => {
    const body = (drag) => (
      <TaskRow t={t} subs={subsOf.get(t.id) || []} hideDone={view.hideDoneSubs} open={expanded.has(t.id)} onToggle={toggleOpen} canWrite={canWrite}
        owners={userNames} menuOpen={menuId === t.id} onMenu={(id) => setMenuId((m) => (m === id ? null : id))} drag={drag} act={act} />
    );
    return canWrite ? <Sortable key={t.id} id={t.id} drag>{body}</Sortable> : <div key={t.id}>{body(null)}</div>;
  });

  return (
    <div className="pdx" style={{ "--c": `var(--${color})` }}>
      <div className="dhead">
        <button type="button" className="btn sec" onClick={onBack}><Icon n="chev-l" size={14} /> Back</button>
        <ProjectAvatar project={project} canWrite={canWrite} onUpload={(file) => actions.uploadBanner(project.id, file)} onRemove={() => actions.removeBanner(project.id)} />
        <div className="who">
          <div className="tt"><ProjectName name={project.name} canWrite={canWrite} onRename={(n) => actions.rename(project.id, n)} />{row && <StatusChip c={row} />}</div>
          <div className="meta mono">{stats.n} tasks · {stats.subs} subtasks · {stats.done} done</div>
          {(project.creatorName || showGap) && (
            <div className="hint by">
              {project.creatorName}{project.creatorName && <> · <span className="badge" style={{ margin: 0 }}>{SRC[project.source] || "手動"}</span></>}
              {showGap && <>{project.creatorName && " · "}<span className={`gapx ${gapCls}`} title={gi.tip}>{gi.text}<small>{gi.sub}</small></span></>}
            </div>
          )}
        </div>
        {canWrite && (archived
          ? <button type="button" className="btn amber" onClick={() => actions.unarchive(project.id)}>Unarchive</button>
          : <button type="button" className="btn amber" onClick={archiveProject}>Archive</button>)}
        {canWrite && <button type="button" className="btn danger" onClick={delProject}>Delete</button>}
      </div>

      {dated && (
        <section className="blk tlx pgantt" aria-label="專案時程">
          <div className="hd2"><span className="hint">甘特圖跟著下方的篩選走；任務條顏色＝狀態，填色＝進度</span>
            <Seg items={SCALES} value={scale} onChange={(v) => updateSetting("timeDimProject", v)} label="時間尺度" />
          </div>
          {ganttRows.length
            ? <GanttChart rows={ganttRows} ax={ax} today={today} inner={trackPx(scale, ax, gw)} scrollKey={scale} leftTitle="任務" onSelect={(_, m) => openTask(byId.get(m.id))} />
            : <div className="empty">沒有符合篩選的任務</div>}
        </section>
      )}

      <div className="dgrid">
        <div className="dside">
          <div className="mcard">
            <div className="lb">Progress</div>
            <div className="big" style={{ color: avg === 100 ? "var(--t-green)" : "var(--text)" }}>{avg}%</div>
            {gi && <div className="hint" style={{ marginTop: 6 }}>時間已過 {row.el}% · <b className={gapCls} style={{ fontWeight: 600 }}>{gi.text}</b>{gi.sub && <span>{gi.sub}</span>}</div>}
            <div className={full ? "runbar" : "runbar nocl"} style={full ? { marginTop: 28 } : undefined}>
              {full && <span className="runner" style={{ "--p": avg }}><Cloud kind="nimbus" size={30} deco /></span>}
              <div className="bar xl" role="progressbar" aria-valuenow={avg} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${avg}%`, background: "var(--c)" }} /></div>
            </div>
          </div>
          <div className="mcard">
            <div className="lb">Subtasks</div>
            <div className="big">{stats.done}<span className="sec" style={{ fontSize: 20 }}>/{stats.subs}</span></div>
          </div>
          <div className="mcard">
            <div className="lb"><span>Tasks · 本專案</span>
              {isDef ? <span className="hint">點一下只看它</span>
                : <button type="button" className="chip sm" style={{ color: "var(--t-red)", borderColor: "var(--red)" }} onClick={reset}>重置</button>}
            </div>
            <div className="sts">
              {stats.counts.map(([s, n]) => (
                <button key={s} type="button" className="chip sm sc" style={{ "--c": `var(--${STATUS_VAR[s][0]})`, "--tc": `var(--${STATUS_VAR[s][1]})` }}
                  aria-pressed={view.status.includes(s)} onClick={() => patch({ status: toggleIn(view.status, s) })}>{s} {n}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="tcard">
          <div className="h">
            <b>Tasks{ptView.length !== pt.length && <span className="mono hint" style={{ fontWeight: 400, marginLeft: 8 }}>{ptView.length} / {pt.length}</span>}</b>
            {canWrite && <button type="button" className="btn" onClick={create}>+ Create</button>}
          </div>
          <div className="tbar2">
            <select className="sel" aria-label="排序欄位" value={view.sort.field} onChange={(e) => patch({ sort: { ...view.sort, field: e.target.value } })}>
              {TASK_SORT_FIELDS.map(([k, l]) => <option key={k} value={k}>排序：{l}</option>)}
            </select>
            {view.sort.field !== "manual" && (
              <button type="button" className="chip sm on" aria-label={`排序方向：${view.sort.dir === "asc" ? "升冪" : "降冪"}`}
                onClick={() => patch({ sort: { ...view.sort, dir: view.sort.dir === "asc" ? "desc" : "asc" } })}>{view.sort.dir === "asc" ? "↑" : "↓"}</button>
            )}
            {owners.length > 0 && <span className="l">負責人</span>}
            {owners.map((o) => <button key={o} type="button" className="chip sm" aria-pressed={view.owner.includes(o)} onClick={() => patch({ owner: toggleIn(view.owner, o) })}>{o}</button>)}
            <span className="l">緊急度</span>
            {PRIORITY_ORDER.map((p) => <button key={p} type="button" className="chip sm" aria-pressed={view.priority.includes(p)} onClick={() => patch({ priority: toggleIn(view.priority, p) })}>{p}</button>)}
            <button type="button" className="chip sm" aria-pressed={view.hideDoneSubs} onClick={() => patch({ hideDoneSubs: !view.hideDoneSubs })}>隱藏已完成子任務</button>
            {!isDef && <button type="button" className="btn sec sm rst" onClick={reset}>重置</button>}
          </div>
          {!pt.length
            ? (
              <div className="empty big">
                <Cloud kind="white" size={64} />
                <b>這個專案還沒有任務</b>建立第一個任務開始吧
                {canWrite && <div style={{ marginTop: 12 }}><button type="button" className="btn" onClick={create}>+ Create</button></div>}
              </div>
            ) : !ptView.length
              ? (
                <div className="empty">
                  <Cloud kind="purple" size={64} />
                  <b>沒有符合目前篩選的 task</b>換個條件試試
                  <div style={{ marginTop: 12 }}><button type="button" className="btn ghost sm" onClick={() => { reset(); onClearSearch?.(); }}>清除篩選</button></div>
                </div>
              )
              : canWrite
                ? <DndContext id={`tasks-${project.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={ptView.map((t) => t.id)} strategy={verticalListSortingStrategy}>{list}</SortableContext>
                  </DndContext>
                : list}
        </div>
      </div>
    </div>
  );
}
