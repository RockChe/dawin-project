"use client";
import { useEffect, useId, useState } from "react";
import { useCan } from "@/components/PermissionProvider";
import { useCloudLevel, useSetCloudLevel } from "@/components/CloudLevelContext";
import { resolveGanttWidths } from "@/lib/personalSettings";
import { PROJECT_COLORS } from "@/lib/v2Data";
import { Icon, Switch } from "./common";
import { useV2Settings } from "./SettingsContext";

const VIEWS = [["overview", "Overview"], ["project", "Project Detail"], ["timeline", "Timeline"]];
const UNITS = [["day", "日"], ["week", "週"], ["month", "月"], ["quarter", "季"]];
const GW_DEFAULT = { day: 20, week: 50, month: 50, quarter: 100 };
const dot = (i) => ({ "--c": `var(--${PROJECT_COLORS[i % PROJECT_COLORS.length]})` });

/** 設定列：左邊標題＋說明，右邊控制項；children 可收到標題元素的 id（給 switch 當名稱）。 */
export function SetRow({ title, small, badge, extra, className = "", children }) {
  const id = useId();
  return (
    <div className={`setrow ${className}`}>
      <div><b><span id={id}>{title}</span>{badge}</b>{small && <small>{small}</small>}{extra}</div>
      {typeof children === "function" ? children(id) : children}
    </div>
  );
}

// Settings 一般頁：不放雲（雲朵專區另一頁）、不含「全站放大」（R4：v2 固定 1280、100%，不套用 zoom）。
// 分類與 Owners 是共用資料，只有 write 才看得到；其餘都是個人設定（self），viewer 也能改。
// config：{ cats, owners }；actions：{ saveCats, notify }；個人設定走 useV2Settings().updateSetting。
export default function SettingsGeneral({ config, actions, onSub }) {
  const { settings, updateSetting } = useV2Settings();
  const canWrite = useCan("write");
  const level = useCloudLevel(), setLevel = useSetCloudLevel();
  const { cats = [], owners = [] } = config || {};
  const { saveCats, notify } = actions;
  const [newCat, setNewCat] = useState("");
  const days = settings.upcomingDays ?? 30, limit = settings.upcomingLimit ?? 5;
  const [upDays, setUpDays] = useState(String(days));
  const [upLimit, setUpLimit] = useState(String(limit));
  useEffect(() => { setUpDays(String(days)); setUpLimit(String(limit)); }, [days, limit]);
  const saved = resolveGanttWidths(settings.ganttWidths);
  const [gw, setGw] = useState(() => JSON.parse(JSON.stringify(saved)));
  const gwKey = JSON.stringify(saved);
  useEffect(() => { setGw(JSON.parse(gwKey)); }, [gwKey]);

  const addCat = () => { const v = newCat.trim(); if (!v) return; saveCats([...cats, v]); setNewCat(""); notify("Category added", "success"); };
  const saveUpcoming = () => {
    updateSetting("upcomingDays", Math.max(1, parseInt(upDays) || 30));
    updateSetting("upcomingLimit", Math.max(1, parseInt(upLimit) || 5));
    notify("Upcoming settings saved", "success");
  };
  const saveWidths = () => {
    const out = {};
    for (const [v] of VIEWS) { out[v] = {}; for (const [k] of UNITS) { const n = gw[v]?.[k]; out[v][k] = n === "" || n == null ? GW_DEFAULT[k] : Math.max(1, n); } }
    updateSetting("ganttWidths", out);
    notify("Timeline widths saved", "success");
  };

  return (
    <div className="sgrid">
      {canWrite && (
        <section className="blk">
          <h3 className="ttl"><span className="tbar" />Categories</h3>
          {cats.map((c, i) => (
            <div key={`${c}-${i}`} className="lst">
              <span className="pdot" style={dot(i)} /><span style={{ flex: 1 }}>{c}</span>
              <button type="button" className="iconx" aria-label={`移除類別 ${c}`} onClick={() => { saveCats(cats.filter((_, j) => j !== i)); notify("Category removed", "error"); }}><Icon n="x" size={14} /></button>
            </div>
          ))}
          <div className="lst add">
            <input className="fld" style={{ flex: 1 }} placeholder="New category" aria-label="新類別" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCat(); }} />
            <button type="button" className="btn" aria-label="新增類別" onClick={addCat}>+</button>
          </div>
        </section>
      )}
      {canWrite && (
        <section className="blk">
          <h3 className="ttl"><span className="tbar" style={{ "--c": "var(--purple)" }} />Owners</h3>
          {owners.map((o, i) => <div key={o} className="lst"><span className="pdot" style={dot(i)} /><span className="own">{o}</span></div>)}
          <div className="hint" style={{ marginTop: 8 }}>Owner 由帳號管理頁面自動同步</div>
        </section>
      )}
      <section className="blk">
        <h3 className="ttl"><span className="tbar" style={{ "--c": "var(--amber)" }} />Timeline Width (px per unit)</h3>
        {VIEWS.map(([v, name]) => (
          <div key={v}>
            <h4>{name}</h4>
            <div className="g4">
              {UNITS.map(([k, l]) => (
                <div key={k}>
                  <span className="lbl" aria-hidden="true">{l}</span>
                  <input className="fld" type="number" min="1" max="200" aria-label={`${name} ${l}`} value={gw[v]?.[k] ?? ""}
                    onChange={(e) => { const raw = e.target.value; setGw((p) => ({ ...p, [v]: { ...p[v], [k]: raw === "" ? "" : (parseInt(raw) || 1) } })); }}
                    onKeyDown={(e) => { if (e.key === "Enter") saveWidths(); }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="sfoot"><button type="button" className="btn" onClick={saveWidths}>Save Widths</button></div>
      </section>
      <section className="blk">
        <h3 className="ttl" style={{ marginBottom: 4 }}><span className="tbar" style={{ "--c": "var(--green)" }} />Display Settings</h3>
        <SetRow title="顯示雲朵" small="在總覽、我的任務、專案、空狀態與提示條顯示雲朵。關閉後換回原本的色點與文字；資料表與一般設定頁本來就沒有雲。（個人設定，預設開）"
          extra={<button type="button" className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => onSub("cloud")}>更多雲朵設定</button>}>
          {(id) => <Switch labelId={id} checked={level !== "off"} onChange={(on) => setLevel(on ? "full" : "off")} />}
        </SetRow>
        <SetRow title="Timeline 預設收合" small="進入 Timeline 時，每個專案的任務列是否先收起來。（個人設定，預設開）">
          {(id) => <Switch labelId={id} checked={settings.timelineDefaultCollapsed ?? true} onChange={(on) => updateSetting("timelineDefaultCollapsed", on)} />}
        </SetRow>
        <SetRow title="Upcoming Deadlines" small="往後看幾天、最多列幾件">
          <div className="ctl2">
            <input className="fld num" type="number" aria-label="Days ahead" value={upDays} onChange={(e) => setUpDays(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveUpcoming(); }} />
            <span className="hint">天</span>
            <input className="fld num" type="number" aria-label="Max items" value={upLimit} onChange={(e) => setUpLimit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveUpcoming(); }} />
            <span className="hint">件</span>
            <button type="button" className="btn" aria-label="Save Upcoming" onClick={saveUpcoming}>Save</button>
          </div>
        </SetRow>
      </section>
    </div>
  );
}
