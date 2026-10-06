"use client";
import { logout } from "@/server/actions/auth";
import { useTheme } from "@/components/ThemeProvider";

// 切換版本：平板版完成前不顯示平板入口（見 ENABLED_DEVICES）。
export default function MoreScreen({ userName }) {
  const { X } = useTheme();
  const row = { display: "flex", alignItems: "center", minHeight: 48, padding: "0 16px", background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, color: X.text, fontSize: 16, textDecoration: "none", width: "100%", cursor: "pointer" };
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {userName && <div style={{ fontSize: 14, color: X.textSec }}>{userName}</div>}
      <a href="/api/device?to=desktop" style={row}>切到桌機版</a>
      <form action={logout}>
        <button type="submit" style={{ ...row, color: X.red }}>登出</button>
      </form>
      <p style={{ fontSize: 13, color: X.textDim, margin: "4px 0 0" }}>資料表、設定、帳號管理請使用桌機版</p>
    </div>
  );
}
