// /v2 時間軸與分段條的幾何計算（純函式；今天由呼叫端傳入）。
// 範圍以 today 為基準（設計稿 TSC 在 today=2026/10/07 的值）：日＝−9／+19 天、週＝−23／+68 天、
// 月＝前 4 個月初～後 4 個月初、季＝前 2 季初～後 2 季初。
import { dayIndex } from "./dayIndex";
import { segCells, tickPos } from "./segBar";

const DAY = 864e5;
const ymd = (idx) => { const d = new Date(idx * DAY); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
const at = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY); // m 可為負或 >11，Date.UTC 會自動進位
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function range(scale, T) {
  const [y, m] = ymd(T);
  if (scale === "日") return [T - 9, T + 19, "day"];
  if (scale === "週") return [T - 23, T + 68, "week"];
  if (scale === "季") { const q = Math.floor(m / 3) * 3; return [at(y, q - 6, 1), at(y, q + 6, 1), "quarter"]; }
  return [at(y, m - 4, 1), at(y, m + 4, 1), "month"];
}

/** 時間軸：ticks（刻度）、groups（年／月群組標籤）、lines（格線）、P（日序→百分比）、todayP。 */
export function timeAxis(scale, today) {
  const T = dayIndex(today);
  const [a, b, kind] = range(scale, T);
  const tot = b - a;
  const P = (x) => ((x - a) / tot) * 100;
  const ticks = [], groups = [], lines = [];
  const addLine = (p, strong) => {
    const x = lines.find((l) => Math.abs(l.p - p) < 0.01);
    if (x) x.strong = x.strong || strong; else lines.push({ p, strong });
  };
  const [ay, am] = ymd(a);
  if (kind === "month" || kind === "quarter") {
    for (let i = 0, d = a; d < b; i++, d = at(ay, am + i, 1)) {
      const [, m] = ymd(d);
      if (kind === "quarter" && m % 3) continue;
      ticks.push({ p: P(d), l: kind === "quarter" ? `Q${m / 3 + 1}` : `${m + 1}月`, strong: m === 0 });
      addLine(P(d), m === 0);
    }
    groups.push({ p: 0, l: String(ay), y: 1 });
    for (let y = ay + 1; at(y, 0, 1) < b; y++) groups.push({ p: P(at(y, 0, 1)), l: String(y), y: 1 });
  } else {
    const step = kind === "week" ? 7 : 1;
    for (let d = a; d < b; d += step) {
      const [, m, dd] = ymd(d);
      ticks.push({ p: P(d), l: kind === "week" ? `${m + 1}/${dd}` : String(dd) });
      addLine(P(d), false);
    }
    groups.push({ p: 0, l: `${ay} · ${am + 1}月` });
    for (let i = 1, d = at(ay, am + 1, 1); d < b; d = at(ay, am + ++i, 1)) {
      groups.push({ p: P(d), l: `${ymd(d)[1] + 1}月` });
      addLine(P(d), true);
    }
  }
  return { a, b, kind, P, ticks, groups, lines, todayP: P(T) };
}

/**
 * 混合條（外框＝專案起訖、10 格＝進度、今天刻度、斜線＝落後差距）的幾何。
 * row: { s, e（日期字串）, prog, el, state, done, gapKind }。
 * 回傳 { none:true } 表示範圍外；否則 { l, r（%）, k, off（被裁切時的校正）, cl0／cr0（兩端被裁切）, tick, hat, cells }。
 */
export function barGeometry(row, ax, today) {
  const s0 = dayIndex(row.s), e0 = dayIndex(row.e), T = dayIndex(today);
  if (s0 == null || e0 == null) return { none: true };
  const L = ax.P(s0), R = ax.P(e0);
  if (R < 0 || L > 100) return { none: true };
  const l = clamp(L, 0, 100);
  let r = clamp(R, 0, 100);
  if (r - l < 0.6) r = l + 0.6;
  const k = (R - L) / (r - l), off = (l - L) / (r - l); // 日／週尺度時條會被裁切
  const live = !row.done && T >= s0 && T <= e0 && row.state !== "hold" && row.state !== "prop";
  const hat = live && row.gapKind === "behind";
  const P = segCells(row.prog), Tm = live ? segCells(row.el) : P.map(() => 0);
  const cells = P.map((p, i) => ({
    p,
    kind: p >= 1 ? "fl" : p > 0 ? "pt" : "em",
    hz: hat && Tm[i] > p ? { left: p, width: Tm[i] - p } : null,
  }));
  // 刻度的 x ＝ 時間％ f 的位置，扣掉格間縫：x = W·f − gap·(9f − i)（i＝所在格）
  let tick = null;
  if (live) { const el = tickPos(row.el), f = el / 100, i = Math.min(Math.floor(el / 10), 9); tick = { el, gapK: +(9 * f - i).toFixed(3) }; }
  return { none: false, L, R, l, r, k, off, cl0: L < 0, cr0: R > 100, tick, hat, cells };
}
