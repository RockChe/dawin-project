"use client";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { pD, fD, computeProgress } from "@/lib/utils";

export default function MobileGanttList({ tasks, subtasks, fp, fs, fpr, timeDim = "月" }) {
  const { X, SC, PC, PJC } = useTheme();
  const fil = tasks.filter(d => { if (!d.start) return false; if (fp instanceof Set) { if (fp.size > 0 && !fp.has(d.project)) return false; } else if (typeof fp === "string" && fp !== "全部" && d.project !== fp) return false; if (fs !== "全部" && d.status !== fs) return false; if (fpr !== "全部" && d.priority !== fpr) return false; return true; });
  if (!fil.length) return (<div style={{ padding: 60, textAlign: "center", color: X.textDim }}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📅</div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: X.textSec }}>No timeline data</div><div style={{ fontSize: 14 }}>Try adjusting filters or adding tasks with dates</div></div>);
  const pcMap = {}; [...new Set(tasks.map(d => d.project))].forEach((p, i) => { pcMap[p] = PJC[i % PJC.length]; });
  const sorted = [...fil].sort((a, b) => pD(a.start) - pD(b.start));
  const groups = {}; const today = new Date();
  sorted.forEach(t => { const d = pD(t.start); let key, label;
    if (timeDim === "日") { key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; }
    else if (timeDim === "週") { const dow = d.getDay(); const mon = new Date(d.getTime() - ((dow === 0 ? 6 : dow - 1)) * 864e5); key = `${mon.getFullYear()}-W${String(Math.ceil(((mon - new Date(mon.getFullYear(), 0, 1)) / 864e5 + 1) / 7)).padStart(2, "0")}`; label = `${mon.getFullYear()} 年 ${mon.getMonth() + 1}/${mon.getDate()} 週`; }
    else if (timeDim === "季") { const q = Math.floor(d.getMonth() / 3) + 1; key = `${d.getFullYear()}-Q${q}`; label = `${d.getFullYear()} 年 Q${q}`; }
    else { key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`; }
    if (!groups[key]) groups[key] = { label, tasks: [] }; groups[key].tasks.push(t); });
  const todayKey = (() => {
    if (timeDim === "日") return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (timeDim === "週") { const dow = today.getDay(); const mon = new Date(today.getTime() - ((dow === 0 ? 6 : dow - 1)) * 864e5); return `${mon.getFullYear()}-W${String(Math.ceil(((mon - new Date(mon.getFullYear(), 0, 1)) / 864e5 + 1) / 7)).padStart(2, "0")}`; }
    if (timeDim === "季") { const q = Math.floor(today.getMonth() / 3) + 1; return `${today.getFullYear()}-Q${q}`; }
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Object.entries(groups).map(([key, group]) => (
        <div key={key}>
          <div style={{ padding: "10px 0 6px", fontSize: 13, fontWeight: 700, color: X.textDim, borderBottom: `1px solid ${X.border}`, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            {group.label}
            {key === todayKey && <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 10, background: X.accent, color: "#fff", fontWeight: 600 }}>TODAY</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.tasks.map(t => { const sc = SC[t.status] || {}; const pc = PC[t.priority] || {}; const bc = pcMap[t.project] || X.accent;
              const prog = computeProgress(t.id, subtasks); const pct = t.status === "已完成" ? 100 : prog.pct;
              return (
                <div key={t.id} style={{ display: "flex", gap: 10, padding: "10px 12px", background: X.surface, borderRadius: 10, border: `1px solid ${X.border}` }}>
                  <div style={{ width: 4, borderRadius: 2, background: bc, flexShrink: 0, alignSelf: "stretch" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: X.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.task}</span>
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: X.textDim, marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: bc }} />{t.project}
                      <span style={{ color: X.textDim }}>·</span>{t.owner}
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc.color, marginLeft: 4 }} />
                      <span style={{ color: pc.color }}>{t.priority}</span>
                    </div>
                    <div style={{ height: 4, background: X.surfaceLight, borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? X.green : bc, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 12, fontFamily: FM, color: X.textSec }}>
                      {fD(t.start)} → {fD(t.end)}{t.duration ? `  ${t.duration}d` : ""}
                      <span style={{ marginLeft: 8, fontWeight: 600, color: pct === 100 ? X.green : bc }}>{pct}%</span>
                    </div>
                  </div>
                </div>);
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
