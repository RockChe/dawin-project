"use client";
import { useEffect, useMemo, useState } from "react";
import { useCloudLevel } from "@/components/CloudLevelContext";
import { resolveGanttWidths, resolveTimeDim, resolveTimelineView } from "@/lib/personalSettings";
import { timeAxis } from "@/lib/v2Axis";
import { WX, WX_ORDER } from "@/lib/v2Data";
import { COLLAPSED_LS_KEY, TL_SORTS, flattenRows, resolveCollapsed, timelineProjects, trackPx } from "@/lib/v2Timeline";
import Cloud from "./Cloud";
import GanttChart from "./GanttChart";
import Legend, { Detail, FilterPopover } from "./TimelineParts";
import TimelineBoard from "./TimelineBoard";
import { Seg, Slot } from "./common";
import { useV2Settings } from "./SettingsContext";

const SCALES = [["日", "日"], ["週", "週"], ["月", "月"], ["季", "季"]];
const VIEWS = [["gantt", "甘特"], ["card", "卡片"]];
const NO_FILTER = { fst: [], frisk: [], fs: [], fpr: "全部", fp: [] };
const SKY = [["white", 56, 8, 6], ["nimbus", 44, 34, -4], ["pink", 60, 58, 2], ["purple", 40, 86, -2]];

// Timeline：甘特（含任務展開）與卡片兩種視圖共用同一份 timelineProjects（隱藏／封存／篩選／排序只算一次）。
// 個人設定：timelineView／timelineSort／timelineDefaultCollapsed／timeDimTimeline／hiddenProjects／ganttWidths；
// 逐專案收折存 localStorage（dash-timelineCollapsed，同舊版 per-device）；篩選與標出狀況只放本頁 state。
// onlyIds：頁首搜尋結果（有符合任務的專案 id 集合；null＝不篩）。只決定哪些專案列要畫，專案的日期／進度仍用完整資料算。
export default function Timeline({ twp, projects, userNames = [], today, onOpenProject, init, onlyIds = null }) {
  const { settings, updateSetting } = useV2Settings();
  const cloudFull = useCloudLevel() === "full";
  const view = resolveTimelineView(settings.timelineView), card = view === "card";
  const scale = resolveTimeDim(settings.timeDimTimeline);
  const defCollapsed = settings.timelineDefaultCollapsed ?? true;
  const hidden = useMemo(() => settings.hiddenProjects || [], [settings.hiddenProjects]);
  const gw = resolveGanttWidths(settings.ganttWidths).timeline;

  const [sortLocal, setSortLocal] = useState(null); // 「到期日」不寫入設定，所以選擇值先留在本頁
  const sort = sortLocal ?? (["manual", "name", "progress"].includes(settings.timelineSort) ? settings.timelineSort : "manual");
  const [f, setF] = useState(NO_FILTER);
  const [fo, setFo] = useState(!!init?.filterOpen); // init：預覽用（篩選 popover 一開始就開、一開始就選取某專案）
  const [hl, setHl] = useState(null);
  const [sel, setSel] = useState(init?.selectedId || null);
  const [saved, setSaved] = useState(null); // 逐專案收折（null＝沒動過，跟預設）；SSR 先用預設，掛載後再讀 localStorage
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(COLLAPSED_LS_KEY)); if (Array.isArray(v)) setSaved(v); } catch { /* 沒有或壞掉就用預設 */ }
  }, []);

  const { all, list: full } = useMemo(() => timelineProjects(twp, projects, today, { hidden, fp: f.fp, fst: f.fst, frisk: f.frisk, sort }), [twp, projects, today, hidden, f.fp, f.fst, f.frisk, sort]);
  const list = useMemo(() => (onlyIds ? full.filter((m) => onlyIds.has(m.id)) : full), [full, onlyIds]);
  const allIds = useMemo(() => all.map((m) => m.id), [all]);
  const collapsed = useMemo(() => resolveCollapsed(saved, defCollapsed, allIds), [saved, defCollapsed, allIds]);
  const allCollapsed = list.length > 0 && list.every((m) => collapsed.includes(m.id));
  const rows = useMemo(() => flattenRows(list, collapsed, f), [list, collapsed, f]);
  const ax = useMemo(() => timeAxis(scale, today), [scale, today]);
  const nf = f.fst.length + f.frisk.length + f.fs.length + f.fp.length + (f.fpr !== "全部" ? 1 : 0);
  const wcount = (k) => list.filter((m) => m.key === k).length;
  const selM = list.find((m) => m.id === sel);

  const persist = (next) => { setSaved(next); try { localStorage.setItem(COLLAPSED_LS_KEY, JSON.stringify(next)); } catch { /* 無痕模式等：只存在記憶體 */ } };
  const onToggle = (id) => persist(collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id]);
  const onAll = () => { persist(allCollapsed ? [] : allIds); updateSetting("timelineDefaultCollapsed", !allCollapsed); };
  const onSort = (v) => { setSortLocal(v); if (v !== "due") updateSetting("timelineSort", v); };
  const archived = projects.filter((p) => p.archivedAt).length, eye = projects.filter((p) => !p.archivedAt && hidden.includes(p.id)).length;

  return (
    <div className="tlx">
      <div className="tl1" role="toolbar" aria-label="Timeline 工具列">
        <Seg items={VIEWS} value={view} onChange={(v) => updateSetting("timelineView", v)} label="視圖切換" />
        <div className="pw">
          <button type="button" className="chip" aria-haspopup="dialog" aria-expanded={fo} onClick={() => setFo(!fo)}>
            篩選{nf > 0 && <span className="cnt" aria-label={`${nf} 個條件`}>{nf}</span>}
          </button>
          {fo && <FilterPopover f={f} set={(p) => setF((x) => ({ ...x, ...p }))} all={all} onClear={() => setF(NO_FILTER)} onClose={() => setFo(false)} />}
        </div>
        <label className="sr" htmlFor="tlsort">排序方式</label>
        <select id="tlsort" className="sel" value={sort} onChange={(e) => onSort(e.target.value)}>
          {TL_SORTS.map(([k, l]) => <option key={k} value={k}>排序：{l}</option>)}
        </select>
        {card ? <span className="hint">依「下個里程碑」到期日分組</span> : <Seg items={SCALES} value={scale} onChange={(v) => updateSetting("timeDimTimeline", v)} label="時間尺度" />}
        <span className="sp" />
        <button type="button" className="btn sec" onClick={onAll}>{allCollapsed ? "全部展開" : "全部收折"}</button>
      </div>

      <div className="tl2 wxrow" role="group" aria-label="專案狀況統計（點選可在圖上標出）">
        <span className="lab hint">專案狀況</span>
        {WX_ORDER.map((k) => (
          <button key={k} type="button" className="wxc" style={{ "--c": `var(--${WX[k].sq})` }} aria-pressed={hl === k} onClick={() => setHl(hl === k ? null : k)}>
            <span className="sqc" style={{ background: `var(--${WX[k].sq})` }} />
            <Slot size={28}><Cloud kind={WX[k].cloud} size={28} deco /></Slot>
            <span>{WX[k].label}</span><b>{wcount(k)}</b>
          </button>
        ))}
        {hl && <button type="button" className="btn sec sm" onClick={() => setHl(null)}>取消標出</button>}
        {!card && <>
          <span className="vsep" />
          <span className="ex"><span className="cell"><i /><i /><i /><i className="e" /><i className="e" /></span>每格＝工期 10%</span>
          <span className="ex"><i className="kk" />今天應有進度</span>
          <span className="ex"><i className="hh" />落後差距</span>
        </>}
      </div>

      <section className="blk tlbox" aria-label="Timeline">
        {cloudFull && (
          <div className="sky" aria-hidden="true">
            {SKY.map(([c, s, x, y]) => <span key={c} style={{ position: "absolute", left: `${x}%`, top: y, opacity: 0.08, lineHeight: 0 }}><Cloud kind={c} size={s} deco /></span>)}
          </div>
        )}
        {!list.length
          ? <div className="empty"><Cloud kind="purple" size={64} deco /><b>沒有可顯示的專案</b>調整上方的篩選條件</div>
          : card
            ? <TimelineBoard list={list} today={today} owners={userNames} collapsed={collapsed} hl={hl} selectedId={sel} onSelect={setSel} onOpenProject={onOpenProject} />
            : <GanttChart rows={rows} ax={ax} today={today} inner={trackPx(scale, ax, gw)} scrollKey={scale} collapsed={collapsed} selectedId={sel} hl={hl} onToggle={onToggle} onSelect={setSel} />}
      </section>

      <div className="tdet" aria-live="polite" hidden={!selM}><Detail m={selM} onOpenProject={onOpenProject} /></div>
      <p className="hint tlfoot">
        點選專案列查看詳情。不顯示：已封存 {archived} 個{eye ? `、已隱藏 ${eye} 個` : ""}（可在 Projects 的眼睛切換）。{nf || onlyIds ? `篩選中：顯示 ${list.length} / ${all.length} 個專案。` : ""}
      </p>
      <Legend card={card} today={today} />
    </div>
  );
}
