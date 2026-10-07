"use client";
import { useId } from "react";
import { useTheme } from "@/components/ThemeProvider";

// 白天：藍天、白雲、太陽蛋（蛋白＋蛋黃）；夜晚：深藍星空、月亮。兩層疊放，用 opacity 切換。
export default function ThemeToggle() {
  const { themeKey, cycleTheme } = useTheme();
  const dark = themeKey === "dimmed";
  const uid = useId().replace(/:/g, "");
  return (
    <button type="button" className="theme-tgl" aria-pressed={dark} aria-label={`切換主題（目前${dark ? "夜晚" : "白天"}）`} onClick={cycleTheme}>
      <svg viewBox="0 0 64 32" width="64" height="32" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5EB6EE" /><stop offset="1" stopColor="#B9E3FA" /></linearGradient>
          <linearGradient id={`${uid}n`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#141C3A" /><stop offset="1" stopColor="#2C3B6E" /></linearGradient>
        </defs>
        <g className="tg-day">
          <rect width="64" height="32" fill={`url(#${uid}d)`} />
          <g fill="#fff"><ellipse cx="14" cy="22" rx="8" ry="4.5" /><ellipse cx="21" cy="19" rx="6" ry="5" /><ellipse cx="9" cy="19.5" rx="4.5" ry="3.5" /><ellipse cx="30" cy="25" rx="6" ry="3.2" opacity=".85" /></g>
          <path d="M40 9c3-3 9-3 12-.5 4 .2 6.5 4.5 5 8.3-1.4 4-5.5 6.2-9.5 5.8-4 .8-8.5-1-9.5-4.8-.8-3 .2-6.5 2-8.8z" fill="#fff" />
          <circle cx="47.5" cy="16" r="6" fill="#FFB320" /><circle cx="45.5" cy="14" r="1.9" fill="#FFE08A" />
        </g>
        <g className="tg-night">
          <rect width="64" height="32" fill={`url(#${uid}n)`} />
          <g fill="#fff"><circle cx="34" cy="8" r="1" /><circle cx="42" cy="21" r="1.2" /><circle cx="50" cy="10" r="1.4" /><circle cx="57" cy="22" r="1" /><circle cx="27" cy="24" r=".8" /><circle cx="55" cy="6" r=".8" /></g>
          <circle cx="17" cy="16" r="9" fill="#FFF1B8" />
          <circle cx="21" cy="13.5" r="8" fill="#1F2A52" />
          <circle cx="12" cy="19" r="1.2" fill="#E8D68A" opacity=".5" />
        </g>
      </svg>
    </button>
  );
}
