"use client";
import { useCloudLevel } from "@/components/CloudLevelContext";
import Cloud from "./Cloud";

// 狀態集（設計稿「10 狀態集」）：載入中／載入失敗／空狀態／篩選後沒結果／專案內尚無任務／提示條。
// 雲只是輔助：每個狀態旁一定有文字；雲不畫時（關閉）退回色條或骨架線。載入中的白雲上下飄（減少動態時靜止，見 v2.css）。

export function LoadingState({ hint = "正在整理你的任務" }) {
  const off = useCloudLevel() === "off";
  return (
    <div className="emp" role="status" aria-label="載入中">
      <Cloud kind="white" size={64} motion="bob" />
      {off && <span className="skls" aria-hidden="true"><i /><i /><i /></span>}
      <b>載入中…</b>{hint}
    </div>
  );
}

export function ErrorState({ onRetry, hint = "資料暫時讀不到，請重新整理再試一次" }) {
  return (
    <div className="emp err" role="alert">
      <Cloud kind="dark" size={64} fb="bar" fc="red" />
      <b>載入失敗</b>{hint}
      <button type="button" className="btn sm" onClick={onRetry}>重新整理</button>
    </div>
  );
}

export const EmptyNone = () => (
  <div className="emp"><Cloud kind="nimbus" size={64} /><b>沒有待辦！</b>今天可以喘口氣了</div>
);

export const EmptyFiltered = ({ onClear }) => (
  <div className="emp"><Cloud kind="purple" size={64} /><b>沒有符合篩選的任務</b>換個條件試試<button type="button" className="btn ghost sm" onClick={onClear}>清除篩選</button></div>
);

export const EmptyProject = ({ onCreate }) => (
  <div className="emp"><Cloud kind="white" size={64} /><b>這個專案還沒有任務</b>建立第一個任務開始吧<button type="button" className="btn sm" onClick={onCreate}>+ Create</button></div>
);

// 提示條：成功（筋斗雲飛過）／逾期（烏雲）／小提示（粉紅雲）。float＝浮在畫面下方中間。
const TOAST = { ok: ["nimbus", "fly", "green"], warn: ["dark", undefined, "red"], tip: ["pink", undefined, "pink"] };
export function Toast({ kind = "ok", title, sub, float = false, onAction, action }) {
  const [cloud, motion, color] = TOAST[kind];
  return (
    <div className={`toast${float ? " float" : ""}`} role="status">
      <Cloud kind={cloud} size={40} motion={motion} fb="bar" fc={color} />
      <div><b>{title}</b>{sub && <div>{sub}</div>}</div>
      {action && <button type="button" className="btn sm" onClick={onAction}>{action}</button>}
    </div>
  );
}
