"use client";

export const TABS = [["overview", "Overview"], ["mytasks", "My Tasks"], ["projects", "Projects"], ["timeline", "Timeline"], ["data", "Data"], ["settings", "Settings"]];
export const TAB_LABEL = Object.fromEntries(TABS);

export default function Tabs({ current, onChange }) {
  return (
    <nav className="tabs" aria-label="主要分頁">
      {TABS.map(([k, l]) => (
        <button key={k} type="button" className={`t${k === current ? " on" : ""}`} aria-current={k === current ? "page" : undefined} onClick={() => onChange(k)}>{l}</button>
      ))}
    </nav>
  );
}
