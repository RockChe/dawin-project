"use client";
import { useMemo, useState } from "react";
import { FM } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { STATUS_FILTERS } from "@/lib/constants";
import { toggleStatus } from "@/lib/statusFilter";
import { groupMyTasks, myTaskKpis, daysLeft, roleBadge } from "@/lib/myTasks";

// 手機首頁「我的任務」：登入者名下未完成任務，依到期日分逾期／7 天內／之後（草圖 ①）。
export default function MyTasksScreen({ twp, userName, today, pcMap = {}, openTask }) {
  const { X, SC } = useTheme();
  const [sel, setSel] = useState([]); // 狀態多選，[] = 不篩；不持久化
  const groups = useMemo(() => groupMyTasks(twp, userName, today, sel), [twp, userName, today, sel]);
  const kpis = useMemo(() => myTaskKpis(twp, userName, today), [twp, userName, today]);
  const total = groups.overdue.length + groups.soon.length + groups.later.length + (groups.done?.length || 0);

  const cards = [
    { l: "逾期", n: kpis.overdue, c: X.red },
    { l: "7 天內", n: kpis.soon, c: X.amber },
    { l: "進行中", n: kpis.inProgress, c: X.text },
  ];
  const sections = [
    { k: "overdue", l: "逾期", c: X.red },
    { k: "soon", l: "7 天內", c: X.amber },
    { k: "later", l: "之後", c: X.textDim },
    { k: "done", l: "已完成", c: X.green },
  ];

  return (
    <div style={{ padding: "12px 12px 0" }}>
      <div style={{ padding: "0 2px 8px" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>我的任務</div>
        <div style={{ fontSize: 12, color: X.textSec }}>{userName}</div>
      </div>

      <div data-testid="kpi" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {cards.map(c => (
          <div key={c.l} style={{ flex: 1, background: X.surface, border: `1px solid ${X.border}`, borderRadius: 10, padding: "6px 10px" }}>
            <div style={{ fontFamily: FM, fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: c.c }}>{c.n}</div>
            <div style={{ fontSize: 12, color: X.textSec }}>{c.l}</div>
          </div>
        ))}
      </div>

      <div data-testid="status-chips" style={{ display: "flex", flexWrap: "nowrap", gap: 6, overflowX: "auto", marginBottom: 4, paddingBottom: 2 }}>
        {STATUS_FILTERS.map(st => { const a = st === "全部" ? sel.length === 0 : sel.includes(st), c = SC[st]; return (
          <button key={st} type="button" aria-pressed={a} onClick={() => setSel(v => toggleStatus(v, st))}
            style={{ flexShrink: 0, minHeight: 44, minWidth: 44, padding: "0 16px", whiteSpace: "nowrap", font: "inherit", fontSize: 14, fontWeight: a ? 700 : 400, cursor: "pointer", borderRadius: 22, border: a ? "none" : `1px solid ${X.border}`, background: a ? (c?.color || X.textDim) : X.surface, color: a ? "#fff" : X.textSec }}>{st}</button>); })}
      </div>

      {total === 0 && (
        <div style={{ background: X.surface, borderRadius: 12, padding: 32, border: `1px solid ${X.border}`, textAlign: "center", color: X.textDim, fontSize: 14 }}>
          {sel.length ? "沒有符合篩選的任務" : "沒有指派給你的任務 🎉"}
        </div>
      )}

      {sections.map(s => groups[s.k]?.length > 0 && (
        <section key={s.k}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 3, height: 12, background: s.c, borderRadius: 2 }} />{s.l}
            <span style={{ fontFamily: FM, fontWeight: 400, color: X.textDim }}>{groups[s.k].length}</span>
          </h3>
          {groups[s.k].map(t => {
            const d = daysLeft(t.end, today);
            const role = roleBadge(t, userName);
            const sc = SC[t.status]?.color || X.textDim;
            return (
              <button key={t.id} type="button" onClick={() => openTask(t.id)}
                style={{ display: "block", width: "100%", minHeight: 56, textAlign: "left", font: "inherit", color: X.text, cursor: "pointer", background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 600 }}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t.task}</span>
                  <span style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: s.c }}>{d === null ? "—" : `${d}d`}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 12, color: X.textSec, marginTop: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: pcMap[t.project] || X.accent, flexShrink: 0 }} />
                  <span>{t.project}</span>
                  {role && <span style={{ fontSize: 11, borderRadius: 6, padding: "0 6px", background: `${X.accent}22`, color: X.accent, fontWeight: 500 }}>{role}</span>}
                  <span style={{ fontSize: 11, borderRadius: 6, padding: "0 6px", background: `${sc}22`, color: sc }}>{t.status}</span>
                  {t.sTotal > 0 && <span>子任務 {t.sDone}/{t.sTotal}</span>}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
