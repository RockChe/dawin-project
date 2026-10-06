"use client";
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { STATUS_FILTERS } from "@/lib/constants";
import { fD } from "@/lib/utils";
import { execTokens, hasSubOwners, subOwnerTokens, ownerTokens } from "@/lib/taskOwner";
import TagInput from "@/components/dashboard/TagInput";
import OwnerTags from "@/components/dashboard/OwnerTags";

const STATUS_OPTIONS = STATUS_FILTERS.filter(s => s !== "全部");
const sameTokens = (a, b) => ownerTokens(a).join(",") === ownerTokens(b).join(",");

// 任務底部抽屜（草圖 ⑤）：狀態／關注人／執行人／子任務。驗證與 owner 衍生規則在伺服端與 updateTask，這裡不重做。
export default function TaskSheet({ task, subs, configOwners = [], canWrite, onClose, updateTask, toggleSub }) {
  const { X, inputStyle } = useTheme();
  // task.owner = 執行人 ∪ 關注人；表單的 owner 只放執行人，也當 diff 基準（同 TaskModal）
  const [initOwner] = useState(() => (ownerTokens(task.watchers).length ? (execTokens(task, subs).join(",") || "—") : (task.owner || "—")));
  const [status, setStatus] = useState(task.status || "待辦");
  const [watchers, setWatchers] = useState(task.watchers || "");
  const [owner, setOwner] = useState(initOwner);
  const [saving, setSaving] = useState(false);
  const ownerLocked = hasSubOwners(subs);

  // updateTask(id, field, value)：一次一個欄位，只送有變動的
  const changes = [];
  if (status !== task.status) changes.push(["status", status]);
  if (!sameTokens(watchers, task.watchers)) changes.push(["watchers", watchers]);
  if (!ownerLocked && !sameTokens(owner, initOwner)) changes.push(["owner", owner]);

  const save = async () => {
    if (saving || !changes.length) return;
    setSaving(true);
    try {
      for (const [field, value] of changes) await updateTask(task.id, field, value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 12, color: X.textSec, margin: "10px 0 4px" };
  return (<>
    <div data-testid="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 52, background: "rgba(0,0,0,.4)" }} />
    <div role="dialog" aria-modal="true" aria-label={task.task}
      style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 53, maxHeight: "88dvh", overflowY: "auto", background: X.surface, color: X.text, borderRadius: "18px 18px 0 0", boxShadow: "0 -6px 20px rgba(0,0,0,.2)", padding: "6px 16px calc(16px + env(safe-area-inset-bottom))" }}>
      <button type="button" aria-label="關閉" onClick={onClose} style={{ display: "block", width: "100%", height: 24, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
        <span style={{ display: "block", width: 36, height: 4, background: X.border, borderRadius: 2, margin: "0 auto" }} />
      </button>
      <div style={{ fontSize: 16, fontWeight: 700, overflowWrap: "anywhere" }}>{task.task}</div>
      <div style={{ fontSize: 12, color: X.textSec }}>{fD(task.startDate || task.start)} → {fD(task.endDate || task.end)}</div>

      <div style={label}>狀態</div>
      {canWrite
        ? <select aria-label="狀態" value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, minHeight: 44, cursor: "pointer" }}>{STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
        : <div style={{ fontSize: 14 }}>{status}</div>}

      <div style={label}>關注人（掛名、不一定做子任務）</div>
      {canWrite
        ? <TagInput value={watchers} onChange={setWatchers} suggestions={configOwners} configOwners={configOwners} placeholder="新增關注人..." />
        : <OwnerTags value={watchers} configOwners={configOwners} />}

      <div style={label}>執行人</div>
      {canWrite && !ownerLocked
        ? <TagInput value={owner} onChange={setOwner} suggestions={configOwners} configOwners={configOwners} placeholder="新增執行人..." />
        : <OwnerTags value={ownerLocked ? subOwnerTokens(subs).join(",") : owner} configOwners={configOwners} />}
      {ownerLocked && <div style={{ fontSize: 11, color: X.textDim, marginTop: 4 }}>由子任務自動帶出</div>}

      {subs.length > 0 && <div style={label}>子任務</div>}
      {subs.map(s => (
        <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, borderTop: `1px dashed ${X.border}`, fontSize: 14, color: s.done ? X.textDim : X.text, textDecoration: s.done ? "line-through" : "none" }}>
          {canWrite
            ? <input type="checkbox" aria-label={s.name} checked={!!s.done} onChange={() => toggleSub(s.id)} style={{ width: 20, height: 20, accentColor: X.accent }} />
            : <span aria-hidden="true">{s.done ? "☑" : "☐"}</span>}
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{s.name}</span>
          {s.owner && s.owner !== "—" && <OwnerTags value={s.owner} configOwners={configOwners} />}
        </label>
      ))}

      {canWrite && (
        <button type="button" onClick={save} disabled={!changes.length || saving}
          style={{ display: "block", width: "100%", minHeight: 44, marginTop: 14, border: 0, borderRadius: 10, background: X.accent, color: "#fff", fontSize: 15, fontWeight: 600, cursor: changes.length && !saving ? "pointer" : "not-allowed", opacity: changes.length && !saving ? 1 : 0.5 }}>
          儲存
        </button>
      )}
    </div>
  </>);
}
