"use client";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { themeKey, cycleTheme } = useTheme();
  const dark = themeKey === "dimmed";
  return (
    <button type="button" className="theme-tgl" aria-pressed={dark} aria-label={`切換主題（目前${dark ? "深色" : "淺色"}）`} onClick={cycleTheme}>
      <i>{dark ? "🌙" : "☀️"}</i>
    </button>
  );
}
