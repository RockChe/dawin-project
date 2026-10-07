"use client";
import { useMemo } from "react";
import { STATUSES } from "@/lib/constants";
import { dayIndex } from "@/lib/dayIndex";
import { gapInfo, stateOf } from "@/lib/timelineGap";
import { TL_PROJECT_STATUSES } from "@/lib/v2Timeline";
import { WX, WX_ORDER } from "@/lib/v2Data";
import Cloud from "./Cloud";
import SegBar from "./SegBar";
import { Slot, StatusTag } from "./common";

const GAP_CLS = { behind: "c-amber", ahead: "c-green", done: "c-green", prop: "c-pink" };
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** 篩選 popover（專案狀態／風險／任務狀態／優先度／專案）。f＝{fst,frisk,fs,fpr,fp}，set(patch)。 */
export function FilterPopover({ f, set, all, onClear, onClose }) {
  const chip = (on, label, click, key = label) => <button key={key} type="button" className="chip sm" aria-pressed={on} onClick={click}>{label}</button>;
  return (
    <div className="hpop" role="dialog" aria-label="篩選條件">
      <fieldset><legend>專案狀態</legend>{TL_PROJECT_STATUSES.map((v) => chip(f.fst.includes(v), v, () => set({ fst: toggle(f.fst, v) })))}</fieldset>
      <fieldset><legend>風險</legend>{["逾期", "落後"].map((v) => chip(f.frisk.includes(v), `有${v}`, () => set({ frisk: toggle(f.frisk, v) }), v))}</fieldset>
      <fieldset><legend>任務狀態（展開後的任務列）</legend>{STATUSES.map((v) => chip(f.fs.includes(v), v, () => set({ fs: toggle(f.fs, v) })))}</fieldset>
      <fieldset><legend>優先度</legend>{["全部", "高", "中", "低"].map((v) => chip(f.fpr === v, v, () => set({ fpr: v })))}</fieldset>
      <fieldset><legend>專案</legend>{all.map((m) => chip(f.fp.includes(m.id), <><span className="pdot" style={{ "--c": `var(--${m.color})` }} />{m.name}</>, () => set({ fp: toggle(f.fp, m.id) }), m.id))}</fieldset>
      <div className="pf"><button type="button" className="btn sec sm" onClick={onClear}>清除</button><button type="button" className="btn sm" onClick={onClose}>完成</button></div>
    </div>
  );
}

/** 選取專案的詳情條（預設隱藏；點專案列或卡片才出現）。 */
export function Detail({ m, onOpenProject }) {
  if (!m) return null;
  const gi = m.gapInfo, wx = WX[m.key];
  return (
    <>
      <div><span className="k">專案</span><b>{m.name}</b> <StatusTag status={m.status} /></div>
      <div><span className="k">期間</span><b className="mono">{m.s} → {m.e}</b></div>
      <div><span className="k">進度／時間</span><b className="mono">{m.prog}% ／ {m.el}%</b></div>
      <div><span className="k">對時間</span><b className={GAP_CLS[gi.kind] || "c-sec"}>{gi.text}{gi.sub && <> <small>{gi.sub}</small></>}</b></div>
      <div><span className="k">逾期</span><b className={m.od ? "c-red" : "c-sec"}>{m.od ? `${m.od} 件（最久 ${m.odDays} 天：${m.odName}）` : "無"}</b></div>
      <div><span className="k">成員</span><b>{m.owners.join("、")}</b></div>
      <div><span className="k">狀況</span><b>{wx.label}</b></div>
      <button type="button" className="btn sec sm" onClick={() => onOpenProject?.(m.id)}>開啟專案 ›</button>
    </>
  );
}

const WX_DESC = { over: "專案內有任務已過期，快處理", ahead: "進度 ≥85% 或明顯領先時程", ok: "進行中，沒有逾期", hold: "專案內任務全部暫緩", prop: "還在提案或待確認，尚未開工" };
const STL = [["ok", "正常"], ["behind", "落後"], ["over", "逾期"], ["hold", "暫緩"], ["prop", "提案／待確認"]];
const DAY = 864e5, ymd = (idx) => new Date(idx * DAY).toISOString().slice(0, 10).replace(/-/g, "/");

// 「怎麼讀一條」的示範專案：相對今天（工期 80 天、已過 36 天、進度 27% → 落後約 14 天），不論今天是哪天都長一樣。
function demoRow(today) {
  const T = dayIndex(today), s = T - 36, e = T + 44, prog = 27, el = 45, gap = prog - el;
  const state = stateOf({ gap });
  return { kind: "p", name: "示範專案", s: ymd(s), e: ymd(e), prog, el, gap, state, gapInfo: gapInfo({ state, done: false, gap, prog, el, tot: 80 }) };
}

function WxLegend() {
  return (
    <div className="wlg" aria-label="專案狀況圖例">
      {WX_ORDER.map((k) => (
        <div key={k}><span className="sqc" style={{ background: `var(--${WX[k].sq})` }} /><Slot size={28}><Cloud kind={WX[k].cloud} size={28} deco /></Slot><span><b>{WX[k].label}</b> · {WX_DESC[k]}</span></div>
      ))}
    </div>
  );
}

/** 圖例：甘特＝怎麼讀一條＋條的符號＋狀況；卡片＝環／小條說明＋狀況。 */
export default function Legend({ card, today }) {
  const demo = useMemo(() => demoRow(today), [today]);
  const ax = useMemo(() => { const a = dayIndex(demo.s), b = dayIndex(demo.e); return { P: (x) => ((x - a) / (b - a)) * 100 }; }, [demo]);
  if (card) {
    return (
      <section className="blk legend" aria-label="圖例">
        <p className="hint">環＝進度；時間 vs 進度小條＝灰色是今天已過的時間、彩色是實際進度；「落後約 N 天」＝進度比今天應有的少約 N 天的工作量（括號內為百分點）。</p>
        <WxLegend />
      </section>
    );
  }
  const gi = demo.gapInfo;
  return (
    <section className="blk lgd" aria-label="圖例">
      <div>
        <h3 className="ttl"><span className="tbar" style={{ "--c": "var(--amber)" }} />怎麼讀一條</h3>
        <div className="hmini s-behind"><div className="in"><SegBar row={demo} ax={ax} today={today} ends badge /></div></div>
        <div className="eq">
          <div><b>每格 ＝ 這個專案工期的 10%</b>示範條 {demo.prog}% ＝ 2 整格＋第 3 格 70%；格寬隨專案長短而不同。</div>
          <div><b>黑色細線 ＝ 今天應有進度</b>依日期（時間已過 {demo.el}%），不依格；可落在格內任何位置。</div>
        </div>
        <p className="eq1"><b>{gi.text}</b>＝進度比今天應有的少約 {gi.days} 天的工作量（{gi.pts} 點＝百分點）。領先同理，標「領先約 N 天」。</p>
      </div>
      <div>
        <ul aria-label="圖例">
          <li><span className="ic2"><span className="ex"><span className="cell"><i /></span></span></span><span><b>實心格</b>＝已完成的進度（顏色＝狀態）</span></li>
          <li><span className="ic2"><span className="ex"><span className="cell"><i style={{ background: "linear-gradient(90deg,var(--green-f) 40%,color-mix(in srgb,var(--green) 18%,var(--surface)) 40%)" }} /></span></span></span><span><b>半格</b>＝最後一格依比例填</span></li>
          <li><span className="ic2"><span className="ex"><span className="cell"><i className="e" /></span></span></span><span><b>空格</b>＝尚未達成</span></li>
          <li><span className="ic2"><span className="ex"><i className="hh" /></span></span><span><b>斜線</b>＝落後差距（填色終點 → 刻度），旁邊標「落後約 N 天」</span></li>
          <li><span className="ic2"><span className="ex"><i className="kk" /></span></span><span><b>刻度線</b>＝今天應有的進度（2px）</span></li>
          <li><span className="ic2"><Cloud kind="nimbus" size={20} deco fb="dot" fc="green" /></span><span><b>筋斗雲徽章</b>＝領先，標「領先約 N 天」（≥ 5 點才標）</span></li>
        </ul>
        <p className="hint">條色＝狀態（專案色只在左邊 4px 色塊）</p>
        <div>{STL.map(([k, l]) => <span key={k} className={`sq3 s-${k}`}><i />{l}</span>)}</div>
      </div>
      <div className="full"><WxLegend /></div>
    </section>
  );
}
