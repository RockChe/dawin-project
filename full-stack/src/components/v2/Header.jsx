"use client";
import Cloud from "./Cloud";
import ThemeToggle from "./ThemeToggle";
import { useCloudLevel } from "@/components/CloudLevelContext";

// search：{ value, onChange(字串), onClear }；沒給就是不接線的外觀（舊行為）。
export default function Header({ overall, today, count, search }) {
  const level = useCloudLevel();
  return (
    <header className="hdr">
      <div className="brand">
        {level === "off" ? <span className="logo-fb" aria-hidden="true">P</span> : <Cloud kind="white" size={34} />}
        <span>大雲文創專案管理系統</span>
      </div>
      <div className="hr">
        <div className="search">
          <label className="sr" htmlFor="v2-search">搜尋任務</label>
          <svg className="ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input id="v2-search" type="search" placeholder="Search tasks..." {...(search ? { value: search.value, onChange: (e) => search.onChange(e.target.value) } : null)} />
          {search?.value && (
            <button type="button" className="sclr" aria-label="清除搜尋" onClick={search.onClear}>
              <svg className="ic" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <ThemeToggle />
        <i className="vd" />
        <div className="ov"><span>Overall</span><b>{overall}%</b></div>
        <i className="vd" />
        <span className="mono sec">{`${today.replace(/-/g, "/")} · ${count} tasks`}</span>
      </div>
    </header>
  );
}
