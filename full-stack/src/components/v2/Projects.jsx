"use client";
import { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCan } from "@/components/PermissionProvider";
import { useCloudLevel } from "@/components/CloudLevelContext";
import { STATUS_CLS } from "@/lib/v2Data";
import { SORT_MODES, projectCards, sortProjects, toggleHidden, onDragEnd } from "@/lib/v2Projects";
import Cloud from "./Cloud";
import { Avatar, Icon, Seg, Sortable, StatusChip } from "./common";
import { useV2Settings } from "./SettingsContext";

const stop = (e) => e.stopPropagation();
const pc = (c) => ({ "--c": `var(--${c.color})` });

// 「狀態 數字」標籤；沒有任務顯示「尚無任務」
const StatusTags = ({ c }) => (c.counts.length
  ? c.counts.map(([s, n]) => <span key={s} className={`st ${STATUS_CLS[s]}`}>{s} {n}</span>)
  : <span className="hint">尚無任務</span>);

// 眼睛＝是否顯示在 Timeline（hiddenProjects 存 project.id）。viewer 也能切（個人設定，capability self）。
function Eye({ c, hidden, onToggle }) {
  return (
    <button type="button" className="iconx" aria-pressed={!hidden} aria-label={`在 Timeline 顯示「${c.name}」`}
      title={hidden ? "在 Timeline 顯示" : "不在 Timeline 顯示"} style={{ color: hidden ? "var(--t-amber)" : "var(--text-sec)" }}
      onClick={(e) => { stop(e); onToggle(c.id); }}>
      <Icon n={hidden ? "eye-off" : "eye"} />
    </button>
  );
}

const Grip = ({ c, drag }) => (
  <button type="button" className="grip" title="拖移排序" aria-label={`拖移排序「${c.name}」`} {...drag} onClick={stop}><Icon n="grip" /></button>
);

function Card({ c, hidden, onToggle, onOpen, canWrite, drag, onArchive, onDelete }) {
  const level = useCloudLevel();
  return (
    <article className="pcard" style={pc(c)} onClick={() => onOpen(c.id)}>
      <div className="strip"><Eye c={c} hidden={hidden} onToggle={onToggle} />{drag ? <Grip c={c} drag={drag} /> : <span />}</div>
      <div className="body">
        <div className="top">
          <Avatar c={c} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <button type="button" className="pname">{c.name}</button>
            <div className="meta mono">{c.n} tasks · {c.subs} subtasks</div>
          </div>
          <span className="sec" aria-hidden="true"><Icon n="chev-r" size={20} /></span>
        </div>
        <div className={level === "full" ? "runbar" : "runbar nocl"}>
          <span className="runner" style={{ "--p": c.avg }}><Cloud kind="nimbus" size={30} deco /></span>
          <div className="bar xl" role="progressbar" aria-valuenow={c.avg} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${c.avg}%`, background: "var(--c)" }} /></div>
        </div>
        <div className="prog">
          <span className="hint">整體進度</span><StatusChip c={c} />
          <span className="pct" style={{ color: c.avg === 100 ? "var(--t-green)" : "var(--text)" }}>{c.avg}%</span>
        </div>
        <div className="tags"><StatusTags c={c} /></div>
      </div>
      {canWrite && (
        <div className="foot" onClick={stop}>
          <button type="button" className="btn amber sm" onClick={() => onArchive(c.id)}>Archive</button>
          <button type="button" className="btn danger sm" onClick={() => onDelete(c)}>Delete</button>
        </div>
      )}
    </article>
  );
}

function Row({ c, hidden, onToggle, onOpen, drag }) {
  return (
    <div className="prow" style={pc(c)} onClick={() => onOpen(c.id)}>
      {drag && <Grip c={c} drag={drag} />}
      <Avatar c={c} size="sm" />
      <div className="nm"><button type="button">{c.name}</button><div className="hint mono">{c.n} tasks · {c.subs} subtasks</div></div>
      <StatusChip c={c} />
      <div className="pb">
        <div className="bar" role="progressbar" aria-valuenow={c.avg} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${c.avg}%`, background: "var(--c)" }} /></div>
        <b className="mono" style={{ width: 48, textAlign: "right" }}>{c.avg}%</b>
      </div>
      <div className="sts"><StatusTags c={c} /></div>
      <Eye c={c} hidden={hidden} onToggle={onToggle} />
      <span className="sec" aria-hidden="true"><Icon n="chev-r" /></span>
    </div>
  );
}

// Projects：卡片／明細、排序、眼睛、封存區、+ Create。
// 資料全由 props／設定 Context 來：actions＝{ archive, unarchive, remove, add, reorder }（Live 版接 useTaskManager，同舊版呼叫的 action）。
// 設定：projectsView（card|list）、hiddenProjects（project.id 陣列）。排序只在畫面上，不持久化。
export default function Projects({ twp, projects, today, actions, onOpenProject, initialShowArch = false }) {
  const { settings, updateSetting } = useV2Settings();
  const canWrite = useCan("write");
  const [sort, setSort] = useState("manual");
  const [showArch, setShowArch] = useState(initialShowArch);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const view = settings.projectsView === "list" ? "list" : "card";
  const hiddenIds = settings.hiddenProjects ?? [];
  const cards = useMemo(() => projectCards(twp, projects, today), [twp, projects, today]);
  const list = useMemo(() => sortProjects(cards, sort), [cards, sort]);
  const archived = useMemo(() => cards.filter((c) => c.archived), [cards]);
  const dragOn = canWrite && sort === "manual";
  const open = (id) => onOpenProject?.(id);
  const toggleEye = (id) => updateSetting("hiddenProjects", toggleHidden(hiddenIds, id));
  const del = (c) => { if (window.confirm(`確認刪除專案「${c.name}」嗎？`)) actions.remove(c.id); };
  const cancelCreate = () => { setCreating(false); setName(""); };
  const create = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const r = await actions.add(n);
      if (r?.success) { cancelCreate(); if (r.project?.id) open(r.project.id); }
    } finally { setBusy(false); }
  };

  const items = list.map((c) => (
    <Sortable key={c.id} id={c.id} drag={dragOn}>
      {(drag) => view === "list"
        ? <Row c={c} hidden={hiddenIds.includes(c.id)} onToggle={toggleEye} onOpen={open} drag={drag} />
        : <Card c={c} hidden={hiddenIds.includes(c.id)} onToggle={toggleEye} onOpen={open} canWrite={canWrite} drag={drag} onArchive={actions.archive} onDelete={del} />}
    </Sortable>
  ));
  const body = <div className={view === "list" ? "plist" : "pgrid"}>{items}</div>;

  return (
    <div>
      <div className="ptool">
        <div className="l">
          <button type="button" className="btn sec" aria-pressed={showArch} onClick={() => setShowArch((v) => !v)}>Archived ({archived.length})</button>
          <select className="sel" aria-label="排序" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Seg items={[["card", "卡片"], ["list", "明細"]]} value={view} onChange={(v) => updateSetting("projectsView", v)} label="檢視模式" />
        </div>
        {canWrite && (creating ? (
          <div className="cform">
            <input className="fld" aria-label="新專案名稱" placeholder="Project name" value={name} autoFocus onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") cancelCreate(); }} />
            <button type="button" className="btn" disabled={!name.trim() || busy} onClick={create}>Confirm</button>
            <button type="button" className="btn sec" onClick={cancelCreate}>Cancel</button>
          </div>
        ) : <button type="button" className="btn" onClick={() => setCreating(true)}>+ Create</button>)}
      </div>

      {canWrite
        ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(actions.reorder)}>
            <SortableContext items={list.map((c) => c.id)} strategy={view === "list" ? verticalListSortingStrategy : rectSortingStrategy} disabled={!dragOn}>{body}</SortableContext>
          </DndContext>
        : body}

      {showArch && (
        <section aria-label="已封存專案">
          <div className="archh"><Cloud kind="purple" size={24} deco fb="bar" /><span>已封存</span><span className="hint">· {archived.length} 個。封存存在資料庫、全團隊共享；不會出現在上方列表與 Timeline</span></div>
          {archived.length ? (
            <div className="archgrid">
              {archived.map((c) => (
                <div key={c.id} className="pcard arch" style={pc(c)} tabIndex={0} onClick={() => open(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(c.id); }}>
                  <Avatar c={c} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}><b>{c.name}</b><div className="hint mono">{c.n} tasks</div></div>
                  {canWrite && <>
                    <button type="button" className="btn sec sm" onClick={(e) => { stop(e); actions.unarchive(c.id); }}>Unarchive</button>
                    <button type="button" className="btn danger sm" onClick={(e) => { stop(e); del(c); }}>Delete</button>
                  </>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty dashed"><Cloud kind="purple" size={64} /><b>沒有已封存的專案</b>封存的專案會收在這裡，隨時可以放回來</div>
          )}
        </section>
      )}
    </div>
  );
}
