"use client";
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { THEMES, THEME_ORDER, mkSC, mkPC, mkCC, mkPJC, F } from "@/lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    try { return localStorage.getItem("dash-theme") || "warm"; } catch { return "warm"; }
  });

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
    try { localStorage.setItem("dash-theme", themeKey); } catch {}
    document.body.style.background = (THEMES[themeKey] || THEMES.warm).bg;
  }, [themeKey]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
