"use client";
import { useMemo } from "react";
import useUserSettings from "@/hooks/useUserSettings";
import { V2SettingsProvider } from "./SettingsContext";

// v2 頂層唯一的 useUserSettings（initial＝getInitialData 帶來的 settings，空設定給 {}）。
export default function LiveSettings({ initial, children }) {
  const { settings, updateSetting, ready } = useUserSettings({}, undefined, initial ?? {});
  const value = useMemo(() => ({ settings, updateSetting, ready }), [settings, updateSetting, ready]);
  return <V2SettingsProvider value={value}>{children}</V2SettingsProvider>;
}
