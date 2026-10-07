"use client";
import { useEffect, useMemo, useState } from "react";
import { CloudLevelProvider, useCloudLevel, useSetCloudLevel } from "@/components/CloudLevelContext";
import { effectiveCloudMotion, resolveCloudMotion } from "@/lib/personalSettings";
import { myTaskKpis, isMine, daysLeft } from "@/lib/myTasks";
import { WX, projectRows, weatherCounts } from "@/lib/v2Data";
import Cloud from "./Cloud";
import { Seg, Slot, StatusCloud, StatusTag, Switch } from "./common";
import { SetRow } from "./SettingsGeneral";
import { LoadingState, EmptyFiltered, Toast } from "./StateViews";
import { useV2Settings } from "./SettingsContext";
import useReducedMotion from "./useReducedMotion";

// 雲朵圖鑑：[id, 名稱, 它代表, 個性, 出現在哪]（專案狀況用白話，不用氣象比喻）
const GUIDE = [
  ["white", "白雲", "日常、進行中、品牌", "預設、最親切", "頁首 Logo、載入中、「進行中」數字、一般提示"],
  ["pink", "粉紅雲", "提醒、說明、學習、提案", "好奇愛提問", "7 天內到期的提醒、新手引導與說明氣泡、「提案中」狀態"],
  ["purple", "淡紫雲", "暫緩、之後、休息、空空的", "溫柔放鬆", "「之後」分組、「暫緩」狀態、篩選後沒有結果的空狀態"],
  ["dark", "烏雲", "警示、逾期、需要處理", "可愛不可怕", "逾期任務、衝突或錯誤提示、專案狀況為『有逾期』"],
  ["nimbus", "筋斗雲", "完成、衝刺、進度", "一個筋斗翻十萬八千里", "完成任務的慶祝、進度條上跑的小雲、「本月完成」、沒有待辦的空狀態"],
];
const RULES = ["每個畫面最多 5 種雲", "雲只是輔助，旁邊一定有文字", "資料表、設定、帳號管理不放雲（除了這一頁）", "只有兩種動態：載入時上下飄、完成時筋斗雲飛過", "尊重系統的「減少動態」設定"];
const BADGE = <span className="badge">個人設定</span>;

const Kpi = ({ label, n, cloud, tc }) => (
  <div className="card kpi"><div><div className={`kpi-n mono ${tc}`}>{n}</div><small>{label}</small></div><Cloud kind={cloud} size={44} /></div>
);
const Grp = ({ label, cloud, tc, n }) => (
  <section className="mgrp"><h3><Cloud kind={cloud} size={24} /><span className={tc}>{label}</span><span className="cnt">{n}</span></h3></section>
);
const Stat = ({ s }) => <><StatusCloud status={s} size={24} fb={null} /><StatusTag status={s} /></>;
const Wxc = ({ k, n }) => (
  <span className="wxc" style={{ "--c": `var(--${WX[k].sq})` }}><span className="sqc" style={{ background: `var(--${WX[k].sq})` }} /><Slot size={28}><Cloud kind={WX[k].cloud} size={28} /></Slot><span>{WX[k].label}</span><b>{n}</b></span>
);

// 每朵雲出現在哪：3 個縮圖，全用真元件與真資料
function previews(id, { kpi, later, wx }) {
  return {
    white: [["頁首 Logo", <div className="brand" key="a"><Cloud kind="white" size={34} /><span>大雲文創專案管理系統</span></div>], ["My Tasks · 進行中 KPI", <Kpi key="b" label="進行中" n={kpi.inProgress} cloud="white" tc="" />], ["載入中", <LoadingState key="c" />]],
    pink: [["My Tasks · 7 天內到期 KPI", <Kpi key="a" label="7 天內到期" n={kpi.soon} cloud="pink" tc="c-pink" />], ["說明氣泡（小提示）", <div className="tip" role="note" key="b"><Cloud kind="pink" size={24} /><span><b>小提示</b>　在子任務加上負責人，執行人就會自動帶出。</span></div>], ["任務狀態「提案中」", <Stat key="c" s="提案中" />]],
    purple: [["My Tasks · 之後 分組", <Grp key="a" label="之後" cloud="purple" tc="c-purple" n={later} />], ["任務狀態「暫緩」", <Stat key="b" s="暫緩" />], ["篩選後沒有結果", <EmptyFiltered key="c" />]],
    dark: [["My Tasks · 已逾期 KPI", <Kpi key="a" label="已逾期" n={kpi.overdue} cloud="dark" tc="c-red" />], ["逾期 分組標題", <Grp key="b" label="逾期" cloud="dark" tc="c-red" n={kpi.overdue} />], ["專案狀況 chip「有逾期」", <Wxc key="c" k="over" n={wx.over} />]],
    nimbus: [["My Tasks · 本月完成 KPI", <Kpi key="a" label="本月已完成" n={kpi.doneThisMonth} cloud="nimbus" tc="c-green" />], ["完成任務的提示條", <Toast key="b" kind="ok" title="完成了！" sub="「票務展務相關」已標示完成" />], ["Timeline · 進度領先 badge", <span className="tlx" key="c" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className="lb ahead"><Cloud kind="nimbus" size={14} />領先約 9 天</span><Wxc k="ahead" n={wx.ahead} /></span>]],
  }[id];
}

// 雲朵專區（唯一放雲的設定頁）：圖鑑、預覽、標題一律 force-on（不受顯示程度影響）。
// 顯示程度＝cloudLevel（沿用 context）；動態效果＝cloudMotion（新個人設定，預設開）；與系統「減少動態」取交集。
// preview：{ twp, projects, userName, today }，預覽縮圖用的真資料。
export default function CloudSettings({ preview, initSel }) {
  const { settings, updateSetting } = useV2Settings();
  const level = useCloudLevel(), setLevel = useSetCloudLevel();
  const reduced = useReducedMotion();
  const motionOn = effectiveCloudMotion(settings.cloudMotion, reduced);
  const [sel, setSel] = useState(GUIDE.some((g) => g[0] === initSel) ? initSel : null); // initSel：預覽用，一開始就展開某朵雲
  const [toast, setToast] = useState(false);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(false), 4500); return () => clearTimeout(id); }, [toast]);

  const { twp, projects, userName, today } = preview;
  const data = useMemo(() => {
    const kpi = myTaskKpis(twp, userName, today);
    const later = twp.filter((t) => t.status !== "已完成" && isMine(t, userName) && daysLeft(t.end, today) > 7).length;
    return { kpi, later, wx: weatherCounts(projectRows(twp, projects, today)) };
  }, [twp, projects, userName, today]);

  return (
    <div className="cpage">
      <CloudLevelProvider level="full">
        <section className="blk chd" aria-labelledby="cp-h">
          <Cloud kind="white" size={96} />
          <div><h2 id="cp-h">雲朵</h2><p>雲朵是系統的表情，幫你一眼看出狀態；這些都是個人設定，只影響你自己的畫面，換裝置也跟著你的帳號。</p></div>
        </section>
      </CloudLevelProvider>

      <section className="blk" aria-labelledby="cp-t1">
        <h3 className="ttl" id="cp-t1" style={{ marginBottom: 4 }}><span className="tbar" style={{ "--c": "var(--green)" }} />顯示與動態</h3>
        <SetRow title="顯示程度" badge={BADGE} small="完整＝依規則顯示在各處；精簡＝只留頁首 Logo、空狀態與載入中；關閉＝全部不顯示。">
          <Seg items={[["full", "完整"], ["lite", "精簡"], ["off", "關閉"]]} value={level} onChange={setLevel} label="顯示程度" />
        </SetRow>
        <SetRow title="動態效果" badge={BADGE} small={`載入時上下飄、完成時筋斗雲飛過。預設跟隨系統「減少動態」${reduced ? "；偵測到你的系統已開啟「減少動態」，所以這裡固定停用。" : "。"}`}>
          {(id) => (
            <div className="ctl">
              <CloudLevelProvider level="full">
                <div className="mprev" role="img" aria-label="動態預覽：白雲上下飄、筋斗雲飛過">
                  <span className="m"><Cloud kind="white" size={44} motion={motionOn ? "bob" : undefined} />載入中</span>
                  <span className="m"><Cloud kind="nimbus" size={44} motion={motionOn ? "fly" : undefined} />完成時</span>
                  {!motionOn && <span className="m hint">（目前靜止）</span>}
                </div>
              </CloudLevelProvider>
              <Switch labelId={id} checked={motionOn} disabled={reduced} onChange={() => updateSetting("cloudMotion", !resolveCloudMotion(settings.cloudMotion))} />
            </div>
          )}
        </SetRow>
        <SetRow title="預覽" small="播一次「完成了！」提示條，看看你目前的設定長什麼樣子。">
          <button type="button" className="btn sec" onClick={() => setToast(true)}>預覽</button>
        </SetRow>
      </section>

      <section className="blk" aria-labelledby="cp-t2">
        <div className="hd2 tight"><h3 className="ttl" id="cp-t2"><span className="tbar" />雲朵圖鑑 · 每朵雲的職責</h3><span className="hint">點一列，看這朵雲出現在畫面的哪裡</span></div>
        <CloudLevelProvider level="full">
          <table className="ctab">
            <thead><tr><th scope="col">雲</th><th scope="col">它代表</th><th scope="col">出現在哪</th></tr></thead>
            <tbody>
              {GUIDE.flatMap(([id, name, role, pers, where]) => {
                const on = sel === id;
                const rows = [
                  <tr key={id} className={`cr${on ? " on" : ""}`} onClick={() => setSel(on ? null : id)}>
                    <td style={{ width: 250 }}><button type="button" className="rb" aria-expanded={on} aria-controls={on ? `cpv-${id}` : undefined}><Cloud kind={id} size={64} /><span>{name}</span></button></td>
                    <td><b>{role}</b><span className="pr">（{pers}）</span></td><td>{where}</td>
                  </tr>,
                ];
                if (on) rows.push(<tr key={`${id}-pv`}><td colSpan={3} className="pv"><div id={`cpv-${id}`} className="cprev" role="region" aria-label={`${name}出現在哪的預覽`}>
                  {previews(id, data).map(([cap, el]) => <figure key={cap} className="cex"><figcaption>{cap}</figcaption><div className="box">{el}</div></figure>)}
                </div></td></tr>);
                return rows;
              })}
            </tbody>
          </table>
        </CloudLevelProvider>
      </section>

      <section className="blk" aria-labelledby="cp-t3">
        <h3 className="ttl" id="cp-t3" style={{ marginBottom: 4 }}><span className="tbar" style={{ "--c": "var(--amber)" }} />使用規則</h3>
        <ul className="crules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <p className="hint" style={{ margin: 0 }}>雲朵目前是向量草稿，正式上線前會請插畫師精修。</p>
      {toast && <CloudLevelProvider level={level}><Toast kind="ok" title="完成了！" sub="「票務展務相關」已標示完成，本專案已完成 3 / 8" float /></CloudLevelProvider>}
    </div>
  );
}

