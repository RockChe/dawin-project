"use client";
import { createContext, useContext, useMemo } from "react";

// v2 個人設定的單一來源：頂層只掛一次（線上＝LiveSettings 的 useUserSettings，預覽＝這裡的 Static），
// 子元件一律用 useV2Settings() 讀寫，不自開 hook。
const NOOP = async () => ({ success: true });
const Ctx = createContext({ settings: {}, updateSetting: NOOP, ready: true });

export const V2SettingsProvider = Ctx.Provider;
export const useV2Settings = () => useContext(Ctx);

/** 預覽／測試用：固定設定、寫入是 no-op（不碰 server action）。 */
export function StaticSettingsProvider({ settings = {}, children }) {
  const value = useMemo(() => ({ settings, updateSetting: NOOP, ready: true }), [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
