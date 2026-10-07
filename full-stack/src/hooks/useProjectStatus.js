"use client";
import { createContext, useContext, useMemo } from "react";
import { dayIndex } from "@/lib/dayIndex";
import { elapsedPct, stateOf } from "@/lib/timelineGap";
import { projectStatus } from "@/lib/projectWeather";
import { fD, toBusinessDateString } from "@/lib/utils";

// 「今天」快照：Dashboard 只算一次經 Provider 往下傳，避免各處各自 new Date() 造成 SSR／hydration 差異。
// 沒有 Provider（單獨渲染／測試）時才退回即時營業日。
export const TodayContext = createContext(null);
export const useToday = () => useContext(TodayContext) ?? toBusinessDateString();

/**
 * 一個專案的「狀況 chip ＋ 分段條」所需資料（純函式，Overview 在 useMemo 內直接用）。
 * tasks: [{status, start, end, progress}]；專案區間 = 任務最早開始～最晚結束，平均進度 = 全部任務算術平均。
 * 回傳 projectStatus 的 {key,label,text,cloud} 加上 bar（可直接展開給 <SegBar />）。
 */
export function computeProjectStatus(tasks = [], today) {
  let s = null, e = null, sI = null, eI = null;
  for (const t of tasks) {
    const a = dayIndex(t.start), b = dayIndex(t.end);
    if (a == null || b == null) continue;
    if (sI == null || a < sI) { sI = a; s = t.start; }
    if (eI == null || b > eI) { eI = b; e = t.end; }
  }
  const avg = tasks.length ? Math.round(tasks.reduce((n, t) => n + (Number(t.progress) || 0), 0) / tasks.length) : 0;
  const el = s && e ? elapsedPct(s, e, today) : 0;
  const st = projectStatus({ tasks, range: { s, e }, today, avg, el });
  const gap = avg - el;
  const state = stateOf({ overdue: st.key === "over", hold: st.key === "hold", prop: st.key === "prop", gap });
  return {
    ...st,
    bar: {
      prog: avg, elapsed: el, gap, state,
      tot: sI != null ? eI - sI : 0,
      done: tasks.length > 0 && tasks.every((t) => t.status === "已完成"),
      startLabel: s ? fD(s) : "", endLabel: e ? fD(e) : "",
    },
  };
}

export function useProjectStatus(tasks) {
  const today = useToday();
  return useMemo(() => computeProjectStatus(tasks, today), [tasks, today]);
}
