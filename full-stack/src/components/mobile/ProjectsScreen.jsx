"use client";
import { useState, useMemo } from "react";
import { FM, getOwnerColor } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useCan } from "@/components/PermissionProvider";
import { fD } from "@/lib/utils";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus } from "@/lib/statusFilter";
import { execTokens, watcherTokens } from "@/lib/taskOwner";
import { projectSummaries, filterProjectTasks, visibleSubs } from "./mobileData";
import Breadcrumbs from "@/components/Breadcrumbs";
import { tabCrumbs, detailCrumbs } from "@/lib/breadcrumbs";

function Header({ X, title, sub }) {
  return (
    <div style={{ padding: "4px 14px 8px", display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 12, color: X.textSec }}>{sub}</div>
      </div>
    </div>
  );
}

function Bar({ X, pct, color }) {
  return (
    <div style={{ height: 6, background: X.borderLight, borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color }} />
    </div>
  );
}

function Chip({ X, on, children, ...rest }) {
  return (
    <button type="button" aria-pressed={on} {...rest}
      style={{ flex: "none", minHeight: 36, padding: "0 14px", borderRadius: 99, fontSize: 13, cursor: "pointer", border: `1px solid ${on ? X.accent : X.border}`, background: on ? X.accent : X.surface, color: on ? X.bg : X.textSec, fontWeight: on ? 600 : 400 }}>{children}</button>
  );
}

function OwnerChip({ X, name, configOwners, watcher }) {
  const oc = getOwnerColor(X, name, configOwners);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 12, padding: "1px 7px", borderRadius: 99, background: oc.bg, color: oc.color, fontWeight: 500 }}>{name}</span>
      {watcher && <span style={{ fontSize: 10, padding: "0 5px", borderRadius: 5, background: X.accent, color: X.bg }}>關注</span>}
    </span>
  );
}

function TaskCard({ X, SC, t, subs, canWrite, hideDone, configOwners, openTask, toggleSub }) {
  const [open, setOpen] = useState(false);
  const exec = execTokens(t, subs);
  const watch = watcherTokens(t).filter(w => !exec.includes(w));
  const sc = SC[t.status] || { color: X.textDim, bg: `${X.textDim}15` };
  const shown = visibleSubs(subs, hideDone);
  return (
    <div style={{ background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, marginBottom: 8 }}>
      <div role="button" tabIndex={0} onClick={() => openTask(t.id)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(t.id); } }}
        style={{ padding: "10px 12px", minHeight: 56, cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{t.task}</span>
          <span style={{ flex: "none", fontSize: 11, padding: "1px 8px", borderRadius: 6, background: sc.bg, color: sc.color }}>{t.status}</span>
        </div>
        {(exec.length > 0 || watch.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {exec.map(n => <OwnerChip key={`e${n}`} X={X} name={n} configOwners={configOwners} />)}
            {watch.map(n => <OwnerChip key={`w${n}`} X={X} name={n} configOwners={configOwners} watcher />)}
          </div>
        )}
        {t.sTotal === 0 && (
          <div style={{ fontSize: 12, color: X.textSec, marginTop: 6, fontFamily: FM }}>{t.progress}% · 到期 {fD(t.end)}</div>
        )}
      </div>
      {t.sTotal > 0 && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
          style={{ width: "100%", minHeight: 44, padding: "0 12px", border: "none", borderTop: `1px dashed ${X.border}`, background: "transparent", color: X.textSec, fontSize: 12, fontFamily: FM, textAlign: "left", cursor: "pointer" }}>
          子任務 {t.sDone}/{t.sTotal} {open ? "▴" : "▾"}
        </button>
      )}
      {open && shown.map(s => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, borderTop: `1px dashed ${X.border}`, padding: "0 12px 0 4px", minHeight: 44 }}>
          {canWrite && (
            <button type="button" role="checkbox" aria-checked={!!s.done} aria-label={`完成 ${s.name}`}
              onClick={e => { e.stopPropagation(); toggleSub(s.id); }}
              style={{ flex: "none", minWidth: 44, minHeight: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${s.done ? X.green : X.textDim}`, background: s.done ? X.green : "transparent", color: X.bg, fontSize: 13, lineHeight: "16px", textAlign: "center" }}>{s.done ? "✓" : ""}</span>
            </button>
          )}
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: s.done ? X.textDim : X.text, textDecoration: s.done ? "line-through" : "none", paddingLeft: canWrite ? 0 : 8, overflowWrap: "anywhere" }}>{s.name}</span>
          {s.owner && s.owner !== "—" && <OwnerChip X={X} name={s.owner} configOwners={configOwners} />}
        </div>
      ))}
    </div>
  );
}

function ProjectDetail({ X, SC, project, twp, allS, configOwners, openTask, toggleSub, onBack, onHome }) {
  const canWrite = useCan("write");
  const [status, setStatus] = useState([]);
  const [hideDone, setHideDone] = useState(false);
  const tasks = useMemo(() => twp.filter(t => t.projectId === project.id), [twp, project.id]);
  const subsOf = useMemo(() => {
    const m = new Map();
    for (const s of allS) { if (!m.has(s.taskId)) m.set(s.taskId, []); m.get(s.taskId).push(s); }
    for (const l of m.values()) l.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return m;
  }, [allS]);
  const shown = filterProjectTasks(tasks, { status });
  const subTotal = tasks.reduce((n, t) => n + t.sTotal, 0), subDone = tasks.reduce((n, t) => n + t.sDone, 0);
  return (
    <>
      <div style={{ paddingTop: 4 }}><Breadcrumbs size="mobile" items={detailCrumbs("projects", project.name, { mobile: true, onHome, onTab: onBack })} /></div>
      <Header X={X} title={project.name} sub={`${tasks.length} 任務 · ${subTotal} 子任務 · ${subDone} 完成`} />
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {STATUS_FILTERS.map(s => <Chip key={s} X={X} on={s === "全部" ? status.length === 0 : status.includes(s)} onClick={() => setStatus(v => toggleStatus(v, s))}>{s}</Chip>)}
          <Chip X={X} on={hideDone} onClick={() => setHideDone(v => !v)}>隱藏已完成子任務</Chip>
        </div>
        {shown.length === 0 && <div style={{ padding: 24, textAlign: "center", color: X.textDim, fontSize: 14 }}>沒有符合的任務</div>}
        {shown.map(t => (
          <TaskCard key={t.id} X={X} SC={SC} t={t} subs={subsOf.get(t.id) || []} canWrite={canWrite} hideDone={hideDone}
            configOwners={configOwners} openTask={openTask} toggleSub={toggleSub} />
        ))}
      </div>
    </>
  );
}

export default function ProjectsScreen({ projects = [], twp = [], allS = [], configOwners = [], pcMap = {}, openTask, toggleSub, selectedProjectId, setSelectedProjectId, onHome }) {
  const { X, SC } = useTheme();
  const summaries = useMemo(() => projectSummaries(projects, twp), [projects, twp]);
  const selected = projects.find(p => p.id === selectedProjectId);

  if (selected) {
    return <ProjectDetail X={X} SC={SC} project={selected} twp={twp} allS={allS} configOwners={configOwners}
      openTask={openTask} toggleSub={toggleSub} onBack={() => setSelectedProjectId(null)} onHome={onHome} />;
  }
  return (
    <>
      <div style={{ paddingTop: 4 }}><Breadcrumbs size="mobile" items={tabCrumbs("projects", { mobile: true, onHome })} /></div>
      <Header X={X} title="專案" sub={`${projects.length} 個專案`} />
      <div style={{ padding: "0 12px 12px" }}>
        {summaries.map(p => (
          <button key={p.id} type="button" onClick={() => setSelectedProjectId(p.id)}
            style={{ display: "block", width: "100%", textAlign: "left", font: "inherit", color: "inherit", background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, minHeight: 56, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{p.name}</span>
              <span style={{ flex: "none", fontSize: 12, color: X.textDim }}>{p.taskCount} 任務</span>
            </div>
            <Bar X={X} pct={p.avgProgress} color={pcMap[p.name] || X.accent} />
            <div style={{ fontSize: 12, color: X.textSec, marginTop: 4, fontFamily: FM }}>{p.avgProgress}%{p.endDate ? ` · 到期 ${fD(p.endDate)}` : ""}</div>
          </button>
        ))}
      </div>
    </>
  );
}
