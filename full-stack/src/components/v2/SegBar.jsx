"use client";
import { barGeometry } from "@/lib/v2Axis";
import { dayIndex } from "@/lib/dayIndex";
import { formatShortDate } from "@/lib/formatShortDate";
import { useCloudLevel } from "@/components/CloudLevelContext";
import Cloud from "./Cloud";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 混合條（Timeline 定案版）：外框＝專案起訖、10 格＝進度、黑色刻度＝今天應有進度、斜線＝落後差距。
// row 來自 projectRows／timelineProjects／taskModel；ax 來自 timeAxis。ends＝兩端印日期（MM/DD，跨年 YYYY/MM/DD）。
// badge＝專案條上標「落後約 N 天」／「領先約 N 天」（領先帶筋斗雲；雲不畫時改 ▲）；只有 row.kind==='p' 且有今天刻度才標。
// 這支同時是 Overview 縮小版、Timeline 甘特與（Task 6）專案詳情甘特共用的條。
export default function SegBar({ row, ax, today, ends = false, badge = false }) {
  const level = useCloudLevel();
  const g = barGeometry({ ...row, gapKind: row.gapInfo.kind }, ax, today);
  if (g.none) return <span className="none">此時間範圍沒有排程</span>;
  const gi = row.gapInfo;
  const aria = `${row.name}　進度 ${row.prog}%，時間已過 ${row.el}%，${gi.text}${gi.sub || ""}`;
  let lab = null;
  if (badge && row.kind === "p" && g.tick && (gi.kind === "behind" || gi.kind === "ahead")) {
    const s0 = dayIndex(row.s), e0 = dayIndex(row.e);
    const mid = clamp(ax.P(s0 + ((e0 - s0) * (row.prog + row.el)) / 200), 0, 100);
    lab = (
      <span className={`lb ${gi.kind}`} title={gi.tip} style={{ left: `clamp(48px,${mid}%,calc(100% - 48px))` }}>
        {gi.kind === "ahead" && (level === "full" ? <Cloud kind="nimbus" size={14} deco /> : <span className="fbt" aria-hidden="true">▲</span>)}
        {gi.text}
      </span>
    );
  }
  return (
    <>
      {ends && <>
        <span className="dl ls" style={{ left: `calc(${g.l}% - 8px)` }}>{g.cl0 ? "◂ " : ""}{formatShortDate(row.s, today)}</span>
        <span className="dl le" style={{ left: `calc(${g.r}% + 8px)` }}>{formatShortDate(row.e, today)}{g.cr0 ? " ▸" : ""}</span>
      </>}
      <span className={`hb s-${row.state}${g.cl0 ? " cl0" : ""}${g.cr0 ? " cr0" : ""}`} role="img" aria-label={aria} title={aria}
        data-prog={row.prog} data-el={row.el} style={{ left: `${g.l}%`, width: `${g.r - g.l}%` }}>
        <span className="clip">
          <span className="cells" style={{ left: `${-g.off * 100}%`, width: `${g.k * 100}%` }}>
            {g.cells.map((c, i) => (
              <i key={i} className={`${c.kind}${c.hz ? " hz" : ""}`}>
                {c.p > 0 && <b style={{ width: `${c.p * 100}%` }} />}
                {c.hz && <u style={{ left: `${c.hz.left * 100}%`, width: `${c.hz.width * 100}%` }} />}
              </i>
            ))}
            {g.tick && <i className="k" data-el={g.tick.el} style={{ left: `calc(${g.tick.el}% - var(--gp) * ${g.tick.gapK})` }} />}
          </span>
        </span>
      </span>
      {lab}
    </>
  );
}
