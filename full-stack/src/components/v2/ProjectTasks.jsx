"use client";
import { useState } from "react";
import { STATUSES } from "@/lib/constants";
import { STATUS_CLS } from "@/lib/v2Data";
import { allSubsDone, ownerChips, visibleSubs } from "@/lib/v2ProjectDetail";
import { Icon, OwnerPills, StatusTag } from "./common";

const stop = (e) => e.stopPropagation();
const day = (s) => (s ? String(s).split(" ")[0].replace(/-/g, "/") : "—");

// 子任務一列：勾選（viewer 唯讀）、名稱（完成劃線）、備註、負責人、刪除。
function SubRow({ s, canWrite, owners, onToggle, onDelete }) {
  return (
    <div className="sub">
      <button type="button" className="cb" role="checkbox" aria-checked={s.done} aria-label={s.name} disabled={!canWrite} onClick={() => onToggle(s.id)}>
        {s.done && <Icon n="check" size={12} />}
      </button>
      <span className={`nm${s.done ? " done" : ""}`}>{s.name}</span>
      <span className="nt">{s.notes}</span>
      {s.owner ? <OwnerPills value={s.owner} owners={owners} /> : <span className="hint">未指派</span>}
      {canWrite && <button type="button" className="iconx" aria-label={`刪除子任務「${s.name}」`} onClick={() => onDelete(s.id)}><Icon n="x" size={12} /></button>}
    </div>
  );
}

// + Add subtask 的內嵌表單：名稱（空白不送）＋負責人（下拉，來源＝使用者名單）。Enter 送出、Esc 取消。
function AddSub({ owners, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const submit = () => { const n = name.trim(); if (!n) return; onAdd({ name: n, owner }); onClose(); };
  return (
    <div className="addf">
      <input className="fld" aria-label="子任務名稱" placeholder="Subtask name" value={name} autoFocus onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }} />
      <select className="fld" aria-label="子任務負責人" value={owner} onChange={(e) => setOwner(e.target.value)}>
        <option value="">負責人…</option>
        {owners.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <button type="button" className="btn sm" onClick={submit}>Add</button>
      <button type="button" className="btn sec sm" onClick={onClose}>Cancel</button>
    </div>
  );
}

/**
 * 任務一列（含子任務展開）。
 * act＝{ open(task), setStatus(task, status), remove(task), toggleSub(id), deleteSub(id), addSub(taskId, data), finish(task) }。
 * drag＝拖移把手屬性（null＝不給拖）；menuOpen／onMenu＝狀態選單（同時只開一個，由上層管）。
 * 沒有子任務的任務，admin 仍給展開鈕（才加得了第一個子任務）；viewer 沒有。
 */
export default function TaskRow({ t, subs, hideDone, open, onToggle, canWrite, owners, menuOpen, onMenu, drag, act }) {
  const [adding, setAdding] = useState(false);
  const { names, watchOnly } = ownerChips(t, subs);
  const shown = visibleSubs(subs, hideDone);
  const done = subs.filter((s) => s.done).length;
  const p = t.progress || 0;
  const expandable = subs.length > 0 || canWrite;
  return (
    <div className="trow" data-tid={t.id}>
      <div className="trm" onClick={() => act.open(t)}>
        {drag && <button type="button" className="grip" title="拖移排序" aria-label={`拖移排序「${t.task}」`} {...drag} onClick={stop}><Icon n="grip" /></button>}
        {expandable
          ? <button type="button" className="exp" aria-expanded={open} aria-label={open ? "收合子任務" : "展開子任務"} onClick={(e) => { stop(e); onToggle(t.id); }}><Icon n={open ? "chev-d" : "chev-r"} /></button>
          : <span className="exps" />}
        <div className="tn">
          <button type="button" className="tnm">{t.task}</button>
          <div className="ln">
            {names.length ? <OwnerPills value={names.join(",")} owners={owners} watchers={watchOnly.join(",")} /> : <span className="hint">未指派</span>}
            <span aria-hidden="true">·</span>
            <span className="mono">{day(t.start)} → {day(t.end)}</span>
            {allSubsDone(t, subs) && (
              <span className="hdone" role="note">可以改成已完成了
                {canWrite && <button type="button" className="btn sm" onClick={(e) => { stop(e); act.finish(t); }}>改成已完成</button>}
              </span>
            )}
          </div>
        </div>
        <div className="stw" onClick={stop}>
          {canWrite
            ? <button type="button" className={`st stbtn ${STATUS_CLS[t.status] || "todo"}`} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`狀態：${t.status}，點擊變更`} onClick={() => onMenu(t.id)}>{t.status} <Icon n="chev-d" size={12} /></button>
            : <StatusTag status={t.status} />}
          {menuOpen && (
            <div className="pop" role="menu">
              {STATUSES.map((s) => (
                <button key={s} type="button" role="menuitem" onClick={() => act.setStatus(t, s)}>
                  <StatusTag status={s} />{t.status === s && <span style={{ marginLeft: "auto" }}><Icon n="check" size={14} /></span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pgs">
          <div className="bar" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${p}%`, background: p === 100 ? "var(--green)" : "var(--accent)" }} /></div>
          <small>{subs.length ? `${done}/${subs.length} 子任務` : t.status === "已完成" ? "100%" : `${p}% · 依時間`}</small>
        </div>
        {canWrite && <button type="button" className="iconx" aria-label={`刪除任務「${t.task}」`} onClick={(e) => { stop(e); act.remove(t); }}><Icon n="x" size={14} /></button>}
      </div>
      {open && expandable && (
        <div className="subs">
          {shown.map((s) => <SubRow key={s.id} s={s} canWrite={canWrite} owners={owners} onToggle={act.toggleSub} onDelete={act.deleteSub} />)}
          {hideDone && shown.length < subs.length && <div className="hint" style={{ padding: "2px 8px" }}>已隱藏 {subs.length - shown.length} 個已完成子任務（進度仍以全部計）</div>}
          {canWrite && (adding
            ? <AddSub owners={owners} onAdd={(d) => act.addSub(t.id, d)} onClose={() => setAdding(false)} />
            : <button type="button" className="addsub" onClick={() => setAdding(true)}>+ Add subtask</button>)}
        </div>
      )}
    </div>
  );
}
