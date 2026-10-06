"use client";
import { useState, useMemo } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { fD } from "@/lib/utils";
import { toggleStatus, matchesStatusFilter } from "@/lib/statusFilter";
import { STATUSES } from "@/lib/constants";
import { upcomingDeadlines, statusCounts } from "./mobileData";

const CHIPS = ["全部", "進行中", "待辦", "已完成"];

function SectionTitle({ color, children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 3, height: 13, borderRadius: 2, background: color }} />{children}
    </div>
  );
}

export default function OverviewScreen({ twp = [], today, upcomingDays = 30, upcomingLimit = 5, pcMap = {} }) {
  const { X, SC } = useTheme();
  const [sel, setSel] = useState([]);

  const upcoming = useMemo(
    () => upcomingDeadlines(twp.filter(t => matchesStatusFilter(t.status, sel)), today, upcomingDays, upcomingLimit),
    [twp, sel, today, upcomingDays, upcomingLimit],
  );
  const counts = useMemo(() => statusCounts(twp), [twp]);
  const entries = STATUSES.filter(s => counts[s]).map(s => ({ s, n: counts[s], color: SC[s]?.color || X.textDim }));
  const total = entries.reduce((a, e) => a + e.n, 0);
  let acc = 0;
  const gradient = entries.map(e => { const from = acc / total * 100; acc += e.n; return `${e.color} ${from}% ${acc / total * 100}%`; }).join(", ");

  return (
    <div style={{ padding: "0 12px 12px" }}>
      <div style={{ padding: "12px 2px 8px" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>總覽</div>
        <div style={{ fontSize: 12, color: X.textSec }}>全部專案 · {twp.length} 個任務</div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {CHIPS.map(c => {
          const on = c === "全部" ? sel.length === 0 : sel.includes(c);
          return (
            <button key={c} type="button" aria-pressed={on} onClick={() => setSel(s => toggleStatus(s, c))}
              style={{ flex: "none", minHeight: 36, padding: "0 14px", borderRadius: 99, fontSize: 13, cursor: "pointer", border: `1px solid ${on ? X.accent : X.border}`, background: on ? X.accent : X.surface, color: on ? X.bg : X.textSec, fontWeight: on ? 600 : 400 }}>{c}</button>
          );
        })}
      </div>

      <SectionTitle color={X.red}>Upcoming Deadlines</SectionTitle>
      {upcoming.length === 0
        ? <div style={{ padding: 20, textAlign: "center", color: X.textDim, fontSize: 14 }}>未來 {upcomingDays} 天沒有到期任務</div>
        : upcoming.map(t => (
          <div key={t.id} style={{ background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, minHeight: 56 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task}</div>
              <div style={{ fontSize: 12, color: X.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.project} · {t.owner}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: FM, fontSize: 14, fontWeight: 700, color: t.daysLeft <= 7 ? X.red : X.amber }}>{t.daysLeft}d</div>
              <div style={{ fontFamily: FM, fontSize: 11, color: X.textDim }}>{fD(t.end)}</div>
            </div>
          </div>
        ))}

      <SectionTitle color={X.purple}>Status</SectionTitle>
      {total > 0 && (
        <>
          <div role="img" aria-label="狀態分佈甜甜圈" style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${gradient})`, position: "relative", margin: "4px auto" }}>
            <div style={{ position: "absolute", inset: 26, borderRadius: "50%", background: X.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM, fontSize: 20, fontWeight: 700 }}>{total}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 14px", fontSize: 12, color: X.textSec, marginTop: 8 }}>
            {entries.map(e => (
              <span key={e.s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} />{e.s} {e.n}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
