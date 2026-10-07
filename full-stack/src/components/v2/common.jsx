"use client";
// v2 畫面共用的小零件（只有樣式，沒有資料邏輯）。
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Cloud from "./Cloud";
import { STATUS_CLS, STATUS_CLOUD, STATUS_VAR, WX, ownerClass } from "@/lib/v2Data";

/** 分段開關（日／週／月／季、狀態／專案狀況）。items: [[key, 文字]]。 */
export function Seg({ items, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

// 設計稿 sprite 的內嵌版（grip 拖曳把手、chev-r／chev-l／chev-d 箭頭、eye／eye-off 眼睛、check 勾、x 叉）。
const ICONS = {
  "chev-l": <path d="M15 6l-6 6 6 6" />,
  "chev-d": <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  grip: <g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></g>,
  "chev-r": <path d="M9 6l6 6-6 6" />,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>,
};
export const Icon = ({ n, size = 16 }) => <svg className="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[n]}</svg>;

/** 固定尺寸的雲槽：雲大小不同時文字仍對齊。 */
export const Slot = ({ size, className = "", children }) => <span className={`ci${className}`} style={{ width: size, height: size }}>{children}</span>;

/** 狀態標籤（已完成／進行中…）。 */
export const StatusTag = ({ status }) => <span className={`st ${STATUS_CLS[status] || "todo"}`}>{status}</span>;

/** 狀態雲：逾期一律烏雲；待辦用較小較淡的白雲。雲不畫時退回該狀態色點。 */
export function StatusCloud({ status, size = 24, overdue = false, fb = "dot" }) {
  const lite = status === "待辦" && !overdue;
  const kind = overdue ? "dark" : STATUS_CLOUD[status] || "white";
  return (
    <Slot size={size} className={lite ? " lt2" : ""}>
      <Cloud kind={kind} size={lite ? Math.round(size * 0.75) : size} deco fb={fb} fc={STATUS_VAR[status]?.[0]} title={overdue ? "逾期" : status} />
    </Slot>
  );
}

/** 人員標籤；顏色依 owners 名單順序。tag＝關注人記號。 */
export function OwnerPills({ value, owners, watchers = "" }) {
  const list = String(value || "").split(",").map((s) => s.trim()).filter((s) => s && s !== "—");
  const w = new Set(String(watchers || "").split(",").map((s) => s.trim()));
  return list.map((n) => (
    <span key={n} className={`pp ${ownerClass(n, owners)}`}>{n}{w.has(n) && <span className="w">關注</span>}</span>
  ));
}

/** 專案頭像：有 bannerUrl 顯示圖片，否則專案名稱第一個字（雲頭像選項依 R7 不做）。size：""／"sm"／"lg"。 */
export const Avatar = ({ c, size = "" }) => (
  <span className={`av ${size}${c.bannerUrl ? " img" : ""}`} aria-hidden="true">
    {c.bannerUrl ? <img src={c.bannerUrl} alt="" /> : Array.from(c.name)[0]}
  </span>
);

/** 專案狀況 chip（有逾期／進度領先／進行順利／暫緩中／提案／待確認）；沒有 key（沒有任務）就不畫。 */
export const StatusChip = ({ c }) => {
  if (!c.key) return null;
  const w = WX[c.key];
  return (
    <span className="pchip" style={{ "--c": `var(--${w.sq})`, "--tc": `var(--${w.ink})` }}>
      <Cloud kind={c.cloud} size={22} deco />{c.label}
    </span>
  );
};

/** 可排序外框：drag=false（viewer／非手動排序）時 useSortable 停用，children 拿到 null（不出現把手）。 */
export function Sortable({ id, drag, children }) {
  const s = useSortable({ id, disabled: !drag });
  const style = { transform: CSS.Transform.toString(s.transform), transition: s.transition, ...(s.isDragging ? { zIndex: 2, opacity: 0.85 } : null) };
  return <div ref={s.setNodeRef} style={style}>{children(drag ? { ...s.attributes, ...s.listeners } : null)}</div>;
}

/** 開關（role=switch）。名稱由 labelId 指到的文字提供；disabled 時外觀變淡。 */
export const Switch = ({ checked, onChange, labelId, disabled }) => (
  <button type="button" className="sw" role="switch" aria-checked={checked} aria-labelledby={labelId} disabled={disabled} onClick={() => onChange(!checked)} />
);
