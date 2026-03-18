"use client";
import { X, FM } from "@/lib/theme";
import { computeProgress } from "@/lib/utils";

export default function MiniGantt({ tasks, subtasks, height = 28, color }) {
  const totalProg = tasks.length > 0 ? Math.round(tasks.reduce((s, t) => { const p = computeProgress(t.id, subtasks); return s + (t.status === "已完成" ? 100 : p.pct); }, 0) / tasks.length) : 0;
  const c = color || X.accent;
  return (
    <div style={{ position: "relative", height, overflow: "hidden", borderRadius: 4, background: X.surfaceLight }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${totalProg}%`, background: c, opacity: 0.4, borderRadius: 4 }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${totalProg}%`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
        {totalProg > 8 && <span style={{ fontFamily: FM, fontSize: 12, fontWeight: 600, color: c }}>{totalProg}%</span>}
      </div>
    </div>
  );
}
