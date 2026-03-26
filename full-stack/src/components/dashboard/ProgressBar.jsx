"use client";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

export default function ProgressBar({ pct, done, total, timeBased }) {
  const { X } = useTheme();
  const c = pct === 100 ? X.green : pct >= 50 ? X.amber : pct > 0 ? X.accent : X.border;
  return (<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ flex: 1, height: 5, background: X.surfaceLight, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: c, borderRadius: 2 }} /></div>
    <span style={{ fontFamily: FM, fontSize: 14, color: pct === 100 ? X.green : X.textSec, whiteSpace: "nowrap" }}>{timeBased ? `${pct}%` : `${done}/${total}`}</span>
  </div>);
}
