"use client";
import SettingsGeneral from "./SettingsGeneral";
import CloudSettings from "./CloudSettings";

const SUBS = [["general", "一般"], ["cloud", "雲朵"]];

// Settings：左側子選單「一般／雲朵」。sub／onSub 由 Shell 持有（麵包屑要跟著顯示「Settings › 雲朵」）。
// 一般頁不放雲；雲朵專區是 Settings 裡唯一放雲的頁。
export default function Settings({ sub = "general", onSub, config, actions, preview, initSel }) {
  return (
    <div className="setlay">
      <nav className="snav" aria-label="設定分頁">
        {SUBS.map(([k, l]) => <button key={k} type="button" aria-current={sub === k ? "page" : undefined} onClick={() => onSub(k)}>{l}</button>)}
      </nav>
      <div>{sub === "cloud" ? <CloudSettings preview={preview} initSel={initSel} /> : <SettingsGeneral config={config} actions={actions} onSub={onSub} />}</div>
    </div>
  );
}
