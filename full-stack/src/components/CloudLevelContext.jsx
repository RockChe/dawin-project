"use client";
import { createContext, useContext, useMemo } from "react";
import { resolveCloudLevel } from "@/lib/personalSettings";

// 雲朵顯示程度（full 完整／lite 只留文字色塊／off 全關）。設定來源只有 Dashboard 一份
// （useUserSettings），這裡純粹由 props 提供，不自行 fetch；沒有 Provider 時視為 full。
const Ctx = createContext({ level: "full", setLevel: () => {} });

export function CloudLevelProvider({ level, setLevel, children }) {
  const value = useMemo(() => ({ level: resolveCloudLevel(level), setLevel: setLevel || (() => {}) }), [level, setLevel]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCloudLevel = () => useContext(Ctx).level;
export const useSetCloudLevel = () => useContext(Ctx).setLevel;
