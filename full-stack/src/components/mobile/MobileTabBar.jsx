"use client";
import { F } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

export const MOBILE_TABS = [
  { k: "mytasks", l: "我的任務", i: "☑" },
  { k: "overview", l: "總覽", i: "◔" },
  { k: "projects", l: "專案", i: "▤" },
  { k: "timeline", l: "時程", i: "≡" },
  { k: "more", l: "更多", i: "⋯" },
];

export default function MobileTabBar({ tab, onChange }) {
  const { X } = useTheme();
  return (
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", background: X.surface, borderTop: `1px solid ${X.border}`, paddingBottom: "env(safe-area-inset-bottom)", fontFamily: F }}>
      {MOBILE_TABS.map(t => {
        const on = tab === t.k;
        return (
          <button key={t.k} type="button" aria-label={t.l} aria-current={on ? "page" : undefined} onClick={() => onChange(t.k)}
            style={{ flex: 1, minHeight: 56, minWidth: 44, border: "none", background: "transparent", color: on ? X.accent : X.textDim, fontSize: 11, fontWeight: on ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer" }}>
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{t.i}</span>
            <span aria-hidden="true">{t.l}</span>
          </button>
        );
      })}
    </nav>
  );
}
