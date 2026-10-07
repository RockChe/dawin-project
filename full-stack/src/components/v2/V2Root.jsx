"use client";
import { useTheme } from "@/components/ThemeProvider";
import { PermissionProvider } from "@/components/PermissionProvider";

// ThemeProvider 的 themeKey 是唯一來源：warm→light、dimmed→dark，映射成 .v2[data-theme]。
// 固定桌機 1280、不套用 zoom（舊版 zoom 只在 Dashboard 自己的容器上，這裡不碰）。
export const toV2Theme = (themeKey) => (themeKey === "dimmed" ? "dark" : "light");

export default function V2Root({ role, children }) {
  const { themeKey } = useTheme();
  return (
    <div className="v2" data-theme={toV2Theme(themeKey)} style={{ minWidth: 1280 }}>
      <PermissionProvider role={role}>{children}</PermissionProvider>
    </div>
  );
}
