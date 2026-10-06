"use client";
import { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { THEMES, THEME_ORDER, mkSC, mkPC, mkCC, mkPJC, F } from "@/lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // 首次 render（SSR 與 client hydrate）必須一致，所以固定 "warm"；
  // hydrate 完在 layout effect 同步讀 localStorage（paint 前套用，不多一幀）。
  const [themeKey, setThemeKey] = useState("warm");
  // 同步完成前不寫回 localStorage，否則會用預設 "warm" 蓋掉使用者存的深色
  const [synced, setSynced] = useState(false);

  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("dash-theme");
      if (saved && THEMES[saved]) setThemeKey(saved);
    } catch {}
    setSynced(true);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeKey(p => {
      const i = THEME_ORDER.indexOf(p);
      return THEME_ORDER[(i + 1) % THEME_ORDER.length];
    });
  }, []);

  const value = useMemo(() => {
    const t = THEMES[themeKey] || THEMES.warm;
    return {
      themeKey, cycleTheme, X: t,
      SC: mkSC(t), PC: mkPC(t), CC: mkCC(t), PJC: mkPJC(t),
      inputStyle: {
        fontFamily: F, fontSize: 14, padding: "6px 10px",
        borderRadius: 8, border: `1px solid ${t.border}`,
        outline: "none", color: t.text, background: t.surface, width: "100%",
      },
    };
  }, [themeKey, cycleTheme]);

  useEffect(() => {
    if (!synced) return;
    try { localStorage.setItem("dash-theme", themeKey); } catch {}
    document.body.style.background = (THEMES[themeKey] || THEMES.warm).bg;
  }, [themeKey, synced]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
